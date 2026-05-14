import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { slugify, ensureProjectFolder, getProjectFolder } from '@/lib/project-folder'

// ─── GET /api/projects ────────────────────────────────────────
// List all projects with optional status filter
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const id = searchParams.get('id') || undefined

    // Single project lookup
    if (id) {
      const project = await db.project.findUnique({
        where: { id },
      })
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      // Count linked tasks
      const taskCount = await db.task.count({ where: { projectId: id } })
      return NextResponse.json({ project: { ...project, taskCount } })
    }

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const projects = await db.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })

    // Augment with task counts
    const augmented = await Promise.all(
      projects.map(async (p) => ({
        ...p,
        taskCount: await db.task.count({ where: { projectId: p.id } }),
      }))
    )

    return NextResponse.json({ projects: augmented })
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// ─── POST /api/projects ──────────────────────────────────────
// Create a new project + its folder on disk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, mission, vision } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const slug = slugify(trimmedName)

    // Check for slug uniqueness
    const existing = await db.project.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json(
        { error: `A project with the name "${trimmedName}" already exists` },
        { status: 409 }
      )
    }

    // Create the folder on disk
    const folderPath = await ensureProjectFolder(slug)

    const project = await db.project.create({
      data: {
        name: trimmedName,
        slug,
        description: description || null,
        mission: mission || null,
        vision: vision || null,
        status: 'active',
        folderPath,
      },
    })

    return NextResponse.json({ project: { ...project, taskCount: 0 } }, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

// ─── PUT /api/projects ───────────────────────────────────────
// Update a project by id
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Project id is required' }, { status: 400 })
    }

    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, mission, vision, status } = body

    // If renaming, update slug and folder
    let slug = existing.slug
    let folderPath = existing.folderPath
    if (name && name.trim() !== existing.name) {
      const newSlug = slugify(name.trim())
      const slugConflict = await db.project.findUnique({ where: { slug: newSlug } })
      if (slugConflict && slugConflict.id !== id) {
        return NextResponse.json(
          { error: `A project with the name "${name.trim()}" already exists` },
          { status: 409 }
        )
      }
      slug = newSlug
      folderPath = getProjectFolder(slug)
      // Ensure new folder exists
      await ensureProjectFolder(slug)
    }

    const project = await db.project.update({
      where: { id },
      data: {
        ...(name?.trim() ? { name: name.trim(), slug, folderPath } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(mission !== undefined ? { mission } : {}),
        ...(vision !== undefined ? { vision } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    })

    const taskCount = await db.task.count({ where: { projectId: id } })
    return NextResponse.json({ project: { ...project, taskCount } })
  } catch (error) {
    console.error('PUT /api/projects error:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

// ─── DELETE /api/projects ─────────────────────────────────────
// Archive a project, or permanently delete if already archived
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Project id is required' }, { status: 400 })
    }

    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (existing.status === 'archived') {
      // Hard-delete archived projects (permanent)
      await db.project.delete({ where: { id } })
      return NextResponse.json({ success: true, deleted: true })
    }

    // Soft-delete: archive active/completed projects
    await db.project.update({
      where: { id },
      data: { status: 'archived' },
    })

    return NextResponse.json({ success: true, archived: true })
  } catch (error) {
    console.error('DELETE /api/projects error:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
