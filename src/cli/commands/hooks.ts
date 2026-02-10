/**
 * K.I.T. Hooks CLI Command
 * 
 * Groundwork for OpenClaw-style hooks system.
 * Hooks provide event-driven automation for commands and lifecycle events.
 * 
 * @see OpenClaw docs/hooks.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const HOOKS_DIR = path.join(KIT_HOME, 'hooks');
const HOOKS_CONFIG = path.join(KIT_HOME, 'hooks.json');

export interface HookMetadata {
  name: string;
  description: string;
  emoji?: string;
  events: string[];
  requires?: {
    bins?: string[];
    env?: string[];
    config?: string[];
  };
}

export interface HookConfig {
  version: number;
  enabled: Record<string, boolean>;
  lastUpdated: string;
}

/**
 * Discover hooks from directories
 */
async function discoverHooks(): Promise<Map<string, HookMetadata>> {
  const hooks = new Map<string, HookMetadata>();
  
  // Check workspace hooks
  const workspaceHooks = path.join(KIT_HOME, 'workspace', 'hooks');
  
  // Check managed hooks
  const managedHooks = HOOKS_DIR;
  
  const dirs = [workspaceHooks, managedHooks];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const hookPath = path.join(dir, entry.name);
        const hookMd = path.join(hookPath, 'HOOK.md');
        
        if (!fs.existsSync(hookMd)) continue;
        
        try {
          const content = fs.readFileSync(hookMd, 'utf8');
          const metadata = parseHookMd(content, entry.name);
          hooks.set(entry.name, metadata);
        } catch {
          // Skip invalid hook
        }
      }
    } catch {
      // Skip unreadable directory
    }
  }
  
  return hooks;
}

/**
 * Parse HOOK.md frontmatter
 */
