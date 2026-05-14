import { NextResponse } from 'next/server'
import { spawn } from 'child_process'

const ORCHESTRATOR_JOB_ID = '7a63f3aa2aff'

export async function POST() {
  try {
    // Spawn detached child — hermes runs asynchronously, HTTP response returns immediately
    spawn('hermes', ['cron', 'run', '--accept-hooks', ORCHESTRATOR_JOB_ID], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, HERMES_ACCEPT_HOOKS: '1' },
    }).unref()

    return NextResponse.json({ success: true, triggered: true })
  } catch (err: any) {
    console.error('Trigger orchestrator error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to trigger orchestrator' },
      { status: 500 }
    )
  }
}
