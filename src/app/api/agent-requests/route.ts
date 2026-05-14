import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ─── GET /api/agent-requests ──────────────────────────────────
export async function GET() {
  try {
    const requests = await db.agentRequest.findMany({ orderBy: { createdAt: 'desc' } })
    const pending = requests.filter(r => r.status === 'pending').length
    return NextResponse.json({ requests, pendingCount: pending })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }
}

// ─── POST /api/agent-requests ─────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fieldKey, label, description, fieldType, required, source } = body
    if (!fieldKey || !label) {
      return NextResponse.json({ error: 'fieldKey and label are required' }, { status: 400 })
    }
    const req = await db.agentRequest.create({
      data: {
        fieldKey: fieldKey.trim(),
        label: label.trim(),
        description: description?.trim() || null,
        fieldType: fieldType || 'text',
        required: required !== false,
        source: source || 'agent',
        status: 'pending',
      },
    })
    return NextResponse.json({ success: true, request: req })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
  }
}

// ─── PUT /api/agent-requests ──────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, value, status } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const updateData: Record<string, unknown> = {}
    if (value !== undefined) updateData.value = String(value).trim()
    if (status !== undefined) updateData.status = status
    const updated = await db.agentRequest.update({ where: { id }, data: updateData })
    return NextResponse.json({ success: true, request: updated })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
}

// ─── DELETE /api/agent-requests ───────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 })
    await db.agentRequest.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 })
  }
}
