import { db } from '@/lib/db'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

// ─── GET /api/vision ───────────────────────────────────────────
// Returns vision progress + latest pending plan (if any)
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') || undefined
    const profile = await db.userProfile.findFirst({
      where: projectId ? { projectId } : { projectId: null },
    })
    if (!profile || (!profile.mission && !profile.vision)) {
      return NextResponse.json({
        hasVision: false,
        progress: 0,
        summary: 'No mission/vision set in your profile.',
        plan: null,
      })
    }

    // ─── Calculate REAL Vision Progress ─────────────────────
    // Primary: milestone-based progress (real-world metrics like $ earned, products launched).
    // Fallback: mission completion ratio.

    // Get the latest plan (needed for snapshot detection)
    const latestPlan = await db.visionPlan.findFirst({
      where: projectId ? { projectId } : { projectId: null },
      orderBy: { createdAt: 'desc' },
    })

    // Detect if mission/vision changed since the last plan was generated
    let visionChanged = false
    if (latestPlan) {
      const currentMission = (profile.mission || '').trim()
      const currentVision = (profile.vision || '').trim()
      const storedMission = (latestPlan.missionSnapshot || '').trim()
      const storedVision = (latestPlan.visionSnapshot || '').trim()
      visionChanged = currentMission !== storedMission || currentVision !== storedVision
    }

    // Calculate progress
    let finalProgress = 0
    const milestones = await db.visionMilestone.findMany({
      where: projectId ? { projectId } : { projectId: null },
      orderBy: { sortOrder: 'asc' },
    })
    
    // Find the main goal milestone
    const mainGoalMilestone = milestones.find(m => m.title === '🎯 Main Goal')
    
    if (mainGoalMilestone && mainGoalMilestone.targetValue > 0) {
      // Primary: main goal progress (this is the real vision metric)
      finalProgress = Math.round(Math.min(mainGoalMilestone.currentValue / mainGoalMilestone.targetValue, 1) * 100)
    } else if (milestones.length > 0) {
      // Fallback: average of all milestones
      let total = 0
      let validCount = 0
      for (const m of milestones) {
        if (m.targetValue > 0) {
          total += Math.min(m.currentValue / m.targetValue, 1)
          validCount++
        }
      }
      finalProgress = validCount > 0 ? Math.round((total / validCount) * 100) : 0
    } else {
      // Fallback to mission completion ratio
      const missionWhere = projectId ? { projectId } : {}
      const completedMissionWhere = projectId ? { status: 'completed', projectId } : { status: 'completed' }
      const totalMissions = await db.mission.count({ where: missionWhere })
      const completedMissions = await db.mission.count({ where: completedMissionWhere })
      finalProgress = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0
    }

    // Gather counts for summary display
    const taskWhere = projectId ? { projectId } : {}
    const completedTaskWhere = projectId ? { status: 'completed', projectId } : { status: 'completed' }
    const missionWhere2 = projectId ? { projectId } : {}
    const completedMissionWhere2 = projectId ? { status: 'completed', projectId } : { status: 'completed' }
    const totalTasks = await db.task.count({ where: taskWhere })
    const completedTasks = await db.task.count({ where: completedTaskWhere })
    const totalMissions = await db.mission.count({ where: missionWhere2 })
    const completedMissions = await db.mission.count({ where: completedMissionWhere2 })
    // AgentTasks don't have direct projectId — count via Mission relation
    let totalAgentTasks: number, completedAgentTasks: number
    if (projectId) {
      const missionIds = (await db.mission.findMany({ where: { projectId }, select: { id: true } })).map(m => m.id)
      totalAgentTasks = missionIds.length > 0 ? await db.agentTask.count({ where: { missionId: { in: missionIds } } }) : 0
      completedAgentTasks = missionIds.length > 0 ? await db.agentTask.count({ where: { missionId: { in: missionIds }, status: 'completed' } }) : 0
    } else {
      totalAgentTasks = await db.agentTask.count()
      completedAgentTasks = await db.agentTask.count({ where: { status: 'completed' } })
    }
    const reportWhere = projectId ? { projectId, report: { not: null } } : { report: { not: null } }
    const reportCount = await db.task.count({ where: reportWhere })

    // Build summary
    const summary = `Mission: ${profile.mission || 'Not set'}\nVision: ${profile.vision || 'Not set'}\n\nProgress: ${finalProgress}%\n• ${completedTasks}/${totalTasks} tasks completed\n• ${completedMissions}/${totalMissions} missions completed\n• ${completedAgentTasks}/${totalAgentTasks} agent tasks completed\n• ${reportCount} reports generated`

    return NextResponse.json({
      hasVision: true,
      progress: finalProgress,
      visionChanged,
      summary,
      profile: {
        mission: profile.mission,
        vision: profile.vision,
      },
      plan: latestPlan ? {
        id: latestPlan.id,
        content: latestPlan.content,
        progress: latestPlan.progress,
        status: latestPlan.status,
        projectId: latestPlan.projectId,
        createdAt: latestPlan.createdAt.toISOString(),
      } : null,
    })
  } catch (error) {
    console.error('Vision status error:', error)
    return NextResponse.json({ error: 'Failed to get vision status' }, { status: 500 })
  }
}

