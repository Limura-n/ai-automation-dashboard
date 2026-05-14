import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const ORCHESTRATOR_JOB_ID = '7a63f3aa2aff'
const HEARTBEAT_FILE = path.join(process.env.HOME || '/home/nazmul', '.hermes', 'heartbeat.json')

interface HeartbeatState {
  active: boolean
  checkInterval: number // in minutes
}

function readState(): HeartbeatState {
  try {
    if (fs.existsSync(HEARTBEAT_FILE)) {
      const data = JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf-8'))
      return { active: data.active === true, checkInterval: data.checkInterval ?? 10 }
    }
  } catch {}
  return { active: true, checkInterval: 10 }
}

function writeState(state: HeartbeatState) {
  const dir = path.dirname(HEARTBEAT_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(state, null, 2))
}

export async function GET() {
  const state = readState()
  return NextResponse.json(state)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const current = readState()
    const active = body.active === true // strict boolean
    const checkInterval = body.checkInterval != null ? Math.max(1, Math.min(120, Number(body.checkInterval))) : current.checkInterval

    // Update state file (synchronous, fast, no I/O bottleneck)
    writeState({ active, checkInterval })

    // Pause or resume the cron job asynchronously — don't block HTTP response
    const subcommand = active ? 'resume' : 'pause'
    spawn('hermes', ['cron', subcommand, ORCHESTRATOR_JOB_ID], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, HERMES_ACCEPT_HOOKS: '1' },
    }).unref()

    return NextResponse.json({ success: true, active, checkInterval })
  } catch (err: any) {
    console.error('Heartbeat toggle error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to toggle heartbeat' },
      { status: 500 }
    )
  }
}
