import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const missionId = searchParams.get('missionId') || undefined
    const agentId = searchParams.get('agentId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (missionId) where.missionId = missionId
    if (agentId) where.agentId = agentId
    const projectId = searchParams.get('projectId')
    if (projectId) where.mission = { projectId }

    const [tasks, total] = await Promise.all([
      db.agentTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          agent: { select: { id: true, name: true, role: true } },
          mission: { select: { id: true, title: true } },
        },
      }),
      db.agentTask.count({ where }),
    ])

    return NextResponse.json({
      tasks: tasks.map(t => ({
        id: t.id,
        task: t.task,
        status: t.status,
        result: t.result,
        error: t.error,
        report: t.report,
        priority: t.priority,
        missionId: t.missionId,
        missionTitle: t.mission?.title,
        agentId: t.agentId,
        agentName: t.agent?.name,
        agentRole: t.agent?.role,
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt?.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { task, missionId, agentId, priority = 'normal' } = body

    if (!task || typeof task !== 'string') {
      return NextResponse.json({ error: 'Task is required' }, { status: 400 })
    }

    const newTask = await db.agentTask.create({
      data: {
        task: task.trim(),
        status: 'pending',
        priority,
        missionId: missionId || null,
        agentId: agentId || null,
      },
    })

    return NextResponse.json({
      success: true,
      task: {
        id: newTask.id,
        task: newTask.task,
        status: newTask.status,
        missionId: newTask.missionId,
        agentId: newTask.agentId,
        createdAt: newTask.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const taskId = searchParams.get('id')
    if (!taskId) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.result !== undefined) updateData.result = body.result
    if (body.error !== undefined) updateData.error = body.error
    if (body.report !== undefined) updateData.report = body.report
    if (body.agentId !== undefined) updateData.agentId = body.agentId
    if (body.missionId !== undefined) updateData.missionId = body.missionId
    if (body.status === 'completed' || body.status === 'failed') {
      updateData.completedAt = new Date()
    }

    const updated = await db.agentTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        agent: { select: { id: true, name: true } },
        mission: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({
      success: true,
      task: {
        id: updated.id,
        status: updated.status,
        result: updated.result,
        error: updated.error,
        report: updated.report,
        agentName: updated.agent?.name,
        missionTitle: updated.mission?.title,
      },
    })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const taskId = searchParams.get('id')
    if (!taskId) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

    await db.agentTask.delete({ where: { id: taskId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
