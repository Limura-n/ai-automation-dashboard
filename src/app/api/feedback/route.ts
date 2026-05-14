import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET /api/feedback ──────────────────────────────────────
// List feedback entries. Filters: taskId, missionId, projectId, type, applied
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const taskId = searchParams.get('taskId') || undefined
    const missionId = searchParams.get('missionId') || undefined
    const projectId = searchParams.get('projectId') || undefined
    const type = searchParams.get('type') || undefined
    const applied = searchParams.get('applied')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (taskId) where.taskId = taskId
    if (missionId) where.missionId = missionId
    if (projectId) where.projectId = projectId
    if (type) where.type = type
    if (applied === 'true') where.applied = true
    if (applied === 'false') where.applied = false

    const [feedbacks, total] = await Promise.all([
      db.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.feedback.count({ where }),
    ])

    return NextResponse.json({
      feedbacks: feedbacks.map(f => ({
        id: f.id,
        taskId: f.taskId,
        missionId: f.missionId,
        type: f.type,
        content: f.content,
        rating: f.rating,
        applied: f.applied,
        createdAt: f.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}

// ─── POST /api/feedback ─────────────────────────────────────
// Submit feedback on a task or mission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, missionId, projectId, type, content, rating } = body

    if (!type || !['correction', 'praise', 'suggestion', 'rating'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be one of: correction, praise, suggestion, rating' },
        { status: 400 }
      )
    }

    if (!taskId && !missionId) {
      return NextResponse.json(
        { error: 'Either taskId or missionId is required' },
        { status: 400 }
      )
    }

    const feedback = await db.feedback.create({
      data: {
        taskId: taskId || null,
        missionId: missionId || null,
        projectId: projectId || null,
        type,
        content: content?.trim() || null,
        rating: type === 'rating' ? Math.max(1, Math.min(5, rating || 3)) : null,
        applied: false,
      },
    })

    return NextResponse.json({
      success: true,
      feedback: {
        id: feedback.id,
        taskId: feedback.taskId,
        missionId: feedback.missionId,
        type: feedback.type,
        content: feedback.content,
        rating: feedback.rating,
        applied: feedback.applied,
        createdAt: feedback.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error creating feedback:', error)
    return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 })
  }
}

// ─── PUT /api/feedback?id=X ─────────────────────────────────
// Mark feedback as applied (after learning has been extracted)
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const feedbackId = searchParams.get('id')
    if (!feedbackId) return NextResponse.json({ error: 'Feedback ID required' }, { status: 400 })

    const body = await request.json()
    const projectId = body.projectId || undefined

    // Ownership verification
    const existing = await db.feedback.findUnique({ where: { id: feedbackId }, select: { projectId: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }
    const isCrossProject = existing.projectId != null && projectId != null && existing.projectId !== projectId
    if (isCrossProject) {
      return NextResponse.json({ error: 'Feedback does not belong to the specified project' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.applied !== undefined) updateData.applied = body.applied

    const updated = await db.feedback.update({
      where: { id: feedbackId },
      data: updateData,
    })

    return NextResponse.json({ success: true, feedback: updated })
  } catch (error) {
    console.error('Error updating feedback:', error)
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 })
  }
}
