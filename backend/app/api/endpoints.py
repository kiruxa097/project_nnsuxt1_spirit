from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.statuses import to_api_status
from app.db.database import get_db
from app.db.models import Lock, Process, Resource, Task
from app.schemas.execution import (
    CancelResponse, ExecutionCreate, ExecutionResponse, LockResponse,
    ProcessResponse, QueueResponse,
)
from app.services.orchestrator import (
    cancel_execution, create_execution, get_queue, list_locks,
    list_processes, list_tasks, promote_waiting_tasks,
)

router = APIRouter()


def serialize_execution(task: Task) -> dict:
    params = task.params or {}
    raw_date = (
        params.get("report_date")
        or params.get("monitoring_date")
        or params.get("update_date")
        or params.get("sync_date")
        or params.get("as_of_date")
    )
    return {
        "id": task.id,
        "process_id": task.process_id,
        "process_code": task.process_id,
        "status": to_api_status(task.status),
        "report_date": date.fromisoformat(raw_date) if raw_date else None,
        "created_at": task.created_at,
        "started_at": task.started_at,
        "finished_at": task.finished_at,
    }


@router.post(
    "/executions",
    response_model=ExecutionResponse,
    status_code=201,
    summary="Создать запуск процесса",
)
def create_execution_endpoint(
    payload: ExecutionCreate,
    db: Session = Depends(get_db),
):
    params = dict(payload.params or {})

    # Внешний API принимает report_date как единое поле для датовых BP.
    # Внутри БД используются конкретные имена из launch_params_schema.
    if payload.report_date:
        if payload.process_id == "BP-03":
            params.setdefault("monitoring_date", payload.report_date.isoformat())
        elif payload.process_id == "BP-02":
            params.setdefault("update_date", payload.report_date.isoformat())
        elif payload.process_id == "PAYMENTS_SYNC":
            params.setdefault("sync_date", payload.report_date.isoformat())
        else:
            params.setdefault("report_date", payload.report_date.isoformat())

    task = create_execution(db, payload.process_id, params)
    # При освобождении ресурсов/завершении задач очередь также продвигается.
    return serialize_execution(task)


@router.get(
    "/executions",
    response_model=list[ExecutionResponse],
    summary="Список запусков",
)
def get_executions_endpoint(db: Session = Depends(get_db)):
    return [serialize_execution(task) for task in list_tasks(db)]


@router.get(
    "/executions/{execution_id}",
    response_model=ExecutionResponse,
    summary="Информация о запуске",
)
def get_execution_endpoint(
    execution_id: int,
    db: Session = Depends(get_db),
):
    task = db.get(Task, execution_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Запуск не найден")
    return serialize_execution(task)


@router.post(
    "/executions/{execution_id}/cancel",
    response_model=CancelResponse,
    summary="Отменить запуск",
)
def cancel_execution_endpoint(
    execution_id: int,
    db: Session = Depends(get_db),
):
    task = cancel_execution(db, execution_id)
    promote_waiting_tasks(db)
    return {"id": task.id, "status": "cancelled"}


@router.get(
    "/processes",
    response_model=list[ProcessResponse],
    summary="Список процессов",
)
def get_processes_endpoint(db: Session = Depends(get_db)):
    return list_processes(db)


@router.get(
    "/queue",
    response_model=list[QueueResponse],
    summary="Процессы в очереди",
)
def get_queue_endpoint(db: Session = Depends(get_db)):
    return get_queue(db)


@router.get(
    "/locks",
    response_model=list[LockResponse],
    summary="Список активных блокировок",
)
def get_locks_endpoint(db: Session = Depends(get_db)):
    return list_locks(db)