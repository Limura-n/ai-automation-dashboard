import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || undefined
    const status = searchParams.get('status') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || undefined

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (status) where.status = status
    if (search) where.prompt = { contains: search }

    const [tasks, total] = await Promise.all([
      db.generationTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.generationTask.count({ where }),
    ])

    return NextResponse.json({
      tasks: tasks.map(t => ({
        id: t.id,
        type: t.type,
        status: t.status,
        prompt: t.prompt,
        style: t.style,
        resolution: t.resolution,
        duration: t.duration,
        fileSize: t.fileSize,
        aiModel: t.aiModel,
        priority: t.priority,
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt?.toISOString(),
        errorMessage: t.errorMessage,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}
