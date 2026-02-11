#!/usr/bin/env node
/**
 * K.I.T. Post-Install Setup
 * Creates workspace directory and copies templates
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const kitDir = path.join(os.homedir(), '.kit');
const workspaceDir = path.join(kitDir, 'workspace');

// Create directories
if (!fs.existsSync(kitDir)) {
  fs.mkdirSync(kitDir, { recursive: true });
}
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
}

// Copy workspace templates
const templatesDir = path.join(__dirname, '..', 'workspace-templates');
if (fs.existsSync(templatesDir)) {
  const templates = fs.readdirSync(templatesDir);
  templates.forEach(file => {
    if (file.endsWith('.md')) {
      const src = path.join(templatesDir, file);
      const dest = path.join(workspaceDir, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    }
  });
}

console.log('K.I.T. workspace ready at:', workspaceDir);

// Install Python dependencies (MT5, etc.) - Windows only
if (os.platform() === 'win32') {
  const { execSync } = require('child_process');
  
  console.log('Installing Python dependencies...');
  
  try {
    // Check if Python is available
    execSync('python --version', { stdio: 'pipe' });
    
    // Install MetaTrader5 package
    try {
      execSync('pip install MetaTrader5 --quiet', { stdio: 'pipe' });
      console.log('✅ MetaTrader5 Python module installed');
    } catch (e) {
      console.log('⚠️  Could not install MetaTrader5 module (pip install MetaTrader5)');
    }
  } catch (e) {
    console.log('⚠️  Python not found - MT5 features will be unavailable');
    console.log('   Install Python from https://python.org and run: pip install MetaTrader5');
  }
}
