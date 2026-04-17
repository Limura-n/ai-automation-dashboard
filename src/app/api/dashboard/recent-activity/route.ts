import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')

    const tasks = await db.generationTask.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    const activity = tasks.map(t => {
      let action = ''
      switch (t.status) {
        case 'completed': action = 'completed'; break
        case 'processing': action = 'started processing'; break
        case 'queued': action = 'was queued'; break
        case 'failed': action = `failed: ${t.errorMessage || 'Unknown error'}`; break
      }

      return {
        id: t.id,
        type: t.type,
        action,
        status: t.status,
        prompt: t.prompt,
        style: t.style,
        aiModel: t.aiModel,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        completedAt: t.completedAt?.toISOString(),
      }
    })

    return NextResponse.json(activity)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
