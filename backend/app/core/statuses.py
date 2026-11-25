DB_TO_API = {
    "CREATED": "queued",
    "QUEUED": "queued",
    "RUNNING": "running",
    "COMPLETED": "success",
    "FAILED": "failed",
    "CANCELLED": "cancelled",
}

ACTIVE_DB_STATUSES = ("CREATED", "QUEUED", "RUNNING")
TERMINAL_DB_STATUSES = ("COMPLETED", "FAILED", "CANCELLED")


def to_api_status(status: str) -> str:
    return DB_TO_API.get(status, "failed")
