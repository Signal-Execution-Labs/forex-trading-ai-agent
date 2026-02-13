#!/usr/bin/env node
/**
 * K.I.T. Post-Install Setup
 * Runs automatically after npm install
 * 
 * Creates ~/.kit directory structure and copies workspace templates
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

function log(msg) {
  console.log(`${c.cyan}[K.I.T.]${c.reset} ${msg}`);
}

function setup() {
  // Create directories
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

  // Copy workspace templates
  const templatesDir = path.join(__dirname, '..', 'workspace-templates');
  const templates = [
    'SOUL.md', 'USER.md', 'AGENTS.md', 'TOOLS.md', 
    'MEMORY.md', 'HEARTBEAT.md', 'BOOT.md', 'IDENTITY.md'
  ];
  
  if (fs.existsSync(templatesDir)) {
    templates.forEach(file => {
      const src = path.join(templatesDir, file);
      const dest = path.join(workspaceDir, file);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    });
  }

  // Print minimal success message
  console.log(`
${c.cyan}${c.bold}
    ██╗  ██╗    ██╗   ████████╗
    ██║ ██╔╝    ██║   ╚══██╔══╝
    █████╔╝     ██║      ██║   
    ██╔═██╗     ██║      ██║   
    ██║  ██╗ ██╗██║ ██╗  ██║   
    ╚═╝  ╚═╝ ╚═╝╚═╝ ╚═╝  ╚═╝   
${c.reset}
  ${c.bold}K.I.T. installed successfully!${c.reset}
  
  ${c.dim}Get started:${c.reset}
    ${c.green}kit onboard${c.reset}  - Setup wizard
    ${c.green}kit start${c.reset}    - Start trading
    ${c.green}kit --help${c.reset}   - Show all commands
  
  ${c.dim}Docs: https://github.com/kayzaa/k.i.t.-bot${c.reset}
`);
}

// Run setup
try {
  setup();
} catch (err) {
  // Silent fail - don't break npm install
  console.log(`${c.yellow}[K.I.T.]${c.reset} Setup notice: ${err.message}`);
}