// ─── POST /api/vision ──────────────────────────────────────────
// Generate a new vision plan using AI
// Optionally accepts { modificationFeedback: "..." } to revise an existing plan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const modificationFeedback = body?.modificationFeedback?.trim() || ''
    const projectId = body?.projectId || undefined
    const profile = await db.userProfile.findFirst({
      where: projectId ? { projectId } : { projectId: null },
    })
    if (!profile || (!profile.mission && !profile.vision)) {
      return NextResponse.json({ error: 'Set your mission and vision in My Profile first.' }, { status: 400 })
    }

    // If projectId is set and no modification feedback, check for an existing plan
    const missionWhere = projectId ? { projectId } : {}
    const completedMissionWhere = projectId ? { status: 'completed', projectId } : { status: 'completed' }
    const totalMissions = await db.mission.count({ where: missionWhere })
    const completedMissions = await db.mission.count({ where: completedMissionWhere })
    const currentProgress = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0

    if (projectId && !modificationFeedback) {
      const existingPlan = await db.visionPlan.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      })
      if (existingPlan) {
        return NextResponse.json({
          success: true,
          plan: {
            id: existingPlan.id,
            content: existingPlan.content,
            progress: existingPlan.progress,
            status: existingPlan.status,
            projectId: existingPlan.projectId,
            createdAt: existingPlan.createdAt.toISOString(),
          },
          progress: currentProgress,
          existing: true,
        })
      }
    }

    // Gather stats for context
    const taskWhere = projectId ? { projectId } : {}
    const completedTaskWhere = projectId ? { status: 'completed', projectId } : { status: 'completed' }
    const pendingTaskWhere = projectId ? { status: 'pending', projectId } : { status: 'pending' }
    const inProgressTaskWhere = projectId ? { status: 'in_progress', projectId } : { status: 'in_progress' }
    const totalTasks = await db.task.count({ where: taskWhere })
    const completedTasks = await db.task.count({ where: completedTaskWhere })
    const pendingTasks = await db.task.count({ where: pendingTaskWhere })
    const inProgressTasks = await db.task.count({ where: inProgressTaskWhere })

    // Get recent completed tasks for context
    const recentTasks = await db.task.findMany({
      where: { ...completedTaskWhere },
      orderBy: { completedAt: 'desc' },
      take: 5,
      select: { title: true, report: true },
    })

    // Get the sub-agents that have been doing work
    const agents = await db.subAgent.findMany({
      where: projectId ? { projectId } : {},
      select: { name: true, role: true, totalCompleted: true },
      orderBy: { totalCompleted: 'desc' },
    })

    // Get recent learnings
    const learnings = await db.agentLearning.findMany({
      where: { ...(projectId ? { projectId } : {}), confidence: { gte: 0.5 } },
      orderBy: { appliedCount: 'desc' },
      take: 3,
      select: { insight: true, category: true },
    })

    // Build context for the AI
    const context = {
      mission: profile.mission,
      vision: profile.vision,
      stats: {
        totalTasks,
        completedTasks,
        totalMissions,
        completedMissions,
        pendingTasks,
        inProgressTasks,
      },
      recentCompletedTasks: recentTasks.map(t => ({ title: t.title, report: t.report?.slice(0, 200) || null })),
      agents: agents.map(a => ({ name: a.name, role: a.role, tasksCompleted: a.totalCompleted })),
      learnings: learnings.map(l => ({ insight: l.insight, category: l.category })),
    }

    // Call AI to generate the plan
    const baseURL = process.env.HERMES_GATEWAY_URL || 'http://localhost:8642/v1'
    const apiKey = process.env.HERMES_GATEWAY_TOKEN || 'gateway'

    const lmProvider = createOpenAICompatible({
      name: 'hermes-gateway',
      baseURL,
      apiKey,
    })

    const systemPrompt = `You are LIMURA, a strategic AI agent. Your user has a mission and vision. Your job is to analyze their progress and create a concrete, actionable plan for their next steps.

Generate a vision roadmap as markdown with these sections:
1. **Vision Progress** — current status (${currentProgress}% complete based on task completion)
2. **Recent Wins** — what's been accomplished (based on completed tasks)
3. **Next Steps** — 3-5 concrete actions to move closer to the vision, ordered by priority
4. **Working Plan** — a step-by-step execution plan for the highest-priority next step

Be specific, practical, and actionable. Focus on what will actually move the needle toward the vision.
Sign the plan as "— LIMURA" at the end.`

    const userPrompt = `Here is the current state of affairs:

MISSION: ${context.mission}
VISION: ${context.vision}

STATS:
- Tasks: ${context.stats.completedTasks}/${context.stats.totalTasks} completed
- Missions: ${context.stats.completedMissions}/${context.stats.totalMissions} completed
- Pending: ${context.stats.pendingTasks} | In Progress: ${context.stats.inProgressTasks}

RECENT COMPLETED TASKS:
${context.recentCompletedTasks.map(t => `- ${t.title}${t.report ? ': ' + t.report.slice(0, 150) : ''}`).join('\n')}

ACTIVE AGENTS:
${context.agents.map(a => `- ${a.name} (${a.role}): ${a.tasksCompleted} tasks`).join('\n')}

RECENT LEARNINGS:
${context.learnings.map(l => `- [${l.category}] ${l.insight}`).join('\n')}

${modificationFeedback ? `\nUSER FEEDBACK ON PREVIOUS PLAN (incorporate this into the new plan):\n${modificationFeedback}\n` : ''}
Based on all this, generate a vision roadmap with clear next steps and a working plan.`

    const result = await generateText({
      model: lmProvider('hermes-agent'),
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const planContent = result.text

    // Save the plan to DB with mission/vision snapshots
    const plan = await db.visionPlan.create({
      data: {
        content: planContent,
        progress: currentProgress / 100,
        status: 'pending',
        missionSnapshot: profile.mission,
        visionSnapshot: profile.vision,
        ...(projectId ? { projectId } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      plan: {
        id: plan.id,
        content: plan.content,
        progress: plan.progress,
        status: plan.status,
        projectId: plan.projectId,
        createdAt: plan.createdAt.toISOString(),
      },
      progress: currentProgress,
    })
  } catch (error: any) {
    console.error('Vision plan generation error:', error?.message || error)
    return NextResponse.json({ error: `Failed to generate plan: ${error?.message || 'Unknown error'}` }, { status: 500 })
  }
}

// ─── PUT /api/vision ───────────────────────────────────────────
// Update plan status (approve/reject) OR edit plan content
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { planId, status, content } = body
    const projectId = body?.projectId || request.nextUrl.searchParams.get('projectId') || undefined

    if (!planId) {
      return NextResponse.json({ error: 'planId required' }, { status: 400 })
    }

    // Build update data dynamically
    const updateData: any = {}

    if (status) {
      if (!['approved', 'rejected', 'in_progress', 'completed'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updateData.status = status
    }

    if (content !== undefined) {
      if (typeof content !== 'string') {
        return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
      }
      updateData.content = content
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update (provide status or content)' }, { status: 400 })
    }

    // Optionally verify projectId scoping before updating
    if (projectId) {
      const existing = await db.visionPlan.findUnique({ where: { id: planId } })
      if (!existing) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      }
      if (existing.projectId !== projectId) {
        return NextResponse.json({ error: 'Plan does not belong to the specified project' }, { status: 403 })
      }
    }

    const plan = await db.visionPlan.update({
      where: { id: planId },
      data: updateData,
    })

    // ── APPROVAL GATE: flip pending_approval tasks/missions to pending ──
    if (status === 'approved') {
      const taskWhere = projectId
        ? { projectId, status: 'pending_approval' }
        : { status: 'pending_approval' }
      const missionWhere = projectId
        ? { projectId, status: 'pending_approval' }
        : { status: 'pending_approval' }

      const [updatedTasks, updatedMissions] = await Promise.all([
        db.task.updateMany({ where: taskWhere, data: { status: 'pending' } }),
        db.mission.updateMany({ where: missionWhere, data: { status: 'pending' } }),
      ])

      console.log(
        `Approval gate: unblocked ${updatedTasks.count} task(s) and ${updatedMissions.count} mission(s)`,
      )
    }

    return NextResponse.json({
      success: true,
      plan: {
        id: plan.id,
        content: plan.content,
        progress: plan.progress,
        status: plan.status,
        projectId: plan.projectId,
        createdAt: plan.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Vision plan update error:', error)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}
