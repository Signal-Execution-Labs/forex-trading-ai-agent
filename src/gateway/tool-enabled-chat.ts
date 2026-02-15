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
- MT5/Forex: Nicht verbunden
- Crypto (Binance): Nicht verbunden
- Total: $34,909.60

📱 **Verbundene Channels:**
- ✅ Telegram @maxserverkay_bot
- ❌ WhatsApp (nicht verbunden)

⚡ **Bereit für:**
- 📈 Crypto Trading (Binance, Bybit, Kraken, DeFi)
- 💱 Forex Trading (MetaTrader 5)
- 📊 Aktien & ETFs (Alpaca, Interactive Brokers)
- 🎯 Binary Options (BinaryFaster - optional)
- 📉 Markt-Analyse & Technische Indikatoren
- 💼 Portfolio Tracking & Risk Management

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

### Market Analysis Tools (USE THESE FOR ANALYSIS!)
- \`analyze_market\` - Technical analysis for any symbol (BTC, ETH, EUR/USD, etc.)
- \`get_price\` - Get current price for any symbol
- \`get_market_overview\` - Overview of crypto, forex, stock markets

### Crypto Trading Tools
- \`get_price\` - Get prices from Binance, Bybit, Kraken
- \`analyze_market\` - RSI, MACD, Bollinger Bands, Support/Resistance
- \`place_order\` - Place buy/sell orders (paper trading mode)
- \`get_open_positions\` - View current positions
- \`close_position\` - Close a position

### Forex Trading Tools (MT5)
- \`mt5_connect\` - Connect to MetaTrader 5
- \`mt5_price\` - Get forex prices
- \`mt5_market_order\` - Place market orders
- \`mt5_positions\` - View MT5 positions

### Binary Options Tools (Optional)
- \`binary_login\` - Login to BinaryFaster
- \`binary_balance\` - Get account balance
- \`binary_call\` / \`binary_put\` - Place trades
- \`binary_auto_trade\` - Automated trading with Martingale

## IMPORTANT: Direct Platform Connection

When user wants to connect a platform, use the DIRECT tools:

**BinaryFaster:** Use \`binary_login\` with email and password
**Telegram:** Use \`telegram_setup\` with bot token
**WhatsApp:** Tell them to run \`kit whatsapp login\`

**DO NOT use onboarding tools for platform connections!**
Only use onboarding_start/onboarding_continue for initial K.I.T. setup (name, preferences).

## Onboarding Flow (AUTOMATIC AND STRICT!)

**CRITICAL: You MUST show the EXACT prompt returned by onboarding_continue!**

DO NOT:
- Make up your own questions
- Rephrase the prompts
- Skip steps
- Add extra questions not in the flow
- Summarize or shorten the options

The onboarding tool returns a \`prompt\` field - **COPY AND PASTE IT EXACTLY!**
The prompts contain numbered options (1-9) that the user needs to see.

Example: If the tool returns this prompt:
\`\`\`
🧠 AI Provider
1. Anthropic
2. OpenAI
...
\`\`\`
You MUST show ALL options exactly as returned, not summarize them!

**Flow:**
1. User gives answer (e.g., "Kay", "5", "1")
2. Call \`onboarding_continue\` with their answer
3. **Copy the returned \`prompt\` EXACTLY to your response**
4. Wait for user's answer
5. Call \`onboarding_continue\` again
6. Repeat until \`status: completed\`

**Onboarding Steps (in order):**
1. welcome - Ask name
2. goals - Financial objectives (1-5)
3. experience - Trading experience (1-4)
4. risk - Risk tolerance (1-4)
5. markets - Which markets (1,2,3...)
6. autonomy - Manual/Semi/Full (1-3)
7. timezone - Select timezone
8. ai_provider - API key setup
9. **channel_select - Telegram/WhatsApp/Discord selection**
10. channel_token - Bot token input
11. **telegram_chat_id - Chat ID input (REQUIRED for Telegram!)**
12. trading_style - Conservative/Balanced/Aggressive
13. finalize - Complete

**NEVER skip the channel steps! User MUST configure Telegram/WhatsApp!**

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

## Communication & Language
- Be friendly and helpful
- **Default language: ENGLISH**
- **ONLY switch language if user EXPLICITLY asks** (e.g., "speak German", "auf Deutsch", "parle français")
- Once user requests a language change, remember it and continue in that language
- During onboarding: ALWAYS use English regardless of user's input language
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

### MetaTrader 5 Tools (USE THESE! NO CREDENTIALS NEEDED!)
**CRITICAL: NEVER ask for MT5 login/password! K.I.T. connects to the already-running terminal automatically.**

- \`mt5_connect\` - Connect to running MT5 terminal (NO credentials needed!)
- \`mt5_account_info\` - Get account balance, equity, margin, leverage
- \`mt5_positions\` - Get all open positions
- \`mt5_market_order\` - Place a market order (buy/sell)
- \`mt5_close_position\` - Close a position by ticket
- \`mt5_price\` - Get current bid/ask for a symbol

**When user says "connect to MT5" or "verbinde mit MT5":**
1. Use \`mt5_connect\` tool IMMEDIATELY
2. Do NOT ask for login, password, or server
3. The MT5 terminal must be running and logged in on user's PC
4. K.I.T. connects via Python locally - completely automatic!

**Example MT5 workflow:**
\`\`\`
User: "connect to MT5"
→ Call mt5_connect
→ Response: "✅ Connected! Account: 12345, Balance: $10,000, Server: RoboForex-Demo"

User: "buy 0.1 EURUSD"
→ Call mt5_market_order with symbol="EURUSD", order_type="buy", volume=0.1
→ Response: "✅ Order executed! Ticket #67890, Price: 1.0856"
\`\`\`

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
// Onboarding Wizard State
// ============================================================================

interface OnboardingState {
  step: 'provider' | 'model' | 'apikey' | 'channel' | 'telegram_token' | 'telegram_chatid' | 'platform_select' | 'platform_config' | 'platform_more' | 'wallet_select' | 'wallet_config' | 'wallet_more' | 'skills' | 'user_name' | 'user_goals' | 'user_risk' | 'user_style' | 'complete';
  provider?: string;
  model?: string;
  channel?: string;
  telegramToken?: string;
  platforms?: { id: string; configured: boolean }[];
  currentPlatform?: string;
  wallets?: { id: string; configured: boolean }[];
  currentWallet?: string;
  skills?: string[];
  userName?: string;
  userGoals?: string;
  userRisk?: string;
  userStyle?: string;
}

const TRADING_PLATFORMS = [
  { id: 'binaryfaster', name: 'BinaryFaster', icon: '📊', configType: 'login', hint: 'Binary Options Trading', setupInfo: 'Email and password for wsauto.binaryfaster.com' },
  { id: 'metatrader5', name: 'MetaTrader 5', icon: '📈', configType: 'local', hint: 'Forex/CFD (Local Terminal)', setupInfo: 'K.I.T. connects to your installed MT5 terminal via Python. Make sure MT5 is running and logged into your broker.' },
  { id: 'binance', name: 'Binance', icon: '🟡', configType: 'apikey', hint: 'Crypto Exchange', setupInfo: 'API Key and Secret from binance.com/en/my/settings/api-management' },
  { id: 'kraken', name: 'Kraken', icon: '🐙', configType: 'apikey', hint: 'Crypto Exchange', setupInfo: 'API Key and Secret from kraken.com/u/security/api' },
  { id: 'coinbase', name: 'Coinbase', icon: '🔵', configType: 'apikey', hint: 'Crypto Exchange', setupInfo: 'API Key from coinbase.com/settings/api' },
  { id: 'bybit', name: 'Bybit', icon: '🔶', configType: 'apikey', hint: 'Crypto Exchange', setupInfo: 'API Key and Secret from bybit.com/user/api-management' },
  { id: 'tradingview', name: 'TradingView', icon: '📺', configType: 'webhook', hint: 'Chart Signals', setupInfo: 'Webhook URL for receiving TradingView alerts' },
];

const CRYPTO_WALLETS = [
  { id: 'metamask', name: 'MetaMask', icon: '🦊', configType: 'browser', hint: 'Ethereum & EVM', setupInfo: 'Connect via browser extension. K.I.T. will prompt for signature when needed.' },
  { id: 'walletconnect', name: 'WalletConnect', icon: '🔗', configType: 'qr', hint: 'Any Mobile Wallet', setupInfo: 'Scan QR code with your mobile wallet app' },
  { id: 'ledger', name: 'Ledger', icon: '🔐', configType: 'usb', hint: 'Hardware Wallet', setupInfo: 'Connect via USB. Make sure Ledger Live is closed.' },
  { id: 'trezor', name: 'Trezor', icon: '🛡️', configType: 'usb', hint: 'Hardware Wallet', setupInfo: 'Connect via USB. Approve on device.' },
  { id: 'phantom', name: 'Phantom', icon: '👻', configType: 'browser', hint: 'Solana Wallet', setupInfo: 'Connect via browser extension' },
  { id: 'rabby', name: 'Rabby', icon: '🐰', configType: 'browser', hint: 'Multi-Chain Wallet', setupInfo: 'Connect via browser extension' },
  { id: 'coinbasewallet', name: 'Coinbase Wallet', icon: '🔵', configType: 'browser', hint: 'Multi-Chain Wallet', setupInfo: 'Connect via browser extension or mobile' },
];

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },
  { id: 'google', name: 'Google/Gemini', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'] },
  { id: 'groq', name: 'Groq', models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  { id: 'xai', name: 'xAI', models: ['grok-beta', 'grok-2'] },
  { id: 'mistral', name: 'Mistral', models: ['mistral-large-latest', 'mistral-medium', 'mistral-small'] },
];

const CHANNELS = [
  { id: 'telegram', name: 'Telegram', icon: '📱' },
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬' },
  { id: 'discord', name: 'Discord', icon: '🎮' },
  { id: 'skip', name: 'Skip for now', icon: '⏭️' },
];

const SKILL_CATEGORIES = [
  { id: 'trading', name: '📈 Trading', skills: ['binary-options', 'metatrader', 'auto-trader', 'signal-copier'] },
  { id: 'stocks', name: '📊 Stocks & ETFs', skills: ['stock-portfolio', 'dividend-tracker', 'etf-manager', 'stock-screener'] },
  { id: 'crypto', name: '🪙 Crypto & DeFi', skills: ['exchange-connector', 'defi-connector', 'wallet-connector', 'airdrop-hunter'] },
  { id: 'swap', name: '🔄 Swap & Liquidity', skills: ['token-swap', 'liquidity-pools', 'yield-farming', 'arbitrage-finder'] },
  { id: 'analysis', name: '🔍 Analysis', skills: ['market-analysis', 'whale-tracker', 'portfolio-tracker', 'backtester'] },
  { id: 'web', name: '🌐 Web Tools', skills: ['web-search', 'web-fetch', 'browser-automation', 'image-analysis'] },
  { id: 'automation', name: '⏰ Automation', skills: ['cron-jobs', 'heartbeat', 'scheduled-tasks', 'alerts'] },
  { id: 'communication', name: '💬 Communication', skills: ['discord', 'slack', 'tts-voice', 'notifications'] },
  { id: 'advanced', name: '🚀 Advanced', skills: ['sub-agents', 'canvas-ui', 'session-management', 'memory-system'] },
];

const ENV_VARS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  groq: 'GROQ_API_KEY',
  xai: 'XAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
};

// ============================================================================

export class ToolEnabledChatHandler {
  private toolRegistry: ToolRegistry;
  private config: ChatConfig;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();
  private onboardingState: Map<string, OnboardingState> = new Map();

  constructor(config?: ChatConfig) {
    this.toolRegistry = getToolRegistry();
    
    // Log loaded tools for debugging
    const tools = this.toolRegistry.list();
    console.log(`   Chat handler loaded ${tools.length} tools`);
    const mt5Tools = tools.filter((t: { definition: { name: string } }) => t.definition.name.startsWith('mt5_'));
    console.log(`   MT5 Tools available: ${mt5Tools.length > 0 ? mt5Tools.map((t: { definition: { name: string } }) => t.definition.name).join(', ') : 'NONE'}`);
    
    // Load workspace context (like OpenClaw)
    let workspaceContext = '';
    try {
      const { buildWorkspacePrompt, ensureWorkspace } = require('../core/workspace-loader');
      ensureWorkspace();
      workspaceContext = buildWorkspacePrompt(true);
      console.log('   ✅ Workspace context loaded');
    } catch (e) {
      console.log('   ⚠️ Workspace loader not available:', e);
    }
    
    this.config = {
      model: config?.model || 'gpt-4o-mini',
      systemPrompt: (config?.systemPrompt || DEFAULT_SYSTEM_PROMPT) + workspaceContext,
      maxTokens: config?.maxTokens || 4096,
      temperature: config?.temperature || 0.7,
    };
  }

  /**
   * Handle onboarding wizard flow
   */
  private handleOnboardingWizard(sessionId: string, userMessage: string): string | null {
    const state = this.onboardingState.get(sessionId);
    const input = userMessage.trim();

    // Step 1: Provider Selection
    if (!state || state.step === 'provider') {
      const num = parseInt(input);
      if (num >= 1 && num <= PROVIDERS.length) {
        const provider = PROVIDERS[num - 1];
        this.onboardingState.set(sessionId, { step: 'model', provider: provider.id });
        
        let modelList = `✅ **${provider.name}** selected!\n\n`;
        modelList += `**Step 2/12: Choose your model:**\n\n`;
        provider.models.forEach((m, i) => {
          modelList += `  [${i + 1}] ${m}\n`;
        });
        modelList += `\n👉 Enter a number (1-${provider.models.length}):`;
        return modelList;
      }
      return null; // Not a valid selection, show initial prompt
    }

    // Step 2: Model Selection
    if (state.step === 'model' && state.provider) {
      const provider = PROVIDERS.find(p => p.id === state.provider);
      if (provider) {
        const num = parseInt(input);
        if (num >= 1 && num <= provider.models.length) {
          const model = provider.models[num - 1];
          this.onboardingState.set(sessionId, { ...state, step: 'apikey', model });
          
          return `✅ **${model}** selected!\n\n**Step 3/12: Enter your ${provider.name} API key:**\n\n💡 Get your key from:\n• OpenAI: https://platform.openai.com/api-keys\n• Anthropic: https://console.anthropic.com/\n• Google: https://aistudio.google.com/apikey\n\n👉 Paste your API key:`;
        }
      }
      return null;
    }

    // Step 3: API Key Input
    if (state.step === 'apikey' && state.provider && state.model) {
      // Check if it looks like an API key (at least 20 chars, no spaces)
      if (input.length >= 20 && !input.includes(' ')) {
        const envVar = ENV_VARS[state.provider];
        
        // Save to runtime
        process.env[envVar] = input;
        process.env.KIT_MODEL = state.model;
        
        // Save to .env file
        this.saveToEnvFile(envVar, input);
        this.saveToEnvFile('KIT_MODEL', state.model);
        
        // Move to channel selection
        this.onboardingState.set(sessionId, { ...state, step: 'channel' });
        
        const provider = PROVIDERS.find(p => p.id === state.provider);
        let msg = `✅ **${provider?.name}** configured with **${state.model}**!\n\n`;
        msg += `**Step 4/12: Connect a messaging channel:**\n\n`;
        CHANNELS.forEach((c, i) => {
          msg += `  [${i + 1}] ${c.icon} ${c.name}\n`;
        });
        msg += `\n👉 Enter a number (1-${CHANNELS.length}):`;
        return msg;
      }
      return null;
    }

    // Step 4: Channel Selection
    if (state.step === 'channel') {
      const num = parseInt(input);
      if (num >= 1 && num <= CHANNELS.length) {
        const channel = CHANNELS[num - 1];
        
        if (channel.id === 'skip') {
          // Skip to platforms
          this.onboardingState.set(sessionId, { ...state, step: 'platform_select', channel: 'none', platforms: [] });
          return this.getPlatformSelectPrompt();
        }
        
        if (channel.id === 'telegram') {
          this.onboardingState.set(sessionId, { ...state, step: 'telegram_token', channel: 'telegram' });
          return `✅ **Telegram** selected!\n\n**Step 5/12: Enter your Telegram Bot Token:**\n\n💡 Get your token from @BotFather on Telegram:\n1. Open Telegram, search for @BotFather\n2. Send /newbot and follow instructions\n3. Copy the token (looks like: 123456789:ABCdefGHI...)\n\n👉 Paste your bot token:`;
        }
        
        if (channel.id === 'whatsapp') {
          this.onboardingState.set(sessionId, { ...state, step: 'platform_select', channel: 'whatsapp', platforms: [] });
          return `✅ **WhatsApp** selected!\n\n📱 **WhatsApp Setup:**\nRun this command in terminal after setup:\n\`kit whatsapp login\`\n\nThen scan the QR code with WhatsApp.\n\n${this.getPlatformSelectPrompt()}`;
        }
        
        if (channel.id === 'discord') {
          this.onboardingState.set(sessionId, { ...state, step: 'platform_select', channel: 'discord', platforms: [] });
          return `✅ **Discord** selected!\n\n🎮 **Discord Setup:**\nAdd DISCORD_BOT_TOKEN to your .env file.\nGet it from: https://discord.com/developers/applications\n\n${this.getPlatformSelectPrompt()}`;
        }
      }
      return null;
    }

    // Step 5a: Telegram Token
    if (state.step === 'telegram_token') {
      // Telegram tokens look like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
      if (input.includes(':') && input.length > 30) {
        this.saveToEnvFile('TELEGRAM_BOT_TOKEN', input);
        process.env.TELEGRAM_BOT_TOKEN = input;
        
        this.onboardingState.set(sessionId, { ...state, step: 'telegram_chatid', telegramToken: input });
        return `✅ **Bot Token saved!**\n\n**Step 5b/6: Enter your Telegram Chat ID:**\n\n💡 Get your Chat ID:\n1. Send any message to your bot\n2. Visit: https://api.telegram.org/bot${input}/getUpdates\n3. Find "chat":{"id": YOUR_ID}\n\nOr use @userinfobot on Telegram.\n\n👉 Enter your Chat ID (numbers only):`;
      }
      return null;
    }

    // Step 5b: Telegram Chat ID
    if (state.step === 'telegram_chatid') {
      const chatId = parseInt(input);
      if (!isNaN(chatId)) {
        this.saveToEnvFile('TELEGRAM_CHAT_ID', input);
        process.env.TELEGRAM_CHAT_ID = input;
        
        this.onboardingState.set(sessionId, { ...state, step: 'platform_select', platforms: [] });
        return `✅ **Telegram configured!**\n\n${this.getPlatformSelectPrompt()}`;
      }
      return `👉 Enter your Chat ID (numbers only):`;
    }

    // Step 6a: Platform Selection
    if (state.step === 'platform_select') {
      // Skip option
      if (input === '0' || input.toLowerCase() === 'skip') {
        this.onboardingState.set(sessionId, { ...state, step: 'wallet_select', wallets: [] });
        return `⏭️ **Skipping platforms.**\n\n${this.getWalletSelectPrompt()}`;
      }
      
      const num = parseInt(input);
      if (num >= 1 && num <= TRADING_PLATFORMS.length) {
        const platform = TRADING_PLATFORMS[num - 1];
        this.onboardingState.set(sessionId, { ...state, step: 'platform_config', currentPlatform: platform.id });
        return this.getPlatformConfigPrompt(platform);
      }
      return this.getPlatformSelectPrompt();
    }

    // Step 6b: Platform Configuration (credentials)
    if (state.step === 'platform_config' && state.currentPlatform) {
      const platform = TRADING_PLATFORMS.find(p => p.id === state.currentPlatform);
      if (platform) {
        const lowerInput = input.toLowerCase().trim();
        
        // Handle different config types
        if (platform.configType === 'local' || platform.configType === 'webhook') {
          // Just need confirmation
          if (lowerInput === 'ready' || lowerInput === 'done' || lowerInput === 'yes') {
            const platforms = [...(state.platforms || []), { id: platform.id, configured: true }];
            this.onboardingState.set(sessionId, { ...state, step: 'platform_more', platforms, currentPlatform: undefined });
            return `✅ **${platform.name}** configured!\n\n**Add another trading platform?**\n\n  [1] ✅ Yes, add more\n  [2] ➡️ No, continue to wallets\n\n👉 Enter 1 or 2:`;
          }
          return this.getPlatformConfigPrompt(platform);
        }
        
        // For login/apikey, need actual credentials
        if (input.includes(':') || input.length > 10) {
          this.saveToEnvFile(`${platform.id.toUpperCase()}_CREDENTIALS`, input);
          
          const platforms = [...(state.platforms || []), { id: platform.id, configured: true }];
          this.onboardingState.set(sessionId, { ...state, step: 'platform_more', platforms, currentPlatform: undefined });
          
          return `✅ **${platform.name}** configured!\n\n**Add another trading platform?**\n\n  [1] ✅ Yes, add more\n  [2] ➡️ No, continue to wallets\n\n👉 Enter 1 or 2:`;
        }
        
        return this.getPlatformConfigPrompt(platform);
      }
    }

    // Step 6c: Add more platforms?
    if (state.step === 'platform_more') {
      if (input === '1' || input.toLowerCase() === 'yes') {
        this.onboardingState.set(sessionId, { ...state, step: 'platform_select' });
        return this.getPlatformSelectPrompt(state.platforms);
      }
      // Continue to wallets
      this.onboardingState.set(sessionId, { ...state, step: 'wallet_select', wallets: [] });
      const configuredPlatforms = (state.platforms || []).map(p => 
        TRADING_PLATFORMS.find(tp => tp.id === p.id)?.name || p.id
      ).join(', ');
      return `✅ **Platforms configured:** ${configuredPlatforms || 'None'}\n\n${this.getWalletSelectPrompt()}`;
    }

    // Step 7a: Wallet Selection
    if (state.step === 'wallet_select') {
      // Skip option
      if (input === '0' || input.toLowerCase() === 'skip') {
        this.onboardingState.set(sessionId, { ...state, step: 'skills', skills: [] });
        return `⏭️ **Skipping wallets.**\n\n${this.getSkillsPrompt(state)}`;
      }
      
      const num = parseInt(input);
      if (num >= 1 && num <= CRYPTO_WALLETS.length) {
        const wallet = CRYPTO_WALLETS[num - 1];
        this.onboardingState.set(sessionId, { ...state, step: 'wallet_config', currentWallet: wallet.id });
        return this.getWalletConfigPrompt(wallet);
      }
      return this.getWalletSelectPrompt();
    }

    // Step 7b: Wallet Configuration (browser/usb/qr - just confirmation)
    if (state.step === 'wallet_config' && state.currentWallet) {
      const wallet = CRYPTO_WALLETS.find(w => w.id === state.currentWallet);
      if (wallet) {
        const lowerInput = input.toLowerCase().trim();
        
        // All wallet types just need confirmation (no credentials stored!)
        if (lowerInput === 'ready' || lowerInput === 'done' || lowerInput === 'connected' || lowerInput === 'yes') {
          // Mark wallet as configured (no sensitive data stored)
          this.saveToEnvFile(`${wallet.id.toUpperCase()}_ENABLED`, 'true');
          
          const wallets = [...(state.wallets || []), { id: wallet.id, configured: true }];
          this.onboardingState.set(sessionId, { ...state, step: 'wallet_more', wallets, currentWallet: undefined });
          
          return `✅ **${wallet.name}** configured!\n\n**Add another wallet?**\n\n  [1] ✅ Yes, add more\n  [2] ➡️ No, continue to skills\n\n👉 Enter 1 or 2:`;
        }
        
        // Invalid input - show prompt again
        return this.getWalletConfigPrompt(wallet);
      }
    }

    // Step 7c: Add more wallets?
    if (state.step === 'wallet_more') {
      if (input === '1' || input.toLowerCase() === 'yes') {
        this.onboardingState.set(sessionId, { ...state, step: 'wallet_select' });
        return this.getWalletSelectPrompt(state.wallets);
      }
      // Continue to skills
      this.onboardingState.set(sessionId, { ...state, step: 'skills', skills: [] });
      const configuredWallets = (state.wallets || []).map(w => 
        CRYPTO_WALLETS.find(cw => cw.id === w.id)?.name || w.id
      ).join(', ');
      return `✅ **Wallets configured:** ${configuredWallets || 'None'}\n\n${this.getSkillsPrompt(state)}`;
    }

    // Step 7: Skills Selection (Multi-Select)
    if (state.step === 'skills') {
      const currentSkills = state.skills || [];
      
      // Check for "done" or "0"
      if (input.toLowerCase() === 'done' || input === '0') {
        const selectedNames = currentSkills.length > 0 
          ? currentSkills.map(id => SKILL_CATEGORIES.find(c => c.id === id)?.name || id).join(', ')
          : 'All skills';
        this.onboardingState.set(sessionId, { ...state, step: 'user_name' });
        return `✅ **Skills enabled:** ${selectedNames}\n\n---\n\n🎭 **Now let's get to know you!**\n\n**Step 9/12: What's your name?**\n\n👉 Enter your name:`;
      }
      
      // Check for "all" option
      const allOption = SKILL_CATEGORIES.length + 1;
      
      // Parse multiple numbers
      const nums = input.split(/[,\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      
      if (nums.length > 0) {
        // If "all" selected
        if (nums.includes(allOption)) {
          const allSkillIds = SKILL_CATEGORIES.map(c => c.id);
          this.onboardingState.set(sessionId, { ...state, step: 'user_name', skills: allSkillIds });
          return `✅ **ALL skills enabled!**\n\n---\n\n🎭 **Now let's get to know you!**\n\n**Step 9/12: What's your name?**\n\n👉 Enter your name:`;
        }
        
        const newSkills = [...currentSkills];
        const addedNames: string[] = [];
        
        for (const num of nums) {
          if (num >= 1 && num <= SKILL_CATEGORIES.length) {
            const cat = SKILL_CATEGORIES[num - 1];
            if (!newSkills.includes(cat.id)) {
              newSkills.push(cat.id);
              addedNames.push(cat.name);
            }
          }
        }
        
        if (addedNames.length > 0) {
          this.onboardingState.set(sessionId, { ...state, skills: newSkills });
          const allNames = newSkills.map(id => SKILL_CATEGORIES.find(c => c.id === id)?.name || id);
          return `✅ **Added:** ${addedNames.join(', ')}\n\n**Currently selected:** ${allNames.join(', ')}\n\n${this.getSkillsPrompt(state, true)}`;
        }
      }
      
      // Invalid input - repeat the prompt
      return this.getSkillsPrompt(state);
    }

    // Step 8: User Name
    if (state.step === 'user_name') {
      if (input.length >= 1) {
        this.onboardingState.set(sessionId, { ...state, step: 'user_goals', userName: input });
        return `✅ Nice to meet you, **${input}**!\n\n**Step 10/12: What are your financial goals?**\n\n  [1] 💰 Grow wealth steadily (long-term investing)\n  [2] 🚀 Aggressive growth (high risk, high reward)\n  [3] 💵 Generate passive income\n  [4] 🎯 Short-term trading profits\n  [5] 🛡️ Preserve capital, beat inflation\n\n👉 Enter a number (1-5):`;
      }
      return `👉 Please enter your name:`;
    }

    // Step 9: User Goals
    if (state.step === 'user_goals') {
      const goals = ['Grow wealth steadily', 'Aggressive growth', 'Generate passive income', 'Short-term trading profits', 'Preserve capital'];
      const num = parseInt(input);
      if (num >= 1 && num <= 5) {
        this.onboardingState.set(sessionId, { ...state, step: 'user_risk', userGoals: goals[num - 1] });
        return `✅ Goal: **${goals[num - 1]}**\n\n**Step 11/12: What's your risk tolerance?**\n\n  [1] 🐢 Conservative - Minimal risk, steady returns\n  [2] ⚖️ Balanced - Some risk for better returns\n  [3] 🔥 Aggressive - High risk, maximum potential\n\n👉 Enter a number (1-3):`;
      }
      return `👉 Please enter a number (1-5):`;
    }

    // Step 10: Risk Tolerance
    if (state.step === 'user_risk') {
      const risks = ['Conservative', 'Balanced', 'Aggressive'];
      const num = parseInt(input);
      if (num >= 1 && num <= 3) {
        this.onboardingState.set(sessionId, { ...state, step: 'user_style', userRisk: risks[num - 1] });
        return `✅ Risk: **${risks[num - 1]}**\n\n**Step 12/12: How should I communicate with you?**\n\n  [1] 📊 Professional - Formal, data-focused\n  [2] 😊 Friendly - Casual, supportive\n  [3] ⚡ Direct - Brief, action-oriented\n  [4] 🎓 Educational - Explain everything\n\n👉 Enter a number (1-4):`;
      }
      return `👉 Please enter a number (1-3):`;
    }

    // Step 11: Communication Style
    if (state.step === 'user_style') {
      const styles = ['Professional', 'Friendly', 'Direct', 'Educational'];
      const num = parseInt(input);
      if (num >= 1 && num <= 4) {
        const finalState = { ...state, userStyle: styles[num - 1] };
        
        // Generate and save SOUL.md and USER.md
        this.generateWorkspaceFiles(finalState);
        
        // Clear onboarding state
        this.onboardingState.delete(sessionId);
        
        return this.getFinalCompleteMessage(finalState);
      }
      return `👉 Please enter a number (1-4):`;
    }

    return null;
  }

  /**
   * Generate SOUL.md and USER.md from onboarding data
   */
  private generateWorkspaceFiles(state: OnboardingState): void {
    try {
      const workspaceDir = process.env.KIT_WORKSPACE || path.join(os.homedir(), '.kit');
      
      // SOUL.md - K.I.T.'s personality
      const soulContent = `# K.I.T. Soul

## Identity
I am K.I.T. (Knight Industries Trading), an autonomous AI financial agent.
My mission: "${state.userName}'s wealth is my mission."

## Communication Style
- Style: **${state.userStyle}**
- Adapted for ${state.userName}'s preferences

## Core Values
- Protect ${state.userName}'s capital above all
- Be transparent about risks and decisions
- Execute trades precisely as instructed
- Learn from wins and losses

## Personality
${state.userStyle === 'Professional' ? '- Formal and data-driven\n- Focus on metrics and analysis' : ''}
${state.userStyle === 'Friendly' ? '- Warm and supportive\n- Celebrate wins, encourage through losses' : ''}
${state.userStyle === 'Direct' ? '- Brief and action-oriented\n- No fluff, just results' : ''}
${state.userStyle === 'Educational' ? '- Explain reasoning behind decisions\n- Help user learn while trading' : ''}
`;
      fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), soulContent);

      // USER.md - User profile
      const userContent = `# User Profile

## Basic Info
- **Name:** ${state.userName}
- **Timezone:** ${Intl.DateTimeFormat().resolvedOptions().timeZone}

## Financial Profile
- **Goal:** ${state.userGoals}
- **Risk Tolerance:** ${state.userRisk}

## Preferences
- **Communication Style:** ${state.userStyle}
- **AI Provider:** ${state.provider}
- **Model:** ${state.model}
- **Primary Channel:** ${state.channel || 'Dashboard'}

## Notes
- Onboarding completed: ${new Date().toISOString()}
`;
      fs.writeFileSync(path.join(workspaceDir, 'USER.md'), userContent);
      
      console.log('[K.I.T.] Generated SOUL.md and USER.md');
    } catch (e) {
      console.error('[K.I.T.] Failed to generate workspace files:', e);
    }
  }

  /**
   * Get final completion message
   */
  private getFinalCompleteMessage(state: OnboardingState): string {
    const provider = PROVIDERS.find(p => p.id === state.provider);
    return `
🎉 **Welcome to K.I.T., ${state.userName}!**

Your personal AI financial agent is ready.

---

**📋 Your Profile:**
✅ AI: **${provider?.name}** (${state.model})
✅ Channel: **${state.channel || 'Dashboard'}**
✅ Goal: **${state.userGoals}**
✅ Risk: **${state.userRisk}**
✅ Style: **${state.userStyle}**

---

**🚀 What would you like to do?**

• "show portfolio" - View your balances
• "trade EUR/USD" - Start trading
• "analyze BTC" - Market analysis
• "set alert BTC > 100000" - Price alerts
• "help" - See all commands

*Your wealth is my mission.* 🏎️
`;
  }

  /**
   * Get platform selection prompt
   */
  private getPlatformSelectPrompt(configured?: { id: string }[]): string {
    const configuredIds = (configured || []).map(c => c.id);
    let msg = `**Step 6/12: Connect a Trading Platform:**\n\n`;
    
    if (configuredIds.length > 0) {
      msg += `*Already configured: ${configuredIds.map(id => TRADING_PLATFORMS.find(p => p.id === id)?.name).join(', ')}*\n\n`;
    }
    
    TRADING_PLATFORMS.forEach((p, i) => {
      const check = configuredIds.includes(p.id) ? '✅' : '';
      msg += `  [${i + 1}] ${p.icon} **${p.name}** ${check}\n      ${p.hint}\n\n`;
    });
    
    msg += `  [0] ⏭️ **Skip / Continue**\n`;
    msg += `\n👉 Select a platform (1-${TRADING_PLATFORMS.length}) or 0 to skip:`;
    return msg;
  }

  /**
   * Get platform configuration prompt
   */
  private getPlatformConfigPrompt(platform: typeof TRADING_PLATFORMS[0]): string {
    let msg = `✅ **${platform.name}** selected!\n\n`;
    msg += `📝 ${platform.setupInfo}\n\n`;
    
    switch (platform.configType) {
      case 'login':
        msg += `**Enter your login:**\n\n`;
        msg += `Format: \`email:password\`\n`;
        msg += `Example: \`myemail@example.com:mypassword123\`\n\n`;
        msg += `⚠️ *Credentials are stored locally and encrypted.*\n\n`;
        msg += `👉 Enter your ${platform.name} login:`;
        break;
        
      case 'apikey':
        msg += `**Enter your API credentials:**\n\n`;
        msg += `Format: \`apiKey:apiSecret\`\n`;
        msg += `Example: \`abc123xyz:secretkey456\`\n\n`;
        msg += `⚠️ *API keys are stored locally and encrypted.*\n`;
        msg += `💡 *Tip: Use read-only keys when possible for safety.*\n\n`;
        msg += `👉 Enter your ${platform.name} API Key and Secret:`;
        break;
        
      case 'local':
        msg += `**K.I.T. will connect to your local ${platform.name} installation.**\n\n`;
        msg += `✅ Make sure ${platform.name} is:\n`;
        msg += `   • Installed on this computer\n`;
        msg += `   • Running and logged into your broker\n`;
        msg += `   • "Allow Algo Trading" is enabled\n\n`;
        msg += `👉 Type "ready" when ${platform.name} is running:`;
        break;
        
      case 'webhook':
        msg += `**Set up webhook for ${platform.name} alerts:**\n\n`;
        msg += `Your K.I.T. webhook URL will be:\n`;
        msg += `\`http://localhost:18799/webhook/${platform.id}\`\n\n`;
        msg += `Add this URL in your ${platform.name} alert settings.\n\n`;
        msg += `👉 Type "done" when configured:`;
        break;
        
      default:
        msg += `👉 Type "done" to continue:`;
    }
    
    return msg;
  }

  /**
   * Get wallet selection prompt
   */
  private getWalletSelectPrompt(configured?: { id: string }[]): string {
    const configuredIds = (configured || []).map(c => c.id);
    let msg = `**Step 7/12: Connect a Crypto Wallet:**\n\n`;
    
    if (configuredIds.length > 0) {
      msg += `*Already configured: ${configuredIds.map(id => CRYPTO_WALLETS.find(w => w.id === id)?.name).join(', ')}*\n\n`;
    }
    
    CRYPTO_WALLETS.forEach((w, i) => {
      const check = configuredIds.includes(w.id) ? '✅' : '';
      msg += `  [${i + 1}] ${w.icon} **${w.name}** ${check}\n      ${w.hint}\n\n`;
    });
    
    msg += `  [0] ⏭️ **Skip / Continue**\n`;
    msg += `\n👉 Select a wallet (1-${CRYPTO_WALLETS.length}) or 0 to skip:`;
    return msg;
  }

  /**
   * Get wallet configuration prompt
   */
  private getWalletConfigPrompt(wallet: typeof CRYPTO_WALLETS[0]): string {
    let msg = `✅ **${wallet.name}** selected!\n\n`;
    msg += `📝 ${wallet.setupInfo}\n\n`;
    
    switch (wallet.configType) {
      case 'browser':
        msg += `**Browser Extension Connection:**\n\n`;
        msg += `1. Make sure ${wallet.name} extension is installed\n`;
        msg += `2. K.I.T. will prompt for connection when needed\n`;
        msg += `3. Approve the connection in your wallet\n\n`;
        msg += `🔒 *K.I.T. NEVER asks for your seed phrase!*\n`;
        msg += `🔒 *All transactions require your approval in the wallet.*\n\n`;
        msg += `👉 Type "ready" to continue:`;
        break;
        
      case 'qr':
        msg += `**WalletConnect Setup:**\n\n`;
        msg += `1. Open the K.I.T. dashboard in your browser\n`;
        msg += `2. Go to Settings → Wallets → WalletConnect\n`;
        msg += `3. Scan the QR code with your mobile wallet\n\n`;
        msg += `👉 Type "ready" when connected:`;
        break;
        
      case 'usb':
        msg += `**Hardware Wallet Connection:**\n\n`;
        msg += `1. Connect your ${wallet.name} via USB\n`;
        msg += `2. Unlock it with your PIN\n`;
        msg += `3. Open the relevant app (Ethereum, Bitcoin, etc.)\n\n`;
        msg += `⚠️ *Make sure Ledger Live / Trezor Suite is CLOSED*\n\n`;
        msg += `👉 Type "ready" when your device is connected:`;
        break;
        
      default:
        msg += `👉 Type "ready" to continue:`;
    }
    
    return msg;
  }

  /**
   * Get skills selection prompt
   */
  private getSkillsPrompt(state: OnboardingState, showSelected: boolean = false): string {
    let msg = `**Step 8/12: Choose your skill sets:**\n\n`;
    msg += `*(Multi-select: enter numbers like "1,2,4" or one at a time)*\n\n`;
    
    SKILL_CATEGORIES.forEach((cat, i) => {
      msg += `  [${i + 1}] **${cat.name}**\n      ${cat.skills.join(', ')}\n\n`;
    });
    msg += `  [${SKILL_CATEGORIES.length + 1}] 🚀 **Enable ALL skills**\n`;
    msg += `  [0] ⏭️ **Done selecting**\n`;
    msg += `\n👉 Enter numbers (or 0 to continue):`;
    return msg;
  }

  /**
   * Get setup complete message
   */
  private getSetupCompleteMessage(state: OnboardingState): string {
    const provider = PROVIDERS.find(p => p.id === state.provider);
    let msg = `\n🎉 **Setup Complete!**\n\n`;
    msg += `✅ AI Provider: **${provider?.name}** (${state.model})\n`;
    msg += `✅ Channel: **${state.channel || 'Dashboard'}**\n`;
    msg += `✅ Skills: **Enabled**\n\n`;
    msg += `**K.I.T. is ready!** Try these commands:\n\n`;
    msg += `• "show portfolio" - View your balances\n`;
    msg += `• "trade EUR/USD" - Start trading\n`;
    msg += `• "analyze BTC" - Market analysis\n`;
    msg += `• "help" - See all commands`;
    return msg;
  }

  /**
   * Save a key-value pair to .env file
   */
  private saveToEnvFile(key: string, value: string): void {
    try {
      const workspaceDir = process.env.KIT_WORKSPACE || path.join(os.homedir(), '.kit');
      const envFilePath = path.join(workspaceDir, '.env');
      
      if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
      }
      
      let envContent = fs.existsSync(envFilePath) ? fs.readFileSync(envFilePath, 'utf-8') : '';
      
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
      
      fs.writeFileSync(envFilePath, envContent.trim() + '\n');
    } catch (e) {
      console.error(`Failed to save ${key} to .env:`, e);
    }
  }

  /**
   * Get the initial onboarding prompt
   */
  private getOnboardingPrompt(sessionId: string): string {
    this.onboardingState.set(sessionId, { step: 'provider' });
    
    let prompt = `🚀 **Welcome to K.I.T.!** Let's set up your AI provider.\n\n`;
    prompt += `**Step 1/12: Choose your AI provider:**\n\n`;
    PROVIDERS.forEach((p, i) => {
      prompt += `  [${i + 1}] ${p.name}\n`;
    });
    prompt += `\n👉 Enter a number (1-${PROVIDERS.length}):`;
    return prompt;
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
   * Auto-detect API key type from user message and save it
   */
  private detectAndSaveApiKey(message: string): { provider: string; key: string } | null {
    const trimmed = message.trim();
    
    // Detect key patterns - order matters! More specific patterns first
    const patterns: { pattern: RegExp; provider: string; envVar: string }[] = [
      { pattern: /^sk-ant-[a-zA-Z0-9_-]{20,}$/, provider: 'Anthropic', envVar: 'ANTHROPIC_API_KEY' },
      { pattern: /^sk-proj-[a-zA-Z0-9_-]{20,}$/, provider: 'OpenAI', envVar: 'OPENAI_API_KEY' },
      { pattern: /^sk-[a-zA-Z0-9_-]{20,}$/, provider: 'OpenAI', envVar: 'OPENAI_API_KEY' },
      { pattern: /^gsk_[a-zA-Z0-9]{20,}$/, provider: 'Groq', envVar: 'GROQ_API_KEY' },
      { pattern: /^xai-[a-zA-Z0-9_-]{20,}$/, provider: 'xAI', envVar: 'XAI_API_KEY' },
      { pattern: /^AIza[a-zA-Z0-9_-]{20,}$/, provider: 'Google', envVar: 'GOOGLE_API_KEY' },
    ];

    for (const { pattern, provider, envVar } of patterns) {
      if (pattern.test(trimmed)) {
        // Save to environment (runtime)
        process.env[envVar] = trimmed;
        
        // Save to .env file for persistence
        try {
          const workspaceDir = process.env.KIT_WORKSPACE || path.join(os.homedir(), '.kit');
          const envFilePath = path.join(workspaceDir, '.env');
          
          let envContent = '';
          if (fs.existsSync(envFilePath)) {
            envContent = fs.readFileSync(envFilePath, 'utf-8');
          }
          
          // Update or add the key
          const regex = new RegExp(`^${envVar}=.*$`, 'm');
          if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${envVar}=${trimmed}`);
          } else {
            envContent += `\n${envVar}=${trimmed}`;
          }
          
          // Ensure workspace exists
          if (!fs.existsSync(workspaceDir)) {
            fs.mkdirSync(workspaceDir, { recursive: true });
          }
          
          fs.writeFileSync(envFilePath, envContent.trim() + '\n');
          console.log(`[K.I.T.] Saved ${provider} API key to ${envFilePath}`);
        } catch (error) {
          console.error('[K.I.T.] Failed to save API key to .env:', error);
        }
        
        return { provider, key: trimmed };
      }
    }
    
    return null;
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

    // =========================================================================
    // ONBOARDING WIZARD - CHECK FIRST! (continues even after API key is set)
    // =========================================================================
    const onboardingActive = this.onboardingState.has(sessionId);
    
    // Check for trigger words to START onboarding
    const triggerWords = ['start', 'setup', 'onboard', 'onboarding', 'begin', 'configure', 'config'];
    const lowerMessage = userMessage.toLowerCase().trim();
    if (!onboardingActive && triggerWords.includes(lowerMessage)) {
      const prompt = this.getOnboardingPrompt(sessionId);
      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: prompt });
      this.conversationHistory.set(sessionId, history);
      return prompt;
    }
    
    if (onboardingActive) {
      const wizardResponse = this.handleOnboardingWizard(sessionId, userMessage);
      if (wizardResponse) {
        history.push({ role: 'user', content: userMessage });
        history.push({ role: 'assistant', content: wizardResponse });
        this.conversationHistory.set(sessionId, history);
        return wizardResponse;
      }
    }

    // Get API key from multiple sources (env vars AND config.json)
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const xaiKey = process.env.XAI_API_KEY;
    
    // Also check config.json for API keys
    let configHasKey = false;
    try {
      const configPath = path.join(os.homedir(), '.kit', 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // Check if onboarded flag is set
        if (config.onboarded === true) {
          configHasKey = true; // Trust the onboarded flag
        }
        // Also check for API keys in config
        if (config.ai?.apiKey || config.ai?.providers?.openai?.apiKey || 
            config.ai?.providers?.anthropic?.apiKey || config.ai?.providers?.google?.apiKey) {
          configHasKey = true;
        }
      }
    } catch {}

    const hasApiKey = !!(anthropicKey || openaiKey || googleKey || groqKey || xaiKey || configHasKey);

    // =========================================================================
    // START ONBOARDING if no API key and not already in wizard
    // =========================================================================
    if (!hasApiKey && !onboardingActive) {
      // Start onboarding wizard
      const prompt = this.getOnboardingPrompt(sessionId);
      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: prompt });
      this.conversationHistory.set(sessionId, history);
      return prompt;
    }

    // If still no API key after wizard attempt, show prompt
    if (!hasApiKey) {
      const prompt = this.getOnboardingPrompt(sessionId);
      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: prompt });
      this.conversationHistory.set(sessionId, history);
      return prompt;
    }
    
    // Add user message
    history.push({ role: 'user', content: userMessage });

    // Call LLM with tools
    try {
      console.log('[Chat] Calling LLM with tools...');
      const response = await this.callLLMWithTools(
        history,
        sendChunk,
        sendToolCall,
        sendToolResult
      );
      console.log('[Chat] LLM response received, length:', response?.length || 0);

      // Add assistant response to history
      history.push({ role: 'assistant', content: response });
      this.conversationHistory.set(sessionId, history);
      console.log('[Chat] History updated');

      // Keep history manageable
      if (history.length > 50) {
        history = history.slice(-40);
        this.conversationHistory.set(sessionId, history);
      }

      console.log('[Chat] Returning response');
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Chat] Error:', errorMessage);
      return `I encountered an error: ${errorMessage}`;
    }
  }

  /**
   * Call LLM with tool support
   * Respects config provider setting, not just API key presence
   */
  private async callLLMWithTools(
    messages: ChatMessage[],
    sendChunk: (chunk: string) => void,
    sendToolCall: (name: string, args: any) => void,
    sendToolResult: (name: string, result: any) => void
  ): Promise<string> {
    // Load config to check configured provider
    let configuredProvider = 'openai'; // Default to OpenAI
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const configPath = path.join(os.homedir(), '.kit', 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        configuredProvider = config.ai?.provider || 'openai';
      }
    } catch (e) {
      // Use default
    }

    // Use configured provider first
    if (configuredProvider === 'openai' && process.env.OPENAI_API_KEY) {
      return this.callOpenAI(messages, sendChunk, sendToolCall, sendToolResult);
    }
    
    if (configuredProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      return this.callAnthropic(messages, sendChunk, sendToolCall, sendToolResult);
    }

    // Fallback: check any available API key
    if (process.env.OPENAI_API_KEY) {
      return this.callOpenAI(messages, sendChunk, sendToolCall, sendToolResult);
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      return this.callAnthropic(messages, sendChunk, sendToolCall, sendToolResult);
    }

    throw new Error('No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
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
    // OpenAI has a 128 tool limit - prioritize important tools
    const allTools = this.getToolDefinitions();
    const OPENAI_TOOL_LIMIT = 128;
    
    // Prioritize certain tool categories
    const priorityPrefixes = ['binary_', 'mt5_', 'trading_', 'memory_', 'read', 'write', 'exec', 'status', 'config_', 'telegram_', 'whatsapp_', 'onboarding_'];
    const priorityTools = allTools.filter((t: any) => 
      priorityPrefixes.some(prefix => t.function.name.startsWith(prefix))
    );
    const otherTools = allTools.filter((t: any) => 
      !priorityPrefixes.some(prefix => t.function.name.startsWith(prefix))
    );
    
    // Combine priority tools first, then fill remaining slots with other tools
    const tools = [
      ...priorityTools,
      ...otherTools.slice(0, Math.max(0, OPENAI_TOOL_LIMIT - priorityTools.length))
    ].slice(0, OPENAI_TOOL_LIMIT);
    
    if (allTools.length > OPENAI_TOOL_LIMIT) {
      console.log(`[OpenAI] Limited tools from ${allTools.length} to ${tools.length} (max 128)`);
    }

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

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      let response;
      try {
        console.log('[OpenAI] Sending request...');
        response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log('[OpenAI] Response status:', response.status);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('OpenAI API request timed out after 2 minutes');
        }
        throw new Error(`OpenAI fetch failed: ${fetchError.message}`);
      }

      if (!response.ok) {
        const error = await response.text();
        console.error('[OpenAI] API error:', error);
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json() as any;
      console.log('[OpenAI] Response received, choices:', data.choices?.length || 0);
      
      if (!data.choices || data.choices.length === 0) {
        console.error('[OpenAI] No choices in response:', JSON.stringify(data).slice(0, 500));
        throw new Error('OpenAI returned no choices');
      }
      
      const choice = data.choices[0];
      const message = choice.message;
      
      if (!message) {
        console.error('[OpenAI] No message in choice:', JSON.stringify(choice).slice(0, 500));
        throw new Error('OpenAI choice has no message');
      }

      if (message.content) {
        console.log('[OpenAI] Content received:', message.content.slice(0, 100) + '...');
        fullResponse += message.content;
        sendChunk(message.content);
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log('[OpenAI] Tool calls:', message.tool_calls.length);
        openaiMessages.push(message);

        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          console.log('[OpenAI] Executing tool:', toolName);
          
          let toolArgs;
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (parseError) {
            console.error('[OpenAI] Failed to parse tool args:', toolCall.function.arguments);
            toolArgs = {};
          }

          sendToolCall(toolName, toolArgs);

          try {
            console.log('[OpenAI] Calling tool registry for:', toolName);
            const result = await this.toolRegistry.execute(toolName, toolArgs);
            console.log('[OpenAI] Tool result received for:', toolName);
            sendToolResult(toolName, result);

            openaiMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (error: any) {
            console.error('[OpenAI] Tool execution error for', toolName, ':', error?.message || error);
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
        console.log('[OpenAI] Finish reason: stop, breaking loop');
        break;
      }
    }

    console.log('[OpenAI] Returning response, length:', fullResponse.length);
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
