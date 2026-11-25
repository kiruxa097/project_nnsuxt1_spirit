import { STATUS_LABELS } from '../types'
import type { RunStatus } from '../types'

export default function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`orc-badge orc-status-${status.toLowerCase()}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
