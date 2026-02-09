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
const VERSION = '1.0.0';

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
  .option('-p, --port <port>', 'Port to listen on', '18790')
  .option('-d, --detach', 'Run in background')
  .action(async (options) => {
    console.log('🚀 Starting K.I.T. Gateway...');
    // TODO: Implement gateway start
    console.log(`   Port: ${options.port}`);
    console.log('   (Gateway implementation in progress)');
  });

// ═══════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════
program
  .command('status')
  .description('Check K.I.T. system status')
  .action(async () => {
    console.log(`
🤖 K.I.T. Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Version:     ${VERSION}
Config:      ${fs.existsSync(path.join(KIT_HOME, 'config.json')) ? '✅ Found' : '❌ Not found'}
Workspace:   ${fs.existsSync(path.join(KIT_HOME, 'workspace')) ? '✅ Found' : '❌ Not found'}

Run 'kit onboard' to configure K.I.T.
`);
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

// Parse and execute
program.parse();
