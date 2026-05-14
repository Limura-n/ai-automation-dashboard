/**
 * Project Folder System
 *
 * Every project gets a dedicated folder on disk under the software root:
 *   ~/Desktop/Adobe Stock Mission Control/projects/<slug>/
 *
 * The slug is a URL-friendly, kebab-case version of the project name.
 */

import { promises as fs } from 'fs'
import path from 'path'

const PROJECTS_BASE = path.resolve(
  process.env.HOME || '/home/nazmul',
  'Desktop/Adobe Stock Mission Control/projects'
)

/**
 * Convert a project name to a URL/folder-friendly slug.
 * "My Awesome Project!" → "my-awesome-project"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Get the deterministic folder path for a project.
 * Does NOT create the folder.
 */
export function getProjectFolder(slug: string): string {
  return path.join(PROJECTS_BASE, slug)
}

/**
 * Get the folder path AND create the folder if it doesn't exist.
 */
export async function ensureProjectFolder(slug: string): Promise<string> {
  const folderPath = getProjectFolder(slug)
  await fs.mkdir(folderPath, { recursive: true })
  return folderPath
}

/**
 * List all files inside a project folder.
 */
export async function listProjectFiles(slug: string): Promise<string[]> {
  const folderPath = getProjectFolder(slug)
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true })
    return entries
      .filter(e => e.isFile())
      .map(e => path.join(folderPath, e.name))
  } catch {
    return []
  }
}
