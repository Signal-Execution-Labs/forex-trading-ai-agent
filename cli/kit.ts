#!/usr/bin/env node
/**
 * K.I.T. CLI
 * 
 * Command-line interface for K.I.T. Trading Agent Framework.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const program = new Command();
const KIT_HOME = path.join(os.homedir(), '.kit');

program
  .name('kit')
  .description('K.I.T. - Knight Industries Trading Agent Framework')
  .version('2.0.0');

// ═══════════════════════════════════════════════════════════════════════════
// START - Top-level command (like OpenClaw)
// ═══════════════════════════════════════════════════════════════════════════
program
  .command('start')
  .description('Start the K.I.T. Gateway and open Dashboard')
  .option('-p, --port <port>', 'Gateway port', '18799')
  .option('--no-browser', 'Do not open browser')
  .action(async (options) => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚗 K.I.T. - Knight Industries Trading                   ║
║   Your Autonomous AI Financial Agent                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
    
    const port = parseInt(options.port, 10);
    console.log(`Starting gateway on port ${port}...`);
    
    try {
      // Start gateway server
      const { createGatewayServer } = await import('../src/gateway/server');
      
      const gateway = createGatewayServer({
        port,
        host: '127.0.0.1',
        stateDir: KIT_HOME,
        workspaceDir: path.join(KIT_HOME, 'workspace'),
        agent: { id: 'main', name: 'K.I.T.' },
        heartbeat: { enabled: false, every: '30m' },
        cron: { enabled: false },
        memory: {},
      });
      
      await gateway.start();
      
      console.log(`✓ Gateway running at http://localhost:${port}/`);
      console.log(`✓ Dashboard available at http://localhost:${port}/`);
      
      // Open browser
      if (options.browser !== false) {
        try {
          const open = (await import('open')).default;
          await open(`http://localhost:${port}/`);
          console.log('✓ Dashboard opened in browser');
        } catch (e) {
          console.log(`  Open in browser: http://localhost:${port}/`);
        }
      }
      
      console.log('\nPress Ctrl+C to stop\n');
      
      // Handle shutdown
      process.on('SIGINT', async () => {
        console.log('\nShutting down K.I.T...');
        await gateway.stop();
        process.exit(0);
      });
      
    } catch (error: any) {
      console.error('Failed to start gateway:', error.message);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════════════════
program
  .command('status')
  .description('Check K.I.T. status')
  .action(async () => {
    console.log('\n🚗 K.I.T. Status\n');
    
    const configExists = fs.existsSync(path.join(KIT_HOME, 'config.json'));
    const workspaceExists = fs.existsSync(path.join(KIT_HOME, 'workspace'));
    
    console.log(`  Config:    ${configExists ? '✓ Found' : '✗ Not found'}`);
    console.log(`  Workspace: ${workspaceExists ? '✓ Found' : '✗ Not found'}`);
    console.log(`  K.I.T. Home: ${KIT_HOME}`);
    console.log('');
  });

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════
program
  .command('init')
  .description('Initialize K.I.T. workspace')
  .action(async () => {
    console.log('📁 Initializing K.I.T. workspace...\n');
    
    // Create directories
    const dirs = [KIT_HOME, path.join(KIT_HOME, 'workspace'), path.join(KIT_HOME, 'workspace', 'memory')];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    console.log('✓ Workspace created at:', KIT_HOME);
    console.log('\nNext steps:');
    console.log('  kit start    # Start the gateway');
    console.log('');
  });

// ═══════════════════════════════════════════════════════════════════════════
// DOCTOR
// ═══════════════════════════════════════════════════════════════════════════
program
  .command('doctor')
  .description('Check system requirements')
  .action(async () => {
    const { execSync } = await import('child_process');
    
    console.log('\n🔍 K.I.T. Doctor\n');
    
    // Node.js
    try {
      const v = execSync('node --version', { encoding: 'utf8' }).trim();
      console.log(`  ✓ Node.js: ${v}`);
    } catch {
      console.log('  ✗ Node.js: Not found');
    }
    
    // Python
    try {
      const v = execSync('python --version', { encoding: 'utf8' }).trim();
      console.log(`  ✓ Python: ${v}`);
    } catch {
      console.log('  ✗ Python: Not found (optional, needed for MT5)');
    }
    
    // Config
    const configExists = fs.existsSync(path.join(KIT_HOME, 'config.json'));
    console.log(`  ${configExists ? '✓' : '✗'} Config: ${configExists ? 'Found' : 'Not found'}`);
    
    console.log('');
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command
if (process.argv.length === 2) {
  console.log(`
🚗 K.I.T. - Knight Industries Trading

Commands:
  kit start     Start gateway and open dashboard
  kit status    Check system status
  kit init      Initialize workspace
  kit doctor    Check system requirements

Quick Start:
  kit start

Documentation:
  https://github.com/kayzaa/k.i.t.-bot
`);
}
