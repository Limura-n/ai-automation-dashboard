'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useProjectContext } from '@/lib/project-context'

/**
 * Returns the current projectId from context.
 * Components don't need to pass projectId manually — it's auto-injected.
 * Components can override by passing an explicit projectId.
 */
function useProjectId(explicitId?: string): string | undefined {
  const ctx = useProjectContext()
  return explicitId !== undefined ? explicitId : ctx.projectId
}

// ─── Types ──────────────────────────────────────────────────
export interface Agent {
  id: string
  name: string
  role: string | null
  skills: string | null
  status: string
  currentTask: string | null
  model: string | null
  createdAt: string
  updatedAt: string
  recentTasks?: Array<{ id: string; task: string; status: string }>
  completedTasks?: number
}

export interface Mission {
  id: string
  title: string
  description: string
  type: string               // "phase" | "sprint" | "mission"
  status: string
  sortOrder: number
  progress: number           // 0.0 to 1.0
  blockedReason: string | null
  summary: string | null
  taskId: string | null
  parentMissionId: string | null
  createdAt: string
  completedAt: string | null
  taskCount: number
  completedTasks: number
  childCount: number         // number of child missions (for phases)
  completedChildren: number  // completed child missions
  childMissions: Array<{     // lightweight children for hierarchy display
    id: string
    title: string
    status: string
    sortOrder: number
    progress: number
  }>
  parentMission: { id: string; title: string; type: string; status: string } | null
}

export interface AgentTask {
  id: string
  task: string
  status: string
  result?: string
  error?: string
  report?: string
  priority: string
  missionId?: string
  missionTitle?: string
  agentId?: string
  agentName?: string
  agentRole?: string
  createdAt: string
  completedAt?: string
}

export interface Report {
  id: string
  type: 'agent' | 'task'
  task: string
  result: string | null
  report: string | null
  agentName: string | null
  agentRole: string | null
  missionTitle: string | null
  missionId: string | null
  completedAt: string
  createdAt: string
}

// Task-level consolidated report
export interface TaskReport {
  id: string
  type: 'task'
  title: string
  description: string | null
  report: string | null
  priority: string
  category: string | null
  missionCount: number
  missions: Array<{
    id: string
    title: string
    summary: string | null
    completedAt: string | null
    agentTaskCount: number
  }>
  completedAt: string | null
  createdAt: string
}

// ─── Project ──────────────────────────────────────────────────
export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  mission: string | null
  vision: string | null
  status: string
  folderPath: string | null
  taskCount: number
  createdAt: string
  updatedAt: string
}

// ─── Projects ────────────────────────────────────────────────
export function useProjects(status?: string) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  return useQuery<{ projects: Project[] }>({
    queryKey: ['projects', status],
    queryFn: () => fetch(`/api/projects?${params}`).then(r => r.json()),
    refetchInterval: 10000,
    staleTime: 5000,
  })
}

