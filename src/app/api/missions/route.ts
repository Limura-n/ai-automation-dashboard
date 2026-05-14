import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ─── Helpers ──────────────────────────────────────────────────

/** Auto-calculate progress for a mission based on its type */
function calcProgress(mission: {
  type: string
  taskCount?: number
  completedTasks?: number
  childCount?: number
  completedChildren?: number
}): number {
  if (mission.type === 'phase') {
    // Phase progress = completed child sprints / total child sprints
    const total = mission.childCount || 0
    const done = mission.completedChildren || 0
    return total > 0 ? Math.round((done / total) * 100) / 100 : 0
  }
  // Sprint or legacy mission: progress = completed AgentTasks / total AgentTasks
  const total = mission.taskCount || 0
  const done = mission.completedTasks || 0
  return total > 0 ? Math.round((done / total) * 100) / 100 : 0
}

/** Recursively count completed children (for phases with nested structure) */
async function countChildProgress(missionId: string): Promise<{ total: number; completed: number }> {
  const children = await db.mission.findMany({
    where: { parentMissionId: missionId },
    select: { id: true, status: true },
  })
  const total = children.length
  const completed = children.filter(c => c.status === 'completed').length
  return { total, completed }
}

async function getChildCounts(missionId: string) {
  const children = await db.mission.findMany({
    where: { parentMissionId: missionId },
    select: { id: true, status: true },
  })
  return {
    childCount: children.length,
    completedChildren: children.filter(c => c.status === 'completed').length,
  }
}

const MISSION_INCLUDE = {
  tasks: {
    select: { id: true, status: true, task: true, agentId: true },
  },
  childMissions: {
    select: { id: true, status: true, title: true, sortOrder: true, progress: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  parentMission: {
    select: { id: true, title: true, type: true, status: true },
  },
}

function formatMission(m: any) {
  const childCounts = m.childMissions
    ? { childCount: m.childMissions.length, completedChildren: m.childMissions.filter((c: any) => c.status === 'completed').length }
    : { childCount: 0, completedChildren: 0 }

  const taskCount = m.tasks?.length || 0
  const completedTasks = m.tasks?.filter((t: any) => t.status === 'completed').length || 0

  return {
    id: m.id,
    title: m.title,
    description: m.description,
    type: m.type,
    status: m.status,
    sortOrder: m.sortOrder,
    progress: m.progress ?? calcProgress({
      type: m.type,
      taskCount,
      completedTasks,
      ...childCounts,
    }),
    blockedReason: m.blockedReason,
    summary: m.summary,
    taskId: m.taskId,
    parentMissionId: m.parentMissionId,
    createdAt: m.createdAt.toISOString(),
    completedAt: m.completedAt?.toISOString(),
    // Progress tracking
    taskCount,
    completedTasks,
    childCount: childCounts.childCount,
    completedChildren: childCounts.completedChildren,
    // Related objects
    childMissions: m.childMissions?.map((cm: any) => ({
      id: cm.id,
      title: cm.title,
      status: cm.status,
      sortOrder: cm.sortOrder,
      progress: cm.progress,
    })) || [],
    parentMission: m.parentMission || null,
  }
}

// ─── GET ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined
    const parentId = searchParams.get('parentId') || undefined
    const taskId = searchParams.get('taskId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type
    if (parentId) where.parentMissionId = parentId
    if (parentId === 'null') where.parentMissionId = null
    if (taskId) where.taskId = taskId
    const projectId = searchParams.get('projectId')
    if (projectId) where.projectId = projectId

    const [missions, total] = await Promise.all([
      db.mission.findMany({
        where,
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: MISSION_INCLUDE,
      }),
      db.mission.count({ where }),
    ])

    return NextResponse.json({
      missions: missions.map(formatMission),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching missions:', error)
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, type, parentMissionId, sortOrder, taskId, projectId } = body

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
    }

    // Validate type
    const missionType = type || 'mission'
    if (!['phase', 'sprint', 'mission'].includes(missionType)) {
      return NextResponse.json({ error: 'Invalid type. Must be: phase, sprint, or mission' }, { status: 400 })
    }

    // If parentMissionId is set, validate parent exists
    if (parentMissionId) {
      const parent = await db.mission.findUnique({ where: { id: parentMissionId } })
      if (!parent) {
        return NextResponse.json({ error: 'Parent mission not found' }, { status: 404 })
      }
    }

    // Auto-assign sortOrder if not provided (next in sequence under same parent)
    let order = sortOrder ?? 0
    if (order === 0 && parentMissionId) {
      const lastSibling = await db.mission.findFirst({
        where: { parentMissionId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      order = (lastSibling?.sortOrder ?? 0) + 1
    }

    const mission = await db.mission.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        type: missionType,
        status: 'pending',
        parentMissionId: parentMissionId || null,
        sortOrder: order,
        taskId: taskId || null,
        projectId: projectId || null,
      },
      include: MISSION_INCLUDE,
    })

    // Update parent phase's progress if this is a sprint
    if (parentMissionId) {
      const childCounts = await getChildCounts(parentMissionId)
      const parentProgress = calcProgress({
        type: 'phase',
        childCount: childCounts.childCount,
        completedChildren: childCounts.completedChildren,
      })
      await db.mission.update({
        where: { id: parentMissionId },
        data: { progress: parentProgress },
      })
    }

    return NextResponse.json({
      success: true,
      mission: formatMission(mission),
    })
  } catch (error) {
    console.error('Error creating mission:', error)
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 })
  }
}

