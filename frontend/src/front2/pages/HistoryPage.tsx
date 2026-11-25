import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { ENDPOINTS, getHistory, isReady } from '../api'
import PageStatus from '../components/PageStatus'
import StatusBadge from '../components/StatusBadge'
import { formatDateTime, formatDuration, formatParams, localDate } from '../format'
import { useAutoRefresh } from '../useAutoRefresh'
import { FINISHED_STATUSES, PROCESS_OPTIONS } from '../types'
import type { HistoryFilters } from '../types'

export default function HistoryPage() {
  const [filters, setFilters] = useState<HistoryFilters>({ dateFrom: '', dateTo: '', processId: '' })
  const { data, error, updatedAt, reload } = useAutoRefresh(() => getHistory(filters))

  //при смене фильтра сразу перезапрашиваем данные
  useEffect(() => {
    void reload()
  }, [filters, reload])

  
  const runs = (data ?? [])
    .filter((r) => FINISHED_STATUSES.includes(r.status))
    .filter((r) => !filters.processId || r.processId === filters.processId)
    .filter((r) => !filters.dateFrom || localDate(r.createdAt) >= filters.dateFrom)
    .filter((r) => !filters.dateTo || localDate(r.createdAt) <= filters.dateTo)

  return (
    <>
      <PageTitle title="История выполнения" subtitle="Завершённые запуски" />
      <PageStatus
        endpointReady={isReady(ENDPOINTS.history)}
        endpointHint="завершённые запуски + названия параметров фильтра по дате и процессу"
        error={error}
        updatedAt={updatedAt}
        onReload={() => void reload()}
      />

      <div className="orc-filters">
        <label>
          С даты
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          />
        </label>
        <label>
          По дату
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          />
        </label>
        <label>
          Процесс
          <select value={filters.processId} onChange={(e) => setFilters({ ...filters, processId: e.target.value })}>
            <option value="">Все</option>
            {PROCESS_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="orc-btn"
          onClick={() => setFilters({ dateFrom: '', dateTo: '', processId: '' })}
        >
          Сбросить
        </button>
      </div>

      {runs.length === 0 ? (
        <p className="muted">Завершённых запусков не найдено.</p>
      ) : (
        <div className="orc-table-wrap">
          <table className="orc-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Процесс</th>
                <th>Параметры</th>
                <th>Статус</th>
                <th>Начало</th>
                <th>Время выполнения</th>
                <th>Результат</th>
                <th>Ошибка / причина отказа</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td><Link to={`/runs/${run.id}`}>#{run.id}</Link></td>
                  <td>{run.processId} {run.processName}</td>
                  <td>{formatParams(run.params)}</td>
                  <td><StatusBadge status={run.status} /></td>
                  <td>{formatDateTime(run.startedAt)}</td>
                  <td>{formatDuration(run.startedAt, run.finishedAt)}</td>
                  <td>{run.result ?? '—'}</td>
                  <td>{run.status === 'COMPLETED' ? '—' : (run.reason ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
