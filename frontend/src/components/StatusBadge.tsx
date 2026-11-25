import { statusLabels } from '../labels'
import type { RunStatus } from '../types'

export default function StatusBadge({ status }: { status: RunStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{statusLabels[status]}</span>
}