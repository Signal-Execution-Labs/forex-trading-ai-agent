/**
 * K.I.T. Professional Onboarding System
 * Enterprise-grade financial agent setup
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler, ToolContext } from './tool-registry';

const CONFIG_DIR = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const WORKSPACE_DIR = path.join(CONFIG_DIR, 'workspace');
const ONBOARDING_STATE_PATH = path.join(CONFIG_DIR, 'onboarding.json');

// ============================================================================
// Types
// ============================================================================

interface OnboardingState {
  started: boolean;
  completed: boolean;
  currentStep: string;
  completedSteps: string[];
  data: Record<string, any>;
  startedAt?: string;
  completedAt?: string;
}

// ============================================================================
// State Management
// ============================================================================

function loadState(): OnboardingState {
  if (fs.existsSync(ONBOARDING_STATE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(ONBOARDING_STATE_PATH, 'utf8'));
    } catch {}
  }
  return { started: false, completed: false, currentStep: 'welcome', completedSteps: [], data: {} };
}

function saveState(state: OnboardingState): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(ONBOARDING_STATE_PATH, JSON.stringify(state, null, 2));
}

function loadConfig(): any {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

function saveConfig(config: any): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ============================================================================
// Workspace Files Generation
// ============================================================================

function generateSOUL(state: OnboardingState): string {
  const style = state.data.tradingStyle || 'balanced';
  return `# K.I.T. - Knight Industries Trading

## Identity
I am K.I.T., an autonomous AI financial agent. Your wealth is my mission.

## Trading Philosophy: ${style.toUpperCase()}
${style === 'conservative' ? 'I prioritize capital preservation. Lower risk, steady growth.' : ''}
${style === 'balanced' ? 'I balance risk and reward. Calculated positions with proper risk management.' : ''}
${style === 'aggressive' ? 'I seek high-return opportunities. Comfortable with volatility, always managing risk.' : ''}

## Core Directives
1. **Protect Capital** - Never risk more than configured limits
2. **Execute Precisely** - Fast, accurate trade execution
3. **Report Transparently** - Full visibility into all actions
4. **Learn Continuously** - Adapt strategies based on performance

## Boundaries
- Maximum position size: ${state.data.maxPositionSize || '10'}% of portfolio
- Daily loss limit: ${state.data.dailyLossLimit || '5'}%
- Only trade approved assets and markets
- Always confirm large trades unless in full-auto mode

---
*Generated: ${new Date().toISOString()}*
`;
}

function generateUSER(state: OnboardingState): string {
  return `# User Profile

## Identity
- **Name**: ${state.data.userName || 'Trader'}
- **Timezone**: ${state.data.timezone || 'UTC'}
- **Member Since**: ${new Date().toISOString().split('T')[0]}

## Trading Profile
- **Experience**: ${state.data.experience || 'Intermediate'}
- **Risk Tolerance**: ${state.data.riskTolerance || 'Moderate'}
- **Preferred Markets**: ${(state.data.markets || ['crypto', 'forex']).join(', ')}

## Goals
${state.data.goals || 'Build wealth through automated trading'}

## Autonomy Level
- **Mode**: ${state.data.autonomyLevel || 'semi-auto'}
- Semi-auto: K.I.T. suggests, you approve
- Full-auto: K.I.T. executes within limits

---
*Generated: ${new Date().toISOString()}*
`;
}

function generateAGENTS(state: OnboardingState): string {
  return `# K.I.T. Operating Instructions

## On Every Session
1. Read SOUL.md - Your directives
2. Read USER.md - Your user's profile
3. Check memory/YYYY-MM-DD.md for recent context
4. Load MEMORY.md for long-term knowledge

## Memory Protocol
- **Daily logs**: memory/YYYY-MM-DD.md
- **Long-term**: MEMORY.md (curated, important info)
- Always search memory before answering historical questions

## Trading Protocol
1. Check market conditions before trading
2. Verify risk parameters
3. Log all trades to memory
4. Report significant events to user

## Available Skills (37+)
Run \`skills_list\` to see all available trading skills.

Categories:
- Trading: binary-options, metatrader, auto-trader, signal-copier
- Analysis: market-analysis, sentiment-analyzer, whale-tracker
- Portfolio: portfolio-tracker, rebalancer, dividend-manager
- DeFi: defi-connector, arbitrage-finder, yield farming
- Risk: risk-calculator, lot-size-calculator, alert-system
- Reporting: tax-tracker, trade-journal, performance-report

## Channels
- Telegram, WhatsApp, Discord, Slack, Signal, and more
- Run \`status\` to check connected channels
`;
}

function generateMEMORY(state: OnboardingState): string {
  return `# K.I.T. Long-Term Memory

## User Profile
- Name: ${state.data.userName || 'Trader'}
- Experience: ${state.data.experience || 'Intermediate'}
- Risk Tolerance: ${state.data.riskTolerance || 'Moderate'}
- Markets: ${(state.data.markets || []).join(', ')}
- Goals: ${state.data.goals || 'Wealth building'}

## Configuration
- Trading Style: ${state.data.tradingStyle || 'balanced'}
- Autonomy: ${state.data.autonomyLevel || 'semi-auto'}
- AI Provider: ${state.data.aiProvider || 'anthropic'}

## Important Notes
*Add important long-term information here*

---
*Initialized: ${new Date().toISOString()}*
`;
}

// ============================================================================
// Onboarding Steps
// ============================================================================

interface Step {
  id: string;
  prompt: string;
  options?: { value: string; label: string }[];
  process: (input: string, state: OnboardingState, config: any) => { nextStep?: string; message: string; complete?: boolean };
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    prompt: `
🤖 **K.I.T. - Knight Industries Trading**
*Enterprise-Grade Autonomous Financial Agent*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **Step 1 of 13** - Welcome

Welcome. I am K.I.T., your autonomous financial agent.

**66 Professional Skills:**
🤖 AI & Analysis (8) - Predictions, sentiment, screening
📈 Trading (12) - Auto-trader, smart routing, options
🔄 Automation (10) - Grid bots, DCA, alerts
⚡ Arbitrage (5) - Cross-exchange, funding rate
🌐 DeFi (5) - Yield hunting, LP management
📡 Social (6) - Copy trading, whale tracking
🛡️ Risk & Tax (6) - Risk AI, tax calculator
💰 Portfolio (8) - Tracking, backtesting
🔗 Connectors (6) - Exchanges, MT5, TradingView

**What should I call you?**
    `.trim(),
    process: (input, state) => {
      state.data.userName = input.trim() || 'Trader';
      return { nextStep: 'goals', message: `Welcome, **${state.data.userName}**. Let's configure your trading environment.` };
    },
  },
  
  {
    id: 'goals',
    prompt: `
📋 **Step 2 of 13** - Financial Objectives

💰 What are your primary goals?

1. **Wealth Building** - Long-term portfolio growth
2. **Passive Income** - Dividends, yield, staking
3. **Active Trading** - Short-term profit opportunities
4. **Diversification** - Multi-asset portfolio management
5. **All of the above**

Select (1-5):
    `.trim(),
    process: (input, state) => {
      const goals: Record<string, string> = {
        '1': 'Long-term wealth building and portfolio growth',
        '2': 'Passive income through dividends, yield farming, and staking',
        '3': 'Active trading for short-term profit opportunities',
        '4': 'Portfolio diversification across multiple asset classes',
        '5': 'Comprehensive wealth management - growth, income, and trading',
      };
      state.data.goals = goals[input] || goals['5'];
      return { nextStep: 'experience', message: `Objective: ${state.data.goals}` };
    },
  },
  
  {
    id: 'experience',
    prompt: `
📋 **Step 3 of 13** - Trading Experience

📊 Your experience level determines how I communicate:

1. **Beginner** - New to trading, need guidance
2. **Intermediate** - Know the basics, some experience
3. **Advanced** - Active trader, understand markets
4. **Professional** - Full-time trader/fund manager

Select (1-4):
    `.trim(),
    process: (input, state) => {
      const exp = ['beginner', 'intermediate', 'advanced', 'professional'][parseInt(input) - 1] || 'intermediate';
      state.data.experience = exp;
      return { nextStep: 'risk', message: `Experience level: ${exp}` };
    },
  },
  
  {
    id: 'risk',
    prompt: `
📋 **Step 4 of 13** - Risk Profile

⚖️ How much risk can you tolerate?

1. **Conservative** - Capital preservation priority. Max 2% per trade.
2. **Moderate** - Balanced approach. Max 5% per trade.
3. **Aggressive** - Higher risk tolerance. Max 10% per trade.
4. **Very Aggressive** - Maximum opportunity seeking. Up to 20% per trade.

Select (1-4):
    `.trim(),
    process: (input, state) => {
      const risks = ['conservative', 'moderate', 'aggressive', 'very-aggressive'];
      const limits = ['2', '5', '10', '20'];
      const idx = parseInt(input) - 1;
      state.data.riskTolerance = risks[idx] || 'moderate';
      state.data.maxPositionSize = limits[idx] || '5';
      return { nextStep: 'markets', message: `Risk profile: ${state.data.riskTolerance} (max ${state.data.maxPositionSize}% per position)` };
    },
  },
  
  {
    id: 'markets',
    prompt: `
📋 **Step 5 of 13** - Target Markets

🌍 Which markets do you want to trade? (Select multiple: e.g., "1,2,3")

1. **Crypto** - Bitcoin, Ethereum, Altcoins
2. **Forex** - Currency pairs (EUR/USD, GBP/USD)
3. **Stocks** - Equities, ETFs
4. **Options** - Derivatives, Binary Options
5. **Commodities** - Gold, Oil, Silver
6. **DeFi** - Yield farming, liquidity provision

Select (e.g., 1,2,4):
    `.trim(),
    process: (input, state) => {
      const marketMap: Record<string, string> = { '1': 'crypto', '2': 'forex', '3': 'stocks', '4': 'options', '5': 'commodities', '6': 'defi' };
      // Split by comma or whitespace to handle both "1,2,3" and "1 2 3" and "1, 2, 3" formats
      const selections = input.split(/[,\s]+/).filter(n => n.trim());
      const markets = selections.map(n => marketMap[n.trim()]).filter(Boolean);
      state.data.markets = markets.length > 0 ? markets : ['crypto', 'forex'];
      return { nextStep: 'autonomy', message: `Markets: ${state.data.markets.join(', ')}` };
    },
  },
  
  {
    id: 'autonomy',
    prompt: `
📋 **Step 6 of 13** - Autonomy Level

🤖 How much control should K.I.T. have?

1. **Manual** - I suggest, you execute everything
2. **Semi-Auto** - I execute small trades, confirm large ones
3. **Full-Auto** - I manage everything within your risk limits

Select (1-3):
    `.trim(),
    process: (input, state) => {
      const levels = ['manual', 'semi-auto', 'full-auto'];
      state.data.autonomyLevel = levels[parseInt(input) - 1] || 'semi-auto';
      return { nextStep: 'timezone', message: `Autonomy: ${state.data.autonomyLevel}` };
    },
  },
  
  {
    id: 'timezone',
    prompt: `
📋 **Step 7 of 13** - Timezone

🕐 Select your timezone:

1. Europe/Berlin (CET)
2. Europe/London (GMT)
3. America/New_York (EST)
4. America/Los_Angeles (PST)
5. Asia/Tokyo (JST)
6. UTC

Select (1-6) or enter custom (e.g., "Europe/Vienna"):
    `.trim(),
    process: (input, state) => {
      const tzMap: Record<string, string> = { '1': 'Europe/Berlin', '2': 'Europe/London', '3': 'America/New_York', '4': 'America/Los_Angeles', '5': 'Asia/Tokyo', '6': 'UTC' };
      state.data.timezone = tzMap[input] || input.trim() || 'UTC';
      return { nextStep: 'ai_provider', message: `Timezone: ${state.data.timezone}` };
    },
  },
  
  {
    id: 'ai_provider',
    prompt: `
📋 **Step 8 of 13** - AI Provider

🧠 Which AI provider for K.I.T.'s intelligence?

**Cloud Providers:**
1. **Anthropic** (Claude) - Recommended for trading
2. **OpenAI** (GPT-4, GPT-4o)
3. **Google** (Gemini)
4. **xAI** (Grok)
5. **Groq** (Fast inference)
6. **Mistral** (European AI)

**Aggregators:**
7. **OpenRouter** (Access to 100+ models)

**Local:**
8. **Ollama** (Run models locally)

9. **Skip** (Configure later)

Select (1-9):
    `.trim(),
    process: (input, state) => {
      if (input === '9') {
        return { nextStep: 'channel_select', message: 'AI provider skipped. Configure later with `kit config`' };
      }
      const providers: Record<string, string> = {
        '1': 'anthropic', '2': 'openai', '3': 'google', '4': 'xai',
        '5': 'groq', '6': 'mistral', '7': 'openrouter', '8': 'ollama'
      };
      state.data.aiProvider = providers[input] || 'anthropic';
      
      if (input === '8') {
        return { nextStep: 'ollama_model', message: 'Ollama selected (local models)' };
      }
      return { nextStep: 'ai_model', message: `Provider: ${state.data.aiProvider}` };
    },
  },
  
  {
    id: 'ai_model',
    prompt: `
📋 **Step 9 of 13** - Model Selection

🤖 Select the model for your provider:

**Anthropic:**
1. claude-opus-4-5 (Most capable)
2. claude-sonnet-4 (Balanced)
3. claude-haiku-3-5 (Fast & cheap)

**OpenAI:**
4. gpt-4o (Latest)
5. gpt-4-turbo
6. gpt-4

**Google:**
7. gemini-2.0-pro
8. gemini-1.5-pro

**xAI:**
9. grok-2

**Groq:**
10. llama-3.3-70b
11. mixtral-8x7b

**Mistral:**
12. mistral-large
13. mistral-medium

**OpenRouter:**
14. anthropic/claude-sonnet-4
15. openai/gpt-4o

Select (1-15) or enter custom model ID:
    `.trim(),
    process: (input, state) => {
      const models: Record<string, string> = {
        '1': 'claude-opus-4-5-20251101', '2': 'claude-sonnet-4-20250514', '3': 'claude-3-5-haiku-20241022',
        '4': 'gpt-4o', '5': 'gpt-4-turbo', '6': 'gpt-4',
        '7': 'gemini-2.0-pro', '8': 'gemini-1.5-pro',
        '9': 'grok-2',
        '10': 'llama-3.3-70b-versatile', '11': 'mixtral-8x7b-32768',
        '12': 'mistral-large-latest', '13': 'mistral-medium-latest',
        '14': 'anthropic/claude-sonnet-4', '15': 'openai/gpt-4o'
      };
      state.data.aiModel = models[input] || input.trim();
      return { nextStep: 'ai_key', message: `Model: ${state.data.aiModel}` };
    },
  },
  
  {
    id: 'ollama_model',
    prompt: `
📋 **Step 9 of 13** - Ollama Local Model

🖥️ Enter the Ollama model name you have installed:

Common models:
- llama3.3 (Latest Llama)
- codellama (Coding)
- mistral (General)
- mixtral (Large)
- qwen2.5-coder (Coding)

Enter model name (e.g., llama3.3):
    `.trim(),
    process: (input, state, config) => {
      state.data.aiModel = input.trim() || 'llama3.3';
      config.ai = config.ai || { providers: {} };
      config.ai.providers.ollama = { enabled: true, model: state.data.aiModel };
      config.ai.defaultProvider = 'ollama';
      return { nextStep: 'channel_select', message: `✅ Ollama configured with model: ${state.data.aiModel}` };
    },
  },
  
  {
    id: 'ai_key',
    prompt: `
📋 **Step 10 of 13** - API Key

🔑 Enter your API key:

**Where to get it:**
- Anthropic: https://console.anthropic.com/
- OpenAI: https://platform.openai.com/api-keys
- Google: https://aistudio.google.com/app/apikey
- xAI: https://console.x.ai/
- Groq: https://console.groq.com/keys
- Mistral: https://console.mistral.ai/
- OpenRouter: https://openrouter.ai/keys

Paste your API key (or type "skip"):
    `.trim(),
    process: (input, state, config) => {
      const key = input.trim();
      
      // Allow "skip" to bypass
      if (key.toLowerCase() === 'skip') {
        // Still save provider/model selection even without key
        const provider = state.data.aiProvider || 'openai';
        const model = state.data.aiModel || 'gpt-4o-mini';
        config.ai = { defaultProvider: provider, defaultModel: model, providers: {} };
        return { nextStep: 'channel_select', message: '⏩ AI key skipped. Configure later with `kit config set ai.apiKey YOUR_KEY`' };
      }
      
      if (key.length < 20) {
        return { nextStep: 'ai_key', message: '⚠️ Key too short. Please paste your full API key, or type "skip" to continue.' };
      }
      
      // Auto-detect provider from key format
      let detectedProvider: string | null = null;
      const keyDetection: Record<string, RegExp> = {
        'anthropic': /^sk-ant-/,
        'openai': /^sk-(proj-)?[a-zA-Z0-9]/,
        'google': /^AIza/,
        'xai': /^xai-/,
        'groq': /^gsk_/,
        'openrouter': /^sk-or-/,
      };
      
      for (const [prov, pattern] of Object.entries(keyDetection)) {
        if (pattern.test(key)) {
          detectedProvider = prov;
          break;
        }
      }
      
      // Use detected provider or fall back to selected
      let provider = state.data.aiProvider || 'openai';
      let model = state.data.aiModel;
      
      // If detected provider differs from selected, auto-correct with warning
      if (detectedProvider && detectedProvider !== provider) {
        provider = detectedProvider;
        // Set appropriate default model for detected provider
        const defaultModels: Record<string, string> = {
          'anthropic': 'claude-sonnet-4-20250514',
          'openai': 'gpt-4o-mini',
          'google': 'gemini-2.0-flash',
          'xai': 'grok-2',
          'groq': 'llama-3.3-70b-versatile',
          'openrouter': 'openai/gpt-4o-mini',
        };
        model = defaultModels[provider] || model;
        state.data.aiProvider = provider;
        state.data.aiModel = model;
      }
      
      // Default model if none set
      if (!model) {
        model = provider === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-20250514';
        state.data.aiModel = model;
      }
      
      // Save to config
      config.ai = config.ai || {};
      config.ai.defaultProvider = provider;
      config.ai.defaultModel = model;
      config.ai.apiKey = key;  // Store key at top level for easy access
      config.ai.providers = config.ai.providers || {};
      config.ai.providers[provider] = { 
        apiKey: key, 
        enabled: true, 
        model: model 
      };
      
      // Set environment variable
      const envKeys: Record<string, string> = {
        'anthropic': 'ANTHROPIC_API_KEY',
        'openai': 'OPENAI_API_KEY',
        'google': 'GEMINI_API_KEY',
        'xai': 'XAI_API_KEY',
        'groq': 'GROQ_API_KEY',
        'mistral': 'MISTRAL_API_KEY',
        'openrouter': 'OPENROUTER_API_KEY'
      };
      if (envKeys[provider]) {
        process.env[envKeys[provider]] = key;
      }
      
      const detected = detectedProvider ? ` (auto-detected from key format)` : '';
      return { nextStep: 'channel_select', message: `✅ **${provider.toUpperCase()}** configured${detected}\n   Model: ${model}\n   Key: ${key.substring(0, 10)}...${key.substring(key.length - 4)}` };
    },
  },
  
  {
    id: 'channel_select',
    prompt: `
📋 **Step 11 of 13** - Communication Channels

📱 How do you want to communicate with K.I.T.?

**Ready:**
1. Telegram - Bot token from @BotFather
2. WhatsApp - Scan QR code (like WhatsApp Web)
3. Discord - Bot token from Discord Developer Portal

**Beta:**
4. Slack - Workspace integration
5. Signal - Encrypted messaging

**Other:**
6. Dashboard only (http://localhost:18799)
7. Configure channels later

Select (1-7):
    `.trim(),
    process: (input, state) => {
      const choice = parseInt(input);
      if (choice === 6 || choice === 7) {
        return { nextStep: 'trading_style', message: choice === 6 ? 'Using dashboard only' : 'Channels skipped - configure later with CLI' };
      }
      const channels: Record<number, string> = { 1: 'telegram', 2: 'whatsapp', 3: 'discord', 4: 'slack', 5: 'signal' };
      state.data.selectedChannel = channels[choice] || 'telegram';
      
      if (choice === 2) {
        return { nextStep: 'whatsapp_info', message: 'WhatsApp selected' };
      }
      return { nextStep: 'channel_token', message: `${state.data.selectedChannel} selected` };
    },
  },
  
  {
    id: 'channel_token',
    prompt: `
📋 **Step 12 of 13** - Channel Setup

🔧 Enter your bot token:

**Telegram:** Get from @BotFather → /newbot
**Discord:** Developer Portal → Bot → Token
**Slack:** App Settings → OAuth Tokens
    `.trim(),
    process: (input, state, config) => {
      const token = input.trim();
      const channel = state.data.selectedChannel;
      if (token.length < 20) {
        return { nextStep: 'trading_style', message: 'Invalid token. Skipping channel setup.' };
      }
      config.channels = config.channels || {};
      config.channels[channel] = { enabled: true, token };
      state.data.channelToken = token;
      
      // If Telegram, ask for chat ID
      if (channel === 'telegram') {
        return { nextStep: 'telegram_chat_id', message: `✅ Telegram token saved` };
      }
      return { nextStep: 'trading_style', message: `✅ ${channel} configured` };
    },
  },
  
  {
    id: 'telegram_chat_id',
    prompt: `
📋 **Step 12b of 13** - Telegram Chat ID

📱 K.I.T. needs your Chat ID to send you messages.

**How to get it:**
1. Send a message to your bot on Telegram
2. Visit: https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
3. Look for "chat":{"id": YOUR_CHAT_ID}

Or use the telegram_get_chat_id tool after sending a message to your bot.

**Enter your Telegram Chat ID** (e.g., 988209153):
    `.trim(),
    process: (input, state, config) => {
      const chatId = input.trim();
      if (!chatId || isNaN(parseInt(chatId))) {
        return { nextStep: 'trading_style', message: '⚠️ Invalid Chat ID. You can set it later with `telegram_set_chat_id`' };
      }
      config.channels = config.channels || {};
      config.channels.telegram = config.channels.telegram || { enabled: true, token: state.data.channelToken };
      config.channels.telegram.chatId = chatId;
      return { nextStep: 'trading_style', message: `✅ Telegram fully configured! Chat ID: ${chatId}` };
    },
  },
  
  {
    id: 'whatsapp_info',
    prompt: `
📋 **Step 12 of 13** - WhatsApp Setup

📱 WhatsApp requires scanning a QR code (like WhatsApp Web).

After onboarding, run:
\`kit whatsapp login\`

Then scan the QR with:
WhatsApp → Settings → Linked Devices

**Enter your phone number** (for allowlist, e.g., +1234567890):
Or press Enter to skip:
    `.trim(),
    process: (input, state, config) => {
      const phone = input.trim();
      config.channels = config.channels || {};
      config.channels.whatsapp = { enabled: true, allowedNumbers: phone ? [phone] : [] };
      return { nextStep: 'trading_style', message: phone ? `✅ WhatsApp configured. Allowlist: ${phone}` : '✅ WhatsApp configured. Run `kit whatsapp login` to connect.' };
    },
  },
  
  {
    id: 'trading_style',
    prompt: `
📋 **Step 13 of 13** - Trading Style

📈 How should K.I.T. approach trading?

1. **Conservative** - Focus on risk, prefer safer opportunities
2. **Balanced** - Equal weight to risk and opportunity
3. **Aggressive** - Seek high-return opportunities

Select (1-3):
    `.trim(),
    process: (input, state) => {
      const styles = ['conservative', 'balanced', 'aggressive'];
      state.data.tradingStyle = styles[parseInt(input) - 1] || 'balanced';
      return { nextStep: 'finalize', message: `Trading style: ${state.data.tradingStyle}` };
    },
  },
  
  {
    id: 'finalize',
    prompt: '',
    process: (input, state, config) => {
      // Create workspace
      if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
      if (!fs.existsSync(path.join(WORKSPACE_DIR, 'memory'))) fs.mkdirSync(path.join(WORKSPACE_DIR, 'memory'), { recursive: true });
      
      // Generate files
      fs.writeFileSync(path.join(WORKSPACE_DIR, 'SOUL.md'), generateSOUL(state));
      fs.writeFileSync(path.join(WORKSPACE_DIR, 'USER.md'), generateUSER(state));
      fs.writeFileSync(path.join(WORKSPACE_DIR, 'AGENTS.md'), generateAGENTS(state));
      fs.writeFileSync(path.join(WORKSPACE_DIR, 'MEMORY.md'), generateMEMORY(state));
      
      // Save user config
      config.user = {
        name: state.data.userName,
        timezone: state.data.timezone,
        experience: state.data.experience,
        riskTolerance: state.data.riskTolerance,
        markets: state.data.markets,
        goals: state.data.goals,
        autonomyLevel: state.data.autonomyLevel,
      };
      config.trading = {
        style: state.data.tradingStyle,
        maxPositionSize: parseFloat(state.data.maxPositionSize || '5'),
      };
      config.onboarded = true;
      config.version = '2.0.0';
      saveConfig(config);
      
      state.completed = true;
      state.completedAt = new Date().toISOString();
      saveState(state);
      
      return {
        complete: true,
        message: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ **K.I.T. CONFIGURATION COMPLETE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Profile:** ${state.data.userName}
**Markets:** ${(state.data.markets || []).join(', ')}
**Risk:** ${state.data.riskTolerance} (${state.data.maxPositionSize}% max position)
**Autonomy:** ${state.data.autonomyLevel}
**Style:** ${state.data.tradingStyle}

**🛠️ 66 Skills Ready:**
• 🤖 AI & Analysis (8): predictions, sentiment, screening
• 📈 Trading (12): auto-trader, smart router, options
• 🔄 Automation (10): grid bots, DCA, alerts
• ⚡ Arbitrage (5): cross-exchange, funding rate
• 🌐 DeFi (5): yield hunting, LP management
• 📡 Social (6): copy trading, whale tracker
• 🛡️ Risk & Tax (6): risk AI, tax calculator
• 💰 Portfolio (8): tracking, backtesting
• 🔗 Connectors (6): exchanges, MT5, TradingView

**Files Created:**
• SOUL.md - Agent directives
• USER.md - Your profile
• AGENTS.md - Operating instructions
• MEMORY.md - Long-term memory

**Next Steps:**
1. Run \`kit start\` to launch the gateway
2. Open http://localhost:18799 for dashboard
${state.data.selectedChannel === 'whatsapp' ? '3. Run `kit whatsapp login` to connect WhatsApp' : ''}
${state.data.selectedChannel === 'telegram' ? '3. Message your Telegram bot to start trading' : ''}

**Commands:**
• \`kit status\` - Check system status
• \`kit skills\` - List all 66 skills
• \`kit onboard\` - Re-run setup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*"Your wealth is my mission."* 🚀
        `.trim(),
      };
    },
  },
];

// ============================================================================
// Tool Definitions
// ============================================================================

export const onboardingStartToolDefinition: ToolDefinition = {
  name: 'onboarding_start',
  description: 'Start or restart K.I.T. onboarding. Use reset=true to reconfigure. When reset=true with existing config, confirm=true is required.',
  parameters: {
    type: 'object',
    properties: {
      reset: { type: 'boolean', description: 'Reset and start fresh (requires confirm=true if config exists)' },
      confirm: { type: 'boolean', description: 'Confirm reset of existing configuration' },
    },
    required: [],
  },
};

export const onboardingStartToolHandler: ToolHandler = async (args) => {
  const { reset = false, confirm = false } = args as { reset?: boolean; confirm?: boolean };
  let state = loadState();
  const existingConfig = loadConfig();
  const hasExistingConfig = existingConfig.onboarded === true || state.completed;
  
  // Safety check: require confirmation for reset when config exists
  if (reset && hasExistingConfig && !confirm) {
    return {
      status: 'confirmation_required',
      message: `⚠️ **Reset Confirmation Required**\n\nYou have an existing K.I.T. configuration:\n- User: ${existingConfig.user?.name || state.data.userName || 'Unknown'}\n- AI Provider: ${existingConfig.ai?.defaultProvider || state.data.aiProvider || 'Not set'}\n- Configured since: ${state.startedAt || 'Unknown'}\n\nTo reset and start fresh, call onboarding_start with reset=true AND confirm=true.\n\n⚠️ This will erase all onboarding data and require reconfiguration.`,
      existingUser: existingConfig.user?.name || state.data.userName,
      existingProvider: existingConfig.ai?.defaultProvider || state.data.aiProvider,
    };
  }
  
  if (reset || !state.started) {
    state = { started: true, completed: false, currentStep: 'welcome', completedSteps: [], data: {}, startedAt: new Date().toISOString() };
    saveState(state);
  }
  
  if (state.completed && !reset) {
    return { status: 'completed', message: 'Onboarding complete. Use reset=true to reconfigure.', data: state.data };
  }
  
  const step = STEPS.find(s => s.id === state.currentStep);
  if (!step) return { error: 'Invalid state' };
  
  let prompt = step.prompt;
  if (prompt.includes('{provider}')) {
    prompt = prompt.replace('{provider}', state.data.aiProvider || 'AI');
  }
  
  return { status: 'in_progress', currentStep: step.id, prompt, progress: Math.round((state.completedSteps.length / STEPS.length) * 100) };
};

export const onboardingContinueToolDefinition: ToolDefinition = {
  name: 'onboarding_continue',
  description: 'Continue onboarding with user response',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'User response' },
    },
    required: ['input'],
  },
};

export const onboardingContinueToolHandler: ToolHandler = async (args) => {
  const { input } = args as { input: string };
  const state = loadState();
  const config = loadConfig();
  
  if (!state.started) return { error: 'Run onboarding_start first' };
  if (state.completed) return { status: 'completed', message: 'Already complete' };
  
  const step = STEPS.find(s => s.id === state.currentStep);
  if (!step) return { error: 'Invalid state' };
  
  const result = step.process(input, state, config);
  state.completedSteps.push(step.id);
  if (result.nextStep) state.currentStep = result.nextStep;
  saveState(state);
  saveConfig(config);
  
  // Auto-execute steps without prompts
  const nextStep = STEPS.find(s => s.id === state.currentStep);
  if (nextStep && !nextStep.prompt) {
    const autoResult = nextStep.process('', state, config);
    state.completedSteps.push(nextStep.id);
    saveState(state);
    saveConfig(config);
    return { status: autoResult.complete ? 'completed' : 'in_progress', message: result.message + '\n\n' + autoResult.message };
  }
  
  let prompt = nextStep?.prompt || '';
  if (prompt.includes('{provider}')) {
    prompt = prompt.replace('{provider}', state.data.aiProvider || 'AI');
  }
  
  return { status: result.complete ? 'completed' : 'in_progress', message: result.message, nextPrompt: prompt, progress: Math.round((state.completedSteps.length / STEPS.length) * 100) };
};

export const onboardingStatusToolDefinition: ToolDefinition = {
  name: 'onboarding_status',
  description: 'Check onboarding status and user configuration',
  parameters: { type: 'object', properties: {}, required: [] },
};

export const onboardingStatusToolHandler: ToolHandler = async () => {
  const state = loadState();
  return {
    started: state.started,
    completed: state.completed,
    currentStep: state.currentStep,
    progress: Math.round((state.completedSteps.length / STEPS.length) * 100),
    userData: state.data,
    workspaceDir: WORKSPACE_DIR,
    configPath: CONFIG_PATH,
  };
};
