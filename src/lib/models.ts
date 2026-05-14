// ─── Available AI Models for Agent Selection ─────────────────
// Matches the providers endpoint at /api/chat/providers

export interface ModelGroup {
  provider: string
  displayName: string
  models: string[]
}

export const MODEL_GROUPS: ModelGroup[] = [
  {
    provider: 'opencode-go',
    displayName: 'OpenCode Go',
    models: [
      'glm-5',
      'glm-5.1',
      'kimi-k2.5',
      'kimi-k2.6',
      'mimo-v2-pro',
      'mimo-v2-omni',
      'minimax-m2.5',
      'minimax-m2.7',
      'qwen3.5-plus',
      'qwen3.6-plus',
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'deepseek-v3',
      'deepseek-r1',
    ],
  },
  {
    provider: 'opencode-zen',
    displayName: 'OpenCode Zen',
    models: [
      // Claude
      'claude-opus-4-7',
      'claude-opus-4-6',
      'claude-opus-4-5',
      'claude-opus-4-1',
      'claude-sonnet-4-6',
      'claude-sonnet-4-5',
      'claude-sonnet-4',
      'claude-haiku-4-5',
      // Gemini
      'gemini-3.1-pro',
      'gemini-3-flash',
      // GPT-5
      'gpt-5.5',
      'gpt-5.5-pro',
      'gpt-5.4',
      'gpt-5.4-pro',
      'gpt-5.4-mini',
      'gpt-5.4-nano',
      'gpt-5.3-codex-spark',
      'gpt-5.3-codex',
      'gpt-5.2',
      'gpt-5.2-codex',
      'gpt-5.1',
      'gpt-5.1-codex-max',
      'gpt-5.1-codex',
      'gpt-5.1-codex-mini',
      'gpt-5',
      'gpt-5-codex',
      'gpt-5-nano',
      // GLM
      'glm-5.1',
      'glm-5',
      // Minimax
      'minimax-m2.7',
      'minimax-m2.5',
      'minimax-m2.5-free',
      // Kimi
      'kimi-k2.6',
      'kimi-k2.5',
      // Qwen
      'qwen3.6-plus',
      'qwen3.5-plus',
      // Free models
      'hy3-preview-free',
      'ling-2.6-flash-free',
      'trinity-large-preview-free',
      'nemotron-3-super-free',
      // Other
      'big-pickle',
    ],
  },
  {
    provider: 'openrouter',
    displayName: 'OpenRouter',
    models: [
      'anthropic/claude-sonnet-4',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash',
      'google/gemini-2.5-pro',
      'deepseek/deepseek-v3',
      'deepseek/deepseek-r1',
      'meta-llama/llama-3.3-70b',
      'mistralai/mistral-large',
    ],
  },
  {
    provider: 'hermes-gateway',
    displayName: 'Hermes Gateway',
    models: [
      'hermes-agent',
    ],
  },
  {
    provider: 'openai',
    displayName: 'OpenAI',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
    ],
  },
  {
    provider: 'anthropic',
    displayName: 'Anthropic',
    models: [
      'claude-opus-4',
      'claude-sonnet-4',
      'claude-3.5-sonnet',
      'claude-3-haiku',
    ],
  },
  {
    provider: 'google',
    displayName: 'Google',
    models: [
      'gemini-2.0-flash',
      'gemini-2.5-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
  },
  {
    provider: 'ollama',
    displayName: 'Ollama (Local)',
    models: [
      'llama3.2',
      'llama3.1',
      'mistral',
      'codellama',
      'mixtral',
      'qwen2.5',
    ],
  },
  {
    provider: 'deepseek',
    displayName: 'DeepSeek',
    models: [
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'deepseek-v3',
      'deepseek-r1',
    ],
  },
  {
    provider: 'openai-compatible',
    displayName: 'OpenAI-Compatible',
    models: [
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'deepseek-v3',
      'deepseek-r1',
      'qwen-max',
      'qwen-plus',
    ],
  },
]

// Flatten all models for simple dropdown use
export const ALL_MODELS = MODEL_GROUPS.flatMap(g => g.models)

// Common defaults
export const DEFAULT_MODEL = 'deepseek-v4-flash'
export const DEFAULT_SUBAGENT_MODEL = 'deepseek-v4-flash'

// Get provider display name for a model
export function getModelProvider(model: string): string {
  for (const group of MODEL_GROUPS) {
    if (group.models.includes(model)) return group.displayName
  }
  return 'Unknown'
}

// Get provider key for a model (used by /api/chat)
// Prefers dedicated provider groups over generic ones
export function getModelProviderKey(model: string): string | null {
  // Check dedicated provider groups first (exact match by model prefix)
  const dedicatedProviders = ['deepseek', 'anthropic', 'google', 'openai']
  for (const group of MODEL_GROUPS) {
    if (dedicatedProviders.includes(group.provider) && group.models.includes(model)) {
      return group.provider
    }
  }
  // Fallback: return the first match (e.g. opencode-go, openrouter)
  for (const group of MODEL_GROUPS) {
    if (group.models.includes(model)) return group.provider
  }
  return null
}
