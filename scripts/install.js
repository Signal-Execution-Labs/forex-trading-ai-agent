#!/usr/bin/env node
/**
 * K.I.T. - Knight Industries Trading
 * One-Line Installer (OpenClaw-style)
 * 
 * Usage: 
 *   npx kit-trading
 *   npm install -g kit-trading && kit onboard
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';

// ANSI Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgCyan: '\x1b[46m',
  bgBlack: '\x1b[40m',
};

// K.I.T. Taglines (like OpenClaw's random taglines)
const taglines = [
  "Your wealth is my mission.",
  "One AI. All your finances. Fully autonomous.",
  "Knight Industries Trading at your service.",
  "I don't sleep, I trade.",
  "Making your money work while you rest.",
  "Precision trading, powered by AI.",
  "Your autonomous financial agent.",
  "From Wall Street to DeFi, I've got you covered.",
];

function getTagline() {
  return taglines[Math.floor(Math.random() * taglines.length)];
}

function log(msg, color = 'reset') {
  console.log(`${c[color]}${msg}${c.reset}`);
}

function logStep(step, total, msg) {
  console.log(`\n${c.cyan}[${step}/${total}]${c.reset} ${c.bold}${msg}${c.reset}`);
}

function logSuccess(msg) {
  console.log(`${c.green}  ✓${c.reset} ${msg}`);
}

function logWarn(msg) {
  console.log(`${c.yellow}  ⚠${c.reset} ${msg}`);
}

function logError(msg) {
  console.log(`${c.red}  ✗${c.reset} ${msg}`);
}

function logInfo(msg) {
  console.log(`${c.dim}  ${msg}${c.reset}`);
}

function run(cmd, options = {}) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...options });
  } catch (e) {
    return null;
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

function printBanner() {
  console.log(`
${c.cyan}${c.bold}
    ██╗  ██╗    ██╗   ████████╗
    ██║ ██╔╝    ██║   ╚══██╔══╝
    █████╔╝     ██║      ██║   
    ██╔═██╗     ██║      ██║   
    ██║  ██╗ ██╗██║ ██╗  ██║   
    ╚═╝  ╚═╝ ╚═╝╚═╝ ╚═╝  ╚═╝   
${c.reset}
    ${c.bold}Knight Industries Trading${c.reset}
    ${c.dim}${getTagline()}${c.reset}
`);
}

function printWelcome() {
  console.log(`${c.cyan}╭───────────────────────────────────────────────────────────────╮${c.reset}`);
  console.log(`${c.cyan}│${c.reset}                                                               ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}│${c.reset}   ${c.bold}Welcome to K.I.T. Setup${c.reset}                                     ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}│${c.reset}   ${c.dim}Your Autonomous AI Financial Agent${c.reset}                         ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}│${c.reset}                                                               ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}│${c.reset}   K.I.T. will help you:                                       ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}│${c.reset}   ${c.green}•${c.reset} Trade crypto, forex, stocks autonomously                  ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}│${c.reset}   ${c.green}•${c.reset} Connect to MT5, Binance, BinaryFaster & more              ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}│${c.reset}   ${c.green}•${c.reset} Track your portfolio across all platforms                 ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}│${c.reset}   ${c.green}•${c.reset} Get AI-powered market analysis & signals                  ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}│${c.reset}                                                               ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}╰───────────────────────────────────────────────────────────────╯${c.reset}`);
}

async function main() {
  const TOTAL_STEPS = 6;
  
  printBanner();
  printWelcome();
  
  console.log(`\n${c.yellow}⚠ Security Notice:${c.reset}`);
  console.log(`${c.dim}  K.I.T. is a powerful AI agent with access to trading APIs.${c.reset}`);
  console.log(`${c.dim}  Only use API keys with appropriate permissions.${c.reset}`);
  console.log(`${c.dim}  Start with paper trading to test strategies.${c.reset}\n`);

  // Step 1: Check prerequisites
  logStep(1, TOTAL_STEPS, 'Checking prerequisites...');
  
  let errors = [];
  let warnings = [];

  // Node.js
  if (checkCommand('node')) {
    const nodeVersion = run('node --version')?.trim() || 'unknown';
    const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    if (major >= 18) {
      logSuccess(`Node.js ${nodeVersion}`);
    } else {
      logWarn(`Node.js ${nodeVersion} (recommend v18+)`);
      warnings.push('Node.js version may be too old');
    }
  } else {
    logError('Node.js not found!');
    errors.push('Install Node.js from https://nodejs.org');
  }

  // npm
  if (checkCommand('npm')) {
    const npmVersion = run('npm --version')?.trim() || 'unknown';
    logSuccess(`npm v${npmVersion}`);
  }

  // Python (optional but recommended)
  const pythonCmd = checkCommand('python') ? 'python' : (checkCommand('python3') ? 'python3' : null);
  if (pythonCmd) {
    const pyVersion = run(`${pythonCmd} --version`)?.trim() || 'unknown';
    logSuccess(`${pyVersion}`);
    
    // Check for Python 3.12 specifically (needed for MT5)
    if (isWindows && checkCommand('py')) {
      const py312 = run('py -3.12 --version');
      if (py312) {
        logSuccess(`Python 3.12 available (for MT5)`);
      } else {
        logWarn('Python 3.12 not found - needed for MT5');
        logInfo('Install with: winget install Python.Python.3.12');
      }
    }
  } else {
    logWarn('Python not found (optional, needed for MT5)');
    warnings.push('Python not installed - MT5 integration unavailable');
  }

  // Git (optional but recommended - auto-install if missing)
  if (checkCommand('git')) {
    const gitVersion = run('git --version')?.trim() || 'unknown';
    logSuccess(`${gitVersion}`);
  } else {
    logWarn('Git not found - attempting auto-install...');
    let gitInstalled = false;
    
    if (isWindows) {
      // Try winget first
      if (checkCommand('winget')) {
        logInfo('Installing Git via winget...');
        const result = run('winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements', { stdio: 'inherit' });
        if (result !== null || checkCommand('git')) {
          gitInstalled = true;
        }
      }
      // Fallback: download installer
      if (!gitInstalled) {
        logInfo('Download Git manually from: https://git-scm.com/download/win');
      }
    } else if (isMac) {
      // Try Homebrew
      if (checkCommand('brew')) {
        logInfo('Installing Git via Homebrew...');
        run('brew install git', { stdio: 'inherit' });
        gitInstalled = checkCommand('git');
      } else {
        logInfo('Installing Xcode Command Line Tools (includes git)...');
        run('xcode-select --install', { stdio: 'inherit' });
      }
    } else {
      // Linux - try apt, yum, or dnf
      if (checkCommand('apt-get')) {
        logInfo('Installing Git via apt...');
        run('sudo apt-get update && sudo apt-get install -y git', { stdio: 'inherit' });
        gitInstalled = checkCommand('git');
      } else if (checkCommand('yum')) {
        logInfo('Installing Git via yum...');
        run('sudo yum install -y git', { stdio: 'inherit' });
        gitInstalled = checkCommand('git');
      } else if (checkCommand('dnf')) {
        logInfo('Installing Git via dnf...');
        run('sudo dnf install -y git', { stdio: 'inherit' });
        gitInstalled = checkCommand('git');
      }
    }
    
    if (gitInstalled || checkCommand('git')) {
      const gitVersion = run('git --version')?.trim() || 'unknown';
      logSuccess(`${gitVersion} (auto-installed)`);
    } else {
      logInfo('Git installation skipped - some features may be limited');
      warnings.push('Git not installed - skill updates may require manual downloads');
    }
  }

  if (errors.length > 0) {
    console.log(`\n${c.red}Please fix these issues and try again:${c.reset}`);
    errors.forEach(e => console.log(`  ${c.red}•${c.reset} ${e}`));
    process.exit(1);
  }

  // Step 2: Create directories
  logStep(2, TOTAL_STEPS, 'Creating K.I.T. directories...');
  
  const kitDir = path.join(os.homedir(), '.kit');
  const workspaceDir = path.join(kitDir, 'workspace');
  const memoryDir = path.join(workspaceDir, 'memory');
  const credentialsDir = path.join(kitDir, 'credentials');
  const agentsDir = path.join(kitDir, 'agents');
  
  [kitDir, workspaceDir, memoryDir, credentialsDir, agentsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  logSuccess(`Created ~/.kit/`);
  logSuccess(`Created ~/.kit/workspace/`);
  logSuccess(`Created ~/.kit/credentials/`);

  // Step 3: Copy workspace templates
  logStep(3, TOTAL_STEPS, 'Setting up workspace files...');
  
  const templatesDir = path.join(__dirname, '..', 'workspace-templates');
  const templates = [
    { file: 'SOUL.md', desc: 'Agent personality' },
    { file: 'USER.md', desc: 'User profile' },
    { file: 'AGENTS.md', desc: 'Agent configuration' },
    { file: 'TOOLS.md', desc: 'Tool notes' },
    { file: 'MEMORY.md', desc: 'Long-term memory' },
    { file: 'HEARTBEAT.md', desc: 'Heartbeat tasks' },
    { file: 'BOOT.md', desc: 'Startup tasks' },
    { file: 'IDENTITY.md', desc: 'Agent identity' },
  ];
  
  if (fs.existsSync(templatesDir)) {
    templates.forEach(({ file, desc }) => {
      const src = path.join(templatesDir, file);
      const dest = path.join(workspaceDir, file);
      if (fs.existsSync(src)) {
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          logSuccess(`${file} - ${desc}`);
        } else {
          logInfo(`${file} already exists (skipped)`);
        }
      }
    });
  } else {
    logWarn('Templates not found - creating defaults');
    // Create minimal defaults
    const defaults = {
      'SOUL.md': '# K.I.T. Soul\n\nI am K.I.T., your autonomous AI financial agent.\nYour wealth is my mission.\n',
      'USER.md': '# User Profile\n\n- Name: Trader\n- Risk Tolerance: Moderate\n- Goals: Wealth building\n',
      'AGENTS.md': '# K.I.T. Workspace\n\nThis is your K.I.T. workspace.\n',
      'MEMORY.md': '# K.I.T. Memory\n\n## Recent Events\n\n',
    };
    Object.entries(defaults).forEach(([file, content]) => {
      const dest = path.join(workspaceDir, file);
      if (!fs.existsSync(dest)) {
        fs.writeFileSync(dest, content);
        logSuccess(`Created ${file}`);
      }
    });
  }

  // Step 4: Install dependencies (if running from source)
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    logStep(4, TOTAL_STEPS, 'Installing dependencies...');
    
    const installResult = run('npm install --legacy-peer-deps 2>&1', {
      cwd: path.join(__dirname, '..'),
      maxBuffer: 10 * 1024 * 1024,
    });
    
    if (installResult !== null) {
      logSuccess('Node.js dependencies installed');
    } else {
      logWarn('npm install had issues (may still work)');
    }

    // Python deps (optional)
    if (pythonCmd) {
      const pipCmd = isWindows ? 'pip' : 'pip3';
      run(`${pipCmd} install MetaTrader5 pandas numpy requests --quiet 2>${isWindows ? 'nul' : '/dev/null'}`);
      logSuccess('Python dependencies installed');
    }
  } else {
    logStep(4, TOTAL_STEPS, 'Dependencies...');
    logInfo('Running from npm package - dependencies already installed');
  }

  // Step 5: Build (if from source)
  const srcDir = path.join(__dirname, '..', 'src');
  if (fs.existsSync(srcDir)) {
    logStep(5, TOTAL_STEPS, 'Building K.I.T...');
    
    const buildResult = run('npm run build 2>&1', {
      cwd: path.join(__dirname, '..'),
      maxBuffer: 10 * 1024 * 1024,
    });
    
    if (buildResult !== null) {
      logSuccess('TypeScript build complete');
    } else {
      logError('Build failed');
      process.exit(1);
    }
  } else {
    logStep(5, TOTAL_STEPS, 'Build...');
    logInfo('Pre-built package - skipping build');
  }

  // Step 6: Setup complete
  logStep(6, TOTAL_STEPS, 'Finalizing setup...');
  
  // Check if global install
  const isGlobal = __dirname.includes('node_modules');
  const kitCmd = isGlobal ? 'kit' : 'npx kit';
  
  logSuccess('K.I.T. installation complete!');

  // Print success banner
  console.log(`
${c.green}╭───────────────────────────────────────────────────────────────╮${c.reset}
${c.green}│${c.reset}                                                               ${c.green}│${c.reset}
${c.green}│${c.reset}   ${c.bold}${c.green}✓ K.I.T. INSTALLATION COMPLETE${c.reset}                            ${c.green}│${c.reset}
${c.green}│${c.reset}                                                               ${c.green}│${c.reset}
${c.green}╰───────────────────────────────────────────────────────────────╯${c.reset}

${c.bold}Next Steps:${c.reset}

  ${c.cyan}1.${c.reset} Run the setup wizard:
     ${c.dim}$${c.reset} ${c.bold}${kitCmd} onboard${c.reset}

  ${c.cyan}2.${c.reset} Or start K.I.T. directly:
     ${c.dim}$${c.reset} ${c.bold}${kitCmd} start${c.reset}

  ${c.cyan}3.${c.reset} Open the dashboard:
     ${c.dim}$${c.reset} ${c.bold}${kitCmd} dashboard${c.reset}

${c.bold}Quick Commands:${c.reset}

  ${c.dim}${kitCmd} status${c.reset}      Check system status
  ${c.dim}${kitCmd} doctor${c.reset}      Diagnose issues
  ${c.dim}${kitCmd} market${c.reset}      Live market data
  ${c.dim}${kitCmd} price BTC${c.reset}   Get crypto prices

${c.bold}Documentation:${c.reset}
  ${c.blue}https://github.com/kayzaa/k.i.t.-bot${c.reset}

${c.dim}Your wealth is my mission. Let's trade! 🚗${c.reset}
`);

  // Ask if user wants to run onboarding now
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(`\n${c.cyan}?${c.reset} Would you like to run the setup wizard now? ${c.dim}(Y/n)${c.reset} `, (answer) => {
    rl.close();
    
    if (answer.toLowerCase() !== 'n') {
      console.log(`\n${c.cyan}Starting K.I.T. Onboarding...${c.reset}\n`);
      
      // Run onboarding
      const onboardPath = path.join(__dirname, '..', 'dist', 'src', 'cli', 'kit.js');
      if (fs.existsSync(onboardPath)) {
        spawn('node', [onboardPath, 'onboard'], { stdio: 'inherit' });
      } else {
        spawn(kitCmd.split(' ')[0], ['onboard'], { stdio: 'inherit', shell: true });
      }
    } else {
      console.log(`\n${c.dim}Run '${kitCmd} onboard' when you're ready.${c.reset}\n`);
      process.exit(0);
    }
  });
}

// Handle direct run
if (require.main === module) {
  main().catch(err => {
    logError(err.message);
    process.exit(1);
  });
}

module.exports = { main };
