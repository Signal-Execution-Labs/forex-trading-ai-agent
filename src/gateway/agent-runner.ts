/**
 * K.I.T. Agent Runner
 * 
 * Orchestrates the AI agent with LLM, tools, and chat
 * The "brain" that connects everything together
 */

import { EventEmitter } from 'eventemitter3';
import { ChatManager, createChatManager, createLLMProviderFromClient } from './chat-manager';
import { LLMClient, createLLMClient } from '../providers/llm-client';
import { getTradingTools, getMockHandlers } from '../tools/trading-tools';
import { loadConfig, KitConfig } from '../config';

// ============================================================================
// Types
// ============================================================================

export interface AgentRunnerConfig {
  agentId: string;
  agentName: string;
  model?: string;
  systemPrompt?: string;
  tools?: 'trading' | 'all' | 'none';
  apiKeys?: Record<string, string>;
}

export interface AgentStatus {
  running: boolean;
  model: string;
  toolsEnabled: string[];
  activeSessions: number;
  totalMessages: number;
}

// ============================================================================
// Default System Prompt
// ============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are K.I.T. (Knight Industries Trading), an autonomous AI financial agent.

## GOLDEN RULE: USE TOOLS, DON'T EXPLAIN!

When a user asks you to DO something, you CALL THE TOOL. Never explain how they could do it - just DO IT.

❌ WRONG: "To connect to MT5, you need to..."
✅ RIGHT: *calls mt5_connect tool* → "Connected! Balance: $10,000"

❌ WRONG: "To check your positions, you can use..."  
✅ RIGHT: *calls mt5_positions tool* → "You have 2 open positions..."

---

## YOUR TOOLS (USE THEM!)

### 📊 MetaTrader 5 (MT5) - NO CREDENTIALS NEEDED!
| Command | Tool | Notes |
|---------|------|-------|
| "connect to MT5" | \`mt5_connect\` | Auto-connects to running terminal |
| "show positions" | \`mt5_positions\` | Lists all open trades |
| "buy/sell X" | \`mt5_market_order\` | Execute trade |
| "close position" | \`mt5_close_position\` | Close by ticket |
| "price of EURUSD" | \`mt5_price\` | Current bid/ask |

⚠️ **NEVER ask for MT5 login/password!** The terminal is already logged in.

### 💰 Binary Options (BinaryFaster)
| Command | Tool |
|---------|------|
| "login to binary" | \`binary_login\` |
| "binary balance" | \`binary_balance\` |
| "place binary trade" | \`binary_trade\` |
| "trade history" | \`binary_history\` |

### 📁 File System
| Command | Tool |
|---------|------|
| "read file X" | \`read\` |
| "write to file" | \`write\` |
| "edit file" | \`edit\` |
| "list files" | \`list\` |

### 🧠 Memory
| Command | Tool |
|---------|------|
| "remember this" | \`memory_write\` |
| "what did we discuss" | \`memory_search\` |
| "get memory" | \`memory_get\` |

### 📱 Messaging
| Command | Tool |
|---------|------|
| "send telegram" | \`telegram_send\` |
| "send whatsapp" | \`whatsapp_send\` |
| "send discord" | \`discord_send\` |

### 🌐 Web
| Command | Tool |
|---------|------|
| "search for X" | \`web_search\` |
| "fetch URL" | \`web_fetch\` |

### 🖥️ Browser Automation
| Command | Tool |
|---------|------|
| "open browser" | \`browser_open\` |
| "navigate to" | \`browser_navigate\` |
| "screenshot" | \`browser_screenshot\` |
| "click element" | \`browser_click\` |

### ⏰ Scheduling
| Command | Tool |
|---------|------|
| "remind me" | \`cron_add\` |
| "list reminders" | \`cron_list\` |
| "cancel reminder" | \`cron_remove\` |

### 🎯 Skills (Auto-Activated)
| User Says | Skill |
|-----------|-------|
| "track portfolio" | portfolio-tracker |
| "copy signals" | signal-copier |
| "backtest strategy" | backtester |
| "connect exchange" | exchange-connector |
| "set alert" | alert-system |
| "analyze market" | market-analysis |
| "DeFi yield" | defi-connector |
| "tax report" | tax-tracker |

### 🔧 System
| Command | Tool |
|---------|------|
| "status" | \`status\` |
| "list skills" | \`skills_list\` |
| "enable skill X" | \`skills_enable\` |
| "config get X" | \`config_get\` |

---

## BEHAVIOR

1. **ALWAYS use tools** - Don't describe, execute!
2. **Be concise** - Show results, not explanations
3. **Risk first** - Warn about large trades
4. **Never ask for credentials** - MT5/exchanges connect automatically
5. **Format nicely** - Use tables, emojis, clear numbers

## TRADING PHILOSOPHY

- Risk management > profit chasing
- Cut losses, let winners run
- Paper trade first when testing
- Always use stop-loss

---

*"Your wealth is my mission."*`;


