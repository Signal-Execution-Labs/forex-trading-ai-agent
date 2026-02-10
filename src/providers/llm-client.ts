/**
 * K.I.T. LLM Client
 * 
 * Universal client for all supported AI providers
 * Supports streaming, tool calls, and vision
 */

import { EventEmitter } from 'eventemitter3';
import { PROVIDERS, getProvider, parseModelRef, ProviderConfig } from './index';

// ============================================================================
// Types
// ============================================================================

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[];
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  systemPrompt?: string;
  signal?: AbortSignal;
}

export interface ChatResponse {
  id: string;
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

export interface LLMClientConfig {
  defaultProvider?: string;
  defaultModel?: string;
  apiKeys?: Record<string, string>;
  baseUrls?: Record<string, string>;
  timeout?: number;
}

// ============================================================================
// LLM Client
// ============================================================================

export class LLMClient extends EventEmitter {
  private config: LLMClientConfig;
  private apiKeys: Map<string, string> = new Map();

  constructor(config: LLMClientConfig = {}) {
    super();
    this.config = {
      defaultProvider: config.defaultProvider || 'anthropic',
      defaultModel: config.defaultModel || 'claude-sonnet-4-20250514',
      timeout: config.timeout || 60000,
      ...config,
    };

    // Load API keys from config and environment
    this.loadApiKeys(config.apiKeys);
  }

  /**
   * Send a chat message and get a response
   */
  async chat(
    messages: LLMMessage[],
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    const modelRef = options.model || `${this.config.defaultProvider}/${this.config.defaultModel}`;
    const { provider, model } = this.parseModel(modelRef);
    
    const providerConfig = getProvider(provider);
    if (!providerConfig) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const apiKey = this.getApiKey(provider);
    
    // Route to appropriate API handler
    switch (providerConfig.api) {
      case 'anthropic-messages':
        return this.chatAnthropic(providerConfig, model, messages, options, apiKey);
      case 'openai-completions':
        return this.chatOpenAI(providerConfig, model, messages, options, apiKey);
      default:
        throw new Error(`Unsupported API type: ${providerConfig.api}`);
    }
  }

  /**
   * Stream a chat response
   */
  async *chatStream(
    messages: LLMMessage[],
    options: ChatOptions = {}
  ): AsyncGenerator<StreamChunk> {
    const modelRef = options.model || `${this.config.defaultProvider}/${this.config.defaultModel}`;
    const { provider, model } = this.parseModel(modelRef);
    
    const providerConfig = getProvider(provider);
    if (!providerConfig) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const apiKey = this.getApiKey(provider);
    
    // Route to appropriate streaming handler
    switch (providerConfig.api) {
      case 'anthropic-messages':
        yield* this.streamAnthropic(providerConfig, model, messages, options, apiKey);
        break;
      case 'openai-completions':
        yield* this.streamOpenAI(providerConfig, model, messages, options, apiKey);
        break;
      default:
        throw new Error(`Unsupported API type: ${providerConfig.api}`);
    }
  }

  // ==========================================================================
  // Anthropic API
  // ==========================================================================

  private async chatAnthropic(
    provider: ProviderConfig,
    model: string,
    messages: LLMMessage[],
    options: ChatOptions,
    apiKey?: string
  ): Promise<ChatResponse> {
    const { systemPrompt, formattedMessages } = this.formatAnthropicMessages(messages, options.systemPrompt);
    
    const body: any = {
      model,
      messages: formattedMessages,
      max_tokens: options.maxTokens || 4096,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await this.fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      id: string;
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
      usage?: { input_tokens: number; output_tokens: number };
      stop_reason?: string;
    };
    
    // Extract content and tool calls
    let content = '';
    const toolCalls: ToolCall[] = [];
    
    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text || '';
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id || '',
          type: 'function',
          function: {
            name: block.name || '',
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      id: data.id,
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: data.usage ? {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      } : undefined,
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    };
  }

