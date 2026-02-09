/**
 * K.I.T. Chat Manager
 * Handles AI agent chat sessions with streaming support
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: { input: number; output: number };
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface ChatSession {
  id: string;
  agentId: string;
  channelId?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  status: 'idle' | 'processing' | 'aborted';
  currentRequestId?: string;
  model?: string;
  systemPrompt?: string;
}

export interface ChatSendParams {
  sessionId?: string;
  message: string;
  model?: string;
  stream?: boolean;
  tools?: string[];
  systemPrompt?: string;
}

export interface ChatSendResult {
  sessionId: string;
  messageId: string;
  requestId: string;
}

export interface ChatHistoryParams {
  sessionId: string;
  limit?: number;
  before?: string;
}

export interface ChatAbortParams {
  sessionId: string;
  requestId?: string;
}

export interface ChatStreamEvent {
  type: 'start' | 'chunk' | 'tool_call' | 'tool_result' | 'complete' | 'error';
  sessionId: string;
  requestId: string;
  data?: unknown;
}

export interface LLMProvider {
  chat(params: {
    messages: ChatMessage[];
    model?: string;
    stream?: boolean;
    tools?: ToolDefinition[];
    systemPrompt?: string;
    onChunk?: (chunk: string) => void;
    onToolCall?: (toolCall: ToolCall) => Promise<unknown>;
    signal?: AbortSignal;
  }): Promise<{
    content: string;
    tokens?: { input: number; output: number };
    toolCalls?: ToolCall[];
  }>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// Import LLMClient types for adapter
import type { LLMClient, LLMMessage as LLMClientMessage } from '../providers/llm-client';

/**
 * Adapter to use LLMClient as LLMProvider
 */
export function createLLMProviderFromClient(client: LLMClient): LLMProvider {
  return {
    async chat(params) {
      const messages: LLMClientMessage[] = params.messages.map(m => ({
        role: m.role,
        content: m.content,
      }));
      
      const tools = params.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      
      if (params.stream && params.onChunk) {
        // Streaming mode
        let content = '';
        const toolCalls: ToolCall[] = [];
        
        for await (const chunk of client.chatStream(messages, {
          model: params.model,
          tools,
          systemPrompt: params.systemPrompt,
          signal: params.signal,
        })) {
          if (chunk.type === 'content' && chunk.content) {
            content += chunk.content;
            params.onChunk(chunk.content);
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            toolCalls.push({
              id: chunk.toolCall.id,
              name: chunk.toolCall.function.name,
              arguments: JSON.parse(chunk.toolCall.function.arguments),
            });
            
            if (params.onToolCall) {
              await params.onToolCall({
                id: chunk.toolCall.id,
                name: chunk.toolCall.function.name,
                arguments: JSON.parse(chunk.toolCall.function.arguments),
              });
            }
          }
        }
        
        return {
          content,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
      } else {
        // Non-streaming mode
        const response = await client.chat(messages, {
          model: params.model,
          tools,
          systemPrompt: params.systemPrompt,
          signal: params.signal,
        });
        
        return {
          content: response.content,
          tokens: response.usage ? {
            input: response.usage.inputTokens,
            output: response.usage.outputTokens,
          } : undefined,
          toolCalls: response.toolCalls?.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          })),
        };
      }
    }
  };
}

// ============================================================================
// Chat Manager
// ============================================================================

export class ChatManager extends EventEmitter {
  private sessions: Map<string, ChatSession> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private llmProvider?: LLMProvider;
  private tools: Map<string, ToolDefinition> = new Map();
  private toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>> = new Map();

  constructor(private agentId: string) {
    super();
  }

  /**
   * Set the LLM provider
   */
  setProvider(provider: LLMProvider): void {
    this.llmProvider = provider;
  }

  /**
   * Register a tool
   */
  registerTool(
    definition: ToolDefinition,
    handler: (args: Record<string, unknown>) => Promise<unknown>
  ): void {
    this.tools.set(definition.name, definition);
    this.toolHandlers.set(definition.name, handler);
  }

