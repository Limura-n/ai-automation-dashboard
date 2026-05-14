import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const COMMANDS_FILE = path.join(process.env.HOME || '/home/nazmul', 'Documents', 'AI_Tasks', 'commands.json')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { command, type } = body
    
    // Ensure directory exists
    const dir = path.dirname(COMMANDS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    // Load existing commands
    let commands: any[] = []
    if (fs.existsSync(COMMANDS_FILE)) {
      try {
        commands = JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf-8'))
      } catch {
        commands = []
      }
    }
    
    // Add new command
    const newCommand = {
      id: Date.now().toString(),
      command,
      type: type || 'task',
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    
    commands.push(newCommand)
    
    // Save to file
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify(commands, null, 2))
    
    return NextResponse.json({ success: true, command: newCommand })
  } catch (error) {
    console.error('Error saving command:', error)
    return NextResponse.json({ success: false, error: 'Failed to save command' }, { status: 500 })
  }
}

export async function GET() {
  try {
    if (!fs.existsSync(COMMANDS_FILE)) {
      return NextResponse.json({ commands: [] })
    }
    
    const commands = JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf-8'))
    return NextResponse.json({ commands })
  } catch (error) {
    return NextResponse.json({ commands: [], error: 'Failed to read commands' }, { status: 500 })
  }
}