export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU')
}

export function formatDuration(fromIso: string | null | undefined, toIso?: string | null): string {
  if (!fromIso) return '—'
  const from = new Date(fromIso).getTime()
  const to = toIso ? new Date(toIso).getTime() : Date.now()
  if (Number.isNaN(from) || Number.isNaN(to)) return '—'
  const sec = Math.max(0, Math.round((to - from) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h} ч ${m} мин`
  if (m > 0) return `${m} мин ${s} с`
  return `${s} с`
}

export function formatParams(params: Record<string, unknown> | null | undefined): string {
  if (!params || Object.keys(params).length === 0) return '—'
  return Object.entries(params)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ')
}


export function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE')
}
