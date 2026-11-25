import { useEffect, useState } from 'react'
import { getDashboardSummary } from '../api/runs'
import { getErrorMessage } from '../api/client'
import PageTitle from '../components/PageTitle'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import { formatDate, priorityLabels } from '../labels'
import type { DashboardSummary } from '../types'

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false 
    getDashboardSummary()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <PageTitle title="Главная панель" subtitle="Сводка по запускам процессов" />

      {loading && <p className="muted">Загрузка…</p>}
      {error && <div className="alert-error">Не удалось загрузить данные: {error}</div>}

      {data && (
        <>
          <div className="stat-grid">
            <StatCard label="Всего запусков" value={data.total} />
            <StatCard label="Выполняются" value={data.running} tone="running" />
            <StatCard label="Ожидают" value={data.queued} tone="waiting" />
            <StatCard label="Завершены" value={data.completed} tone="success" />
            <StatCard label="С ошибкой" value={data.failed} tone="error" />
          </div>

          <h2 className="section-title">Последние запуски</h2>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Процесс</th>
                <th>Дата</th>
                <th>Статус</th>
                <th>Приоритет</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRuns.map((run) => (
                <tr key={run.id}>
                  <td>{run.id}</td>
                  <td>{run.processId}</td>
                  <td>{formatDate(run.date)}</td>
                  <td>
                    <StatusBadge status={run.status} />
                  </td>
                  <td>{priorityLabels[run.priority]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}