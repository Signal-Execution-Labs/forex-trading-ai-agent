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
  console.log(`
${c.cyan}╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ${c.bright}🤖 K.I.T. - Knight Industries Trading${c.reset}${c.cyan}                      ║
║   ${c.dim}Your Autonomous AI Financial Agent${c.reset}${c.cyan}                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝${c.reset}

${c.bright}Commands:${c.reset}

  ${c.yellow}kit onboard${c.reset}    Interactive setup wizard ${c.green}← Start here!${c.reset}
  ${c.yellow}kit start${c.reset}      Start the gateway
  ${c.yellow}kit status${c.reset}     Check system status
  ${c.yellow}kit dashboard${c.reset}  Open web dashboard
  ${c.yellow}kit config${c.reset}     View/edit configuration
  ${c.yellow}kit doctor${c.reset}     Diagnose issues

${c.dim}Documentation: https://github.com/kayzaa/k.i.t.-bot${c.reset}
`);
  process.exit(0);
}

program.parse();
