import { api } from './client'
import type { ProcessInfo, ProcessParam } from '../types'

type BackendProcess = {
  id: string
  code: string
  name: string
  description: string
  duplicate_policy: string
}

const PROCESS_FORMS: Record<string, { purpose: string; params: ProcessParam[] }> = {
  'BP-01': {
    purpose: 'Решение по конкретной кредитной заявке.',
    params: [{ name: 'application_number', label: 'Номер заявки', type: 'text' }],
  },
  'BP-02': {
    purpose: 'Актуализация информации о клиентах банка.',
    params: [
      { name: 'update_date', label: 'Дата обновления', type: 'date' },
      { name: 'client_ids', label: 'ID клиентов (необязательно)', type: 'list', required: false },
    ],
  },
  'BP-03': {
    purpose: 'Выявление просроченных платежей за выбранную дату.',
    params: [{ name: 'monitoring_date', label: 'Дата мониторинга', type: 'date' }],
  },
  'BP-04': {
    purpose: 'Сводная оценка состояния кредитного портфеля.',
    params: [{ name: 'report_date', label: 'Отчётная дата', type: 'date' }],
  },
  PAYMENTS_SYNC: {
    purpose: 'Служебная синхронизация фактических платежей, необходимая перед BP-03.',
    params: [{ name: 'sync_date', label: 'Дата синхронизации', type: 'date' }],
  },
}

export async function getProcesses(): Promise<ProcessInfo[]> {
  const { data } = await api.get<BackendProcess[]>('/processes')
  return data.map((process) => {
    const form = PROCESS_FORMS[process.id]
    return {
      id: process.id,
      name: process.name,
      description: process.description,
      purpose: form?.purpose ?? process.description,
      params: form?.params ?? [],
      available: true,
    }
  })
}

export async function getProcess(id: string): Promise<ProcessInfo | null> {
  const processes = await getProcesses()
  return processes.find((process) => process.id === id) ?? null
}
