import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET /api/prerequisites ──────────────────────────────────
// List all prerequisites for a project, grouped by category
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') || undefined
    if (!projectId) {
      return NextResponse.json({ prerequisites: [], categories: {}, summary: { total: 0, filled: 0, required: 0, requiredFilled: 0 } })
    }

    const where = projectId ? { projectId } : {}
    const prereqs = await db.projectPrerequisite.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })

    // Group by category
    const categories: Record<string, any[]> = {}
    for (const p of prereqs) {
      if (!categories[p.category]) categories[p.category] = []
      categories[p.category].push(p)
    }

    const filled = prereqs.filter(p => p.status === 'filled').length
    const required = prereqs.filter(p => p.required).length
    const requiredFilled = prereqs.filter(p => p.required && p.status === 'filled').length

    return NextResponse.json({
      prerequisites: prereqs,
      categories,
      summary: {
        total: prereqs.length,
        filled,
        required,
        requiredFilled,
        blocked: requiredFilled < required,
        ready: required === 0 || requiredFilled === required,
      },
    })
  } catch (error: any) {
    console.error('Prerequisites GET error:', error?.message || error)
    return NextResponse.json({ error: `Failed to fetch prerequisites: ${error?.message}` }, { status: 500 })
  }
}

// ─── POST /api/prerequisites ─────────────────────────────────
// Create one or more prerequisites. Body can be a single object or an array.
// Used by: main agent after analyzing what the business needs (Phase 0 blueprint analysis)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const entries = Array.isArray(body) ? body : [body]

    const created = []
    for (const entry of entries) {
      if (!entry.projectId || !entry.fieldKey || !entry.label) continue
      const p = await db.projectPrerequisite.create({
        data: {
          projectId: entry.projectId,
          fieldKey: entry.fieldKey,
          label: entry.label,
          description: entry.description || null,
          fieldType: entry.fieldType || 'text',
          required: entry.required !== false,
          category: entry.category || 'setup',
          sortOrder: entry.sortOrder ?? 0,
        },
      })
      created.push(p)
    }

    return NextResponse.json({ success: true, count: created.length, prerequisites: created })
  } catch (error: any) {
    console.error('Prerequisites POST error:', error?.message || error)
    return NextResponse.json({ error: `Failed to create prerequisites: ${error?.message}` }, { status: 500 })
  }
}

// ─── PUT /api/prerequisites ──────────────────────────────────
// Update a prerequisite — fill in value, change status, etc.
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const data: any = {}
    if (updates.value !== undefined) data.value = updates.value
    if (updates.status !== undefined) data.status = updates.status
    if (updates.label !== undefined) data.label = updates.label
    if (updates.description !== undefined) data.description = updates.description

    const updated = await db.projectPrerequisite.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, prerequisite: updated })
  } catch (error: any) {
    console.error('Prerequisites PUT error:', error?.message || error)
    return NextResponse.json({ error: `Failed to update prerequisite: ${error?.message}` }, { status: 500 })
  }
}

// ─── DELETE /api/prerequisites ───────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await db.projectPrerequisite.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Prerequisites DELETE error:', error?.message || error)
    return NextResponse.json({ error: `Failed to delete prerequisite: ${error?.message}` }, { status: 500 })
  }
}
