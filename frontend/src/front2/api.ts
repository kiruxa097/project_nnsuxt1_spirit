import axios from 'axios'
import { api, getErrorMessage } from '../api/client'
import type { HistoryFilters, Lock, LogEntry, Priority, Run, RunId } from './types'


export const ENDPOINTS = {
  // GET: запуски со статусами CREATED / QUEUED / RUNNING.
  queue: '',

  // GET: завершённые запуски (COMPLETED / FAILED / CANCELLED).
  history: '',

  // GET: один запуск по id (путь с {id}).
  run: '',

  // GET: журнал выполнения запуска (путь с {id}), массив {time, level, message}.
  runLog: '',

  // POST: отменить запуск (путь с {id}).
  cancelRun: '',

  // PATCH/POST: изменить приоритет (путь с {id}), тело {priority}.
  changePriority: '',

  // GET: текущие блокировки ресурсов (массив Lock, с ожидающими запусками).
  locks: '',
}

export const isReady = (path: string) => path !== ''

const fill = (path: string, id: RunId) => path.replace('{id}', encodeURIComponent(String(id)))

const NOT_READY = 'Эндпоинт ещё не подключён — нужно запросить у бэка'

export function errorText(e: unknown): string {
  if (axios.isAxiosError(e)) return getErrorMessage(e)
  if (e instanceof Error) return e.message
  return 'Неизвестная ошибка'
}

async function getOrEmpty<T>(path: string, empty: T, params?: Record<string, string>): Promise<T> {
  if (!isReady(path)) return empty
  const { data } = await api.get<T>(path, { params })
  return data
}

export const getQueue = () => getOrEmpty<Run[]>(ENDPOINTS.queue, [])

export const getLocks = () => getOrEmpty<Lock[]>(ENDPOINTS.locks, [])

export function getHistory(filters: HistoryFilters) {
  const params: Record<string, string> = {}
  //уточнить у бэка названия параметров фильтра
  if (filters.dateFrom) params.date_from = filters.dateFrom
  if (filters.dateTo) params.date_to = filters.dateTo
  if (filters.processId) params.process_id = filters.processId
  return getOrEmpty<Run[]>(ENDPOINTS.history, [], params)
}

export async function getRun(id: RunId): Promise<Run | null> {
  if (!isReady(ENDPOINTS.run)) return null
  const { data } = await api.get<Run>(fill(ENDPOINTS.run, id))
  return data
}

export async function getRunLog(id: RunId): Promise<LogEntry[]> {
  if (!isReady(ENDPOINTS.runLog)) return []
  const { data } = await api.get<LogEntry[]>(fill(ENDPOINTS.runLog, id))
  return data
}

export async function cancelRun(id: RunId): Promise<void> {
  if (!isReady(ENDPOINTS.cancelRun)) throw new Error(NOT_READY)
  await api.post(fill(ENDPOINTS.cancelRun, id))
}

export async function changePriority(id: RunId, priority: Priority): Promise<void> {
  if (!isReady(ENDPOINTS.changePriority)) throw new Error(NOT_READY)
  //PATCH
  await api.patch(fill(ENDPOINTS.changePriority, id), { priority })
}
