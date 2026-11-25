import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { ENDPOINTS, getQueue, isReady } from '../api'
import PageStatus from '../components/PageStatus'
import PriorityBadge from '../components/PriorityBadge'
import RunActions from '../components/RunActions'
import StatusBadge from '../components/StatusBadge'
import { formatDateTime, formatParams } from '../format'
import { useAutoRefresh } from '../useAutoRefresh'
import { PRIORITY_ORDER } from '../types'
import type { Run } from '../types'


function sortQueue(runs: Run[]): Run[] {
  return [...runs].sort((a, b) => {
    if ((a.status === 'RUNNING') !== (b.status === 'RUNNING')) return a.status === 'RUNNING' ? -1 : 1
    const byPriority = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
    if (byPriority !== 0) return byPriority
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export default function QueuePage() {
  const { data, error, updatedAt, reload } = useAutoRefresh(getQueue)
  const runs = sortQueue(data ?? [])
  const running = runs.filter((r) => r.status === 'RUNNING').length
  const waiting = runs.filter((r) => r.status === 'QUEUED' || r.status === 'CREATED').length

  return (
    <>
      <PageTitle title="Очередь задач" subtitle="Что выполняется и что ждёт своей очереди" />
      <PageStatus
        endpointReady={isReady(ENDPOINTS.queue)}
        endpointHint="список запусков в статусах CREATED / QUEUED / RUNNING"
        error={error}
        updatedAt={updatedAt}
        onReload={() => void reload()}
      />

      <div className="orc-summary">
        <span>Выполняется: <b>{running}</b></span>
        <span>Ожидает: <b>{waiting}</b></span>
      </div>

      {runs.length === 0 ? (
        <p className="muted">Очередь пуста.</p>
      ) : (
        <div className="orc-table-wrap">
          <table className="orc-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Процесс</th>
                <th>Параметры</th>
                <th>Приоритет</th>
                <th>Статус</th>
                <th>Создан</th>
                <th>Причина ожидания</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td><Link to={`/runs/${run.id}`}>#{run.id}</Link></td>
                  <td>{run.processId} {run.processName}</td>
                  <td>{formatParams(run.params)}</td>
                  <td><PriorityBadge priority={run.priority} /></td>
                  <td><StatusBadge status={run.status} /></td>
                  <td>{formatDateTime(run.createdAt)}</td>
                  <td>
                    {run.reason ?? '—'}
                    {run.blockedByRunId != null && (
                      <> (ждёт <Link to={`/runs/${run.blockedByRunId}`}>#{run.blockedByRunId}</Link>)</>
                    )}
                  </td>
                  <td><RunActions run={run} onChanged={() => void reload()} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
