import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const projectId = searchParams.get('projectId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    // Show project-scoped agents AND global agents (projectId=null) when inside a project
    if (projectId) {
      where.OR = [
        { projectId: projectId },
        { projectId: null },
      ]
    }

    const [agents, total] = await Promise.all([
      db.subAgent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tasks: {
            select: { id: true, task: true, status: true, completedAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      }),
      db.subAgent.count({ where }),
    ])

    return NextResponse.json({
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        skills: a.skills,
        status: a.status,
        currentTask: a.currentTask,
        model: a.model,
        totalCompleted: a.totalCompleted,
        successRate: a.successRate,
        specialistSkills: a.specialistSkills,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        recentTasks: a.tasks,
        completedTasks: a.tasks.filter(t => t.status === 'completed').length,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, role, skills, model, projectId } = body

    if (!name) {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 })
    }

    const agent = await db.subAgent.create({
      data: {
        name: name.trim(),
        role: role?.trim() || null,
        skills: skills?.trim() || null,
        model: model?.trim() || null,
        projectId: projectId?.trim() || null,
        status: 'idle',
      },
    })

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        skills: agent.skills,
        status: agent.status,
        model: agent.model,
        createdAt: agent.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error creating agent:', error)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agentId = searchParams.get('id')
    if (!agentId) return NextResponse.json({ error: 'Agent ID required' }, { status: 400 })

    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.currentTask !== undefined) updateData.currentTask = body.currentTask
    if (body.role) updateData.role = body.role
    if (body.skills) updateData.skills = body.skills
    if (body.name) updateData.name = body.name
    if (body.totalCompleted !== undefined) updateData.totalCompleted = body.totalCompleted
    if (body.successRate !== undefined) updateData.successRate = body.successRate
    if (body.specialistSkills !== undefined) updateData.specialistSkills = body.specialistSkills
    if (body.model !== undefined) updateData.model = body.model

    const updated = await db.subAgent.update({
      where: { id: agentId },
      data: updateData,
    })

    return NextResponse.json({ success: true, agent: updated })
  } catch (error) {
    console.error('Error updating agent:', error)
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agentId = searchParams.get('id')
    if (!agentId) return NextResponse.json({ error: 'Agent ID required' }, { status: 400 })

    await db.subAgent.delete({ where: { id: agentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting agent:', error)
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 })
  }
}
