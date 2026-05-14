import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'
import os from 'os'

const PARSER_SCRIPT = path.join(os.homedir(), '.hermes', 'scripts', 'nl_task_parser.py')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text } = body

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Run the Python parser
    const input = text.trim().replace(/'/g, "'\\''")
    const result = execSync(`python3 "${PARSER_SCRIPT}" '${input}'`, {
      timeout: 5000,
      encoding: 'utf-8',
    })

    const parsed = JSON.parse(result)

    return NextResponse.json({
      success: true,
      parsed: {
        title: parsed.title,
        description: parsed.description,
        priority: parsed.priority,
        schedule: parsed.schedule,
        category: parsed.category,
        scheduleHuman: parsed.parsed?.schedule_human || null,
      },
    })
  } catch (error: any) {
    console.error('NL Parser error:', error)
    return NextResponse.json(
      { error: 'Failed to parse task', details: error.message },
      { status: 500 }
    )
  }
}
