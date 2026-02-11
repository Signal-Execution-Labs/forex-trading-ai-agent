/**
 * K.I.T. Strategy Management Tools
 * 
 * REAL 24/7 AUTO-TRADING - Not just logging, actually executes trades!
 * 
 * When a user gives K.I.T. a strategy, K.I.T. should:
 * 1. Save the strategy (strategy_save)
 * 2. Automatically start the auto-trader (strategy_start)
 * 3. Run 24/7 - checking indicators and executing trades DIRECTLY
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
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
        direction: {
          type: 'string',
          enum: ['long_only', 'short_only', 'both'],
          description: 'Trading direction',
        },
        lot_size: {
          type: 'number',
          description: 'Fixed lot size (e.g., 0.01). If not set, uses risk-based sizing.',
        },
        risk_percent: {
          type: 'number',
          description: 'Risk per trade as % of balance (e.g., 1 for 1%)',
        },
        sl_atr_multiplier: {
          type: 'number',
          description: 'Stop loss as ATR multiplier (e.g., 1.5)',
        },
        tp_atr_multiplier: {
          type: 'number',
          description: 'Take profit as ATR multiplier (e.g., 3.0)',
        },
        ema_fast: {
          type: 'number',
          description: 'Fast EMA period (default: 21)',
        },
        ema_slow: {
          type: 'number',
          description: 'Slow EMA period (default: 50)',
        },
        rsi_period: {
          type: 'number',
          description: 'RSI period (default: 14)',
        },
        rsi_buy_above: {
          type: 'number',
          description: 'RSI must be above this for BUY (default: 55)',
        },
        rsi_sell_below: {
          type: 'number',
          description: 'RSI must be below this for SELL (default: 45)',
        },
        timeframe: {
          type: 'string',
          enum: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'],
          description: 'Chart timeframe (default: M5)',
        },
        max_positions: {
          type: 'number',
          description: 'Maximum concurrent positions (default: 1)',
        },
        max_daily_trades: {
          type: 'number',
          description: 'Maximum trades per day (default: 10)',
        },
        max_spread: {
          type: 'number',
          description: 'Maximum allowed spread in points (default: 50)',
        },
        trailing_stop_atr: {
          type: 'number',
          description: 'Activate trailing stop after this ATR profit (e.g., 1.5)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the strategy',
        },
      },
      required: ['name', 'asset', 'platform'],
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
    name: 'strategy_status',
    description: 'Get detailed status of a strategy including recent trades',
    parameters: {
      type: 'object',
      properties: {
        strategy_name: {
          type: 'string',
          description: 'Name of the strategy',
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
  direction: string;
  lot_size?: number;
  risk_percent: number;
  sl_atr_multiplier: number;
  tp_atr_multiplier: number;
  ema_fast: number;
  ema_slow: number;
  rsi_period: number;
  rsi_buy_above: number;
  rsi_sell_below: number;
  timeframe: string;
  max_positions: number;
  max_daily_trades: number;
  max_spread: number;
  trailing_stop_atr?: number;
  notes?: string;
  status: 'running' | 'stopped';
  check_interval_minutes: number;
  created_at: string;
  last_check?: string;
  last_signal?: string;
  trades_today: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  recent_trades: TradeRecord[];
}

interface TradeRecord {
  timestamp: string;
  type: 'buy' | 'sell';
  price: number;
  lot: number;
  sl: number;
  tp: number;
  ticket?: number;
  result?: 'win' | 'loss' | 'open';
  profit?: number;
}

function getStrategiesPath(): string {
  const workspacePath = process.env.KIT_WORKSPACE || path.join(process.cwd(), 'workspace');
  return path.join(workspacePath, 'strategies.json');
}

function loadStrategies(): Record<string, Strategy> {
  const filePath = getStrategiesPath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return {};
    }
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
// MT5 Direct Execution (No AI needed for each trade!)
// ============================================================================

function execMT5(command: string): any {
  const possiblePaths = [
    path.join(__dirname, '../../skills/metatrader/scripts/auto_connect.py'),
    path.join(__dirname, '../../../skills/metatrader/scripts/auto_connect.py'),
    path.join(process.cwd(), 'skills/metatrader/scripts/auto_connect.py'),
  ];
  
  const scriptPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
  
  if (!fs.existsSync(scriptPath)) {
    return { success: false, error: 'MT5 script not found' };
  }
  
  try {
    const result = execSync(`python "${scriptPath}" ${command}`, {
      encoding: 'utf-8',
      timeout: 30000,
      windowsHide: true,
    });
    return JSON.parse(result.trim());
  } catch (error: any) {
    return { success: false, error: error.message || 'MT5 execution failed' };
  }
}

// ============================================================================
// Auto-Trading Logic - ACTUALLY EXECUTES TRADES!
// ============================================================================

const runningIntervals: Map<string, NodeJS.Timeout> = new Map();
const tradeLog: string[] = [];

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  tradeLog.push(logMessage);
  if (tradeLog.length > 1000) tradeLog.shift();
}

async function executeStrategyCheck(strategyName: string): Promise<void> {
  const strategies = loadStrategies();
  const strategy = strategies[strategyName];
  
  if (!strategy || strategy.status !== 'running') {
    return;
  }
  
  log(`📊 Checking strategy: ${strategy.name} on ${strategy.asset}`);
  
  // Update last check time
  strategy.last_check = new Date().toISOString();
  
  // Reset daily trades at midnight
  const today = new Date().toISOString().split('T')[0];
  const lastCheckDate = strategy.last_check?.split('T')[0];
  if (lastCheckDate && lastCheckDate !== today) {
    strategy.trades_today = 0;
  }
  
  // Check if we've hit daily limit
  if (strategy.trades_today >= strategy.max_daily_trades) {
    log(`⚠️ Daily trade limit reached (${strategy.max_daily_trades})`);
    saveStrategies(strategies);
    return;
  }
  
  // Get current positions
  const positions = execMT5('positions');
  if (!positions.success) {
    log(`❌ Failed to get positions: ${positions.error}`);
    saveStrategies(strategies);
    return;
  }
  
  // Count positions for this asset
  const assetPositions = (positions.positions || []).filter(
    (p: any) => p.symbol === strategy.asset
  );
  
  if (assetPositions.length >= strategy.max_positions) {
    log(`⏸️ Max positions reached (${assetPositions.length}/${strategy.max_positions})`);
    saveStrategies(strategies);
    return;
  }
  
  // Get indicators
  const indicators = execMT5(`indicators ${strategy.asset} ${strategy.timeframe} 100`);
  if (!indicators.success) {
    log(`❌ Failed to get indicators: ${indicators.error}`);
    saveStrategies(strategies);
    return;
  }
  
  log(`📈 ${strategy.asset}: Price=${indicators.current_price}, EMA21=${indicators.ema21}, EMA50=${indicators.ema50}, RSI=${indicators.rsi}, ATR=${indicators.atr}`);
  log(`📊 Trend: ${indicators.ema_trend}, Signal: BUY=${indicators.signal?.buy}, SELL=${indicators.signal?.sell}`);
  
  // Check spread
  const price = execMT5(`price ${strategy.asset}`);
  if (price.success && price.spread > strategy.max_spread) {
    log(`⚠️ Spread too high: ${price.spread} > ${strategy.max_spread}`);
    saveStrategies(strategies);
    return;
  }
  
  // Determine signal based on strategy settings
  const rsi = indicators.rsi;
  const emaTrend = indicators.ema_trend;
  const pullback = indicators.pullback_to_ema21;
  const emaCrossUp = indicators.ema_cross_up;
  const emaCrossDown = indicators.ema_cross_down;
  
  let signal: 'buy' | 'sell' | null = null;
  
  // BUY conditions: EMA bullish + RSI > threshold + pullback OR EMA cross up
  if (strategy.direction !== 'short_only') {
    if ((emaTrend === 'BULLISH' && rsi > strategy.rsi_buy_above && pullback) || emaCrossUp) {
      signal = 'buy';
    }
  }
  
  // SELL conditions: EMA bearish + RSI < threshold + pullback OR EMA cross down
  if (strategy.direction !== 'long_only') {
    if ((emaTrend === 'BEARISH' && rsi < strategy.rsi_sell_below && pullback) || emaCrossDown) {
      signal = 'sell';
    }
  }
  
  strategy.last_signal = signal || 'none';
  
  if (!signal) {
    log(`⏸️ No signal - waiting...`);
    saveStrategies(strategies);
    return;
  }
  
  log(`🎯 SIGNAL: ${signal.toUpperCase()}!`);
  
  // Calculate position size
  let lotSize = strategy.lot_size || 0.01;
  
  // If risk_percent is set, calculate lot size based on account risk
  if (strategy.risk_percent && !strategy.lot_size) {
    const account = execMT5('connect');
    if (account.success && account.account) {
      const balance = account.account.balance;
      const riskAmount = balance * (strategy.risk_percent / 100);
      const slDistance = indicators.atr * strategy.sl_atr_multiplier;
      // Simplified lot calculation (proper would need pip value)
      lotSize = Math.max(0.01, Math.min(1.0, riskAmount / (slDistance * 100)));
      lotSize = Math.round(lotSize * 100) / 100;
    }
  }
  
  // Calculate SL and TP based on ATR
  const atr = indicators.atr;
  const currentPrice = indicators.current_price;
  
  let sl: number, tp: number;
  
  if (signal === 'buy') {
    sl = Math.round((currentPrice - atr * strategy.sl_atr_multiplier) * 100) / 100;
    tp = Math.round((currentPrice + atr * strategy.tp_atr_multiplier) * 100) / 100;
  } else {
    sl = Math.round((currentPrice + atr * strategy.sl_atr_multiplier) * 100) / 100;
    tp = Math.round((currentPrice - atr * strategy.tp_atr_multiplier) * 100) / 100;
  }
  
  log(`📝 Placing ${signal.toUpperCase()} order: ${lotSize} lots, SL=${sl}, TP=${tp}`);
  
  // EXECUTE THE TRADE!
  const order = execMT5(`${signal} ${strategy.asset} ${lotSize} ${sl} ${tp}`);
  
  if (order.success) {
    log(`✅ ORDER EXECUTED! Ticket: ${order.ticket}, Price: ${order.price}`);
    
    // Record the trade
    const trade: TradeRecord = {
      timestamp: new Date().toISOString(),
      type: signal,
      price: order.price,
      lot: lotSize,
      sl,
      tp,
      ticket: order.ticket,
      result: 'open',
    };
    
    strategy.recent_trades = strategy.recent_trades || [];
    strategy.recent_trades.unshift(trade);
    if (strategy.recent_trades.length > 50) strategy.recent_trades.pop();
    
    strategy.trades_today++;
    strategy.total_trades++;
  } else {
    log(`❌ ORDER FAILED: ${order.error}`);
  }
  
  saveStrategies(strategies);
}

function startStrategyScheduler(strategyName: string, intervalMinutes: number): void {
  // Stop existing scheduler if any
  if (runningIntervals.has(strategyName)) {
    clearInterval(runningIntervals.get(strategyName)!);
  }
  
  log(`🚀 Starting strategy scheduler: ${strategyName} (every ${intervalMinutes} min)`);
  
  // Run immediately on start
  executeStrategyCheck(strategyName);
  
  // Start interval
  const intervalMs = intervalMinutes * 60 * 1000;
  const interval = setInterval(() => {
    executeStrategyCheck(strategyName);
  }, intervalMs);
  
  runningIntervals.set(strategyName, interval);
}

function stopStrategyScheduler(strategyName: string): void {
  if (runningIntervals.has(strategyName)) {
    clearInterval(runningIntervals.get(strategyName)!);
    runningIntervals.delete(strategyName);
    log(`⏹️ Stopped strategy: ${strategyName}`);
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
      direction: args.direction || 'both',
      lot_size: args.lot_size,
      risk_percent: args.risk_percent || 1,
      sl_atr_multiplier: args.sl_atr_multiplier || 1.5,
      tp_atr_multiplier: args.tp_atr_multiplier || 3.0,
      ema_fast: args.ema_fast || 21,
      ema_slow: args.ema_slow || 50,
      rsi_period: args.rsi_period || 14,
      rsi_buy_above: args.rsi_buy_above || 55,
      rsi_sell_below: args.rsi_sell_below || 45,
      timeframe: args.timeframe || 'M5',
      max_positions: args.max_positions || 1,
      max_daily_trades: args.max_daily_trades || 10,
      max_spread: args.max_spread || 50,
      trailing_stop_atr: args.trailing_stop_atr,
      notes: args.notes,
      status: 'stopped',
      check_interval_minutes: 5,
      created_at: new Date().toISOString(),
      trades_today: 0,
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      recent_trades: [],
    };
    
    strategies[args.name] = strategy;
    saveStrategies(strategies);
    
    return {
      success: true,
      message: `✅ Strategie "${args.name}" gespeichert!`,
      strategy: {
        name: strategy.name,
        asset: strategy.asset,
        timeframe: strategy.timeframe,
        direction: strategy.direction,
        risk: `${strategy.risk_percent}% pro Trade`,
        sl: `${strategy.sl_atr_multiplier}x ATR`,
        tp: `${strategy.tp_atr_multiplier}x ATR`,
        ema: `EMA ${strategy.ema_fast}/${strategy.ema_slow}`,
        rsi: `RSI ${strategy.rsi_period} (Buy>${strategy.rsi_buy_above}, Sell<${strategy.rsi_sell_below})`,
      },
      next_step: 'Rufe strategy_start auf um 24/7 Auto-Trading zu starten!',
    };
  },
  
  strategy_start: async (args) => {
    const strategies = loadStrategies();
    const strategy = strategies[args.strategy_name];
    
    if (!strategy) {
      return { success: false, error: `Strategie "${args.strategy_name}" nicht gefunden` };
    }
    
    const interval = args.check_interval_minutes || 5;
    strategy.status = 'running';
    strategy.check_interval_minutes = interval;
    saveStrategies(strategies);
    
    startStrategyScheduler(args.strategy_name, interval);
    
    return {
      success: true,
      message: `🚀 Strategie "${args.strategy_name}" ist jetzt LIVE!`,
      details: {
        asset: strategy.asset,
        timeframe: strategy.timeframe,
        check_interval: `Alle ${interval} Minuten`,
        direction: strategy.direction,
        risk: `${strategy.risk_percent}% pro Trade`,
        status: '24/7 AUTO-TRADING AKTIV',
      },
      note: 'ICH (K.I.T.) überwache jetzt den Markt und führe Trades automatisch aus. Du kannst dich zurücklehnen! 😎',
    };
  },
  
  strategy_stop: async (args) => {
    const strategies = loadStrategies();
    const strategy = strategies[args.strategy_name];
    
    if (!strategy) {
      return { success: false, error: `Strategie "${args.strategy_name}" nicht gefunden` };
    }
    
    strategy.status = 'stopped';
    saveStrategies(strategies);
    stopStrategyScheduler(args.strategy_name);
    
    return {
      success: true,
      message: `⏹️ Strategie "${args.strategy_name}" gestoppt`,
      stats: {
        total_trades: strategy.total_trades,
        trades_today: strategy.trades_today,
      },
    };
  },
  
  strategy_list: async () => {
    const strategies = loadStrategies();
    const list = Object.values(strategies).map(s => ({
      name: s.name,
      asset: s.asset,
      timeframe: s.timeframe,
      status: s.status === 'running' ? '🟢 LIVE' : '⏹️ Gestoppt',
      check_interval: `${s.check_interval_minutes} min`,
      trades_today: s.trades_today,
      total_trades: s.total_trades,
      last_check: s.last_check,
      last_signal: s.last_signal,
    }));
    
    if (list.length === 0) {
      return { strategies: [], message: 'Noch keine Strategien. Beschreibe mir deine Trading-Strategie!' };
    }
    
    return { 
      strategies: list,
      running: list.filter(s => s.status === '🟢 LIVE').length,
      stopped: list.filter(s => s.status === '⏹️ Gestoppt').length,
    };
  },
  
  strategy_status: async (args) => {
    const strategies = loadStrategies();
    const strategy = strategies[args.strategy_name];
    
    if (!strategy) {
      return { success: false, error: `Strategie "${args.strategy_name}" nicht gefunden` };
    }
    
    return {
      success: true,
      strategy: {
        name: strategy.name,
        asset: strategy.asset,
        status: strategy.status === 'running' ? '🟢 LIVE' : '⏹️ Gestoppt',
        timeframe: strategy.timeframe,
        direction: strategy.direction,
        settings: {
          ema: `${strategy.ema_fast}/${strategy.ema_slow}`,
          rsi: `${strategy.rsi_period} (B>${strategy.rsi_buy_above}, S<${strategy.rsi_sell_below})`,
          sl: `${strategy.sl_atr_multiplier}x ATR`,
          tp: `${strategy.tp_atr_multiplier}x ATR`,
          risk: `${strategy.risk_percent}%`,
        },
        stats: {
          trades_today: strategy.trades_today,
          total_trades: strategy.total_trades,
          max_daily: strategy.max_daily_trades,
        },
        last_check: strategy.last_check,
        last_signal: strategy.last_signal,
        recent_trades: strategy.recent_trades?.slice(0, 10) || [],
      },
      log: tradeLog.slice(-20),
    };
  },
};

// ============================================================================
// Initialize - Restart running strategies on startup
// ============================================================================

export function initializeStrategies(): void {
  const strategies = loadStrategies();
  
  for (const [name, strategy] of Object.entries(strategies)) {
    if (strategy.status === 'running') {
      log(`🔄 Resuming strategy: ${name}`);
      startStrategyScheduler(name, strategy.check_interval_minutes);
    }
  }
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
