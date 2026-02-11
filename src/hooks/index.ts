/**
 * K.I.T. Hooks System
 * 
 * Event-driven automation for trading events, portfolio changes, and lifecycle events.
 * Inspired by OpenClaw's hooks architecture.
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
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../core/logger';

const logger = createLogger('hooks');

// ============================================================================
// Types
// ============================================================================

export type HookEvent = 
  | 'trade:executed'
  | 'trade:closed'
  | 'portfolio:changed'
  | 'alert:triggered'
  | 'session:start'
  | 'session:end'
  | 'signal:received'
  | 'risk:warning'
  | 'market:open'
  | 'market:close'
  | 'onboarding:complete'
  | 'config:changed';

export interface HookContext {
  event: HookEvent;
  timestamp: Date;
  data: Record<string, any>;
  kitVersion: string;
  agentId: string;
}

export interface HookMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  events: HookEvent[];
  enabled: boolean;
  priority?: number; // Higher = runs first
}

export interface Hook extends HookMetadata {
  handler: HookHandler;
}

export type HookHandler = (context: HookContext) => Promise<void> | void;

export interface HookResult {
  hookId: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

// ============================================================================
// Hook Registry
// ============================================================================

class HookRegistry {
  private hooks: Map<string, Hook> = new Map();
  private hooksByEvent: Map<HookEvent, Hook[]> = new Map();
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'hooks.json');
  }

  /**
   * Register a hook
   */
  register(hook: Hook): void {
    this.hooks.set(hook.id, hook);
    
    // Index by event
    for (const event of hook.events) {
      if (!this.hooksByEvent.has(event)) {
        this.hooksByEvent.set(event, []);
      }
      const hooks = this.hooksByEvent.get(event)!;
      hooks.push(hook);
      // Sort by priority (higher first)
      hooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
    
    logger.info(`Registered hook: ${hook.id} for events: ${hook.events.join(', ')}`);
  }

  /**
   * Unregister a hook
   */
  unregister(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;
    
    this.hooks.delete(hookId);
    
    for (const event of hook.events) {
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
  getAll(): Hook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get hooks for a specific event
   */
  getForEvent(event: HookEvent): Hook[] {
    return this.hooksByEvent.get(event) || [];
  }

  /**
   * Get a specific hook
   */
  get(hookId: string): Hook | undefined {
    return this.hooks.get(hookId);
  }

  /**
   * Emit an event to all registered hooks
   */
  async emit(event: HookEvent, data: Record<string, any> = {}, agentId: string = 'main'): Promise<HookResult[]> {
    const hooks = this.getForEvent(event).filter(h => h.enabled);
    const results: HookResult[] = [];
    
    const context: HookContext = {
      event,
      timestamp: new Date(),
      data,
      kitVersion: '2.0.0',
      agentId,
    };
    
    for (const hook of hooks) {
      const start = Date.now();
      try {
        await hook.handler(context);
        results.push({
          hookId: hook.id,
          success: true,
          durationMs: Date.now() - start,
        });
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
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        for (const [hookId, enabled] of Object.entries(config.enabled || {})) {
          const hook = this.hooks.get(hookId);
          if (hook) hook.enabled = enabled as boolean;
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
      
      const config = {
        enabled: Object.fromEntries(
          Array.from(this.hooks.entries()).map(([id, hook]) => [id, hook.enabled])
        ),
      };
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      logger.warn('Failed to save hooks config:', error);
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
    registerBundledHooks(registry);
    registry.loadConfig();
  }
  return registry;
}

// ============================================================================
// Bundled Hooks
// ============================================================================

function registerBundledHooks(registry: HookRegistry): void {
  // Trade Logger - logs all trades to file
  registry.register({
    id: 'trade-logger',
    name: 'Trade Logger',
    description: 'Logs all executed and closed trades to ~/.kit/logs/trades.log',
    version: '1.0.0',
    events: ['trade:executed', 'trade:closed'],
    enabled: true,
    priority: 100,
    handler: async (ctx) => {
      const logPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'logs', 'trades.log');
      const dir = path.dirname(logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const entry = JSON.stringify({
        event: ctx.event,
        timestamp: ctx.timestamp.toISOString(),
        ...ctx.data,
      }) + '\n';
      
      fs.appendFileSync(logPath, entry);
    },
  });

  // Portfolio Snapshot - saves portfolio state on changes
  registry.register({
    id: 'portfolio-snapshot',
    name: 'Portfolio Snapshot',
    description: 'Saves portfolio snapshots when significant changes occur',
    version: '1.0.0',
    events: ['portfolio:changed'],
    enabled: true,
    priority: 90,
    handler: async (ctx) => {
      const snapshotDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'snapshots');
      if (!fs.existsSync(snapshotDir)) {
        fs.mkdirSync(snapshotDir, { recursive: true });
      }
      
      const filename = `portfolio_${ctx.timestamp.toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(
        path.join(snapshotDir, filename),
        JSON.stringify(ctx.data, null, 2)
      );
    },
  });

  // Risk Alert - notifies on risk warnings
  registry.register({
    id: 'risk-alert',
    name: 'Risk Alert Handler',
    description: 'Handles risk warning events (could integrate with notifications)',
    version: '1.0.0',
    events: ['risk:warning'],
    enabled: true,
    priority: 200, // High priority for risk events
    handler: async (ctx) => {
      logger.warn(`⚠️ RISK WARNING: ${ctx.data.message || 'Risk limit approached'}`, ctx.data);
      // TODO: Could integrate with Telegram/Discord notifications
    },
  });

  // Session Memory - saves context at session end
  registry.register({
    id: 'session-memory',
    name: 'Session Memory',
    description: 'Saves session context to memory when trading session ends',
    version: '1.0.0',
    events: ['session:end'],
    enabled: true,
    priority: 80,
    handler: async (ctx) => {
      const memoryDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'workspace', 'memory');
      if (!fs.existsSync(memoryDir)) {
        fs.mkdirSync(memoryDir, { recursive: true });
      }
      
      const date = ctx.timestamp.toISOString().split('T')[0];
      const memoryPath = path.join(memoryDir, `${date}.md`);
      
      const entry = `\n## Session End - ${ctx.timestamp.toLocaleTimeString()}\n${ctx.data.summary || 'Session ended.'}\n`;
      fs.appendFileSync(memoryPath, entry);
    },
  });

  // Signal Logger - tracks received signals
  registry.register({
    id: 'signal-logger',
    name: 'Signal Logger',
    description: 'Logs all received trading signals for analysis',
    version: '1.0.0',
    events: ['signal:received'],
    enabled: true,
    priority: 85,
    handler: async (ctx) => {
      const logPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'logs', 'signals.log');
      const dir = path.dirname(logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const entry = JSON.stringify({
        timestamp: ctx.timestamp.toISOString(),
        signal: ctx.data,
      }) + '\n';
      
      fs.appendFileSync(logPath, entry);
    },
  });

  // Market Hours Logger - tracks market open/close events
  registry.register({
    id: 'market-hours',
    name: 'Market Hours Logger',
    description: 'Logs market open/close events for session analysis',
    version: '1.0.0',
    events: ['market:open', 'market:close'],
    enabled: true,
    priority: 75,
    handler: async (ctx) => {
      const logPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'logs', 'market-hours.log');
      const dir = path.dirname(logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const marketName = ctx.data.market || 'Unknown';
      const eventType = ctx.event === 'market:open' ? '🟢 OPEN' : '🔴 CLOSE';
      const entry = JSON.stringify({
        event: eventType,
        market: marketName,
        timestamp: ctx.timestamp.toISOString(),
        timezone: ctx.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...ctx.data,
      }) + '\n';
      
      fs.appendFileSync(logPath, entry);
      logger.info(`${eventType}: ${marketName} at ${ctx.timestamp.toLocaleTimeString()}`);
    },
  });

  // Daily P&L Summary - creates end-of-day P&L report
  registry.register({
    id: 'daily-pnl',
    name: 'Daily P&L Summary',
    description: 'Generates daily profit/loss summary when market closes',
    version: '1.0.0',
    events: ['market:close', 'session:end'],
    enabled: true,
    priority: 70,
    handler: async (ctx) => {
      // Only generate summary at market close or explicit session end
      if (ctx.event === 'session:end' && !ctx.data.generatePnl) return;
      
      const reportsDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'reports', 'daily');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const date = ctx.timestamp.toISOString().split('T')[0];
      const reportPath = path.join(reportsDir, `pnl_${date}.md`);
      
      // Build P&L summary from context data
      const pnl = ctx.data.pnl || { realized: 0, unrealized: 0, trades: 0, winRate: 0 };
      const emoji = (pnl.realized || 0) >= 0 ? '📈' : '📉';
      
      const report = `# Daily P&L Report - ${date}

${emoji} **Net P&L:** $${(pnl.realized || 0).toFixed(2)}

## Summary
- **Realized P&L:** $${(pnl.realized || 0).toFixed(2)}
- **Unrealized P&L:** $${(pnl.unrealized || 0).toFixed(2)}
- **Total Trades:** ${pnl.trades || 0}
- **Win Rate:** ${((pnl.winRate || 0) * 100).toFixed(1)}%

## Markets
${ctx.data.market ? `- ${ctx.data.market}` : '- All markets'}

---
*Generated by K.I.T. at ${ctx.timestamp.toISOString()}*
`;
      
      fs.writeFileSync(reportPath, report);
      logger.info(`📊 Daily P&L report saved: ${reportPath}`);
    },
  });

  // Onboarding Complete - runs after user completes setup
  registry.register({
    id: 'onboarding-complete',
    name: 'Onboarding Complete Handler',
    description: 'Runs after user completes K.I.T. onboarding wizard',
    version: '1.0.0',
    events: ['onboarding:complete'],
    enabled: true,
    priority: 100,
    handler: async (ctx) => {
      const userName = ctx.data.userName || 'Trader';
      logger.info(`🎉 Onboarding complete for ${userName}!`);
      
      // Save onboarding timestamp
      const configDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      const onboardingLog = path.join(configDir, 'onboarding.json');
      const record = {
        completedAt: ctx.timestamp.toISOString(),
        userName,
        goals: ctx.data.goals || [],
        markets: ctx.data.markets || [],
        riskProfile: ctx.data.riskProfile || 'moderate',
      };
      
      fs.writeFileSync(onboardingLog, JSON.stringify(record, null, 2));
    },
  });
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
): Hook {
  return {
    id,
    name,
    description: options?.description || `Custom hook: ${name}`,
    version: options?.version || '1.0.0',
    author: options?.author,
    events,
    enabled: options?.enabled ?? true,
    priority: options?.priority,
    handler,
  };
}

// Export types for external use
export { HookRegistry };
