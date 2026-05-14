import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const projectId = searchParams.get('projectId') || undefined

    const where = projectId ? { projectId } : {}

    // Fetch recent items from all three automation models in parallel
    const [tasks, missions, agentTasks] = await Promise.all([
      db.task.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      db.mission.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      db.agentTask.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          task: true,
          agentName: true,
          status: true,
          updatedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
    ])

    // Normalize to a common shape
    const taskActivity = tasks.map(t => ({
      id: `task:${t.id}`,
      type: 'task',
      action: t.status === 'completed' ? 'completed' : t.status === 'in_progress' ? 'in progress' : t.status,
      status: t.status,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      completedAt: t.completedAt?.toISOString(),
    }))

    const missionActivity = missions.map(m => ({
      id: `mission:${m.id}`,
      type: 'mission',
      action: m.status === 'completed' ? 'completed' : m.status === 'in_progress' ? 'in progress' : m.status,
      status: m.status,
      title: m.title,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      completedAt: m.completedAt?.toISOString(),
    }))

    const agentActivity = agentTasks.map(t => ({
      id: `agent:${t.id}`,
      type: 'agent_task',
      action: t.status === 'completed' ? 'completed' : t.status === 'in_progress' ? 'running' : t.status,
      status: t.status,
      title: t.task,
      agentName: t.agentName,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      completedAt: t.completedAt?.toISOString(),
    }))

    // Merge, sort by updatedAt desc, take limit
    const activity = [...taskActivity, ...missionActivity, ...agentActivity]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit)

    return NextResponse.json(activity)
  } catch (error) {
    console.error('recent-activity error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
