/**
 * K.I.T. Hooks Runtime System
 * 
 * Event-driven automation for commands and lifecycle events.
 * Inspired by OpenClaw's hooks system.
 * 
 * Event Types:
 * - command:new - When /new or session reset
 * - command:reset - When session is explicitly reset
 * - command:stop - When agent stops
 * - gateway:startup - After gateway starts
 * - gateway:shutdown - Before gateway stops
 * - session:start - New session begins
 * - session:end - Session ends
 * - message:received - Message received from channel
 * - message:sent - Message sent to channel
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';
import { Logger } from '../core/logger';

const logger = new Logger('hooks');
const KIT_HOME = path.join(os.homedir(), '.kit');
const HOOKS_DIR = path.join(KIT_HOME, 'hooks');
const HOOKS_CONFIG = path.join(KIT_HOME, 'hooks.json');

// ============================================================================
// Types
// ============================================================================

export interface HookEvent {
  type: HookEventType;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];  // Push messages here to send to user
  context: HookContext;
}

export type HookEventType = 
  | 'command'
  | 'session'
  | 'gateway'
  | 'message'
  | 'agent';

export interface HookContext {
  sessionId?: string;
  sessionFile?: string;
  commandSource?: string;  // e.g., 'telegram', 'discord', 'whatsapp'
  senderId?: string;
  workspaceDir?: string;
  cfg?: Record<string, any>;
  channelId?: string;
  guildId?: string;
  messageContent?: string;
  [key: string]: any;
}

export type HookHandler = (event: HookEvent) => Promise<void>;

export interface HookMetadata {
  name: string;
  description: string;
  emoji?: string;
  events: string[];  // e.g., ['command:new', 'gateway:startup']
  requires?: {
    bins?: string[];
    env?: string[];
    config?: string[];
  };
  enabled?: boolean;
  path?: string;
}

export interface HooksConfig {
  version: number;
  enabled: Record<string, boolean>;
  lastUpdated: string;
}

export interface RegisteredHook {
  metadata: HookMetadata;
  handler: HookHandler;
  path: string;
}

// ============================================================================
// Hooks Manager
// ============================================================================

export class HooksManager extends EventEmitter {
  private hooks: Map<string, RegisteredHook> = new Map();
  private eventHandlers: Map<string, RegisteredHook[]> = new Map();
  private config: HooksConfig;
  private enabled: boolean = true;
  
  constructor() {
    super();
    this.config = this.loadConfig();
  }
  
  /**
   * Load hooks config
   */
  private loadConfig(): HooksConfig {
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
  private saveConfig(): void {
    this.config.lastUpdated = new Date().toISOString();
    
    if (!fs.existsSync(KIT_HOME)) {
      fs.mkdirSync(KIT_HOME, { recursive: true });
    }
    
    fs.writeFileSync(HOOKS_CONFIG, JSON.stringify(this.config, null, 2));
  }
  
  /**
   * Discover and load hooks from directories
   */
  async loadHooks(): Promise<void> {
    const workspaceHooks = path.join(KIT_HOME, 'workspace', 'hooks');
    const managedHooks = HOOKS_DIR;
    
    // Load from both directories (workspace takes precedence)
    const dirs = [managedHooks, workspaceHooks];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          
          const hookPath = path.join(dir, entry.name);
          await this.loadHook(entry.name, hookPath);
        }
      } catch (err) {
        logger.warn(`Failed to scan hooks directory: ${dir}`, err);
      }
    }
    
    logger.info(`Loaded ${this.hooks.size} hooks`);
  }
  
  /**
   * Load a single hook
   */
  private async loadHook(name: string, hookPath: string): Promise<void> {
    const hookMdPath = path.join(hookPath, 'HOOK.md');
    const handlerPath = path.join(hookPath, 'handler.ts');
    const handlerJsPath = path.join(hookPath, 'handler.js');
    
    // Check HOOK.md exists
    if (!fs.existsSync(hookMdPath)) {
      logger.debug(`Skipping ${name}: no HOOK.md`);
      return;
    }
    
    // Parse metadata
    const content = fs.readFileSync(hookMdPath, 'utf8');
    const metadata = this.parseHookMd(content, name);
    metadata.path = hookPath;
    
    // Check if enabled in config
    const isEnabled = this.config.enabled[name] ?? false;
    if (!isEnabled) {
      logger.debug(`Hook ${name} is disabled`);
      return;
    }
    
    // Check requirements
    if (!this.checkRequirements(metadata)) {
      logger.warn(`Hook ${name} has unmet requirements`);
      return;
    }
    
    // Load handler
    const actualHandlerPath = fs.existsSync(handlerJsPath) ? handlerJsPath : handlerPath;
    if (!fs.existsSync(actualHandlerPath)) {
      logger.warn(`Hook ${name} missing handler.ts/js`);
      return;
    }
    
    try {
      // Dynamic import of handler
      const handlerModule = await import(`file://${actualHandlerPath.replace(/\\/g, '/')}`);
      const handler: HookHandler = handlerModule.default || handlerModule.handler;
      
      if (typeof handler !== 'function') {
        logger.warn(`Hook ${name} handler is not a function`);
        return;
      }
      
      const registeredHook: RegisteredHook = {
        metadata,
        handler,
        path: hookPath,
      };
      
      this.hooks.set(name, registeredHook);
      
      // Register for events
      for (const event of metadata.events) {
        if (!this.eventHandlers.has(event)) {
          this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(registeredHook);
        logger.debug(`Registered hook ${name} for event: ${event}`);
      }
      
      logger.info(`Loaded hook: ${metadata.emoji || '🪝'} ${name} → ${metadata.events.join(', ')}`);
    } catch (err) {
      logger.error(`Failed to load hook ${name}:`, err);
    }
  }
  
  /**
   * Parse HOOK.md frontmatter
   */
  private parseHookMd(content: string, fallbackName: string): HookMetadata {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!match) {
      return {
        name: fallbackName,
        description: 'No description',
        events: [],
      };
    }
    
    const frontmatter = match[1];
    
    const name = frontmatter.match(/name:\s*["']?([^"'\n]+)/)?.[1] || fallbackName;
    const description = frontmatter.match(/description:\s*["']?([^"'\n]+)/)?.[1] || 'No description';
    
    // Parse metadata.openclaw
    const metadataMatch = frontmatter.match(/metadata:\s*\{[\s\S]*?"openclaw":\s*\{([\s\S]*?)\}/);
    let emoji = '🪝';
    let events: string[] = [];
    
    if (metadataMatch) {
      const openclawMeta = metadataMatch[1];
      emoji = openclawMeta.match(/["']emoji["']:\s*["']([^"']+)/)?.[1] || '🪝';
      
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
   * Check if hook requirements are met
   */
  private checkRequirements(metadata: HookMetadata): boolean {
    if (!metadata.requires) return true;
    
    // Check binaries
    if (metadata.requires.bins) {
      for (const bin of metadata.requires.bins) {
        try {
          const { execSync } = require('child_process');
          execSync(`which ${bin} || where ${bin}`, { stdio: 'pipe' });
        } catch {
          return false;
        }
      }
    }
    
    // Check env vars
    if (metadata.requires.env) {
      for (const env of metadata.requires.env) {
        if (!process.env[env]) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Trigger a hook event
   */
  async trigger(
    type: HookEventType,
    action: string,
    sessionKey: string,
    context: HookContext = {}
  ): Promise<{ messages: string[] }> {
    if (!this.enabled) {
      return { messages: [] };
    }
    
    const event: HookEvent = {
      type,
      action,
      sessionKey,
      timestamp: new Date(),
      messages: [],
      context,
    };
    
    // Get handlers for specific event (e.g., 'command:new')
    const specificEvent = `${type}:${action}`;
    const specificHandlers = this.eventHandlers.get(specificEvent) || [];
    
    // Get handlers for general event (e.g., 'command')
    const generalHandlers = this.eventHandlers.get(type) || [];
    
    // Combine and deduplicate
    const handlers = [...new Set([...specificHandlers, ...generalHandlers])];
    
    if (handlers.length === 0) {
      return { messages: [] };
    }
    
    logger.debug(`Triggering ${specificEvent} for ${handlers.length} hooks`);
    
    // Run handlers in parallel with error isolation
    await Promise.allSettled(
      handlers.map(async (hook) => {
        try {
          await hook.handler(event);
        } catch (err) {
          logger.error(`Hook ${hook.metadata.name} failed:`, err);
        }
      })
    );
    
    // Emit event for external listeners
    this.emit('triggered', { event, handlers: handlers.map(h => h.metadata.name) });
    
    return { messages: event.messages };
  }
  
  /**
   * Enable/disable hooks globally
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Enable a specific hook
   */
  enableHook(name: string): boolean {
    const hook = this.hooks.get(name);
    if (!hook) return false;
    
    this.config.enabled[name] = true;
    this.saveConfig();
    return true;
  }
  
  /**
   * Disable a specific hook
   */
  disableHook(name: string): boolean {
    this.config.enabled[name] = false;
    this.saveConfig();
    return true;
  }
  
  /**
   * Get all registered hooks
   */
  getHooks(): RegisteredHook[] {
    return Array.from(this.hooks.values());
  }
  
  /**
   * Get hook by name
   */
  getHook(name: string): RegisteredHook | undefined {
    return this.hooks.get(name);
  }
  
  /**
   * Check if a hook is enabled
   */
  isHookEnabled(name: string): boolean {
    return this.config.enabled[name] ?? false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a hook event (for testing)
 */
export function createHookEvent(
  type: HookEventType,
  action: string,
  sessionKey: string,
  context: HookContext = {}
): HookEvent {
  return {
    type,
    action,
    sessionKey,
    timestamp: new Date(),
    messages: [],
    context,
  };
}

/**
 * Global hooks manager instance
 */
let globalHooksManager: HooksManager | null = null;

export function getHooksManager(): HooksManager {
  if (!globalHooksManager) {
    globalHooksManager = new HooksManager();
  }
  return globalHooksManager;
}

export async function initHooks(): Promise<HooksManager> {
  const manager = getHooksManager();
  await manager.loadHooks();
  return manager;
}
