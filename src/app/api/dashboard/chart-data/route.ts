import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const range = parseInt(searchParams.get('range') || '14')
    const projectId = searchParams.get('projectId') || undefined

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - range)

    const where: Record<string, unknown> = {
      date: { gte: cutoff.toISOString().split('T')[0] },
    }
    if (projectId) where.projectId = projectId

    const stats = await db.dailyStat.findMany({
      where,
      orderBy: { date: 'asc' },
    })

    const chartData: Record<string, {
      date: string
      total: number
      completed: number
      failed: number
      avgTime: number
    }> = {}

    for (const s of stats) {
      if (!chartData[s.date]) {
        chartData[s.date] = { date: s.date, total: 0, completed: 0, failed: 0, avgTime: 0 }
      }
      chartData[s.date].total += s.total
      chartData[s.date].completed += s.completed
      chartData[s.date].failed += s.failed
      chartData[s.date].avgTime = s.avgTime || 0
    }

    return NextResponse.json(Object.values(chartData))
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 })
  }
}
