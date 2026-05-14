import { db } from '@/lib/db'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

// ─── In-memory status tracker for generation state ─────────────
// Works per-server-instance (Next.js dev server = single process = fine)
// Key: projectId (or 'global' for no-project), Value: { status, stage, startTime, error? }
const generationStatus = new Map<string, { status: string; stage: string; startTime: number; error?: string }>()

const TIMEOUT_MS = 12 * 60 * 1000 // 12 minutes (longer than maxDuration to be safe)

// ─── GET /api/vision/blueprint ────────────────────────────────
// Returns current generation status so the frontend can poll
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId') || 'global'
  const entry = generationStatus.get(projectId)

  if (!entry) {
    // No generation in progress — check if there's a recent completed plan
    const latestPlan = await db.visionPlan.findFirst({
      where: projectId !== 'global' ? { projectId } : { projectId: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    })
    // Treat a plan created in the last 15 min as "just done" so polling catches it
    if (latestPlan && (Date.now() - latestPlan.createdAt.getTime()) < 15 * 60 * 1000) {
      return NextResponse.json({ status: 'done', stage: 'saved', planId: latestPlan.id })
    }
    return NextResponse.json({ status: 'idle', stage: '' })
  }

  // Check for stale entries (crashed/stuck generation)
  if (entry.status !== 'done' && entry.status !== 'failed' && (Date.now() - entry.startTime) > TIMEOUT_MS) {
    entry.status = 'failed'
    entry.error = 'Generation timed out'
  }

  return NextResponse.json({ status: entry.status, stage: entry.stage, error: entry.error })
}

// ─── Helper to update status from within POST ────────────────
function setStatus(projectId: string, status: string, stage: string, error?: string) {
  const key = projectId || 'global'
  generationStatus.set(key, { status, stage, startTime: Date.now(), error })
}

