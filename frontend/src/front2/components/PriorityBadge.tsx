import { PRIORITY_LABELS } from '../types'
import type { Priority } from '../types'

export default function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`orc-badge orc-priority-${priority.toLowerCase()}`}>
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  )
}