function parseHookMd(content: string, fallbackName: string): HookMetadata {
  // Extract YAML frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  
  if (!match) {
    return {
      name: fallbackName,
      description: 'No description',
      events: [],
    };
  }
  
  const frontmatter = match[1];
  
  // Simple YAML parsing
  const name = frontmatter.match(/name:\s*["']?([^"'\n]+)/)?.[1] || fallbackName;
  const description = frontmatter.match(/description:\s*["']?([^"'\n]+)/)?.[1] || 'No description';
  
  // Parse metadata.openclaw
  const metadataMatch = frontmatter.match(/metadata:\s*\{[\s\S]*?"openclaw":\s*\{([\s\S]*?)\}/);
  let emoji = '🔗';
  let events: string[] = [];
  
  if (metadataMatch) {
    const openclawMeta = metadataMatch[1];
    emoji = openclawMeta.match(/["']emoji["']:\s*["']([^"']+)/)?.[1] || '🔗';
    
    const eventsMatch = openclawMeta.match(/["']events["']:\s*\[([\s\S]*?)\]/);
    if (eventsMatch) {
      events = eventsMatch[1]
        .split(',')
        .map(e => e.replace(/["'\s]/g, ''))
        .filter(e => e.length > 0);
    }
  }
  
  return {
    name,
    description,
    emoji,
    events,
  };
}

/**
 * Load hooks config
 */
function loadHooksConfig(): HookConfig {
  if (!fs.existsSync(HOOKS_CONFIG)) {
    return {
      version: 1,
      enabled: {},
      lastUpdated: new Date().toISOString(),
    };
  }
  
  try {
    return JSON.parse(fs.readFileSync(HOOKS_CONFIG, 'utf8'));
  } catch {
    return {
      version: 1,
      enabled: {},
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Save hooks config
 */
function saveHooksConfig(config: HookConfig): void {
  config.lastUpdated = new Date().toISOString();
  
  // Ensure directory exists
  if (!fs.existsSync(KIT_HOME)) {
    fs.mkdirSync(KIT_HOME, { recursive: true });
  }
  
  fs.writeFileSync(HOOKS_CONFIG, JSON.stringify(config, null, 2));
}

/**
 * Create hooks command
 */
export function createHooksCommand(): Command {
  const hooks = new Command('hooks')
    .description('Manage event-driven hooks (OpenClaw-inspired)')
    .addHelpText('after', `
Examples:
  kit hooks list              List all discovered hooks
  kit hooks enable my-hook    Enable a hook
  kit hooks disable my-hook   Disable a hook
  kit hooks info my-hook      Show hook details
  kit hooks check             Check hook eligibility

Hooks Directory:
  Workspace: ~/.kit/workspace/hooks/
  Managed:   ~/.kit/hooks/

Hook Structure:
  my-hook/
  ├── HOOK.md      # Metadata + documentation
  └── handler.ts   # Event handler

Documentation: https://github.com/kayzaa/k.i.t.-bot/docs/hooks.md
`);

  // LIST
  hooks
    .command('list')
    .description('List all discovered hooks')
    .option('-v, --verbose', 'Show detailed information')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      const discovered = await discoverHooks();
      const config = loadHooksConfig();
      
      if (options.json) {
        const result = Array.from(discovered.entries()).map(([id, hook]) => ({
          id,
          ...hook,
          enabled: config.enabled[id] ?? false,
        }));
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      
      console.log('\n🪝 K.I.T. Hooks\n');
      
      if (discovered.size === 0) {
        console.log('   No hooks discovered.');
        console.log(`   Create hooks in: ${HOOKS_DIR}/\n`);
        console.log('   Hook structure:');
        console.log('     my-hook/');
        console.log('     ├── HOOK.md      # Metadata');
        console.log('     └── handler.ts   # Handler\n');
        return;
      }
      
      for (const [id, hook] of discovered) {
        const enabled = config.enabled[id] ?? false;
        const status = enabled ? '✅' : '⬜';
        const emoji = hook.emoji || '🔗';
        
        console.log(`   ${status} ${emoji} ${hook.name}`);
        
        if (options.verbose) {
          console.log(`      ${hook.description}`);
          if (hook.events.length > 0) {
            console.log(`      Events: ${hook.events.join(', ')}`);
          }
        }
      }
      
      console.log('');
    });

  // ENABLE
  hooks
    .command('enable <hook>')
    .description('Enable a hook')
    .action(async (hookName: string) => {
      const discovered = await discoverHooks();
      
      if (!discovered.has(hookName)) {
        console.log(`\n❌ Hook not found: ${hookName}`);
        console.log('   Run "kit hooks list" to see available hooks.\n');
        return;
      }
      
      const config = loadHooksConfig();
      config.enabled[hookName] = true;
      saveHooksConfig(config);
      
      const hook = discovered.get(hookName)!;
      console.log(`\n✅ Enabled: ${hook.emoji || '🔗'} ${hook.name}`);
      console.log('   Restart gateway for changes to take effect.\n');
    });

  // DISABLE
  hooks
    .command('disable <hook>')
    .description('Disable a hook')
    .action(async (hookName: string) => {
      const config = loadHooksConfig();
      
      if (config.enabled[hookName] === undefined) {
        console.log(`\n⚠️  Hook not enabled or not found: ${hookName}\n`);
        return;
      }
      
      config.enabled[hookName] = false;
      saveHooksConfig(config);
      
      console.log(`\n⬜ Disabled: ${hookName}`);
      console.log('   Restart gateway for changes to take effect.\n');
    });

  // INFO
  hooks
    .command('info <hook>')
    .description('Show detailed hook information')
    .action(async (hookName: string) => {
      const discovered = await discoverHooks();
      const config = loadHooksConfig();
      
      if (!discovered.has(hookName)) {
        console.log(`\n❌ Hook not found: ${hookName}\n`);
        return;
      }
      
      const hook = discovered.get(hookName)!;
      const enabled = config.enabled[hookName] ?? false;
      
      console.log(`
${hook.emoji || '🔗'} ${hook.name}
${'═'.repeat(40)}

Description: ${hook.description}
Status:      ${enabled ? '✅ Enabled' : '⬜ Disabled'}
Events:      ${hook.events.length > 0 ? hook.events.join(', ') : 'none'}

${hook.requires ? `Requirements:
  Binaries: ${hook.requires.bins?.join(', ') || 'none'}
  Env vars: ${hook.requires.env?.join(', ') || 'none'}
  Config:   ${hook.requires.config?.join(', ') || 'none'}
` : ''}
Location: ${HOOKS_DIR}/${hookName}/
`);
    });

  // CHECK
  hooks
    .command('check')
    .description('Check hook eligibility')
    .action(async () => {
      const discovered = await discoverHooks();
      const config = loadHooksConfig();
      
      console.log('\n🔍 Hook Eligibility Check\n');
      
      if (discovered.size === 0) {
        console.log('   No hooks discovered.\n');
        return;
      }
      
      for (const [id, hook] of discovered) {
        const enabled = config.enabled[id] ?? false;
        let eligible = true;
        const issues: string[] = [];
        
        // Check requirements
        if (hook.requires?.bins) {
          for (const bin of hook.requires.bins) {
            try {
              const { execSync } = await import('child_process');
              execSync(`which ${bin} || where ${bin}`, { stdio: 'pipe' });
            } catch {
              eligible = false;
              issues.push(`Missing binary: ${bin}`);
            }
          }
        }
        
        if (hook.requires?.env) {
          for (const env of hook.requires.env) {
            if (!process.env[env]) {
              eligible = false;
              issues.push(`Missing env: ${env}`);
            }
          }
        }
        
        const status = enabled ? (eligible ? '✅' : '⚠️') : '⬜';
        console.log(`   ${status} ${hook.emoji || '🔗'} ${hook.name}`);
        
        for (const issue of issues) {
          console.log(`      ❌ ${issue}`);
        }
      }
      
      console.log('');
    });

  // SCAFFOLD (create new hook)
  hooks
    .command('create <name>')
    .description('Create a new hook from template')
    .option('-e, --events <events>', 'Comma-separated event names', 'command:new')
    .action(async (name: string, options) => {
      const hookDir = path.join(HOOKS_DIR, name);
      
      if (fs.existsSync(hookDir)) {
        console.log(`\n❌ Hook already exists: ${hookDir}\n`);
        return;
      }
      
      // Create directory
      fs.mkdirSync(hookDir, { recursive: true });
      
      const events = options.events.split(',').map((e: string) => `"${e.trim()}"`).join(', ');
      
      // Create HOOK.md
      const hookMd = `---
name: ${name}
description: "Describe what this hook does"
metadata:
  {
    "openclaw":
      {
        "emoji": "🪝",
        "events": [${events}]
      }
  }
---

# ${name}

Describe your hook here.

## What It Does

- Listens for events
- Performs actions
- Reports results

## Requirements

None.

## Configuration

No configuration needed.
`;
      
      fs.writeFileSync(path.join(hookDir, 'HOOK.md'), hookMd);
      
      // Create handler.ts
      const handlerTs = `/**
 * ${name} Hook Handler
 * 
 * Events: ${options.events}
 */

export interface HookEvent {
  type: 'command' | 'session' | 'agent' | 'gateway';
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  context: Record<string, any>;
}

export type HookHandler = (event: HookEvent) => Promise<void>;

const handler: HookHandler = async (event) => {
  // Filter for specific events
  if (event.type !== 'command') {
    return;
  }
  
  console.log(\`[${name}] Event: \${event.type}:\${event.action}\`);
  
  // Your logic here
  
  // Optionally send message back to user
  // event.messages.push('Hook executed!');
};

export default handler;
`;
      
      fs.writeFileSync(path.join(hookDir, 'handler.ts'), handlerTs);
      
      console.log(`\n✅ Created hook: ${name}`);
      console.log(`   Location: ${hookDir}/`);
      console.log('   Files:');
      console.log('     - HOOK.md');
      console.log('     - handler.ts');
      console.log('\n   Edit these files, then run:');
      console.log(`   kit hooks enable ${name}\n`);
    });

  return hooks;
}
