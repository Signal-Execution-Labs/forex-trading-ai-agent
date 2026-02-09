/**
 * K.I.T. AI Provider Registry
 * 
 * Supports ALL providers like OpenClaw:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google (Gemini)
 * - OpenRouter
 * - xAI (Grok)
 * - Groq
 * - Cerebras
 * - Mistral
 * - GitHub Copilot
 * - Ollama (local)
 * - Moonshot/Kimi
 * - MiniMax
 * - Qwen
 * - Z.AI (GLM)
 */

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  api: 'anthropic-messages' | 'openai-completions' | 'openai-responses';
  models: ModelConfig[];
}

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  reasoning?: boolean;
  vision?: boolean;
  cost?: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  // Anthropic
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    api: 'anthropic-messages',
    models: [
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', contextWindow: 200000, maxTokens: 8192, reasoning: true, vision: true },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, maxTokens: 8192, vision: true },
      { id: 'claude-haiku-3-5-20240307', name: 'Claude Haiku 3.5', contextWindow: 200000, maxTokens: 4096 },
    ]
  },

  // OpenAI
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    api: 'openai-completions',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, maxTokens: 4096, vision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, maxTokens: 4096 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, maxTokens: 4096 },
      { id: 'o1', name: 'o1', contextWindow: 200000, maxTokens: 100000, reasoning: true },
      { id: 'o1-mini', name: 'o1 Mini', contextWindow: 128000, maxTokens: 65536, reasoning: true },
    ]
  },

  // Google
  google: {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GEMINI_API_KEY',
    api: 'openai-completions',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, maxTokens: 8192, vision: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, maxTokens: 8192, vision: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, maxTokens: 8192 },
    ]
  },

  // OpenRouter (access to many models)
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    api: 'openai-completions',
    models: [
      { id: 'anthropic/claude-opus-4-5', name: 'Claude Opus 4.5 (via OR)', contextWindow: 200000, maxTokens: 8192 },
      { id: 'openai/gpt-4o', name: 'GPT-4o (via OR)', contextWindow: 128000, maxTokens: 4096 },
      { id: 'meta-llama/llama-3.3-70b', name: 'Llama 3.3 70B', contextWindow: 128000, maxTokens: 4096 },
    ]
  },

  // xAI
  xai: {
    id: 'xai',
    name: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    apiKeyEnv: 'XAI_API_KEY',
    api: 'openai-completions',
    models: [
      { id: 'grok-2', name: 'Grok 2', contextWindow: 131072, maxTokens: 4096 },
      { id: 'grok-2-mini', name: 'Grok 2 Mini', contextWindow: 131072, maxTokens: 4096 },
    ]
  },

  // Groq (fast inference)
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    api: 'openai-completions',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, maxTokens: 4096 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, maxTokens: 4096 },
    ]
  },

  // Cerebras
  cerebras: {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    apiKeyEnv: 'CEREBRAS_API_KEY',
    api: 'openai-completions',
    models: [
      { id: 'llama3.1-70b', name: 'Llama 3.1 70B', contextWindow: 8192, maxTokens: 4096 },
    ]
  },

  // Mistral
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
    api: 'openai-completions',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000, maxTokens: 4096 },
      { id: 'codestral-latest', name: 'Codestral', contextWindow: 32000, maxTokens: 4096 },
    ]
  },

  // Ollama (local)
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKeyEnv: '',
    api: 'openai-completions',
    models: [
      { id: 'llama3.3', name: 'Llama 3.3', contextWindow: 128000, maxTokens: 4096 },
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', contextWindow: 32000, maxTokens: 4096 },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', contextWindow: 128000, maxTokens: 4096 },
    ]
  },

  // DeepSeek
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    api: 'openai-completions',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000, maxTokens: 4096 },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', contextWindow: 64000, maxTokens: 4096 },
    ]
  },
};

export function getProvider(providerId: string): ProviderConfig | undefined {
  return PROVIDERS[providerId];
}

export function listProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

export function parseModelRef(ref: string): { provider: string; model: string } | null {
  const parts = ref.split('/');
  if (parts.length < 2) return null;
  return {
    provider: parts[0],
    model: parts.slice(1).join('/')
  };
}
