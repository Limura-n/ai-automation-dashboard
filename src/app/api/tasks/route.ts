import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { ensureTaskFolder, getTaskFolder } from '@/lib/task-folder'
import fs from 'fs'
import path from 'path'

// ─── GET /api/tasks ─────────────────────────────────────────
// List tasks with optional filters: status, category, priority, page, limit
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const category = searchParams.get('category') || undefined
    const priority = searchParams.get('priority') || undefined
    const projectId = searchParams.get('projectId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (category) where.category = category
    if (priority) where.priority = priority
    if (projectId) where.projectId = projectId

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          missions: {
            select: {
              id: true,
              status: true,
              title: true,
            },
          },
          attachments: {
            select: { id: true, filename: true, filepath: true, mimetype: true, size: true, createdAt: true },
          },
        },
      }),
      db.task.count({ where }),
    ])

    return NextResponse.json({
      tasks: tasks.map(t => {
        const folderPath = getTaskFolder(t.id, t.title)
        return {
          id: t.id,
          title: t.title,
          description: t.description,
          report: t.report,
          status: t.status,
          priority: t.priority,
          schedule: t.schedule,
          cronJobId: t.cronJobId,
          category: t.category,
          folderPath,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          completedAt: t.completedAt?.toISOString() ?? null,
          missionCount: t.missions.length,
          completedMissions: t.missions.filter(m => m.status === 'completed').length,
          attachments: t.attachments.map(a => ({
            id: a.id,
            filename: a.filename,
            filepath: a.filepath,
            mimetype: a.mimetype,
            size: a.size,
            createdAt: a.createdAt.toISOString(),
          })),
        }
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// ─── Schedule Validation ─────────────────────────────────────
function isValidSchedule(schedule: string): boolean {
  // Date range JSON format: {"sd":"...","ed":"...","st":"...","et":"..."}
  try {
    const parsed = JSON.parse(schedule)
    if (parsed && typeof parsed === 'object' && 'sd' in parsed && 'ed' in parsed) {
      return true
    }
  } catch {
    // Not JSON — check if it's a valid cron expression
  }
  // Fallback: 5-field cron expression
  const parts = schedule.trim().split(/\s+/)
  return parts.length === 5
}

// ─── POST /api/tasks ────────────────────────────────────────
// Create a new task. Schedule is stored as a cron expression string.
// The orchestrator handles actual cron job creation for recurring tasks.
// Optionally accepts attachments: array of { name, path, size, savedAs }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, schedule, priority, category, projectId, attachments } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Validate schedule format
    if (schedule) {
      if (!isValidSchedule(schedule)) {
        return NextResponse.json(
          { error: 'Schedule must be a valid 5-field cron expression or a date range JSON.' },
          { status: 400 }
        )
      }
    }

    // Determine initial status
    const initialStatus = schedule ? 'scheduled' : 'pending'

    // Validate priority
    const validPriorities = ['normal', 'high', 'urgent']
    const finalPriority = priority && validPriorities.includes(priority) ? priority : 'normal'

    const task = await db.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        status: initialStatus,
        priority: finalPriority,
        schedule: schedule?.trim() || null,
        category: category?.trim() || null,
        projectId: projectId || null,
        // Create attachment records if provided
        ...(Array.isArray(attachments) && attachments.length > 0
          ? {
              attachments: {
                create: attachments.map((a: { name: string; path: string; size?: number; mimetype?: string }) => ({
                  filename: a.name,
                  filepath: a.path,
                  size: a.size || 0,
                  mimetype: a.mimetype || null,
                })),
              },
            }
          : {}),
      },
      include: {
        attachments: {
          select: { id: true, filename: true, filepath: true, mimetype: true, size: true, createdAt: true },
        },
      },
    })

    // Create dedicated folder on disk for this task's files
    const folderPath = ensureTaskFolder(task.id, task.title)

    // Move any uploaded files from staging into the task folder
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att.path && fs.existsSync(att.path)) {
          try {
            const fileName = path.basename(att.path)
            const destPath = path.join(folderPath, fileName)
            // Only move if not already in the task folder
            if (!att.path.startsWith(folderPath)) {
              fs.renameSync(att.path, destPath)
              // Update the attachment record with the new path
              // This is done asynchronously to not block the response
              db.attachment.updateMany({
                where: { taskId: task.id, filepath: att.path },
                data: { filepath: destPath },
              }).catch(e => console.error('Failed to update attachment path:', e))
            }
          } catch (e) {
            console.error('Failed to move file:', att.path, e)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        schedule: task.schedule,
        category: task.category,
        folderPath,
        attachments: task.attachments.map(a => ({
          id: a.id,
          filename: a.filename,
          filepath: a.filepath,
          mimetype: a.mimetype,
          size: a.size,
          createdAt: a.createdAt.toISOString(),
        })),
        createdAt: task.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

// ─── PUT /api/tasks?id=X ────────────────────────────────────
// Update a task — any field: title, description, status, priority, schedule, category
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const taskId = searchParams.get('id')
    if (!taskId) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

    const body = await request.json()
    const { title, description, report, status, priority, schedule, category, projectId } = body

    // Ownership verification: if the task has a projectId, the request must match
    const existing = await db.task.findUnique({ where: { id: taskId }, select: { projectId: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    const reqProjectId = projectId || undefined
    if (existing.projectId && reqProjectId && existing.projectId !== reqProjectId) {
      return NextResponse.json({ error: 'Task does not belong to the specified project' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}

    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description.trim() || null
    if (report !== undefined) updateData.report = report.trim() || null
    if (priority !== undefined) {
      const validPriorities = ['normal', 'high', 'urgent']
      if (validPriorities.includes(priority)) updateData.priority = priority
    }
    if (category !== undefined) updateData.category = category.trim() || null

    // Schedule update — validate cron format
    if (schedule !== undefined) {
      if (schedule === null || schedule === '') {
        updateData.schedule = null
      } else {
        if (!isValidSchedule(schedule)) {
          return NextResponse.json(
            { error: 'Schedule must be a valid 5-field cron expression or a date range JSON.' },
            { status: 400 }
          )
        }
        updateData.schedule = schedule.trim()
      }
    }

    // Status transitions
    if (status !== undefined) {
      const validStatuses = ['pending', 'scheduled', 'in_progress', 'completed', 'failed', 'paused']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
      }
      updateData.status = status

      if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date()
      }
      if (status === 'pending' || status === 'scheduled') {
        updateData.completedAt = null
      }
    }

    const updated = await db.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        missions: {
          select: { id: true, status: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      task: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        status: updated.status,
        priority: updated.priority,
        schedule: updated.schedule,
        cronJobId: updated.cronJobId,
        category: updated.category,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        completedAt: updated.completedAt?.toISOString() ?? null,
        missionCount: updated.missions.length,
        completedMissions: updated.missions.filter(m => m.status === 'completed').length,
      },
    })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

// ─── DELETE /api/tasks?id=X ──────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const taskId = searchParams.get('id')
    const projectId = searchParams.get('projectId') || undefined
    if (!taskId) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

    // Ownership verification
    const existing = await db.task.findUnique({ where: { id: taskId }, select: { projectId: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    if (existing.projectId && projectId && existing.projectId !== projectId) {
      return NextResponse.json({ error: 'Task does not belong to the specified project' }, { status: 403 })
    }

    // Note: Missions linked to this task will have taskId set to null (onDelete: SetNull)
    // The missions themselves are NOT deleted — they become standalone
    await db.task.delete({ where: { id: taskId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
