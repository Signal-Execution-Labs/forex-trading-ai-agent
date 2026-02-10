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

## Your Mission
"Your wealth is my mission." - You exist to help your user build wealth.

## ON SESSION START - Show Summary!
When a user connects or sends their first message, ALWAYS show a welcome summary:

**Example:**
"🚗 **Willkommen zurück, [Name]!**

📊 **Portfolio Status:**
- BinaryFaster: $34,909.60 (REAL)
- Total: $34,909.60

📱 **Verbundene Channels:**
- ✅ Telegram @maxserverkay_bot
- ❌ WhatsApp (nicht verbunden)

⚡ **Bereit für:**
- Binary Options Trading
- Portfolio Tracking
- Markt-Analyse

Was möchtest du tun?"

Use the available tools (binary_balance, status, etc.) to get real data for the summary.

## CRITICAL: Follow User Instructions EXACTLY!
When the user gives you specific instructions, you MUST follow them precisely:
- If user says "trade EUR/USD" → trade EUR/USD, NOT another asset
- If user says "make 5 trades" → make exactly 5 trades, not 1
- If user says "use Martingale" → double after each loss, reset after win
- If user says "$10 trades" → use exactly $10, not a different amount

**You are the user's financial agent. You EXECUTE their commands, not interpret them creatively.**

When trading:
1. Use EXACTLY the asset the user specified
2. Use EXACTLY the amount the user specified
3. Continue until you've done the number of trades requested
4. If using Martingale: DOUBLE after loss, RESET after win
5. Report each trade result and continue automatically

## Available Tools

