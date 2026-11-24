from fastapi import FastAPI, HTTPException, Depends

app = FastAPI(
    title="API for orchestrator",
    description="",
    version="1.0.0"
)

@app.post("/executions") # создание запуска
def create_execution():
    return 0

@app.get("/executions") # получение списка запусков
def get_executions():
    return 0

@app.get("/executions/{id}") # получение информации о запуске
def get_execution(id: int):
    return 0

@app.post("/executions/{id}/cancel") # отмена запуска
def cancel_execution():
    return 0

@app.get("/processes") # получение списка процессов
def get_processes():
    return 0

@app.get("/queue") # получение списка процессов в очереди
def get_queue():
    return 0

@app.get("/locks") # получение списка блокировок
def get_locks():
    return 0

@app.get("/reports/{id}") # получение списка отчетов
def get_reports(id: int):
    return 0

@app.get("/health") # получить статус сервиса
def get_health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Hello, World!"}