// ============================================================================
// Agent Runner
// ============================================================================

export class AgentRunner extends EventEmitter {
  private config: AgentRunnerConfig;
  private llmClient: LLMClient;
  private chatManager: ChatManager;
  private toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;
  private running: boolean = false;
  private messageCount: number = 0;

  constructor(config: AgentRunnerConfig) {
    super();
    this.config = config;
    this.toolHandlers = new Map();

    // Initialize LLM Client - use config.json AI settings if no model specified
    const kitConfig = loadConfig();
    
    // Determine model: CLI arg > config.ai > hardcoded default
    let effectiveModel = config.model;
    if (!effectiveModel && kitConfig.ai?.defaultProvider && kitConfig.ai?.defaultModel) {
      effectiveModel = `${kitConfig.ai.defaultProvider}/${kitConfig.ai.defaultModel}`;
    }
    if (!effectiveModel) {
      effectiveModel = 'openai/gpt-4o-mini'; // New default: OpenAI instead of Anthropic
    }
    
    // Update config with effective model
    this.config.model = effectiveModel;
    
    // Get API keys from config and env
    const configApiKeys: Record<string, string> = {};
    if (kitConfig.ai?.providers) {
      for (const [provider, provConfig] of Object.entries(kitConfig.ai.providers)) {
        if (provConfig?.apiKey) {
          configApiKeys[provider] = provConfig.apiKey;
        }
      }
    }
    // Also check top-level ai.apiKey
    if (kitConfig.ai?.apiKey && kitConfig.ai?.defaultProvider) {
      configApiKeys[kitConfig.ai.defaultProvider] = kitConfig.ai.apiKey;
    }
    
    this.llmClient = createLLMClient({
      defaultProvider: this.extractProvider(effectiveModel),
      defaultModel: this.extractModel(effectiveModel),
      apiKeys: {
        ...this.loadApiKeysFromEnv(),
        ...configApiKeys,
        ...config.apiKeys,
      },
    });

    // Initialize Chat Manager
    this.chatManager = createChatManager(config.agentId);

    // Setup tools
    this.setupTools(config.tools || 'trading');

    // Connect LLM to Chat Manager
    const provider = createLLMProviderFromClient(this.llmClient);
    this.chatManager.setProvider(provider);

    // Wire up events
    this.setupEvents();
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    if (this.running) return;

    console.log(`🤖 Starting K.I.T. Agent: ${this.config.agentName}`);
    console.log(`   Model: ${this.config.model}`);
    console.log(`   Tools: ${this.toolHandlers.size} enabled`);

    this.running = true;
    this.emit('started');
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    console.log('🛑 Stopping K.I.T. Agent...');
    this.running = false;
    this.emit('stopped');
  }

  /**
   * Send a message to the agent
   */
  async chat(
    message: string,
    options?: {
      sessionId?: string;
      clientId?: string;
      stream?: boolean;
    }
  ): Promise<{
    sessionId: string;
    requestId: string;
  }> {
    if (!this.running) {
      throw new Error('Agent is not running');
    }

    this.messageCount++;

    return this.chatManager.send({
      sessionId: options?.sessionId,
      message,
      model: this.config.model,
      stream: options?.stream ?? true,
      systemPrompt: this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    }, options?.clientId || 'agent-runner');
  }

