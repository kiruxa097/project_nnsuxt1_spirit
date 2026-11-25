import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.statuses import ACTIVE_DB_STATUSES, TERMINAL_DB_STATUSES
from app.db.models import (
    ExecutionLog, Lock, Process, Resource, Task, TaskDependency, TaskResource,
)
from app.services.dependencies import evaluate_task_dependencies


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _json_default(value: Any):
    return value.isoformat() if isinstance(value, (date, datetime)) else str(value)


def _idempotency_key(process_id: str, params: dict[str, Any]) -> str:
    raw = json.dumps(
        {"process_id": process_id, "params": params},
        sort_keys=True, ensure_ascii=False, default=_json_default,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _log(db: Session, task: Task, event: str, decision: str, reason: str):
    db.add(ExecutionLog(
        task_id=task.id,
        process_id=task.process_id,
        actor_id=task.initiated_by,
        event_type=event,
        decision=decision,
        reason=reason,
        params_snapshot=task.params or {},
    ))


def _validate_params(process: Process, params: dict[str, Any]):
    schema = process.launch_params_schema or {}
    required = schema.get("required", [])
    missing = [name for name in required if params.get(name) in (None, "")]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={"message": "Не переданы обязательные параметры процесса",
                    "missing": missing},
        )


def _normalise_resource_requests(
    db: Session, task: Task, process: Process
) -> list[tuple[Resource, str, list[str]]]:
    """
    Возвращает ресурс, режим и партиции.
    READ + WRITE одного процесса по одному ресурсу сводится к WRITE.
    CLIENT_LIST учитывает client_ids; ALL пересекается с любой клиентской партицией.
    """
    modes: dict[str, str] = {}
    for code in process.read_resources or []:
        modes[code] = "READ"
    for code in process.write_resources or []:
        modes[code] = "WRITE"

    params = task.params or {}
    result = []
    for code, mode in modes.items():
        resource = db.scalar(select(Resource).where(Resource.code == code))
        if resource is None:
            raise HTTPException(status_code=500, detail=f"Не найден ресурс {code}")

        ptype = resource.partition_type
        if ptype == "DATE":
            value = (
                params.get("report_date") or params.get("monitoring_date")
                or params.get("sync_date") or params.get("as_of_date")
                or params.get("update_date")
            )
            partitions = [str(value)] if value else ["ALL"]
        elif ptype == "PERIOD":
            value = params.get("report_date") or params.get("monitoring_date")
            if value:
                value = str(value)
                partitions = [value[:7]]
            else:
                partitions = ["ALL"]
        elif ptype == "APPLICATION_ID":
            partitions = [str(params.get("application_number") or "ALL")]
        elif ptype == "CLIENT_LIST":
            client_ids = params.get("client_ids")
            if client_ids:
                partitions = sorted({f"CLIENT:{int(cid)}" for cid in client_ids})
            elif task.process_id == "BP-01":
                application_number = params.get("application_number")
                from app.db.models import CreditApplication
                application = db.scalar(select(CreditApplication).where(
                    CreditApplication.application_number == application_number
                ))
                if application is None:
                    raise HTTPException(status_code=422, detail="Заявка не найдена")
                partitions = [f"CLIENT:{application.client_id}"]
            else:
                partitions = ["ALL"]
        else:
            partitions = ["DEFAULT"]

        result.append((resource, mode, partitions))
    return result


def _overlap(left: str, right: str) -> bool:
    return left == right or left == "ALL" or right == "ALL"


def _can_acquire(
    db: Session,
    task: Task,
    requests: list[tuple[Resource, str, list[str]]],
) -> tuple[bool, str | None, int | None]:
    process = db.get(Process, task.process_id)
    # COUNT через отдельный запрос, совместимый с SQLAlchemy 2.x.
    from sqlalchemy import func
    running_count = db.scalar(select(func.count(Task.id)).where(
        Task.process_id == task.process_id,
        Task.status == "RUNNING",
        Task.id != task.id,
    )) or 0
    if process and running_count >= process.max_parallelism:
        return False, f"Достигнут max_parallelism={process.max_parallelism}", None

    # Единый порядок блокировки строк ресурсов предотвращает дедлоки.
    for resource, _, _ in sorted(requests, key=lambda item: item[0].id):
        db.scalar(select(Resource).where(Resource.id == resource.id).with_for_update())

    active_locks = db.scalars(select(Lock).where(
        Lock.lease_expires_at > now_utc(),
        Lock.owner_task_id != task.id,
    )).all()

    for resource, requested_mode, partitions in requests:
        for lock in active_locks:
            if lock.resource_id != resource.id:
                continue
            if not any(_overlap(p, lock.partition_key) for p in partitions):
                continue
            # READ/READ разрешено, все остальные сочетания конфликтуют.
            if requested_mode == "WRITE" or lock.lock_mode == "WRITE":
                return (
                    False,
                    f"Ресурс {resource.code} занят запуском #{lock.owner_task_id}",
                    lock.owner_task_id,
                )
    return True, None, None


