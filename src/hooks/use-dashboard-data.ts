'use client'

import { useQuery } from '@tanstack/react-query'

interface Stats {
  totalGenerated: number
  todayGenerated: number
  processingNow: number
  successRate: number
  avgGenerationTime: number
  totalStorage: number
  queueSize: number
  failedToday: number
  byType: Record<string, { total: number; today: number; completed: number; failed: number }>
  recentActivity: Array<{
    id: string
    type: string
    status: string
    prompt: string
    style: string | null
    aiModel: string
    createdAt: string
    completedAt: string | null
    errorMessage: string | null
  }>
}

interface Task {
  id: string
  type: string
  status: string
  prompt: string
  style: string | null
  resolution: string | null
  duration: string | null
  fileSize: number | null
  aiModel: string
  priority: number
  createdAt: string
  completedAt: string | null
  errorMessage: string | null
}

interface ChartData {
  date: string
  total: number
  completed: number
  failed: number
  avgTime: number
}

export function useDashboardStats() {
  return useQuery<Stats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => fetch('/api/dashboard/stats').then(r => r.json()),
    refetchInterval: 10000,
  })
}

export function useTasks(type?: string, status?: string, page = 1, limit = 10) {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (status) params.set('status', status)
  params.set('page', page.toString())
  params.set('limit', limit.toString())

  return useQuery<{
    tasks: Task[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>({
    queryKey: ['dashboard-tasks', type, status, page, limit],
    queryFn: () => fetch(`/api/dashboard/tasks?${params}`).then(r => r.json()),
  })
}

export function useChartData(range = 14) {
  return useQuery<ChartData[]>({
    queryKey: ['dashboard-chart', range],
    queryFn: () => fetch(`/api/dashboard/chart-data?range=${range}`).then(r => r.json()),
    refetchInterval: 15000,
  })
}

export function useRecentActivity(limit = 20) {
  return useQuery({
    queryKey: ['dashboard-activity', limit],
    queryFn: () => fetch(`/api/dashboard/recent-activity?limit=${limit}`).then(r => r.json()),
    refetchInterval: 8000,
  })
}
