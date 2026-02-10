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
  step: 'provider' | 'model' | 'apikey' | 'channel' | 'telegram_token' | 'telegram_chatid' | 'skills' | 'user_name' | 'user_goals' | 'user_risk' | 'user_style' | 'complete';
  provider?: string;
  model?: string;
  channel?: string;
  telegramToken?: string;
  userName?: string;
  userGoals?: string;
  userRisk?: string;
  userStyle?: string;
}

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
  { id: 'trading', name: 'Trading', skills: ['binary-options', 'metatrader', 'auto-trader', 'signal-copier'] },
  { id: 'crypto', name: 'Crypto & DeFi', skills: ['exchange-connector', 'defi-connector', 'wallet-connector', 'airdrop-hunter'] },
  { id: 'analysis', name: 'Analysis', skills: ['market-analysis', 'whale-tracker', 'portfolio-tracker', 'backtester'] },
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
    this.config = {
      model: config?.model || 'claude-sonnet-4-20250514',
      systemPrompt: config?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
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
        modelList += `**Step 2/3: Choose your model:**\n\n`;
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
          
          return `✅ **${model}** selected!\n\n**Step 3/3: Enter your ${provider.name} API key:**\n\n💡 Get your key from:\n• OpenAI: https://platform.openai.com/api-keys\n• Anthropic: https://console.anthropic.com/\n• Google: https://aistudio.google.com/apikey\n\n👉 Paste your API key:`;
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
        msg += `**Step 4/6: Connect a messaging channel:**\n\n`;
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
          // Skip to skills
          this.onboardingState.set(sessionId, { ...state, step: 'skills', channel: 'none' });
          return this.getSkillsPrompt(state);
        }
        
        if (channel.id === 'telegram') {
          this.onboardingState.set(sessionId, { ...state, step: 'telegram_token', channel: 'telegram' });
          return `✅ **Telegram** selected!\n\n**Step 5/6: Enter your Telegram Bot Token:**\n\n💡 Get your token from @BotFather on Telegram:\n1. Open Telegram, search for @BotFather\n2. Send /newbot and follow instructions\n3. Copy the token (looks like: 123456789:ABCdefGHI...)\n\n👉 Paste your bot token:`;
        }
        
        if (channel.id === 'whatsapp') {
          this.onboardingState.set(sessionId, { ...state, step: 'skills', channel: 'whatsapp' });
          return `✅ **WhatsApp** selected!\n\n📱 **WhatsApp Setup:**\nRun this command in terminal after setup:\n\`kit whatsapp login\`\n\nThen scan the QR code with WhatsApp.\n\n${this.getSkillsPrompt(state)}`;
        }
        
        if (channel.id === 'discord') {
          this.onboardingState.set(sessionId, { ...state, step: 'skills', channel: 'discord' });
          return `✅ **Discord** selected!\n\n🎮 **Discord Setup:**\nAdd DISCORD_BOT_TOKEN to your .env file.\nGet it from: https://discord.com/developers/applications\n\n${this.getSkillsPrompt(state)}`;
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
        
        this.onboardingState.set(sessionId, { ...state, step: 'skills' });
        return `✅ **Telegram configured!**\n\n${this.getSkillsPrompt(state)}`;
      }
      return null;
    }

    // Step 6: Skills Selection
    if (state.step === 'skills') {
      const num = parseInt(input);
      if (num >= 1 && num <= SKILL_CATEGORIES.length + 1) {
        const skillChoice = num === SKILL_CATEGORIES.length + 1 ? 'ALL' : SKILL_CATEGORIES[num - 1].name;
        this.onboardingState.set(sessionId, { ...state, step: 'user_name' });
        return `✅ **${skillChoice}** skills enabled!\n\n---\n\n🎭 **Now let's get to know you!**\n\n**Step 7/10: What's your name?**\n\n👉 Enter your name:`;
      }
      // Invalid input - repeat the prompt
      return this.getSkillsPrompt(state);
    }

    // Step 7: User Name
    if (state.step === 'user_name') {
      if (input.length >= 1) {
        this.onboardingState.set(sessionId, { ...state, step: 'user_goals', userName: input });
        return `✅ Nice to meet you, **${input}**!\n\n**Step 8/10: What are your financial goals?**\n\n  [1] 💰 Grow wealth steadily (long-term investing)\n  [2] 🚀 Aggressive growth (high risk, high reward)\n  [3] 💵 Generate passive income\n  [4] 🎯 Short-term trading profits\n  [5] 🛡️ Preserve capital, beat inflation\n\n👉 Enter a number (1-5):`;
      }
      return `👉 Please enter your name:`;
    }

    // Step 8: User Goals
    if (state.step === 'user_goals') {
      const goals = ['Grow wealth steadily', 'Aggressive growth', 'Generate passive income', 'Short-term trading profits', 'Preserve capital'];
      const num = parseInt(input);
      if (num >= 1 && num <= 5) {
        this.onboardingState.set(sessionId, { ...state, step: 'user_risk', userGoals: goals[num - 1] });
        return `✅ Goal: **${goals[num - 1]}**\n\n**Step 9/10: What's your risk tolerance?**\n\n  [1] 🐢 Conservative - Minimal risk, steady returns\n  [2] ⚖️ Balanced - Some risk for better returns\n  [3] 🔥 Aggressive - High risk, maximum potential\n\n👉 Enter a number (1-3):`;
      }
      return `👉 Please enter a number (1-5):`;
    }

    // Step 9: Risk Tolerance
    if (state.step === 'user_risk') {
      const risks = ['Conservative', 'Balanced', 'Aggressive'];
      const num = parseInt(input);
      if (num >= 1 && num <= 3) {
        this.onboardingState.set(sessionId, { ...state, step: 'user_style', userRisk: risks[num - 1] });
        return `✅ Risk: **${risks[num - 1]}**\n\n**Step 10/10: How should I communicate with you?**\n\n  [1] 📊 Professional - Formal, data-focused\n  [2] 😊 Friendly - Casual, supportive\n  [3] ⚡ Direct - Brief, action-oriented\n  [4] 🎓 Educational - Explain everything\n\n👉 Enter a number (1-4):`;
      }
      return `👉 Please enter a number (1-3):`;
    }

    // Step 10: Communication Style
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
   * Get skills selection prompt
   */
  private getSkillsPrompt(state: OnboardingState): string {
    let msg = `**Step 6/6: Choose your skill set:**\n\n`;
    SKILL_CATEGORIES.forEach((cat, i) => {
      msg += `  [${i + 1}] 📦 **${cat.name}**\n      ${cat.skills.join(', ')}\n\n`;
    });
    msg += `  [${SKILL_CATEGORIES.length + 1}] 🚀 **Enable ALL skills**\n`;
    msg += `\n👉 Enter a number (1-${SKILL_CATEGORIES.length + 1}):`;
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
    prompt += `**Step 1/3: Choose your AI provider:**\n\n`;
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

    // Get API key from multiple sources
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const xaiKey = process.env.XAI_API_KEY;

    const hasApiKey = !!(anthropicKey || openaiKey || googleKey || groqKey || xaiKey);

    // =========================================================================
    // ONBOARDING WIZARD (if no API key configured)
    // =========================================================================
    if (!hasApiKey) {
      // Check if user is in onboarding flow
      const wizardResponse = this.handleOnboardingWizard(sessionId, userMessage);
      if (wizardResponse) {
        history.push({ role: 'user', content: userMessage });
        history.push({ role: 'assistant', content: wizardResponse });
        this.conversationHistory.set(sessionId, history);
        return wizardResponse;
      }
      
      // Start onboarding wizard
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
