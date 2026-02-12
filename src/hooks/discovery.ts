/**
 * K.I.T. Hook Discovery System
 * Discovers hooks from workspace, managed, and bundled directories
 * OpenClaw-compatible HOOK.md format
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../core/logger.js';
import type { HookDefinition, HookFrontmatter, HookEvent } from './types.js';

const logger = createLogger('hooks:discovery');

// ============================================================================
// HOOK.md Parser
// ============================================================================

/**
 * Parse YAML frontmatter from HOOK.md
 */
function parseFrontmatter(content: string): HookFrontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  
  const yaml = match[1];
  const result: any = {};
  
  // Simple YAML parser for our needs
  const lines = yaml.split('\n');
  let currentKey = '';
  let inMetadata = false;
  let inKit = false;
  let inRequires = false;
  let inArray: string | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Handle simple key: value
    const simpleMatch = trimmed.match(/^(\w+):\s*"?([^"]*)"?$/);
    if (simpleMatch && !inMetadata) {
      const [, key, value] = simpleMatch;
      result[key] = value || undefined;
      continue;
    }
    
    // Handle metadata block
    if (trimmed === 'metadata:') {
      result.metadata = {};
      inMetadata = true;
      continue;
    }
    
    if (inMetadata && trimmed === 'kit:') {
      result.metadata.kit = {};
      inKit = true;
      continue;
    }
    
    if (inKit && trimmed === 'requires:') {
      result.metadata.kit.requires = {};
      inRequires = true;
      continue;
    }
    
    // Handle kit properties
    if (inKit && !inRequires) {
      const kitMatch = trimmed.match(/^(\w+):\s*(.*)$/);
      if (kitMatch) {
        const [, key, value] = kitMatch;
        if (value.startsWith('[') && value.endsWith(']')) {
          // Array value like ["event1", "event2"]
          const items = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
          result.metadata.kit[key] = items;
        } else if (value.startsWith('"')) {
          result.metadata.kit[key] = value.replace(/"/g, '');
        } else if (value === 'true' || value === 'false') {
          result.metadata.kit[key] = value === 'true';
        } else if (!isNaN(Number(value))) {
          result.metadata.kit[key] = Number(value);
        } else {
          result.metadata.kit[key] = value;
        }
      }
    }
    
    // Handle requires properties
    if (inRequires) {
      const reqMatch = trimmed.match(/^(\w+):\s*\[(.*)\]$/);
      if (reqMatch) {
        const [, key, value] = reqMatch;
        result.metadata.kit.requires[key] = value.split(',').map(s => s.trim().replace(/"/g, ''));
      }
    }
  }
  
  return result as HookFrontmatter;
}

// ============================================================================
// Hook Discovery
// ============================================================================

/**
 * Discover hooks from a directory
 */
function discoverFromDir(
  dir: string,
  source: 'bundled' | 'managed' | 'workspace'
): HookDefinition[] {
  const hooks: HookDefinition[] = [];
  
  if (!fs.existsSync(dir)) return hooks;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const hookDir = path.join(dir, entry.name);
    const hookMdPath = path.join(hookDir, 'HOOK.md');
    const handlerPath = path.join(hookDir, 'handler.ts');
    const handlerJsPath = path.join(hookDir, 'handler.js');
    const indexPath = path.join(hookDir, 'index.ts');
    const indexJsPath = path.join(hookDir, 'index.js');
    
    if (!fs.existsSync(hookMdPath)) continue;
    
    // Find handler file
    let actualHandler = '';
    if (fs.existsSync(handlerPath)) actualHandler = handlerPath;
    else if (fs.existsSync(handlerJsPath)) actualHandler = handlerJsPath;
    else if (fs.existsSync(indexPath)) actualHandler = indexPath;
    else if (fs.existsSync(indexJsPath)) actualHandler = indexJsPath;
    else {
      logger.warn(`Hook ${entry.name} has no handler file, skipping`);
      continue;
    }
    
    // Parse HOOK.md
    const content = fs.readFileSync(hookMdPath, 'utf-8');
    const frontmatter = parseFrontmatter(content);
    
    if (!frontmatter || !frontmatter.name) {
      logger.warn(`Hook ${entry.name} has invalid HOOK.md, skipping`);
      continue;
    }
    
    hooks.push({
      id: entry.name,
      name: frontmatter.name,
      description: frontmatter.description || '',
      version: frontmatter.version,
      author: frontmatter.author,
      homepage: frontmatter.homepage,
      metadata: frontmatter.metadata,
      path: hookDir,
      handlerPath: actualHandler,
      enabled: true, // Default enabled, config can override
      source,
    });
    
    logger.debug(`Discovered hook: ${entry.name} from ${source}`);
  }
  
  return hooks;
}

