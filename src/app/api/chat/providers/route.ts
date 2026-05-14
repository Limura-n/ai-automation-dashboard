import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const configPath = join(process.env.HOME || '/home/nazmul', '.hermes', 'config.yaml');
    const content = readFileSync(configPath, 'utf-8');

    // Extract current model config
    const modelMatch = content.match(/^model:\s*\n\s*default:\s*(\S+)\s*\n\s*provider:\s*(\S+)/m);
    const baseUrlMatch = content.match(/^  base_url:\s*(.+)/m);

    // Extract custom providers
    const customProviders: { name: string; base_url: string; api_key: string }[] = [];
    const customProviderBlocks = content.split(/^custom_providers:\s*\n/m)[1] || '';
    const providerItems = customProviderBlocks.split(/^  -\s+name:\s+/m).filter(Boolean);
    
    for (const block of providerItems) {
      const nameMatch = block.match(/^(\S+)/);
      const urlMatch = block.match(/base_url:\s*(.+)/);
      const keyMatch = block.match(/api_key:\s*['"]?([^'"\n]+)['"]?/);
      if (nameMatch && urlMatch) {
        customProviders.push({
          name: nameMatch[1],
          base_url: urlMatch[1].trim(),
          api_key: keyMatch ? keyMatch[1] : '',
        });
      }
    }

    // Build the provider list — gateway is the primary route
    const gatewayBaseUrl = process.env.HERMES_GATEWAY_URL || 'http://localhost:8642/v1';
    const gatewayToken = process.env.HERMES_GATEWAY_TOKEN || '';

    const currentDefault = modelMatch ? modelMatch[1] : 'hermes-agent';
    const currentProvider = modelMatch ? modelMatch[2] : 'opencode-go';
    const currentBaseUrl = baseUrlMatch ? baseUrlMatch[1].trim() : '';

    // Helper to fetch models from an API
    async function fetchModels(url: string): Promise<string[]> {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return [];
        const data = await res.json();
        return data.data?.map((m: any) => m.id).slice(0, 30) || [];
      } catch {
        return [];
      }
    }

    // Fetch models from APIs in parallel
    const [openrouterModels, ollamaModels] = await Promise.all([
      fetchModels('https://openrouter.ai/api/v1/models'),
      (async () => {
        try {
          const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
          if (!res.ok) return [];
          const data = await res.json();
          return data.models?.map((m: any) => m.name) || [];
        } catch {
          return [];
        }
      })(),
    ]);

    // OpenCode Go models - from official docs
    const opencodeGoModels = [
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
    ];

    // OpenCode Zen models - all available via Zen subscription (deduped)
    const opencodeZenModels = [...new Set([
      'claude-opus-4.7',
      'claude-opus-4.6',
      'claude-opus-4.5',
      'claude-sonnet-4.6',
      'claude-sonnet-4.5',
      'claude-haiku-4.5',
      'gpt-5.4',
      'gpt-5.4-pro',
      'gpt-5.4-mini',
      'gpt-5.3-codex',
      'gpt-5.2',
      'gpt-5.2-codex',
      'gpt-5.1-codex',
      'gpt-5',
      'gemini-3.1-pro',
      'gemini-3-pro',
      'gemini-3-flash',
      'glm-5.1',
      'glm-5',
      ...opencodeGoModels,
    ])];

    const cloudProviders = [
      {
        name: 'hermes-gateway',
        displayName: 'Hermes Gateway',
        baseURL: process.env.HERMES_GATEWAY_URL || 'http://localhost:8642/v1',
        apiKeyRequired: false,
        models: ['hermes-agent'],
      },
      {
        name: 'opencode-go',
        displayName: 'OpenCode Go',
        baseURL: 'https://opencode.ai/zen/go/v1',
        apiKeyRequired: true,
        models: opencodeGoModels,
      },
      {
        name: 'opencode-zen',
        displayName: 'OpenCode Zen',
        baseURL: 'https://opencode.ai/zen/v1',
        apiKeyRequired: true,
        models: [...new Set([
          ...opencodeZenModels,
        ])],
      },
      {
        name: 'openrouter',
        displayName: 'OpenRouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKeyRequired: true,
        models: openrouterModels.length > 0 ? openrouterModels : [
          'anthropic/claude-3.5-sonnet',
          'openai/gpt-4o',
          'google/gemini-2.0-flash',
        ],
      },
      {
        name: 'ollama',
        displayName: 'Ollama (Local)',
        baseURL: 'http://localhost:11434/v1',
        apiKeyRequired: false,
        models: ollamaModels,
      },
    ];

    // Detect current provider based on config
    let selectedProvider = cloudProviders.find(p => p.name === currentProvider);
    if (!selectedProvider && currentBaseUrl) {
      selectedProvider = cloudProviders.find(p => 
        currentBaseUrl.includes(p.baseURL) || p.baseURL.includes(currentBaseUrl)
      );
    }
    if (!selectedProvider) {
      selectedProvider = cloudProviders.find(p => p.name === 'opencode-go')!;
    }

    return NextResponse.json({
      currentDefault,
      currentProvider,
      providers: cloudProviders,
      gateway: {
        baseURL: gatewayBaseUrl,
        apiKey: gatewayToken,
      },
      customProviders,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read config' }, { status: 500 });
  }
}