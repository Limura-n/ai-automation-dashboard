import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Helper to return profile JSON
function profileJson(p: any) {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    skills: p.skills,
    workStyle: p.workStyle,
    experienceLevel: p.experienceLevel,
    mission: p.mission,
    vision: p.vision,
    personality: p.personality,
    communicationPref: p.communicationPref,
    activeHours: p.activeHours,
    preferences: p.preferences ? JSON.parse(p.preferences) : null,
    workflows: p.workflows ? JSON.parse(p.workflows) : null,
    model: p.model,
    mainGoal: p.mainGoal,
    mainGoalTarget: p.mainGoalTarget,
    setupComplete: p.setupComplete,
    createdAt: p.createdAt?.toISOString?.() || p.createdAt,
    updatedAt: p.updatedAt?.toISOString?.() || p.updatedAt,
  }
}

// Helper to auto-create/update a milestone for the main goal
async function syncMainGoalMilestone(mainGoal: string | null, mainGoalTarget: number | null, projectId?: string) {
  if (!mainGoal || !mainGoalTarget || mainGoalTarget <= 0) return

  const milestoneWhere: Record<string, unknown> = { title: '🎯 Main Goal' }
  if (projectId) milestoneWhere.projectId = projectId
  else milestoneWhere.projectId = null

  const existing = await db.visionMilestone.findFirst({
    where: milestoneWhere,
  })

  if (existing) {
    await db.visionMilestone.update({
      where: { id: existing.id },
      data: { targetValue: mainGoalTarget, description: mainGoal },
    })
  } else {
    await db.visionMilestone.create({
      data: {
        title: '🎯 Main Goal',
        description: mainGoal,
        targetValue: mainGoalTarget,
        currentValue: 0,
        unit: '$',
        sortOrder: 0,
        projectId: projectId || null,
      },
    })
  }
}

// ─── GET /api/profile ───────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId') || undefined

    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId
    else where.projectId = null  // global profile

    let profile = await db.userProfile.findFirst({ where })
    
    if (!profile && !projectId) {
      // Auto-seed from .profile-seed.json only for global profile
      const seedPath = path.join(process.cwd(), '.profile-seed.json')
      if (fs.existsSync(seedPath)) {
        try {
          const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
          profile = await db.userProfile.create({
            data: {
              name: seedData.name || null,
              role: seedData.role || null,
              skills: seedData.skills || null,
              workStyle: seedData.workStyle || null,
              experienceLevel: seedData.experienceLevel || null,
              mission: seedData.mission || null,
              vision: seedData.vision || null,
              personality: seedData.personality || null,
              communicationPref: seedData.communicationPref || null,
              activeHours: seedData.activeHours || null,
              preferences: seedData.preferences ? JSON.stringify(seedData.preferences) : null,
              workflows: seedData.workflows ? JSON.stringify(seedData.workflows) : null,
              model: seedData.model || null,
              mainGoal: seedData.mainGoal || null,
              mainGoalTarget: seedData.mainGoalTarget || null,
              setupComplete: true,
            },
          })
          fs.unlinkSync(seedPath)
          if (profile.mainGoal && profile.mainGoalTarget) {
            await syncMainGoalMilestone(profile.mainGoal, profile.mainGoalTarget, undefined)
          }
        } catch (seedErr) {
          console.error('[PROFILE] Failed to auto-seed:', seedErr)
        }
      }
    }

    if (!profile) {
      return NextResponse.json({ profile: null })
    }
    return NextResponse.json({ profile: profileJson(profile) })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

// ─── POST /api/profile ──────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name, role, skills, workStyle, experienceLevel,
      mission, vision, personality, communicationPref,
      activeHours, preferences, workflows, model, mainGoal, mainGoalTarget,
      projectId,
    } = body

    // If projectId, find existing profile for that project; otherwise find global
    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId
    else where.projectId = null

    const existing = await db.userProfile.findFirst({ where })
    if (existing) {
      await db.userProfile.delete({ where: { id: existing.id } })
    }

    const profile = await db.userProfile.create({
      data: {
        name: name?.trim() || null,
        role: role?.trim() || null,
        skills: skills?.trim() || null,
        workStyle: workStyle?.trim() || null,
        experienceLevel: experienceLevel?.trim() || null,
        mission: mission?.trim() || null,
        vision: vision?.trim() || null,
        personality: personality?.trim() || null,
        communicationPref: communicationPref?.trim() || null,
        activeHours: activeHours?.trim() || null,
        preferences: preferences ? JSON.stringify(preferences) : null,
        workflows: workflows ? JSON.stringify(workflows) : null,
        model: model?.trim() || null,
        mainGoal: mainGoal?.trim() || null,
        mainGoalTarget: mainGoalTarget != null ? Number(mainGoalTarget) : null,
        projectId: projectId || null,
        setupComplete: true,
      },
    })

    if (profile.mainGoal && profile.mainGoalTarget) {
      await syncMainGoalMilestone(profile.mainGoal, profile.mainGoalTarget, projectId || undefined)
    }

    return NextResponse.json({ success: true, profile: profileJson(profile) })
  } catch (error) {
    console.error('Error creating profile:', error)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }
}

// ─── PUT /api/profile ────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId') || body.projectId || undefined

    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId
    else where.projectId = null

    const existing = await db.userProfile.findFirst({ where })
    if (!existing) {
      // No profile exists — auto-create one (upsert pattern)
      const createData: Record<string, unknown> = {
        projectId: projectId || null,
        setupComplete: true,
      }
      const fields = [
        'name', 'role', 'skills', 'workStyle', 'experienceLevel',
        'mission', 'vision', 'personality', 'communicationPref', 'activeHours', 'model',
        'mainGoal',
      ]
      for (const field of fields) {
        if (body[field] !== undefined) createData[field] = String(body[field]).trim() || null
      }
      if (body.mainGoalTarget !== undefined) createData.mainGoalTarget = Number(body.mainGoalTarget) || null
      if (body.preferences !== undefined) createData.preferences = JSON.stringify(body.preferences)
      if (body.workflows !== undefined) createData.workflows = JSON.stringify(body.workflows)

      const created = await db.userProfile.create({ data: createData as any })
      if (created.mainGoal && created.mainGoalTarget) {
        await syncMainGoalMilestone(created.mainGoal, created.mainGoalTarget, projectId || undefined)
      }
      return NextResponse.json({ success: true, profile: profileJson(created) })
    }

    const updateData: Record<string, unknown> = {}
    const fields = [
      'name', 'role', 'skills', 'workStyle', 'experienceLevel',
      'mission', 'vision', 'personality', 'communicationPref', 'activeHours', 'model',
      'mainGoal',
    ]
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = String(body[field]).trim() || null
    }
    if (body.mainGoalTarget !== undefined) updateData.mainGoalTarget = Number(body.mainGoalTarget) || null
    if (body.preferences !== undefined) updateData.preferences = JSON.stringify(body.preferences)
    if (body.workflows !== undefined) updateData.workflows = JSON.stringify(body.workflows)
    if (body.setupComplete !== undefined) updateData.setupComplete = Boolean(body.setupComplete)

    const updated = await db.userProfile.update({
      where: { id: existing.id },
      data: updateData,
    })

    if (updated.mainGoal && updated.mainGoalTarget) {
      await syncMainGoalMilestone(updated.mainGoal, updated.mainGoalTarget, projectId || undefined)
    }

    return NextResponse.json({ success: true, profile: profileJson(updated) })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
