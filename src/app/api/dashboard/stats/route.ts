import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET /api/dashboard/stats ─────────────────────────────────
// Returns real business metrics scoped to a project (or all projects if no projectId).
// Queries the actual Task / Mission / AgentTask tables — no legacy GenerationTask.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId') || undefined

    // Build scoped where clauses
    const taskWhere: Record<string, unknown> = {}
    const missionWhere: Record<string, unknown> = {}
    const agentTaskWhere: Record<string, unknown> = {}
    const agentWhere: Record<string, unknown> = {}

    if (projectId) {
      taskWhere.projectId = projectId
      missionWhere.projectId = projectId
      agentTaskWhere.projectId = projectId
      agentWhere.projectId = projectId
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

    // Run all queries in parallel for performance
    const [
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      failedTasks,
      todayTasks,
      todayCompleted,
      totalMissions,
      completedMissions,
      pendingMissions,
      inProgressMissions,
      totalAgentTasks,
      completedAgentTasks,
      idleAgents,
      busyAgents,
      recentTasks,
    ] = await Promise.all([
      // ── Task counts ──────────────────────────────────────────
      db.task.count({ where: taskWhere }),
      db.task.count({ where: { ...taskWhere, status: 'pending' } }),
      db.task.count({ where: { ...taskWhere, status: 'in_progress' } }),
      db.task.count({ where: { ...taskWhere, status: 'completed' } }),
      db.task.count({ where: { ...taskWhere, status: 'failed' } }),
      db.task.count({ where: { ...taskWhere, createdAt: { gte: todayStart } } }),
      db.task.count({ where: { ...taskWhere, status: 'completed', completedAt: { gte: todayStart } } }),

      // ── Mission counts ───────────────────────────────────────
      db.mission.count({ where: missionWhere }),
      db.mission.count({ where: { ...missionWhere, status: 'completed' } }),
      db.mission.count({ where: { ...missionWhere, status: 'pending' } }),
      db.mission.count({ where: { ...missionWhere, status: 'in_progress' } }),

      // ── AgentTask counts ─────────────────────────────────────
      db.agentTask.count({ where: agentTaskWhere }),
      db.agentTask.count({ where: { ...agentTaskWhere, status: 'completed' } }),

      // ── SubAgent counts ──────────────────────────────────────
      db.subAgent.count({ where: { ...agentWhere, status: 'idle' } }),
      db.subAgent.count({ where: { ...agentWhere, status: 'busy' } }),

      // ── Recent tasks (for activity feed) ─────────────────────
      db.task.findMany({
        where: taskWhere,
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true, title: true, status: true, priority: true,
          category: true, createdAt: true, updatedAt: true, completedAt: true,
        },
      }),
    ])

    const totalGenerated = completedTasks
    const todayGenerated = todayCompleted
    const processingNow = inProgressTasks + inProgressMissions

    const successRate = (completedTasks + failedTasks) > 0
      ? Math.round((completedTasks / (completedTasks + failedTasks)) * 1000) / 10
      : 100

    const recentActivity = recentTasks.map(t => ({
      id: t.id,
      type: t.category || 'task',
      status: t.status,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
    }))

    return NextResponse.json({
      totalGenerated,
      todayGenerated,
      processingNow,
      successRate,
      totalTasks,
      pendingTasks,
      completedTasks,
      failedTasks,
      todayTasks,
      totalMissions,
      completedMissions,
      pendingMissions,
      inProgressMissions,
      totalAgentTasks,
      completedAgentTasks,
      idleAgents,
      busyAgents,
      recentActivity,
    })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
