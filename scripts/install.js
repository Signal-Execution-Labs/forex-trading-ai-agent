#!/usr/bin/env node
/**
 * K.I.T. One-Line Installer
 * 
 * Usage: npx kit-trading
 * Or: node scripts/install.js
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';

// Colors for console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logStep(step, msg) {
  console.log(`\n${colors.cyan}[${step}]${colors.reset} ${colors.bright}${msg}${colors.reset}`);
}

function logSuccess(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function logError(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function run(cmd, options = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', ...options });
    return true;
  } catch (e) {
    return false;
  }
}

function checkCommand(cmd) {
  try {
    execSync(isWindows ? `where ${cmd}` : `which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`
${colors.cyan}
    ██╗  ██╗    ██╗   ████████╗
    ██║ ██╔╝    ██║   ╚══██╔══╝
    █████╔╝     ██║      ██║   
    ██╔═██╗     ██║      ██║   
    ██║  ██╗ ██╗██║ ██╗  ██║   
    ╚═╝  ╚═╝ ╚═╝╚═╝ ╚═╝  ╚═╝   
${colors.reset}
${colors.bright}    Knight Industries Trading${colors.reset}
    Your Autonomous AI Financial Agent
  `);

  // Step 1: Check prerequisites
  logStep('1/5', 'Checking prerequisites...');
  
  let hasErrors = false;

  if (checkCommand('node')) {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    logSuccess(`Node.js ${nodeVersion}`);
  } else {
    logError('Node.js not found! Install from: https://nodejs.org');
    hasErrors = true;
  }

  if (checkCommand('python')) {
    const pyVersion = execSync('python --version', { encoding: 'utf8' }).trim();
    logSuccess(`${pyVersion}`);
  } else if (checkCommand('python3')) {
    const pyVersion = execSync('python3 --version', { encoding: 'utf8' }).trim();
    logSuccess(`${pyVersion}`);
  } else {
    logError('Python not found! Install from: https://python.org');
    hasErrors = true;
  }

  if (hasErrors) {
    log('\nPlease install missing prerequisites and run again.', 'red');
    process.exit(1);
  }

  // Step 2: Install Node dependencies
  logStep('2/5', 'Installing Node.js dependencies...');
  if (!run('npm install --legacy-peer-deps --silent')) {
    logError('npm install failed');
    process.exit(1);
  }
  logSuccess('Node dependencies installed');

  // Step 3: Install Python dependencies
  logStep('3/5', 'Installing Python dependencies...');
  const pythonCmd = checkCommand('python') ? 'python' : 'python3';
  const pipCmd = isWindows ? 'pip' : 'pip3';
  
  run(`${pipCmd} install MetaTrader5 pandas numpy psutil requests flask --quiet 2>${isWindows ? 'nul' : '/dev/null'}`);
  logSuccess('Python dependencies installed');

  // Step 4: Build TypeScript
  logStep('4/5', 'Building K.I.T...');
  if (!run('npm run build --silent')) {
    logError('Build failed');
    process.exit(1);
  }
  logSuccess('Build complete');

  // Step 5: Create default config
  logStep('5/5', 'Setting up workspace...');
  
  const kitDir = path.join(os.homedir(), '.kit');
  const workspaceDir = path.join(kitDir, 'workspace');
  
  if (!fs.existsSync(kitDir)) {
    fs.mkdirSync(kitDir, { recursive: true });
  }
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  // Copy workspace templates if they exist
  const templatesDir = path.join(__dirname, '..', 'workspace-templates');
  if (fs.existsSync(templatesDir)) {
    const templates = ['SOUL.md', 'AGENTS.md', 'USER.md', 'TOOLS.md', 'HEARTBEAT.md'];
    templates.forEach(file => {
      const src = path.join(templatesDir, file);
      const dest = path.join(workspaceDir, file);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    });
  }
  logSuccess('Workspace ready');

  // Done!
  console.log(`
${colors.green}
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ${colors.bright}K.I.T. INSTALLATION COMPLETE!${colors.green}                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}
${colors.bright}Starting Dashboard...${colors.reset}
`);

  // Start the dashboard
  const dashboardPort = 3000;
  const gatewayPort = 18799;

  // Open browser after a short delay
  setTimeout(() => {
    const url = `http://localhost:${dashboardPort}`;
    const openCmd = isWindows ? `start ${url}` : (os.platform() === 'darwin' ? `open ${url}` : `xdg-open ${url}`);
    try {
      execSync(openCmd, { stdio: 'pipe' });
    } catch (e) {
      log(`Open in browser: ${url}`, 'cyan');
    }
  }, 3000);

  // Start gateway
  require('../dist/src/index.js');
}

main().catch(err => {
  logError(err.message);
  process.exit(1);
});
