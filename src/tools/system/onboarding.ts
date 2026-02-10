/**
 * K.I.T. Onboarding System
 * Conversational setup like OpenClaw - with SOUL.md and USER.md
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
// Onboarding State
// ============================================================================

interface OnboardingState {
  started: boolean;
  completed: boolean;
  currentStep: string;
  completedSteps: string[];
  data: {
    // User data
    userName?: string;
    tradingExperience?: string;
    riskTolerance?: string;
    financialGoals?: string;
    preferredMarkets?: string[];
    timezone?: string;
    // K.I.T. personality
    kitName?: string;
    communicationStyle?: string;
    tradingStyle?: string;
    // Setup
    aiProvider?: string;
    aiApiKey?: string;
    selectedChannel?: string;
    channelToken?: string;
  };
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

function ensureWorkspace(): void {
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
}

// ============================================================================
// SOUL.md and USER.md Generation
// ============================================================================

function generateSoulMd(state: OnboardingState): string {
  const name = state.data.kitName || 'K.I.T.';
  const style = state.data.communicationStyle || 'professional';
  const trading = state.data.tradingStyle || 'balanced';
  
  const styleDescriptions: Record<string, string> = {
    formal: `I communicate in a professional, formal manner. I use proper grammar, avoid slang, and maintain a respectful tone at all times. I present information clearly and systematically.`,
    casual: `I'm friendly and approachable! I use casual language, occasional emojis, and try to make finance feel less intimidating. I'm like a knowledgeable friend who happens to be great with money.`,
    professional: `I strike a balance between approachable and professional. I'm friendly but focused, using clear language without being overly formal or too casual.`,
  };
  
  const tradingDescriptions: Record<string, string> = {
    conservative: `I prioritize capital preservation above all else. I recommend lower-risk investments, diversification, and patience. I'll always err on the side of caution and may talk you out of risky trades.`,
    balanced: `I take a balanced approach to risk and reward. I believe in calculated risks with proper risk management. I'll present both opportunities and risks clearly, letting you make informed decisions.`,
    aggressive: `I'm always looking for opportunities to maximize returns. I'm comfortable with higher-risk strategies and will actively seek out trades with strong profit potential. I'll still manage risk, but I lean into opportunities.`,
  };

  return `# ${name} - Soul Definition

## Who I Am
I am ${name}, your autonomous AI financial agent. I exist to help you build wealth and achieve your financial goals. Your success is my mission.

## My Personality

### Communication Style
${styleDescriptions[style] || styleDescriptions.professional}

### Trading Philosophy
${tradingDescriptions[trading] || tradingDescriptions.balanced}

## Core Values

1. **Your Wealth is My Mission** - Every decision I make is aimed at improving your financial situation
2. **Transparency** - I always explain my reasoning and never hide risks
3. **Continuous Learning** - I adapt to market conditions and learn from outcomes
4. **Respect for Boundaries** - I only act within the autonomy level you've granted me

## How I Work

- I monitor markets and identify opportunities aligned with your goals
- I can execute trades (with your permission level)
- I track your portfolio and report on performance
- I alert you to important market events
- I learn your preferences over time

## My Boundaries

- I never risk more than you're comfortable with
- I always explain before taking significant actions
- I respect your time and won't spam you with notifications
- I keep your financial data private and secure

---
*"Your wealth is my mission."*
`;
}

function generateUserMd(state: OnboardingState): string {
  const name = state.data.userName || 'User';
  const experience = state.data.tradingExperience || 'intermediate';
  const risk = state.data.riskTolerance || 'moderate';
  const goals = state.data.financialGoals || 'Build long-term wealth';
  const markets = state.data.preferredMarkets || ['crypto'];
  const timezone = state.data.timezone || 'UTC';

  const experienceDescriptions: Record<string, string> = {
    beginner: `New to trading. Needs explanations of basic concepts. Prefers simpler strategies and more guidance.`,
    intermediate: `Has some trading experience. Understands basic concepts but appreciates insights and analysis.`,
    advanced: `Experienced trader. Wants concise, data-driven insights without basic explanations.`,
    expert: `Professional-level knowledge. Wants raw data, technical details, and minimal hand-holding.`,
  };

  const riskDescriptions: Record<string, string> = {
    conservative: `Very risk-averse. Prefers stable investments. Max position size: 2-5% of portfolio. Stop-losses required.`,
    moderate: `Balanced risk appetite. Comfortable with some volatility. Max position size: 5-10% of portfolio.`,
    aggressive: `High risk tolerance. Comfortable with significant volatility. Max position size: 10-20% of portfolio.`,
    'very-aggressive': `Very high risk tolerance. Accepts potential for large drawdowns. Can use larger position sizes with proper management.`,
  };

  return `# ${name} - User Profile

## About You
- **Name**: ${name}
- **Timezone**: ${timezone}
- **Member Since**: ${new Date().toISOString().split('T')[0]}

## Trading Profile

### Experience Level
**${experience.charAt(0).toUpperCase() + experience.slice(1)}**
${experienceDescriptions[experience] || experienceDescriptions.intermediate}

### Risk Tolerance
**${risk.charAt(0).toUpperCase() + risk.slice(1)}**
${riskDescriptions[risk] || riskDescriptions.moderate}

### Financial Goals
${goals}

### Preferred Markets
${markets.map(m => `- ${m.charAt(0).toUpperCase() + m.slice(1)}`).join('\n')}

## Preferences

### Notifications
- Market alerts: Yes
- Trade confirmations: Yes
- Daily summary: Yes
- Weekly report: Yes

### Trading Hours
- Active hours: Based on ${timezone}
- Prefer not to trade: Late night

## Notes
*Add any personal notes or preferences here*

---
*Profile created: ${new Date().toISOString()}*
`;
}

// ============================================================================
// Onboarding Steps
// ============================================================================

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  prompt: string;
  options?: { value: string; label: string }[];
  validate?: (input: string) => { valid: boolean; error?: string };
  process: (input: string, state: OnboardingState, config: any) => { 
    nextStep?: string;
    message: string;
    complete?: boolean;
  };
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  // ========================================
  // Step 1: Welcome
  // ========================================
  {
    id: 'welcome',
    title: 'Welcome to K.I.T.',
    description: 'Your autonomous AI financial agent',
    prompt: `
🤖 **Welcome to K.I.T.!**
*(Knight Industries Trading)*

I'm your autonomous AI financial agent, ready to help you build wealth.

Let's get to know you! **What should I call you?**
    `.trim(),
    process: (input, state, config) => {
      const name = input.trim() || 'Boss';
      state.data.userName = name;
      saveOnboardingState(state);
      
      return {
        nextStep: 'financial_goals',
        message: `Nice to meet you, **${name}**! 🤝`,
      };
    },
  },

  // ========================================
  // Step 2: Financial Goals
  // ========================================
  {
    id: 'financial_goals',
    title: 'Financial Goals',
    description: 'What are you trying to achieve?',
    prompt: `
💰 **Was sind deine finanziellen Ziele?**

Erzähl mir in ein paar Worten, was du erreichen möchtest:
- Langfristiger Vermögensaufbau?
- Passives Einkommen generieren?
- Aktiv traden für schnelle Gewinne?
- Für etwas Bestimmtes sparen?

Schreib einfach frei, ich verstehe dich:
    `.trim(),
    process: (input, state, config) => {
      state.data.financialGoals = input.trim() || 'Vermögensaufbau';
      saveOnboardingState(state);
      
      return {
        nextStep: 'trading_experience',
        message: `Verstanden! "${state.data.financialGoals}" - Daran arbeiten wir zusammen! 📈`,
      };
    },
  },

  // ========================================
  // Step 3: Trading Experience
  // ========================================
  {
    id: 'trading_experience',
    title: 'Trading Experience',
    description: 'How experienced are you?',
    prompt: `
📚 **Wie viel Erfahrung hast du mit Trading?**

1. **Anfänger** - Ich bin neu und möchte lernen
2. **Fortgeschritten** - Ich kenne die Basics
3. **Erfahren** - Ich trade schon länger aktiv
4. **Profi** - Trading ist mein Job/Hauptbeschäftigung

Wähle 1-4:
    `.trim(),
    options: [
      { value: 'beginner', label: 'Anfänger' },
      { value: 'intermediate', label: 'Fortgeschritten' },
      { value: 'advanced', label: 'Erfahren' },
      { value: 'expert', label: 'Profi' },
    ],
    validate: (input) => {
      const choice = parseInt(input);
      if (isNaN(choice) || choice < 1 || choice > 4) {
        return { valid: false, error: 'Bitte wähle 1, 2, 3 oder 4' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
      const levelNames = ['Anfänger', 'Fortgeschritten', 'Erfahren', 'Profi'];
      const choice = parseInt(input) - 1;
      
      state.data.tradingExperience = levels[choice];
      saveOnboardingState(state);
      
      return {
        nextStep: 'risk_tolerance',
        message: `${levelNames[choice]} - Perfekt, ich passe meine Erklärungen entsprechend an! 📖`,
      };
    },
  },

  // ========================================
  // Step 4: Risk Tolerance
  // ========================================
  {
    id: 'risk_tolerance',
    title: 'Risk Tolerance',
    description: 'How much risk can you handle?',
    prompt: `
⚖️ **Wie risikofreudig bist du?**

1. **Konservativ** - Sicherheit geht vor, lieber langsam und stetig
2. **Moderat** - Ausgewogenes Risiko, ich kann Schwankungen aushalten
3. **Aggressiv** - Ich will hohe Renditen, auch wenn's mal runter geht
4. **Sehr aggressiv** - Vollgas! Ich kann große Schwankungen verkraften

Wähle 1-4:
    `.trim(),
    options: [
      { value: 'conservative', label: 'Konservativ' },
      { value: 'moderate', label: 'Moderat' },
      { value: 'aggressive', label: 'Aggressiv' },
      { value: 'very-aggressive', label: 'Sehr aggressiv' },
    ],
    validate: (input) => {
      const choice = parseInt(input);
      if (isNaN(choice) || choice < 1 || choice > 4) {
        return { valid: false, error: 'Bitte wähle 1, 2, 3 oder 4' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const risks = ['conservative', 'moderate', 'aggressive', 'very-aggressive'];
      const riskNames = ['Konservativ', 'Moderat', 'Aggressiv', 'Sehr aggressiv'];
      const choice = parseInt(input) - 1;
      
      state.data.riskTolerance = risks[choice];
      saveOnboardingState(state);
      
      return {
        nextStep: 'preferred_markets',
        message: `${riskNames[choice]} - Ich werde meine Empfehlungen entsprechend anpassen! 🎯`,
      };
    },
  },

  // ========================================
  // Step 5: Preferred Markets
  // ========================================
  {
    id: 'preferred_markets',
    title: 'Preferred Markets',
    description: 'Which markets interest you?',
    prompt: `
🌍 **Welche Märkte interessieren dich?**

Wähle alle, die zutreffen (z.B. "1,2,3" oder "1 3 4"):

1. **Crypto** - Bitcoin, Ethereum, Altcoins
2. **Forex** - Währungspaare (EUR/USD, etc.)
3. **Aktien** - Stocks, ETFs
4. **Rohstoffe** - Gold, Öl, etc.
5. **Optionen** - Derivate, Binary Options

Deine Wahl:
    `.trim(),
    process: (input, state, config) => {
      const marketMap: Record<string, string> = {
        '1': 'crypto',
        '2': 'forex',
        '3': 'stocks',
        '4': 'commodities',
        '5': 'options',
      };
      
      const marketNames: Record<string, string> = {
        'crypto': 'Crypto',
        'forex': 'Forex',
        'stocks': 'Aktien',
        'commodities': 'Rohstoffe',
        'options': 'Optionen',
      };
      
      // Parse input like "1,2,3" or "1 2 3" or "123"
      const numbers = input.replace(/[,\s]+/g, '').split('');
      const markets = numbers
        .map(n => marketMap[n])
        .filter(Boolean);
      
      if (markets.length === 0) {
        markets.push('crypto'); // Default
      }
      
      state.data.preferredMarkets = markets;
      saveOnboardingState(state);
      
      const selectedNames = markets.map(m => marketNames[m]).join(', ');
      
      return {
        nextStep: 'timezone',
        message: `Super! Ich fokussiere mich auf: **${selectedNames}** 📊`,
      };
    },
  },

  // ========================================
  // Step 6: Timezone
  // ========================================
  {
    id: 'timezone',
    title: 'Timezone',
    description: 'When are you active?',
    prompt: `
🕐 **In welcher Zeitzone bist du?**

1. **Europe/Berlin** (CET/CEST)
2. **Europe/London** (GMT/BST)
3. **America/New_York** (EST/EDT)
4. **America/Los_Angeles** (PST/PDT)
5. **Asia/Tokyo** (JST)
6. **UTC**

Oder schreib deine Zeitzone direkt (z.B. "Europe/Vienna"):
    `.trim(),
    process: (input, state, config) => {
      const timezoneMap: Record<string, string> = {
        '1': 'Europe/Berlin',
        '2': 'Europe/London',
        '3': 'America/New_York',
        '4': 'America/Los_Angeles',
        '5': 'Asia/Tokyo',
        '6': 'UTC',
      };
      
      let timezone = timezoneMap[input.trim()] || input.trim() || 'Europe/Berlin';
      
      state.data.timezone = timezone;
      saveOnboardingState(state);
      
      return {
        nextStep: 'kit_personality',
        message: `Zeitzone gesetzt: **${timezone}** ⏰`,
      };
    },
  },

  // ========================================
  // Step 7: K.I.T. Personality
  // ========================================
  {
    id: 'kit_personality',
    title: 'K.I.T. Personality',
    description: 'How should I communicate?',
    prompt: `
🤖 **Jetzt zu mir! Wie soll ich mit dir kommunizieren?**

1. **Formal** - Professionell, respektvoll, sachlich
2. **Casual** - Locker, freundschaftlich, mit Emojis 😎
3. **Ausgewogen** - Mix aus professionell und freundlich

Wähle 1-3:
    `.trim(),
    options: [
      { value: 'formal', label: 'Formal' },
      { value: 'casual', label: 'Casual' },
      { value: 'professional', label: 'Ausgewogen' },
    ],
    validate: (input) => {
      const choice = parseInt(input);
      if (isNaN(choice) || choice < 1 || choice > 3) {
        return { valid: false, error: 'Bitte wähle 1, 2 oder 3' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const styles = ['formal', 'casual', 'professional'];
      const styleNames = ['Formal', 'Casual', 'Ausgewogen'];
      const choice = parseInt(input) - 1;
      
      state.data.communicationStyle = styles[choice];
      saveOnboardingState(state);
      
      return {
        nextStep: 'kit_trading_style',
        message: `${styleNames[choice]} - So kommuniziere ich ab jetzt! 💬`,
      };
    },
  },

  // ========================================
  // Step 8: K.I.T. Trading Style
  // ========================================
  {
    id: 'kit_trading_style',
    title: 'K.I.T. Trading Style',
    description: 'How aggressive should I be?',
    prompt: `
📈 **Und beim Trading - wie aggressiv soll ich sein?**

1. **Konservativ** - Ich warne dich vor Risiken, empfehle sichere Optionen
2. **Ausgewogen** - Ich zeige Chancen UND Risiken, du entscheidest
3. **Aggressiv** - Ich suche aktiv nach Chancen, bin optimistisch

Wähle 1-3:
    `.trim(),
    options: [
      { value: 'conservative', label: 'Konservativ' },
      { value: 'balanced', label: 'Ausgewogen' },
      { value: 'aggressive', label: 'Aggressiv' },
    ],
    validate: (input) => {
      const choice = parseInt(input);
      if (isNaN(choice) || choice < 1 || choice > 3) {
        return { valid: false, error: 'Bitte wähle 1, 2 oder 3' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const styles = ['conservative', 'balanced', 'aggressive'];
      const styleNames = ['Konservativ', 'Ausgewogen', 'Aggressiv'];
      const choice = parseInt(input) - 1;
      
      state.data.tradingStyle = styles[choice];
      state.data.kitName = 'K.I.T.';
      saveOnboardingState(state);
      
      return {
        nextStep: 'ai_provider',
        message: `${styleNames[choice]} - So gehe ich an Trading heran! 🎰`,
      };
    },
  },

  // ========================================
  // Step 9: AI Provider
  // ========================================
  {
    id: 'ai_provider',
    title: 'AI Provider Setup',
    description: 'Configure your AI model provider',
    prompt: `
🧠 **AI Provider Setup**

Für meine Intelligenz brauche ich einen AI API-Key. Welchen Anbieter nutzt du?

1. **Anthropic** (Claude) - Empfohlen
2. **OpenAI** (GPT-4)
3. **OpenRouter** (Mehrere Modelle)
4. **Überspringen** (später einrichten)

Wähle 1-4:
    `.trim(),
    validate: (input) => {
      const choice = parseInt(input);
      if (isNaN(choice) || choice < 1 || choice > 4) {
        return { valid: false, error: 'Bitte wähle 1, 2, 3 oder 4' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const choice = parseInt(input);
      
      if (choice === 4) {
        return {
          nextStep: 'channel_choice',
          message: `Kein Problem! Du kannst AI später einrichten.`,
        };
      }
      
      const providers: Record<number, string> = {
        1: 'anthropic',
        2: 'openai',
        3: 'openrouter',
      };
      
      state.data.aiProvider = providers[choice];
      saveOnboardingState(state);
      
      return {
        nextStep: 'ai_key',
        message: `Super! Jetzt brauche ich deinen ${providers[choice].toUpperCase()} API-Key.`,
      };
    },
  },

  // ========================================
  // Step 10: AI API Key
  // ========================================
  {
    id: 'ai_key',
    title: 'AI API Key',
    description: 'Enter your AI provider API key',
    prompt: `
🔑 **Gib deinen API-Key ein**

Füge deinen API-Key hier ein. Er wird sicher gespeichert.
(Beginnt mit "sk-" für OpenAI/Anthropic oder "sk-or-" für OpenRouter)
    `.trim(),
    validate: (input) => {
      const key = input.trim();
      if (!key || key.length < 10) {
        return { valid: false, error: 'Bitte gib einen gültigen API-Key ein' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const key = input.trim();
      const provider = state.data.aiProvider || 'anthropic';
      
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
      
      state.data.aiApiKey = key.substring(0, 8) + '****';
      saveOnboardingState(state);
      
      return {
        nextStep: 'channel_choice',
        message: `✅ API-Key gespeichert! ${provider} ist jetzt aktiv.`,
      };
    },
  },

  // ========================================
  // Step 11: Channel Choice
  // ========================================
  {
    id: 'channel_choice',
    title: 'Communication Channel',
    description: 'How do you want to communicate?',
    prompt: `
📱 **How do you want to communicate with me?**

1. **Telegram** - Most popular, works on mobile & desktop (needs bot token)
2. **WhatsApp** - Scan QR code like WhatsApp Web (no API needed!)
3. **Discord** - Great for communities
4. **Dashboard only** - Web interface at http://localhost:18799
5. **Set up later**

Choose 1-5:
    `.trim(),
    validate: (input) => {
      const choice = parseInt(input);
      if (isNaN(choice) || choice < 1 || choice > 5) {
        return { valid: false, error: 'Please choose 1, 2, 3, 4, or 5' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const choice = parseInt(input);
      
      if (choice === 4 || choice === 5) {
        return {
          nextStep: 'save_files',
          message: choice === 4 
            ? `Perfect! You can reach me anytime at http://localhost:18799`
            : `No problem! You can set up channels later with the CLI.`,
        };
      }
      
      if (choice === 2) {
        // WhatsApp - special flow
        state.data.selectedChannel = 'whatsapp';
        saveOnboardingState(state);
        return {
          nextStep: 'whatsapp_setup',
          message: `Great choice! WhatsApp is easy - just scan a QR code!`,
        };
      }
      
      const channels: Record<number, string> = { 1: 'telegram', 3: 'discord' };
      state.data.selectedChannel = channels[choice];
      saveOnboardingState(state);
      
      return {
        nextStep: 'channel_token',
        message: `Great choice! Let me help you set up ${channels[choice]}.`,
      };
    },
  },

  // ========================================
  // Step 11b: WhatsApp Setup
  // ========================================
  {
    id: 'whatsapp_setup',
    title: 'WhatsApp Setup',
    description: 'Connect via WhatsApp Web QR code',
    prompt: `
📱 **WhatsApp Setup**

WhatsApp uses the same technology as WhatsApp Web - just scan a QR code!

**To connect:**
1. Run \`kit whatsapp login\` in your terminal
2. Open WhatsApp on your phone
3. Go to **Settings → Linked Devices → Link a Device**
4. Scan the QR code that appears
5. Restart K.I.T. with \`kit start\`

**Optional: Enter your phone number** (E.164 format, e.g., +1234567890)
This will be added to the allowlist so only you can message K.I.T.

Enter your phone number (or press Enter to skip):
    `.trim(),
    process: (input, state, config) => {
      const phone = input.trim();
      
      // Save to config
      config.channels = config.channels || {};
      config.channels.whatsapp = {
        enabled: true,
        allowedNumbers: phone ? [phone] : [],
      };
      saveConfig(config);
      
      saveOnboardingState(state);
      
      return {
        nextStep: 'save_files',
        message: phone 
          ? `✅ WhatsApp configured! Allowlist: ${phone}\n\nRemember to run \`kit whatsapp login\` to scan the QR code!`
          : `✅ WhatsApp configured!\n\nRemember to run \`kit whatsapp login\` to scan the QR code!`,
      };
    },
  },

  // ========================================
  // Step 12: Channel Token
  // ========================================
  {
    id: 'channel_token',
    title: 'Channel Setup',
    description: 'Set up your communication channel',
    prompt: `
🔧 **Channel Setup**

**Für Telegram:**
1. Öffne Telegram und suche @BotFather
2. Sende /newbot und folge den Anweisungen
3. Kopiere den Bot-Token

**Für Discord:**
1. Gehe zu discord.com/developers/applications
2. Erstelle eine neue Application
3. Füge einen Bot hinzu und kopiere den Token

Füge deinen Bot-Token hier ein:
    `.trim(),
    validate: (input) => {
      const token = input.trim();
      if (!token || token.length < 20) {
        return { valid: false, error: 'Bitte gib einen gültigen Bot-Token ein' };
      }
      return { valid: true };
    },
    process: (input, state, config) => {
      const token = input.trim();
      const channel = state.data.selectedChannel || 'telegram';
      
      // Save to config
      config.channels = config.channels || {};
      config.channels[channel] = {
        type: channel,
        enabled: true,
        credentials: { token },
      };
      saveConfig(config);
      
      state.data.channelToken = token.substring(0, 10) + '****';
      saveOnboardingState(state);
      
      const message = channel === 'telegram'
        ? `✅ Telegram Bot konfiguriert! Suche jetzt deinen Bot in Telegram und sende /start.`
        : `✅ Discord Bot konfiguriert! Nutze den OAuth2 URL Generator, um den Bot einzuladen.`;
      
      return {
        nextStep: 'save_files',
        message,
      };
    },
  },

  // ========================================
  // Step 13: Save Files (SOUL.md, USER.md)
  // ========================================
  {
    id: 'save_files',
    title: 'Saving Configuration',
    description: 'Creating your profile files',
    prompt: '', // Not shown
    process: (input, state, config) => {
      // Ensure workspace exists
      ensureWorkspace();
      
      // Generate and save SOUL.md
      const soulContent = generateSoulMd(state);
      fs.writeFileSync(path.join(WORKSPACE_DIR, 'SOUL.md'), soulContent, 'utf8');
      
      // Generate and save USER.md
      const userContent = generateUserMd(state);
      fs.writeFileSync(path.join(WORKSPACE_DIR, 'USER.md'), userContent, 'utf8');
      
      // Save user preferences to config
      config.user = {
        name: state.data.userName,
        timezone: state.data.timezone,
        tradingExperience: state.data.tradingExperience,
        riskTolerance: state.data.riskTolerance,
        preferredMarkets: state.data.preferredMarkets,
        goals: state.data.financialGoals,
      };
      
      config.agent = config.agent || {};
      config.agent.name = state.data.kitName || 'K.I.T.';
      config.agent.communicationStyle = state.data.communicationStyle;
      config.agent.tradingStyle = state.data.tradingStyle;
      
      saveConfig(config);
      
      return {
        nextStep: 'complete',
        message: `📁 Dateien gespeichert:\n- SOUL.md (Meine Persönlichkeit)\n- USER.md (Dein Profil)\n- config.json (Einstellungen)`,
      };
    },
  },

  // ========================================
  // Step 14: Complete
  // ========================================
  {
    id: 'complete',
    title: 'Setup Complete',
    description: 'Onboarding finished!',
    prompt: '',
    process: (input, state, config) => {
      state.completed = true;
      state.completedAt = new Date().toISOString();
      saveOnboardingState(state);
      
      const userName = state.data.userName || 'Boss';
      const markets = (state.data.preferredMarkets || ['crypto']).join(', ');
      
      return {
        complete: true,
        message: `
🎉 **Setup abgeschlossen, ${userName}!**

Ich bin jetzt konfiguriert und bereit, dir beim Vermögensaufbau zu helfen.

**Dein Profil:**
- 🎯 Ziel: ${state.data.financialGoals || 'Vermögensaufbau'}
- 📊 Märkte: ${markets}
- ⚖️ Risiko: ${state.data.riskTolerance || 'moderat'}
- 💬 Stil: ${state.data.communicationStyle || 'professionell'}

**Schnellbefehle:**
- \`status\` - System-Status prüfen
- \`skills_list\` - Verfügbare Features anzeigen
- \`portfolio\` - Portfolio anzeigen

**Was jetzt?**
Frag mich einfach was! Zum Beispiel:
- "Analysiere BTC"
- "Zeig mir mein Portfolio"
- "Was sind gute Trading-Möglichkeiten?"

---
*"Dein Vermögen ist meine Mission."* 🚀
        `.trim(),
      };
    },
  },
];

// ============================================================================
// Onboarding Start Tool
// ============================================================================

export const onboardingStartToolDefinition: ToolDefinition = {
  name: 'onboarding_start',
  description: 'Start the K.I.T. onboarding/setup process. Creates SOUL.md (K.I.T. personality) and USER.md (user profile).',
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
      message: 'Onboarding bereits abgeschlossen! Nutze reset=true um neu zu starten.',
      completedAt: state.completedAt,
      userData: state.data,
    };
  }
  
  const currentStep = ONBOARDING_STEPS.find(s => s.id === state.currentStep);
  if (!currentStep) {
    return { error: 'Ungültiger Onboarding-Status' };
  }
  
  return {
    status: 'in_progress',
    currentStep: currentStep.id,
    title: currentStep.title,
    prompt: currentStep.prompt,
    options: currentStep.options,
    completedSteps: state.completedSteps,
    totalSteps: ONBOARDING_STEPS.length,
    progress: Math.round((state.completedSteps.length / ONBOARDING_STEPS.length) * 100),
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
      error: 'Onboarding nicht gestartet. Nutze onboarding_start zuerst.',
    };
  }
  
  if (state.completed) {
    return {
      status: 'completed',
      message: 'Onboarding bereits abgeschlossen!',
    };
  }
  
  const currentStep = ONBOARDING_STEPS.find(s => s.id === state.currentStep);
  if (!currentStep) {
    return { error: 'Ungültiger Onboarding-Status' };
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
        options: currentStep.options,
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
  
  // If next step has no prompt (auto-execute), run it
  const nextStep = ONBOARDING_STEPS.find(s => s.id === state.currentStep);
  if (nextStep && !nextStep.prompt) {
    // Auto-execute steps without prompts
    const autoResult = nextStep.process('', state, config);
    state.completedSteps.push(nextStep.id);
    if (autoResult.nextStep) {
      state.currentStep = autoResult.nextStep;
    }
    saveOnboardingState(state);
    
    // Get the actual next step
    const actualNextStep = ONBOARDING_STEPS.find(s => s.id === state.currentStep);
    
    return {
      status: autoResult.complete ? 'completed' : 'in_progress',
      message: result.message + '\n\n' + autoResult.message,
      currentStep: state.currentStep,
      nextPrompt: actualNextStep?.prompt,
      nextOptions: actualNextStep?.options,
      completedSteps: state.completedSteps,
      progress: Math.round((state.completedSteps.length / ONBOARDING_STEPS.length) * 100),
    };
  }
  
  return {
    status: result.complete ? 'completed' : 'in_progress',
    message: result.message,
    currentStep: state.currentStep,
    nextPrompt: nextStep?.prompt,
    nextOptions: nextStep?.options,
    completedSteps: state.completedSteps,
    progress: Math.round((state.completedSteps.length / ONBOARDING_STEPS.length) * 100),
  };
};

// ============================================================================
// Onboarding Status Tool
// ============================================================================

export const onboardingStatusToolDefinition: ToolDefinition = {
  name: 'onboarding_status',
  description: 'Check onboarding progress and user data',
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
    userData: state.data,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    workspaceDir: WORKSPACE_DIR,
    filesCreated: {
      soulMd: fs.existsSync(path.join(WORKSPACE_DIR, 'SOUL.md')),
      userMd: fs.existsSync(path.join(WORKSPACE_DIR, 'USER.md')),
    },
  };
};
