import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { streamText } from 'ai'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages, provider, model, source } = body

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const selectedProvider = provider || 'hermes-gateway'
    const selectedModel = model || 'hermes-agent'

    const providerConfigs: Record<string, { baseURL: string; apiKey: string }> = {
      'opencode-go': {
        // Route through local Hermes Gateway — it has proper auth configured.
        // Direct OpenCode API calls fail because the dashboard .env has no API key.
        baseURL: process.env.HERMES_GATEWAY_URL || 'http://localhost:8642/v1',
        apiKey: process.env.HERMES_GATEWAY_TOKEN || 'gateway',
      },
      'hermes-gateway': {
        baseURL: process.env.HERMES_GATEWAY_URL || 'http://localhost:8642/v1',
        apiKey: process.env.HERMES_GATEWAY_TOKEN || 'gateway',
      },
      'opencode-zen': {
        baseURL: 'https://opencode.ai/zen/v1',
        apiKey: process.env.OPENCODE_ZEN_API_KEY || '',
      },
      'openrouter': {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY || '',
      },
      'ollama': {
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'ollama',
      },
      'deepseek': {
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY || '',
      },
    }

    const config = providerConfigs[selectedProvider] || {
      baseURL: process.env.HERMES_GATEWAY_URL || 'http://localhost:8642/v1',
      apiKey: process.env.HERMES_GATEWAY_TOKEN || 'gateway',
    }

    const lmProvider = createOpenAICompatible({
      name: selectedProvider,
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    })

    let systemPrompt = `You are Limura, a helpful AI assistant powered by ${selectedModel} (provider: ${selectedProvider}). Do NOT use any tools, plugins, or functions. Only respond with text. Keep responses conversational and concise. If asked what model you are, say "${selectedModel}" (${selectedProvider}).`

    // When the user chats from the dashboard, give them dashboard-aware context
    if (source === 'dashboard') {
      systemPrompt += `\n\nYou are inside the Adobe Stock Mission Control dashboard — the central command hub. The user is accessing you through the dashboard's chat interface.\n\nDashboard features you can reference:\n• **Mission Control** — KPIs, agent grid, live activity, heartbeat\n• **My Profile** — personality, skills, goals, preferences\n• **Tasks** — create/view/manage with NL parsing, scheduling, templates\n• **Missions** — AI-decomposed work units linked to tasks\n• **Active Agents** — sub-agent fleet with learning stats & models\n• **Agent Model** — model settings, provider grid\n• **Learning** — accumulated wisdom and feedback\n• **Reports** — completed work with task & agent logs\n• **Vision Plan** — roadmap toward goals with milestones\n\nWhen the user asks about their data (tasks, missions, agents, etc.), guide them to the relevant panel or suggest dashboard actions. Refer to dashboard features naturally. Be friendly and conversational.`
    }

    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role || 'user',
      content: typeof msg.content === 'string' ? msg.content : '',
    }))

    const result = streamText({
      model: lmProvider(selectedModel),
      messages: [
        { role: 'system', content: systemPrompt },
        ...formattedMessages,
      ],
    })

    return result.toTextStreamResponse()
  } catch (error: any) {
    console.error('Chat streaming error:', error?.message || error)

    if (error?.message?.includes('fetch failed') ||
        error?.message?.includes('ECONNREFUSED') ||
        error?.message?.includes('ENOTFOUND')) {
      return new Response(
        JSON.stringify({ error: 'AI backend is not running.', code: 'BACKEND_OFFLINE' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: `Chat failed: ${error?.message || 'Unknown error'}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
