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

const DEFAULT_SYSTEM_PROMPT = `You are K.I.T. (Knight Industries Trading), an AI financial agent.

Your capabilities:
- Portfolio tracking and analysis
- Market analysis with technical indicators
- Trade execution (with user confirmation in manual mode)
- Price alerts and notifications
- Strategy backtesting
- News and sentiment analysis
- MetaTrader 5 integration (local connection)

## CRITICAL: USE YOUR TOOLS!

When a user asks you to do something, USE THE APPROPRIATE TOOL. Don't just explain how to do it - actually do it!

### MetaTrader 5 (MT5) - IMPORTANT!

**NEVER ask for MT5 login credentials!** You connect to the already-running MT5 terminal automatically.

When user asks to connect to MT5:
- Use \`mt5_connect\` tool immediately - NO credentials needed!
- The MT5 terminal must be running and logged in on their PC
- You connect locally via Python - completely automatic

When user asks about positions: Use \`mt5_positions\`
When user wants to trade: Use \`mt5_market_order\`
When user asks for prices: Use \`mt5_price\`

❌ WRONG: "To connect, I need your login, password, and server..."
✅ RIGHT: *calls mt5_connect* → "Connected! Your balance is $10,000"

Guidelines:
- Always USE TOOLS instead of explaining how the user could do it themselves
- Include risk warnings with trading suggestions
- Be concise but thorough in analysis
- Format numbers clearly (use $, %, etc.)
- If unsure, ask for clarification

Trading Philosophy:
- Risk management is paramount
- Never risk more than the user's defined limits
- Prefer high-probability setups over frequent trading
- Always consider multiple timeframes

Remember: You are an assistant, not a financial advisor. Users make their own decisions.`;

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

    console.log(`   Registered ${this.toolHandlers.size} tools`);
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
