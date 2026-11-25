from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Client,
    CreditApplication,
    ExecutionLog,
    Process,
    Task,
    TaskDependency,
)

TERMINAL_FAILURE_STATUSES = {"FAILED", "QUEUED","CANCELLED"}


def get_required_dependencies(session: Session, process_id: str) -> list[dict[str, Any]]:
    proc = session.scalar(select(Process).where(Process.id == process_id))
    if not proc:
        raise ValueError(f"Процесс {process_id} не найден в реестре")
    return list(proc.dependencies or [])


def register_task_dependencies(session: Session, task: Task) -> list[TaskDependency]:
    existing = session.scalars(
        select(TaskDependency).where(TaskDependency.task_id == task.id)
    ).all()
    if existing:
        return existing

    deps_spec = get_required_dependencies(session, task.process_id)
    created_deps: list[TaskDependency] = []

    for spec in deps_spec:
        dep_proc_id = spec.get("process_id")
        if not dep_proc_id:
            continue

        # Пропускаем внешние источники, не зарегистрированные как внутренние BP
        dep_proc = session.scalar(select(Process).where(Process.id == dep_proc_id))
        if not dep_proc:
            continue

        partition_key = _resolve_partition_key(task, spec)
        dep_row = TaskDependency(
            task_id=task.id,
            depends_on_process_id=dep_proc_id,
            required_partition_key=partition_key,
            required_status=spec.get("required_status", "COMPLETED"),
            is_satisfied=False,
            checked_at=datetime.now(timezone.utc),
        )
        session.add(dep_row)
        created_deps.append(dep_row)

    session.flush()
    return created_deps


def _resolve_partition_key(task: Task, spec: dict[str, Any]) -> str:
    params = task.params or {}
    if task.process_id == "BP-04" and spec.get("process_id") == "BP-03":
        return str(params.get("report_date") or params.get("monitoring_date") or "DEFAULT")
    if task.process_id == "BP-01" and spec.get("process_id") == "BP-02":
        return str(params.get("application_number") or "ALL_CLIENTS")
    return str(params.get("date") or "DEFAULT")


def evaluate_task_dependencies(
    session: Session,
    task: Task,
    max_client_age_hours: int = 24,
) -> dict[str, Any]:
    """
    BE2-08. Проверяет готовность зависимостей для запуска task:
    - BP-01: актуальность данных BP-02 (свежесть данных клиента и отсутствие незавершённого BP-02);
    - BP-04: успешный BP-03 за ту же дату (ожидание при активном BP-03, снятие при ошибке BP-03).
    """
    now = datetime.now(timezone.utc)
    deps = register_task_dependencies(session, task)

    if not deps:
        return {"state": "READY", "reason": "Зависимостей нет", "blocking_task_id": None}
    for dep in deps:
        dep.checked_at = now
        # 1. Зависимость BP-04 -> BP-03 за ту же дату
        if task.process_id == "BP-04" and dep.depends_on_process_id == "BP-03":
            target_date = dep.required_partition_key

            failed_bp03 = session.scalar(
                select(Task)
                .where(
                    Task.process_id == "BP-03",
                    Task.params["monitoring_date"].astext == target_date,
                    Task.status.in_(TERMINAL_FAILURE_STATUSES),
                )
                .order_by(Task.id.desc())
            )
            if failed_bp03:
                dep.is_satisfied = False
                dep.depends_on_task_id = failed_bp03.id
                reason = (
                    f"Зависимый процесс BP-03 за дату {target_date} завершился со статусом "
                    f"{failed_bp03.status} (task_id={failed_bp03.id}); BP-04 снят с выполнения"
                )
                _log_dependency_decision(session, task, "DEPENDENCY_FAILED", "ABORT", reason)
                return {
                    "state": "ABORT",
                    "reason": reason,
                    "blocking_task_id": failed_bp03.id,
                }

            completed_bp03 = session.scalar(
                select(Task)
                .where(
                    Task.process_id == "BP-03",
                    Task.params["monitoring_date"].astext == target_date,
                    Task.status == "COMPLETED",
                )
                .order_by(Task.result_version.desc(), Task.id.desc())
            )
            if not completed_bp03:
                active_bp03 = session.scalar(
                    select(Task)
                    .where(
                        Task.process_id == "BP-03",
                        Task.params["monitoring_date"].astext == target_date,
                        Task.status.in_(("CREATED", "QUEUED", "RUNNING")),
                    )
                    .order_by(Task.id.asc())
                )
                dep.is_satisfied = False
                dep.depends_on_task_id = active_bp03.id if active_bp03 else None
                reason = f"Ожидание успешного завершения BP-03 за дату {target_date}"
                _log_dependency_decision(session, task, "DEPENDENCY_WAIT", "QUEUED", reason)
                return {
                    "state": "WAITING",
                    "reason": reason,
                    "blocking_task_id": active_bp03.id if active_bp03 else None,
                }

            dep.is_satisfied = True
            dep.depends_on_task_id = completed_bp03.id
        # 2. Зависимость BP-01 -> BP-02 (актуальные данные клиента)
        elif task.process_id == "BP-01" and dep.depends_on_process_id == "BP-02":
            running_bp02 = session.scalar(
                select(Task)
                .where(
                    Task.process_id == "BP-02",
                    Task.status.in_(("QUEUED", "RUNNING")),
                )
                .order_by(Task.id.asc())
            )
            if running_bp02:
                dep.is_satisfied = False
                dep.depends_on_task_id = running_bp02.id
                reason = f"Ожидание завершения обновления клиентов BP-02 (task_id={running_bp02.id})"
                _log_dependency_decision(session, task, "DEPENDENCY_WAIT", "QUEUED", reason)
                return {
                    "state": "WAITING",
                    "reason": reason,
                    "blocking_task_id": running_bp02.id,
                }

            app_num = (task.params or {}).get("application_number")
            if app_num:
                app = session.scalar(
                    select(CreditApplication).where(CreditApplication.application_number == app_num)
                )
                if app:
                    client = session.scalar(select(Client).where(Client.id == app.client_id))
                    stale_cutoff = now - timedelta(hours=max_client_age_hours)
                    if client and client.updated_at and client.updated_at < stale_cutoff:
                        dep.is_satisfied = False
                        reason = (
                            f"Данные клиента id={client.id} устарели (обновлены {client.updated_at.isoformat()}); "
                            f"требуется актуальный BP-02"
                        )
                        _log_dependency_decision(session, task, "DEPENDENCY_STALE", "QUEUED", reason)
                        return {
                            "state": "WAITING",
                            "reason": reason,
                            "blocking_task_id": None,
                        }

            dep.is_satisfied = True

    session.flush()
    return {"state": "READY", "reason": "Все зависимости выполнены", "blocking_task_id": None}


def _log_dependency_decision(
    session: Session,
    task: Task,
    event_type: str,
    decision: str,
    reason: str,
) -> None:
    session.add(
        ExecutionLog(
            task_id=task.id,
            process_id=task.process_id,
            actor_id=task.initiated_by,
            event_type=event_type,
            decision=decision,
            reason=reason,
            params_snapshot=task.params or {},
        )
    )
