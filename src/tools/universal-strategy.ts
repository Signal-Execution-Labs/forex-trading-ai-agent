/**
 * K.I.T. Universal Strategy System
 * 
 * ANY strategy the user describes - K.I.T. understands and executes it.
 * No hardcoding. The AI interprets the strategy and decides.
 * 
 * Flow:
 * 1. User describes strategy in plain language (ANY strategy!)
 * 2. K.I.T. saves the strategy text
 * 3. Every X minutes: fetch market data (price, indicators, news)
 * 4. K.I.T.'s AI evaluates: "Should I trade based on this strategy?"
 * 5. If yes → execute the trade
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';

// ============================================================================
// Tool Definitions
// ============================================================================

export const UNIVERSAL_STRATEGY_TOOLS: ChatToolDef[] = [
  {
    name: 'auto_strategy_save',
    description: `Save ANY trading strategy the user describes. K.I.T. will understand and execute it automatically 24/7.
    
Examples of strategies K.I.T. can handle:
- "Buy BTC when it drops 5% in a day"
- "Trade gold with EMA crossovers and RSI filter"
- "Scalp EUR/USD on London session breakouts"
- "Buy when price touches lower Bollinger Band with RSI oversold"
- "Follow the trend on H4, enter on M15 pullbacks"

Just save the strategy description - K.I.T.'s AI will interpret it!`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Strategy name',
        },
        asset: {
          type: 'string',
          description: 'Trading asset (XAUUSD, EURUSD, BTCUSDT, etc.)',
        },
        platform: {
          type: 'string',
          enum: ['mt5', 'binance', 'bybit'],
          description: 'Trading platform',
        },
        strategy_description: {
          type: 'string',
          description: 'The complete strategy in plain language - entry rules, exit rules, indicators, everything',
        },
        timeframe: {
          type: 'string',
          description: 'Primary timeframe (M1, M5, M15, M30, H1, H4, D1)',
        },
        direction: {
          type: 'string',
          enum: ['long_only', 'short_only', 'both'],
          description: 'Trading direction',
        },
        lot_size: {
          type: 'number',
          description: 'Fixed lot size (or leave empty for risk-based)',
        },
        risk_percent: {
          type: 'number',
          description: 'Risk per trade as % of balance',
        },
        max_positions: {
          type: 'number',
          description: 'Max concurrent positions',
        },
        max_daily_trades: {
          type: 'number',
          description: 'Max trades per day',
        },
        check_interval_minutes: {
          type: 'number',
          description: 'How often to check (default: 5)',
        },
      },
      required: ['name', 'asset', 'platform', 'strategy_description'],
    },
  },
  {
    name: 'auto_strategy_start',
    description: 'Start 24/7 auto-trading for a saved strategy',
    parameters: {
      type: 'object',
      properties: {
        strategy_name: { type: 'string', description: 'Strategy name' },
      },
      required: ['strategy_name'],
    },
  },
  {
    name: 'auto_strategy_stop',
    description: 'Stop auto-trading for a strategy',
    parameters: {
      type: 'object',
      properties: {
        strategy_name: { type: 'string', description: 'Strategy name' },
      },
      required: ['strategy_name'],
    },
  },
  {
    name: 'auto_strategy_list',
    description: 'List all saved strategies',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'auto_strategy_evaluate',
    description: 'Manually trigger strategy evaluation (normally runs automatically)',
    parameters: {
      type: 'object',
      properties: {
        strategy_name: { type: 'string', description: 'Strategy name' },
      },
      required: ['strategy_name'],
    },
  },
];

// ============================================================================
// Types
// ============================================================================

interface UniversalStrategy {
  name: string;
  asset: string;
  platform: string;
  strategy_description: string;  // Plain language - the AI interprets this!
  timeframe: string;
  direction: string;
  lot_size?: number;
  risk_percent: number;
  max_positions: number;
  max_daily_trades: number;
  check_interval_minutes: number;
  status: 'running' | 'stopped';
  created_at: string;
  last_check?: string;
  last_decision?: string;
  trades_today: number;
  total_trades: number;
  trade_history: TradeRecord[];
}

interface TradeRecord {
  timestamp: string;
  action: string;
  price: number;
  lot: number;
  reason: string;
  ticket?: number;
}

interface MarketData {
  symbol: string;
  timeframe: string;
  current_price: number;
  bid: number;
  ask: number;
  spread: number;
  // Indicators
  ema_fast: number;
  ema_slow: number;
  rsi: number;
  atr: number;
  ema_trend: string;
  ema_cross_up: boolean;
  ema_cross_down: boolean;
  pullback_to_ema: boolean;
  // Additional data
  daily_high: number;
  daily_low: number;
  daily_change_percent: number;
  volume: number;
  // Positions
  open_positions: any[];
  position_count: number;
}

// ============================================================================
// Storage
// ============================================================================

function getStrategiesPath(): string {
  const workspace = process.env.KIT_WORKSPACE || path.join(process.cwd(), 'workspace');
  return path.join(workspace, 'universal_strategies.json');
}

function loadStrategies(): Record<string, UniversalStrategy> {
  try {
    const p = getStrategiesPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return {};
}

function saveStrategies(strategies: Record<string, UniversalStrategy>): void {
  const p = getStrategiesPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(strategies, null, 2));
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
// Market Data Collection
// ============================================================================

async function getMarketData(symbol: string, timeframe: string): Promise<MarketData | null> {
  // Get price
  const price = execMT5(`price ${symbol}`);
  if (!price.success) return null;
  
  // Get indicators
  const indicators = execMT5(`indicators ${symbol} ${timeframe} 100`);
  if (!indicators.success) return null;
  
  // Get positions
  const positions = execMT5('positions');
  const openPositions = positions.success 
    ? (positions.positions || []).filter((p: any) => p.symbol === symbol)
    : [];
  
  return {
    symbol,
    timeframe,
    current_price: indicators.current_price,
    bid: price.bid,
    ask: price.ask,
    spread: price.spread,
    ema_fast: indicators.ema21,
    ema_slow: indicators.ema50,
    rsi: indicators.rsi,
    atr: indicators.atr,
    ema_trend: indicators.ema_trend,
    ema_cross_up: indicators.ema_cross_up,
    ema_cross_down: indicators.ema_cross_down,
    pullback_to_ema: indicators.pullback_to_ema21,
    daily_high: indicators.current_price * 1.01,  // Placeholder
    daily_low: indicators.current_price * 0.99,   // Placeholder
    daily_change_percent: 0,
    volume: 0,
    open_positions: openPositions,
    position_count: openPositions.length,
  };
}

// ============================================================================
// AI Strategy Evaluation
// ============================================================================

// This is the key function - it will be called by the scheduler
// and will use K.I.T.'s AI to decide whether to trade

export interface StrategyEvaluation {
  strategy: UniversalStrategy;
  market_data: MarketData;
  should_trade: boolean;
  action?: 'buy' | 'sell' | 'close' | 'hold';
  lot_size?: number;
  sl?: number;
  tp?: number;
  reason: string;
}

/**
 * Generate a prompt for the AI to evaluate the strategy
 */
