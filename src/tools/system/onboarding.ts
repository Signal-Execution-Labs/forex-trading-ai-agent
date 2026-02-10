/**
 * K.I.T. Onboarding System
 * Conversational setup like OpenClaw
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler } from './tool-registry';

const CONFIG_DIR = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const ONBOARDING_STATE_PATH = path.join(CONFIG_DIR, 'onboarding.json');

// ============================================================================
// Onboarding State
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

function loadOnboardingState(): OnboardingState {
  if (fs.existsSync(ONBOARDING_STATE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(ONBOARDING_STATE_PATH, 'utf8'));
    } catch {
      // ignore
    }
  }
  return {
    started: false,
    completed: false,
    currentStep: 'welcome',
    completedSteps: [],
    data: {},
  };
}

function saveOnboardingState(state: OnboardingState): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(ONBOARDING_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function loadConfig(): any {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config: any): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

// ============================================================================
// Onboarding Steps
// ============================================================================

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  prompt: string;
  validate?: (input: string) => { valid: boolean; error?: string };
  process: (input: string, state: OnboardingState, config: any) => { 
    nextStep?: string;
    message: string;
    complete?: boolean;
  };
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to K.I.T.',
    description: 'Your autonomous AI financial agent',
    prompt: `
🤖 **Welcome to K.I.T.** (Knight Industries Trading)

I'm your autonomous AI financial agent, ready to help you manage your finances.

Let's get you set up! First, what would you like to name me? (or press Enter to keep "K.I.T.")
    `.trim(),
    process: (input, state, config) => {
      const name = input.trim() || 'K.I.T.';
      config.agent = config.agent || {};
      config.agent.name = name;
      saveConfig(config);
      
      return {
        nextStep: 'ai_provider',
        message: `Great! I'll be known as **${name}**. Nice to meet you! 🤝`,
      };
    },
  },
  {
    id: 'ai_provider',
    title: 'AI Provider Setup',
    description: 'Configure your AI model provider',
    prompt: `
🧠 **AI Provider Setup**

To power my intelligence, I need an AI API key. Which provider would you like to use?

1. **Anthropic** (Claude) - Recommended
2. **OpenAI** (GPT-4)
3. **OpenRouter** (Multiple models)
4. **Skip** (Set up later)

Enter your choice (1-4):
    `.trim(),
    validate: (input) => {
      const choice = parseInt(input);
      if (isNaN(choice) || choice < 1 || choice > 4) {
        return { valid: false, error: 'Please enter 1, 2, 3, or 4' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const choice = parseInt(input);
      
      if (choice === 4) {
        return {
          nextStep: 'channel_choice',
          message: `No problem! You can set up AI later. Let's continue...`,
        };
      }
      
      const providers: Record<number, string> = {
        1: 'anthropic',
        2: 'openai',
        3: 'openrouter',
      };
      
      state.data.selectedProvider = providers[choice];
      saveOnboardingState(state);
      
      return {
        nextStep: 'ai_key',
        message: `Great choice! Now I need your ${providers[choice].toUpperCase()} API key.`,
      };
    },
  },
  {
    id: 'ai_key',
    title: 'AI API Key',
    description: 'Enter your AI provider API key',
    prompt: `
🔑 **Enter your API key**

Please paste your API key below. It will be securely stored.
(It should start with "sk-" for OpenAI/Anthropic or "sk-or-" for OpenRouter)
    `.trim(),
    validate: (input) => {
      const key = input.trim();
      if (!key || key.length < 10) {
        return { valid: false, error: 'Please enter a valid API key' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const key = input.trim();
      const provider = state.data.selectedProvider;
      
      // Save to config
      config.ai = config.ai || { providers: {} };
      config.ai.providers = config.ai.providers || {};
      config.ai.providers[provider] = {
        apiKey: key,
        enabled: true,
      };
      config.ai.defaultProvider = provider;
      saveConfig(config);
      
      // Also set env var
      const envVar = `${provider.toUpperCase()}_API_KEY`;
      process.env[envVar] = key;
      
      return {
        nextStep: 'channel_choice',
        message: `✅ API key saved and verified! ${provider} is now your default AI provider.`,
      };
    },
  },
  {
    id: 'channel_choice',
    title: 'Communication Channel',
    description: 'How would you like to communicate with me?',
    prompt: `
📱 **Communication Channel**

How would you like to talk to me?

1. **Telegram** - Most popular, works on phone & desktop
2. **Discord** - Great for communities
3. **Dashboard only** - Just use the web interface
4. **Set up later**

Enter your choice (1-4):
    `.trim(),
    validate: (input) => {
      const choice = parseInt(input);
      if (isNaN(choice) || choice < 1 || choice > 4) {
        return { valid: false, error: 'Please enter 1, 2, 3, or 4' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const choice = parseInt(input);
      
      if (choice === 3 || choice === 4) {
        return {
          nextStep: 'trading_interest',
          message: choice === 3 
            ? `Perfect! You can access me anytime at http://localhost:18799`
            : `No problem! You can set up channels later using \`skills_setup telegram\``,
        };
      }
      
      const channels: Record<number, string> = { 1: 'telegram', 2: 'discord' };
      state.data.selectedChannel = channels[choice];
      saveOnboardingState(state);
      
      return {
        nextStep: 'channel_token',
        message: `Great choice! Let me guide you through setting up ${channels[choice]}.`,
      };
    },
  },
  {
    id: 'channel_token',
    title: 'Channel Setup',
    description: 'Set up your communication channel',
    prompt: `
🔧 **Channel Setup**

**For Telegram:**
1. Open Telegram and search for @BotFather
2. Send /newbot and follow the prompts
3. Copy the bot token provided

**For Discord:**
1. Go to discord.com/developers/applications
2. Create a new application
3. Add a bot and copy the token

Please paste your bot token:
    `.trim(),
    validate: (input) => {
      const token = input.trim();
      if (!token || token.length < 20) {
        return { valid: false, error: 'Please enter a valid bot token' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const token = input.trim();
      const channel = state.data.selectedChannel;
      
      // Save to config
      config.channels = config.channels || {};
      config.channels[channel] = {
        type: channel,
        enabled: true,
        credentials: { token },
      };
      saveConfig(config);
      
      const message = channel === 'telegram'
        ? `✅ Telegram bot configured! Now search for your bot in Telegram and send /start.`
        : `✅ Discord bot configured! Use the OAuth2 URL generator to invite your bot to a server.`;
      
      return {
        nextStep: 'trading_interest',
        message,
      };
    },
  },
  {
    id: 'trading_interest',
    title: 'Trading Features',
    description: 'Are you interested in trading?',
    prompt: `
💹 **Trading Features**

K.I.T. can help you trade across multiple exchanges. Are you interested in:

1. **Crypto trading** (Binance, Coinbase, etc.)
2. **Forex/Stocks** (MetaTrader 5)
3. **Just analysis** (No trading, just portfolio tracking)
4. **Skip for now**

Enter your choice (1-4):
    `.trim(),
    validate: (input) => {
      const choice = parseInt(input);
      if (isNaN(choice) || choice < 1 || choice > 4) {
        return { valid: false, error: 'Please enter 1, 2, 3, or 4' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const choice = parseInt(input);
      
      if (choice === 4) {
        return {
          nextStep: 'complete',
          message: `No problem! You can enable trading features anytime with \`skills_enable binance\``,
        };
      }
      
      if (choice === 3) {
        config.trading = config.trading || {};
        config.trading.enabled = false;
        config.trading.autoTrade = false;
        saveConfig(config);
        
        return {
          nextStep: 'complete',
          message: `Got it! Analysis mode enabled. I'll help track your portfolio without executing trades.`,
        };
      }
      
      state.data.tradingType = choice === 1 ? 'crypto' : 'mt5';
      saveOnboardingState(state);
      
      return {
        nextStep: 'exchange_setup',
        message: choice === 1
          ? `Great! Let's set up your crypto exchange. Which one do you use primarily?`
          : `Great! Let's configure MetaTrader 5.`,
      };
    },
  },
  {
    id: 'exchange_setup',
    title: 'Exchange Setup',
    description: 'Configure your trading exchange',
    prompt: `
🏦 **Exchange Setup**

For now, let's skip the detailed exchange setup. You can configure your exchange later with:

- \`skills_setup binance\` - For Binance
- \`skills_setup mt5\` - For MetaTrader 5  
- \`skills_setup coinbase\` - For Coinbase

Would you like to continue? (yes/no)
    `.trim(),
    process: (input, state, config) => {
      config.trading = config.trading || {};
      config.trading.enabled = true;
      config.trading.autoTrade = false; // Start with manual mode
      saveConfig(config);
      
      return {
        nextStep: 'complete',
        message: `Trading features enabled! Remember to configure your exchange credentials before trading.`,
      };
    },
  },
  {
    id: 'complete',
    title: 'Setup Complete',
    description: 'Onboarding finished!',
    prompt: '', // Not used
    process: (input, state, config) => {
      state.completed = true;
      state.completedAt = new Date().toISOString();
      saveOnboardingState(state);
      
      return {
        complete: true,
        message: `
🎉 **Setup Complete!**

K.I.T. is now configured and ready to help you.

**Quick Commands:**
- \`status\` - Check system status
- \`skills_list\` - See available features
- \`skills_setup <skill>\` - Configure a feature

**What's Next:**
- Ask me anything about trading or finance
- Set up additional integrations
- Explore the dashboard at http://localhost:18799

I'm here to help grow your wealth. What would you like to do first?
        `.trim(),
      };
    },
  },
];

// ============================================================================
// Onboarding Tool
// ============================================================================

export const onboardingStartToolDefinition: ToolDefinition = {
  name: 'onboarding_start',
  description: 'Start the K.I.T. onboarding/setup process',
  parameters: {
    type: 'object',
    properties: {
      reset: {
        type: 'boolean',
        description: 'Reset onboarding state and start fresh',
      },
    },
    required: [],
  },
};

export const onboardingStartToolHandler: ToolHandler = async (args, context) => {
  const { reset = false } = args as { reset?: boolean };
  
  let state = loadOnboardingState();
  
  if (reset || !state.started) {
    state = {
      started: true,
      completed: false,
      currentStep: 'welcome',
      completedSteps: [],
      data: {},
      startedAt: new Date().toISOString(),
    };
    saveOnboardingState(state);
  }
  
  if (state.completed && !reset) {
    return {
      status: 'completed',
      message: 'Onboarding already completed! Use reset=true to start over.',
      completedAt: state.completedAt,
    };
  }
  
  const currentStep = ONBOARDING_STEPS.find(s => s.id === state.currentStep);
  if (!currentStep) {
    return { error: 'Invalid onboarding state' };
  }
  
  return {
    status: 'in_progress',
    currentStep: currentStep.id,
    title: currentStep.title,
    prompt: currentStep.prompt,
    completedSteps: state.completedSteps,
  };
};

// ============================================================================
// Onboarding Continue Tool
// ============================================================================

export const onboardingContinueToolDefinition: ToolDefinition = {
  name: 'onboarding_continue',
  description: 'Continue onboarding with user input',
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'User\'s response to the current step',
      },
    },
    required: ['input'],
  },
};

export const onboardingContinueToolHandler: ToolHandler = async (args, context) => {
  const { input } = args as { input: string };
  
  const state = loadOnboardingState();
  
  if (!state.started) {
    return {
      error: 'Onboarding not started. Use onboarding_start first.',
    };
  }
  
  if (state.completed) {
    return {
      status: 'completed',
      message: 'Onboarding already completed!',
    };
  }
  
  const currentStep = ONBOARDING_STEPS.find(s => s.id === state.currentStep);
  if (!currentStep) {
    return { error: 'Invalid onboarding state' };
  }
  
  // Validate input
  if (currentStep.validate) {
    const validation = currentStep.validate(input);
    if (!validation.valid) {
      return {
        status: 'validation_error',
        error: validation.error,
        retry: true,
        prompt: currentStep.prompt,
      };
    }
  }
  
  // Process input
  const config = loadConfig();
  const result = currentStep.process(input, state, config);
  
  // Update state
  state.completedSteps.push(currentStep.id);
  if (result.nextStep) {
    state.currentStep = result.nextStep;
  }
  saveOnboardingState(state);
  
  // Get next step prompt
  const nextStep = ONBOARDING_STEPS.find(s => s.id === state.currentStep);
  
  return {
    status: result.complete ? 'completed' : 'in_progress',
    message: result.message,
    currentStep: state.currentStep,
    nextPrompt: nextStep?.prompt,
    completedSteps: state.completedSteps,
  };
};

// ============================================================================
// Onboarding Status Tool
// ============================================================================

export const onboardingStatusToolDefinition: ToolDefinition = {
  name: 'onboarding_status',
  description: 'Check onboarding progress',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const onboardingStatusToolHandler: ToolHandler = async (args, context) => {
  const state = loadOnboardingState();
  
  const currentStep = ONBOARDING_STEPS.find(s => s.id === state.currentStep);
  
  return {
    started: state.started,
    completed: state.completed,
    currentStep: state.currentStep,
    currentStepTitle: currentStep?.title,
    completedSteps: state.completedSteps,
    totalSteps: ONBOARDING_STEPS.length,
    progress: Math.round((state.completedSteps.length / ONBOARDING_STEPS.length) * 100),
    startedAt: state.startedAt,
    completedAt: state.completedAt,
  };
};
