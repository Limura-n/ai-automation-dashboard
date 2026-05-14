import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, action } = body

    if (action === 'process') {
      let targetTask

      if (taskId) {
        targetTask = await db.agentTask.findUnique({ where: { id: taskId } })
        if (!targetTask) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }
      } else {
        targetTask = await db.agentTask.findFirst({
          where: { status: 'pending' },
          orderBy: { createdAt: 'asc' },
        })

        if (!targetTask) {
          return NextResponse.json({ hasMore: false, message: 'No pending tasks' })
        }
      }

      if (targetTask.status !== 'pending') {
        return NextResponse.json({ hasMore: false, message: 'Task already processing or completed' })
      }

      await db.agentTask.update({
        where: { id: targetTask.id },
        data: { status: 'processing' },
      })

      return NextResponse.json({
        success: true,
        task: {
          id: targetTask.id,
          task: targetTask.task,
          status: 'processing',
          createdAt: targetTask.createdAt.toISOString(),
        },
      })
    }

    if (action === 'complete') {
      if (!taskId) {
        return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
      }

      const { result, error } = await request.json()

      await db.agentTask.update({
        where: { id: taskId },
        data: {
          status: error ? 'failed' : 'completed',
          result: result || null,
          error: error || null,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing task:', error)
    return NextResponse.json({ error: 'Failed to process task' }, { status: 500 })
  }
}