def _acquire_locks(
    db: Session,
    task: Task,
    requests: list[tuple[Resource, str, list[str]]],
    timeout_sec: int,
):
    lease = now_utc() + timedelta(seconds=timeout_sec + 60)
    for resource, mode, partitions in requests:
        for partition in partitions:
            db.add(Lock(
                resource_id=resource.id,
                partition_key=partition,
                lock_mode=mode,
                owner_task_id=task.id,
                lease_expires_at=lease,
                last_heartbeat_at=now_utc(),
            ))
            db.add(TaskResource(
                task_id=task.id,
                resource_id=resource.id,
                access_mode=mode,
                partition_key=partition,
            ))


def _admit_or_queue(db: Session, task: Task, process: Process) -> Task:
    dependency_result = evaluate_task_dependencies(db, task)
    if dependency_result["state"] == "ABORT":
        task.status = "FAILED"
        task.finished_at = now_utc()
        task.decision_reason = dependency_result["reason"]
        task.blocked_by_task_id = dependency_result["blocking_task_id"]
        _log(db, task, "DEPENDENCY_FAILED", "DENY", task.decision_reason)
        db.commit()
        db.refresh(task)
        return task

    if dependency_result["state"] == "WAITING":
        task.status = "QUEUED"
        task.decision_reason = dependency_result["reason"]
        task.blocked_by_task_id = dependency_result["blocking_task_id"]
        task.queued_at = task.queued_at or now_utc()
        _log(db, task, "DEPENDENCY_WAIT", "QUEUE", task.decision_reason)
        db.commit()
        db.refresh(task)
        return task

    requests = _normalise_resource_requests(db, task, process)
    allowed, reason, blocker_id = _can_acquire(db, task, requests)
    if not allowed:
        task.status = "QUEUED"
        task.decision_reason = reason
        task.blocked_by_task_id = blocker_id
        task.queued_at = task.queued_at or now_utc()
        _log(db, task, "RESOURCE_WAIT", "QUEUE", reason or "Ресурс занят")
        db.commit()
        db.refresh(task)
        return task

    _acquire_locks(db, task, requests, process.timeout_sec)
    task.status = "RUNNING"
    task.started_at = now_utc()
    task.queued_at = task.queued_at or task.created_at
    task.blocked_by_task_id = None
    task.decision_reason = "Допущен к выполнению; ресурсы захвачены"
    _log(db, task, "EXECUTION_ADMITTED", "ALLOW", task.decision_reason)
    db.commit()
    db.refresh(task)
    return task


def create_execution(db: Session, process_id: str, params: dict[str, Any]) -> Task:
    # Блокировка строки процесса сериализует одновременные проверки дублей
    # и лимита параллелизма для данного BP.
    process = db.scalar(
        select(Process).where(Process.id == process_id).with_for_update()
    )
    if process is None:
        raise HTTPException(status_code=404, detail="Процесс не найден")

    _validate_params(process, params)
    key = _idempotency_key(process_id, params)
    existing = db.scalar(select(Task).where(
        Task.process_id == process_id,
        Task.idempotency_key == key,
        Task.status.in_(ACTIVE_DB_STATUSES),
    ).order_by(Task.id.desc()).limit(1))

    if existing and process.duplicate_policy == "REJECT":
        raise HTTPException(status_code=409, detail={
            "message": "Идентичный запуск уже выполняется",
            "execution_id": existing.id,
        })

    if existing and process.duplicate_policy == "QUEUE":
        # Для политики QUEUE не теряем повторный запрос: регистрируем отдельную
        # задачу, но она будет ждать завершения/освобождения ресурсов.
        pass

    from sqlalchemy import func
    last_version = db.scalar(select(func.max(Task.result_version)).where(
        Task.process_id == process_id,
        Task.idempotency_key == key,
    )) or 0

    task = Task(
        process_id=process_id,
        idempotency_key=key,
        params=params,
        status="CREATED",
        priority=process.default_priority,
        result_version=last_version + 1,
    )
    db.add(task)
    db.flush()
    return _admit_or_queue(db, task, process)


