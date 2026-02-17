/**
 * K.I.T. Trading Brain - UNIFIED Strategy & EA System
 * 
 * ONE system to rule them all. No more confusion between multiple files.
 * 
 * Features:
 * - Saves ALL strategies/EAs to ONE file: trading_brain.json
 * - Supports rule-based, AI-based, and hybrid execution
 * - K.I.T. AI parses user strategies into executable rules
 * - Persistent - survives restarts
 * - Full trade logging and statistics
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';

// ============================================================================
// Tool Definitions
// ============================================================================

export const TRADING_BRAIN_TOOLS: ChatToolDef[] = [
  {
    name: 'trading_create',
    description: `Create a trading strategy/EA. K.I.T. will understand ANY strategy and execute it 24/7.
    
Just describe what you want to trade and how - K.I.T. handles the rest!

Examples:
- "Trade gold when EMA21 crosses EMA50, RSI > 55"
- "Scalp EUR/USD during London session"
- "Buy BTC when it drops 5% in a day"
- "Use my custom EMA/RSI/ATR strategy with trailing stop"`,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Strategy name (unique identifier)' },
        asset: { type: 'string', description: 'Trading asset (XAUUSD, EURUSD, BTCUSDT, etc.)' },
        strategy: { type: 'string', description: 'Complete strategy description in plain language' },
        platform: { type: 'string', enum: ['mt5', 'binance', 'bybit'], description: 'Trading platform' },
        timeframe: { type: 'string', enum: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'], description: 'Chart timeframe' },
        mode: { 
          type: 'string', 
          enum: ['rules', 'ai', 'hybrid'],
          description: 'rules=fast deterministic, ai=AI decides, hybrid=rules+AI confirmation'
        },
        // Parsed rules (K.I.T. AI fills these from the strategy description)
        entry_long: { type: 'array', description: 'Conditions for BUY entry', items: { type: 'object' } },
        entry_short: { type: 'array', description: 'Conditions for SELL entry', items: { type: 'object' } },
        // Risk management
        lot_size: { type: 'number', description: 'Fixed lot size (e.g., 0.01)' },
        risk_percent: { type: 'number', description: 'Risk per trade as % of balance' },
        sl_atr: { type: 'number', description: 'Stop Loss as ATR multiplier (e.g., 1.5)' },
        tp_atr: { type: 'number', description: 'Take Profit as ATR multiplier (e.g., 3.0)' },
        trailing_stop: { type: 'boolean', description: 'Enable trailing stop' },
        trailing_atr: { type: 'number', description: 'Activate trailing after X ATR profit' },
        // Limits
        max_spread: { type: 'number', description: 'Max spread in points' },
        max_positions: { type: 'number', description: 'Max concurrent positions' },
        max_daily_trades: { type: 'number', description: 'Max trades per day' },
        check_minutes: { type: 'number', description: 'Check interval in minutes' },
      },
      required: ['name', 'asset', 'strategy'],
    },
  },
  {
    name: 'trading_start',
    description: 'Start a trading strategy (runs 24/7 until stopped)',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Strategy name to start' } },
      required: ['name'],
    },
  },
  {
    name: 'trading_stop',
    description: 'Stop a running trading strategy',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Strategy name to stop' } },
      required: ['name'],
    },
  },
  {
    name: 'trading_list',
    description: 'List all trading strategies and their status',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'trading_status',
    description: 'Get detailed status of a strategy including trade log',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Strategy name' } },
      required: ['name'],
    },
  },
  {
    name: 'trading_delete',
    description: 'Delete a trading strategy',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Strategy name to delete' } },
      required: ['name'],
    },
  },
];

// ============================================================================
// Types
// ============================================================================

interface Condition {
  type: string;  // ema_cross, ema_trend, rsi, price, pullback, etc.
  params?: Record<string, any>;
  operator?: string;
  value?: number;
}

interface Trade {
  time: string;
  action: 'buy' | 'sell' | 'close';
  price: number;
  lot: number;
  sl: number;
  tp: number;
  ticket?: number;
  profit?: number;
  reason: string;
}

interface TradingStrategy {
  name: string;
  asset: string;
  strategy: string;  // Original description - NEVER delete this!
  platform: string;
  timeframe: string;
  mode: 'rules' | 'ai' | 'hybrid';
  entry_long: Condition[];
  entry_short: Condition[];
  lot_size?: number;
  risk_percent: number;
  sl_atr: number;
  tp_atr: number;
  trailing_stop: boolean;
  trailing_atr: number;
  max_spread: number;
  max_positions: number;
  max_daily_trades: number;
  check_minutes: number;
  // State
  status: 'running' | 'stopped';
  created: string;
  last_check?: string;
  last_signal?: string;
  trades_today: number;
  total_trades: number;
  wins: number;
  losses: number;
  profit: number;
  trades: Trade[];
}

interface MarketData {
  price: number;
  bid: number;
  ask: number;
  spread: number;
  ema21: number;
  ema50: number;
  rsi: number;
  atr: number;
  trend: string;
  cross_up: boolean;
  cross_down: boolean;
  pullback: boolean;
  positions: any[];
}

// ============================================================================
// Storage - ONE FILE FOR EVERYTHING
// ============================================================================

const DATA_FILE = 'trading_brain.json';

function getDataPath(): string {
  const workspace = process.env.KIT_WORKSPACE || path.join(process.cwd(), 'workspace');
  if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });
  return path.join(workspace, DATA_FILE);
}

function loadAll(): Record<string, TradingStrategy> {
  try {
    const p = getDataPath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      console.log(`[Trading Brain] Loaded ${Object.keys(data).length} strategies from ${p}`);
      return data;
    }
  } catch (e) {
    console.error('[Trading Brain] Load error:', e);
  }
  return {};
}

function saveAll(data: Record<string, TradingStrategy>): void {
  const p = getDataPath();
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  console.log(`[Trading Brain] Saved ${Object.keys(data).length} strategies to ${p}`);
}

// ============================================================================
// MT5 Execution
// ============================================================================

function mt5(cmd: string): any {
  const scripts = [
    path.join(__dirname, '../../skills/metatrader/scripts/auto_connect.py'),
    path.join(__dirname, '../../../skills/metatrader/scripts/auto_connect.py'),
    path.join(process.cwd(), 'skills/metatrader/scripts/auto_connect.py'),
  ];
  const script = scripts.find(p => fs.existsSync(p));
  if (!script) return { success: false, error: 'MT5 script not found' };
  
  try {
    const out = execSync(`python "${script}" ${cmd}`, {
      encoding: 'utf-8', timeout: 30000, windowsHide: true,
    });
    return JSON.parse(out.trim());
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================================
// Condition Evaluator
// ============================================================================

function evalCondition(c: Condition, m: MarketData): boolean {
  switch (c.type) {
    case 'ema_cross':
      return c.params?.direction === 'up' ? m.cross_up : m.cross_down;
    case 'ema_trend':
      return c.params?.direction === 'bullish' ? m.trend === 'BULLISH' : m.trend === 'BEARISH';
    case 'pullback':
      return m.pullback;
    case 'rsi':
      const rsi = m.rsi;
      switch (c.operator) {
        case '>': return rsi > (c.value || 50);
        case '<': return rsi < (c.value || 50);
        case '>=': return rsi >= (c.value || 50);
        case '<=': return rsi <= (c.value || 50);
      }
      break;
    case 'price':
      switch (c.operator) {
        case '>': return m.price > (c.value || 0);
        case '<': return m.price < (c.value || 0);
      }
      break;
  }
  return false;
}

function evalConditions(conditions: Condition[], market: MarketData): boolean {
  if (!conditions || conditions.length === 0) return false;
  return conditions.every(c => evalCondition(c, market));
}

// ============================================================================
// AI Evaluator
// ============================================================================

let aiEval: ((prompt: string) => Promise<string>) | null = null;

export function setTradingAI(fn: (prompt: string) => Promise<string>): void {
  aiEval = fn;
  console.log('[Trading Brain] AI connected');
}

async function askAI(strategy: TradingStrategy, market: MarketData, question: string): Promise<any> {
  if (!aiEval) return null;
  
  const prompt = `Du bist K.I.T., ein Trading-Agent. ${question}

STRATEGIE "${strategy.name}":
${strategy.strategy}

MARKTDATEN ${strategy.asset} (${strategy.timeframe}):
- Preis: ${market.price} (Spread: ${market.spread})
- EMA21: ${market.ema21}, EMA50: ${market.ema50}, Trend: ${market.trend}
- RSI: ${market.rsi}, ATR: ${market.atr}
- Offene Positionen: ${market.positions.length}

Antworte NUR mit JSON!`;

  try {
    const response = await aiEval(prompt);
    const match = response.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Strategy Execution Engine
// ============================================================================

const running: Map<string, NodeJS.Timeout> = new Map();

function log(name: string, msg: string): void {
  console.log(`[${name}] ${new Date().toISOString().split('T')[1].split('.')[0]} ${msg}`);
}

async function runStrategy(name: string): Promise<void> {
  console.log(`[Trading Brain] runStrategy called: ${name}`);
  
  try {
    const all = loadAll();
    const s = all[name];
    
    if (!s) {
      console.log(`[Trading Brain] Strategy not found: ${name}`);
      return;
    }
    
    if (s.status !== 'running') {
      console.log(`[Trading Brain] Strategy not running: ${name} (status=${s.status})`);
      return;
    }
    
    log(name, '📊 Checking...');
    s.last_check = new Date().toISOString();
    console.log(`[Trading Brain] ${name} last_check updated: ${s.last_check}`);
  
  // Reset daily trades at midnight
  const today = s.last_check.split('T')[0];
  const lastTradeDay = s.trades[0]?.time?.split('T')[0];
  if (lastTradeDay && lastTradeDay !== today) s.trades_today = 0;
  
  // Check limits
  if (s.trades_today >= s.max_daily_trades) {
    log(name, '⚠️ Daily limit');
    saveAll(all);
    return;
  }
  
  // Handle multi-asset: split by comma/space/semicolon and use first asset
  // For multiple assets, create separate strategies!
  const assets = s.asset.split(/[,;\s]+/).filter((a: string) => a.trim());
  const currentAsset = assets[0]; // Use first asset
  if (assets.length > 1) {
    log(name, `⚠️ Multi-asset detected. Using first: ${currentAsset} (create separate strategies for each asset)`);
  }
  
  // Get market data
  const price = mt5(`price ${currentAsset}`);
  if (!price.success) { log(name, `❌ ${price.error}`); saveAll(all); return; }
  
  if (price.spread > s.max_spread) {
    log(name, `⚠️ Spread ${price.spread} > ${s.max_spread}`);
    saveAll(all);
    return;
  }
  
  const ind = mt5(`indicators ${currentAsset} ${s.timeframe} 100`);
  if (!ind.success) { log(name, `❌ ${ind.error}`); saveAll(all); return; }
  
  const pos = mt5('positions');
  const myPos = pos.success ? (pos.positions || []).filter((p: any) => p.symbol === currentAsset) : [];
  
  const market: MarketData = {
    price: ind.current_price,
    bid: price.bid,
    ask: price.ask,
    spread: price.spread,
    ema21: ind.ema21,
    ema50: ind.ema50,
    rsi: ind.rsi,
    atr: ind.atr,
    trend: ind.ema_trend,
    cross_up: ind.ema_cross_up,
    cross_down: ind.ema_cross_down,
    pullback: ind.pullback_to_ema21,
    positions: myPos,
  };
  
  log(name, `📈 ${market.price} | EMA ${market.ema21}/${market.ema50} | RSI ${market.rsi} | ATR ${market.atr}`);
  
  // Trailing stop management
  if (s.trailing_stop && myPos.length > 0) {
    for (const p of myPos) {
      const profit = p.type === 'buy' ? (market.price - p.price_open) : (p.price_open - market.price);
      if (profit >= market.atr * s.trailing_atr) {
        const newSL = p.type === 'buy'
          ? Math.round((market.price - market.atr * s.sl_atr) * 100) / 100
          : Math.round((market.price + market.atr * s.sl_atr) * 100) / 100;
        if ((p.type === 'buy' && newSL > p.sl) || (p.type === 'sell' && newSL < p.sl)) {
          log(name, `📈 Trailing SL: ${p.sl} → ${newSL}`);
          mt5(`modify_sl ${p.ticket} ${newSL}`);
        }
      }
    }
  }
  
  // Check max positions
  if (myPos.length >= s.max_positions) {
    log(name, `⏸️ Max positions ${myPos.length}/${s.max_positions}`);
    s.last_signal = 'max_pos';
    saveAll(all);
    return;
  }
  
  // Determine signal based on mode
  let signal: 'buy' | 'sell' | null = null;
  let reason = '';
  
  if (s.mode === 'ai') {
    // Pure AI mode
    const decision = await askAI(s, market, 'Soll ich jetzt traden? Antworte: {"action":"buy"|"sell"|"hold","reason":"..."}');
    if (decision && (decision.action === 'buy' || decision.action === 'sell')) {
      signal = decision.action;
      reason = `AI: ${decision.reason}`;
    }
  } else {
    // Rule-based (or hybrid first step)
    if (s.entry_long?.length > 0 && evalConditions(s.entry_long, market)) {
      signal = 'buy';
      reason = 'Long rules met';
    } else if (s.entry_short?.length > 0 && evalConditions(s.entry_short, market)) {
      signal = 'sell';
      reason = 'Short rules met';
    }
    
    // Hybrid: ask AI to confirm
    if (s.mode === 'hybrid' && signal && aiEval) {
      log(name, `🧠 Rules say ${signal}, asking AI...`);
      const confirm = await askAI(s, market, `Die Regeln sagen ${signal}. Bestätigst du? {"confirm":true|false,"reason":"..."}`);
      if (confirm && !confirm.confirm) {
        log(name, `🧠 AI rejected: ${confirm.reason}`);
        signal = null;
        reason = `AI rejected: ${confirm.reason}`;
      } else if (confirm) {
        reason += ` (AI: ${confirm.reason})`;
      }
    }
  }
  
  s.last_signal = signal || 'none';
  
  if (!signal) {
    log(name, '⏸️ No signal');
    saveAll(all);
    return;
  }
  
  log(name, `🎯 ${signal.toUpperCase()} - ${reason}`);
  
  // Calculate lot
  let lot = s.lot_size || 0.01;
  if (s.risk_percent && !s.lot_size) {
    const acc = mt5('connect');
    if (acc.success) {
      const risk = acc.account.balance * (s.risk_percent / 100);
      lot = Math.max(0.01, Math.min(1.0, risk / (market.atr * s.sl_atr * 100)));
      lot = Math.round(lot * 100) / 100;
    }
  }
  
  // Calculate SL/TP
  const sl = signal === 'buy'
    ? Math.round((market.price - market.atr * s.sl_atr) * 100) / 100
    : Math.round((market.price + market.atr * s.sl_atr) * 100) / 100;
  const tp = signal === 'buy'
    ? Math.round((market.price + market.atr * s.tp_atr) * 100) / 100
    : Math.round((market.price - market.atr * s.tp_atr) * 100) / 100;
  
  log(name, `📝 ${signal} ${lot} lots | SL=${sl} TP=${tp}`);
  
  // EXECUTE!
  const order = mt5(`${signal} ${currentAsset} ${lot} ${sl} ${tp}`);
  
  if (order.success) {
    log(name, `✅ FILLED #${order.ticket} @ ${order.price}`);
    s.trades_today++;
    s.total_trades++;
    s.trades.unshift({
      time: new Date().toISOString(),
      action: signal,
      price: order.price,
      lot, sl, tp,
      ticket: order.ticket,
      reason,
    });
    if (s.trades.length > 500) s.trades.pop();
  } else {
    log(name, `❌ ${order.error}`);
  }
  
  saveAll(all);
  } catch (error: any) {
    console.error(`[Trading Brain] CRITICAL ERROR in ${name}:`, error?.message || error);
    // Still try to save the last_check timestamp to show we attempted
    try {
      const all = loadAll();
      if (all[name]) {
        all[name].last_check = new Date().toISOString();
        saveAll(all);
      }
    } catch (e) {
      // Ignore save errors
    }
  }
}

function start(name: string, minutes: number): void {
  if (running.has(name)) clearInterval(running.get(name)!);
  
  log(name, `🚀 STARTING (every ${minutes}m)`);
  
  // Run immediately with error handling
  runStrategy(name).catch(err => {
    console.error(`[Trading Brain] Error in initial run of ${name}:`, err);
  });
  
  // Set interval with proper error handling
  const interval = setInterval(async () => {
    try {
      console.log(`[Trading Brain] Timer tick for: ${name}`);
      await runStrategy(name);
    } catch (err) {
      console.error(`[Trading Brain] Error in strategy ${name}:`, err);
      // Don't stop the interval on error - keep trying
    }
  }, minutes * 60 * 1000);
  
  running.set(name, interval);
  console.log(`[Trading Brain] Timer set for ${name}: every ${minutes} minutes`);
}

function stop(name: string): void {
  if (running.has(name)) {
    clearInterval(running.get(name)!);
    running.delete(name);
    log(name, '⏹️ STOPPED');
  }
}

// ============================================================================
// Tool Handlers
// ============================================================================

export const TRADING_BRAIN_HANDLERS: Record<string, (args: any) => Promise<any>> = {
  trading_create: async (args) => {
    const all = loadAll();
    
    const s: TradingStrategy = {
      name: args.name,
      asset: args.asset.toUpperCase(),
      strategy: args.strategy,
      platform: args.platform || 'mt5',
      timeframe: args.timeframe || 'M5',
      mode: args.mode || 'hybrid',
      entry_long: args.entry_long || [],
      entry_short: args.entry_short || [],
      lot_size: args.lot_size,
      risk_percent: args.risk_percent || 1,
      sl_atr: args.sl_atr || 1.5,
      tp_atr: args.tp_atr || 3.0,
      trailing_stop: args.trailing_stop ?? true,
      trailing_atr: args.trailing_atr || 1.5,
      max_spread: args.max_spread || 50,
      max_positions: args.max_positions || 1,
      max_daily_trades: args.max_daily_trades || 10,
      check_minutes: args.check_minutes || 5,
      status: 'stopped',
      created: new Date().toISOString(),
      trades_today: 0,
      total_trades: 0,
      wins: 0,
      losses: 0,
      profit: 0,
      trades: [],
    };
    
    all[args.name] = s;
    saveAll(all);
    
    const modeText = { rules: '⚡ Regeln', ai: '🧠 KI', hybrid: '🔮 Hybrid' };
    
    return {
      success: true,
      message: `✅ "${args.name}" erstellt!`,
      strategy: {
        name: s.name,
        asset: s.asset,
        mode: modeText[s.mode],
        timeframe: s.timeframe,
        sl: `${s.sl_atr}x ATR`,
        tp: `${s.tp_atr}x ATR`,
        trailing: s.trailing_stop,
      },
      next_step: `Starte mit: trading_start name="${args.name}"`,
    };
  },
  
  trading_start: async (args) => {
    const all = loadAll();
    const s = all[args.name];
    
    if (!s) return { success: false, error: `"${args.name}" nicht gefunden!` };
    
    s.status = 'running';
    saveAll(all);
    start(args.name, s.check_minutes);
    
    return {
      success: true,
      message: `🚀 "${args.name}" ist LIVE!`,
      info: {
        asset: s.asset,
        mode: s.mode,
        check: `alle ${s.check_minutes} min`,
      },
    };
  },
  
  trading_stop: async (args) => {
    const all = loadAll();
    const s = all[args.name];
    
    if (!s) return { success: false, error: 'Nicht gefunden' };
    
    s.status = 'stopped';
    saveAll(all);
    stop(args.name);
    
    return { success: true, message: `⏹️ "${args.name}" gestoppt` };
  },
  
  trading_list: async () => {
    const all = loadAll();
    const list = Object.values(all).map(s => ({
      name: s.name,
      asset: s.asset,
      status: s.status === 'running' ? '🟢 LIVE' : '⏹️ Stop',
      mode: s.mode,
      today: s.trades_today,
      total: s.total_trades,
      last: s.last_signal,
      check: s.last_check?.split('T')[1]?.split('.')[0],
    }));
    
    return {
      count: list.length,
      running: list.filter(s => s.status === '🟢 LIVE').length,
      strategies: list,
    };
  },
  
  trading_status: async (args) => {
    const all = loadAll();
    const s = all[args.name];
    
    if (!s) return { success: false, error: 'Nicht gefunden' };
    
    return {
      success: true,
      name: s.name,
      asset: s.asset,
      status: s.status,
      mode: s.mode,
      strategy: s.strategy,
      stats: {
        trades_today: s.trades_today,
        total_trades: s.total_trades,
        wins: s.wins,
        losses: s.losses,
      },
      last_check: s.last_check,
      last_signal: s.last_signal,
      recent_trades: s.trades.slice(0, 10),
    };
  },
  
  trading_delete: async (args) => {
    const all = loadAll();
    
    if (!all[args.name]) return { success: false, error: 'Nicht gefunden' };
    
    stop(args.name);
    delete all[args.name];
    saveAll(all);
    
    return { success: true, message: `🗑️ "${args.name}" gelöscht` };
  },
};

// ============================================================================
// Initialize on startup
// ============================================================================

export function initTradingBrain(): void {
  console.log('[Trading Brain] ════════════════════════════════════════');
  console.log('[Trading Brain] Initializing Trading Brain...');
  
  const all = loadAll();
  const strategies = Object.entries(all);
  
  console.log(`[Trading Brain] Found ${strategies.length} strategies`);
  
  let resumed = 0;
  for (const [name, s] of strategies) {
    console.log(`[Trading Brain]   - ${name}: status=${s.status}, check_minutes=${s.check_minutes}`);
    if (s.status === 'running') {
      console.log(`[Trading Brain] ▶ Resuming: ${name} (every ${s.check_minutes}m)`);
      start(name, s.check_minutes);
      resumed++;
    }
  }
  
  console.log(`[Trading Brain] Resumed ${resumed} strategies`);
  console.log('[Trading Brain] ════════════════════════════════════════');
}

export function registerTradingBrain(registry: Map<string, any>): void {
  for (const tool of TRADING_BRAIN_TOOLS) {
    registry.set(tool.name, {
      definition: tool,
      handler: TRADING_BRAIN_HANDLERS[tool.name],
      category: 'trading',
      enabled: true,
    });
  }
}
