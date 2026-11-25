import type { Priority, RunStatus } from './types'

export const statusLabels: Record<RunStatus, string> = {
  CREATED: 'Создан',
  QUEUED: 'В очереди',
  RUNNING: 'Выполняется',
  COMPLETED: 'Завершён',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменён',
}

export const priorityLabels: Record<Priority, string> = {
  CRITICAL: 'Критический',
  HIGH: 'Важный',
  MEDIUM: 'Средний',
  NORMAL: 'Обычный',
  LOW: 'Низкий',
}

export function formatDate(iso: string): string {
  const value = iso.slice(0, 10)
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}.${month}.${year}` : iso
}

export const priorityOrder: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL', 'LOW']