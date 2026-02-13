#!/usr/bin/env node

/**
 * K.I.T. CLI
 * 
 * Commands:
 *   kit onboard    - Interactive setup wizard
 *   kit start      - Start the gateway
 *   kit status     - Check system status
 *   kit config     - View/edit configuration
 *   kit exchanges  - Manage exchange connections
 *   kit balance    - Check portfolio balance
 *   kit trade      - Execute trades
 *   kit doctor     - Diagnose issues
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const program = new Command();
const KIT_HOME = path.join(os.homedir(), '.kit');
const VERSION = '2.0.0';
const GITHUB_REPO = 'kayzaa/k.i.t.-bot';

// Taglines - rotate randomly
const TAGLINES = [
  "Your wealth is my mission.",
  "Knight Industries Trading at your service.",
  "One AI. All your finances. Fully autonomous.",
  "The supernatural financial agent.",
  "Trading while you sleep.",
  "Powered by TraderLifestyle.",
];

function getTagline(): string {
  return TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
}

function showBanner(): void {
  console.log(`
🚗 K.I.T. ${VERSION} — ${getTagline()}
`);
}

program
  .name('kit')
  .description('K.I.T. - Knight Industries Trading: Your AI Financial Agent')
  .version(VERSION)
  .addHelpText('beforeAll', `
🚗 K.I.T. ${VERSION} — ${getTagline()}
`)
  .addHelpText('afterAll', `
Examples:
  kit start                    Start the gateway with dashboard
  kit start --port 19000       Start on custom port
  kit onboard                  Interactive setup wizard
  kit status                   Check system status
  kit whatsapp login           Connect WhatsApp
  kit config set ai.model gpt-4o  Change AI model
  kit doctor                   Diagnose issues
  kit update                   Update to latest version

Docs: https://github.com/${GITHUB_REPO}
`);

// ═══════════════════════════════════════════════════════════════
// ONBOARD
// ═══════════════════════════════════════════════════════════════
program
  .command('onboard')
  .alias('init')
  .alias('setup')
  .description('Interactive setup wizard - configure K.I.T. step by step')
  .option('--classic', 'Use classic text-based onboarding')
  .action(async (options) => {
    if (options.classic) {
      // Legacy text-based onboarding
      const { OnboardWizard } = await import('./onboard');
      const wizard = new OnboardWizard();
      await wizard.run();
    } else {
      // New interactive terminal UI with multi-select
      const { runInteractiveOnboarding } = await import('./onboard-interactive');
      await runInteractiveOnboarding();
    }
  });

// ═══════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════
program
  .command('start')
  .alias('gateway')
  .description('Start the K.I.T. gateway (autonomous mode + all channels)')
  .option('-p, --port <port>', 'Port to listen on', '18799')
  .option('-h, --host <host>', 'Host to bind to', '127.0.0.1')
  .option('-d, --detach', 'Run in background')
  .option('-t, --token <token>', 'Gateway auth token')
  .option('--no-autonomous', 'Disable autonomous mode')
  .option('--no-telegram', 'Disable Telegram channel')
  .option('--no-dashboard', 'Do not open dashboard in browser')
  .action(async (options) => {
    const { createGatewayServer } = await import('../gateway/server');
    const { loadConfig, DEFAULT_CONFIG } = await import('../config');
    
    // Load config and merge with CLI options
    const config = loadConfig();
    
    // Check if onboarding is needed
    if (!config.onboarded) {
      const onboardingPath = path.join(KIT_HOME, 'onboarding.json');
      let needsOnboarding = true;
      
      if (fs.existsSync(onboardingPath)) {
        try {
          const state = JSON.parse(fs.readFileSync(onboardingPath, 'utf8'));
          needsOnboarding = !state.completed;
        } catch {}
      }
      
      if (needsOnboarding) {
        console.log('\n🚗 K.I.T. needs to be configured first!\n');
        const { runInteractiveOnboarding } = await import('./onboard-interactive');
        await runInteractiveOnboarding();
        
        // Reload config after onboarding
        const newConfig = loadConfig();
        if (!newConfig.onboarded) {
          console.log('\n⚠️ Onboarding not completed. Run "kit onboard" to configure.\n');
          process.exit(1);
        }
        Object.assign(config, newConfig);
      }
    }
    
    const gatewayConfig = {
      port: parseInt(options.port, 10) || config.gateway?.port || 18799,
      host: options.host || config.gateway?.host || '127.0.0.1',
      token: options.token || config.gateway?.token,
      stateDir: KIT_HOME,
      workspaceDir: path.join(KIT_HOME, 'workspace'),
      agent: config.agent || DEFAULT_CONFIG.agent,
      heartbeat: config.heartbeat || DEFAULT_CONFIG.heartbeat,
      cron: config.cron || DEFAULT_CONFIG.cron,
      memory: config.memory || DEFAULT_CONFIG.memory,
    } as any;
    
    if (options.detach) {
      // Run in background using spawn
      const { spawn } = await import('child_process');
      const child = spawn(process.execPath, [__filename, 'start', '-p', String(gatewayConfig.port)], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      
      console.log(`🚀 K.I.T. Gateway started in background (PID: ${child.pid})`);
      console.log(`   Endpoint: ws://${gatewayConfig.host}:${gatewayConfig.port}`);
      process.exit(0);
    }
    
    // Start gateway in foreground
    const gateway = createGatewayServer(gatewayConfig);
    
    await gateway.start();
    
    // Start autonomous agent (DEFAULT: ON - use --no-autonomous to disable)
    let autonomousAgent: any = null;
    if (options.autonomous !== false) {
      console.log('\n🤖 Starting Autonomous Agent...');
      const { getAutonomousAgent } = await import('../core/autonomous-agent');
      autonomousAgent = getAutonomousAgent();
      
      // Configure Telegram from config or env (DEFAULT: ON if configured)
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN || config.channels?.telegram?.token;
      const telegramChatId = process.env.TELEGRAM_CHAT_ID || config.channels?.telegram?.chatId;
      
      if (options.telegram !== false && telegramToken && telegramChatId) {
        autonomousAgent.updateSettings({ telegramChatId: telegramChatId });
        console.log('✅ Telegram notifications enabled');
        
        // Set up notification handler
        autonomousAgent.on('notification', async (message: string) => {
          try {
            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: telegramChatId,
                text: message,
                parse_mode: 'Markdown',
              }),
            });
          } catch (e) {
            console.error('Failed to send Telegram notification:', e);
          }
        });
      }
      
      const result = await autonomousAgent.start();
      console.log(result);
    }
    
    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n👋 Shutting down K.I.T. Gateway...');
      if (autonomousAgent) {
        await autonomousAgent.stop();
      }
      await gateway.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    // Keep the process alive - K.I.T. runs indefinitely
    console.log('\n🚗 K.I.T. is running. Press Ctrl+C to stop.\n');
    
    // Prevent process from exiting
    process.stdin.resume();
  });

// ═══════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════
program
  .command('status')
  .description('Check K.I.T. system status')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    const configExists = fs.existsSync(path.join(KIT_HOME, 'config.json'));
    const workspaceExists = fs.existsSync(path.join(KIT_HOME, 'workspace'));
    
    // Try to connect to gateway
    let gatewayStatus = 'offline';
    let gatewayHealth: any = null;
    
    try {
      const { loadConfig } = await import('../config');
      const config = loadConfig();
      const ws = await import('ws');
      
      const client = new ws.default(`ws://${config.gateway?.host || '127.0.0.1'}:${config.gateway?.port || 18799}`);
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.close();
          reject(new Error('Connection timeout'));
        }, 2000);
        
        client.on('open', () => {
          clearTimeout(timeout);
          client.send(JSON.stringify({
            type: 'req',
            id: 'status_check',
            method: 'connect',
            params: {}
          }));
        });
        
        client.on('message', (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.ok) {
              gatewayStatus = 'online';
              gatewayHealth = response.payload?.health;
            }
          } catch {}
          client.close();
          resolve();
        });
        
        client.on('error', () => {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        });
      });
    } catch {
      // Gateway not running
    }
    
    if (options.json) {
      console.log(JSON.stringify({
        version: VERSION,
        config: configExists,
        workspace: workspaceExists,
        gateway: {
          status: gatewayStatus,
          health: gatewayHealth,
        },
      }, null, 2));
      return;
    }
    
    console.log(`
🤖 K.I.T. Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Version:     ${VERSION}
Config:      ${configExists ? '✅ Found' : '❌ Not found'}
Workspace:   ${workspaceExists ? '✅ Found' : '❌ Not found'}
Gateway:     ${gatewayStatus === 'online' ? '🟢 Online' : '🔴 Offline'}
${gatewayHealth ? `
  Uptime:    ${Math.floor(gatewayHealth.uptime / 1000)}s
  Clients:   ${gatewayHealth.clients}
  Sessions:  ${gatewayHealth.sessions}
` : ''}
${!configExists ? "Run 'kit onboard' to configure K.I.T." : ''}
${gatewayStatus === 'offline' ? "Run 'kit start' to start the gateway." : ''}
`);
  });

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
program
  .command('dashboard')
  .alias('ui')
  .description('Open K.I.T. dashboard in browser')
  .option('-p, --port <port>', 'Dashboard port', '18800')
  .action(async (options) => {
    const { loadConfig } = await import('../config');
    const config = loadConfig();
    
    const dashboardPort = parseInt(options.port, 10);
    const gatewayUrl = `ws://${config.gateway?.host || '127.0.0.1'}:${config.gateway?.port || 18799}`;
    
    console.log('🎛️  Starting K.I.T. Dashboard...');
    console.log(`   Gateway: ${gatewayUrl}`);
    console.log(`   Dashboard: http://localhost:${dashboardPort}`);
    
    // Start dashboard server
    const { startDashboard } = await import('../dashboard/server');
    
    try {
      await startDashboard({
        port: dashboardPort,
        gatewayUrl,
        openBrowser: true,
      });
    } catch (error: any) {
      console.error('❌ Failed to start dashboard:', error.message);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
program
  .command('config')
  .description('View or edit configuration')
  .option('-e, --edit', 'Open config in editor')
  .option('--path', 'Show config file path')
  .action(async (options) => {
    const configPath = path.join(KIT_HOME, 'config.json');
    
    if (options.path) {
      console.log(configPath);
      return;
    }
    
    if (!fs.existsSync(configPath)) {
      console.log('❌ Config not found. Run "kit onboard" first.');
      return;
    }

    if (options.edit) {
      const editor = process.env.EDITOR || (os.platform() === 'win32' ? 'notepad' : 'nano');
      const { spawn } = await import('child_process');
      spawn(editor, [configPath], { stdio: 'inherit' });
    } else {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(JSON.stringify(config, null, 2));
    }
  });

// ═══════════════════════════════════════════════════════════════
// EXCHANGES
// ═══════════════════════════════════════════════════════════════
program
  .command('exchanges')
  .description('Manage exchange connections')
  .option('-l, --list', 'List configured exchanges')
  .option('-a, --add <exchange>', 'Add an exchange')
  .option('-t, --test <exchange>', 'Test exchange connection')
  .action(async (options) => {
    const configPath = path.join(KIT_HOME, 'config.json');
    
    if (!fs.existsSync(configPath)) {
      console.log('❌ Config not found. Run "kit onboard" first.');
      return;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const exchanges = config.exchanges || {};

    if (options.list || (!options.add && !options.test)) {
      console.log('\n📊 Configured Exchanges:\n');
      
      if (Object.keys(exchanges).length === 0) {
        console.log('   No exchanges configured.');
        console.log('   Run "kit onboard" to add exchanges.\n');
        return;
      }

      for (const [id, ex] of Object.entries(exchanges) as [string, any][]) {
        const status = ex.enabled ? '✅' : '❌';
        const type = ex.type === 'mt5' ? '(MT5)' : '(Crypto)';
        console.log(`   ${status} ${id} ${type}`);
      }
      console.log('');
    }

    if (options.test) {
      const exchangeId = options.test;
      console.log(`\n🔄 Testing connection to ${exchangeId}...`);
      
      const exchange = exchanges[exchangeId];
      if (!exchange) {
        console.log(`   ❌ Exchange '${exchangeId}' not configured.`);
        console.log(`   Available: ${Object.keys(exchanges).join(', ') || 'none'}\n`);
        return;
      }
      
      // Test based on exchange type
      if (exchange.type === 'mt5') {
        // MT5 connection test via Python
        const { execSync } = await import('child_process');
        try {
          const testScript = `
import MetaTrader5 as mt5
import json
result = mt5.initialize(login=${exchange.login || 0}, server="${exchange.server || ''}", password="${exchange.password || ''}")
if result:
    info = mt5.account_info()
    mt5.shutdown()
    print(json.dumps({"ok": True, "balance": info.balance if info else 0}))
else:
    print(json.dumps({"ok": False, "error": str(mt5.last_error())}))
`;
          const output = execSync(`python -c "${testScript.replace(/\n/g, ';')}"`, { encoding: 'utf8' });
          const result = JSON.parse(output.trim());
          if (result.ok) {
            console.log(`   ✅ Connected! Balance: $${result.balance.toFixed(2)}\n`);
          } else {
            console.log(`   ❌ Failed: ${result.error}\n`);
          }
        } catch (err: any) {
          console.log(`   ❌ MT5 test failed: ${err.message}`);
          console.log(`   Make sure MetaTrader5 Python package is installed.\n`);
        }
      } else {
        // Crypto exchange test - try to fetch balance
        console.log(`   ⚠️  Crypto exchange testing not yet implemented.`);
        console.log(`   Exchange type: ${exchange.type || 'crypto'}\n`);
      }
    }
  });

// ═══════════════════════════════════════════════════════════════
// BALANCE
// ═══════════════════════════════════════════════════════════════
program
  .command('balance')
  .description('Check portfolio balance across all exchanges')
  .option('-e, --exchange <exchange>', 'Check specific exchange')
  .action(async (options) => {
    console.log('\n💰 Portfolio Balance\n');
    console.log('   (Balance fetching in progress)');
    console.log('   Configure exchanges with "kit onboard" first.\n');
  });

// ═══════════════════════════════════════════════════════════════
// TRADE
// ═══════════════════════════════════════════════════════════════
program
  .command('trade')
  .description('Execute trades')
  .option('--kill', 'Emergency: Close all positions')
  .option('--status', 'Show open positions')
  .action(async (options) => {
    if (options.kill) {
      console.log('\n🚨 EMERGENCY KILL SWITCH');
      console.log('   This will close ALL open positions.\n');
      
      // Connect to gateway and send kill command
      try {
        const { loadConfig } = await import('../config');
        const config = loadConfig();
        const ws = await import('ws');
        
        const gatewayUrl = `ws://${config.gateway?.host || '127.0.0.1'}:${config.gateway?.port || 18799}`;
        console.log(`   Connecting to gateway: ${gatewayUrl}`);
        
        const client = new ws.default(gatewayUrl);
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            client.close();
            reject(new Error('Connection timeout'));
          }, 5000);
          
          client.on('open', () => {
            // Send kill command to all exchanges
            client.send(JSON.stringify({
              type: 'req',
              id: 'kill_all',
              method: 'tool',
              params: {
                name: 'trade_kill_switch',
                args: { confirm: true }
              }
            }));
          });
          
          client.on('message', (data) => {
            clearTimeout(timeout);
            try {
              const response = JSON.parse(data.toString());
              if (response.ok) {
                console.log('   ✅ Kill switch activated!');
                console.log(`   ${response.payload?.message || 'All positions closed.'}`);
              } else {
                console.log(`   ❌ Failed: ${response.error || 'Unknown error'}`);
              }
            } catch {}
            client.close();
            resolve();
          });
          
          client.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      } catch (err: any) {
        console.log(`   ❌ Could not connect to gateway: ${err.message}`);
        console.log('   Make sure K.I.T. is running: kit start\n');
        
        // Fallback: Try MT5 direct if configured
        console.log('   Attempting direct MT5 kill...');
        const { execSync } = await import('child_process');
        try {
          const killScript = `
import MetaTrader5 as mt5
mt5.initialize()
positions = mt5.positions_get()
closed = 0
if positions:
    for pos in positions:
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos.symbol,
            "volume": pos.volume,
            "type": mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY,
            "position": pos.ticket,
            "magic": 0,
        }
        result = mt5.order_send(request)
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            closed += 1
mt5.shutdown()
print(f"Closed {closed} positions")
`;
          const output = execSync(`python -c "${killScript.replace(/"/g, '\\"').replace(/\n/g, ';')}"`, { encoding: 'utf8' });
          console.log(`   ✅ ${output.trim()}\n`);
        } catch {
          console.log('   ⚠️  Direct MT5 kill also failed.\n');
        }
      }
      console.log('');
    } else if (options.status) {
      console.log('\n📊 Open Positions:\n');
      console.log('   No open positions.\n');
    } else {
      program.commands.find(c => c.name() === 'trade')?.help();
    }
  });

// ═══════════════════════════════════════════════════════════════
// DOCTOR (Comprehensive diagnostics)
// ═══════════════════════════════════════════════════════════════
// Registered via async main() below

// ═══════════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════════
program
  .command('chat')
  .description('Interactive chat with K.I.T.')
  .option('-m, --model <model>', 'Model to use (provider/model)')
  .action(async (options) => {
    console.log('🚀 Starting K.I.T. Chat...\n');
    
    // Run the agent-runner CLI
    const { createAgentRunner } = await import('../gateway/agent-runner');
    const readline = await import('readline');
    
    const agent = createAgentRunner({
      agentName: 'K.I.T.',
      model: options.model,
    });
    
    agent.on('chat.chunk', ({ chunk }: { chunk: string }) => {
      process.stdout.write(chunk);
    });
    
    agent.on('chat.tool_call', ({ toolCall }: { toolCall: { name: string } }) => {
      console.log(`\n🔧 ${toolCall.name}`);
    });
    
    agent.on('chat.complete', () => {
      console.log('\n');
      rl.prompt();
    });
    
    agent.on('chat.error', ({ error }: { error: string }) => {
      console.error(`\n❌ ${error}`);
      rl.prompt();
    });
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🤖 > ',
    });
    
    await agent.start();
    rl.prompt();
    
    rl.on('line', async (line: string) => {
      const input = line.trim();
      if (!input || input === '/quit') {
        await agent.stop();
        process.exit(0);
      }
      
      if (input === '/status') {
        console.log(JSON.stringify(agent.getStatus(), null, 2));
        rl.prompt();
        return;
      }
      
      try {
        await agent.chat(input);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        rl.prompt();
      }
    });
  });

// ═══════════════════════════════════════════════════════════════
// SKILLS
// ═══════════════════════════════════════════════════════════════
program
  .command('skills')
  .description('List all available trading skills and their status')
  .option('-c, --category <category>', 'Filter by category (trading, analysis, channel, defi, automation)')
  .option('-e, --enabled', 'Show only enabled skills')
  .option('-a, --all', 'Show all details')
  .action(async (options) => {
    const skillsDir = path.join(__dirname, '../../skills');
    const configPath = path.join(KIT_HOME, 'config.json');
    
    let config: any = {};
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
    }
    
    const enabledSkills = config.skills || {};
    
    // Categorize skills
    const categories: Record<string, string[]> = {
      trading: ['auto-trader', 'binary-options', 'copy-trader', 'grid-bot', 'signal-copier', 'metatrader', 'options-trader', 'stock-trader', 'dca-bot', 'twap-bot', 'trailing-grid', 'leveraged-grid', 'spot-futures-arb', 'prop-firm-manager'],
      analysis: ['market-analysis', 'sentiment-analyzer', 'ai-predictor', 'ai-screener', 'backtester', 'whale-tracker', 'news-tracker', 'tradingview-realtime', 'tradingview-script', 'tradingview-webhook', 'quant-engine', 'risk-ai'],
      portfolio: ['portfolio-tracker', 'rebalancer', 'multi-asset', 'tax-tracker', 'dividend-manager', 'performance-report', 'trade-journal'],
      defi: ['defi-connector', 'defi-yield', 'arbitrage-finder', 'arbitrage-hunter', 'wallet-connector', 'smart-router', 'debank-aggregator'],
      channel: ['telegram', 'discord', 'whatsapp', 'twitter-posting', 'kitbot-forum'],
      exchange: ['exchange-connector', 'etoro-connector', 'payment-processor'],
      utility: ['alert-system', 'multi-condition-alerts', 'risk-calculator', 'lot-size-calculator', 'pip-calculator', 'session-timer', 'task-scheduler', 'paper-trading', 'compliance', 'social-trading'],
    };
    
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          K.I.T. Trading Skills (54+)                          ║
╚═══════════════════════════════════════════════════════════════╝
`);
    
    const filterCat = options.category?.toLowerCase();
    
    for (const [category, skills] of Object.entries(categories)) {
      if (filterCat && category !== filterCat) continue;
      
      const categoryEmoji: Record<string, string> = {
        trading: '📈', analysis: '📊', portfolio: '💼', defi: '🔗', 
        channel: '📱', exchange: '🏦', utility: '🔧'
      };
      
      console.log(`${categoryEmoji[category] || '•'} ${category.toUpperCase()}`);
      console.log('─'.repeat(50));
      
      for (const skillId of skills) {
        const enabled = enabledSkills[skillId]?.enabled !== false;
        const status = enabled ? '✅' : '○';
        
        if (options.enabled && !enabled) continue;
        
        // Check if skill folder exists
        const skillPath = path.join(skillsDir, skillId);
        const exists = fs.existsSync(skillPath);
        
        if (exists || !options.all) {
          console.log(`  ${status} ${skillId}`);
        }
      }
      console.log('');
    }
    
    // Summary
    const totalSkills = Object.values(categories).flat().length;
    const enabledCount = Object.values(enabledSkills).filter((s: any) => s?.enabled !== false).length;
    
    console.log(`─`.repeat(50));
    console.log(`Total: ${totalSkills} skills | Enabled: ${enabledCount}`);
    console.log(`\nUse in chat: "skills" or "show skills"`);
    console.log(`Enable skill: kit config set skills.<skill-id>.enabled true`);
  });

// ═══════════════════════════════════════════════════════════════
// SKILL (Install/Remove from KitHub)
// ═══════════════════════════════════════════════════════════════
const skill = program
  .command('skill')
  .description('Install and manage skills from KitHub.finance');

skill
  .command('install <name>')
  .description('Install a skill from KitHub.finance')
  .action(async (name: string) => {
    const KITHUB_API = 'https://api.kithub.finance';
    const skillsDir = path.join(KIT_HOME, 'skills');
    
    console.log(`\n🔍 Searching for skill "${name}" on KitHub...`);
    
    try {
      // Fetch skill from KitHub API
      const response = await fetch(`${KITHUB_API}/api/skills/${name}`);
      if (!response.ok) {
        console.log(`\n❌ Skill "${name}" not found on KitHub.finance`);
        console.log(`   Browse available skills: https://kithub.finance\n`);
        return;
      }
      
      const skill = await response.json();
      console.log(`✅ Found: ${skill.name} (v${skill.versions?.[0]?.version || '1.0.0'})`);
      console.log(`   ${skill.description}\n`);
      
      // Create skills directory if not exists
      if (!fs.existsSync(skillsDir)) {
        fs.mkdirSync(skillsDir, { recursive: true });
      }
      
      const skillDir = path.join(skillsDir, name);
      if (fs.existsSync(skillDir)) {
        console.log(`⚠️  Skill "${name}" already installed at ${skillDir}`);
        console.log(`   Use 'kit skill remove ${name}' first to reinstall.\n`);
        return;
      }
      
      // Create skill directory and SKILL.md
      fs.mkdirSync(skillDir, { recursive: true });
      
      const skillMd = skill.versions?.[0]?.skill_md || `# ${skill.name}\n\n${skill.description}\n\n## Usage\n\nThis skill is installed and ready to use.`;
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd, 'utf8');
      
      // Enable skill in config
      const configPath = path.join(KIT_HOME, 'config.json');
      let config: any = {};
      if (fs.existsSync(configPath)) {
        try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
      }
      config.skills = config.skills || {};
      config.skills[name] = { enabled: true, installed_at: new Date().toISOString() };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      console.log(`✅ Installed "${name}" to ${skillDir}`);
      console.log(`   Skill is now enabled and ready to use.\n`);
      
    } catch (error: any) {
      console.log(`\n❌ Failed to install skill: ${error.message}`);
      console.log(`   Check your internet connection and try again.\n`);
    }
  });

skill
  .command('remove <name>')
  .description('Remove an installed skill')
  .action(async (name: string) => {
    const skillDir = path.join(KIT_HOME, 'skills', name);
    
    if (!fs.existsSync(skillDir)) {
      console.log(`\n❌ Skill "${name}" is not installed.\n`);
      return;
    }
    
    // Remove skill directory
    fs.rmSync(skillDir, { recursive: true, force: true });
    
    // Disable in config
    const configPath = path.join(KIT_HOME, 'config.json');
    let config: any = {};
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
    }
    if (config.skills?.[name]) {
      delete config.skills[name];
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
    
    console.log(`\n✅ Removed skill "${name}"\n`);
  });

skill
  .command('list')
  .alias('search')
  .description('List available skills from KitHub.finance')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (options) => {
    const KITHUB_API = 'https://api.kithub.finance';
    
    console.log(`\n🔍 Fetching skills from KitHub.finance...\n`);
    
    try {
      let url = `${KITHUB_API}/api/skills?limit=50`;
      if (options.category) url += `&category=${options.category}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`╔═══════════════════════════════════════════════════════════════╗`);
      console.log(`║          KitHub.finance - ${data.total} Skills Available              ║`);
      console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);
      
      const byCategory: Record<string, any[]> = {};
      for (const skill of data.skills) {
        const cat = skill.category || 'other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(skill);
      }
      
      for (const [category, skills] of Object.entries(byCategory)) {
        console.log(`📁 ${category.toUpperCase()}`);
        console.log('─'.repeat(50));
        for (const s of skills.slice(0, 10)) {
          console.log(`  • ${s.name} (⭐${s.stars} 📥${s.downloads})`);
        }
        if (skills.length > 10) console.log(`  ... and ${skills.length - 10} more`);
        console.log('');
      }
      
      console.log(`Install with: kit skill install <name>`);
      console.log(`Browse all: https://kithub.finance\n`);
      
    } catch (error: any) {
      console.log(`\n❌ Failed to fetch skills: ${error.message}\n`);
    }
  });

skill
  .command('info <name>')
  .description('Show detailed information about a skill')
  .action(async (name: string) => {
    const KITHUB_API = 'https://api.kithub.finance';
    
    try {
      const response = await fetch(`${KITHUB_API}/api/skills/${name}`);
      if (!response.ok) {
        console.log(`\n❌ Skill "${name}" not found.\n`);
        return;
      }
      
      const skill = await response.json();
      const version = skill.versions?.[0]?.version || '1.0.0';
      
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  ${skill.name.padEnd(55)} ║
╚═══════════════════════════════════════════════════════════════╝

📦 Version:    ${version}
📁 Category:   ${skill.category}
⭐ Stars:      ${skill.stars}
📥 Downloads:  ${skill.downloads}
👤 Author:     ${skill.author_username || 'K.I.T. Team'}

📝 Description:
${skill.description}

🔗 More info: https://kithub.finance/skill/${name}

Install: kit skill install ${name}
`);
    } catch (error: any) {
      console.log(`\n❌ Failed to fetch skill info: ${error.message}\n`);
    }
  });

// ═══════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════
program
  .command('models')
  .description('Manage AI model providers')
  .option('-l, --list', 'List available providers')
  .option('-s, --set <model>', 'Set default model (provider/model)')
  .action(async (options) => {
    if (options.list) {
      console.log(`
🧠 Available AI Providers:

   anthropic     Claude (Opus, Sonnet, Haiku)
   openai        GPT-4, GPT-4o, o1
   google        Gemini Pro, Flash
   openrouter    Multiple models via proxy
   groq          Fast Llama inference
   ollama        Local models (free)
   xai           Grok
   mistral       Mistral Large, Codestral
   deepseek      DeepSeek Chat/Coder

Set with: kit models --set anthropic/claude-opus-4-5-20251101
`);
    } else if (options.set) {
      const model = options.set;
      const configPath = path.join(KIT_HOME, 'config.json');
      
      // Validate model format
      if (!model.includes('/')) {
        console.log(`\n❌ Invalid model format. Use: provider/model`);
        console.log(`   Example: kit models --set anthropic/claude-opus-4-5-20251101\n`);
        return;
      }
      
      const [provider] = model.split('/');
      const validProviders = ['anthropic', 'openai', 'google', 'openrouter', 'groq', 'ollama', 'xai', 'mistral', 'deepseek'];
      
      if (!validProviders.includes(provider)) {
        console.log(`\n⚠️  Unknown provider: ${provider}`);
        console.log(`   Valid providers: ${validProviders.join(', ')}\n`);
      }
      
      // Load or create config
      let config: any = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      
      // Update model
      config.agent = config.agent || {};
      config.agent.model = model;
      
      // Ensure config directory exists
      if (!fs.existsSync(KIT_HOME)) {
        fs.mkdirSync(KIT_HOME, { recursive: true });
      }
      
      // Save config
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      console.log(`\n✅ Default model set to: ${model}`);
      console.log(`   Saved to: ${configPath}\n`);
    } else {
      program.commands.find(c => c.name() === 'models')?.help();
    }
  });

// ═══════════════════════════════════════════════════════════════
// HOOKS (OpenClaw-inspired)
// ═══════════════════════════════════════════════════════════════
// Registered via async main() below

// ═══════════════════════════════════════════════════════════════
// DIAGNOSTICS (OpenClaw-inspired)
// ═══════════════════════════════════════════════════════════════
// Registered via async main() below

// ═══════════════════════════════════════════════════════════════
// VERSION (with update check)
// ═══════════════════════════════════════════════════════════════
program
  .command('version')
  .description('Show version and check for updates')
  .option('-c, --check', 'Check for updates')
  .action(async (options) => {
    console.log(`\n🤖 K.I.T. - Knight Industries Trading`);
    console.log(`   Version: ${VERSION}`);
    console.log(`   Node: ${process.version}`);
    console.log(`   Platform: ${os.platform()} ${os.arch()}`);
    console.log(`   GitHub: https://github.com/${GITHUB_REPO}\n`);
    
    if (options.check) {
      console.log('🔍 Checking for updates...');
      try {
        const https = await import('https');
        const data = await new Promise<string>((resolve, reject) => {
          https.get(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
          }).on('error', reject);
        });
        const { version: latest } = JSON.parse(data);
        if (latest !== VERSION) {
          console.log(`   ⬆️  Update available: ${latest}`);
          console.log(`   Run: cd ~/.kit && git pull && npm run build\n`);
        } else {
          console.log(`   ✅ You're on the latest version!\n`);
        }
      } catch (err) {
        console.log(`   ⚠️  Could not check for updates\n`);
      }
    }
  });

// ═══════════════════════════════════════════════════════════════
// TEST (Integration Tests)
// ═══════════════════════════════════════════════════════════════
program
  .command('test')
  .description('Run integration tests')
  .option('-v, --verbose', 'Show detailed output')
  .option('--gateway', 'Test gateway connection only')
  .option('--ai', 'Test AI provider connection only')
  .action(async (options) => {
    console.log('\n🧪 K.I.T. Integration Tests\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    let passed = 0;
    let failed = 0;
    
    // Test 1: Config exists
    const configPath = path.join(KIT_HOME, 'config.json');
    if (fs.existsSync(configPath)) {
      console.log('✅ Config file exists');
      passed++;
    } else {
      console.log('❌ Config file missing (run kit onboard)');
      failed++;
    }
    
    // Test 2: Workspace exists
    const workspaceDir = path.join(KIT_HOME, 'workspace');
    if (fs.existsSync(workspaceDir)) {
      console.log('✅ Workspace directory exists');
      passed++;
    } else {
      console.log('❌ Workspace directory missing');
      failed++;
    }
    
    // Test 3: Workspace files
    const workspaceFiles = ['SOUL.md', 'USER.md', 'AGENTS.md'];
    for (const file of workspaceFiles) {
      const filePath = path.join(workspaceDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} exists`);
        passed++;
      } else {
        console.log(`⚠️  ${file} missing (optional)`);
      }
    }
    
    // Test 4: Gateway connection
    if (!options.ai) {
      try {
        const { loadConfig } = await import('../config');
        const config = loadConfig();
        const ws = await import('ws');
        
        const gatewayUrl = `ws://${config.gateway?.host || '127.0.0.1'}:${config.gateway?.port || 18799}`;
        console.log(`\n🔌 Testing gateway at ${gatewayUrl}...`);
        
        const connected = await new Promise<boolean>((resolve) => {
          const client = new ws.default(gatewayUrl);
          const timeout = setTimeout(() => {
            client.close();
            resolve(false);
          }, 3000);
          
          client.on('open', () => {
            clearTimeout(timeout);
            client.close();
            resolve(true);
          });
          
          client.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
          });
        });
        
        if (connected) {
          console.log('✅ Gateway connection successful');
          passed++;
        } else {
          console.log('⚠️  Gateway not running (run kit start)');
        }
      } catch (err: any) {
        console.log(`⚠️  Gateway test skipped: ${err.message}`);
      }
    }
    
    // Test 5: AI provider
    if (!options.gateway) {
      try {
        const { loadConfig } = await import('../config');
        const config = loadConfig();
        
        if (config.ai?.defaultProvider) {
          const provider = config.ai.defaultProvider;
          const providerConfig = config.ai.providers?.[provider];
          
          if (providerConfig?.apiKey) {
            console.log(`\n🧠 Testing AI provider (${provider})...`);
            console.log(`✅ ${provider} API key configured`);
            passed++;
            
            if (options.verbose) {
              console.log(`   Model: ${config.ai.defaultModel || 'default'}`);
              console.log(`   Key: ${providerConfig.apiKey.substring(0, 10)}...`);
            }
          } else {
            console.log(`⚠️  ${provider} API key not configured`);
          }
        } else {
          console.log('⚠️  No AI provider configured');
        }
      } catch (err: any) {
        console.log(`⚠️  AI test skipped: ${err.message}`);
      }
    }
    
    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
    
    if (failed === 0) {
      console.log('🎉 All tests passed! K.I.T. is ready.\n');
    } else {
      console.log('⚠️  Some tests failed. Run "kit doctor" for diagnostics.\n');
    }
  });

// ═══════════════════════════════════════════════════════════════
// TOOLS (Tool Profiles - OpenClaw-style)
// ═══════════════════════════════════════════════════════════════
program
  .command('tools')
  .description('Manage tool profiles and permissions')
  .option('-l, --list', 'List all available tools')
  .option('-p, --profiles', 'Show available tool profiles')
  .option('-a, --apply <profile>', 'Apply a tool profile (minimal, trading, analysis, messaging, full)')
  .option('-s, --status', 'Show current tool policy status')
  .option('-g, --groups', 'List tool groups')
  .action(async (options) => {
    const { 
      createDefaultToolRegistry, 
      ToolRegistry, 
      TOOL_GROUPS, 
      PROFILE_DEFINITIONS 
    } = await import('../tools/system/tool-registry');
    
    if (options.profiles) {
      console.log('\n🔧 Available Tool Profiles\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      const profiles = ToolRegistry.getProfiles();
      for (const profile of profiles) {
        const count = profile.toolCount === -1 ? 'all' : profile.toolCount;
        console.log(`   ${profile.name.padEnd(12)} - ${profile.description}`);
        console.log(`                 Tools: ${count}\n`);
      }
      
      console.log('Apply with: kit tools --apply <profile>\n');
      return;
    }
    
    if (options.groups) {
      console.log('\n📦 Tool Groups\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
        console.log(`   ${group}:`);
        console.log(`      ${tools.join(', ')}\n`);
      }
      return;
    }
    
    if (options.apply) {
      const profile = options.apply.toLowerCase();
      const validProfiles = ['minimal', 'trading', 'analysis', 'messaging', 'full'];
      
      if (!validProfiles.includes(profile)) {
        console.log(`\n❌ Invalid profile: ${profile}`);
        console.log(`   Valid profiles: ${validProfiles.join(', ')}\n`);
        return;
      }
      
      // Load config and update
      const configPath = path.join(KIT_HOME, 'config.json');
      let config: any = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      
      config.tools = config.tools || {};
      config.tools.profile = profile;
      
      // Ensure directory exists
      if (!fs.existsSync(KIT_HOME)) {
        fs.mkdirSync(KIT_HOME, { recursive: true });
      }
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      const profileDef = PROFILE_DEFINITIONS[profile as keyof typeof PROFILE_DEFINITIONS];
      console.log(`\n✅ Tool profile set to: ${profile}`);
      console.log(`   ${profileDef.description}`);
      console.log(`   Saved to: ${configPath}\n`);
      return;
    }
    
    if (options.status) {
      console.log('\n📊 Tool Policy Status\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Load config
      const configPath = path.join(KIT_HOME, 'config.json');
      let config: any = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      
      const profile = config.tools?.profile || 'full';
      const allow = config.tools?.allow || [];
      const deny = config.tools?.deny || [];
      
      console.log(`   Profile: ${profile}`);
      if (allow.length > 0) console.log(`   Allow:   ${allow.join(', ')}`);
      if (deny.length > 0) console.log(`   Deny:    ${deny.join(', ')}`);
      
      // Create registry and apply policy
      const registry = createDefaultToolRegistry();
      registry.applyPolicy({ profile: profile as any, allow, deny });
      const status = registry.getProfileStatus();
      
      console.log(`\n   Enabled:  ${status.enabled} tools`);
      console.log(`   Disabled: ${status.disabled} tools`);
      console.log(`   Total:    ${status.total} tools\n`);
      return;
    }
    
    if (options.list) {
      console.log('\n🔧 Registered Tools\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      const registry = createDefaultToolRegistry();
      const tools = registry.list();
      
      const categories = ['system', 'trading', 'analysis', 'channel', 'utility'];
      
      for (const category of categories) {
        const catTools = tools.filter(t => t.category === category);
        if (catTools.length === 0) continue;
        
        console.log(`   📁 ${category.toUpperCase()} (${catTools.length})`);
        for (const tool of catTools) {
          const status = tool.enabled ? '✓' : '✗';
          console.log(`      ${status} ${tool.definition.name}`);
        }
        console.log('');
      }
      return;
    }
    
    // Default: show help
    program.commands.find(c => c.name() === 'tools')?.help();
  });

// ═══════════════════════════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════════════════════════
program
  .command('reset')
  .description('Reset K.I.T. configuration and/or workspace (keeps CLI installed)')
  .option('-c, --config', 'Reset only config (keeps workspace)')
  .option('-w, --workspace', 'Reset only workspace (keeps config)')
  .option('-a, --all', 'Reset everything (config + workspace)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    const readline = await import('readline');
    const kitHome = path.join(os.homedir(), '.kit');
    const configPath = path.join(kitHome, 'config.json');
    const workspacePath = path.join(kitHome, 'workspace');
    const onboardingPath = path.join(kitHome, 'onboarding.json');
    
    // Determine what to reset
    let resetConfig = options.all || options.config || (!options.workspace);
    let resetWorkspace = options.all || options.workspace;
    
    if (!options.all && !options.config && !options.workspace) {
      // Default: reset config only
      resetConfig = true;
      resetWorkspace = false;
    }
    
    console.log('\n🚗 K.I.T. Reset\n');
    console.log('This will delete:');
    if (resetConfig) {
      console.log('   ✗ config.json (API keys, settings)');
      console.log('   ✗ onboarding.json (setup state)');
    }
    if (resetWorkspace) {
      console.log('   ✗ workspace/ (SOUL.md, USER.md, memory/)');
    }
    console.log('');
    
    // Confirm unless --yes
    if (!options.yes) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>(resolve => {
        rl.question('⚠️  Are you sure? (yes/no): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('\n❌ Reset cancelled.\n');
        process.exit(0);
      }
    }
    
    // Perform reset
    console.log('\nResetting...');
    
    if (resetConfig) {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
        console.log('   ✓ Deleted config.json');
      }
      if (fs.existsSync(onboardingPath)) {
        fs.unlinkSync(onboardingPath);
        console.log('   ✓ Deleted onboarding.json');
      }
    }
    
    if (resetWorkspace && fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
      console.log('   ✓ Deleted workspace/');
    }
    
    console.log('\n✅ Reset complete! Run "kit start" to reconfigure.\n');
  });

// ═══════════════════════════════════════════════════════════════
// MAIN - Load async commands then parse
// ═══════════════════════════════════════════════════════════════
async function main() {
  // Load dynamic commands before parsing
  try {
    const { createDoctorCommand } = await import('./commands/doctor');
    program.addCommand(createDoctorCommand());
  } catch (err) {
    // Doctor module not available - add basic fallback
    program
      .command('doctor')
      .description('Diagnose and fix common issues')
      .action(async () => {
        console.log('\n🔍 K.I.T. Doctor\n');
        console.log('   Advanced diagnostics module not loaded.');
        console.log('   Run: npm run build\n');
      });
  }
  
  try {
    const { createHooksCommand } = await import('./commands/hooks');
    program.addCommand(createHooksCommand());
  } catch {
    // Hooks module not available
  }
  
  try {
    const { registerCronCommand } = await import('./commands/cron');
    registerCronCommand(program);
  } catch {
    // Cron module not available
  }
  
  try {
    const { registerSessionsCommand } = await import('./commands/sessions');
    registerSessionsCommand(program);
  } catch {
    // Sessions module not available
  }
  
  try {
    const { registerMemoryCommand } = await import('./commands/memory');
    registerMemoryCommand(program);
  } catch {
    // Memory module not available
  }
  
  try {
    const { registerLogsCommand } = await import('./commands/logs');
    registerLogsCommand(program);
  } catch {
    // Logs module not available
  }
  
  try {
    const { registerSystemCommand } = await import('./commands/system');
    registerSystemCommand(program);
  } catch {
    // System module not available
  }
  
  try {
    const { registerChannelsCommand } = await import('./commands/channels');
    registerChannelsCommand(program);
  } catch {
    // Channels module not available
  }
  
  try {
    const { registerMessageCommand } = await import('./commands/message');
    registerMessageCommand(program);
  } catch {
    // Message module not available
  }
  
  try {
    const { registerUpdateCommand } = await import('./commands/update');
    registerUpdateCommand(program);
  } catch {
    // Update module not available
  }
  
  try {
    const { registerPortfolioCommand } = await import('./commands/portfolio');
    registerPortfolioCommand(program);
  } catch {
    // Portfolio module not available
  }
  
  try {
    const { registerAgentCommand } = await import('./commands/agent');
    registerAgentCommand(program);
  } catch {
    // Agent module not available
  }
  
  try {
    const { registerAlertsCommand } = await import('./commands/alerts');
    registerAlertsCommand(program);
  } catch {
    // Alerts module not available
  }
  
  try {
    const { registerWatchlistCommand } = await import('./commands/watchlist');
    registerWatchlistCommand(program);
  } catch {
    // Watchlist module not available
  }
  
  try {
    const { registerBacktestCommand } = await import('./commands/backtest');
    registerBacktestCommand(program);
  } catch {
    // Backtest module not available
  }
  
  try {
    const { createDiagnosticsCommand } = await import('./commands/diagnostics');
    program.addCommand(createDiagnosticsCommand());
  } catch {
    // Diagnostics module not available
  }
  
  // Parse and execute
  program.parse();
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
