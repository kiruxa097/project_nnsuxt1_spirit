import type { LaunchResponse, LaunchStatus } from '../types'

const titles: Record<LaunchStatus, string> = {
  CREATED: 'Запуск зарегистрирован',
  QUEUED: 'Запуск поставлен в очередь',
  RUNNING: 'Запуск допущен к выполнению',
  COMPLETED: 'Запуск завершён успешно',
  FAILED: 'Запуск завершился ошибкой',
  CANCELLED: 'Запуск отменён',
}

export default function LaunchResult({ result }: { result: LaunchResponse }) {
  return (
    <div className={`result result-${result.status.toLowerCase()}`}>
      <strong>{titles[result.status]}</strong>
      <span> · запуск #{result.runId}</span>
      {result.reason && <p>Причина: {result.reason}</p>}
    </div>
  )
}