export function generateEvaluationPrompt(strategy: UniversalStrategy, data: MarketData): string {
  return `Du bist K.I.T., ein autonomer Trading-Agent. Evaluiere diese Strategie JETZT und entscheide ob du traden sollst.

## STRATEGIE: ${strategy.name}
${strategy.strategy_description}

## AKTUELLE MARKTDATEN für ${strategy.asset} (${strategy.timeframe})
- Preis: ${data.current_price} (Bid: ${data.bid}, Ask: ${data.ask}, Spread: ${data.spread})
- EMA 21: ${data.ema_fast}
- EMA 50: ${data.ema_slow}
- EMA Trend: ${data.ema_trend}
- EMA Cross Up: ${data.ema_cross_up}
- EMA Cross Down: ${data.ema_cross_down}
- Pullback zum EMA: ${data.pullback_to_ema}
- RSI (14): ${data.rsi}
- ATR (14): ${data.atr}

## AKTUELLE POSITIONEN
- Offene Positionen für ${strategy.asset}: ${data.position_count}
- Max erlaubt: ${strategy.max_positions}
- Trades heute: ${strategy.trades_today}
- Max pro Tag: ${strategy.max_daily_trades}

## TRADING-RICHTUNG
- Erlaubt: ${strategy.direction}

## DEINE AUFGABE
Analysiere die Marktdaten gegen die Strategie-Regeln. Antworte NUR mit einem JSON-Objekt:

{
  "action": "buy" | "sell" | "hold" | "close",
  "reason": "Kurze Begründung",
  "lot_size": 0.01,
  "sl": 2850.00,
  "tp": 2950.00
}

Regeln:
- "hold" wenn keine Bedingungen erfüllt sind
- "buy"/"sell" nur wenn ALLE Strategie-Bedingungen erfüllt sind
- "close" wenn Exit-Bedingungen erfüllt sind
- Berechne SL/TP basierend auf der Strategie (ATR-basiert wenn beschrieben)
- Lot Size: ${strategy.lot_size || `${strategy.risk_percent}% Risiko`}

WICHTIG: Antworte NUR mit dem JSON, kein anderer Text!`;
}

/**
 * Parse AI response to get trading decision
 */
