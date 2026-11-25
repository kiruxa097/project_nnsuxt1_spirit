export type RunStatus =
  | 'CREATED' // запуск зарегистрирован
  | 'QUEUED' // ожидание запуска
  | 'RUNNING' // выполняется
  | 'COMPLETED' // успех
  | 'FAILED' // ошибка
  | 'CANCELLED' // отменён

export type Priority =
  | 'CRITICAL' // критический
  | 'HIGH' // важный
  | 'MEDIUM' // средний
  | 'NORMAL' // обычный
  | 'LOW' // низкий

export type Run = {
  id: number
  processId: string 
  date: string 
  status: RunStatus
  priority: Priority
}

export type DashboardSummary = {
  total: number // всего запусков
  running: number // выполняются
  queued: number // ожидают
  completed: number // завершены
  failed: number // с ошибкой
  recentRuns: Run[] // последние запуски
}