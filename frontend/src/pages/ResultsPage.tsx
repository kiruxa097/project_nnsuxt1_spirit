import { useEffect, useState } from 'react'
import PageTitle from '../components/PageTitle'
import StatusBadge from '../components/StatusBadge'
import { getErrorMessage } from '../api/client'
import { getExecutions } from '../api/runs'
import type { Run } from '../types'

export default function ResultsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getExecutions()
      .then((data) => { if (!cancelled) setRuns(data) })
      .catch((err) => { if (!cancelled) setError(getErrorMessage(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <PageTitle title="Результаты выполнения" subtitle="Статусы и параметры запусков бизнес-процессов" />
      {loading && <p className="muted">Загрузка…</p>}
      {error && <div className="alert-error">{error}</div>}
      {!loading && !error && runs.length === 0 && <p className="muted">Запусков пока нет.</p>}
      {runs.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ID</th><th>Процесс</th><th>Дата</th><th>Статус</th><th>Приоритет</th></tr></thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>#{run.id}</td><td>{run.processId}</td><td>{run.date}</td>
                  <td><StatusBadge status={run.status} /></td><td>{run.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">Фактические бизнес-метрики и отчёты появятся после подключения обработчиков бизнес-процессов к оркестратору.</p>
    </>
  )
}
