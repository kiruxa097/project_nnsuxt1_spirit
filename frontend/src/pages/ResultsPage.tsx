import { useState, useEffect } from 'react'
import PageTitle from '../components/PageTitle'
import { getResults } from '../api/results'
import type { RunResult } from '../types'

type ExecutionStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

const STATUS_LABELS: Record<ExecutionStatus, string> = {
  CREATED: 'Создан',
  QUEUED: 'В очереди',
  RUNNING: 'Выполняется',
  COMPLETED: 'Завершён',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменён',
}

const STATUS_CLASSES: Record<ExecutionStatus, string> = {
  CREATED: 'badge-created',
  QUEUED: 'badge-queued',
  RUNNING: 'badge-running',
  COMPLETED: 'badge-completed',
  FAILED: 'badge-failed',
  CANCELLED: 'badge-cancelled',
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status as ExecutionStatus] ?? status
}

function getStatusClass(status: string): string {
  return STATUS_CLASSES[status as ExecutionStatus] ?? 'badge'
}

export default function ResultsPage() {
  const [activeProcess, setActiveProcess] = useState('BP-01')
  const [results, setResults] = useState<RunResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

    getResults(activeProcess)
      .then((data) => {
        if (!cancelled) {
          setResults(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            'Не удалось загрузить результаты: ' +
              (err instanceof Error ? err.message : 'Неизвестная ошибка'),
          )
          setResults([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeProcess])

  const processes = ['BP-01', 'BP-02', 'BP-03', 'BP-04']

  const totalDebt = results.reduce(
    (sum, result) => sum + (result.totalDebt ?? 0),
    0,
  )

  const totalIssued = results.reduce(
    (sum, result) => sum + (result.totalIssued ?? 0),
    0,
  )

  const maxVal = Math.max(totalDebt, totalIssued, 1)

  return (
    <div>
      <PageTitle
        title="Результаты выполнения"
        subtitle="Просмотр итогов бизнес-процессов"
      />

      {/* Вкладки процессов */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {processes.map((proc) => {
          const isActive = activeProcess === proc

          return (
            <button
              key={proc}
              onClick={() => setActiveProcess(proc)}
              className="btn"
              style={{
                backgroundColor: isActive ? 'var(--accent)' : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--muted)',
                border: isActive ? 'none' : '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {proc}
            </button>
          )
        })}
      </div>

      {/* Состояния загрузки */}
      {loading ? (
        <p className="muted">Загрузка данных...</p>
      ) : error ? (
        <div className="alert-error">{error}</div>
      ) : results.length === 0 ? (
        <p className="muted">
          Нет результатов для процесса {activeProcess}
        </p>
      ) : (
        <>
          {/* Таблица результатов */}
          <table
            className="table"
            style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}
          >
            <thead>
              <tr>
                <th>ID запуска</th>
                <th>Дата</th>
                <th>Статус</th>

                {activeProcess === 'BP-01' && <th>Заявка</th>}
                {activeProcess === 'BP-01' && <th>Решение</th>}

                {activeProcess === 'BP-02' && <th>Обновлено</th>}
                {activeProcess === 'BP-02' && <th>Отклонено</th>}
                {activeProcess === 'BP-02' && <th>Версия</th>}

                {activeProcess === 'BP-03' && <th>Просрочки</th>}

                {activeProcess === 'BP-04' && <th>Долги</th>}
                {activeProcess === 'BP-04' && <th>Выдано</th>}
              </tr>
            </thead>

            <tbody>
              {results.map((row) => (
                <tr key={row.id}>
                  <td>#{row.id}</td>

                  <td>{row.date}</td>

                  <td>
                    <span
                      className={`badge ${getStatusClass(row.status)}`}
                      title={row.status}
                    >
                      {getStatusLabel(row.status)}
                    </span>
                  </td>

                  {activeProcess === 'BP-01' && (
                    <>
                      <td>{row.applicationId ?? '—'}</td>
                      <td>
                        {row.decision ?? '—'}
                        {row.score != null && ` (Скоринг: ${row.score})`}
                      </td>
                    </>
                  )}

                  {activeProcess === 'BP-02' && (
                    <>
                      <td>{row.updatedCount ?? 0}</td>
                      <td>{row.rejectedCount ?? 0}</td>
                      <td>
                        {row.dataVersion != null
                          ? `v${row.dataVersion}`
                          : '—'}
                      </td>
                    </>
                  )}

                  {activeProcess === 'BP-03' && (
                    <td>
                      {row.overdueCount ?? 0} шт. на сумму{' '}
                      {(row.totalOverdueAmount ?? 0).toLocaleString()} ₽
                    </td>
                  )}

                  {activeProcess === 'BP-04' && (
                    <>
                      <td>
                        {(row.totalDebt ?? 0).toLocaleString()} ₽
                      </td>
                      <td>
                        {(row.totalIssued ?? 0).toLocaleString()} ₽
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* График для BP-04 */}
          {activeProcess === 'BP-04' &&
            totalDebt > 0 &&
            totalIssued > 0 && (
              <div
                style={{
                  padding: '20px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  marginTop: '16px',
                }}
              >
                <h3
                  className="section-title"
                  style={{ marginBottom: '32px' }}
                >
                  Сравнение: общие долги vs выданные кредиты
                </h3>

                <div
                  style={{
                    position: 'relative',
                    height: '320px',
                    marginLeft: '60px',
                    marginRight: '60px',
                    marginBottom: '80px',
                  }}
                >
                  {/* Ось Y */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '2px',
                      backgroundColor: 'var(--muted)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        left: '-5px',
                        width: 0,
                        height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderBottom: '10px solid var(--muted)',
                      }}
                    />
                  </div>

                  {/* Ось X */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: '2px',
                      backgroundColor: 'var(--muted)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        right: '-8px',
                        top: '-5px',
                        width: 0,
                        height: 0,
                        borderTop: '6px solid transparent',
                        borderBottom: '6px solid transparent',
                        borderLeft: '10px solid var(--muted)',
                      }}
                    />
                  </div>

                  {/* Столбик: долги */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: '80px',
                      width: '80px',
                      height: `${(totalDebt / maxVal) * 260}px`,
                      backgroundColor: '#f31260',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingTop: '8px',
                    }}
                  >
                    <span
                      style={{
                        color: '#f31260',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {totalDebt.toLocaleString()} ₽
                    </span>
                  </div>

                  {/* Столбик: выданные кредиты */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: '220px',
                      width: '80px',
                      height: `${(totalIssued / maxVal) * 260}px`,
                      backgroundColor: '#f5a524',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingTop: '8px',
                    }}
                  >
                    <span
                      style={{
                        color: '#f5a524',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {totalIssued.toLocaleString()} ₽
                    </span>
                  </div>

                  {/* Подписи */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-60px',
                      left: '60px',
                      width: '120px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: 'var(--text)',
                      fontSize: '14px',
                    }}
                  >
                    Долги
                    <br />
                    (общ.)
                  </div>

                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-60px',
                      left: '200px',
                      width: '120px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: 'var(--text)',
                      fontSize: '14px',
                    }}
                  >
                    Выдано денег
                    <br />
                    (общ.)
                  </div>
                </div>
              </div>
            )}
        </>
      )}
    </div>
  )
}