/**
 * Get all hook directories (in order of precedence)
 */
function getHookDirs(): Array<{ dir: string; source: 'bundled' | 'managed' | 'workspace' }> {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  
  return [
    // Workspace hooks (highest precedence)
    { dir: path.join(home, '.kit', 'workspace', 'hooks'), source: 'workspace' as const },
    // Managed hooks
    { dir: path.join(home, '.kit', 'hooks'), source: 'managed' as const },
    // Bundled hooks (lowest precedence)
    { dir: path.join(__dirname, 'bundled'), source: 'bundled' as const },
  ];
}

/**
 * Discover all hooks from all directories
 */
export function discoverHooks(extraDirs?: string[]): HookDefinition[] {
  const hooks: HookDefinition[] = [];
  const seenIds = new Set<string>();
  
  const dirs = getHookDirs();
  
  // Add extra directories if specified
  if (extraDirs) {
    for (const dir of extraDirs) {
      dirs.push({ dir, source: 'managed' });
    }
  }
  
  for (const { dir, source } of dirs) {
    const discovered = discoverFromDir(dir, source);
    
    for (const hook of discovered) {
      // First one wins (workspace > managed > bundled)
      if (!seenIds.has(hook.id)) {
        seenIds.add(hook.id);
        hooks.push(hook);
      }
    }
  }
  
  logger.info(`Discovered ${hooks.length} hooks total`);
  return hooks;
}

/**
 * Check if a hook is eligible to run (requirements met)
 */
export function checkEligibility(hook: HookDefinition): { eligible: boolean; missing: string[] } {
  const missing: string[] = [];
  const requires = hook.metadata?.kit?.requires;
  
  if (!requires) return { eligible: true, missing: [] };
  
  // Check required binaries
  if (requires.bins) {
    for (const bin of requires.bins) {
      const found = process.env.PATH?.split(path.delimiter).some(p => {
        return fs.existsSync(path.join(p, bin)) || 
               fs.existsSync(path.join(p, `${bin}.exe`));
      });
      if (!found) missing.push(`bin:${bin}`);
    }
  }
  
  // Check at least one binary
  if (requires.anyBins && requires.anyBins.length > 0) {
    const hasOne = requires.anyBins.some(bin => {
      return process.env.PATH?.split(path.delimiter).some(p => {
        return fs.existsSync(path.join(p, bin)) || 
               fs.existsSync(path.join(p, `${bin}.exe`));
      });
    });
    if (!hasOne) missing.push(`anyBins:[${requires.anyBins.join(',')}]`);
  }
  
  // Check environment variables
  if (requires.env) {
    for (const envVar of requires.env) {
      if (!process.env[envVar]) missing.push(`env:${envVar}`);
    }
  }
  
  // Check OS
  if (requires.os && requires.os.length > 0) {
    const platform = process.platform;
    if (!requires.os.includes(platform)) {
      missing.push(`os:[${requires.os.join(',')}]`);
    }
  }
  
  return { eligible: missing.length === 0, missing };
}

/**
 * Get events for a hook
 */
export function getHookEvents(hook: HookDefinition): HookEvent[] {
  return hook.metadata?.kit?.events || [];
}

/**
 * Get hook priority
 */
export function getHookPriority(hook: HookDefinition): number {
  return hook.metadata?.kit?.priority || 0;
}

/**
 * Get hook emoji
 */
export function getHookEmoji(hook: HookDefinition): string {
  return hook.metadata?.kit?.emoji || '🪝';
}
