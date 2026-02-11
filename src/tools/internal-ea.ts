/**
 * K.I.T. Internal EA System
 * 
 * User describes strategy → K.I.T. AI parses it ONCE → Creates internal EA → Runs 24/7
 * 
 * The "EA" is not an MQL5 file - it's structured rules that K.I.T. executes like an EA would.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';

// ============================================================================
// Tool Definitions
// ============================================================================

export const INTERNAL_EA_TOOLS: ChatToolDef[] = [
  {
    name: 'ea_create',
    description: `Create an internal EA from a strategy description. K.I.T. parses the strategy ONCE and builds executable rules.
    
The user describes their strategy in plain language, and K.I.T. converts it into a running EA.
This EA will execute 24/7 without needing AI for each decision - pure rule-based execution.`,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'EA name' },
        asset: { type: 'string', description: 'Trading symbol (XAUUSD, EURUSD, etc.)' },
        timeframe: { type: 'string', enum: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'], description: 'Chart timeframe' },
        // Entry conditions - parsed from user input
        entry_long: {
          type: 'array',
          description: 'Conditions for LONG entry (all must be true)',
          items: {
            type: 'object',
            properties: {
              indicator: { type: 'string', enum: ['price', 'ema_cross', 'ema_position', 'rsi', 'atr', 'macd', 'bb', 'volume', 'time'] },
              params: { type: 'object', description: 'Indicator parameters' },
              operator: { type: 'string', enum: ['>', '<', '>=', '<=', '==', 'cross_up', 'cross_down', 'above', 'below', 'between'] },
              value: { type: 'number', description: 'Comparison value (if applicable)' },
            },
          },
        },
        entry_short: {
          type: 'array',
          description: 'Conditions for SHORT entry (all must be true)',
          items: { type: 'object' },
        },
        exit_long: {
          type: 'array',
          description: 'Conditions to exit LONG positions',
          items: { type: 'object' },
        },
        exit_short: {
          type: 'array',
          description: 'Conditions to exit SHORT positions',
          items: { type: 'object' },
        },
        // Risk management
        lot_size: { type: 'number', description: 'Fixed lot size' },
        risk_percent: { type: 'number', description: 'Risk % per trade (for dynamic sizing)' },
        sl_type: { type: 'string', enum: ['fixed_pips', 'atr_multiplier', 'indicator', 'none'], description: 'Stop loss type' },
        sl_value: { type: 'number', description: 'SL value (pips or ATR multiplier)' },
        tp_type: { type: 'string', enum: ['fixed_pips', 'atr_multiplier', 'rr_ratio', 'indicator', 'none'], description: 'Take profit type' },
        tp_value: { type: 'number', description: 'TP value' },
        trailing_stop: { type: 'boolean', description: 'Enable trailing stop' },
        trailing_activation: { type: 'number', description: 'ATR multiplier to activate trailing' },
        // Filters
        max_spread: { type: 'number', description: 'Max spread in points' },
        trading_hours: { type: 'string', description: 'Trading hours (e.g., "08:00-22:00" or "london" or "24/7")' },
        max_positions: { type: 'number', description: 'Max concurrent positions' },
        max_daily_trades: { type: 'number', description: 'Max trades per day' },
        // Meta
        check_interval_minutes: { type: 'number', description: 'How often to check (default: 5)' },
        description: { type: 'string', description: 'Original strategy description for reference' },
        // AI Mode
        use_ai: { 
          type: 'boolean', 
          description: 'Let K.I.T. AI make the final trading decision (smarter but slower). If false, pure rule-based execution.' 
        },
        ai_mode: {
          type: 'string',
          enum: ['rules_only', 'ai_only', 'hybrid'],
          description: 'rules_only=fast deterministic, ai_only=AI decides everything, hybrid=rules filter + AI confirms'
        },
      },
      required: ['name', 'asset', 'timeframe'],
    },
  },
  {
    name: 'ea_start',
    description: 'Start an internal EA',
    parameters: {
      type: 'object',
      properties: { ea_name: { type: 'string' } },
      required: ['ea_name'],
    },
  },
  {
    name: 'ea_stop',
    description: 'Stop an internal EA',
    parameters: {
      type: 'object',
      properties: { ea_name: { type: 'string' } },
      required: ['ea_name'],
    },
  },
  {
    name: 'ea_list',
    description: 'List all internal EAs',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'ea_status',
    description: 'Get detailed EA status and trade log',
    parameters: {
      type: 'object',
      properties: { ea_name: { type: 'string' } },
      required: ['ea_name'],
    },
  },
  {
    name: 'ea_delete',
    description: 'Delete an internal EA',
    parameters: {
      type: 'object',
      properties: { ea_name: { type: 'string' } },
      required: ['ea_name'],
    },
  },
];

// ============================================================================
// Types
// ============================================================================

interface Condition {
  indicator: string;
  params?: Record<string, any>;
  operator: string;
  value?: number;
  value2?: number;  // For "between" operator
}

interface InternalEA {
  name: string;
  asset: string;
  timeframe: string;
  entry_long: Condition[];
  entry_short: Condition[];
  exit_long: Condition[];
  exit_short: Condition[];
  lot_size?: number;
  risk_percent: number;
  sl_type: string;
  sl_value: number;
  tp_type: string;
  tp_value: number;
  trailing_stop: boolean;
  trailing_activation: number;
  max_spread: number;
  trading_hours: string;
  max_positions: number;
  max_daily_trades: number;
  check_interval_minutes: number;
  description?: string;
  ai_mode: 'rules_only' | 'ai_only' | 'hybrid';
  // Runtime state
  status: 'running' | 'stopped';
  created_at: string;
  last_check?: string;
  last_signal?: string;
  trades_today: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_profit: number;
  trade_log: TradeLog[];
}

interface TradeLog {
  timestamp: string;
  action: 'buy' | 'sell' | 'close_buy' | 'close_sell' | 'trailing_sl';
  price: number;
  lot: number;
  sl: number;
  tp: number;
  ticket?: number;
  profit?: number;
  reason: string;
}

interface MarketSnapshot {
  price: number;
  bid: number;
  ask: number;
  spread: number;
  ema21: number;
  ema50: number;
  ema21_prev: number;
  ema50_prev: number;
  rsi: number;
  atr: number;
  ema_trend: string;
  positions: any[];
  hour: number;
}

// ============================================================================
// Storage
// ============================================================================

function getEAPath(): string {
  const workspace = process.env.KIT_WORKSPACE || path.join(process.cwd(), 'workspace');
  return path.join(workspace, 'internal_eas.json');
}

function loadEAs(): Record<string, InternalEA> {
  try {
    const p = getEAPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return {};
}

function saveEAs(eas: Record<string, InternalEA>): void {
  const p = getEAPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(eas, null, 2));
}

// ============================================================================
// MT5 Execution
// ============================================================================

function execMT5(cmd: string): any {
  const paths = [
    path.join(__dirname, '../../skills/metatrader/scripts/auto_connect.py'),
    path.join(__dirname, '../../../skills/metatrader/scripts/auto_connect.py'),
    path.join(process.cwd(), 'skills/metatrader/scripts/auto_connect.py'),
  ];
  const script = paths.find(p => fs.existsSync(p)) || paths[0];
  if (!fs.existsSync(script)) return { success: false, error: 'MT5 script not found' };
  
  try {
    const result = execSync(`python "${script}" ${cmd}`, {
      encoding: 'utf-8', timeout: 30000, windowsHide: true,
    });
    return JSON.parse(result.trim());
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================================
// Condition Evaluation Engine
// ============================================================================

function evaluateCondition(condition: Condition, market: MarketSnapshot): boolean {
  const { indicator, operator, value, value2, params } = condition;
  
  switch (indicator) {
    case 'ema_cross':
      // Check if EMA fast crossed EMA slow
      const fast = params?.fast || 21;
      const slow = params?.slow || 50;
      if (operator === 'cross_up' || operator === 'up') {
        // Fast was below slow, now above
        return market.ema21_prev <= market.ema50_prev && market.ema21 > market.ema50;
      } else if (operator === 'cross_down' || operator === 'down') {
        return market.ema21_prev >= market.ema50_prev && market.ema21 < market.ema50;
      }
      break;
      
    case 'ema_position':
      // Price position relative to EMA
      if (operator === 'above') {
        return market.price > market.ema21;
      } else if (operator === 'below') {
        return market.price < market.ema21;
      } else if (operator === 'pullback_to') {
        // Price within 0.5 ATR of EMA
        return Math.abs(market.price - market.ema21) < market.atr * 0.5;
      }
      break;
      
    case 'ema_trend':
      if (operator === '==' || operator === 'is') {
        if (value === 1 || String(params?.direction).toLowerCase() === 'bullish') {
          return market.ema_trend === 'BULLISH';
        } else {
          return market.ema_trend === 'BEARISH';
        }
      }
      break;
      
    case 'rsi':
      const rsiValue = market.rsi;
      switch (operator) {
        case '>': return rsiValue > (value || 50);
        case '<': return rsiValue < (value || 50);
        case '>=': return rsiValue >= (value || 50);
        case '<=': return rsiValue <= (value || 50);
        case 'between': return rsiValue >= (value || 30) && rsiValue <= (value2 || 70);
        case 'oversold': return rsiValue < 30;
        case 'overbought': return rsiValue > 70;
      }
      break;
      
    case 'price':
      switch (operator) {
        case '>': return market.price > (value || 0);
        case '<': return market.price < (value || 0);
        case '>=': return market.price >= (value || 0);
        case '<=': return market.price <= (value || 0);
      }
      break;
      
    case 'spread':
      return market.spread <= (value || 50);
      
    case 'time':
      // Check trading hours
      const hour = market.hour;
      if (operator === 'between' && value !== undefined && value2 !== undefined) {
        return hour >= value && hour < value2;
      }
      break;
  }
  
  return false;
}

function evaluateConditions(conditions: Condition[], market: MarketSnapshot): boolean {
  if (!conditions || conditions.length === 0) return false;
  
  // All conditions must be true (AND logic)
  for (const condition of conditions) {
    if (!evaluateCondition(condition, market)) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// EA Execution Engine
// ============================================================================

const runningEAs: Map<string, NodeJS.Timeout> = new Map();

// AI Evaluator - will be set by gateway
let aiEvaluator: ((prompt: string) => Promise<string>) | null = null;

export function setEAAIEvaluator(evaluator: (prompt: string) => Promise<string>): void {
  aiEvaluator = evaluator;
  console.log('[K.I.T. EA] AI Evaluator connected');
}

function log(ea: string, message: string): void {
  console.log(`[EA:${ea}] ${new Date().toISOString()} ${message}`);
}

async function runEA(eaName: string): Promise<void> {
  const eas = loadEAs();
  const ea = eas[eaName];
  
  if (!ea || ea.status !== 'running') return;
  
  log(eaName, '📊 Checking...');
  
  // Update state
  ea.last_check = new Date().toISOString();
  const today = ea.last_check.split('T')[0];
  
  // Reset daily counter if new day
  const lastDay = ea.trade_log[0]?.timestamp?.split('T')[0];
  if (lastDay && lastDay !== today) {
    ea.trades_today = 0;
  }
  
  // Check daily limit
  if (ea.trades_today >= ea.max_daily_trades) {
    log(eaName, '⚠️ Daily limit reached');
    saveEAs(eas);
    return;
  }
  
  // Get market data
  const price = execMT5(`price ${ea.asset}`);
  if (!price.success) {
    log(eaName, `❌ Price error: ${price.error}`);
    saveEAs(eas);
    return;
  }
  
  // Check spread
  if (price.spread > ea.max_spread) {
    log(eaName, `⚠️ Spread too high: ${price.spread}`);
    saveEAs(eas);
    return;
  }
  
  const indicators = execMT5(`indicators ${ea.asset} ${ea.timeframe} 100`);
  if (!indicators.success) {
    log(eaName, `❌ Indicators error: ${indicators.error}`);
    saveEAs(eas);
    return;
  }
  
  const positions = execMT5('positions');
  const assetPositions = positions.success 
    ? (positions.positions || []).filter((p: any) => p.symbol === ea.asset)
    : [];
  
  // Build market snapshot
  const market: MarketSnapshot = {
    price: indicators.current_price,
    bid: price.bid,
    ask: price.ask,
    spread: price.spread,
    ema21: indicators.ema21,
    ema50: indicators.ema50,
    ema21_prev: indicators.ema21 * 0.9999, // Approximate previous (TODO: get actual)
    ema50_prev: indicators.ema50 * 0.9999,
    rsi: indicators.rsi,
    atr: indicators.atr,
    ema_trend: indicators.ema_trend,
    positions: assetPositions,
    hour: new Date().getUTCHours(),
  };
  
  log(eaName, `📈 Price=${market.price} EMA21=${market.ema21} EMA50=${market.ema50} RSI=${market.rsi} ATR=${market.atr}`);
  
  // Check for existing positions - manage trailing stop
  if (ea.trailing_stop && assetPositions.length > 0) {
    for (const pos of assetPositions) {
      const profitDistance = pos.type === 'buy'
        ? (market.price - pos.price_open)
        : (pos.price_open - market.price);
      
      const activationDistance = market.atr * ea.trailing_activation;
      
      if (profitDistance >= activationDistance) {
        let newSL: number;
        if (pos.type === 'buy') {
          newSL = Math.round((market.price - market.atr * ea.sl_value) * 100) / 100;
          if (newSL > pos.sl) {
            log(eaName, `📈 Trailing SL: ${pos.sl} → ${newSL}`);
            execMT5(`modify_sl ${pos.ticket} ${newSL}`);
          }
        } else {
          newSL = Math.round((market.price + market.atr * ea.sl_value) * 100) / 100;
          if (newSL < pos.sl) {
            log(eaName, `📉 Trailing SL: ${pos.sl} → ${newSL}`);
            execMT5(`modify_sl ${pos.ticket} ${newSL}`);
          }
        }
      }
    }
  }
  
  // Check max positions
  if (assetPositions.length >= ea.max_positions) {
    log(eaName, `⏸️ Max positions (${assetPositions.length}/${ea.max_positions})`);
    ea.last_signal = 'max_positions';
    saveEAs(eas);
    return;
  }
  
  // Evaluate entry conditions based on mode
  let signal: 'buy' | 'sell' | null = null;
  let reason = '';
  
  const mode = ea.ai_mode || 'rules_only';
  
  if (mode === 'ai_only') {
    // Pure AI mode - let AI decide everything
    if (aiEvaluator && ea.description) {
      log(eaName, '🧠 Asking AI for decision...');
      try {
        const aiPrompt = `Du bist K.I.T., ein Trading-Agent. Entscheide ob du JETZT traden sollst.

STRATEGIE: ${ea.description}

MARKTDATEN für ${ea.asset} (${ea.timeframe}):
- Preis: ${market.price}
- EMA21: ${market.ema21}, EMA50: ${market.ema50}
- Trend: ${market.ema_trend}
- RSI: ${market.rsi}
- ATR: ${market.atr}
- Spread: ${market.spread}
- Offene Positionen: ${market.positions.length}

Antworte NUR mit JSON: {"action": "buy"|"sell"|"hold", "reason": "..."}`;
        
        const aiResponse = await aiEvaluator(aiPrompt);
        const match = aiResponse.match(/\{[\s\S]*\}/);
        if (match) {
          const decision = JSON.parse(match[0]);
          if (decision.action === 'buy' || decision.action === 'sell') {
            signal = decision.action;
            reason = `AI: ${decision.reason}`;
          }
        }
      } catch (e: any) {
        log(eaName, `❌ AI error: ${e.message}`);
      }
    } else {
      log(eaName, '⚠️ AI mode but no evaluator/description');
    }
  } else {
    // Rule-based evaluation
    if (ea.entry_long && ea.entry_long.length > 0) {
      if (evaluateConditions(ea.entry_long, market)) {
        signal = 'buy';
        reason = 'Long entry conditions met';
      }
    }
    
    if (!signal && ea.entry_short && ea.entry_short.length > 0) {
      if (evaluateConditions(ea.entry_short, market)) {
        signal = 'sell';
        reason = 'Short entry conditions met';
      }
    }
    
    // Hybrid mode - rules found signal, now ask AI to confirm
    if (mode === 'hybrid' && signal && aiEvaluator && ea.description) {
      log(eaName, `🧠 Rules say ${signal.toUpperCase()}, asking AI to confirm...`);
      try {
        const confirmPrompt = `Du bist K.I.T. Die Regeln sagen ${signal.toUpperCase()} für ${ea.asset}.

STRATEGIE: ${ea.description}

MARKTDATEN:
- Preis: ${market.price}, EMA21: ${market.ema21}, EMA50: ${market.ema50}
- Trend: ${market.ema_trend}, RSI: ${market.rsi}, ATR: ${market.atr}

FRAGE: Soll ich den ${signal.toUpperCase()} Trade wirklich ausführen?
Antworte NUR mit JSON: {"confirm": true|false, "reason": "..."}`;
        
        const aiResponse = await aiEvaluator(confirmPrompt);
        const match = aiResponse.match(/\{[\s\S]*\}/);
        if (match) {
          const decision = JSON.parse(match[0]);
          if (!decision.confirm) {
            log(eaName, `🧠 AI rejected: ${decision.reason}`);
            signal = null;
            reason = `AI rejected: ${decision.reason}`;
          } else {
            reason += ` (AI confirmed: ${decision.reason})`;
          }
        }
      } catch (e: any) {
        log(eaName, `⚠️ AI confirm error: ${e.message}, proceeding with rules`);
      }
    }
  }
  
  ea.last_signal = signal || 'none';
  
  if (!signal) {
    log(eaName, '⏸️ No signal');
    saveEAs(eas);
    return;
  }
  
  log(eaName, `🎯 SIGNAL: ${signal.toUpperCase()} - ${reason}`);
  
  // Calculate lot size
  let lot = ea.lot_size || 0.01;
  if (ea.risk_percent && !ea.lot_size) {
    const account = execMT5('connect');
    if (account.success && account.account) {
      const balance = account.account.balance;
      const riskAmount = balance * (ea.risk_percent / 100);
      const slDistance = market.atr * ea.sl_value;
      lot = Math.max(0.01, Math.min(1.0, riskAmount / (slDistance * 100)));
      lot = Math.round(lot * 100) / 100;
    }
  }
  
  // Calculate SL and TP
  let sl = 0, tp = 0;
  
  if (ea.sl_type === 'atr_multiplier') {
    sl = signal === 'buy'
      ? Math.round((market.price - market.atr * ea.sl_value) * 100) / 100
      : Math.round((market.price + market.atr * ea.sl_value) * 100) / 100;
  }
  
  if (ea.tp_type === 'atr_multiplier') {
    tp = signal === 'buy'
      ? Math.round((market.price + market.atr * ea.tp_value) * 100) / 100
      : Math.round((market.price - market.atr * ea.tp_value) * 100) / 100;
  } else if (ea.tp_type === 'rr_ratio' && sl !== 0) {
    const slDistance = Math.abs(market.price - sl);
    tp = signal === 'buy'
      ? Math.round((market.price + slDistance * ea.tp_value) * 100) / 100
      : Math.round((market.price - slDistance * ea.tp_value) * 100) / 100;
  }
  
  log(eaName, `📝 Executing: ${signal} ${lot} lots, SL=${sl}, TP=${tp}`);
  
  // EXECUTE TRADE
  const order = execMT5(`${signal} ${ea.asset} ${lot} ${sl} ${tp}`);
  
  if (order.success) {
    log(eaName, `✅ ORDER FILLED! Ticket: ${order.ticket} @ ${order.price}`);
    
    ea.trades_today++;
    ea.total_trades++;
    ea.trade_log.unshift({
      timestamp: new Date().toISOString(),
      action: signal,
      price: order.price,
      lot,
      sl,
      tp,
      ticket: order.ticket,
      reason,
    });
    if (ea.trade_log.length > 200) ea.trade_log.pop();
  } else {
    log(eaName, `❌ ORDER FAILED: ${order.error}`);
  }
  
  saveEAs(eas);
}

function startEA(eaName: string, intervalMin: number): void {
  if (runningEAs.has(eaName)) {
    clearInterval(runningEAs.get(eaName)!);
  }
  
  log(eaName, `🚀 STARTING (every ${intervalMin} min)`);
  
  // Run immediately
  runEA(eaName);
  
  // Schedule
  const interval = setInterval(() => runEA(eaName), intervalMin * 60 * 1000);
  runningEAs.set(eaName, interval);
}

function stopEA(eaName: string): void {
  if (runningEAs.has(eaName)) {
    clearInterval(runningEAs.get(eaName)!);
    runningEAs.delete(eaName);
    log(eaName, '⏹️ STOPPED');
  }
}

// ============================================================================
// Tool Handlers
// ============================================================================

export const INTERNAL_EA_HANDLERS: Record<string, (args: any) => Promise<any>> = {
  ea_create: async (args) => {
    const eas = loadEAs();
    
    const ea: InternalEA = {
      name: args.name,
      asset: args.asset.toUpperCase(),
      timeframe: args.timeframe || 'M5',
      entry_long: args.entry_long || [],
      entry_short: args.entry_short || [],
      exit_long: args.exit_long || [],
      exit_short: args.exit_short || [],
      lot_size: args.lot_size,
      risk_percent: args.risk_percent || 1,
      sl_type: args.sl_type || 'atr_multiplier',
      sl_value: args.sl_value || 1.5,
      tp_type: args.tp_type || 'atr_multiplier',
      tp_value: args.tp_value || 3.0,
      trailing_stop: args.trailing_stop || false,
      trailing_activation: args.trailing_activation || 1.5,
      max_spread: args.max_spread || 50,
      trading_hours: args.trading_hours || '24/7',
      max_positions: args.max_positions || 1,
      max_daily_trades: args.max_daily_trades || 10,
      check_interval_minutes: args.check_interval_minutes || 5,
      description: args.description,
      ai_mode: args.ai_mode || (args.use_ai ? 'hybrid' : 'rules_only'),
      status: 'stopped',
      created_at: new Date().toISOString(),
      trades_today: 0,
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      total_profit: 0,
      trade_log: [],
    };
    
    eas[args.name] = ea;
    saveEAs(eas);
    
    const modeLabels = {
      'rules_only': '⚡ Nur Regeln (schnell, deterministisch)',
      'ai_only': '🧠 Nur KI (intelligent, flexibel)',
      'hybrid': '🔮 Hybrid (Regeln + KI-Bestätigung)',
    };
    
    return {
      success: true,
      message: `✅ Interner EA "${args.name}" erstellt!`,
      ea: {
        name: ea.name,
        asset: ea.asset,
        timeframe: ea.timeframe,
        mode: modeLabels[ea.ai_mode],
        entry_long_conditions: ea.entry_long.length,
        entry_short_conditions: ea.entry_short.length,
        sl: `${ea.sl_type} (${ea.sl_value})`,
        tp: `${ea.tp_type} (${ea.tp_value})`,
        trailing: ea.trailing_stop,
      },
      next: 'Starte mit ea_start!',
    };
  },
  
  ea_start: async (args) => {
    const eas = loadEAs();
    const ea = eas[args.ea_name];
    
    if (!ea) return { success: false, error: 'EA nicht gefunden' };
    
    ea.status = 'running';
    saveEAs(eas);
    startEA(args.ea_name, ea.check_interval_minutes);
    
    return {
      success: true,
      message: `🚀 EA "${args.ea_name}" ist LIVE!`,
      details: {
        asset: ea.asset,
        timeframe: ea.timeframe,
        interval: `${ea.check_interval_minutes} min`,
      },
    };
  },
  
  ea_stop: async (args) => {
    const eas = loadEAs();
    const ea = eas[args.ea_name];
    
    if (!ea) return { success: false, error: 'EA nicht gefunden' };
    
    ea.status = 'stopped';
    saveEAs(eas);
    stopEA(args.ea_name);
    
    return { success: true, message: `⏹️ EA "${args.ea_name}" gestoppt` };
  },
  
  ea_list: async () => {
    const eas = loadEAs();
    return {
      eas: Object.values(eas).map(ea => ({
        name: ea.name,
        asset: ea.asset,
        timeframe: ea.timeframe,
        status: ea.status === 'running' ? '🟢 LIVE' : '⏹️ Stop',
        trades_today: ea.trades_today,
        total_trades: ea.total_trades,
        last_signal: ea.last_signal,
        last_check: ea.last_check,
      })),
    };
  },
  
  ea_status: async (args) => {
    const eas = loadEAs();
    const ea = eas[args.ea_name];
    
    if (!ea) return { success: false, error: 'EA nicht gefunden' };
    
    return {
      success: true,
      ea: {
        ...ea,
        trade_log: ea.trade_log.slice(0, 20),
      },
    };
  },
  
  ea_delete: async (args) => {
    const eas = loadEAs();
    
    if (!eas[args.ea_name]) return { success: false, error: 'EA nicht gefunden' };
    
    stopEA(args.ea_name);
    delete eas[args.ea_name];
    saveEAs(eas);
    
    return { success: true, message: `🗑️ EA "${args.ea_name}" gelöscht` };
  },
};

// ============================================================================
// Initialize
// ============================================================================

export function initializeInternalEAs(): void {
  const eas = loadEAs();
  
  for (const [name, ea] of Object.entries(eas)) {
    if (ea.status === 'running') {
      console.log(`[K.I.T.] 🔄 Resuming EA: ${name}`);
      startEA(name, ea.check_interval_minutes);
    }
  }
}

export function registerInternalEATools(registry: Map<string, any>): void {
  for (const tool of INTERNAL_EA_TOOLS) {
    registry.set(tool.name, {
      definition: tool,
      handler: INTERNAL_EA_HANDLERS[tool.name],
      category: 'trading',
      enabled: true,
    });
  }
}
