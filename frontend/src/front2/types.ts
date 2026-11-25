// Типы и справочники для части «Оркестратор» (Фронт 2).
// TODO: сверить названия полей с бэкендом (Настя) — сейчас это наши предположения.

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

// От самого важного к наименее важному
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

// TODO: если у бэка другие id процессов — поправить (или брать список из запроса процессов Фронта 1)
export const PROCESS_OPTIONS = [
  { id: 'BP-01', name: 'Проверка заявки на кредит' },
  { id: 'BP-02', name: 'Обновление информации о клиентах' },
  { id: 'BP-03', name: 'Мониторинг просроченных платежей' },
  { id: 'BP-04', name: 'Отчёт по кредитному портфелю' },
]

export type RunId = string | number

export type Run = {
  id: RunId
  processId: string // 'BP-01'...
  processName: string
  params: Record<string, unknown> // параметры запуска (дата, № заявки...)
  initiator: string
  priority: Priority
  status: RunStatus
  createdAt: string // ISO-дата
  startedAt: string | null
  finishedAt: string | null
  reason: string | null // причина ожидания / ошибки / отказа
  blockedByRunId: RunId | null // какой запуск блокирует этот
  blockedResource: string | null // за какой ресурс идёт конфликт
  result: string | null // краткий результат выполнения
  // Если бэк сам говорит, какие действия допустимы — используем это, иначе считаем по статусу
  canCancel?: boolean
  canChangePriority?: boolean
}

export type LockWaiter = { runId: RunId; processId: string; mode: AccessMode }

export type Lock = {
  id: RunId
  resource: string // например 'credit_registry'
  partition: string | null // дата / период / № заявки
  holderRunId: RunId
  holderProcessId: string
  mode: AccessMode
  acquiredAt: string // когда блокировка появилась
  waiters: LockWaiter[]
}

export type LogEntry = {
  time: string
  level?: string
  message: string
}

export type HistoryFilters = {
  dateFrom: string // 'YYYY-MM-DD' или ''
  dateTo: string
  processId: string // '' = все
}
