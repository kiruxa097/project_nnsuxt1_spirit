ALLOWED_STATUSES = (
    "CREATED",
    "QUEUED",
    "RUNNING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
)

ACTIVE_DB_STATUSES = ("CREATED", "QUEUED", "RUNNING")
TERMINAL_DB_STATUSES = ("COMPLETED", "FAILED", "CANCELLED")
QUEUE_DB_STATUSES = ("QUEUED",)


def to_api_status(status: str) -> str:
    if status not in ALLOWED_STATUSES:
        raise ValueError(f"Недопустимый статус задачи: {status}")
    return status