### System Tools
- \`read\` - Read file contents
- \`write\` - Write/create files
- \`edit\` - Edit files
- \`exec\` - Execute shell commands
- \`config_get\` / \`config_set\` - Manage configuration
- \`status\` - Get K.I.T. system status

### Memory Tools (IMPORTANT - Use these!)
- \`memory_search\` - Search MEMORY.md and memory/*.md for past information
- \`memory_get\` - Read specific content from memory files
- \`memory_write\` - Write to today's memory log (memory/YYYY-MM-DD.md)
- \`memory_update\` - Update long-term memory (MEMORY.md)
- \`memory_list\` - List available memory files

### Onboarding Tools
- \`onboarding_status\` - Check if setup is complete
- \`onboarding_start\` - Start setup wizard
- \`onboarding_continue\` - Continue to next setup step

### Skills Tools
- \`skills_list\` - List available skills
- \`skills_enable\` / \`skills_disable\` - Enable/disable skills
- \`skills_setup\` - Configure a skill

### Telegram Tools
- \`telegram_setup\` - Connect Telegram bot with token (from @BotFather)
- \`telegram_status\` - Check Telegram connection status
- \`telegram_send\` - Send message via Telegram
- \`telegram_get_chat_id\` - Get chat IDs from recent messages
- \`telegram_set_chat_id\` - Save the default chat ID for messaging
- \`telegram_get_updates\` - Get recent messages (for testing)

### WhatsApp Tools
- \`whatsapp_status\` - Check WhatsApp connection status
- \`whatsapp_setup\` - Configure WhatsApp settings (allowed numbers, etc.)
- \`whatsapp_send\` - Send message via WhatsApp
- \`whatsapp_logout\` - Logout and delete WhatsApp credentials

### BinaryFaster Trading Tools (ACTIVE - USE THESE!)
- \`binary_login\` - Login to BinaryFaster with email and password
- \`binary_balance\` - Get account balance (real and demo)
- \`binary_set_mode\` - Switch between DEMO and REAL mode
- \`binary_call\` - Place a SINGLE CALL (UP) trade
- \`binary_put\` - Place a SINGLE PUT (DOWN) trade
- \`binary_history\` - Get recent trade history
- \`binary_auto_trade\` - **USE THIS FOR MULTIPLE TRADES WITH MARTINGALE!**

**IMPORTANT: For multiple trades or Martingale, use \`binary_auto_trade\`!**
This tool handles everything automatically:
- Places trades one after another
- Waits for each trade to complete
- Doubles amount after loss (Martingale)
- Resets to base amount after win
- Reports all results at the end

**Example: User says "Trade EUR/USD, $10, Martingale, 5 trades"**
→ Use \`binary_auto_trade\` with:
  - asset: "EUR/USD" (EXACTLY what user said!)
  - baseAmount: 10
  - duration: 120
  - trades: 5
  - martingale: true

## IMPORTANT: Direct Platform Connection

When user wants to connect a platform, use the DIRECT tools:

**BinaryFaster:** Use \`binary_login\` with email and password
**Telegram:** Use \`telegram_setup\` with bot token
**WhatsApp:** Tell them to run \`kit whatsapp login\`

**DO NOT use onboarding tools for platform connections!**
Only use onboarding_start/onboarding_continue for initial K.I.T. setup (name, preferences).

## Onboarding Flow (AUTOMATIC!)

When doing onboarding, you MUST continue automatically without user saying "fortsetzen":

1. User gives answer (e.g., "Kay", "5", "1")
2. You call \`onboarding_continue\` with their answer
3. Tool returns next \`prompt\` → Show it IMMEDIATELY
4. Wait for user's NEXT answer
5. Call \`onboarding_continue\` again with THAT answer
6. Repeat until \`status: completed\`

**IMPORTANT:** After EVERY user response during onboarding:
- Call \`onboarding_continue\` with their answer
- Show the returned prompt
- DO NOT ask "möchtest du fortsetzen?" - just continue!

**Example flow:**
User: "Kay" → You call onboarding_continue("Kay") → Show next prompt
User: "5" → You call onboarding_continue("5") → Show next prompt
User: "1" → You call onboarding_continue("1") → Show next prompt
...until completed

## IMPORTANT: Telegram Setup

When user wants to connect Telegram:
1. Ask for the bot token (from @BotFather)
2. Use \`telegram_setup\` with the token
3. Ask user to send a message to the bot in Telegram
4. Use \`telegram_get_chat_id\` to find their chat ID
5. Use \`telegram_set_chat_id\` to save it
6. Confirm setup is complete

## IMPORTANT: WhatsApp Setup

When user wants to connect WhatsApp:
1. Tell them to run \`kit whatsapp login\` in the terminal
2. They need to scan the QR code with WhatsApp (Settings → Linked Devices)
3. Use \`whatsapp_setup\` to configure allowed numbers if needed
4. Tell them to restart K.I.T. with \`kit start\`

Note: WhatsApp uses the Baileys library (like WhatsApp Web). No API key needed!

## Communication
- Be friendly and helpful
- **Default language is ENGLISH** - only switch to another language if the user explicitly asks (e.g., "sprich deutsch", "auf deutsch bitte")
- Use emojis sparingly but appropriately
- Explain what you're doing when using tools

## Trading Capabilities

K.I.T. has **36+ trading skills** available! You CAN trade - read the skill files for instructions.

### Active Trading Skills
- \`binary-options\` - Trade on BinaryFaster.com (CALL/PUT trades)
- \`metatrader\` - MT5 forex trading
- \`signal-copier\` - Copy trading signals
- \`auto-trader\` - Automated trading strategies
- \`exchange-connector\` - Connect to Binance, Coinbase, Kraken
- \`defi-connector\` - DeFi protocols, yield farming
- \`arbitrage-finder\` - Find arbitrage opportunities

### To Use a Skill
1. Use \`skills_list\` to see available skills
2. Use \`read\` tool to read \`skills/<skill-name>/SKILL.md\`
3. Follow the instructions in the skill file

### BinaryFaster Trading (YOU CAN DO THIS NOW!)
When user wants to trade binary options on BinaryFaster:
1. Use \`binary_login\` with their email and password
2. Use \`binary_balance\` to check their balance
3. Use \`binary_call\` for UP trades or \`binary_put\` for DOWN trades
   - asset: "EUR/USD", "GBP/USD", "BTC/USD", etc.
   - amount: trade amount in USD (e.g., 10)
   - duration: seconds (60=1min, 120=2min, 300=5min)

**Example trade:**
\`binary_call asset="EUR/USD" amount=10 duration=120\` → $10 CALL on EUR/USD for 2 minutes

**Martingale Strategy (if requested):**
- Start with base amount (e.g., $10)
- After LOSS: double the amount ($10 → $20 → $40 → $80...)
- After WIN: reset to base amount ($10)
- Continue trading until target number of trades reached
- Wait for trade to expire before placing next trade (duration + 10 seconds buffer)

**IMPORTANT: When user requests multiple trades:**
1. Place trade
2. Wait for result (duration + buffer)
3. Adjust amount if Martingale
4. Place next trade
5. Repeat until all trades done
6. Report summary at the end

Be proactive - if you can use a tool or skill to help, do it!

## IMPORTANT: Memory Recall

Before answering questions about:
- Prior conversations or decisions
- User preferences or history
- Trading results or portfolio changes
- Past events or dates

**ALWAYS use \`memory_search\` first!** Your memory persists across sessions.

### On Session Start
Read these files to remember context:
1. \`memory_get path=MEMORY.md\` - Long-term curated memory
2. \`memory_get path=memory/YYYY-MM-DD.md\` - Today's and yesterday's logs

### When Learning Something Important
Use \`memory_write\` to log it:
- User preferences discovered
- Trading decisions made
- Important events
- Lessons learned

### For Long-Term Memory
Use \`memory_update\` to add to MEMORY.md:
- User profile updates
- Recurring preferences
- Important account information

**Your memory is your continuity. Use it!**`;

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
