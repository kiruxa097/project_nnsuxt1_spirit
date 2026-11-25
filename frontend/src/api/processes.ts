import type { ProcessInfo } from '../types'
// import { api } from './client' // раскомментировать, когда бэкенд будет готов

export async function getProcesses(): Promise<ProcessInfo[]> {
  // TODO (бэкенд): эндпоинт известен — GET /api/v1/processes (список процессов).
  // Когда бэкенд будет готов заменить тестовые данные ниже на:
  //   const { data } = await api.get<ProcessInfo[]>('/processes')
  //   return data
  // Названия полей в ответе сверить с types.ts (ProcessInfo).

  // Временные тестовые данные
  return [
    {
      id: 'BP-01',
      name: 'Проверка заявки на кредит',
      description:
        'Клиент подаёт заявку на кредит, банк должен решить, можно ли выдать деньги. Процесс проверяет данные клиента, кредитную историю и текущие задолженности.',
      purpose: 'Решение по конкретной кредитной заявке: одобрить, отказать или отправить на проверку.',
      params: [{ name: 'applicationId', label: 'Номер заявки', type: 'text' }],
      available: true,
    },
    {
      id: 'BP-02',
      name: 'Обновление информации о клиентах',
      description:
        'Банк периодически получает новые сведения о клиентах (смена работы, доход, новая задолженность) и обновляет свою базу данных.',
      purpose: 'Актуальная информация о клиентах в базе банка.',
      params: [
        { name: 'clientIds', label: 'Список клиентов', type: 'list' },
        { name: 'updateDate', label: 'Дата обновления', type: 'date' },
      ],
      available: true,
    },
    {
      id: 'BP-03',
      name: 'Мониторинг просроченных платежей',
      description:
        'Банк ежедневно проверяет, какие клиенты не внесли очередной платёж по кредиту, и считает срок и сумму просрочки.',
      purpose: 'Список кредитов с просрочками и их характеристики за выбранную дату.',
      params: [{ name: 'monitoringDate', label: 'Дата мониторинга', type: 'date' }],
      available: true,
    },
    {
      id: 'BP-04',
      name: 'Формирование отчёта о кредитном портфеле',
      description:
        'Руководство банка хочет видеть общую картину по выданным кредитам: сколько выдано, сколько должны клиенты, какая доля просрочена.',
      purpose: 'Сводный отчёт по кредитному портфелю за определённую дату.',
      params: [{ name: 'reportDate', label: 'Отчётная дата', type: 'date' }],
      available: false,
      unavailableReason: 'Нужно дождаться завершения мониторинга просрочек (BP-03) за эту дату',
    },
  ]
}

export async function getProcess(id: string): Promise<ProcessInfo | null> {
  // TODO (бэкенд): эндпоинт известен — GET /api/v1/processes/{id}.
  // Когда бэкенд будет готов, заменить тело функции на:
  //   const { data } = await api.get<ProcessInfo>(`/processes/${id}`)
  //   return data

  // Пока берём процесс из тестового списка
  const all = await getProcesses()
  return all.find((process) => process.id === id) ?? null
}