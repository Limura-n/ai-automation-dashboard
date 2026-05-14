import { db } from '@/lib/db'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

// ─── POST /api/vision/decompose ────────────────────────────────
// Two-phase: Research solutions → Decompose into missions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const projectId = body?.projectId || request.nextUrl.searchParams.get('projectId') || undefined

    const profile = await db.userProfile.findFirst({
      where: projectId ? { projectId } : { projectId: null },
    })
    if (!profile || !profile.vision) {
      return NextResponse.json({ error: 'Set your vision in My Profile first.' }, { status: 400 })
    }

    const mission = profile.mission || 'Build something meaningful'
    const vision = profile.vision

    // Gather rich context
    const missionWhere = projectId ? { projectId } : {}
    const completedMissionWhere = projectId ? { status: 'completed', projectId } : { status: 'completed' }
    const taskWhere = projectId ? { projectId } : {}
    const completedTaskWhere = projectId ? { status: 'completed', projectId } : { status: 'completed' }
    const completedMissions = await db.mission.count({ where: completedMissionWhere })
    const pendingMissions = await db.mission.count({ where: { ...missionWhere, status: 'pending' } })
    const totalTasks = await db.task.count({ where: taskWhere })
    const completedTasks = await db.task.count({ where: completedTaskWhere })

    // Get completed missions for context
    const recentDone = await db.mission.findMany({
      where: { ...completedMissionWhere },
      orderBy: { completedAt: 'desc' },
      take: 5,
      select: { title: true, summary: true },
    })

    // Get agent capabilities
    const agents = await db.subAgent.findMany({
      select: { name: true, role: true, skills: true, totalCompleted: true },
      orderBy: { totalCompleted: 'desc' },
    })

    // Get high-confidence learnings
    const learnings = await db.agentLearning.findMany({
      where: { confidence: { gte: 0.6 } },
      orderBy: { appliedCount: 'desc' },
      take: 5,
      select: { insight: true, category: true },
    })

    const baseURL = process.env.HERMES_GATEWAY_URL || 'http://localhost:8642/v1'
    const apiKey = process.env.HERMES_GATEWAY_TOKEN || 'gateway'

    const lmProvider = createOpenAICompatible({
      name: 'hermes-gateway',
      baseURL,
      apiKey,
    })

    // ── PHASE 1: RESEARCH ─────────────────────────────────────
    // AI researches solutions, strategies, and approaches for the vision
    const researchPrompt = `You are LIMURA, a strategic business and product researcher.

Given a user's mission and vision, research and analyze:
1. What real-world solutions, products, or business models exist that align with this vision
2. What strategies have worked for others pursuing similar goals
3. What market opportunities and gaps are relevant
4. What skills and tools are needed
5. What a realistic step-by-step path looks like

Be specific, practical, and reference real approaches (SaaS models, automation patterns, digital product strategies, etc.).

User's Mission: ${mission}
User's Vision: ${vision}

Completed so far: ${completedMissions} missions, ${completedTasks} tasks
Pending: ${pendingMissions} missions

Existing capabilities:
${agents.map(a => `- ${a.name} (${a.role}): ${a.skills || 'No skills listed'} — ${a.totalCompleted} tasks done`).join('\n')}

What they've learned:
${learnings.map(l => `- [${l.category}] ${l.insight}`).join('\n')}

Provide a thorough solution research analysis. Focus on practical, actionable approaches.`

    const researchResult = await generateText({
      model: lmProvider('hermes-agent'),
      messages: [{ role: 'user', content: researchPrompt }],
      system: 'You are LIMURA, a strategic researcher. Research solutions and strategies for achieving the user\'s vision. Be thorough and practical.',
    })

    const research = researchResult.text

    // ── PHASE 2: DECOMPOSE ────────────────────────────────────
    // Based on research, generate concrete missions
    const decomposePrompt = `You are LIMURA, a strategic project planner.

Based on the solution research below, decompose the user's vision into concrete, actionable missions.

Each mission must be:
- A specific, achievable work unit (hours or days, not weeks)
- Self-contained with a clear deliverable
- Ordered by dependency (what must happen first)
- Grounded in the research findings
- Assignable to one of the existing agents or a clear specialist role

Return ONLY a JSON array. No markdown, no explanation, no code blocks.

Format:
[
  {
    "title": "Short actionable mission title",
    "description": "Detailed description including what to build, research, or create. Reference specific research findings."
  }
]

Generate 3-6 missions that form a complete path from where the user is now to achieving their vision.
Mission 1 should be the immediate next step — something doable this week.
The last mission should be a major milestone toward the vision.

SOLUTION RESEARCH:
${research}

USER'S MISSION: ${mission}
USER'S VISION: ${vision}`

    const result = await generateText({
      model: lmProvider('hermes-agent'),
      messages: [{ role: 'user', content: decomposePrompt }],
      system: 'You are LIMURA, a project planner. Decompose the vision into concrete missions based on the research. Return ONLY valid JSON.',
    })

    // Parse JSON response
    const text = result.text.trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const jsonStr = jsonMatch ? jsonMatch[0] : text
    let missions: { title: string; description: string }[]
    try {
      missions = JSON.parse(jsonStr)
    } catch {
      const cleaned = jsonStr.replace(/```json|```/g, '').trim()
      missions = JSON.parse(cleaned)
    }

    if (!Array.isArray(missions) || missions.length === 0) {
      return NextResponse.json({ error: 'Failed to parse missions from AI response' }, { status: 500 })
    }

    // ── STEP 1: Create parent Task ──────────────────────────
    const taskTitle = missions.length > 0
      ? `Vision: ${mission.slice(0, 60)}`
      : 'Vision Decomposition'
    const parentTask = await db.task.create({
      data: {
        title: taskTitle,
        description: `Auto-generated from vision decomposition — ${missions.length} missions`,
        status: 'pending',
        category: 'vision',
        ...(projectId ? { projectId } : {}),
      },
    })

    // ── STEP 2: Save each mission linked to the parent Task ─
    const createdMissions = []
    for (const m of missions) {
      const created = await db.mission.create({
        data: {
          title: m.title.trim(),
          description: m.description.trim(),
          status: 'pending',
          taskId: parentTask.id,
          ...(projectId ? { projectId } : {}),
        },
      })
      createdMissions.push({
        id: created.id,
        title: created.title,
        description: created.description,
        status: created.status,
        taskId: created.taskId,
      })
    }

    return NextResponse.json({
      success: true,
      count: createdMissions.length,
      missions: createdMissions,
      task: {
        id: parentTask.id,
        title: parentTask.title,
        status: parentTask.status,
        missionCount: createdMissions.length,
      },
      message: `Created task "${parentTask.title}" with ${createdMissions.length} missions. The orchestrator will process them.`,
    })
  } catch (error: any) {
    console.error('Vision decompose error:', error?.message || error)
    return NextResponse.json({ error: `Failed to decompose vision: ${error?.message || 'Unknown error'}` }, { status: 500 })
  }
}
