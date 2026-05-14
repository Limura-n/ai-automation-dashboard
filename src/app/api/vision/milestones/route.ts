import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET /api/vision/milestones ───────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const where: Record<string, unknown> = {}
    if (projectId) {
      where.projectId = projectId
    } else {
      where.projectId = null
    }

    const milestones = await db.visionMilestone.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })
    // Calculate overall progress from milestones
    let totalProgress = 0
    let validCount = 0
    for (const m of milestones) {
      if (m.targetValue > 0) {
        totalProgress += Math.min(m.currentValue / m.targetValue, 1)
        validCount++
      }
    }
    const overallProgress = validCount > 0 ? Math.round((totalProgress / validCount) * 100) : 0
    return NextResponse.json({ milestones, progress: overallProgress })
  } catch (error) {
    console.error('Failed to fetch milestones:', error)
    return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 })
  }
}

// ─── POST /api/vision/milestones ──────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, targetValue, currentValue, unit, sortOrder, projectId } = body
    if (!title || targetValue === undefined) {
      return NextResponse.json({ error: 'title and targetValue are required' }, { status: 400 })
    }
    const milestone = await db.visionMilestone.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        targetValue: Number(targetValue),
        currentValue: Number(currentValue || 0),
        unit: unit?.trim() || '',
        sortOrder: Number(sortOrder || 0),
        projectId: projectId || null,
      },
    })
    return NextResponse.json({ success: true, milestone })
  } catch (error) {
    console.error('Failed to create milestone:', error)
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 })
  }
}

// ─── PUT /api/vision/milestones ───────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, description, targetValue, currentValue, unit, sortOrder, projectId } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (targetValue !== undefined) updateData.targetValue = Number(targetValue)
    if (currentValue !== undefined) updateData.currentValue = Number(currentValue)
    if (unit !== undefined) updateData.unit = unit.trim()
    if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder)
    if (projectId !== undefined) updateData.projectId = projectId || null

    const milestone = await db.visionMilestone.update({ where: { id }, data: updateData })
    return NextResponse.json({ success: true, milestone })
  } catch (error) {
    console.error('Failed to update milestone:', error)
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 })
  }
}

// ─── DELETE /api/vision/milestones ────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const projectId = searchParams.get('projectId')
    if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 })

    const where: Record<string, unknown> = { id }
    if (projectId) where.projectId = projectId

    await db.visionMilestone.delete({ where })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete milestone:', error)
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 })
  }
}
