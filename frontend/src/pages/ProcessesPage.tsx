import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProcesses } from '../api/processes'
import { getErrorMessage } from '../api/client'
import PageTitle from '../components/PageTitle'
import type { ProcessInfo } from '../types'

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getProcesses()
      .then((result) => {
        if (!cancelled) setProcesses(result)
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
      <PageTitle title="Бизнес-процессы" subtitle="Выберите процесс и запустите его" />

      {loading && <p className="muted">Загрузка…</p>}
      {error && <div className="alert-error">Не удалось загрузить процессы: {error}</div>}

      <div className="process-list">
        {processes.map((process) => (
          <article key={process.id} className="process-card">
            <div className="process-head">
              <span className="process-id">{process.id}</span>
              <h2>{process.name}</h2>
            </div>

            <p className="process-text">{process.description}</p>

            <dl className="process-meta">
              <dt>Назначение</dt>
              <dd>{process.purpose}</dd>
              <dt>Параметры запуска</dt>
              <dd>
                {process.params.map((param) => (
                  <span key={param.name} className="chip">
                    {param.label}
                  </span>
                ))}
              </dd>
            </dl>

            <div className="process-footer">
              {process.available ? (
                <span className="availability ok">Доступен для запуска</span>
              ) : (
                <span className="availability no">
                  Недоступен{process.unavailableReason ? `: ${process.unavailableReason}` : ''}
                </span>
              )}

              {process.available ? (
                <Link to={`/processes/${process.id}/launch`} className="btn">
                  Запустить
                </Link>
              ) : (
                <span className="btn btn-disabled">Запустить</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  )
}