  /**
   * Get agent status
   */
  getStatus(): AgentStatus {
    return {
      running: this.running,
      model: this.config.model || 'openai/gpt-4o-mini',
      toolsEnabled: Array.from(this.toolHandlers.keys()),
      activeSessions: this.chatManager.listSessions().filter(s => s.status === 'processing').length,
      totalMessages: this.messageCount,
    };
  }

  /**
   * Get chat manager for direct access
   */
  getChatManager(): ChatManager {
    return this.chatManager;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setupTools(toolSet: 'trading' | 'all' | 'none'): void {
    if (toolSet === 'none') return;

    // Get trading tools
    const tools = getTradingTools();
    const handlers = getMockHandlers(); // Use mock for now, replace with real later

    for (const tool of tools) {
      const handler = handlers[tool.name];
      if (handler) {
        this.toolHandlers.set(tool.name, handler);
        this.chatManager.registerTool(
          { name: tool.name, description: tool.description, parameters: tool.parameters },
          handler
        );
      }
    }

    // Register MT5 Tools (auto-connect, no credentials needed!)
    try {
      const { MT5_TOOLS, MT5_TOOL_HANDLERS } = require('../tools/mt5-tools');
      for (const tool of MT5_TOOLS) {
        const handler = MT5_TOOL_HANDLERS[tool.name];
        if (handler) {
          this.toolHandlers.set(tool.name, handler);
          this.chatManager.registerTool(
            { name: tool.name, description: tool.description, parameters: tool.parameters },
            handler
          );
        }
      }
      console.log(`   MT5 Tools: ${MT5_TOOLS.length} loaded`);
    } catch (err) {
      console.log(`   MT5 Tools: skipped (${err})`);
    }

    // Register Binary Options Tools
    try {
      const { getBinaryOptionsTools, getBinaryOptionsHandlers } = require('../tools/binary-options-tools');
      const binaryTools = getBinaryOptionsTools();
      const binaryHandlers = getBinaryOptionsHandlers();
      for (const tool of binaryTools) {
        const handler = binaryHandlers[tool.name];
        if (handler) {
          this.toolHandlers.set(tool.name, handler);
          this.chatManager.registerTool(
            { name: tool.name, description: tool.description, parameters: tool.parameters },
            handler
          );
        }
      }
      console.log(`   Binary Tools: ${binaryTools.length} loaded`);
    } catch (err) {
      console.log(`   Binary Tools: skipped (${err})`);
    }

    // Register Forum Tools
    try {
      const { forumTools } = require('../tools/forum-tools');
      for (const [name, tool] of Object.entries(forumTools)) {
        const t = tool as any;
        this.toolHandlers.set(t.name, t.execute.bind(t));
        this.chatManager.registerTool(
          { name: t.name, description: t.description, parameters: t.parameters },
          t.execute.bind(t)
        );
      }
      console.log(`   Forum Tools: ${Object.keys(forumTools).length} loaded`);
    } catch (err) {
      console.log(`   Forum Tools: skipped (${err})`);
    }

    // Register Proactive Agent Tools (autonomous features!)
    try {
      const { PROACTIVE_AGENT_TOOLS, handleProactiveAgentTool } = require('../tools/proactive-agent');
      for (const tool of PROACTIVE_AGENT_TOOLS) {
        const handler = async (args: any) => handleProactiveAgentTool(tool.name, args);
        this.toolHandlers.set(tool.name, handler);
        this.chatManager.registerTool(
          { name: tool.name, description: tool.description, parameters: tool.parameters },
          handler
        );
      }
      console.log(`   🤖 Proactive Agent Tools: ${PROACTIVE_AGENT_TOOLS.length} loaded`);
    } catch (err) {
      console.log(`   Proactive Agent Tools: skipped (${err})`);
    }

    console.log(`   Total Tools: ${this.toolHandlers.size} registered`);
    
    // List all registered tools for debugging
    console.log(`   Tool list: ${Array.from(this.toolHandlers.keys()).join(', ')}`);
  }

  private setupEvents(): void {
    // Forward chat events
    this.chatManager.on('chat.start', (data) => {
      this.emit('chat.start', data);
    });

    this.chatManager.on('chat.chunk', (data) => {
      this.emit('chat.chunk', data);
    });

    this.chatManager.on('chat.tool_call', (data) => {
      this.emit('chat.tool_call', data);
    });

    this.chatManager.on('chat.tool_result', (data) => {
      this.emit('chat.tool_result', data);
    });

    this.chatManager.on('chat.complete', (data) => {
      this.emit('chat.complete', data);
    });

    this.chatManager.on('chat.error', (data) => {
      this.emit('chat.error', data);
    });
  }

  private extractProvider(modelRef?: string): string {
    if (!modelRef) return 'openai';
    const parts = modelRef.split('/');
    return parts.length > 1 ? parts[0] : 'anthropic';
  }

  private extractModel(modelRef?: string): string {
    if (!modelRef) return 'gpt-4o-mini';
    const parts = modelRef.split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : modelRef;
  }

  private loadApiKeysFromEnv(): Record<string, string> {
    const keys: Record<string, string> = {};

    if (process.env.ANTHROPIC_API_KEY) {
      keys.anthropic = process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.OPENAI_API_KEY) {
      keys.openai = process.env.OPENAI_API_KEY;
    }
    if (process.env.OPENROUTER_API_KEY) {
      keys.openrouter = process.env.OPENROUTER_API_KEY;
    }
    if (process.env.GROQ_API_KEY) {
      keys.groq = process.env.GROQ_API_KEY;
    }
    if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
      keys.google = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY!;
    }

    return keys;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createAgentRunner(config: Partial<AgentRunnerConfig> = {}): AgentRunner {
  return new AgentRunner({
    agentId: config.agentId || 'main',
    agentName: config.agentName || 'K.I.T.',
    model: config.model || 'openai/gpt-4o-mini',
    systemPrompt: config.systemPrompt,
    tools: config.tools || 'trading',
    apiKeys: config.apiKeys,
  });
}

// ============================================================================
// Standalone CLI Runner
// ============================================================================

if (require.main === module) {
  const readline = require('readline');

  const agent = createAgentRunner({
    agentName: 'K.I.T. (CLI)',
    model: process.env.KIT_MODEL || 'openai/gpt-4o-mini',
  });

  // Collect streamed response
  let currentResponse = '';

  agent.on('chat.chunk', ({ chunk }) => {
    process.stdout.write(chunk);
    currentResponse += chunk;
  });

  agent.on('chat.tool_call', ({ toolCall }) => {
    console.log(`\n🔧 Calling tool: ${toolCall.name}`);
  });

  agent.on('chat.complete', () => {
    console.log('\n');
    currentResponse = '';
    rl.prompt();
  });

  agent.on('chat.error', ({ error }) => {
    console.error(`\n❌ Error: ${error}`);
    rl.prompt();
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '🤖 > ',
  });

  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                         K.I.T. CLI Chat                           ║
║                                                                   ║
║  Commands:                                                        ║
║    /status  - Show agent status                                   ║
║    /quit    - Exit                                                ║
║                                                                   ║
║  Try: "Analyze BTC/USDT" or "Show my portfolio"                   ║
╚═══════════════════════════════════════════════════════════════════╝
  `);

  agent.start().then(() => {
    rl.prompt();

    rl.on('line', async (line: string) => {
      const input = line.trim();

      if (input === '/quit' || input === '/exit') {
        await agent.stop();
        process.exit(0);
      }

      if (input === '/status') {
        console.log(JSON.stringify(agent.getStatus(), null, 2));
        rl.prompt();
        return;
      }

      if (!input) {
        rl.prompt();
        return;
      }

      try {
        await agent.chat(input);
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        rl.prompt();
      }
    });
  });
}
