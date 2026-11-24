import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})


export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail ?? error.response?.data?.message
    if (typeof detail === 'string') return detail
    if (error.response) return `Ошибка сервера (${error.response.status})`
    return 'Нет связи с сервером'
  }
  return 'Неизвестная ошибка'
}