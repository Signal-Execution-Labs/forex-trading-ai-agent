/**
 * K.I.T. Tool-Enabled Chat Handler
 * Integrates the tool system with AI chat like OpenClaw
 */

import { WebSocket } from 'ws';
import { ToolRegistry, getToolRegistry, ToolDefinition, ToolContext } from '../tools/system/tool-registry';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatConfig {
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

// ============================================================================
// System Prompt
// ============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are K.I.T. (Knight Industries Trading), an autonomous AI financial agent.

You have access to a set of tools you can use to help users:

## Core Capabilities
- **File Operations**: Read, write, edit files in the workspace
- **Command Execution**: Run shell commands
- **Configuration**: Manage K.I.T. settings
- **Skills Management**: Enable/disable integrations (Telegram, Discord, exchanges)
- **Onboarding**: Guide new users through setup

## How to Use Tools
When you need to perform an action, use the appropriate tool. For example:
- To check status: use the \`status\` tool
- To read a file: use the \`read\` tool with the file path
- To configure settings: use \`config_set\` with path and value
- To enable Telegram: use \`skills_enable\` with skill="telegram"

## Onboarding New Users
If a user is new or hasn't completed setup:
1. Use \`onboarding_status\` to check their progress
2. If not started, use \`onboarding_start\` to begin
3. Guide them through each step using \`onboarding_continue\`

## Trading & Finance
You can help users with:
- Portfolio tracking and analysis
- Trading strategies
- Market research
- Risk management
- Tax tracking

Be helpful, concise, and proactive. If you can use a tool to help, do it without asking.`;

// ============================================================================
// Tool-Enabled Chat Handler
// ============================================================================

export class ToolEnabledChatHandler {
  private toolRegistry: ToolRegistry;
  private config: ChatConfig;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  constructor(config?: ChatConfig) {
    this.toolRegistry = getToolRegistry();
    this.config = {
      model: config?.model || 'claude-sonnet-4-20250514',
      systemPrompt: config?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      maxTokens: config?.maxTokens || 4096,
      temperature: config?.temperature || 0.7,
    };
  }

  /**
   * Get tool definitions for LLM
   */
  getToolDefinitions(): any[] {
    return this.toolRegistry.getDefinitions().map(def => ({
      type: 'function',
      function: {
        name: def.name,
        description: def.description,
        parameters: def.parameters,
      },
    }));
  }

  /**
   * Process a chat message with tool support
   */
  async processMessage(
    sessionId: string,
    userMessage: string,
    sendChunk: (chunk: string) => void,
    sendToolCall: (name: string, args: any) => void,
    sendToolResult: (name: string, result: any) => void
  ): Promise<string> {
    // Get or create conversation history
    let history = this.conversationHistory.get(sessionId) || [];
    
    // Add user message
    history.push({ role: 'user', content: userMessage });

    // Get API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!anthropicKey && !openaiKey) {
      const noKeyMessage = `I need an AI API key to respond intelligently. 

You can set one up by telling me your API key, or use these commands:
- \`config_set ai.providers.anthropic.apiKey YOUR_KEY\`
- Or set the ANTHROPIC_API_KEY environment variable

Would you like me to help you get started with setup?`;
      history.push({ role: 'assistant', content: noKeyMessage });
      this.conversationHistory.set(sessionId, history);
      return noKeyMessage;
    }

    // Call LLM with tools
    try {
      const response = await this.callLLMWithTools(
        history,
        sendChunk,
        sendToolCall,
        sendToolResult
      );

      // Add assistant response to history
      history.push({ role: 'assistant', content: response });
      this.conversationHistory.set(sessionId, history);

      // Keep history manageable
      if (history.length > 50) {
        history = history.slice(-40);
        this.conversationHistory.set(sessionId, history);
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Chat error:', errorMessage);
      return `I encountered an error: ${errorMessage}`;
    }
  }

  /**
   * Call LLM with tool support
   */
  private async callLLMWithTools(
    messages: ChatMessage[],
    sendChunk: (chunk: string) => void,
    sendToolCall: (name: string, args: any) => void,
    sendToolResult: (name: string, result: any) => void
  ): Promise<string> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    
    if (anthropicKey) {
      return this.callAnthropic(messages, sendChunk, sendToolCall, sendToolResult);
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      return this.callOpenAI(messages, sendChunk, sendToolCall, sendToolResult);
    }

    throw new Error('No AI API key configured');
  }

  /**
   * Call Anthropic Claude API with tools
   */
  private async callAnthropic(
    messages: ChatMessage[],
    sendChunk: (chunk: string) => void,
    sendToolCall: (name: string, args: any) => void,
    sendToolResult: (name: string, result: any) => void
  ): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const tools = this.getToolDefinitions().map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));

    // Format messages for Anthropic
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.role === 'tool' 
          ? [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }]
          : m.content,
      }));

    let fullResponse = '';
    let maxIterations = 10; // Prevent infinite loops

    while (maxIterations > 0) {
      maxIterations--;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          system: this.config.systemPrompt,
          messages: anthropicMessages,
          tools,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await response.json() as any;

      // Process content blocks
      for (const block of data.content || []) {
        if (block.type === 'text') {
          fullResponse += block.text;
          sendChunk(block.text);
        } else if (block.type === 'tool_use') {
          // Execute tool
          const toolName = block.name;
          const toolArgs = block.input;
          const toolId = block.id;

          sendToolCall(toolName, toolArgs);

          try {
            const result = await this.toolRegistry.execute(toolName, toolArgs);
            sendToolResult(toolName, result);

            // Add tool call and result to messages for next iteration
            anthropicMessages.push({
              role: 'assistant',
              content: [{ type: 'tool_use', id: toolId, name: toolName, input: toolArgs }] as any,
            });
            anthropicMessages.push({
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: toolId, content: JSON.stringify(result) }] as any,
            });
          } catch (error) {
            const errorResult = { error: error instanceof Error ? error.message : 'Tool execution failed' };
            sendToolResult(toolName, errorResult);
            
            anthropicMessages.push({
              role: 'assistant',
              content: [{ type: 'tool_use', id: toolId, name: toolName, input: toolArgs }] as any,
            });
            anthropicMessages.push({
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: toolId, content: JSON.stringify(errorResult), is_error: true }] as any,
            });
          }
        }
      }

      // Check if we need to continue (tool use) or stop
      if (data.stop_reason === 'end_turn' || data.stop_reason === 'stop_sequence') {
        break;
      }
      if (data.stop_reason !== 'tool_use') {
        break;
      }
    }

    return fullResponse;
  }

  /**
   * Call OpenAI API with tools
   */
  private async callOpenAI(
    messages: ChatMessage[],
    sendChunk: (chunk: string) => void,
    sendToolCall: (name: string, args: any) => void,
    sendToolResult: (name: string, result: any) => void
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    const tools = this.getToolDefinitions();

    // Format messages for OpenAI
    const openaiMessages: any[] = [
      { role: 'system', content: this.config.systemPrompt },
      ...messages.map(m => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            tool_call_id: m.toolCallId,
            content: m.content,
          };
        }
        return {
          role: m.role,
          content: m.content,
          tool_calls: m.toolCalls,
        };
      }),
    ];

    let fullResponse = '';
    let maxIterations = 10;

    while (maxIterations > 0) {
      maxIterations--;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: openaiMessages,
          tools,
          max_tokens: this.config.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json() as any;
      const choice = data.choices[0];
      const message = choice.message;

      if (message.content) {
        fullResponse += message.content;
        sendChunk(message.content);
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        openaiMessages.push(message);

        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          sendToolCall(toolName, toolArgs);

          try {
            const result = await this.toolRegistry.execute(toolName, toolArgs);
            sendToolResult(toolName, result);

            openaiMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            const errorResult = { error: error instanceof Error ? error.message : 'Tool execution failed' };
            sendToolResult(toolName, errorResult);

            openaiMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(errorResult),
            });
          }
        }
      } else {
        // No tool calls, we're done
        break;
      }

      if (choice.finish_reason === 'stop') {
        break;
      }
    }

    return fullResponse;
  }

  /**
   * Clear conversation history
   */
  clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }

  /**
   * Get conversation history
   */
  getHistory(sessionId: string): ChatMessage[] {
    return this.conversationHistory.get(sessionId) || [];
  }
}

// ============================================================================
// Singleton
// ============================================================================

let chatHandler: ToolEnabledChatHandler | null = null;

export function getToolEnabledChatHandler(): ToolEnabledChatHandler {
  if (!chatHandler) {
    chatHandler = new ToolEnabledChatHandler();
  }
  return chatHandler;
}