// ─── POST /api/vision/blueprint ──────────────────────────────
// Synchronous generation — use maxDuration=300 for long AI calls.
// Frontend uses keepalive fetch so navigating away doesn't cancel it.
// Results are persisted to DB regardless of whether frontend waits.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const projectId = body?.projectId || request.nextUrl.searchParams.get('projectId') || undefined

    const profile = await db.userProfile.findFirst({
      where: projectId ? { projectId } : { projectId: null },
    })
    if (!profile || !profile.vision) {
      return NextResponse.json({ error: 'Set your vision in Project Settings first.' }, { status: 400 })
    }

    setStatus(projectId || '', 'generating', 'initializing')

    const mission = profile.mission || 'Build something meaningful'
    const vision = profile.vision
    const mainGoal = profile.mainGoal || ''

    const missionWhere = projectId ? { projectId } : {}
    const completedMissions = await db.mission.count({
      where: projectId ? { status: 'completed', projectId } : { status: 'completed' },
    })
    const completedTasks = await db.task.count({
      where: projectId ? { status: 'completed', projectId } : { status: 'completed' },
    })
    const agents = await db.subAgent.findMany({
      select: { name: true, role: true, skills: true, totalCompleted: true, model: true },
      orderBy: { totalCompleted: 'desc' },
    })

    const baseURL = process.env.HERMES_GATEWAY_URL || 'http://localhost:8642/v1'
    const apiKey = process.env.HERMES_GATEWAY_TOKEN || 'gateway'
    const lmProvider = createOpenAICompatible({ name: 'hermes-gateway', baseURL, apiKey })

    // ── PHASE 1: RESEARCH ────────────────────────────────────
    setStatus(projectId || '', 'generating', 'researching')
    const researchPrompt = `You are a business strategist and market researcher. You are planning a real business. Use your knowledge of real-world markets, pricing, competitors, and strategies.

Given the user's profile, research and analyze what a realistic path to their vision looks like.

USER MISSION: ${mission}
USER VISION: ${vision}
MAIN GOAL: ${mainGoal}
Completed so far: ${completedTasks} tasks, ${completedMissions} missions
Available agents: ${agents.map(a => `- ${a.name} (${a.role}): ${a.skills || 'generalist'} [${a.model}]`).join('\n')}

Research these dimensions:
1. MARKET ANALYSIS — What's the market size, trend, and opportunity for this type of business?
2. COMPETITIVE LANDSCAPE — Who are the main players? What are their strategies and gaps?
3. REVENUE MODEL — What realistic monetization strategies work here? (pricing, subscription, marketplace, etc.)
4. TECHNICAL REQUIREMENTS — What tech stack, platforms, and tools are industry standard?
5. GO-TO-MARKET STRATEGY — How do successful businesses in this space acquire customers?
6. KEY RISKS & MITIGATIONS — What typically fails and how to avoid it?

Be specific with numbers, platforms, pricing models. Reference real companies and strategies.
Flag any claims that need web verification with [VERIFY: ...] markers.`

    const researchResult = await generateText({
      model: lmProvider('hermes-agent'),
      messages: [{ role: 'user', content: researchPrompt }],
      system: 'You are a senior business strategist with deep domain expertise. Be specific, cite real data, flag assumptions.',
    })
    const research = researchResult.text

    // ── PHASE 2: BLUEPRINT ────────────────────────────────────
    setStatus(projectId || '', 'generating', 'planning')
    const blueprintPrompt = `You are a strategic project planner. Based on the research below, create a SEQUENTIAL multi-task blueprint to execute the user's vision.

Each task must be a major work block with a clear deliverable. Tasks are SEQUENTIAL — Task 2 cannot start until Task 1 is complete.

Return ONLY a JSON object with this structure:
{
  "tasks": [
    {
      "title": "Task title (actionable, specific)",
      "description": "What this task accomplishes and why it's needed now",
      "category": "setup|product|marketing|growth|operations|research",
      "priority": "urgent|high|normal",
      "dependsOnTaskIndex": null,
      "estimatedMissions": 3,
      "missions": [
        {
          "title": "Mission title",
          "description": "Specific work to do — hours/days scope",
          "recommendedAgentRole": "Researcher|Developer|Designer|Marketer|Analyst",
          "deliverable": "What tangible output this mission produces"
        }
      ]
    }
  ],
  "blueprintSummary": "One paragraph summary of the overall strategy",
  "totalEstimatedWeeks": 4
}

GUIDELINES:
- 4-7 tasks total, ordered by dependency
- Each task has 2-5 missions
- First task: setup/foundation (what's needed before anything else)
- Middle tasks: core product/build work
- Last tasks: launch/growth
- Task 1 has dependsOnTaskIndex: null; Task 2+ depends on the previous task index (0-based)
- Missions should be concrete and assignable

RESEARCH:
${research}`

    const blueprintResult = await generateText({
      model: lmProvider('hermes-agent'),
      messages: [{ role: 'user', content: blueprintPrompt }],
      system: 'You are a project planner. Return ONLY valid JSON. No markdown, no explanation.',
    })

    const text = blueprintResult.text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : text
    let blueprint: any
    try { blueprint = JSON.parse(jsonStr) } catch {
      const cleaned = jsonStr.replace(/```json|```/g, '').trim()
      blueprint = JSON.parse(cleaned)
    }

    if (!blueprint.tasks || !Array.isArray(blueprint.tasks)) {
      return NextResponse.json({ error: 'Failed to parse blueprint from AI response' }, { status: 500 })
    }

    // ── PHASE 3: PERSIST ──────────────────────────────────────
    setStatus(projectId || '', 'generating', 'saving')
    const createdTasks: any[] = []
    const allMissions: any[] = []
    const taskIdMap: Record<number, string> = {}

    for (let i = 0; i < blueprint.tasks.length; i++) {
      const t = blueprint.tasks[i]
      const task = await db.task.create({
        data: {
          title: t.title,
          description: t.description,
          status: 'pending_approval',
          priority: t.priority || 'normal',
          category: t.category || 'vision',
          ...(projectId ? { projectId } : {}),
        },
      })
      taskIdMap[i] = task.id

      const taskMissions: any[] = []
      if (t.missions && Array.isArray(t.missions)) {
        for (const m of t.missions) {
          const created = await db.mission.create({
            data: {
              title: m.title,
              description: m.description,
              status: 'pending_approval',
              taskId: task.id,
              ...(projectId ? { projectId } : {}),
            },
          })
          taskMissions.push({
            id: created.id, title: created.title, description: created.description,
            status: created.status,
            recommendedAgentRole: m.recommendedAgentRole || 'generalist',
            deliverable: m.deliverable || '',
          })
          allMissions.push(created)
        }
      }

      createdTasks.push({
        id: task.id, title: task.title, description: task.description,
        status: task.status, priority: task.priority,
        dependsOnTaskId: null,
        missionCount: taskMissions.length, missions: taskMissions,
      })
    }

    // Save VisionPlan
    const planContent = `## Blueprint Summary\n${blueprint.blueprintSummary || ''}\n\n**Estimated: ${blueprint.totalEstimatedWeeks || 'N/A'} weeks**\n\n---\n\n## Research Summary\n${research.slice(0, 2000)}\n\n---\n\n## Tasks & Missions\n${createdTasks.map(t =>
      `### ${t.title}\n${t.description}\n\n${t.missions.map((m: any) => `- [ ] **${m.title}** → ${m.recommendedAgentRole}: ${m.deliverable}`).join('\n')}`
    ).join('\n\n')}`

    const existingPlan = await db.visionPlan.findFirst({
      where: projectId ? { projectId, status: 'pending' } : { projectId: null, status: 'pending' },
      select: { id: true },
    })

    let planId: string
    if (existingPlan) {
      await db.visionPlan.update({
        where: { id: existingPlan.id },
        data: { content: planContent, missionSnapshot: mission, visionSnapshot: vision },
      })
      planId = existingPlan.id
    } else {
      const plan = await db.visionPlan.create({
        data: {
          content: planContent, progress: 0, status: 'pending',
          missionSnapshot: mission, visionSnapshot: vision,
          ...(projectId ? { projectId } : {}),
        },
      })
      planId = plan.id
    }

    setStatus(projectId || '', 'done', 'saved')
    return NextResponse.json({
      success: true,
      status: 'done',
      planId,
      blueprintSummary: blueprint.blueprintSummary,
      totalEstimatedWeeks: blueprint.totalEstimatedWeeks,
      tasks: createdTasks,
      totalMissions: allMissions.length,
      researchPreview: research.slice(0, 500),
      message: `Blueprint created: ${createdTasks.length} tasks with ${allMissions.length} total missions. Approve in Vision Plan tab to begin execution.`,
    })
  } catch (error: any) {
    setStatus(projectId || '', 'failed', 'error', error?.message)
    console.error('Blueprint error:', error?.message || error)
    return NextResponse.json({ error: `Failed to generate blueprint: ${error?.message || 'Unknown error'}` }, { status: 500 })
  }
}