// ─── PUT ──────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const missionId = searchParams.get('id')
    if (!missionId) return NextResponse.json({ error: 'Mission ID required' }, { status: 400 })

    const body = await request.json()
    const { status, summary, title, description, type, sortOrder, progress, blockedReason, parentMissionId, projectId } = body

    // Project ownership validation
    // Rule: if the resource has a projectId and the request specifies one, they MUST match.
    // Requests without projectId can only modify global (null-projectId) resources.
    const existingMission = await db.mission.findUnique({ where: { id: missionId }, select: { projectId: true } })
    if (!existingMission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 })
    }
    const reqProjectId = projectId || searchParams.get('projectId') || undefined
    // Bypass only when: existing is global (null) OR request is global (undefined) OR they match
    const isCrossProject = existingMission.projectId != null && reqProjectId != null && existingMission.projectId !== reqProjectId
    if (isCrossProject) {
      return NextResponse.json({ error: 'Mission does not belong to the specified project' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (summary !== undefined) updateData.summary = summary
    if (title) updateData.title = title
    if (description) updateData.description = description
    if (type) updateData.type = type
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (progress !== undefined) updateData.progress = progress
    if (blockedReason !== undefined) updateData.blockedReason = blockedReason
    if (parentMissionId !== undefined) updateData.parentMissionId = parentMissionId || null

    // Status change timestamps
    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date()
    }
    // Clear completedAt and summary when restarting
    if (status === 'pending') {
      updateData.completedAt = null
      updateData.summary = null
      updateData.blockedReason = null
    }
    // Set blockedReason safety
    if (status === 'blocked' && !blockedReason) {
      updateData.blockedReason = 'Blocked — no reason provided'
    }

    const updated = await db.mission.update({
      where: { id: missionId },
      data: updateData,
      include: MISSION_INCLUDE,
    })

    // Auto-update parent phase progress when a child sprint changes status
    if (updated.parentMissionId) {
      const childCounts = await getChildCounts(updated.parentMissionId)
      const parentProgress = calcProgress({
        type: 'phase',
        childCount: childCounts.childCount,
        completedChildren: childCounts.completedChildren,
      })
      await db.mission.update({
        where: { id: updated.parentMissionId },
        data: { progress: parentProgress },
      })

      // Check if phase should auto-complete
      if (childCounts.childCount > 0 && childCounts.completedChildren === childCounts.childCount) {
        await db.mission.update({
          where: { id: updated.parentMissionId },
          data: { status: 'completed', completedAt: new Date(), progress: 1.0 },
        })
      }
    }

    return NextResponse.json({ success: true, mission: formatMission(updated) })
  } catch (error) {
    console.error('Error updating mission:', error)
    return NextResponse.json({ error: 'Failed to update mission' }, { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const missionId = searchParams.get('id')
    if (!missionId) return NextResponse.json({ error: 'Mission ID required' }, { status: 400 })

    // Safety: check if this mission has active child missions
    const mission = await db.mission.findUnique({
      where: { id: missionId },
      include: { childMissions: { select: { id: true, status: true } } },
    })

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 })
    }

    // Project ownership validation
    // Same rule as PUT: cross-project deletion is forbidden
    const reqProjectId = searchParams.get('projectId') || undefined
    const isCrossProject = mission.projectId != null && reqProjectId != null && mission.projectId !== reqProjectId
    if (isCrossProject) {
      return NextResponse.json({ error: 'Mission does not belong to the specified project' }, { status: 403 })
    }

    // Prevent deletion of phases with active (non-completed, non-failed) children
    const activeChildren = mission.childMissions.filter(
      c => !['completed', 'failed', 'cancelled'].includes(c.status)
    )
    if (activeChildren.length > 0) {
      return NextResponse.json({
        error: `Cannot delete: ${activeChildren.length} active child mission(s) still in progress. Complete or cancel them first.`,
      }, { status: 409 })
    }

    await db.mission.delete({ where: { id: missionId } })

    // Refresh parent progress if this was a child mission
    if (mission.parentMissionId) {
      const childCounts = await getChildCounts(mission.parentMissionId)
      const parentProgress = calcProgress({
        type: 'phase',
        childCount: childCounts.childCount,
        completedChildren: childCounts.completedChildren,
      })
      await db.mission.update({
        where: { id: mission.parentMissionId },
        data: { progress: parentProgress },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting mission:', error)
    return NextResponse.json({ error: 'Failed to delete mission' }, { status: 500 })
  }
}
