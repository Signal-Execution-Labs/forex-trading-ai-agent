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
      console.log(`\n🔄 Testing connection to ${options.test}...`);
      // TODO: Implement connection test
      console.log('   (Test implementation in progress)');
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
      // TODO: Implement kill switch
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
      console.log(`\n✅ Default model set to: ${options.set}\n`);
      // TODO: Save to config
    } else {
      program.commands.find(c => c.name() === 'models')?.help();
    }
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

// Parse and execute
program.parse();
