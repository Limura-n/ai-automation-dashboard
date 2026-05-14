import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { ensureTaskFolder } from '@/lib/task-folder'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const taskId = formData.get('taskId') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    let uploadDir: string

    if (taskId) {
      // Save in task-specific folder
      uploadDir = ensureTaskFolder(taskId)
    } else {
      // Fallback to general uploads folder
      uploadDir = path.join(process.env.HOME || '/home/nazmul', 'Documents', 'AI_Tasks', 'uploads')
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
    }

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = path.join(uploadDir, safeName)
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    const fileSizeKB = Math.round(buffer.length / 1024)

    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        path: filePath,
        size: fileSizeKB,
        savedAs: safeName,
        taskId: taskId || null,
      },
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
