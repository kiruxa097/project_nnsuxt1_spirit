import type { LaunchResponse, LaunchStatus } from '../types'

const titles: Record<LaunchStatus, string> = {
  ACCEPTED: 'Запуск принят',
  QUEUED: 'Запуск поставлен в очередь',
  REJECTED: 'Запуск отклонён',
}

export default function LaunchResult({ result }: { result: LaunchResponse }) {
  return (
    <div className={`result result-${result.status.toLowerCase()}`}>
      <strong>{titles[result.status]}</strong>
      {result.runId !== undefined && <span> · запуск #{result.runId}</span>}
      {result.reason && <p>Причина: {result.reason}</p>}
    </div>
  )
}