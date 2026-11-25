import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { ENDPOINTS, getLocks, getQueue, isReady } from '../api'
import PageStatus from '../components/PageStatus'
import { useAutoRefresh } from '../useAutoRefresh'
import type { AccessMode, Lock, Run, RunId } from '../types'

type Conflict = {
  key: string
  waiterId: RunId
  waiterProcess: string
  holderId: RunId
  holderProcess: string
  resource: string | null
  waiterMode: AccessMode | null
  holderMode: AccessMode | null
  note: string | null
}


function buildConflicts(locks: Lock[], queue: Run[]): Conflict[] {
  const result = new Map<string, Conflict>()

  for (const lock of locks) {
    for (const w of lock.waiters) {
      const key = `${w.runId}->${lock.holderRunId}`
      result.set(key, {
        key,
        waiterId: w.runId,
        waiterProcess: w.processId,
        holderId: lock.holderRunId,
        holderProcess: lock.holderProcessId,
        resource: lock.resource,
        waiterMode: w.mode,
        holderMode: lock.mode,
        note: null,
      })
    }
  }

  for (const run of queue) {
    if (run.blockedByRunId == null) continue
    const key = `${run.id}->${run.blockedByRunId}`
    if (result.has(key)) continue
    const holder = queue.find((r) => String(r.id) === String(run.blockedByRunId))
    result.set(key, {
      key,
      waiterId: run.id,
      waiterProcess: run.processId,
      holderId: run.blockedByRunId,
      holderProcess: holder?.processId ?? '?',
      resource: run.blockedResource,
      waiterMode: null,
      holderMode: null,
      note: run.reason,
    })
  }

  return [...result.values()]
}

export default function ConflictsPage() {
  const locksState = useAutoRefresh(getLocks)
  const queueState = useAutoRefresh(getQueue)
  const conflicts = buildConflicts(locksState.data ?? [], queueState.data ?? [])
  const keys = new Set(conflicts.map((c) => `${c.waiterId}->${c.holderId}`))

  function reloadAll() {
    void locksState.reload()
    void queueState.reload()
  }

  return (
    <>
      <PageTitle title="Конфликты" subtitle="Какой запуск кого блокирует и почему" />
      <PageStatus
        endpointReady={isReady(ENDPOINTS.locks) && isReady(ENDPOINTS.queue)}
        endpointHint="блокировки (с ожидающими) и очередь (с полями blockedByRunId / blockedResource / reason)"
        error={locksState.error ?? queueState.error}
        updatedAt={locksState.updatedAt}
        onReload={reloadAll}
      />

      <p className="muted">
        Правило совместимости: READ + READ — можно параллельно; READ + WRITE и WRITE + WRITE на одной области
        данных — нельзя, второй запуск ждёт.
      </p>

      {conflicts.length === 0 ? (
        <p className="muted">Конфликтов сейчас нет.</p>
      ) : (
        <div className="orc-conflicts">
          {conflicts.map((c) => {
            const deadlock = keys.has(`${c.holderId}->${c.waiterId}`) // A ждёт B и B ждёт A
            return (
              <div key={c.key} className={deadlock ? 'orc-conflict orc-conflict-deadlock' : 'orc-conflict'}>
                <div className="orc-conflict-chain">
                  <div className="orc-node orc-node-wait">
                    <div className="muted">Ожидает</div>
                    <Link to={`/runs/${c.waiterId}`}>#{c.waiterId}</Link> {c.waiterProcess}
                    {c.waiterMode && <div>хочет {c.waiterMode}</div>}
                  </div>
                  <div className="orc-arrow">
                    ждёт
                    <br />→
                    {c.resource && <div className="muted">{c.resource}</div>}
                  </div>
                  <div className="orc-node orc-node-hold">
                    <div className="muted">Блокирует</div>
                    <Link to={`/runs/${c.holderId}`}>#{c.holderId}</Link> {c.holderProcess}
                    {c.holderMode && <div>держит {c.holderMode}</div>}
                  </div>
                </div>
                {c.note && <div className="muted">{c.note}</div>}
                {deadlock && <div className="orc-error-text">Взаимная блокировка: запуски ждут друг друга.</div>}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
