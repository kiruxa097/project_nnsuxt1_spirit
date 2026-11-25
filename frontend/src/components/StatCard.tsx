type Props = {
  label: string
  value: number
  tone?: 'default' | 'running' | 'waiting' | 'success' | 'error'
}

export default function StatCard({ label, value, tone = 'default' }: Props) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}