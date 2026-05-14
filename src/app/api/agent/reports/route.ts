import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET /api/agent/reports ──────────────────────────────────
// Returns TWO tiers of reports:
//   1. reports — AgentTask-level (individual sub-agent outputs)
//   2. taskReports — Task-level (consolidated final deliverables)
//
// A Task-level report exists when Task.report IS NOT NULL.
// The orchestrator writes Task.report when all missions complete.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const missionId = searchParams.get('missionId') || undefined
    const agentId = searchParams.get('agentId') || undefined
    const projectId = searchParams.get('projectId') || undefined
    const limit = parseInt(searchParams.get('limit') || '30')

    // ─── 1. AgentTask-level reports (existing) ────────────
    const agentWhere: Record<string, unknown> = {
      status: 'completed',
      report: { not: null },
    }
    if (missionId) agentWhere.missionId = missionId
    if (agentId) agentWhere.agentId = agentId
    if (projectId) agentWhere.mission = { projectId }

    const agentTasks = await db.agentTask.findMany({
      where: agentWhere,
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        agent: { select: { id: true, name: true, role: true } },
        mission: { select: { id: true, title: true } },
      },
    })

    const reports = agentTasks.map(t => ({
      id: t.id,
      type: 'agent',
      task: t.task,
      result: t.result,
      report: t.report,
      agentName: t.agent?.name,
      agentRole: t.agent?.role,
      missionTitle: t.mission?.title,
      missionId: t.missionId,
      completedAt: t.completedAt?.toISOString(),
      createdAt: t.createdAt.toISOString(),
    }))

    // ─── 2. Task-level consolidated reports (NEW) ───────────
    // Return completed tasks that have a final report
    const taskWhere: Record<string, unknown> = {
      status: 'completed',
      report: { not: null },
    }
    if (projectId) taskWhere.projectId = projectId

    const tasks = await db.task.findMany({
      where: taskWhere,
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        missions: {
          where: { status: 'completed' },
          select: {
            id: true,
            title: true,
            summary: true,
            completedAt: true,
            _count: { select: { tasks: true } },
          },
        },
      },
    })

    const taskReports = tasks.map(t => ({
      id: t.id,
      type: 'task',
      title: t.title,
      description: t.description,
      report: t.report,
      priority: t.priority,
      category: t.category,
      missionCount: t.missions.length,
      missions: t.missions.map(m => ({
        id: m.id,
        title: m.title,
        summary: m.summary,
        completedAt: m.completedAt?.toISOString(),
        agentTaskCount: m._count.tasks,
      })),
      completedAt: t.completedAt?.toISOString(),
      createdAt: t.createdAt.toISOString(),
    }))

    return NextResponse.json({
      reports,
      taskReports,
      // Totals for the overview
      totalAgentReports: reports.length,
      totalTaskReports: taskReports.length,
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}
