/**
 * K.I.T. Hooks System
 * 
 * OpenClaw-compatible event-driven automation for trading events,
 * portfolio changes, and lifecycle events.
 * 
 * Features:
 * - Directory-based hook discovery (workspace > managed > bundled)
 * - HOOK.md metadata format with YAML frontmatter
 * - Priority-based execution order
 * - Eligibility checking for requirements
 * 
 * Events:
 * - trade:executed - After a trade is placed
 * - trade:closed - When a position is closed
 * - portfolio:changed - When portfolio value changes significantly
 * - alert:triggered - When a price/indicator alert fires
 * - session:start - When a trading session begins
 * - session:end - When a trading session ends
 * - signal:received - When a trading signal is received
 * - risk:warning - When risk limits are approached
 * - market:open - When market opens
 * - market:close - When market closes
 * - gateway:startup - When gateway starts
 * - command:new - When /new command is issued
 * - command:reset - When /reset command is issued
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../core/logger.js';
import { discoverHooks, checkEligibility, getHookEvents, getHookPriority, getHookEmoji } from './discovery.js';
import type { HookEvent, HookContext, HookDefinition, LoadedHook, HookHandler, HookResult, HookConfig, Hook, HookMetadata, HookRegistryInterface } from './types.js';

// Re-export types
export * from './types.js';
export { discoverHooks, checkEligibility, getHookEvents, getHookPriority, getHookEmoji } from './discovery.js';

// Backward compatibility: HookRegistry class export
export { HookRegistry };

const logger = createLogger('hooks');

// ============================================================================
// Hook Registry
// ============================================================================

class HookRegistry {
  private hooks: Map<string, LoadedHook> = new Map();
  private hooksByEvent: Map<HookEvent, LoadedHook[]> = new Map();
  private configPath: string;
  private config: HookConfig = {};
  private initialized = false;

  constructor() {
    this.configPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'hooks.json');
  }

  /**
   * Initialize the hook registry - discover and load hooks
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.loadConfig();
    
    // Discover hooks from directories
    const extraDirs = this.config.internal?.load?.extraDirs;
    const discovered = discoverHooks(extraDirs);
    
    // Load each discovered hook
    for (const hookDef of discovered) {
      try {
        // Check eligibility
        const { eligible, missing } = checkEligibility(hookDef);
        if (!eligible && !hookDef.metadata?.kit?.always) {
          logger.debug(`Hook ${hookDef.id} not eligible: ${missing.join(', ')}`);
          continue;
        }
        
        // Check if enabled in config
        const configEntry = this.config.internal?.entries?.[hookDef.id];
        if (configEntry?.enabled === false) {
          hookDef.enabled = false;
        }
        
        // Load handler
        await this.loadHook(hookDef);
      } catch (error) {
        logger.error(`Failed to load hook ${hookDef.id}:`, error);
      }
    }
    
    // Also register legacy bundled hooks (for backward compatibility)
    this.registerLegacyBundledHooks();
    
    this.initialized = true;
    logger.info(`Hooks initialized: ${this.hooks.size} loaded`);
  }

  /**
   * Load a single hook's handler
   */
  private async loadHook(hookDef: HookDefinition): Promise<void> {
    // For TypeScript hooks, we need to handle them specially
    // In production, these would be compiled to JS
    const handlerModule = await import(`file://${hookDef.handlerPath.replace(/\.ts$/, '.js')}`).catch(async () => {
      // Fallback: try direct import
      return import(hookDef.handlerPath);
    }).catch(() => null);
    
    if (!handlerModule) {
      // Skip - handler not loadable (TypeScript not compiled)
      logger.debug(`Skipping hook ${hookDef.id} - handler not loadable`);
      return;
    }
    
    const exportName = hookDef.metadata?.kit?.export || 'default';
    const handler = handlerModule[exportName] || handlerModule.default;
    
    if (typeof handler !== 'function') {
      logger.warn(`Hook ${hookDef.id} has no valid handler export`);
      return;
    }
    
    const loadedHook: LoadedHook = {
      ...hookDef,
      handler,
      events: getHookEvents(hookDef),
      priority: getHookPriority(hookDef),
      emoji: getHookEmoji(hookDef),
    };
    
    this.register(loadedHook);
  }

  /**
   * Register a hook
   */
  register(hook: LoadedHook): void {
    // Don't overwrite existing hooks (first one wins)
    if (this.hooks.has(hook.id)) {
      logger.debug(`Hook ${hook.id} already registered, skipping`);
      return;
    }
    
    // Set convenience properties for backward compatibility
    const events = getHookEvents(hook);
    const priority = getHookPriority(hook);
    const emoji = getHookEmoji(hook);
    hook.events = events;
    hook.priority = priority;
    hook.emoji = emoji;
    
    this.hooks.set(hook.id, hook);
    
    for (const event of events) {
      if (!this.hooksByEvent.has(event)) {
        this.hooksByEvent.set(event, []);
      }
      const hooks = this.hooksByEvent.get(event)!;
      hooks.push(hook);
      // Sort by priority (higher first)
      hooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
    
    logger.info(`Registered hook: ${emoji} ${hook.id} for events: ${events.join(', ')}`);
  }

  /**
   * Unregister a hook
   */
  unregister(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;
    
    this.hooks.delete(hookId);
    
    const events = getHookEvents(hook);
    for (const event of events) {
      const hooks = this.hooksByEvent.get(event);
      if (hooks) {
        const index = hooks.findIndex(h => h.id === hookId);
        if (index >= 0) hooks.splice(index, 1);
      }
    }
    
    logger.info(`Unregistered hook: ${hookId}`);
    return true;
  }

  /**
   * Enable/disable a hook
   */
  setEnabled(hookId: string, enabled: boolean): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;
    
    hook.enabled = enabled;
    this.saveConfig();
    logger.info(`Hook ${hookId} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  /**
   * Get all hooks
   */
  getAll(): LoadedHook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get hooks for a specific event
   */
  getForEvent(event: HookEvent): LoadedHook[] {
    return this.hooksByEvent.get(event) || [];
  }

  /**
   * Get a specific hook
   */
  get(hookId: string): LoadedHook | undefined {
    return this.hooks.get(hookId);
  }

  /**
   * Emit an event to all registered hooks
   */
  async emit(event: HookEvent, data: Record<string, any> = {}, agentId: string = 'main'): Promise<HookResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const hooks = this.getForEvent(event).filter(h => h.enabled);
    const results: HookResult[] = [];
    
    const context: HookContext = {
      event,
      timestamp: new Date(),
      data,
      kitVersion: '2.0.0',
      agentId,
      messages: [],
      context: {
        workspaceDir: path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'workspace'),
      },
    };
    
    for (const hook of hooks) {
      const start = Date.now();
      try {
        await hook.handler(context);
        results.push({
          hookId: hook.id,
          success: true,
          durationMs: Date.now() - start,
          messages: [...context.messages],
        });
        // Clear messages for next hook
        context.messages = [];
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Hook ${hook.id} failed:`, errMsg);
        results.push({
          hookId: hook.id,
          success: false,
          durationMs: Date.now() - start,
          error: errMsg,
        });
      }
    }
    
    return results;
  }

  /**
   * Load enabled/disabled state from config
   */
  loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        // Also load legacy format
        if ((this.config as any).enabled) {
          for (const [hookId, enabled] of Object.entries((this.config as any).enabled)) {
            const hook = this.hooks.get(hookId);
            if (hook) hook.enabled = enabled as boolean;
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to load hooks config:', error);
    }
  }

  /**
   * Save enabled/disabled state to config
   */
  saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Merge with existing config
      const entries: Record<string, { enabled: boolean }> = {};
      for (const [id, hook] of this.hooks.entries()) {
        entries[id] = { enabled: hook.enabled };
      }
      
      this.config = {
        ...this.config,
        internal: {
          ...this.config.internal,
          enabled: true,
          entries,
        },
      };
      
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.warn('Failed to save hooks config:', error);
    }
  }

  /**
   * Register legacy bundled hooks for backward compatibility
   * These run if HOOK.md-based hooks weren't loaded
   */
  private registerLegacyBundledHooks(): void {
    // Only register if not already discovered
    const legacyHooks: Array<{ id: string; events: HookEvent[]; priority: number; handler: HookHandler }> = [
      {
        id: 'trade-logger',
        events: ['trade:executed', 'trade:closed'],
        priority: 100,
        handler: async (ctx) => {
          const logPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'logs', 'trades.log');
          const dir = path.dirname(logPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const entry = JSON.stringify({ event: ctx.event, timestamp: ctx.timestamp.toISOString(), ...ctx.data }) + '\n';
          fs.appendFileSync(logPath, entry);
        },
      },
      {
        id: 'portfolio-snapshot',
        events: ['portfolio:changed'],
        priority: 90,
        handler: async (ctx) => {
          const dir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'snapshots');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const file = `portfolio_${ctx.timestamp.toISOString().replace(/[:.]/g, '-')}.json`;
          fs.writeFileSync(path.join(dir, file), JSON.stringify(ctx.data, null, 2));
        },
      },
      {
        id: 'risk-alert',
        events: ['risk:warning'],
        priority: 200,
        handler: async (ctx) => {
          logger.warn(`⚠️ RISK WARNING: ${ctx.data.message || 'Risk limit approached'}`, ctx.data);
        },
      },
      {
        id: 'session-memory',
        events: ['session:end'],
        priority: 80,
        handler: async (ctx) => {
          const dir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'workspace', 'memory');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const date = ctx.timestamp.toISOString().split('T')[0];
          const entry = `\n## Session End - ${ctx.timestamp.toLocaleTimeString()}\n${ctx.data.summary || 'Session ended.'}\n`;
          fs.appendFileSync(path.join(dir, `${date}.md`), entry);
        },
      },
      {
        id: 'signal-logger',
        events: ['signal:received'],
        priority: 85,
        handler: async (ctx) => {
          const logPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'logs', 'signals.log');
          const dir = path.dirname(logPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const entry = JSON.stringify({ timestamp: ctx.timestamp.toISOString(), signal: ctx.data }) + '\n';
          fs.appendFileSync(logPath, entry);
        },
      },
      {
        id: 'market-hours',
        events: ['market:open', 'market:close'],
        priority: 75,
        handler: async (ctx) => {
          const logPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'logs', 'market-hours.log');
          const dir = path.dirname(logPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const eventType = ctx.event === 'market:open' ? '🟢 OPEN' : '🔴 CLOSE';
          const entry = JSON.stringify({ event: eventType, market: ctx.data.market, timestamp: ctx.timestamp.toISOString() }) + '\n';
          fs.appendFileSync(logPath, entry);
          logger.info(`${eventType}: ${ctx.data.market || 'Unknown'}`);
        },
      },
      {
        id: 'daily-pnl',
        events: ['market:close', 'session:end'],
        priority: 70,
        handler: async (ctx) => {
          if (ctx.event === 'session:end' && !ctx.data.generatePnl) return;
          const dir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'reports', 'daily');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const date = ctx.timestamp.toISOString().split('T')[0];
          const pnl = ctx.data.pnl || { realized: 0, unrealized: 0, trades: 0, winRate: 0 };
          const emoji = (pnl.realized || 0) >= 0 ? '📈' : '📉';
          const report = `# Daily P&L Report - ${date}\n\n${emoji} **Net P&L:** $${(pnl.realized || 0).toFixed(2)}\n`;
          fs.writeFileSync(path.join(dir, `pnl_${date}.md`), report);
        },
      },
      {
        id: 'onboarding-complete',
        events: ['onboarding:complete'],
        priority: 100,
        handler: async (ctx) => {
          logger.info(`🎉 Onboarding complete for ${ctx.data.userName || 'Trader'}!`);
          const dir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'onboarding.json'), JSON.stringify({
            completedAt: ctx.timestamp.toISOString(),
            userName: ctx.data.userName,
            goals: ctx.data.goals,
            markets: ctx.data.markets,
          }, null, 2));
        },
      },
      {
        id: 'alert-tracker',
        events: ['alert:triggered'],
        priority: 95,
        handler: async (ctx) => {
          const dir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'alerts');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const date = ctx.timestamp.toISOString().split('T')[0];
          const entry = JSON.stringify({ id: ctx.data.alertId, timestamp: ctx.timestamp.toISOString(), ...ctx.data }) + '\n';
          fs.appendFileSync(path.join(dir, `alerts_${date}.jsonl`), entry);
        },
      },
      {
        id: 'config-watcher',
        events: ['config:changed'],
        priority: 100,
        handler: async (ctx) => {
          const dir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'audit');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const ts = ctx.timestamp.toISOString().replace(/[:.]/g, '-');
          if (ctx.data.newConfig) {
            fs.writeFileSync(path.join(dir, `config_${ts}.json`), JSON.stringify(ctx.data.newConfig, null, 2));
          }
          logger.info(`⚙️ Config changed: ${ctx.data.reason || 'No reason'}`);
        },
      },
      {
        id: 'position-monitor',
        events: ['trade:executed', 'portfolio:changed'],
        priority: 90,
        handler: async (ctx) => {
          const dir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'positions');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const snapshotPath = path.join(dir, 'position_snapshot.json');
          let prev: Record<string, any> = {};
          if (fs.existsSync(snapshotPath)) {
            try { prev = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8')); } catch (e) {}
          }
          const positions = ctx.data.positions || [];
          for (const pos of positions) {
            const id = pos.id || pos.ticket || `${pos.symbol}_${pos.openTime}`;
            prev[id] = { ...pos, lastUpdated: ctx.timestamp.toISOString() };
          }
          fs.writeFileSync(snapshotPath, JSON.stringify(prev, null, 2));
        },
      },
    ];

    for (const lh of legacyHooks) {
      if (this.hooks.has(lh.id)) continue; // Skip if already loaded from directory
      
      const loadedHook: LoadedHook = {
        id: lh.id,
        name: lh.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: `Legacy bundled hook: ${lh.id}`,
        path: '',
        handlerPath: '',
        enabled: true,
        source: 'bundled',
        metadata: { kit: { events: lh.events, priority: lh.priority } },
        handler: lh.handler,
        events: lh.events,
        priority: lh.priority,
        emoji: '🪝',
      };
      
      this.register(loadedHook);
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let registry: HookRegistry | null = null;

export function getHookRegistry(): HookRegistry {
  if (!registry) {
    registry = new HookRegistry();
  }
  return registry;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convenience function to emit a trading event
 */
export async function emitTradingEvent(
  event: HookEvent,
  data: Record<string, any>,
  agentId?: string
): Promise<HookResult[]> {
  return getHookRegistry().emit(event, data, agentId);
}

/**
 * Create a custom hook
 */
export function createHook(
  id: string,
  name: string,
  events: HookEvent[],
  handler: HookHandler,
  options?: {
    description?: string;
    version?: string;
    author?: string;
    enabled?: boolean;
    priority?: number;
  }
): LoadedHook {
  return {
    id,
    name,
    description: options?.description || `Custom hook: ${name}`,
    version: options?.version || '1.0.0',
    author: options?.author,
    path: '',
    handlerPath: '',
    enabled: options?.enabled ?? true,
    source: 'workspace',
    metadata: {
      kit: {
        events,
        priority: options?.priority,
      },
    },
    handler,
    events,
    priority: options?.priority || 0,
    emoji: '🪝',
  };
}

// Initialize on first import (lazy)
export async function initializeHooks(): Promise<void> {
  await getHookRegistry().initialize();
}
