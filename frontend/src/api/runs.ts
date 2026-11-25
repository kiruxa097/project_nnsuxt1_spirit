import type { DashboardSummary, LaunchRequest, LaunchResponse } from '../types'
// import { api } from './client' // раскомментировать, когда появится настоящий эндпоинт

export async function getDashboardSummary(): Promise<DashboardSummary> {
  // TODO (бэкенд): вставить эндпоинт, который отдаёт счётчики запусков и последние запуски.
  // Когда он будет известен, заменить тестовые данные ниже на:
  //   const { data } = await api.get<DashboardSummary>('/СЮДА_ЭНДПОИНТ')
  //   return data

  // Временные тестовые данные, чтобы страницу можно было смотреть без бэкенда
  return {
    total: 12,
    running: 2,
    queued: 3,
    completed: 6,
    failed: 1,
    recentRuns: [
      { id: 1023, processId: 'BP-04', date: '2026-11-24', status: 'CREATED', priority: 'NORMAL' },
      { id: 1022, processId: 'BP-03', date: '2026-11-24', status: 'QUEUED', priority: 'NORMAL' },
      { id: 1021, processId: 'BP-02', date: '2026-11-24', status: 'RUNNING', priority: 'HIGH' },
      { id: 1020, processId: 'BP-01', date: '2026-11-24', status: 'COMPLETED', priority: 'HIGH' },
      { id: 1019, processId: 'BP-03', date: '2026-11-23', status: 'FAILED', priority: 'NORMAL' },
    ],
  }
}

export async function launchProcess(request: LaunchRequest): Promise<LaunchResponse> {
  // TODO (бэкенд): вставить эндпоинт запуска процесса (метод и адрес уточнить у бэкендеров).
  // Когда он будет известен, заменить тестовую логику ниже на что-то вроде:
  //   const { data } = await api.post<LaunchResponse>('/СЮДА_ЭНДПОИНТ', request)
  //   return data

  // Временная имитация ответов сервера, чтобы посмотреть все три варианта ответа:
  await new Promise((resolve) => setTimeout(resolve, 500))
  if (request.processId === 'BP-01') {
    return {
      status: 'QUEUED',
      runId: 1024,
      reason: 'Ресурс client_database занят задачей #1021 в режиме WRITE',
    }
  }
  if (request.processId === 'BP-03' && request.params.monitoringDate === '2026-11-24') {
    return {
      status: 'REJECTED',
      reason: 'Мониторинг просрочек за 24.11.2026 уже выполняется (запуск #1022)',
    }
  }
  return { status: 'ACCEPTED', runId: 1025 }
}