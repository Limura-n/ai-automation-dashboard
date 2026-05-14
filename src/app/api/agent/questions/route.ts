import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET /api/agent/questions ──────────────────────────────────
// List questions, optionally filtered by projectId or status
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId') || undefined
    const status = searchParams.get('status') || undefined

    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId
    if (status) where.status = status

    const questions = await db.agentQuestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const pending = await db.agentQuestion.count({
      where: { ...where, status: 'pending' },
    })

    return NextResponse.json({ questions, pending })
  } catch (error) {
    console.error('GET /api/agent/questions error:', error)
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }
}

// ─── POST /api/agent/questions ─────────────────────────────────
// Agent creates a new question for the user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { question, context, taskId, missionId, projectId } = body

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 })
    }

    const created = await db.agentQuestion.create({
      data: {
        question: question.trim(),
        context: context || null,
        status: 'pending',
        taskId: taskId || null,
        missionId: missionId || null,
        projectId: projectId || null,
      },
    })

    return NextResponse.json({ question: created }, { status: 201 })
  } catch (error) {
    console.error('POST /api/agent/questions error:', error)
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
  }
}

// ─── PUT /api/agent/questions ──────────────────────────────────
// User answers a question
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Question id is required' }, { status: 400 })
    }

    const existing = await db.agentQuestion.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const body = await request.json()
    const { answer, status } = body

    const updateData: Record<string, unknown> = {}
    if (answer !== undefined && answer.trim()) {
      updateData.answer = answer.trim()
      updateData.status = 'answered'
      updateData.answeredAt = new Date()
    } else if (status === 'dismissed') {
      updateData.status = 'dismissed'
    } else {
      return NextResponse.json({ error: 'Answer or status is required' }, { status: 400 })
    }

    const updated = await db.agentQuestion.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ question: updated })
  } catch (error) {
    console.error('PUT /api/agent/questions error:', error)
    return NextResponse.json({ error: 'Failed to answer question' }, { status: 500 })
  }
}
