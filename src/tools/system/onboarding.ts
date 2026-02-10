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

Welcome. I am K.I.T., your autonomous financial agent.

My capabilities:
• 37+ trading skills across all markets
• Automated execution with risk management
• Multi-exchange portfolio tracking
• Real-time market analysis & alerts

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
💰 **Financial Objectives**

What are your primary goals?

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
📊 **Trading Experience**

Your experience level determines how I communicate:

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
⚖️ **Risk Profile**

How much risk can you tolerate?

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
🌍 **Target Markets**

Which markets do you want to trade? (Select multiple: e.g., "1,2,3")

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
      const markets = input.replace(/[,\s]+/g, '').split('').map(n => marketMap[n]).filter(Boolean);
      state.data.markets = markets.length > 0 ? markets : ['crypto', 'forex'];
      return { nextStep: 'autonomy', message: `Markets: ${state.data.markets.join(', ')}` };
    },
  },
  
  {
    id: 'autonomy',
    prompt: `
🤖 **Autonomy Level**

How much control should K.I.T. have?

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
🕐 **Timezone**

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
🧠 **AI Provider**

Which AI provider for K.I.T.'s intelligence?

1. **Anthropic** (Claude) - Recommended
2. **OpenAI** (GPT-4)
3. **OpenRouter** (Multiple models)
4. **Skip** (Configure later)

Select (1-4):
    `.trim(),
    process: (input, state) => {
      if (input === '4') {
        return { nextStep: 'channel_select', message: 'AI provider skipped. Configure later with `kit config`' };
      }
      const providers = ['anthropic', 'openai', 'openrouter'];
      state.data.aiProvider = providers[parseInt(input) - 1] || 'anthropic';
      return { nextStep: 'ai_key', message: `Provider: ${state.data.aiProvider}` };
    },
  },
  
  {
    id: 'ai_key',
    prompt: `
🔑 **API Key**

Enter your ${'{provider}'} API key:
(Keys are stored locally and never transmitted)
    `.trim(),
    process: (input, state, config) => {
      const key = input.trim();
      if (key.length < 10) {
        return { nextStep: 'channel_select', message: 'Invalid key. Skipping - configure later.' };
      }
      const provider = state.data.aiProvider || 'anthropic';
      config.ai = config.ai || { providers: {} };
      config.ai.providers[provider] = { apiKey: key, enabled: true };
      config.ai.defaultProvider = provider;
      process.env[`${provider.toUpperCase()}_API_KEY`] = key;
      return { nextStep: 'channel_select', message: `✅ ${provider} API key configured` };
    },
  },
  
  {
    id: 'channel_select',
    prompt: `
📱 **Communication Channels**

How do you want to communicate with K.I.T.?

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
🔧 **Channel Setup**

Enter your bot token:

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
      return { nextStep: 'trading_style', message: `✅ ${channel} configured` };
    },
  },
  
  {
    id: 'whatsapp_info',
    prompt: `
📱 **WhatsApp Setup**

WhatsApp requires scanning a QR code (like WhatsApp Web).

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
📈 **K.I.T. Trading Style**

How should K.I.T. approach trading?

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
• \`kit onboard\` - Re-run setup to change settings
• \`kit doctor\` - Diagnose issues

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
  description: 'Start or restart K.I.T. onboarding. Use reset=true to reconfigure.',
  parameters: {
    type: 'object',
    properties: {
      reset: { type: 'boolean', description: 'Reset and start fresh' },
    },
    required: [],
  },
};

export const onboardingStartToolHandler: ToolHandler = async (args) => {
  const { reset = false } = args as { reset?: boolean };
  let state = loadState();
  
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
