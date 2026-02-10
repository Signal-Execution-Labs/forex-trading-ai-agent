#!/usr/bin/env node
/**
 * K.I.T. CLI - Knight Industries Trading
 * Command-line interface for K.I.T. AI Trading Framework
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const program = new Command();
const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');
const VERSION = '2.0.0';

// Colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

program
  .name('kit')
  .description('K.I.T. - Knight Industries Trading: Your AI Financial Agent')
  .version(VERSION);

// ═══════════════════════════════════════════════════════════════
// ONBOARD - The most important command!
// ═══════════════════════════════════════════════════════════════
program
  .command('onboard')
  .alias('init')
  .alias('setup')
  .description('Interactive setup wizard - configure K.I.T. step by step')
  .action(async () => {
    const { runOnboard } = await import('./onboard');
    await runOnboard();
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
  .action(async (options) => {
    // Check if onboarded
    if (!fs.existsSync(CONFIG_PATH)) {
      console.log(`
${c.yellow}⚠️  K.I.T. is not configured yet.${c.reset}

Run ${c.cyan}kit onboard${c.reset} to set up your trading environment first.
`);
      process.exit(1);
    }
    
    try {
      const { startCommand } = await import('./commands/start');
      await startCommand.parseAsync(['node', 'kit', 'start', ...(options.port ? ['-p', options.port] : [])]);
    } catch (error) {
      // Fallback to basic start
      console.log(`${c.cyan}🚀 Starting K.I.T. Gateway...${c.reset}`);
      console.log(`   Port: ${options.port || 18799}`);
      console.log(`   Host: ${options.host || '127.0.0.1'}`);
      
      const { createGatewayServer } = await import('../gateway/server');
      const { loadConfig } = await import('../config');
      
      const config = loadConfig();
      const gateway = createGatewayServer({
        port: parseInt(options.port, 10) || config.gateway?.port || 18799,
        host: options.host || config.gateway?.host || '127.0.0.1',
        stateDir: KIT_HOME,
        workspaceDir: path.join(KIT_HOME, 'workspace'),
      });
      
      await gateway.start();
      
      process.on('SIGINT', async () => {
        console.log('\n👋 Shutting down...');
        await gateway.stop();
        process.exit(0);
      });
    }
  });

// ═══════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════
program
  .command('status')
  .description('Check K.I.T. system status')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    const configExists = fs.existsSync(CONFIG_PATH);
    const workspaceExists = fs.existsSync(path.join(KIT_HOME, 'workspace'));
    
    let userProfile: any = null;
    if (configExists) {
      try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        userProfile = config.user;
      } catch {}
    }
    
    if (options.json) {
      console.log(JSON.stringify({
        version: VERSION,
        onboarded: configExists,
        workspace: workspaceExists,
        user: userProfile,
      }, null, 2));
      return;
    }
    
    console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🤖 K.I.T. Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

  Version:     ${VERSION}
  Config:      ${configExists ? `${c.green}✅ Found${c.reset}` : `${c.red}❌ Not found${c.reset}`}
  Workspace:   ${workspaceExists ? `${c.green}✅ Found${c.reset}` : `${c.red}❌ Not found${c.reset}`}
${userProfile ? `
  User:        ${c.bright}${userProfile.callName || userProfile.name}${c.reset}
  Markets:     ${(userProfile.preferredMarkets || []).join(', ')}
  Risk:        ${userProfile.riskTolerance}
` : ''}
${!configExists ? `
  ${c.yellow}Run 'kit onboard' to configure K.I.T.${c.reset}
` : ''}
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
    console.log(`${c.cyan}🎛️  Opening K.I.T. Dashboard...${c.reset}`);
    console.log(`   URL: http://localhost:${options.port}`);
    
    // Open browser
    const { exec } = await import('child_process');
    const url = `http://localhost:${options.port}`;
    
    if (os.platform() === 'win32') {
      exec(`start ${url}`);
    } else if (os.platform() === 'darwin') {
      exec(`open ${url}`);
    } else {
      exec(`xdg-open ${url}`);
    }
  });

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
program
  .command('config')
  .description('View or edit configuration')
  .option('-e, --edit', 'Open config in editor')
  .option('-p, --path', 'Show config file path')
  .option('-r, --reset', 'Reset to defaults (re-run onboard)')
  .action(async (options) => {
    if (options.path) {
      console.log(CONFIG_PATH);
      return;
    }
    
    if (options.reset) {
      console.log(`${c.yellow}This will reset your configuration.${c.reset}`);
      console.log(`Run ${c.cyan}kit onboard${c.reset} to reconfigure.`);
      return;
    }
    
    if (!fs.existsSync(CONFIG_PATH)) {
      console.log(`${c.red}❌ Config not found.${c.reset} Run ${c.cyan}kit onboard${c.reset} first.`);
      return;
    }

    if (options.edit) {
      const editor = process.env.EDITOR || (os.platform() === 'win32' ? 'notepad' : 'nano');
      const { spawn } = await import('child_process');
      spawn(editor, [CONFIG_PATH], { stdio: 'inherit' });
    } else {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      console.log(JSON.stringify(config, null, 2));
    }
  });

// ═══════════════════════════════════════════════════════════════
// WHATSAPP
// ═══════════════════════════════════════════════════════════════
const whatsappCmd = program
  .command('whatsapp')
  .alias('wa')
  .description('WhatsApp channel management');

whatsappCmd
  .command('login')
  .description('Login to WhatsApp - scan QR code with your phone')
  .action(async () => {
    console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📱 K.I.T. WhatsApp Login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.yellow}Instructions:${c.reset}
1. Open WhatsApp on your phone
2. Go to Settings → Linked Devices → Link a Device
3. Scan the QR code that appears below

${c.dim}Waiting for QR code...${c.reset}
`);

    try {
      const { WhatsAppChannel } = await import('../channels/whatsapp-channel');
      
      const channel = new WhatsAppChannel({});
      
      // Just connect to show QR code
      await channel.start(async (msg) => {
        // This won't process messages in login mode
        return '';
      });

      // Keep running until connected
      console.log(`
${c.green}✅ WhatsApp connected!${c.reset}

Your WhatsApp is now linked to K.I.T.
Restart the gateway to start receiving messages.

Run: ${c.cyan}kit start${c.reset}
`);
    } catch (error) {
      console.error(`${c.red}❌ Error:${c.reset}`, error);
      process.exit(1);
    }
  });

whatsappCmd
  .command('logout')
  .description('Logout from WhatsApp and delete credentials')
  .action(async () => {
    const credsDir = path.join(KIT_HOME, 'credentials', 'whatsapp');
    
    if (fs.existsSync(credsDir)) {
      fs.rmSync(credsDir, { recursive: true });
      console.log(`${c.green}✅ WhatsApp credentials deleted.${c.reset}`);
    } else {
      console.log(`${c.yellow}No WhatsApp credentials found.${c.reset}`);
    }
  });

whatsappCmd
  .command('status')
  .description('Check WhatsApp connection status')
  .action(async () => {
    const credsPath = path.join(KIT_HOME, 'credentials', 'whatsapp', 'creds.json');
    const hasCredentials = fs.existsSync(credsPath);

    console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📱 K.I.T. WhatsApp Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

  Credentials: ${hasCredentials ? `${c.green}✅ Found${c.reset}` : `${c.red}❌ Not found${c.reset}`}
${hasCredentials ? `
  ${c.green}WhatsApp is ready!${c.reset}
  Run ${c.cyan}kit start${c.reset} to connect.
` : `
  Run ${c.cyan}kit whatsapp login${c.reset} to scan QR code.
`}
`);
  });

// ═══════════════════════════════════════════════════════════════
// TELEGRAM
// ═══════════════════════════════════════════════════════════════
const telegramCmd = program
  .command('telegram')
  .alias('tg')
  .description('Telegram channel management');

telegramCmd
  .command('setup <token>')
  .description('Setup Telegram bot with token from @BotFather')
  .action(async (token: string) => {
    console.log(`${c.cyan}Setting up Telegram bot...${c.reset}`);
    
    try {
      // Test the token
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json() as any;

      if (!data.ok) {
        console.log(`${c.red}❌ Invalid token: ${data.description}${c.reset}`);
        process.exit(1);
      }

      // Save to config
      if (!fs.existsSync(KIT_HOME)) {
        fs.mkdirSync(KIT_HOME, { recursive: true });
      }

      let config: any = {};
      if (fs.existsSync(CONFIG_PATH)) {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      }

      if (!config.channels) config.channels = {};
      config.channels.telegram = {
        enabled: true,
        token: token,
        botId: data.result.id,
        botUsername: data.result.username,
        botName: data.result.first_name,
        connectedAt: new Date().toISOString(),
      };

      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

      console.log(`
${c.green}✅ Telegram bot connected!${c.reset}

  Bot: @${data.result.username}
  Name: ${data.result.first_name}

${c.yellow}Next steps:${c.reset}
1. Send a message to @${data.result.username} on Telegram
2. Run: ${c.cyan}kit telegram chatid${c.reset} to get your chat ID
3. Run: ${c.cyan}kit start${c.reset} to start receiving messages
`);
    } catch (error) {
      console.error(`${c.red}❌ Error:${c.reset}`, error);
      process.exit(1);
    }
  });

telegramCmd
  .command('chatid')
  .description('Get chat ID from recent messages')
  .action(async () => {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.log(`${c.red}❌ Config not found. Run kit telegram setup first.${c.reset}`);
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const token = config.channels?.telegram?.token;

    if (!token) {
      console.log(`${c.red}❌ Telegram not configured. Run kit telegram setup first.${c.reset}`);
      process.exit(1);
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10`);
      const data = await response.json() as any;

      if (!data.ok || data.result.length === 0) {
        console.log(`${c.yellow}No messages found. Send a message to your bot first.${c.reset}`);
        return;
      }

      // Extract unique chats
      const chats = new Map();
      for (const update of data.result) {
        const chat = update.message?.chat;
        if (chat && !chats.has(chat.id)) {
          chats.set(chat.id, chat);
        }
      }

      console.log(`\n${c.cyan}Found ${chats.size} chat(s):${c.reset}\n`);
      
      for (const [id, chat] of chats) {
        console.log(`  Chat ID: ${c.green}${id}${c.reset}`);
        if (chat.username) console.log(`  Username: @${chat.username}`);
        if (chat.first_name) console.log(`  Name: ${chat.first_name} ${chat.last_name || ''}`);
        console.log('');
      }

      console.log(`${c.dim}Use: kit telegram setchatid <id>${c.reset}`);
    } catch (error) {
      console.error(`${c.red}❌ Error:${c.reset}`, error);
    }
  });

telegramCmd
  .command('setchatid <chatId>')
  .description('Set the default chat ID for notifications')
  .action(async (chatId: string) => {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.log(`${c.red}❌ Config not found.${c.reset}`);
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    
    if (!config.channels?.telegram?.token) {
      console.log(`${c.red}❌ Telegram not configured.${c.reset}`);
      process.exit(1);
    }

    config.channels.telegram.chatId = chatId;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    console.log(`${c.green}✅ Chat ID saved: ${chatId}${c.reset}`);
    console.log(`Run ${c.cyan}kit start${c.reset} to connect.`);
  });

telegramCmd
  .command('status')
  .description('Check Telegram connection status')
  .action(async () => {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.log(`${c.yellow}Telegram not configured.${c.reset}`);
      console.log(`Run: ${c.cyan}kit telegram setup <token>${c.reset}`);
      return;
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const telegram = config.channels?.telegram;

    if (!telegram?.token) {
      console.log(`${c.yellow}Telegram not configured.${c.reset}`);
      return;
    }

    console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📱 K.I.T. Telegram Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

  Bot: @${telegram.botUsername}
  Name: ${telegram.botName}
  Chat ID: ${telegram.chatId || `${c.yellow}Not set${c.reset}`}
  Connected: ${telegram.connectedAt || 'Unknown'}
`);
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
    
    console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔍 K.I.T. Doctor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
`);
    
    // Check Node.js
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      console.log(`   ${c.green}✅${c.reset} Node.js: ${nodeVersion}`);
    } catch {
      console.log(`   ${c.red}❌${c.reset} Node.js: Not found`);
    }
    
    // Check Python
    const pythonCmd = isWindows ? 'python' : 'python3';
    try {
      const pyVersion = execSync(`${pythonCmd} --version`, { encoding: 'utf8' }).trim();
      console.log(`   ${c.green}✅${c.reset} Python: ${pyVersion}`);
    } catch {
      console.log(`   ${c.yellow}⚠️${c.reset}  Python: Not found (needed for MT5)`);
    }
    
    // Check MT5 (Windows only)
    if (isWindows) {
      try {
        execSync(`${pythonCmd} -c "import MetaTrader5"`, { stdio: 'pipe' });
        console.log(`   ${c.green}✅${c.reset} MetaTrader5: Installed`);
      } catch {
        console.log(`   ${c.yellow}⚠️${c.reset}  MetaTrader5: Not installed`);
        console.log(`      Run: pip install MetaTrader5`);
      }
    }
    
    // Check config
    if (fs.existsSync(CONFIG_PATH)) {
      console.log(`   ${c.green}✅${c.reset} Config: Found`);
    } else {
      console.log(`   ${c.yellow}⚠️${c.reset}  Config: Not found - run 'kit onboard'`);
    }
    
    // Check workspace files
    const workspaceFiles = ['USER.md', 'SOUL.md', 'AGENTS.md', 'MEMORY.md'];
    for (const file of workspaceFiles) {
      const filePath = path.join(KIT_HOME, 'workspace', file);
      if (fs.existsSync(filePath)) {
        console.log(`   ${c.green}✅${c.reset} ${file}: Found`);
      } else {
        console.log(`   ${c.yellow}⚠️${c.reset}  ${file}: Not found`);
      }
    }
    
    console.log('');
  });

// ═══════════════════════════════════════════════════════════════
// DEFAULT (no command)
// ═══════════════════════════════════════════════════════════════
if (process.argv.length === 2) {
  // Check if onboarded
  const isOnboarded = fs.existsSync(CONFIG_PATH);
  const userName = isOnboarded ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).user?.name : null;
  
  console.log(`
${c.cyan}╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ${c.bright}🤖 K.I.T. - Knight Industries Trading${c.reset}${c.cyan}                      ║
║   ${c.dim}Your Autonomous AI Financial Agent${c.reset}${c.cyan}                        ║
║   ${c.dim}"Your wealth is my mission"${c.reset}${c.cyan}                              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝${c.reset}
${userName ? `\n  ${c.green}Welcome back, ${userName}!${c.reset}\n` : ''}
${c.bright}Getting Started:${c.reset}

  ${c.yellow}kit onboard${c.reset}        Interactive setup wizard ${!isOnboarded ? `${c.green}← Start here!${c.reset}` : '(re-run to change settings)'}
  ${c.yellow}kit start${c.reset}          Start the K.I.T. gateway
  ${c.yellow}kit status${c.reset}         Check system status
  ${c.yellow}kit dashboard${c.reset}      Open web dashboard

${c.bright}Channels:${c.reset}

  ${c.yellow}kit telegram setup${c.reset} Connect Telegram bot
  ${c.yellow}kit whatsapp login${c.reset} Connect WhatsApp (scan QR)

${c.bright}Tools:${c.reset}

  ${c.yellow}kit config${c.reset}         View/edit configuration
  ${c.yellow}kit doctor${c.reset}         Diagnose issues

${c.bright}Links:${c.reset}

  ${c.dim}Dashboard:${c.reset}     http://localhost:18799
  ${c.dim}GitHub:${c.reset}        https://github.com/kayzaa/k.i.t.-bot
  ${c.dim}Documentation:${c.reset} https://github.com/kayzaa/k.i.t.-bot#readme

${c.bright}Workspace:${c.reset}     ~/.kit/workspace
${c.bright}Config:${c.reset}        ~/.kit/config.json
`);
  process.exit(0);
}

program.parse();
