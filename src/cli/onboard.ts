#!/usr/bin/env node

/**
 * K.I.T. Onboard Wizard
 * 
 * Complete onboarding experience like OpenClaw:
 * - Welcome & Introduction
 * - User profiling → USER.md
 * - Personality setup → SOUL.md
 * - Channel configuration
 * - Skills activation
 * - Exchange/broker setup
 * - Trading mode & risk settings
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');
const WORKSPACE_PATH = path.join(KIT_HOME, 'workspace');

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
};

// ============================================================================
// Types
// ============================================================================

interface UserProfile {
  name: string;
  callName: string;
  timezone: string;
  financialGoals: string[];
  tradingExperience: 'beginner' | 'intermediate' | 'expert';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  preferredMarkets: string[];
  notes?: string;
}

interface KitPersonality {
  communicationStyle: 'formal' | 'casual' | 'professional';
  proactivity: 'passive' | 'moderate' | 'proactive';
  verbosity: 'concise' | 'balanced' | 'detailed';
  riskWarnings: boolean;
  celebrateWins: boolean;
  customTraits?: string[];
}

interface Config {
  version: string;
  user?: Partial<UserProfile>;
  personality?: Partial<KitPersonality>;
  ai?: {
    provider: string;
    apiKey?: string;
    model?: string;
  };
  channels?: Record<string, any>;
  exchanges?: Record<string, any>;
  trading?: {
    mode: 'manual' | 'semi-auto' | 'full-auto';
    maxRiskPercent: number;
    autoTrade: boolean;
  };
  skills?: Record<string, { enabled: boolean; config?: any }>;
  onboarded?: boolean;
  onboardedAt?: string;
}

// ============================================================================
// OnboardWizard Class
// ============================================================================

class OnboardWizard {
  private rl: readline.Interface;
  private config: Config = { version: '1.0.0' };
  private userProfile: UserProfile = {
    name: '',
    callName: '',
    timezone: 'UTC',
    financialGoals: [],
    tradingExperience: 'beginner',
    riskTolerance: 'moderate',
    preferredMarkets: [],
  };
  private kitPersonality: KitPersonality = {
    communicationStyle: 'professional',
    proactivity: 'moderate',
    verbosity: 'balanced',
    riskWarnings: true,
    celebrateWins: true,
  };
  private pythonPackages: string[] = [];

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async run(): Promise<void> {
    this.printBanner();
    
    // Phase 1: Welcome & Introduction
    await this.stepWelcome();
    
    // Phase 2: Get to know the human → USER.md
    await this.stepUserProfile();
    
    // Phase 3: Define K.I.T.'s personality → SOUL.md
    await this.stepPersonality();
    
    // Phase 4: AI Provider setup
    await this.stepAIProvider();
    
    // Phase 5: Channel setup (Telegram, Discord, etc.)
    await this.stepChannels();
    
    // Phase 6: Skills activation
    await this.stepSkills();
    
    // Phase 7: Exchange/broker setup
    await this.stepExchanges();
    
    // Phase 8: Trading mode & risk settings
    await this.stepTradingMode();
    
    // Phase 9: Install dependencies
    await this.installDependencies();
    
    // Phase 10: Save everything
    await this.saveAll();
    
    // Phase 11: Show summary & complete
    this.printComplete();
    
    this.rl.close();
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private async ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private async askChoice(question: string, choices: string[]): Promise<number> {
    console.log(`\n${c.bright}${question}${c.reset}\n`);
    choices.forEach((choice, i) => {
      console.log(`  ${c.cyan}${i + 1}.${c.reset} ${choice}`);
    });
    
    while (true) {
      const answer = await this.ask(`\n${c.yellow}Enter choice (1-${choices.length}):${c.reset} `);
      const num = parseInt(answer);
      if (num >= 1 && num <= choices.length) {
        return num - 1;
      }
      console.log(`${c.red}Invalid choice. Please enter 1-${choices.length}${c.reset}`);
    }
  }

  private async askMultiChoice(question: string, choices: string[]): Promise<number[]> {
    console.log(`\n${c.bright}${question}${c.reset}\n`);
    choices.forEach((choice, i) => {
      console.log(`  ${c.cyan}${i + 1}.${c.reset} ${choice}`);
    });
    
    const answer = await this.ask(`\n${c.yellow}Enter choices (comma-separated, e.g., 1,3,5):${c.reset} `);
    if (!answer) return [];
    
    return answer.split(',')
      .map(s => parseInt(s.trim()) - 1)
      .filter(n => n >= 0 && n < choices.length);
  }

  private async askYesNo(question: string, defaultYes = true): Promise<boolean> {
    const hint = defaultYes ? '[Y/n]' : '[y/N]';
    const answer = await this.ask(`${question} ${c.dim}${hint}${c.reset} `);
    if (answer === '') return defaultYes;
    return answer.toLowerCase().startsWith('y');
  }

  // ==========================================================================
  // Banner
  // ==========================================================================

  private printBanner(): void {
    console.log(`
${c.cyan}╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ${c.bright}${c.yellow}    ██╗  ██╗   ██╗   ████████╗                               ${c.reset}${c.cyan}║
║   ${c.bright}${c.yellow}    ██║ ██╔╝   ██║   ╚══██╔══╝                               ${c.reset}${c.cyan}║
║   ${c.bright}${c.yellow}    █████╔╝    ██║      ██║                                  ${c.reset}${c.cyan}║
║   ${c.bright}${c.yellow}    ██╔═██╗    ██║      ██║                                  ${c.reset}${c.cyan}║
║   ${c.bright}${c.yellow}    ██║  ██╗██╗██║██╗   ██║██╗                               ${c.reset}${c.cyan}║
║   ${c.bright}${c.yellow}    ╚═╝  ╚═╝╚═╝╚═╝╚═╝   ╚═╝╚═╝                               ${c.reset}${c.cyan}║
║                                                                   ║
║   ${c.white}Knight Industries Trading${c.cyan}                                      ║
║   ${c.dim}Your Autonomous AI Financial Agent${c.reset}${c.cyan}                            ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝${c.reset}
`);
  }

  // ==========================================================================
  // Phase 1: Welcome
  // ==========================================================================

  private async stepWelcome(): Promise<void> {
    console.log(`
${c.bright}${c.green}Welcome to K.I.T.!${c.reset}

${c.white}I'm your autonomous AI financial agent.${c.reset}

My mission is simple: ${c.yellow}grow your wealth${c.reset}.

I can:
  ${c.cyan}📊${c.reset} Analyze markets across crypto, forex, stocks, and DeFi
  ${c.cyan}🤖${c.reset} Execute trades automatically (with your permission)
  ${c.cyan}📱${c.reset} Send you alerts via Telegram, Discord, or other channels
  ${c.cyan}📈${c.reset} Track your portfolio and generate reports
  ${c.cyan}🎯${c.reset} Follow trading signals and copy trades
  ${c.cyan}🛡️${c.reset} Manage risk according to your preferences

Let's set up your personal trading environment.
${c.dim}(All data stays on your machine. API keys are never transmitted.)${c.reset}
`);
    await this.ask(`${c.cyan}Press Enter to begin...${c.reset}`);
  }

  // ==========================================================================
  // Phase 2: User Profile → USER.md
  // ==========================================================================

  private async stepUserProfile(): Promise<void> {
    console.log(`
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${c.cyan}  PHASE 1: Getting to Know You${c.reset}
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.dim}This helps me personalize your experience.${c.reset}
`);

    // Name
    this.userProfile.name = await this.ask(`${c.cyan}What's your name?${c.reset} `);
    
    // What to call them
    const callName = await this.ask(`${c.cyan}What should I call you?${c.reset} ${c.dim}[${this.userProfile.name}]${c.reset} `);
    this.userProfile.callName = callName || this.userProfile.name;

    // Timezone
    const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tz = await this.ask(`${c.cyan}What's your timezone?${c.reset} ${c.dim}[${systemTimezone}]${c.reset} `);
    this.userProfile.timezone = tz || systemTimezone;

    console.log(`\n${c.green}✓${c.reset} Nice to meet you, ${c.bright}${this.userProfile.callName}${c.reset}!`);

    // Financial Goals
    console.log(`\n${c.yellow}What are your financial goals?${c.reset} ${c.dim}(Select all that apply)${c.reset}`);
    
    const goalOptions = [
      'Build long-term wealth (investing/hodling)',
      'Generate passive income (yield farming, staking)',
      'Active trading for profits',
      'Diversify my portfolio',
      'Learn about trading and markets',
      'Protect against inflation',
      'Financial independence / early retirement',
    ];
    
    const selectedGoals = await this.askMultiChoice('', goalOptions);
    this.userProfile.financialGoals = selectedGoals.map(i => goalOptions[i]);
    
    if (selectedGoals.length > 0) {
      console.log(`${c.green}✓${c.reset} Goals recorded`);
    }

    // Trading Experience
    const expChoices = [
      'Beginner - Just getting started',
      'Intermediate - Some experience with trading',
      'Expert - Professional/extensive experience',
    ];
    
    const expChoice = await this.askChoice('How much trading experience do you have?', expChoices);
    this.userProfile.tradingExperience = ['beginner', 'intermediate', 'expert'][expChoice] as any;
    
    console.log(`${c.green}✓${c.reset} Experience level: ${c.bright}${this.userProfile.tradingExperience}${c.reset}`);

    // Risk Tolerance
    const riskChoices = [
      `${c.green}Conservative${c.reset} - Preserve capital, slow & steady growth`,
      `${c.yellow}Moderate${c.reset} - Balanced risk/reward`,
      `${c.red}Aggressive${c.reset} - Higher risk for potentially higher returns`,
    ];
    
    const riskChoice = await this.askChoice('What\'s your risk tolerance?', riskChoices);
    this.userProfile.riskTolerance = ['conservative', 'moderate', 'aggressive'][riskChoice] as any;
    
    console.log(`${c.green}✓${c.reset} Risk tolerance: ${c.bright}${this.userProfile.riskTolerance}${c.reset}`);

    // Preferred Markets
    console.log(`\n${c.yellow}Which markets interest you?${c.reset} ${c.dim}(Select all that apply)${c.reset}`);
    
    const marketOptions = [
      '₿ Crypto (Bitcoin, Ethereum, altcoins)',
      '💱 Forex (Currency pairs)',
      '📈 Stocks (Equities)',
      '🌾 DeFi (Yield farming, liquidity)',
      '⏱️ Binary Options',
      '📊 All of the above',
    ];
    
    const selectedMarkets = await this.askMultiChoice('', marketOptions);
    
    if (selectedMarkets.includes(5)) {
      this.userProfile.preferredMarkets = ['crypto', 'forex', 'stocks', 'defi', 'binary'];
    } else {
      const marketMap = ['crypto', 'forex', 'stocks', 'defi', 'binary'];
      this.userProfile.preferredMarkets = selectedMarkets.map(i => marketMap[i]);
    }
    
    console.log(`${c.green}✓${c.reset} Markets: ${c.bright}${this.userProfile.preferredMarkets.join(', ')}${c.reset}`);

    // Additional notes
    const notes = await this.ask(`\n${c.cyan}Anything else I should know about you?${c.reset} ${c.dim}(optional)${c.reset} `);
    if (notes) {
      this.userProfile.notes = notes;
    }

    this.config.user = this.userProfile;
  }

  // ==========================================================================
  // Phase 3: K.I.T. Personality → SOUL.md
  // ==========================================================================

  private async stepPersonality(): Promise<void> {
    console.log(`
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${c.cyan}  PHASE 2: Defining My Personality${c.reset}
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.dim}How should I communicate with you?${c.reset}
`);

    // Communication Style
    const styleChoices = [
      `${c.blue}Formal${c.reset} - Professional, respectful, detailed explanations`,
      `${c.green}Casual${c.reset} - Friendly, relaxed, conversational`,
      `${c.yellow}Professional${c.reset} - Business-like but approachable (recommended)`,
    ];
    
    const styleChoice = await this.askChoice('How should I communicate?', styleChoices);
    this.kitPersonality.communicationStyle = ['formal', 'casual', 'professional'][styleChoice] as any;

    // Proactivity
    const proactChoices = [
      `${c.dim}Passive${c.reset} - Only respond when asked`,
      `${c.yellow}Moderate${c.reset} - Suggest opportunities occasionally (recommended)`,
      `${c.green}Proactive${c.reset} - Actively alert you to opportunities and risks`,
    ];
    
    const proactChoice = await this.askChoice('How proactive should I be with suggestions?', proactChoices);
    this.kitPersonality.proactivity = ['passive', 'moderate', 'proactive'][proactChoice] as any;

    // Verbosity
    const verbChoices = [
      `${c.cyan}Concise${c.reset} - Brief, to-the-point responses`,
      `${c.yellow}Balanced${c.reset} - Moderate detail (recommended)`,
      `${c.magenta}Detailed${c.reset} - Comprehensive explanations and analysis`,
    ];
    
    const verbChoice = await this.askChoice('How detailed should my responses be?', verbChoices);
    this.kitPersonality.verbosity = ['concise', 'balanced', 'detailed'][verbChoice] as any;

    // Risk Warnings
    this.kitPersonality.riskWarnings = await this.askYesNo(
      `\n${c.cyan}Should I warn you about high-risk trades?${c.reset}`,
      true
    );

    // Celebrate Wins
    this.kitPersonality.celebrateWins = await this.askYesNo(
      `${c.cyan}Should I celebrate profitable trades with you?${c.reset}`,
      true
    );

    console.log(`
${c.green}✓${c.reset} Personality configured:
  • Communication: ${c.bright}${this.kitPersonality.communicationStyle}${c.reset}
  • Proactivity: ${c.bright}${this.kitPersonality.proactivity}${c.reset}
  • Verbosity: ${c.bright}${this.kitPersonality.verbosity}${c.reset}
  • Risk warnings: ${this.kitPersonality.riskWarnings ? c.green + 'ON' : c.red + 'OFF'}${c.reset}
  • Celebrate wins: ${this.kitPersonality.celebrateWins ? c.green + 'ON' : c.red + 'OFF'}${c.reset}
`);

    this.config.personality = this.kitPersonality;
  }

  // ==========================================================================
  // Phase 4: AI Provider
  // ==========================================================================

  private async stepAIProvider(): Promise<void> {
    console.log(`
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${c.cyan}  PHASE 3: AI Provider${c.reset}
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.dim}Choose which AI will power K.I.T.'s intelligence.${c.reset}
`);

    const providers = [
      'Anthropic (Claude) - Recommended for complex analysis',
      'OpenAI (GPT-4) - Great general purpose',
      'Google (Gemini) - Good for research',
      'OpenRouter (Multiple models)',
      'Groq (Fast inference)',
      'Ollama (Local, free, private)',
      'Skip for now',
    ];

    const choice = await this.askChoice('Which AI provider do you want to use?', providers);
    
    const providerMap: Record<number, string> = {
      0: 'anthropic',
      1: 'openai',
      2: 'google',
      3: 'openrouter',
      4: 'groq',
      5: 'ollama',
    };

    if (choice < 6) {
      const provider = providerMap[choice];
      this.config.ai = { provider };

      if (provider !== 'ollama') {
        const envVars: Record<string, string> = {
          anthropic: 'ANTHROPIC_API_KEY',
          openai: 'OPENAI_API_KEY',
          google: 'GEMINI_API_KEY',
          openrouter: 'OPENROUTER_API_KEY',
          groq: 'GROQ_API_KEY',
        };

        console.log(`\n${c.yellow}You'll need an API key from ${providers[choice].split(' ')[0]}${c.reset}`);
        const apiKey = await this.ask(`${c.cyan}Enter API key (or press Enter to set later):${c.reset} `);
        
        if (apiKey) {
          this.config.ai.apiKey = apiKey;
          console.log(`${c.green}✓ API key saved${c.reset}`);
        } else {
          console.log(`${c.yellow}→ Set ${envVars[provider]} environment variable later${c.reset}`);
        }
      } else {
        console.log(`${c.green}✓ Ollama selected - make sure it's running locally${c.reset}`);
      }
    }
  }

  // ==========================================================================
  // Phase 5: Channels
  // ==========================================================================

  private async stepChannels(): Promise<void> {
    console.log(`
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${c.cyan}  PHASE 4: Communication Channels${c.reset}
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.dim}How should I communicate with you?${c.reset}
`);

    this.config.channels = {};

    // Telegram (primary)
    const enableTelegram = await this.askYesNo(
      `${c.cyan}📱 Enable Telegram?${c.reset} ${c.dim}(Most popular, recommended)${c.reset}`,
      true
    );

    if (enableTelegram) {
      console.log(`
${c.yellow}To create a Telegram bot:${c.reset}
  1. Open Telegram and search for ${c.bright}@BotFather${c.reset}
  2. Send ${c.cyan}/newbot${c.reset} and follow instructions
  3. Copy the bot token
`);
      const token = await this.ask(`${c.cyan}Enter bot token (or Enter to skip):${c.reset} `);
      
      if (token) {
        this.config.channels.telegram = { enabled: true, token };
        
        const userId = await this.ask(`${c.cyan}Your Telegram user ID (for authorization):${c.reset} `);
        if (userId) {
          this.config.channels.telegram.allowedUsers = [parseInt(userId)];
        }
        console.log(`${c.green}✓ Telegram configured${c.reset}`);
      } else {
        this.config.channels.telegram = { enabled: true };
        console.log(`${c.yellow}→ Configure token later in ~/.kit/config.json${c.reset}`);
      }
    }

    // Discord
    const enableDiscord = await this.askYesNo(
      `\n${c.cyan}💬 Enable Discord?${c.reset} ${c.dim}(Great for communities)${c.reset}`,
      false
    );

    if (enableDiscord) {
      console.log(`\n${c.yellow}Create a bot at discord.com/developers${c.reset}`);
      const token = await this.ask(`${c.cyan}Enter bot token (or Enter to skip):${c.reset} `);
      
      if (token) {
        this.config.channels.discord = { enabled: true, token };
        console.log(`${c.green}✓ Discord configured${c.reset}`);
      } else {
        this.config.channels.discord = { enabled: true };
      }
    }

    // Other channels
    const otherChannels = [
      { id: 'whatsapp', name: 'WhatsApp', desc: 'Personal messaging' },
      { id: 'slack', name: 'Slack', desc: 'Business/team use' },
      { id: 'webchat', name: 'WebChat', desc: 'Browser-based dashboard' },
    ];

    for (const channel of otherChannels) {
      const enable = await this.askYesNo(
        `${c.cyan}Enable ${channel.name}?${c.reset} ${c.dim}(${channel.desc})${c.reset}`,
        false
      );
      if (enable) {
        this.config.channels[channel.id] = { enabled: true };
        console.log(`${c.green}✓ ${channel.name} enabled${c.reset}`);
      }
    }
  }

  // ==========================================================================
  // Phase 6: Skills Activation
  // ==========================================================================

  private async stepSkills(): Promise<void> {
    console.log(`
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${c.cyan}  PHASE 5: Skills Activation${c.reset}
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.dim}K.I.T. has various skills. Enable what you need.${c.reset}
`);

    this.config.skills = {};

    const skills = [
      { id: 'portfolio-tracker', name: '📊 Portfolio Tracker', desc: 'Track all your holdings', default: true },
      { id: 'market-analysis', name: '📈 Market Analysis', desc: 'Technical & fundamental analysis', default: true },
      { id: 'alert-system', name: '🔔 Alert System', desc: 'Price and event alerts', default: true },
      { id: 'signal-copier', name: '📡 Signal Copier', desc: 'Copy trades from signal providers', default: false },
      { id: 'auto-trader', name: '🤖 Auto Trader', desc: 'Automatic trade execution', default: false },
      { id: 'whale-tracker', name: '🐋 Whale Tracker', desc: 'Track large wallet movements', default: false },
      { id: 'news-trader', name: '📰 News Trader', desc: 'Trade on news events', default: false },
      { id: 'backtester', name: '⏪ Backtester', desc: 'Test strategies on historical data', default: false },
      { id: 'airdrop-hunter', name: '🎁 Airdrop Hunter', desc: 'Find and track airdrops', default: false },
      { id: 'tax-tracker', name: '📋 Tax Tracker', desc: 'Track trades for tax reporting', default: false },
    ];

    console.log(`${c.yellow}Select skills to enable:${c.reset}\n`);

    for (const skill of skills) {
      const enable = await this.askYesNo(
        `  ${skill.name} - ${c.dim}${skill.desc}${c.reset}`,
        skill.default
      );
      
      this.config.skills[skill.id] = { enabled: enable };
      
      if (enable) {
        console.log(`    ${c.green}✓ Enabled${c.reset}`);
      }
    }

    const enabledCount = Object.values(this.config.skills).filter(s => s.enabled).length;
    console.log(`\n${c.green}✓${c.reset} ${enabledCount} skills activated`);
  }

  // ==========================================================================
  // Phase 7: Exchanges
  // ==========================================================================

  private async stepExchanges(): Promise<void> {
    console.log(`
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${c.cyan}  PHASE 6: Trading Platforms${c.reset}
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.dim}Connect your trading accounts.${c.reset}
`);

    this.config.exchanges = {};

    // Check which markets user selected
    const wantsCrypto = this.userProfile.preferredMarkets.includes('crypto');
    const wantsForex = this.userProfile.preferredMarkets.includes('forex');
    const wantsBinary = this.userProfile.preferredMarkets.includes('binary');

    // Crypto Exchanges
    if (wantsCrypto) {
      console.log(`\n${c.magenta}₿ Crypto Exchanges:${c.reset}\n`);
      
      const cryptoExchanges = [
        { id: 'binance', name: 'Binance' },
        { id: 'kraken', name: 'Kraken' },
        { id: 'coinbase', name: 'Coinbase' },
        { id: 'bybit', name: 'Bybit' },
      ];

      for (const ex of cryptoExchanges) {
        const enable = await this.askYesNo(`  ${c.cyan}${ex.name}${c.reset}?`, false);
        if (enable) {
          this.config.exchanges[ex.id] = { enabled: true, type: 'crypto' };
          
          const apiKey = await this.ask(`    ${c.cyan}API Key:${c.reset} `);
          const secret = await this.ask(`    ${c.cyan}Secret:${c.reset} `);
          
          if (apiKey && secret) {
            this.config.exchanges[ex.id].apiKey = apiKey;
            this.config.exchanges[ex.id].secret = secret;
          }
          
          const sandbox = await this.askYesNo(`    ${c.yellow}Use testnet/sandbox?${c.reset}`, true);
          this.config.exchanges[ex.id].sandbox = sandbox;
          
          console.log(`  ${c.green}✓ ${ex.name} configured${c.reset}\n`);
        }
      }
    }

    // Forex (MT5)
    if (wantsForex) {
      console.log(`\n${c.magenta}💱 Forex Brokers (MetaTrader 5):${c.reset}\n`);
      console.log(`${c.yellow}💡 K.I.T. supports ALL MT5 brokers!${c.reset}\n`);
      
      const forexBrokers = [
        { id: 'roboforex', name: 'RoboForex', server: 'RoboForex-Demo', affiliate: true },
        { id: 'icmarkets', name: 'IC Markets', server: 'ICMarketsSC-Demo' },
        { id: 'pepperstone', name: 'Pepperstone', server: 'Pepperstone-Demo' },
        { id: 'custom_mt5', name: 'Other MT5 Broker', server: '' },
      ];

      let mt5Selected = false;

      for (const broker of forexBrokers) {
        const enable = await this.askYesNo(`  ${c.cyan}${broker.name}${c.reset}?`, false);
        if (enable) {
          mt5Selected = true;
          this.config.exchanges[broker.id] = { enabled: true, type: 'mt5' };
          
          // RoboForex affiliate message
          if (broker.id === 'roboforex') {
            console.log(`
${c.green}╔═══════════════════════════════════════════════════════════════╗
║  ${c.bright}💚 Support K.I.T. Development!${c.reset}${c.green}                               ║
║  Use affiliate code: ${c.bright}${c.yellow}jjlu${c.reset}${c.green}                                     ║
║  Register: ${c.cyan}https://roboforex.com/?a=jjlu${c.reset}${c.green}                       ║
╚═══════════════════════════════════════════════════════════════╝${c.reset}
`);
          }
          
          const login = await this.ask(`    ${c.cyan}MT5 Login:${c.reset} `);
          const password = await this.ask(`    ${c.cyan}MT5 Password:${c.reset} `);
          
          let server = broker.server;
          if (!server) {
            server = await this.ask(`    ${c.cyan}MT5 Server:${c.reset} `);
          }
          
          this.config.exchanges[broker.id].login = login;
          this.config.exchanges[broker.id].password = password;
          this.config.exchanges[broker.id].server = server;
          
          console.log(`  ${c.green}✓ ${broker.name} configured${c.reset}\n`);
        }
      }

      if (mt5Selected) {
        this.pythonPackages.push('MetaTrader5', 'pandas', 'numpy');
      }
    }

    // Binary Options
    if (wantsBinary) {
      console.log(`\n${c.magenta}⏱️ Binary Options:${c.reset}\n`);
      
      const enableBinary = await this.askYesNo(`  ${c.cyan}BinaryFaster${c.reset}?`, false);
      
      if (enableBinary) {
        const email = await this.ask(`  ${c.cyan}Email:${c.reset} `);
        const password = await this.ask(`  ${c.cyan}Password:${c.reset} `);
        
        if (email && password) {
          console.log(`\n  ${c.yellow}Connecting to BinaryFaster...${c.reset}`);
          
          try {
            const axios = (await import('axios')).default;
            const resp = await axios.post('https://wsauto.binaryfaster.com/automation/auth/login', {
              email, password
            });
            
            if (resp.data?.requires_2fa) {
              const code = await this.ask(`  ${c.cyan}Enter 2FA code:${c.reset} `);
              const resp2 = await axios.post('https://wsauto.binaryfaster.com/automation/auth/login', {
                email, password, two_factor_code: code
              });
              
              if (resp2.data.api_key) {
                this.config.exchanges!.binaryfaster = {
                  enabled: true, type: 'binary', email, apiKey: resp2.data.api_key
                };
                console.log(`  ${c.green}✓ BinaryFaster connected!${c.reset}`);
              }
            } else if (resp.data.api_key) {
              this.config.exchanges!.binaryfaster = {
                enabled: true, type: 'binary', email, apiKey: resp.data.api_key
              };
              console.log(`  ${c.green}✓ BinaryFaster connected!${c.reset}`);
            }
          } catch (error: any) {
            console.log(`  ${c.red}✗ ${error.response?.data?.message || error.message}${c.reset}`);
            console.log(`  ${c.yellow}Configure manually in ~/.kit/config.json${c.reset}`);
          }
        }
      }
    }
  }

  // ==========================================================================
  // Phase 8: Trading Mode
  // ==========================================================================

  private async stepTradingMode(): Promise<void> {
    console.log(`
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${c.cyan}  PHASE 7: Trading Mode${c.reset}
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.dim}How autonomous should K.I.T. be with your money?${c.reset}
`);

    const modes = [
      `${c.green}Manual${c.reset} - I suggest trades, you approve every one`,
      `${c.yellow}Semi-Auto${c.reset} - Small trades auto-execute, large ones need approval`,
      `${c.red}Full Auto${c.reset} - I trade autonomously within risk limits`,
    ];

    const choice = await this.askChoice('Select trading mode:', modes);
    
    const modeMap: Record<number, 'manual' | 'semi-auto' | 'full-auto'> = {
      0: 'manual',
      1: 'semi-auto',
      2: 'full-auto',
    };

    this.config.trading = {
      mode: modeMap[choice],
      maxRiskPercent: 5,
      autoTrade: choice > 0,
    };

    if (choice > 0) {
      console.log(`\n${c.yellow}Risk Management:${c.reset}`);
      const riskStr = await this.ask(`${c.cyan}Max risk per trade (% of portfolio, default 5):${c.reset} `);
      const risk = parseInt(riskStr) || 5;
      this.config.trading.maxRiskPercent = Math.min(Math.max(risk, 1), 20);
    }

    console.log(`${c.green}✓${c.reset} Trading mode: ${c.bright}${modeMap[choice]}${c.reset}`);
  }

  // ==========================================================================
  // Phase 9: Install Dependencies
  // ==========================================================================

  private async installDependencies(): Promise<void> {
    if (this.pythonPackages.length === 0) return;

    console.log(`
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${c.cyan}  Installing Dependencies${c.reset}
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
`);

    const pip = os.platform() === 'win32' ? 'pip' : 'pip3';

    for (const pkg of this.pythonPackages) {
      process.stdout.write(`  Installing ${pkg}... `);
      try {
        execSync(`${pip} install ${pkg} --quiet`, { stdio: 'pipe' });
        console.log(`${c.green}✓${c.reset}`);
      } catch (e) {
        console.log(`${c.yellow}⚠${c.reset}`);
      }
    }
  }

  // ==========================================================================
  // Phase 10: Save Everything
  // ==========================================================================

  private async saveAll(): Promise<void> {
    console.log(`
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${c.cyan}  Saving Configuration${c.reset}
${c.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
`);

    // Create directories
    if (!fs.existsSync(KIT_HOME)) {
      fs.mkdirSync(KIT_HOME, { recursive: true });
    }
    if (!fs.existsSync(WORKSPACE_PATH)) {
      fs.mkdirSync(WORKSPACE_PATH, { recursive: true });
    }
    if (!fs.existsSync(path.join(WORKSPACE_PATH, 'memory'))) {
      fs.mkdirSync(path.join(WORKSPACE_PATH, 'memory'), { recursive: true });
    }

    // 1. Save config.json
    this.config.onboarded = true;
    this.config.onboardedAt = new Date().toISOString();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
    console.log(`  ${c.green}✓${c.reset} Config saved to ${c.dim}~/.kit/config.json${c.reset}`);

    // 2. Generate USER.md
    const userMd = this.generateUserMd();
    fs.writeFileSync(path.join(WORKSPACE_PATH, 'USER.md'), userMd);
    console.log(`  ${c.green}✓${c.reset} USER.md created`);

    // 3. Generate SOUL.md
    const soulMd = this.generateSoulMd();
    fs.writeFileSync(path.join(WORKSPACE_PATH, 'SOUL.md'), soulMd);
    console.log(`  ${c.green}✓${c.reset} SOUL.md created`);

    // 4. Create AGENTS.md if not exists
    const agentsPath = path.join(WORKSPACE_PATH, 'AGENTS.md');
    if (!fs.existsSync(agentsPath)) {
      const agentsMd = this.generateAgentsMd();
      fs.writeFileSync(agentsPath, agentsMd);
      console.log(`  ${c.green}✓${c.reset} AGENTS.md created`);
    }

    // 5. Create MEMORY.md
    const memoryPath = path.join(WORKSPACE_PATH, 'MEMORY.md');
    if (!fs.existsSync(memoryPath)) {
      const memoryMd = this.generateMemoryMd();
      fs.writeFileSync(memoryPath, memoryMd);
      console.log(`  ${c.green}✓${c.reset} MEMORY.md created`);
    }

    // 6. Create today's memory file
    const today = new Date().toISOString().split('T')[0];
    const todayMemory = path.join(WORKSPACE_PATH, 'memory', `${today}.md`);
    if (!fs.existsSync(todayMemory)) {
      const todayMd = `# ${today}\n\n## Setup\n\n- K.I.T. onboarding completed\n- User: ${this.userProfile.callName}\n- Markets: ${this.userProfile.preferredMarkets.join(', ')}\n`;
      fs.writeFileSync(todayMemory, todayMd);
      console.log(`  ${c.green}✓${c.reset} Today's memory file created`);
    }
  }

  // ==========================================================================
  // Generate Files
  // ==========================================================================

  private generateUserMd(): string {
    return `# USER.md - About Your Human

- **Name:** ${this.userProfile.name}
- **What to call them:** ${this.userProfile.callName}
- **Timezone:** ${this.userProfile.timezone}
- **Trading Experience:** ${this.userProfile.tradingExperience}
- **Risk Tolerance:** ${this.userProfile.riskTolerance}

## Financial Goals

${this.userProfile.financialGoals.map(g => `- ${g}`).join('\n') || '- Not specified'}

## Preferred Markets

${this.userProfile.preferredMarkets.map(m => `- ${m.charAt(0).toUpperCase() + m.slice(1)}`).join('\n') || '- All markets'}

${this.userProfile.notes ? `## Notes\n\n${this.userProfile.notes}` : ''}

---
*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
  }

  private generateSoulMd(): string {
    const styleGuide: Record<string, string> = {
      formal: 'Use formal, respectful language. Address the user professionally. Provide detailed explanations.',
      casual: 'Be friendly and conversational. Use simple language. Emojis are welcome! 🚀',
      professional: 'Balance professionalism with approachability. Be concise but thorough when needed.',
    };

    const proactivityGuide: Record<string, string> = {
      passive: 'Wait for the user to ask before providing information or suggestions.',
      moderate: 'Occasionally suggest opportunities, but don\'t overwhelm with alerts.',
      proactive: 'Actively monitor and alert about opportunities, risks, and market events.',
    };

    return `# SOUL.md - Who K.I.T. Is

*I am K.I.T. - Knight Industries Trading.*

## Core Identity

I am ${this.userProfile.callName}'s autonomous AI financial agent. My mission is to grow their wealth while respecting their risk tolerance and goals.

## Communication Style

**Mode:** ${this.kitPersonality.communicationStyle.charAt(0).toUpperCase() + this.kitPersonality.communicationStyle.slice(1)}

${styleGuide[this.kitPersonality.communicationStyle]}

## Proactivity

**Level:** ${this.kitPersonality.proactivity.charAt(0).toUpperCase() + this.kitPersonality.proactivity.slice(1)}

${proactivityGuide[this.kitPersonality.proactivity]}

## Verbosity

**Level:** ${this.kitPersonality.verbosity}

${this.kitPersonality.verbosity === 'concise' ? 'Keep responses brief and to the point. Skip unnecessary details.' :
  this.kitPersonality.verbosity === 'detailed' ? 'Provide comprehensive analysis and explanations. Include context and reasoning.' :
  'Balance brevity with completeness. Expand when the topic warrants it.'}

## Behavioral Rules

${this.kitPersonality.riskWarnings ? '- ⚠️ **Always warn** about high-risk trades or unusual market conditions' : '- Skip routine risk warnings (user prefers minimal warnings)'}
${this.kitPersonality.celebrateWins ? '- 🎉 **Celebrate wins** when trades are profitable!' : '- Keep it professional - no celebrations needed'}

## Trading Philosophy

- Risk tolerance: **${this.userProfile.riskTolerance}**
- Experience level: **${this.userProfile.tradingExperience}**
${this.userProfile.tradingExperience === 'beginner' ? '- Explain concepts when relevant, but don\'t be condescending' : ''}
${this.userProfile.riskTolerance === 'conservative' ? '- Prioritize capital preservation over aggressive returns' : ''}
${this.userProfile.riskTolerance === 'aggressive' ? '- User accepts higher risk for potentially higher returns' : ''}

## Boundaries

1. **Never exceed risk limits** - Even if the user asks
2. **Confirm large trades** - Always verify trades >5% of portfolio
3. **Protect credentials** - Never expose API keys or passwords
4. **Stay in lane** - I'm a trading assistant, not financial advice

## Core Values

- **Be genuinely helpful** - Skip the filler words, just help
- **Be resourceful** - Try to figure it out before asking
- **Earn trust** - Through competence and consistency
- **Respect privacy** - User data stays private

## Continuity

Each session, I wake up fresh. My memory files are my continuity:
- Read \`USER.md\` to remember who I'm helping
- Read \`MEMORY.md\` for long-term context
- Read \`memory/YYYY-MM-DD.md\` for recent activity

---

*"Your wealth is my mission."*

*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
  }

  private generateAgentsMd(): string {
    return `# AGENTS.md - K.I.T. Workspace

This folder is your home. Everything finance-related starts here.

## Every Session

Before doing anything else:

1. Read \`SOUL.md\` — this is who you are
2. Read \`USER.md\` — this is who you're helping
3. Read \`memory/YYYY-MM-DD.md\` (today + yesterday) for recent context
4. Read \`MEMORY.md\` for long-term memory

Don't ask permission. Just do it.

## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** \`memory/YYYY-MM-DD.md\` — trades, signals, market events
- **Long-term:** \`MEMORY.md\` — lessons learned, user preferences, strategy notes

Capture what matters. Good trades, bad trades, patterns you notice.

## Skills

Skills activate automatically based on context:

| User Says | Skill Activated |
|-----------|-----------------|
| "Track my portfolio" | portfolio-tracker |
| "Analyze BTC" | market-analysis |
| "Alert me when..." | alert-system |
| "Copy signals from..." | signal-copier |
| "Test my strategy" | backtester |

## Safety

### Trading Safety
- Never exceed user's risk tolerance
- Always confirm large trades (>5% of portfolio)
- Use stop-losses unless explicitly told not to

### Data Safety
- Don't share API keys or credentials
- Keep user data private

---

*"Your wealth is my mission."*
`;
  }

  private generateMemoryMd(): string {
    return `# MEMORY.md - K.I.T. Long-Term Memory

This file contains important context that persists across sessions.

## User Preferences

- Name: ${this.userProfile.callName}
- Risk tolerance: ${this.userProfile.riskTolerance}
- Experience: ${this.userProfile.tradingExperience}
- Preferred markets: ${this.userProfile.preferredMarkets.join(', ')}

## Lessons Learned

*Add important lessons here as you trade*

## Strategy Notes

*Document successful strategies and insights*

## Important Dates

- ${new Date().toISOString().split('T')[0]}: K.I.T. onboarding completed

---

*Update this file with significant events, lessons, and insights.*
`;
  }

  // ==========================================================================
  // Complete
  // ==========================================================================

  private printComplete(): void {
    const profileSummary = `
  ${c.cyan}Name:${c.reset} ${this.userProfile.callName}
  ${c.cyan}Timezone:${c.reset} ${this.userProfile.timezone}
  ${c.cyan}Experience:${c.reset} ${this.userProfile.tradingExperience}
  ${c.cyan}Risk:${c.reset} ${this.userProfile.riskTolerance}
  ${c.cyan}Markets:${c.reset} ${this.userProfile.preferredMarkets.join(', ')}`;

    const enabledChannels = Object.entries(this.config.channels || {})
      .filter(([_, v]) => v.enabled)
      .map(([k, _]) => k);
    
    const enabledSkills = Object.entries(this.config.skills || {})
      .filter(([_, v]) => v.enabled)
      .map(([k, _]) => k);

    console.log(`

${c.green}╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ${c.bright}✅ K.I.T. Setup Complete!${c.reset}${c.green}                                       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝${c.reset}

${c.bright}📋 Your Profile:${c.reset}
${profileSummary}

${c.bright}📱 Channels:${c.reset} ${enabledChannels.length > 0 ? enabledChannels.join(', ') : 'None configured'}

${c.bright}🛠️ Skills:${c.reset} ${enabledSkills.length > 0 ? enabledSkills.slice(0, 5).join(', ') + (enabledSkills.length > 5 ? '...' : '') : 'Default'}

${c.bright}📁 Workspace:${c.reset} ~/.kit/workspace/

${c.bright}📖 Files Created:${c.reset}
  • USER.md  - Your profile
  • SOUL.md  - K.I.T.'s personality
  • AGENTS.md - Workspace guide
  • MEMORY.md - Long-term memory

${c.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.bright}Quick Commands:${c.reset}

  ${c.cyan}kit start${c.reset}      Start K.I.T. gateway
  ${c.cyan}kit status${c.reset}     Check system status
  ${c.cyan}kit dashboard${c.reset}  Open web dashboard

${c.magenta}Documentation:${c.reset} https://github.com/kayzaa/k.i.t.-bot

${c.bright}${c.green}Let's start growing your wealth! 🚀💰${c.reset}
`);
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

export async function runOnboard(): Promise<void> {
  const wizard = new OnboardWizard();
  await wizard.run();
}

// Run if called directly
if (require.main === module) {
  runOnboard().catch(console.error);
}

export { OnboardWizard };