export function parseAIDecision(response: string): { action: string; reason: string; lot_size?: number; sl?: number; tp?: number } | null {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}
  return null;
}

// ============================================================================
// Strategy Scheduler
// ============================================================================

const runningIntervals: Map<string, NodeJS.Timeout> = new Map();
const evaluationQueue: Map<string, boolean> = new Map();

// This will be set by the gateway when initialized
let aiEvaluator: ((prompt: string) => Promise<string>) | null = null;

export function setAIEvaluator(evaluator: (prompt: string) => Promise<string>): void {
  aiEvaluator = evaluator;
}

async function executeStrategyEvaluation(strategyName: string): Promise<string> {
  const strategies = loadStrategies();
  const strategy = strategies[strategyName];
  
  if (!strategy || strategy.status !== 'running') {
    return 'Strategy not running';
  }
  
  console.log(`[K.I.T.] 📊 Evaluating: ${strategy.name}`);
  
  // Update last check
  strategy.last_check = new Date().toISOString();
  
  // Check daily limit
  const today = new Date().toISOString().split('T')[0];
  if (strategy.last_check && !strategy.last_check.startsWith(today)) {
    strategy.trades_today = 0;
  }
  
  if (strategy.trades_today >= strategy.max_daily_trades) {
    console.log(`[K.I.T.] ⚠️ Daily limit reached`);
    saveStrategies(strategies);
    return 'Daily limit reached';
  }
  
  // Get market data
  const marketData = await getMarketData(strategy.asset, strategy.timeframe);
  if (!marketData) {
    console.log(`[K.I.T.] ❌ Could not get market data`);
    saveStrategies(strategies);
    return 'Could not get market data';
  }
  
  // Check max positions
  if (marketData.position_count >= strategy.max_positions) {
    console.log(`[K.I.T.] ⏸️ Max positions reached`);
    saveStrategies(strategies);
    return 'Max positions reached';
  }
  
  // Generate evaluation prompt
  const prompt = generateEvaluationPrompt(strategy, marketData);
  
  // If we have an AI evaluator, use it
  if (aiEvaluator) {
    try {
      const aiResponse = await aiEvaluator(prompt);
      const decision = parseAIDecision(aiResponse);
      
      if (decision) {
        console.log(`[K.I.T.] 🤖 AI Decision: ${decision.action} - ${decision.reason}`);
        strategy.last_decision = `${decision.action}: ${decision.reason}`;
        
        if (decision.action === 'buy' || decision.action === 'sell') {
          // Execute the trade!
          const lot = decision.lot_size || strategy.lot_size || 0.01;
          const sl = decision.sl || 0;
          const tp = decision.tp || 0;
          
          console.log(`[K.I.T.] 📝 Executing ${decision.action}: ${lot} lots, SL=${sl}, TP=${tp}`);
          
          const order = execMT5(`${decision.action} ${strategy.asset} ${lot} ${sl} ${tp}`);
          
          if (order.success) {
            console.log(`[K.I.T.] ✅ Order executed! Ticket: ${order.ticket}`);
            
            strategy.trades_today++;
            strategy.total_trades++;
            strategy.trade_history = strategy.trade_history || [];
            strategy.trade_history.unshift({
              timestamp: new Date().toISOString(),
              action: decision.action,
              price: order.price,
              lot,
              reason: decision.reason,
              ticket: order.ticket,
            });
            if (strategy.trade_history.length > 100) strategy.trade_history.pop();
            
            saveStrategies(strategies);
            return `Trade executed: ${decision.action} ${lot} lots at ${order.price}`;
          } else {
            console.log(`[K.I.T.] ❌ Order failed: ${order.error}`);
            saveStrategies(strategies);
            return `Order failed: ${order.error}`;
          }
        }
        
        saveStrategies(strategies);
        return `Decision: ${decision.action} - ${decision.reason}`;
      }
    } catch (e: any) {
      console.log(`[K.I.T.] ❌ AI evaluation error: ${e.message}`);
    }
  } else {
    console.log(`[K.I.T.] ⚠️ No AI evaluator set - using fallback logic`);
    // Fallback: use the indicator signals directly
    if (marketData.ema_cross_up && marketData.rsi > 50 && strategy.direction !== 'short_only') {
      strategy.last_decision = 'BUY signal (EMA cross up + RSI > 50)';
    } else if (marketData.ema_cross_down && marketData.rsi < 50 && strategy.direction !== 'long_only') {
      strategy.last_decision = 'SELL signal (EMA cross down + RSI < 50)';
    } else {
      strategy.last_decision = 'HOLD - no clear signal';
    }
  }
  
  saveStrategies(strategies);
  return strategy.last_decision || 'Evaluated';
}

