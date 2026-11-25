import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { ENDPOINTS, getLocks, isReady } from '../api'
import PageStatus from '../components/PageStatus'
import { formatDuration } from '../format'
import { useAutoRefresh } from '../useAutoRefresh'

export default function LocksPage() {
  const { data, error, updatedAt, reload } = useAutoRefresh(getLocks)
  const locks = data ?? []

  return (
    <>
      <PageTitle title="Блокировки ресурсов" subtitle="Кто удерживает ресурс и кто его ждёт" />
      <PageStatus
        endpointReady={isReady(ENDPOINTS.locks)}
        endpointHint="список текущих блокировок: ресурс, запуск-держатель, режим READ/WRITE, время создания, ожидающие запуски"
        error={error}
        updatedAt={updatedAt}
        onReload={() => void reload()}
      />

      {locks.length === 0 ? (
        <p className="muted">Занятых ресурсов нет.</p>
      ) : (
        <div className="orc-table-wrap">
          <table className="orc-table">
            <thead>
              <tr>
                <th>Ресурс</th>
                <th>Удерживает запуск</th>
                <th>Режим</th>
                <th>Время блокировки</th>
                <th>Ожидают ресурс</th>
              </tr>
            </thead>
            <tbody>
              {locks.map((lock) => (
                <tr key={lock.id}>
                  <td>
                    {lock.resource}
                    {lock.partition && <span className="muted"> ({lock.partition})</span>}
                  </td>
                  <td>
                    <Link to={`/runs/${lock.holderRunId}`}>#{lock.holderRunId}</Link> {lock.holderProcessId}
                  </td>
                  <td>
                    <span className={`orc-badge orc-mode-${lock.mode.toLowerCase()}`}>{lock.mode}</span>
                  </td>
                  <td>{formatDuration(lock.acquiredAt)}</td>
                  <td>
                    {lock.waiters.length === 0
                      ? '—'
                      : lock.waiters.map((w) => (
                          <div key={w.runId}>
                            <Link to={`/runs/${w.runId}`}>#{w.runId}</Link> {w.processId} ({w.mode})
                          </div>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
