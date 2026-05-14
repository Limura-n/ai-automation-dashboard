import fs from 'fs'
import path from 'path'

const TASKS_BASE = path.join(
  process.env.HOME || '/home/nazmul',
  'Documents',
  'AI_Tasks',
  'tasks'
)

/**
 * Returns the deterministic folder path for a task.
 * Creates the folder if it doesn't exist.
 * 
 * @param taskId - The task's ID (cuid)
 * @param title  - Optional title for a human-readable slug suffix
 * @returns The absolute path to the task's folder
 */
export function getTaskFolder(taskId: string, title?: string | null): string {
  // Sanitize title to create a readable slug
  let slug = taskId.slice(0, 12)
  if (title) {
    const clean = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
    if (clean) slug = `${slug}-${clean}`
  }

  const folderPath = path.join(TASKS_BASE, slug)
  return folderPath
}

/**
 * Ensures the task folder exists on disk.
 */
export function ensureTaskFolder(taskId: string, title?: string | null): string {
  const folderPath = getTaskFolder(taskId, title)
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true })
  }
  return folderPath
}

/**
 * Lists all files in a task's folder.
 */
export function listTaskFiles(taskId: string, title?: string | null): string[] {
  const folderPath = getTaskFolder(taskId, title)
  if (!fs.existsSync(folderPath)) return []
  return fs.readdirSync(folderPath).map(f => path.join(folderPath, f))
}
