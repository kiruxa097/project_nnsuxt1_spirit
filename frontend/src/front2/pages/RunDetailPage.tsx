import { Link, useParams } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { ENDPOINTS, getRun, getRunLog, isReady } from '../api'
import PageStatus from '../components/PageStatus'
import PriorityBadge from '../components/PriorityBadge'
import RunActions from '../components/RunActions'
import StatusBadge from '../components/StatusBadge'
import { formatDateTime, formatDuration, formatParams } from '../format'
import { useAutoRefresh } from '../useAutoRefresh'

export default function RunDetailPage() {
  const { runId = '' } = useParams()
  const runState = useAutoRefresh(() => getRun(runId))
  const logState = useAutoRefresh(() => getRunLog(runId))
  const run = runState.data
  const log = logState.data ?? []

  function reloadAll() {
    void runState.reload()
    void logState.reload()
  }

  return (
    <>
      <PageTitle title={`Запуск #${runId}`} subtitle="Детальная информация и журнал выполнения" />
      <PageStatus
        endpointReady={isReady(ENDPOINTS.run) && isReady(ENDPOINTS.runLog)}
        endpointHint="запуск по id и журнал выполнения запуска"
        error={runState.error ?? logState.error}
        updatedAt={runState.updatedAt}
        onReload={reloadAll}
      />

      <p><Link to="/queue">← К очереди</Link></p>

      {!run ? (
        <p className="muted">Данные запуска не загружены.</p>
      ) : (
        <>
          <dl className="orc-details">
            <dt>ID запуска</dt><dd>#{run.id}</dd>
            <dt>Процесс</dt><dd>{run.processId} {run.processName}</dd>
            <dt>Параметры</dt><dd>{formatParams(run.params)}</dd>
            <dt>Инициатор</dt><dd>{run.initiator || '—'}</dd>
            <dt>Приоритет</dt><dd><PriorityBadge priority={run.priority} /></dd>
            <dt>Статус</dt><dd><StatusBadge status={run.status} /></dd>
            <dt>Время создания</dt><dd>{formatDateTime(run.createdAt)}</dd>
            <dt>Время начала</dt><dd>{formatDateTime(run.startedAt)}</dd>
            <dt>Время окончания</dt><dd>{formatDateTime(run.finishedAt)}</dd>
            <dt>Длительность</dt><dd>{formatDuration(run.startedAt, run.finishedAt)}</dd>
            <dt>Результат</dt><dd>{run.result ?? '—'}</dd>
          </dl>

          {(run.reason || run.blockedByRunId != null) && (
            <div className="orc-reason">
              <b>
                {run.status === 'FAILED' || run.status === 'CANCELLED'
                  ? 'Причина ошибки / отказа: '
                  : 'Причина ожидания: '}
              </b>
              {run.reason ?? '—'}
              {run.blockedByRunId != null && (
                <>
                  {' '}Блокирует запуск <Link to={`/runs/${run.blockedByRunId}`}>#{run.blockedByRunId}</Link>
                  {run.blockedResource && <> (ресурс {run.blockedResource})</>}
                </>
              )}
            </div>
          )}

          <RunActions run={run} onChanged={reloadAll} hideJournal />
        </>
      )}

      <h2 className="orc-h2">Журнал выполнения</h2>
      {log.length === 0 ? (
        <p className="muted">Записей пока нет.</p>
      ) : (
        <ul className="orc-log">
          {log.map((entry, i) => (
            <li key={i}>
              <span className="muted">{formatDateTime(entry.time)}</span>
              {entry.level && <span className="orc-log-level">{entry.level}</span>}
              {entry.message}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
