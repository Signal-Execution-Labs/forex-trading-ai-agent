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