  /**
   * Send a chat message
   */
  async send(params: ChatSendParams, clientId: string): Promise<ChatSendResult> {
    // Get or create session
    let session = params.sessionId 
      ? this.sessions.get(params.sessionId)
      : undefined;

    if (!session) {
      session = this.createSession(params.model, params.systemPrompt);
    }

    // Check if session is already processing
    if (session.status === 'processing') {
      throw new Error('Session is already processing a request');
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: params.message,
      timestamp: new Date(),
    };

    session.messages.push(userMessage);
    session.status = 'processing';
    session.updatedAt = new Date();

    const requestId = generateId();
    session.currentRequestId = requestId;

    // Create abort controller
    const abortController = new AbortController();
    this.abortControllers.set(requestId, abortController);

    // Emit start event
    this.emit('chat.start', {
      sessionId: session.id,
      requestId,
      clientId,
    });

    // Process in background
    this.processChat(session, requestId, params.stream ?? true, clientId, abortController.signal)
      .catch((error) => {
        this.emit('chat.error', {
          sessionId: session!.id,
          requestId,
          error: error.message,
        });
      })
      .finally(() => {
        this.abortControllers.delete(requestId);
        session!.status = 'idle';
        session!.currentRequestId = undefined;
      });

    return {
      sessionId: session.id,
      messageId: userMessage.id,
      requestId,
    };
  }

  /**
   * Get chat history
   */
  getHistory(params: ChatHistoryParams): ChatMessage[] {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      return [];
    }

    let messages = session.messages;

    // Filter by before cursor
    if (params.before) {
      const idx = messages.findIndex(m => m.id === params.before);
      if (idx > 0) {
        messages = messages.slice(0, idx);
      }
    }

    // Apply limit
    if (params.limit && params.limit > 0) {
      messages = messages.slice(-params.limit);
    }

    return messages;
  }

  /**
   * Abort a chat request
   */
  abort(params: ChatAbortParams): boolean {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      return false;
    }

    const requestId = params.requestId || session.currentRequestId;
    if (!requestId) {
      return false;
    }

    const controller = this.abortControllers.get(requestId);
    if (!controller) {
      return false;
    }

    controller.abort();
    session.status = 'aborted';

    this.emit('chat.aborted', {
      sessionId: session.id,
      requestId,
    });

    return true;
  }

  /**
   * Get session
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List sessions
   */
  listSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Abort if processing
    if (session.status === 'processing' && session.currentRequestId) {
      this.abort({ sessionId, requestId: session.currentRequestId });
    }

    this.sessions.delete(sessionId);
    return true;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create a new session
   */
  private createSession(model?: string, systemPrompt?: string): ChatSession {
    const session: ChatSession = {
      id: generateId(),
      agentId: this.agentId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'idle',
      model,
      systemPrompt,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Process chat with LLM
   */
  private async processChat(
    session: ChatSession,
    requestId: string,
    stream: boolean,
    clientId: string,
    signal: AbortSignal
  ): Promise<void> {
    if (!this.llmProvider) {
      throw new Error('No LLM provider configured');
    }

    // Get enabled tools
    const toolDefs = Array.from(this.tools.values());

    // Call LLM
    const response = await this.llmProvider.chat({
      messages: session.messages,
      model: session.model,
      stream,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      systemPrompt: session.systemPrompt,
      signal,
      onChunk: (chunk) => {
        this.emit('chat.chunk', {
          sessionId: session.id,
          requestId,
          clientId,
          chunk,
        });
      },
      onToolCall: async (toolCall) => {
        this.emit('chat.tool_call', {
          sessionId: session.id,
          requestId,
          clientId,
          toolCall,
        });

        // Execute tool
        const handler = this.toolHandlers.get(toolCall.name);
        if (!handler) {
          throw new Error(`Unknown tool: ${toolCall.name}`);
        }

        const result = await handler(toolCall.arguments);

        this.emit('chat.tool_result', {
          sessionId: session.id,
          requestId,
          clientId,
          toolCallId: toolCall.id,
          result,
        });

        return result;
      },
    });

    // Create assistant message
    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: {
        model: session.model,
        tokens: response.tokens,
        toolCalls: response.toolCalls,
      },
    };

    session.messages.push(assistantMessage);
    session.updatedAt = new Date();

    // Emit complete event
    this.emit('chat.complete', {
      sessionId: session.id,
      requestId,
      clientId,
      message: assistantMessage,
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  // Simple ID generation without external deps
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================================================
// Factory
// ============================================================================

export function createChatManager(agentId: string): ChatManager {
  return new ChatManager(agentId);
}
