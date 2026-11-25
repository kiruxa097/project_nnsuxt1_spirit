import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelRun, changePriority, errorText } from '../api'
import { ACTIVE_STATUSES, PRIORITY_LABELS, PRIORITY_ORDER } from '../types'
import type { Priority, Run } from '../types'

type Props = {
  run: Run
  onChanged: () => void // вызвать, чтобы страница перезагрузила данные
  hideJournal?: boolean // на странице самого запуска ссылка на журнал не нужна
}

// Кнопки показываются только там, где действие допустимо.
export default function RunActions({ run, onChanged, hideJournal }: Props) {
  const [editing, setEditing] = useState(false)
  const [priority, setPriority] = useState<Priority>(run.priority)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Если бэк прислал canCancel / canChangePriority — верим ему, иначе считаем по статусу
  const canCancel = run.canCancel ?? ACTIVE_STATUSES.includes(run.status)
  const canChangePriority = run.canChangePriority ?? (run.status === 'CREATED' || run.status === 'QUEUED')

  async function act(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setEditing(false)
      onChanged()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  function handleCancel() {
    if (window.confirm(`Отменить запуск #${run.id}?`)) {
      void act(() => cancelRun(run.id))
    }
  }

  return (
    <div className="orc-actions">
      <div className="orc-actions-row">
        {!hideJournal && (
          <Link className="orc-btn orc-btn-small" to={`/runs/${run.id}`}>
            Журнал
          </Link>
        )}
        {canChangePriority && !editing && (
          <button type="button" className="orc-btn orc-btn-small" disabled={busy} onClick={() => setEditing(true)}>
            Приоритет
          </button>
        )}
        {canCancel && (
          <button type="button" className="orc-btn orc-btn-small orc-btn-danger" disabled={busy} onClick={handleCancel}>
            Отменить
          </button>
        )}
      </div>

      {editing && (
        <div className="orc-actions-row">
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="orc-btn orc-btn-small orc-btn-primary"
            disabled={busy}
            onClick={() => void act(() => changePriority(run.id, priority))}
          >
            Сохранить
          </button>
          <button type="button" className="orc-btn orc-btn-small" disabled={busy} onClick={() => setEditing(false)}>
            Отмена
          </button>
        </div>
      )}

      {error && <div className="orc-error-text">{error}</div>}
    </div>
  )
}
