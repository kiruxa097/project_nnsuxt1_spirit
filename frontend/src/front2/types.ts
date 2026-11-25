
export type RunStatus = 'CREATED' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL' | 'LOW'
export type AccessMode = 'READ' | 'WRITE'

export const STATUS_LABELS: Record<RunStatus, string> = {
  CREATED: 'Создан',
  QUEUED: 'В очереди',
  RUNNING: 'Выполняется',
  COMPLETED: 'Завершён',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменён',
}

export const PRIORITY_ORDER: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL', 'LOW']

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: 'Критически важный',
  HIGH: 'Важный',
  MEDIUM: 'Средний',
  NORMAL: 'Обычный',
  LOW: 'Низкий',
}

export const ACTIVE_STATUSES: RunStatus[] = ['CREATED', 'QUEUED', 'RUNNING']
export const FINISHED_STATUSES: RunStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']


export const PROCESS_OPTIONS = [
  { id: 'BP-01', name: 'Проверка заявки на кредит' },
  { id: 'BP-02', name: 'Обновление информации о клиентах' },
  { id: 'BP-03', name: 'Мониторинг просроченных платежей' },
  { id: 'BP-04', name: 'Отчёт по кредитному портфелю' },
]

export type RunId = string | number

export type Run = {
  id: RunId
  processId: string 
  processName: string
  params: Record<string, unknown> // параметры запуска
  initiator: string
  priority: Priority
  status: RunStatus
  createdAt: string 
  startedAt: string | null
  finishedAt: string | null
  reason: string | null 
  blockedByRunId: RunId | null 
  blockedResource: string | null 
  result: string | null 
  canCancel?: boolean
  canChangePriority?: boolean
}

export type LockWaiter = { runId: RunId; processId: string; mode: AccessMode }

export type Lock = {
  id: RunId
  resource: string 
  partition: string | null 
  holderRunId: RunId
  holderProcessId: string
  mode: AccessMode
  acquiredAt: string 
  waiters: LockWaiter[]
}

export type LogEntry = {
  time: string
  level?: string
  message: string
}

export type HistoryFilters = {
  dateFrom: string 
  dateTo: string
  processId: string 
}
