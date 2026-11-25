export type RunStatus = 'CREATED' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL' | 'LOW'

export type Run = {
  id: number
  processId: string
  date: string
  status: RunStatus
  priority: Priority
}

export type DashboardSummary = {
  total: number
  running: number
  queued: number
  completed: number
  failed: number
  recentRuns: Run[]
}

export type ProcessParam = {
  name: string
  label: string
  type: 'text' | 'date' | 'list'
  required?: boolean
}

export type ProcessInfo = {
  id: string
  name: string
  description: string
  purpose: string
  params: ProcessParam[]
  available: boolean
  unavailableReason?: string
}

export type LaunchRequest = {
  processId: string
  params: Record<string, string>
  priority: Priority
}

export type LaunchStatus = RunStatus

export type LaunchResponse = {
  status: LaunchStatus
  runId: number
  reason?: string | null
}
