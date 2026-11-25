type Props = {
  endpointReady: boolean
  endpointHint: string // что именно запросить у бэка
  error: string | null
  updatedAt: Date | null
  onReload: () => void
}

export default function PageStatus({ error, updatedAt, onReload }: Props) {
  return (
    <div className="orc-status-line">
      
      {error && <div className="orc-notice orc-notice-error">Ошибка загрузки: {error}</div>}
      <div className="muted orc-refresh">
        {updatedAt ? `Обновлено в ${updatedAt.toLocaleTimeString('ru-RU')}` : 'Загрузка…'} · автообновление
        каждые 5 с{' '}
        <button type="button" className="orc-btn orc-btn-small" onClick={onReload}>
          Обновить
        </button>
      </div>
    </div>
  )
}