  private async *streamAnthropic(
    provider: ProviderConfig,
    model: string,
    messages: LLMMessage[],
    options: ChatOptions,
    apiKey?: string
  ): AsyncGenerator<StreamChunk> {
    const { systemPrompt, formattedMessages } = this.formatAnthropicMessages(messages, options.systemPrompt);
    
    const body: any = {
      model,
      messages: formattedMessages,
      max_tokens: options.maxTokens || 4096,
      stream: true,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await this.fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: 'error', error: `Anthropic API error: ${response.status} - ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              yield { type: 'content', content: event.delta.text };
            } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
              // Tool call starting
            } else if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
              // Tool arguments streaming
            } else if (event.type === 'message_stop') {
              yield { type: 'done' };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private formatAnthropicMessages(messages: LLMMessage[], systemPrompt?: string): {
    systemPrompt?: string;
    formattedMessages: any[];
  } {
    let finalSystem = systemPrompt;
    const formattedMessages: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        finalSystem = finalSystem ? `${finalSystem}\n\n${msg.content}` : String(msg.content);
        continue;
      }

      const formatted: any = { role: msg.role === 'tool' ? 'user' : msg.role };

      if (msg.role === 'tool') {
        formatted.content = [{
          type: 'tool_result',
          tool_use_id: msg.toolCallId,
          content: String(msg.content),
        }];
      } else if (typeof msg.content === 'string') {
        formatted.content = msg.content;
      } else {
        formatted.content = msg.content.map(part => {
          if (part.type === 'text') return { type: 'text', text: part.text };
          if (part.type === 'image_url') return {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: part.image_url?.url },
          };
          return part;
        });
      }

      formattedMessages.push(formatted);
    }

    return { systemPrompt: finalSystem, formattedMessages };
  }

  // ==========================================================================
  // OpenAI API (works for OpenAI, OpenRouter, Groq, etc.)
  // ==========================================================================

  private async chatOpenAI(
    provider: ProviderConfig,
    model: string,
    messages: LLMMessage[],
    options: ChatOptions,
    apiKey?: string
  ): Promise<ChatResponse> {
    const formattedMessages = this.formatOpenAIMessages(messages, options.systemPrompt);
    
    const body: any = {
      model,
      messages: formattedMessages,
    };

    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || ''}`,
    };

    // OpenRouter specific headers
    if (provider.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://github.com/kayzaa/k.i.t.-bot';
      headers['X-Title'] = 'K.I.T. Trading Bot';
    }

    const response = await this.fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${provider.name} API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      id: string;
      choices: Array<{
        message: { content?: string; tool_calls?: ToolCall[] };
        finish_reason: string;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const choice = data.choices[0];
    
    return {
      id: data.id,
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      } : undefined,
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
    };
  }

  private async *streamOpenAI(
    provider: ProviderConfig,
    model: string,
    messages: LLMMessage[],
    options: ChatOptions,
    apiKey?: string
  ): AsyncGenerator<StreamChunk> {
    const formattedMessages = this.formatOpenAIMessages(messages, options.systemPrompt);
    
    const body: any = {
      model,
      messages: formattedMessages,
      stream: true,
    };

    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || ''}`,
    };

    if (provider.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://github.com/kayzaa/k.i.t.-bot';
      headers['X-Title'] = 'K.I.T. Trading Bot';
    }

    const response = await this.fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: 'error', error: `${provider.name} API error: ${response.status} - ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done' };
            continue;
          }

          try {
            const event = JSON.parse(data);
            const delta = event.choices?.[0]?.delta;
            
            if (delta?.content) {
              yield { type: 'content', content: delta.content };
            } else if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                yield { 
                  type: 'tool_call', 
                  toolCall: {
                    id: tc.id,
                    type: 'function',
                    function: tc.function,
                  }
                };
              }
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private formatOpenAIMessages(messages: LLMMessage[], systemPrompt?: string): any[] {
    const result: any[] = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'tool') {
        result.push({
          role: 'tool',
          content: String(msg.content),
          tool_call_id: msg.toolCallId,
        });
      } else {
        result.push({
          role: msg.role,
          content: msg.content,
          ...(msg.toolCalls && { tool_calls: msg.toolCalls }),
        });
      }
    }

    return result;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private parseModel(modelRef: string): { provider: string; model: string } {
    const parsed = parseModelRef(modelRef);
    if (parsed) return parsed;
    
    // Assume default provider if no slash
    return {
      provider: this.config.defaultProvider!,
      model: modelRef,
    };
  }

  private getApiKey(provider: string): string | undefined {
    // Check loaded keys first
    if (this.apiKeys.has(provider)) {
      return this.apiKeys.get(provider);
    }

    // Check environment
    const providerConfig = getProvider(provider);
    if (providerConfig?.apiKeyEnv) {
      return process.env[providerConfig.apiKeyEnv];
    }

    return undefined;
  }

  private loadApiKeys(keys?: Record<string, string>): void {
    if (keys) {
      for (const [provider, key] of Object.entries(keys)) {
        this.apiKeys.set(provider, key);
      }
    }
  }

  private async fetch(url: string, options: RequestInit): Promise<Response> {
    // Use global fetch (Node 18+)
    return fetch(url, {
      ...options,
      // @ts-ignore - timeout supported in Node 18+
      timeout: this.config.timeout,
    });
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createLLMClient(config?: LLMClientConfig): LLMClient {
  return new LLMClient(config);
}