export function useProject(id?: string) {
  return useQuery<{ project: Project }>({
    queryKey: ['project', id],
    queryFn: () => fetch(`/api/projects?id=${id}`).then(r => r.json()),
    enabled: !!id,
    staleTime: 5000,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; mission?: string; vision?: string; mainGoal?: string }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create project')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; mission?: string; vision?: string; mainGoal?: string; status?: string }) => {
      const res = await fetch(`/api/projects?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update project')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project'] })
    },
  })
}

export function useArchiveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to archive project')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// ─── Missions ───────────────────────────────────────────────
export function useMissions(status?: string, projectId?: string) {
  const pid = useProjectId(projectId)
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (pid) params.set('projectId', pid)
  return useQuery<{ missions: Mission[]; pagination: any }>({
    queryKey: ['missions', status, pid],
    queryFn: () => fetch(`/api/missions?${params}`).then(r => r.json()),
    placeholderData: keepPreviousData,
    refetchInterval: 5000,
    staleTime: 3000,
  })
}

export function useCreateMission() {
  const qc = useQueryClient()
  const pid = useProjectId()
  return useMutation({
    mutationFn: async ({ title, description, projectId }: { title: string; description: string; projectId?: string }) => {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, projectId: projectId || pid }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create mission')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  })
}

// ─── Phases & Sprints (hierarchy queries) ────────────────────

export function usePhases(status?: string, projectId?: string) {
  const pid = useProjectId(projectId)
  const params = new URLSearchParams()
  if (status) params.set('type', 'phase')
  if (status) params.set('status', status)
  if (pid) params.set('projectId', pid)
  return useQuery<{ missions: Mission[]; pagination: any }>({
    queryKey: ['phases', status, pid],
    queryFn: () => fetch(`/api/missions?${params}`).then(r => r.json()),
    refetchInterval: 10000,
    staleTime: 5000,
  })
}

export function useSprints(phaseId?: string, status?: string, projectId?: string) {
  const pid = useProjectId(projectId)
  const params = new URLSearchParams()
  params.set('type', 'sprint')
  if (phaseId) params.set('parentId', phaseId)
  if (status) params.set('status', status)
  if (pid) params.set('projectId', pid)
  return useQuery<{ missions: Mission[]; pagination: any }>({
    queryKey: ['sprints', phaseId, status, pid],
    queryFn: () => fetch(`/api/missions?${params}`).then(r => r.json()),
    refetchInterval: 10000,
    staleTime: 5000,
  })
}

export function useCreatePhase() {
  const qc = useQueryClient()
  const pid = useProjectId()
  return useMutation({
    mutationFn: async ({ title, description, sortOrder, projectId }: { title: string; description: string; sortOrder?: number; projectId?: string }) => {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, type: 'phase', sortOrder, projectId: projectId || pid }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create phase')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phases'] })
      qc.invalidateQueries({ queryKey: ['missions'] })
    },
  })
}

export function useCreateSprint() {
  const qc = useQueryClient()
  const pid = useProjectId()
  return useMutation({
    mutationFn: async ({ title, description, parentMissionId, sortOrder, projectId }: {
      title: string; description: string; parentMissionId: string; sortOrder?: number; projectId?: string
    }) => {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, type: 'sprint', parentMissionId, sortOrder, projectId: projectId || pid }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create sprint')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints'] })
      qc.invalidateQueries({ queryKey: ['phases'] })
      qc.invalidateQueries({ queryKey: ['missions'] })
    },
  })
}

// ─── Agents ─────────────────────────────────────────────────
export function useAgents(status?: string, projectId?: string) {
  const pid = useProjectId(projectId)
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (pid) params.set('projectId', pid)
  return useQuery<{ agents: Agent[]; pagination: any }>({
    queryKey: ['agents', status, pid],
    queryFn: () => fetch(`/api/agent/subagents?${params}`).then(r => r.json()),
    placeholderData: keepPreviousData,
    refetchInterval: 3000,
    staleTime: 2000,
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  const pid = useProjectId()
  return useMutation({
    mutationFn: async (data: { name: string; role?: string; skills?: string; model?: string; projectId?: string }) => {
      const res = await fetch('/api/agent/subagents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectId: data.projectId || pid }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create agent')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useUpdateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string; currentTask?: string; role?: string; skills?: string; model?: string }) => {
      const res = await fetch(`/api/agent/subagents?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update agent')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/agent/subagents?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete agent')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

// ─── Agent Tasks ────────────────────────────────────────────
export function useAgentTasks(status?: string, missionId?: string, agentId?: string, projectId?: string) {
  const pid = useProjectId(projectId)
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (missionId) params.set('missionId', missionId)
  if (agentId) params.set('agentId', agentId)
  if (pid) params.set('projectId', pid)
  return useQuery<{ tasks: AgentTask[]; pagination: any }>({
    queryKey: ['agent-tasks', status, missionId, agentId, pid],
    queryFn: () => fetch(`/api/agent/tasks?${params}`).then(r => r.json()),
    placeholderData: keepPreviousData,
    refetchInterval: 3000,
    staleTime: 2000,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  const pid = useProjectId()
  return useMutation({
    mutationFn: async (data: { task: string; missionId?: string; agentId?: string; projectId?: string }) => {
      const res = await fetch('/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectId: data.projectId || pid }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create task')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-tasks'] }),
  })
}

// ─── Reports ────────────────────────────────────────────────
export function useReports(missionId?: string, agentId?: string, projectId?: string) {
  const pid = useProjectId(projectId)
  const params = new URLSearchParams()
  if (missionId) params.set('missionId', missionId)
  if (agentId) params.set('agentId', agentId)
  if (pid) params.set('projectId', pid)
  return useQuery<{ reports: Report[]; taskReports: TaskReport[]; totalAgentReports: number; totalTaskReports: number }>({
    queryKey: ['agent-reports', missionId, agentId, pid],
    queryFn: () => fetch(`/api/agent/reports?${params}`).then(r => r.json()),
    placeholderData: keepPreviousData,
    refetchInterval: 5000,
    staleTime: 3000,
  })
}

// ─── Dashboard Stats (lightweight) ──────────────────────────
export function useDashboardStats(projectId?: string) {
  const pid = useProjectId(projectId)
  const missionParams = pid ? `?projectId=${pid}` : ''
  const taskParams = pid ? `?projectId=${pid}` : ''
  return useQuery<{ agentCount: number; missionCount: number; activeAgents: number; completedMissions: number; pendingTasks: number }>({
    queryKey: ['dashboard-stats', pid],
    queryFn: () =>
      Promise.all([
        fetch(`/api/agent/subagents?status=idle${taskParams}`).then(r => r.json()),
        fetch(`/api/agent/subagents?status=busy${taskParams}`).then(r => r.json()),
        fetch(`/api/missions?status=completed${missionParams}`).then(r => r.json()),
        fetch(`/api/missions${missionParams}`).then(r => r.json()),
        fetch(`/api/agent/tasks?status=pending${taskParams}`).then(r => r.json()),
      ]).then(([idle, busy, completed, all, pendingTasks]) => ({
        agentCount: (idle?.pagination?.total || 0) + (busy?.pagination?.total || 0),
        missionCount: all?.pagination?.total || 0,
        activeAgents: busy?.pagination?.total || 0,
        completedMissions: completed?.pagination?.total || 0,
        pendingTasks: pendingTasks?.pagination?.total || 0,
      })),
    refetchInterval: 5000,
    staleTime: 3000,
    placeholderData: keepPreviousData,
  })
}

// ─── Heartbeat ──────────────────────────────────────────────
export function useHeartbeat() {
  const qc = useQueryClient()
  return {
    query: useQuery<{ active: boolean; checkInterval: number }>({
      queryKey: ['heartbeat'],
      queryFn: () => fetch('/api/orchestrator/heartbeat').then(r => r.json()),
      refetchInterval: 30000,
      staleTime: 10000,
    }),
    toggle: useMutation({
      mutationFn: async (active: boolean) => {
        const res = await fetch('/api/orchestrator/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active }),
        })
        return res.json()
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['heartbeat'] }),
    }),
    setInterval: useMutation({
      mutationFn: async (checkInterval: number) => {
        const res = await fetch('/api/orchestrator/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkInterval }),
        })
        return res.json()
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['heartbeat'] }),
    }),
  }
}

// ─── Trigger Orchestrator ───────────────────────────────────
export function useTriggerOrchestrator() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/orchestrator/trigger', { method: 'POST' })
      return res.json()
    },
  })
}

