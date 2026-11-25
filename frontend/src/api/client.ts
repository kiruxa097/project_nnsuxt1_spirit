import axios from 'axios'

export const api = axios.create({
  // Vite проксирует /api на FastAPI и удаляет префикс /api.
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail ?? error.response?.data?.message
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object') return JSON.stringify(detail)
    if (error.response) return `Ошибка сервера (${error.response.status})`
    return 'Нет связи с сервером. Проверь, запущен ли Backend 1.'
  }
  return error instanceof Error ? error.message : 'Неизвестная ошибка'
}
