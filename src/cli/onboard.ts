#!/usr/bin/env node

/**
 * K.I.T. Onboard Wizard
 * 
 * Interactive setup like `openclaw onboard`
 * Guides user through complete configuration
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

const c = colors;

interface Config {
  ai?: {
    provider: string;
    apiKey?: string;
  };
  channels?: Record<string, any>;
  exchanges?: Record<string, any>;
  trading?: {
    mode: 'manual' | 'semi-auto' | 'full-auto';
    maxRiskPercent: number;
  };
}

class OnboardWizard {
  private rl: readline.Interface;
  private config: Config = {};
  private pythonPackages: string[] = [];

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async run(): Promise<void> {
    this.printBanner();
    
    await this.stepWelcome();
    await this.stepAIProvider();
    await this.stepChannels();
    await this.stepExchanges();
    await this.stepTradingMode();
    await this.installDependencies();
    await this.saveConfig();
    
    this.printComplete();
    this.rl.close();
  }

  private printBanner(): void {
    console.log(`
${c.cyan}╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ${c.bright}🤖 K.I.T. - Knight Industries Trading${c.reset}${c.cyan}                    ║
║     ${c.reset}Your Autonomous AI Financial Agent${c.cyan}                        ║
║                                                               ║
║     ${c.yellow}Onboard Wizard${c.cyan}                                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝${c.reset}
`);
  }

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

  private async askYesNo(question: string, defaultYes = true): Promise<boolean> {
    const hint = defaultYes ? '[Y/n]' : '[y/N]';
    const answer = await this.ask(`${question} ${c.cyan}${hint}${c.reset} `);
    if (answer === '') return defaultYes;
    return answer.toLowerCase().startsWith('y');
  }

  private async stepWelcome(): Promise<void> {
    console.log(`
${c.bright}Welcome to K.I.T.!${c.reset}

This wizard will help you set up your personal AI trading agent.
We'll configure:

  ${c.green}1.${c.reset} AI Provider (Claude, GPT, Gemini, etc.)
  ${c.green}2.${c.reset} Communication Channels (Telegram, Discord, etc.)
  ${c.green}3.${c.reset} Trading Platforms (Binance, MT5, etc.)
  ${c.green}4.${c.reset} Trading Mode & Risk Settings

${c.yellow}All API keys are stored locally and never transmitted.${c.reset}
`);
    await this.ask(`${c.cyan}Press Enter to continue...${c.reset}`);
  }

  private async stepAIProvider(): Promise<void> {
    console.log(`\n${c.bright}━━━ Step 1: AI Provider ━━━${c.reset}\n`);
    
    const providers = [
      'Anthropic (Claude) - Recommended',
      'OpenAI (GPT-4)',
      'Google (Gemini)',
      'OpenRouter (Multiple models)',
      'Groq (Fast inference)',
      'Ollama (Local, free)',
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

  private async stepChannels(): Promise<void> {
    console.log(`\n${c.bright}━━━ Step 2: Communication Channels ━━━${c.reset}\n`);
    
    this.config.channels = {};

    const channels = [
      { id: 'telegram', name: 'Telegram', desc: 'Most popular, easy setup' },
      { id: 'discord', name: 'Discord', desc: 'Great for communities' },
      { id: 'whatsapp', name: 'WhatsApp', desc: 'Personal messaging' },
      { id: 'slack', name: 'Slack', desc: 'Business/team use' },
      { id: 'matrix', name: 'Matrix', desc: 'Decentralized, private' },
      { id: 'webchat', name: 'WebChat', desc: 'Browser-based' },
    ];

    console.log('Select which channels to enable:\n');

    for (const channel of channels) {
      const enable = await this.askYesNo(
        `  ${c.cyan}${channel.name}${c.reset} (${channel.desc})?`,
        channel.id === 'telegram'
      );

      if (enable) {
        this.config.channels[channel.id] = { enabled: true };
        
        if (channel.id === 'telegram') {
          console.log(`\n  ${c.yellow}Create a bot via @BotFather on Telegram${c.reset}`);
          const token = await this.ask(`  ${c.cyan}Enter bot token (or Enter to skip):${c.reset} `);
          if (token) {
            this.config.channels.telegram.token = token;
          }
          
          const userId = await this.ask(`  ${c.cyan}Your Telegram user ID (for authorization):${c.reset} `);
          if (userId) {
            this.config.channels.telegram.allowedUsers = [parseInt(userId)];
          }
        }

        if (channel.id === 'discord') {
          console.log(`\n  ${c.yellow}Create a bot at discord.com/developers${c.reset}`);
          const token = await this.ask(`  ${c.cyan}Enter bot token (or Enter to skip):${c.reset} `);
          if (token) {
            this.config.channels.discord.token = token;
          }
        }

        console.log(`  ${c.green}✓ ${channel.name} enabled${c.reset}\n`);
      }
    }
  }

  private async stepExchanges(): Promise<void> {
    console.log(`\n${c.bright}━━━ Step 3: Trading Platforms ━━━${c.reset}\n`);
    
    this.config.exchanges = {};

    // Crypto exchanges
    console.log(`${c.magenta}Crypto Exchanges:${c.reset}\n`);
    
    const cryptoExchanges = [
      { id: 'binance', name: 'Binance' },
      { id: 'kraken', name: 'Kraken' },
      { id: 'coinbase', name: 'Coinbase' },
      { id: 'bybit', name: 'Bybit' },
      { id: 'okx', name: 'OKX' },
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

    // Forex brokers
    console.log(`\n${c.magenta}Forex Brokers (MetaTrader):${c.reset}\n`);
    
    const forexBrokers = [
      { id: 'roboforex', name: 'RoboForex', server: 'RoboForex-Demo' },
      { id: 'icmarkets', name: 'IC Markets', server: 'ICMarketsSC-Demo' },
      { id: 'pepperstone', name: 'Pepperstone', server: 'Pepperstone-Demo' },
      { id: 'xm', name: 'XM', server: 'XMGlobal-Demo' },
      { id: 'custom_mt5', name: 'Other MT5 Broker', server: '' },
    ];

    let mt5Selected = false;

    for (const broker of forexBrokers) {
      const enable = await this.askYesNo(`  ${c.cyan}${broker.name}${c.reset}?`, false);
      if (enable) {
        mt5Selected = true;
        this.config.exchanges[broker.id] = { enabled: true, type: 'mt5' };
        
        const login = await this.ask(`    ${c.cyan}MT5 Login/Account:${c.reset} `);
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

    // Queue MT5 Python packages if needed
    if (mt5Selected) {
      console.log(`\n${c.yellow}→ MetaTrader 5 selected. Python packages will be installed automatically.${c.reset}`);
      this.pythonPackages.push('MetaTrader5', 'pandas', 'numpy');
    }
  }

  private async stepTradingMode(): Promise<void> {
    console.log(`\n${c.bright}━━━ Step 4: Trading Mode ━━━${c.reset}\n`);
    
    const modes = [
      'Manual - K.I.T. suggests, you approve every trade',
      'Semi-Auto - Small trades auto-execute, large trades need approval',
      'Full Auto - K.I.T. trades autonomously within risk limits',
    ];

    const choice = await this.askChoice('How autonomous should K.I.T. be?', modes);
    
    const modeMap: Record<number, 'manual' | 'semi-auto' | 'full-auto'> = {
      0: 'manual',
      1: 'semi-auto',
      2: 'full-auto',
    };

    this.config.trading = {
      mode: modeMap[choice],
      maxRiskPercent: 5,
    };

    if (choice > 0) {
      console.log(`\n${c.yellow}Risk Management:${c.reset}`);
      const riskStr = await this.ask(`${c.cyan}Max risk per trade (% of portfolio, default 5):${c.reset} `);
      const risk = parseInt(riskStr) || 5;
      this.config.trading.maxRiskPercent = Math.min(Math.max(risk, 1), 20);
    }

    console.log(`${c.green}✓ Trading mode: ${modes[choice].split(' - ')[0]}${c.reset}`);
  }

  private async installDependencies(): Promise<void> {
    if (this.pythonPackages.length === 0) return;

    console.log(`\n${c.bright}━━━ Installing Dependencies ━━━${c.reset}\n`);
    
    const isWindows = os.platform() === 'win32';
    const pip = isWindows ? 'pip' : 'pip3';

    console.log(`${c.yellow}Installing Python packages: ${this.pythonPackages.join(', ')}${c.reset}\n`);

    for (const pkg of this.pythonPackages) {
      process.stdout.write(`  Installing ${pkg}... `);
      try {
        execSync(`${pip} install ${pkg} --quiet`, { stdio: 'pipe' });
        console.log(`${c.green}✓${c.reset}`);
      } catch (e) {
        console.log(`${c.yellow}⚠ (may need manual install)${c.reset}`);
      }
    }
  }

  private async saveConfig(): Promise<void> {
    console.log(`\n${c.bright}━━━ Saving Configuration ━━━${c.reset}\n`);

    // Ensure directory exists
    if (!fs.existsSync(KIT_HOME)) {
      fs.mkdirSync(KIT_HOME, { recursive: true });
    }

    // Save config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
    console.log(`${c.green}✓ Config saved to ${CONFIG_PATH}${c.reset}`);

    // Copy workspace templates if not exists
    const workspaceDir = path.join(KIT_HOME, 'workspace');
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
  }

  private printComplete(): void {
    console.log(`
${c.green}╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ${c.bright}✅ K.I.T. Setup Complete!${c.reset}${c.green}                                ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝${c.reset}

${c.bright}Next steps:${c.reset}

  ${c.cyan}1.${c.reset} Start K.I.T.:
     ${c.yellow}kit start${c.reset}

  ${c.cyan}2.${c.reset} Or run in development mode:
     ${c.yellow}npm run dev${c.reset}

  ${c.cyan}3.${c.reset} Message your bot on Telegram/Discord!

${c.bright}Useful commands:${c.reset}

  ${c.yellow}kit status${c.reset}     - Check system status
  ${c.yellow}kit config${c.reset}     - Edit configuration
  ${c.yellow}kit exchanges${c.reset}  - Manage exchanges
  ${c.yellow}kit balance${c.reset}    - Check portfolio balance

${c.magenta}Documentation: https://github.com/kayzaa/k.i.t.-bot${c.reset}

${c.bright}Happy Trading! 🚀💹${c.reset}
`);
  }
}

// Run if called directly
if (require.main === module) {
  const wizard = new OnboardWizard();
  wizard.run().catch(console.error);
}

export { OnboardWizard };
