#!/usr/bin/env node

/**
 * K.I.T. Auto-Setup Script
 * Runs automatically after npm install
 * Installs all Python dependencies without user interaction
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const pythonCmd = isWindows ? 'python' : 'python3';
const pipCmd = isWindows ? 'pip' : 'pip3';

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🤖 K.I.T. - Knight Industries Trading                    ║
║     Auto-Setup Script                                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Python packages needed for trading skills
const pythonPackages = [
  // Core
  'numpy',
  'pandas',
  
  // Trading
  'ccxt',                    // Exchange connectivity
  'MetaTrader5',             // MT4/MT5 integration (Windows only)
  'yfinance',                // Stock data
  'ta',                      // Technical analysis
  'pandas-ta',               // More TA indicators
  
  // AI/ML
  'scikit-learn',
  'tensorflow',
  'torch',
  'transformers',
  
  // Sentiment Analysis
  'nltk',
  'tweepy',                  // Twitter
  'praw',                    // Reddit
  'feedparser',              // RSS News
  
  // Data
  'python-dotenv',
  'requests',
  'aiohttp',
  'websockets',
  
  // DeFi
  'web3',                    // Ethereum
];

// Windows-only packages
const windowsOnlyPackages = ['MetaTrader5'];

function checkPython() {
  console.log('📦 Checking Python installation...');
  try {
    const version = execSync(`${pythonCmd} --version`, { encoding: 'utf8' });
    console.log(`   ✅ ${version.trim()}`);
    return true;
  } catch (e) {
    console.log('   ❌ Python not found!');
    console.log('   Please install Python 3.10+ from https://python.org');
    return false;
  }
}

function checkPip() {
  console.log('📦 Checking pip...');
  try {
    const version = execSync(`${pipCmd} --version`, { encoding: 'utf8' });
    console.log(`   ✅ ${version.trim().split(' ').slice(0, 2).join(' ')}`);
    return true;
  } catch (e) {
    console.log('   ❌ pip not found!');
    return false;
  }
}

function installPythonPackages() {
  console.log('\n📦 Installing Python packages...\n');
  
  const packages = pythonPackages.filter(pkg => {
    // Skip Windows-only packages on other platforms
    if (!isWindows && windowsOnlyPackages.includes(pkg)) {
      console.log(`   ⏭️  Skipping ${pkg} (Windows only)`);
      return false;
    }
    return true;
  });

  for (const pkg of packages) {
    process.stdout.write(`   Installing ${pkg}... `);
    try {
      execSync(`${pipCmd} install ${pkg} --quiet --disable-pip-version-check`, {
        stdio: 'pipe',
        encoding: 'utf8'
      });
      console.log('✅');
    } catch (e) {
      console.log('⚠️  (may already be installed or optional)');
    }
  }
}

function downloadNLTKData() {
  console.log('\n📦 Downloading NLTK data for sentiment analysis...');
  try {
    execSync(`${pythonCmd} -c "import nltk; nltk.download('vader_lexicon', quiet=True); nltk.download('punkt', quiet=True)"`, {
      stdio: 'pipe'
    });
    console.log('   ✅ NLTK data ready');
  } catch (e) {
    console.log('   ⚠️  NLTK data download skipped (will download on first use)');
  }
}

function createDirectories() {
  console.log('\n📁 Creating directories...');
  
  const dirs = [
    path.join(os.homedir(), '.kit'),
    path.join(os.homedir(), '.kit', 'workspace'),
    path.join(os.homedir(), '.kit', 'logs'),
    path.join(os.homedir(), '.kit', 'data'),
    path.join(os.homedir(), '.kit', 'strategies'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   ✅ Created ${dir}`);
    } else {
      console.log(`   ✅ ${dir} exists`);
    }
  }
}

function copyTemplates() {
  console.log('\n📄 Setting up workspace templates...');
  
  const templatesDir = path.join(__dirname, '..', 'templates');
  const workspaceDir = path.join(os.homedir(), '.kit', 'workspace');
  
  if (!fs.existsSync(templatesDir)) {
    console.log('   ⚠️  Templates directory not found, skipping');
    return;
  }

  const templates = fs.readdirSync(templatesDir).filter(f => f.endsWith('.md'));
  
  for (const template of templates) {
    const dest = path.join(workspaceDir, template);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(templatesDir, template), dest);
      console.log(`   ✅ Created ${template}`);
    } else {
      console.log(`   ✅ ${template} exists (not overwriting)`);
    }
  }
}

function printSuccess() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ✅ K.I.T. Setup Complete!                                 ║
║                                                               ║
║     Next steps:                                               ║
║     1. Configure API keys in ~/.kit/config.json               ║
║     2. Run: npm run dev                                       ║
║     3. Connect via Telegram, Discord, or other channels       ║
║                                                               ║
║     Documentation: https://github.com/kayzaa/k.i.t.-bot       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

function printPythonWarning() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ⚠️  Python not found!                                     ║
║                                                               ║
║     K.I.T. requires Python 3.10+ for trading features.        ║
║                                                               ║
║     Please install Python:                                    ║
║     - Windows: https://python.org/downloads                   ║
║     - macOS:   brew install python@3.11                       ║
║     - Linux:   apt install python3 python3-pip                ║
║                                                               ║
║     Then run: npm run setup                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

// Main execution
async function main() {
  const hasPython = checkPython();
  
  if (!hasPython) {
    printPythonWarning();
    // Don't fail the install - Node.js features will still work
    createDirectories();
    copyTemplates();
    return;
  }
  
  const hasPip = checkPip();
  if (!hasPip) {
    console.log('   ⚠️  pip not available, skipping Python packages');
    createDirectories();
    copyTemplates();
    return;
  }
  
  installPythonPackages();
  downloadNLTKData();
  createDirectories();
  copyTemplates();
  printSuccess();
}

main().catch(console.error);
