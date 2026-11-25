from fastapi import FastAPI

from app.api.endpoints import router
from app.db.database import init_db

app = FastAPI(
    title="Bank API — Orchestrator",
    description="Управление запусками банковских бизнес-процессов",
    version="1.0.0",
)


@app.on_event("startup")
def on_startup():
    # Для MVP. В дальнейшем заменим миграциями Alembic.
    init_db()


@app.get("/health", tags=["service"])
def health():
    return {"status": "ok"}


app.include_router(router)