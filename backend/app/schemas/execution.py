from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ExecutionCreate(BaseModel):
    # В новой БД processes.id — строка BP-01 / BP-02 / ...
    process_id: str = Field(min_length=1, max_length=32)
    report_date: date | None = None
    # Параметры конкретного BP, например application_number или client_ids.
    params: dict[str, Any] = Field(default_factory=dict)
    priority: int | None = Field(default=None, ge=1, le=5)


class ExecutionResponse(BaseModel):
    id: int
    process_id: str
    process_code: str
    status: Literal["CREATED", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]
    report_date: date | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    priority: int = 3
    decision_reason: str | None = None
    blocked_by_task_id: int | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CancelResponse(BaseModel):
    id: int
    status: Literal["CANCELLED"]


class ProcessResponse(BaseModel):
    id: str
    code: str
    name: str
    description: str
    duplicate_policy: str


class QueueResponse(BaseModel):
    execution_id: int
    process_code: str
    status: Literal["QUEUED"]
    position: int


class LockWaiterResponse(BaseModel):
    run_id: int
    process_id: str
    mode: Literal["READ", "WRITE"]


class LockResponse(BaseModel):
    resource_code: str
    execution_id: int
    lock_type: str
    partition_key: str
    holder_process_id: str
    acquired_at: datetime
    waiters: list[LockWaiterResponse] = Field(default_factory=list)


class LogResponse(BaseModel):
    time: datetime
    level: str
    message: str


class PriorityUpdate(BaseModel):
    priority: int = Field(ge=1, le=5)
