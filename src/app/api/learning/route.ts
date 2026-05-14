import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET /api/learning ──────────────────────────────────────
// List agent learnings. Filters: agentName, category
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agentName = searchParams.get('agentName') || undefined
    const category = searchParams.get('category') || undefined
    const projectId = searchParams.get('projectId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (agentName) where.agentName = agentName
    if (category) where.category = category
    if (projectId) where.projectId = projectId

    const [learnings, total] = await Promise.all([
      db.agentLearning.findMany({
        where,
        orderBy: [{ confidence: 'desc' }, { appliedCount: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.agentLearning.count({ where }),
    ])

    return NextResponse.json({
      learnings: learnings.map(l => ({
        id: l.id,
        agentName: l.agentName,
        category: l.category,
        insight: l.insight,
        evidence: l.evidence,
        confidence: l.confidence,
        appliedCount: l.appliedCount,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching learnings:', error)
    return NextResponse.json({ error: 'Failed to fetch learnings' }, { status: 500 })
  }
}

// ─── POST /api/learning ─────────────────────────────────────
// Create a new learning entry (called by agents after extracting insights)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentName, category, insight, evidence, confidence, projectId } = body

    if (!agentName || !category || !insight) {
      return NextResponse.json(
        { error: 'agentName, category, and insight are required' },
        { status: 400 }
      )
    }

    if (!['workflow', 'preference', 'mistake'].includes(category)) {
      return NextResponse.json(
        { error: 'Category must be one of: workflow, preference, mistake' },
        { status: 400 }
      )
    }

    const learning = await db.agentLearning.create({
      data: {
        agentName: agentName.trim(),
        category,
        insight: insight.trim(),
        evidence: evidence?.trim() || null,
        confidence: confidence != null ? Math.max(0, Math.min(1, confidence)) : 0.5,
        projectId: projectId?.trim() || null,
        appliedCount: 0,
      },
    })

    return NextResponse.json({
      success: true,
      learning: {
        id: learning.id,
        agentName: learning.agentName,
        category: learning.category,
        insight: learning.insight,
        confidence: learning.confidence,
        createdAt: learning.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error creating learning:', error)
    return NextResponse.json({ error: 'Failed to create learning' }, { status: 500 })
  }
}

// ─── PUT /api/learning?id=X ─────────────────────────────────
// Update a learning entry (e.g., boost confidence, increment appliedCount)
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const learningId = searchParams.get('id')
    if (!learningId) return NextResponse.json({ error: 'Learning ID required' }, { status: 400 })

    const body = await request.json()
    const projectId = body.projectId || undefined

    // Ownership verification
    const existing = await db.agentLearning.findUnique({ where: { id: learningId }, select: { projectId: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Learning not found' }, { status: 404 })
    }
    const isCrossProject = existing.projectId != null && projectId != null && existing.projectId !== projectId
    if (isCrossProject) {
      return NextResponse.json({ error: 'Learning does not belong to the specified project' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.confidence !== undefined) {
      updateData.confidence = Math.max(0, Math.min(1, body.confidence))
    }
    if (body.appliedCount !== undefined) {
      updateData.appliedCount = body.appliedCount
    }
    if (body.insight !== undefined) {
      updateData.insight = body.insight.trim()
    }
    if (body.evidence !== undefined) {
      updateData.evidence = body.evidence?.trim() || null
    }

    const updated = await db.agentLearning.update({
      where: { id: learningId },
      data: updateData,
    })

    return NextResponse.json({ success: true, learning: updated })
  } catch (error) {
    console.error('Error updating learning:', error)
    return NextResponse.json({ error: 'Failed to update learning' }, { status: 500 })
  }
}

// ─── DELETE /api/learning?id=X ───────────────────────────────
// Remove a learning entry (e.g., outdated or proven wrong)
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const learningId = searchParams.get('id')
    const projectId = searchParams.get('projectId') || undefined
    if (!learningId) return NextResponse.json({ error: 'Learning ID required' }, { status: 400 })

    // Ownership verification
    const existing = await db.agentLearning.findUnique({ where: { id: learningId }, select: { projectId: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Learning not found' }, { status: 404 })
    }
    const isCrossProject = existing.projectId != null && projectId != null && existing.projectId !== projectId
    if (isCrossProject) {
      return NextResponse.json({ error: 'Learning does not belong to the specified project' }, { status: 403 })
    }

    await db.agentLearning.delete({ where: { id: learningId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting learning:', error)
    return NextResponse.json({ error: 'Failed to delete learning' }, { status: 500 })
  }
}