function startScheduler(name: string, intervalMin: number): void {
  if (runningIntervals.has(name)) {
    clearInterval(runningIntervals.get(name)!);
  }
  
  console.log(`[K.I.T.] 🚀 Starting strategy: ${name} (every ${intervalMin} min)`);
  
  // Run immediately
  executeStrategyEvaluation(name);
  
  // Schedule
  const interval = setInterval(() => {
    executeStrategyEvaluation(name);
  }, intervalMin * 60 * 1000);
  
  runningIntervals.set(name, interval);
}

function stopScheduler(name: string): void {
  if (runningIntervals.has(name)) {
    clearInterval(runningIntervals.get(name)!);
    runningIntervals.delete(name);
    console.log(`[K.I.T.] ⏹️ Stopped: ${name}`);
  }
}

// ============================================================================
// Tool Handlers
// ============================================================================

export const UNIVERSAL_STRATEGY_HANDLERS: Record<string, (args: any) => Promise<any>> = {
  auto_strategy_save: async (args) => {
    const strategies = loadStrategies();
    
    const strategy: UniversalStrategy = {
      name: args.name,
      asset: args.asset.toUpperCase(),
      platform: args.platform || 'mt5',
      strategy_description: args.strategy_description,
      timeframe: args.timeframe || 'M5',
      direction: args.direction || 'both',
      lot_size: args.lot_size,
      risk_percent: args.risk_percent || 1,
      max_positions: args.max_positions || 1,
      max_daily_trades: args.max_daily_trades || 10,
      check_interval_minutes: args.check_interval_minutes || 5,
      status: 'stopped',
      created_at: new Date().toISOString(),
      trades_today: 0,
      total_trades: 0,
      trade_history: [],
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
        description: strategy.strategy_description.substring(0, 200) + '...',
      },
      next: 'Rufe auto_strategy_start auf um 24/7 Trading zu starten!',
    };
  },
  
  auto_strategy_start: async (args) => {
    const strategies = loadStrategies();
    const strategy = strategies[args.strategy_name];
    
    if (!strategy) {
      return { success: false, error: `Strategie "${args.strategy_name}" nicht gefunden` };
    }
    
    strategy.status = 'running';
    saveStrategies(strategies);
    
    startScheduler(args.strategy_name, strategy.check_interval_minutes);
    
    return {
      success: true,
      message: `🚀 Strategie "${args.strategy_name}" ist jetzt LIVE!`,
      details: {
        asset: strategy.asset,
        timeframe: strategy.timeframe,
        check: `Alle ${strategy.check_interval_minutes} Minuten`,
        mode: '24/7 AUTO-TRADING mit KI-Entscheidung',
      },
      note: 'ICH (K.I.T.) verstehe deine Strategie und werde sie intelligent ausführen. Ich bin kein dummer EA - ich kann deine Regeln INTERPRETIEREN! 🧠',
    };
  },
  
  auto_strategy_stop: async (args) => {
    const strategies = loadStrategies();
    const strategy = strategies[args.strategy_name];
    
    if (!strategy) {
      return { success: false, error: 'Strategy not found' };
    }
    
    strategy.status = 'stopped';
    saveStrategies(strategies);
    stopScheduler(args.strategy_name);
    
    return { success: true, message: `⏹️ Strategie "${args.strategy_name}" gestoppt` };
  },
  
  auto_strategy_list: async () => {
    const strategies = loadStrategies();
    return {
      strategies: Object.values(strategies).map(s => ({
        name: s.name,
        asset: s.asset,
        status: s.status === 'running' ? '🟢 LIVE' : '⏹️ Stop',
        trades_today: s.trades_today,
        total_trades: s.total_trades,
        last_decision: s.last_decision,
        last_check: s.last_check,
      })),
    };
  },
  
  auto_strategy_evaluate: async (args) => {
    const result = await executeStrategyEvaluation(args.strategy_name);
    return { result };
  },
};

// ============================================================================
// Initialize
// ============================================================================

export function initializeUniversalStrategies(): void {
  const strategies = loadStrategies();
  
  for (const [name, strategy] of Object.entries(strategies)) {
    if (strategy.status === 'running') {
      console.log(`[K.I.T.] 🔄 Resuming: ${name}`);
      startScheduler(name, strategy.check_interval_minutes);
    }
  }
}

export function registerUniversalStrategyTools(registry: Map<string, any>): void {
  for (const tool of UNIVERSAL_STRATEGY_TOOLS) {
    registry.set(tool.name, {
      definition: tool,
      handler: UNIVERSAL_STRATEGY_HANDLERS[tool.name],
      category: 'trading',
      enabled: true,
    });
  }
}
