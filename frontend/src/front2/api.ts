import axios from 'axios'
import { api, getErrorMessage } from '../api/client'
import type { HistoryFilters, Lock, LogEntry, Priority, Run, RunId, RunStatus } from './types'

type BackendExecution = {
  id: number
  process_id: string
  process_code: string
  status: RunStatus
  report_date: string | null
  params: Record<string, unknown>
  priority: number
  decision_reason: string | null
  blocked_by_task_id: number | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

type BackendQueueItem = { execution_id: number; process_code: string; status: 'QUEUED'; position: number }
type BackendLock = {
  resource_code: string
  execution_id: number
  lock_type: 'shared' | 'exclusive'
  partition_key: string
  holder_process_id: string
  acquired_at: string
  waiters: { run_id: number; process_id: string; mode: 'READ' | 'WRITE' }[]
}

export const ENDPOINTS = {
  queue: '/queue',
  history: '/executions',
  run: '/executions/{id}',
  runLog: '/executions/{id}/logs',
  cancelRun: '/executions/{id}/cancel',
  changePriority: '/executions/{id}/priority',
  locks: '/locks',
}

export const isReady = (path: string) => path.length > 0
const fill = (path: string, id: RunId) => path.replace('{id}', encodeURIComponent(String(id)))

export function errorText(e: unknown): string {
  if (axios.isAxiosError(e)) return getErrorMessage(e)
  if (e instanceof Error) return e.message
  return 'Неизвестная ошибка'
}

const priorityFromNumber = (value: number): Priority =>
  (['CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL', 'LOW'] as Priority[])[Math.max(0, Math.min(4, value - 1))]

const priorityToNumber = (value: Priority): number =>
  ({ CRITICAL: 1, HIGH: 2, MEDIUM: 3, NORMAL: 4, LOW: 5 })[value]

const processNames: Record<string, string> = {
  'BP-01': 'Проверка заявки на кредит',
  'BP-02': 'Обновление информации о клиентах',
  'BP-03': 'Мониторинг просроченных платежей',
  'BP-04': 'Формирование отчёта о кредитном портфеле',
  PAYMENTS_SYNC: 'Синхронизация платежей',
}

function mapRun(item: BackendExecution): Run {
  return {
    id: item.id,
    processId: item.process_id,
    processName: processNames[item.process_id] ?? item.process_id,
    params: item.params ?? {},
    initiator: '—',
    priority: priorityFromNumber(item.priority),
    status: item.status,
    createdAt: item.created_at,
    startedAt: item.started_at,
    finishedAt: item.finished_at,
    reason: item.decision_reason,
    blockedByRunId: item.blocked_by_task_id,
    blockedResource: null,
    result: null,
    canCancel: ['CREATED', 'QUEUED', 'RUNNING'].includes(item.status),
    canChangePriority: ['CREATED', 'QUEUED'].includes(item.status),
  }
}

async function getExecutions(): Promise<BackendExecution[]> {
  const { data } = await api.get<BackendExecution[]>('/executions')
  return data
}

export async function getQueue(): Promise<Run[]> {
  const [{ data: queue }, executions] = await Promise.all([
    api.get<BackendQueueItem[]>(ENDPOINTS.queue),
    getExecutions(),
  ])
  const queuePositions = new Map(queue.map((item) => [item.execution_id, item.position]))
  return executions
    .filter((item) => ['CREATED', 'QUEUED', 'RUNNING'].includes(item.status))
    .map(mapRun)
    .sort((a, b) => {
      if ((a.status === 'RUNNING') !== (b.status === 'RUNNING')) return a.status === 'RUNNING' ? -1 : 1
      return (queuePositions.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (queuePositions.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    })
}

export async function getLocks(): Promise<Lock[]> {
  const [{ data: locks }, executions] = await Promise.all([
    api.get<BackendLock[]>(ENDPOINTS.locks),
    getExecutions(),
  ])
  const byId = new Map(executions.map((item) => [item.id, item]))
  return locks.map((lock) => ({
    id: `${lock.resource_code}:${lock.partition_key}:${lock.execution_id}`,
    resource: lock.resource_code,
    partition: lock.partition_key === 'DEFAULT' ? null : lock.partition_key,
    holderRunId: lock.execution_id,
    holderProcessId: lock.holder_process_id || byId.get(lock.execution_id)?.process_id || '—',
    mode: lock.lock_type === 'shared' ? 'READ' : 'WRITE',
    acquiredAt: lock.acquired_at,
    waiters: (lock.waiters ?? []).map((waiter) => ({ runId: waiter.run_id, processId: waiter.process_id, mode: waiter.mode })),
  }))
}

export async function getHistory(filters: HistoryFilters): Promise<Run[]> {
  return (await getExecutions()).map(mapRun).filter((run) => {
    const created = run.createdAt.slice(0, 10)
    if (filters.processId && filters.processId !== 'ALL' && run.processId !== filters.processId) return false
    if (filters.dateFrom && created < filters.dateFrom) return false
    if (filters.dateTo && created > filters.dateTo) return false
    return true
  })
}

export async function getRun(id: RunId): Promise<Run | null> {
  try {
    const { data } = await api.get<BackendExecution>(fill(ENDPOINTS.run, id))
    return mapRun(data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null
    throw error
  }
}

export async function getRunLog(id: RunId): Promise<LogEntry[]> {
  const { data } = await api.get<LogEntry[]>(fill(ENDPOINTS.runLog, id))
  return data
}

export async function cancelRun(id: RunId): Promise<void> {
  await api.post(fill(ENDPOINTS.cancelRun, id))
}

export async function changePriority(id: RunId, priority: Priority): Promise<void> {
  await api.patch(fill(ENDPOINTS.changePriority, id), { priority: priorityToNumber(priority) })
}
