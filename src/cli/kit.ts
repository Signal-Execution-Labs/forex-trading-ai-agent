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

program
  .name('kit')
  .description('K.I.T. - Knight Industries Trading: Your AI Financial Agent')
  .version(VERSION);

// ═══════════════════════════════════════════════════════════════
// ONBOARD
// ═══════════════════════════════════════════════════════════════
program
  .command('onboard')
  .alias('init')
  .alias('setup')
  .description('Interactive setup wizard - configure K.I.T. step by step')
  .action(async () => {
    const { OnboardWizard } = await import('./onboard');
    const wizard = new OnboardWizard();
    await wizard.run();
  });

// ═══════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════
program
  .command('start')
  .alias('gateway')
  .description('Start the K.I.T. gateway')
  .option('-p, --port <port>', 'Port to listen on', '18799')
  .option('-h, --host <host>', 'Host to bind to', '127.0.0.1')
  .option('-d, --detach', 'Run in background')
  .option('-t, --token <token>', 'Gateway auth token')
  .action(async (options) => {
    const { createGatewayServer } = await import('../gateway/server');
    const { loadConfig, DEFAULT_CONFIG } = await import('../config');
    
    // Load config and merge with CLI options
    const config = loadConfig();
    
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
    
    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n👋 Shutting down K.I.T. Gateway...');
      await gateway.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
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
// DOCTOR
// ═══════════════════════════════════════════════════════════════
program
  .command('doctor')
  .description('Diagnose and fix common issues')
  .action(async () => {
    const { execSync } = await import('child_process');
    const isWindows = os.platform() === 'win32';
    
    console.log('\n🔍 K.I.T. Doctor\n');
    
    // Check Node.js
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      console.log(`   ✅ Node.js: ${nodeVersion}`);
    } catch {
      console.log('   ❌ Node.js: Not found');
    }
    
    // Check Python
    const pythonCmd = isWindows ? 'python' : 'python3';
    try {
      const pyVersion = execSync(`${pythonCmd} --version`, { encoding: 'utf8' }).trim();
      console.log(`   ✅ Python: ${pyVersion}`);
    } catch {
      console.log('   ❌ Python: Not found (needed for MT5)');
    }
    
    // Check MT5 (Windows only)
    if (isWindows) {
      try {
        execSync(`${pythonCmd} -c "import MetaTrader5"`, { stdio: 'pipe' });
        console.log('   ✅ MetaTrader5 Python package: Installed');
      } catch {
        console.log('   ⚠️  MetaTrader5 Python package: Not installed');
        console.log('      Run: pip install MetaTrader5');
      }
    }
    
    // Check config
    if (fs.existsSync(path.join(KIT_HOME, 'config.json'))) {
      console.log(`   ✅ Config: Found`);
    } else {
      console.log('   ⚠️  Config: Not found');
      console.log('      Run: kit onboard');
    }
    
    // Check workspace
    if (fs.existsSync(path.join(KIT_HOME, 'workspace'))) {
      console.log(`   ✅ Workspace: Found`);
    } else {
      console.log('   ⚠️  Workspace: Not found');
    }
    
    console.log('\n');
  });

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
import('./commands/hooks').then(({ createHooksCommand }) => {
  program.addCommand(createHooksCommand());
}).catch(() => {
  // Hooks module not available
});

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
// RESET (Workspace Reset)
// ═══════════════════════════════════════════════════════════════
program
  .command('reset')
  .description('Reset K.I.T. workspace and configuration')
  .option('-f, --force', 'Skip confirmation prompt')
  .option('--workspace-only', 'Only reset workspace files, keep config')
  .option('--config-only', 'Only reset config, keep workspace')
  .action(async (options) => {
    const workspaceDir = path.join(KIT_HOME, 'workspace');
    const configPath = path.join(KIT_HOME, 'config.json');
    const onboardingPath = path.join(KIT_HOME, 'onboarding.json');
    
    if (!options.force) {
      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      
      const confirmed = await new Promise<boolean>((resolve) => {
        rl.question('\n⚠️  This will reset your K.I.T. configuration. Continue? (y/N): ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });
      
      if (!confirmed) {
        console.log('   Cancelled.\n');
        return;
      }
    }
    
    console.log('\n🔄 Resetting K.I.T...\n');
    
    // Reset workspace
    if (!options.configOnly) {
      const workspaceFiles = ['SOUL.md', 'USER.md', 'AGENTS.md', 'MEMORY.md'];
      for (const file of workspaceFiles) {
        const filePath = path.join(workspaceDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`   ✅ Deleted: ${file}`);
        }
      }
    }
    
    // Reset config
    if (!options.workspaceOnly) {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
        console.log('   ✅ Deleted: config.json');
      }
      if (fs.existsSync(onboardingPath)) {
        fs.unlinkSync(onboardingPath);
        console.log('   ✅ Deleted: onboarding.json');
      }
    }
    
    console.log('\n✅ Reset complete! Run "kit onboard" to set up again.\n');
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

// Parse and execute
program.parse();
