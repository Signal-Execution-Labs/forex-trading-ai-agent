/**
 * K.I.T. Strategy Management Tools
 * 
 * When a user gives K.I.T. a trading strategy, K.I.T. should:
 * 1. Save the strategy (strategy_save)
 * 2. Automatically start the auto-trader (strategy_start)
 * 3. Run 24/7 without user intervention
 * 
 * The user just says "trade XAUUSD when RSI < 30" and K.I.T. handles everything.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';

// ============================================================================
// Strategy Tool Definitions
// ============================================================================

export const STRATEGY_TOOLS: ChatToolDef[] = [
  {
    name: 'strategy_save',
    description: 'Save a trading strategy. K.I.T. should call this AUTOMATICALLY when a user describes a trading strategy. The strategy will be persisted and can be auto-executed.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Strategy name (e.g., "XAUUSD_RSI_Strategy")',
        },
        asset: {
          type: 'string',
          description: 'Trading asset/symbol (e.g., XAUUSD, EURUSD, BTCUSDT)',
        },
        market: {
          type: 'string',
          enum: ['forex', 'crypto', 'stocks', 'commodities', 'indices'],
          description: 'Market type',
        },
        platform: {
          type: 'string',
          enum: ['mt5', 'binance', 'bybit', 'coinbase', 'interactive_brokers'],
          description: 'Trading platform to execute on',
        },
        entry_conditions: {
          type: 'string',
          description: 'When to enter a trade (in plain language or technical terms)',
        },
        exit_conditions: {
          type: 'string',
          description: 'When to exit a trade',
        },
        direction: {
          type: 'string',
          enum: ['long_only', 'short_only', 'both'],
          description: 'Trading direction',
        },
        position_size: {
          type: 'string',
          description: 'Position size (e.g., "0.01 lots", "100 USDT", "1% of balance")',
        },
        stop_loss: {
          type: 'string',
          description: 'Stop loss rule (e.g., "50 pips", "2%", "below support")',
        },
        take_profit: {
          type: 'string',
          description: 'Take profit rule (e.g., "100 pips", "1:2 RR", "at resistance")',
        },
        max_positions: {
          type: 'number',
          description: 'Maximum concurrent positions (default: 1)',
        },
        max_daily_trades: {
          type: 'number',
          description: 'Maximum trades per day (default: unlimited)',
        },
        trading_hours: {
          type: 'string',
          description: 'When to trade (e.g., "24/7", "London session", "09:00-17:00 UTC")',
        },
        risk_per_trade: {
          type: 'string',
          description: 'Risk per trade (e.g., "1% of balance", "max $50")',
        },
        notes: {
          type: 'string',
          description: 'Additional notes or rules',
        },
      },
      required: ['name', 'asset', 'platform', 'entry_conditions', 'position_size'],
    },
  },
  {
    name: 'strategy_start',
    description: 'Start auto-trading a saved strategy. K.I.T. should call this AUTOMATICALLY after saving a strategy. This sets up 24/7 automated execution.',
    parameters: {
      type: 'object',
      properties: {
        strategy_name: {
          type: 'string',
          description: 'Name of the strategy to start',
        },
        check_interval_minutes: {
          type: 'number',
          description: 'How often to check conditions (default: 5 minutes)',
        },
      },
      required: ['strategy_name'],
    },
  },
  {
    name: 'strategy_stop',
    description: 'Stop auto-trading a strategy',
    parameters: {
      type: 'object',
      properties: {
        strategy_name: {
          type: 'string',
          description: 'Name of the strategy to stop',
        },
      },
      required: ['strategy_name'],
    },
  },
  {
    name: 'strategy_list',
    description: 'List all saved strategies and their status (running/stopped)',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'strategy_evaluate',
    description: 'Manually evaluate a strategy right now (check conditions and trade if met). Called automatically by the scheduler.',
    parameters: {
      type: 'object',
      properties: {
        strategy_name: {
          type: 'string',
          description: 'Name of the strategy to evaluate',
        },
      },
      required: ['strategy_name'],
    },
  },
];

// ============================================================================
// Strategy Storage
// ============================================================================

interface Strategy {
  name: string;
  asset: string;
  market: string;
  platform: string;
  entry_conditions: string;
  exit_conditions?: string;
  direction: string;
  position_size: string;
  stop_loss?: string;
  take_profit?: string;
  max_positions: number;
  max_daily_trades?: number;
  trading_hours: string;
  risk_per_trade?: string;
  notes?: string;
  status: 'running' | 'stopped';
  check_interval_minutes: number;
  created_at: string;
  last_check?: string;
  trades_today: number;
}

function getStrategiesPath(): string {
  const workspacePath = process.env.KIT_WORKSPACE || path.join(process.cwd(), 'workspace');
  return path.join(workspacePath, 'strategies.json');
}

function loadStrategies(): Record<string, Strategy> {
  const filePath = getStrategiesPath();
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return {};
}

function saveStrategies(strategies: Record<string, Strategy>): void {
  const filePath = getStrategiesPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(strategies, null, 2));
}

// ============================================================================
// Auto-Trading Scheduler
// ============================================================================

const runningIntervals: Map<string, NodeJS.Timeout> = new Map();

async function evaluateStrategy(strategyName: string): Promise<string> {
  const strategies = loadStrategies();
  const strategy = strategies[strategyName];
  
  if (!strategy) {
    return `Strategy "${strategyName}" not found`;
  }
  
  if (strategy.status !== 'running') {
    return `Strategy "${strategyName}" is not running`;
  }
  
  // Update last check time
  strategy.last_check = new Date().toISOString();
  saveStrategies(strategies);
  
  // Return evaluation request for the AI to process
  // The AI will use MT5/exchange tools to check conditions and execute
  return JSON.stringify({
    action: 'evaluate',
    strategy: strategy,
    instruction: `Evaluate strategy "${strategy.name}" NOW:
    
Asset: ${strategy.asset}
Platform: ${strategy.platform}
Entry Conditions: ${strategy.entry_conditions}
Exit Conditions: ${strategy.exit_conditions || 'Use SL/TP'}
Direction: ${strategy.direction}
Position Size: ${strategy.position_size}
Stop Loss: ${strategy.stop_loss || 'None specified'}
Take Profit: ${strategy.take_profit || 'None specified'}
Max Positions: ${strategy.max_positions}
Trades Today: ${strategy.trades_today}
Max Daily: ${strategy.max_daily_trades || 'Unlimited'}

STEPS:
1. Get current price for ${strategy.asset}
2. Check current open positions
3. Evaluate if entry conditions are met
4. If conditions met AND under max positions AND under daily limit: EXECUTE TRADE
5. Check if any positions should be closed based on exit conditions
6. Report what you did`
  });
}

function startStrategyScheduler(strategyName: string, intervalMinutes: number): void {
  // Stop existing scheduler if any
  if (runningIntervals.has(strategyName)) {
    clearInterval(runningIntervals.get(strategyName)!);
  }
  
  // Start new scheduler
  const intervalMs = intervalMinutes * 60 * 1000;
  const interval = setInterval(async () => {
    console.log(`[K.I.T. Strategy] Evaluating ${strategyName}...`);
    // This will be picked up by the gateway to process
    const result = await evaluateStrategy(strategyName);
    console.log(`[K.I.T. Strategy] ${strategyName}: ${result}`);
  }, intervalMs);
  
  runningIntervals.set(strategyName, interval);
  console.log(`[K.I.T. Strategy] Started ${strategyName} - checking every ${intervalMinutes} minutes`);
}

function stopStrategyScheduler(strategyName: string): void {
  if (runningIntervals.has(strategyName)) {
    clearInterval(runningIntervals.get(strategyName)!);
    runningIntervals.delete(strategyName);
    console.log(`[K.I.T. Strategy] Stopped ${strategyName}`);
  }
}

// ============================================================================
// Tool Handlers
// ============================================================================

export const STRATEGY_TOOL_HANDLERS: Record<string, (args: any) => Promise<any>> = {
  strategy_save: async (args) => {
    const strategies = loadStrategies();
    
    const strategy: Strategy = {
      name: args.name,
      asset: args.asset.toUpperCase(),
      market: args.market || 'forex',
      platform: args.platform || 'mt5',
      entry_conditions: args.entry_conditions,
      exit_conditions: args.exit_conditions,
      direction: args.direction || 'both',
      position_size: args.position_size,
      stop_loss: args.stop_loss,
      take_profit: args.take_profit,
      max_positions: args.max_positions || 1,
      max_daily_trades: args.max_daily_trades,
      trading_hours: args.trading_hours || '24/7',
      risk_per_trade: args.risk_per_trade,
      notes: args.notes,
      status: 'stopped',
      check_interval_minutes: 5,
      created_at: new Date().toISOString(),
      trades_today: 0,
    };
    
    strategies[args.name] = strategy;
    saveStrategies(strategies);
    
    return {
      success: true,
      message: `✅ Strategy "${args.name}" saved!`,
      strategy: strategy,
      next_step: 'Call strategy_start to begin 24/7 auto-trading',
    };
  },
  
  strategy_start: async (args) => {
    const strategies = loadStrategies();
    const strategy = strategies[args.strategy_name];
    
    if (!strategy) {
      return { success: false, error: `Strategy "${args.strategy_name}" not found` };
    }
    
    const interval = args.check_interval_minutes || 5;
    strategy.status = 'running';
    strategy.check_interval_minutes = interval;
    saveStrategies(strategies);
    
    startStrategyScheduler(args.strategy_name, interval);
    
    return {
      success: true,
      message: `🚀 Strategy "${args.strategy_name}" is now LIVE!`,
      details: {
        asset: strategy.asset,
        platform: strategy.platform,
        check_interval: `Every ${interval} minutes`,
        status: '24/7 AUTO-TRADING ACTIVE',
      },
      note: 'K.I.T. will automatically check conditions and execute trades. You can relax! 😎',
    };
  },
  
  strategy_stop: async (args) => {
    const strategies = loadStrategies();
    const strategy = strategies[args.strategy_name];
    
    if (!strategy) {
      return { success: false, error: `Strategy "${args.strategy_name}" not found` };
    }
    
    strategy.status = 'stopped';
    saveStrategies(strategies);
    stopStrategyScheduler(args.strategy_name);
    
    return {
      success: true,
      message: `⏹️ Strategy "${args.strategy_name}" stopped`,
    };
  },
  
  strategy_list: async () => {
    const strategies = loadStrategies();
    const list = Object.values(strategies).map(s => ({
      name: s.name,
      asset: s.asset,
      platform: s.platform,
      status: s.status,
      check_interval: `${s.check_interval_minutes} min`,
      trades_today: s.trades_today,
      last_check: s.last_check,
    }));
    
    if (list.length === 0) {
      return { strategies: [], message: 'No strategies saved yet. Tell me your trading strategy!' };
    }
    
    return { strategies: list };
  },
  
  strategy_evaluate: async (args) => {
    return await evaluateStrategy(args.strategy_name);
  },
};

// ============================================================================
// Initialize - Restart running strategies on startup
// ============================================================================

export function initializeStrategies(): void {
  const strategies = loadStrategies();
  
  for (const [name, strategy] of Object.entries(strategies)) {
    if (strategy.status === 'running') {
      console.log(`[K.I.T.] Resuming strategy: ${name}`);
      startStrategyScheduler(name, strategy.check_interval_minutes);
    }
  }
  
  // Reset daily trade counters at midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();
  
  setTimeout(() => {
    const strats = loadStrategies();
    for (const strategy of Object.values(strats)) {
      strategy.trades_today = 0;
    }
    saveStrategies(strats);
    console.log('[K.I.T.] Daily trade counters reset');
    
    // Set up daily reset
    setInterval(() => {
      const s = loadStrategies();
      for (const strategy of Object.values(s)) {
        strategy.trades_today = 0;
      }
      saveStrategies(s);
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

/**
 * Register strategy tools
 */
export function registerStrategyTools(registry: Map<string, any>): void {
  for (const tool of STRATEGY_TOOLS) {
    registry.set(tool.name, {
      definition: tool,
      handler: STRATEGY_TOOL_HANDLERS[tool.name],
      category: 'trading',
      enabled: true,
    });
  }
}