def promote_waiting_tasks(db: Session, limit: int = 100) -> int:
    """Повторно проверяет задачи QUEUED после освобождения ресурсов."""
    tasks = db.scalars(select(Task).where(
        Task.status == "QUEUED"
    ).order_by(Task.priority.asc(), Task.queued_at.asc().nullsfirst(), Task.id.asc())
     .limit(limit).with_for_update(skip_locked=True)).all()

    promoted = 0
    for task in tasks:
        process = db.get(Process, task.process_id)
        if process is None:
            continue
        old_status = task.status
        _admit_or_queue(db, task, process)
        if task.status == "RUNNING" and old_status != "RUNNING":
            promoted += 1
    return promoted


def finish_execution(
    db: Session,
    execution_id: int,
    success: bool,
    reason: str | None = None,
) -> Task:
    """Внутренний callback для BE2 после окончания обработчика BP."""
    task = db.scalar(select(Task).where(Task.id == execution_id).with_for_update())
    if task is None:
        raise HTTPException(status_code=404, detail="Запуск не найден")
    if task.status != "RUNNING":
        raise HTTPException(status_code=409, detail=f"Статус запуска: {task.status}")

    task.status = "COMPLETED" if success else "FAILED"
    task.finished_at = now_utc()
    task.decision_reason = reason or (
        "Бизнес-процесс завершён успешно" if success else "Ошибка бизнес-процесса"
    )
    db.query(Lock).filter(Lock.owner_task_id == task.id).delete(synchronize_session=False)
    _log(db, task, "EXECUTION_FINISHED", "ALLOW" if success else "DENY",
         task.decision_reason)
    db.commit()
    db.refresh(task)

    # После освобождения ресурсов пробуем продвинуть очередь.
    promote_waiting_tasks(db)
    db.commit()
    return task


def cancel_execution(db: Session, execution_id: int) -> Task:
    task = db.scalar(select(Task).where(Task.id == execution_id).with_for_update())
    if task is None:
        raise HTTPException(status_code=404, detail="Запуск не найден")
    if task.status in TERMINAL_DB_STATUSES:
        raise HTTPException(status_code=409, detail="Запуск уже завершён, отменить нельзя")

    task.status = "CANCELLED"
    task.finished_at = now_utc()
    task.decision_reason = "Запуск отменён"
    db.query(Lock).filter(Lock.owner_task_id == task.id).delete(synchronize_session=False)
    _log(db, task, "EXECUTION_CANCELLED", "ALLOW", task.decision_reason)
    db.commit()
    db.refresh(task)
    return task


def list_tasks(db: Session) -> list[Task]:
    return db.scalars(select(Task).order_by(Task.created_at.desc())).all()


def list_processes(db: Session) -> list[dict]:
    policy = {"REJECT": "reject", "QUEUE": "skip_if_running", "ALLOW_VERSIONED": "allow"}
    processes = db.scalars(select(Process).order_by(Process.id)).all()
    return [{
        "id": p.id,
        "code": p.id,
        "name": p.name,
        "description": p.description,
        "duplicate_policy": policy.get(p.duplicate_policy, "reject"),
    } for p in processes]


def get_queue(db: Session) -> list[dict]:
    tasks = db.scalars(select(Task).where(
        Task.status == "QUEUED"
    ).order_by(Task.priority.asc(), Task.queued_at.asc().nullsfirst(), Task.id.asc())).all()
    return [{
        "execution_id": task.id,
        "process_code": task.process_id,
        "status": "QUEUED",
        "position": index,
    } for index, task in enumerate(tasks, start=1)]


def list_locks(db: Session) -> list[dict]:
    rows = db.execute(
        select(Lock, Resource)
        .join(Resource, Resource.id == Lock.resource_id)
        .where(Lock.lease_expires_at > now_utc())
        .order_by(Resource.code, Lock.partition_key)
    ).all()
    return [{
        "resource_code": resource.code,
        "execution_id": lock.owner_task_id,
        "lock_type": "shared" if lock.lock_mode == "READ" else "exclusive",
    } for lock, resource in rows]


def heartbeat(db: Session, execution_id: int, lease_seconds: int = 300) -> Task:
    """Продлевает аренду блокировок активного запуска; endpoint можно добавить позже."""
    task = db.get(Task, execution_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Запуск не найден")
    if task.status != "RUNNING":
        raise HTTPException(status_code=409, detail="Heartbeat допустим только для RUNNING")
    db.query(Lock).filter(Lock.owner_task_id == task.id).update({
        Lock.last_heartbeat_at: now_utc(),
        Lock.lease_expires_at: now_utc() + timedelta(seconds=lease_seconds),
    }, synchronize_session=False)
    db.commit()
    db.refresh(task)
    return task


def cleanup_expired_locks(db: Session) -> int:
    """Очистка истёкших lease. Нужен периодический вызов worker/scheduler."""
    count = db.query(Lock).filter(Lock.lease_expires_at <= now_utc()).delete(
        synchronize_session=False
    )
    db.commit()
    return count