// ─── TASK Types ─────────────────────────────────────────────
export interface Attachment {
  id: string
  filename: string
  filepath: string
  mimetype: string | null
  size: number
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: string // pending, scheduled, in_progress, completed, failed, paused
  priority: string // normal, high, urgent
  schedule: string | null // cron expression
  cronJobId: string | null
  category: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  missionCount: number
  completedMissions: number
  attachments?: Attachment[]
}

// ─── FEEDBACK Types ─────────────────────────────────────────
export interface Feedback {
  id: string
  taskId: string | null
  missionId: string | null
  type: string // correction, praise, suggestion, rating
  content: string | null
  rating: number | null
  applied: boolean
  createdAt: string
}

// ─── LEARNING Types ─────────────────────────────────────────
export interface Learning {
  id: string
  agentName: string
  category: string // workflow, preference, mistake
  insight: string
  evidence: string | null
  confidence: number
  appliedCount: number
  createdAt: string
  updatedAt: string
}

// ─── Tasks Hooks ────────────────────────────────────────────
export function useUserTasks(status?: string, category?: string, priority?: string, projectId?: string) {
  const pid = useProjectId(projectId)
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (category) params.set('category', category)
  if (priority) params.set('priority', priority)
  if (pid) params.set('projectId', pid)
  return useQuery<{ tasks: Task[]; pagination: any }>({
    queryKey: ['user-tasks', status, category, priority, pid],
    queryFn: () => fetch(`/api/tasks?${params}`).then(r => r.json()),
    placeholderData: keepPreviousData,
    refetchInterval: 5000,
    staleTime: 3000,
  })
}

export function useCreateUserTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      title: string
      description?: string
      schedule?: string | null
      priority?: string
      category?: string
      projectId?: string
      attachments?: Array<{ name: string; path: string; size: number; mimetype?: string }>
    }) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useUpdateUserTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string
      title?: string
      description?: string | null
      status?: string
      priority?: string
      schedule?: string | null
      category?: string | null
    }) => {
      const res = await fetch(`/api/tasks?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useDeleteUserTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

// ─── Feedback Hooks ─────────────────────────────────────────
export function useFeedback(taskId?: string, missionId?: string, projectId?: string) {
  const pid = useProjectId(projectId)
  const params = new URLSearchParams()
  if (taskId) params.set('taskId', taskId)
  if (missionId) params.set('missionId', missionId)
  if (pid) params.set('projectId', pid)
  return useQuery<{ feedbacks: Feedback[]; pagination: any }>({
    queryKey: ['feedback', taskId, missionId, pid],
    queryFn: () => fetch(`/api/feedback?${params}`).then(r => r.json()),
    refetchInterval: 30000,
    staleTime: 15000,
  })
}

export function useCreateFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      taskId?: string
      missionId?: string
      projectId?: string
      type: string
      content?: string
      rating?: number
    }) => {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  })
}

// ─── Learning Hooks ─────────────────────────────────────────
export function useLearnings(agentName?: string, projectId?: string) {
  const pid = useProjectId(projectId)
  const params = new URLSearchParams()
  if (agentName) params.set('agentName', agentName)
  if (pid) params.set('projectId', pid)
  return useQuery<{ learnings: Learning[]; pagination: any }>({
    queryKey: ['learnings', agentName, pid],
    queryFn: () => fetch(`/api/learning?${params}`).then(r => r.json()),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
    staleTime: 10000,
  })
}
