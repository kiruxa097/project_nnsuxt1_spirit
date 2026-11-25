import { api } from './client'
import type { DashboardSummary, LaunchRequest, LaunchResponse, Priority, Run, RunStatus } from '../types'

type BackendExecution = {
  id: number
  process_id: string
  process_code: string
  status: RunStatus
  report_date: string | null
  params: Record<string, unknown>
  priority: number
  decision_reason: string | null
  blocked_by_task_id: number | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

const PRIORITY_TO_NUMBER: Record<Priority, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  NORMAL: 4,
  LOW: 5,
}

function toPriority(value: number): Priority {
  const priorities: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL', 'LOW']
  return priorities[Math.max(0, Math.min(4, value - 1))]
}

function mapExecution(execution: BackendExecution): Run {
  return {
    id: execution.id,
    processId: execution.process_id,
    date: execution.report_date ?? execution.created_at,
    status: execution.status,
    priority: toPriority(execution.priority),
  }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<BackendExecution[]>('/executions')
  return {
    total: data.length,
    running: data.filter((run) => run.status === 'RUNNING').length,
    queued: data.filter((run) => run.status === 'QUEUED' || run.status === 'CREATED').length,
    completed: data.filter((run) => run.status === 'COMPLETED').length,
    failed: data.filter((run) => run.status === 'FAILED').length,
    recentRuns: data.slice(0, 10).map(mapExecution),
  }
}

export async function launchProcess(request: LaunchRequest): Promise<LaunchResponse> {
  const params: Record<string, unknown> = { ...request.params }
  if (typeof params.client_ids === 'string') {
    params.client_ids = params.client_ids
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number(value))
    if ((params.client_ids as number[]).some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new Error('ID клиентов должны быть положительными целыми числами')
    }
  }

  const { data } = await api.post<BackendExecution>('/executions', {
    process_id: request.processId,
    params,
    priority: PRIORITY_TO_NUMBER[request.priority],
  })
  return {
    status: data.status,
    runId: data.id,
    reason: data.decision_reason,
  }
}
