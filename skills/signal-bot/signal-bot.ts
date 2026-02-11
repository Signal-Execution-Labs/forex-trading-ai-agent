/**
 * Signal Bot - Intelligent Signal Execution Engine
 * Inspired by 3Commas Signal Bot, Cornix, WunderTrading
 * 
 * Receives trading signals from any source and executes with professional
 * order management (TP, SL, DCA, trailing, filtering)
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ============ Types ============

export interface Signal {
  id: string;
  signal: 'buy' | 'sell' | 'close' | 'scale_in' | 'scale_out';
  symbol: string;
  price?: number;
  tp?: number | number[];
  sl?: number;
  size?: number;
  leverage?: number;
  confidence?: number;
  source: string;
  strategy?: string;
  message?: string;
  timestamp: Date;
  raw?: any;
}

export interface SignalFilter {
  rsiRange?: [number, number];
  trendAlignment?: boolean;
  volumeMin?: number;
  spreadMax?: number;
  timeWindows?: string[];
  maxDailyTrades?: number;
  minSignalScore?: number;
  blacklist?: string[];
  whitelist?: string[];
}

export interface TakeProfitConfig {
  enabled: boolean;
  targets: Array<{ percent: number; closePercent: number }>;
  trailing?: { activation: number; callback: number };
}

export interface StopLossConfig {
  enabled: boolean;
  percent: number;
  trailing?: boolean;
  breakEven?: { activation: number; offset: number };
}

export interface DCAConfig {
  enabled: boolean;
  levels: Array<{ dropPercent: number; sizeMultiplier: number }>;
  maxOrders: number;
}

export interface SignalBotConfig {
  webhookSecret?: string;
  telegramChannels?: string[];
  exchanges: string[];
  accountAllocation?: Record<string, number>;
  sizeMode: 'fixed' | 'risk-percent' | 'kelly' | 'signal';
  fixedSize?: number;
  riskPercent?: number;
  maxPositionSize?: number;
  autoTakeProfit?: TakeProfitConfig;
  autoStopLoss?: StopLossConfig;
  autoDCA?: DCAConfig;
  filter?: SignalFilter;
  maxDailyLoss?: number;
  maxConcurrentTrades?: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  size: number;
  unrealizedPnl: number;
  tpOrders: Array<{ price: number; size: number; filled: boolean }>;
  slPrice?: number;
  dcaOrders: Array<{ price: number; size: number; filled: boolean }>;
  exchange: string;
  signalId: string;
  openedAt: Date;
}

export interface SignalStats {
  source: string;
  totalSignals: number;
  executed: number;
  filtered: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldTime: number;
}

// ============ Signal Parser ============

export class TelegramSignalParser {
  private patterns = [
    // "BUY BTCUSDT @ 105000"
    /^(BUY|SELL|LONG|SHORT)\s+([A-Z0-9]+)\s*@?\s*(\d+(?:\.\d+)?)/i,
    // "🟢 LONG BTC Entry: 105000 TP: 107000 SL: 102000"
    /[🟢🔴]\s*(LONG|SHORT|BUY|SELL)\s+([A-Z0-9]+)\s+Entry:\s*(\d+(?:\.\d+)?)\s+TP:\s*(\d+(?:\.\d+)?)\s+SL:\s*(\d+(?:\.\d+)?)/i,
    // "BTCUSDT BUY Entry: 105000-106000"
    /([A-Z0-9]+)\s+(BUY|SELL)\s+Entry:\s*(\d+(?:\.\d+)?)/i
  ];

  parse(message: string, source: string): Signal | null {
    for (const pattern of this.patterns) {
      const match = message.match(pattern);
      if (match) {
        return this.extractSignal(match, message, source);
      }
    }
    return null;
  }

  private extractSignal(match: RegExpMatchArray, raw: string, source: string): Signal {
    const signalType = match[1].toUpperCase();
    const isBuy = ['BUY', 'LONG'].includes(signalType);
    
    // Extract TPs if present
    const tpMatch = raw.match(/TP\d?:\s*(\d+(?:\.\d+)?)/gi);
    const tps = tpMatch?.map(tp => parseFloat(tp.replace(/TP\d?:\s*/i, '')));
    
    // Extract SL if present
    const slMatch = raw.match(/SL:\s*(\d+(?:\.\d+)?)/i);
    const sl = slMatch ? parseFloat(slMatch[1]) : undefined;

    return {
      id: crypto.randomUUID(),
      signal: isBuy ? 'buy' : 'sell',
      symbol: match[2].toUpperCase(),
      price: parseFloat(match[3]),
      tp: tps && tps.length > 0 ? tps : undefined,
      sl,
      source,
      timestamp: new Date(),
      raw
    };
  }
}

// ============ Signal Scorer ============

export class SignalScorer {
  private sourceHistory: Map<string, Array<{ won: boolean; profit: number }>> = new Map();

  score(signal: Signal, marketContext?: any): number {
    let score = 0.5; // Base score

    // Source reliability
    const sourceStats = this.getSourceStats(signal.source);
    if (sourceStats.winRate > 0.6) score += 0.2;
    if (sourceStats.profitFactor > 1.5) score += 0.1;

    // Signal confidence
    if (signal.confidence) {
      score = score * 0.5 + signal.confidence * 0.5;
    }

    // Risk/reward check
    if (signal.tp && signal.sl && signal.price) {
      const tp = Array.isArray(signal.tp) ? signal.tp[0] : signal.tp;
      const reward = Math.abs(tp - signal.price);
      const risk = Math.abs(signal.price - signal.sl);
      const rr = reward / risk;
      if (rr >= 2) score += 0.1;
      if (rr >= 3) score += 0.1;
    }

    // Market context (if available)
    if (marketContext) {
      // Trend alignment
      if (marketContext.trend === signal.signal) score += 0.1;
      // Volume confirmation
      if (marketContext.volumeAboveAvg) score += 0.05;
    }

    return Math.min(1, Math.max(0, score));
  }

  recordResult(source: string, won: boolean, profit: number): void {
    if (!this.sourceHistory.has(source)) {
      this.sourceHistory.set(source, []);
    }
    this.sourceHistory.get(source)!.push({ won, profit });
  }

  getSourceStats(source: string): SignalStats {
    const history = this.sourceHistory.get(source) || [];
    const wins = history.filter(h => h.won);
    const losses = history.filter(h => !h.won);
    
    return {
      source,
      totalSignals: history.length,
      executed: history.length,
      filtered: 0,
      winRate: history.length ? wins.length / history.length : 0.5,
      avgProfit: wins.length ? wins.reduce((s, w) => s + w.profit, 0) / wins.length : 0,
      avgLoss: losses.length ? losses.reduce((s, l) => s + l.profit, 0) / losses.length : 0,
      profitFactor: losses.length && wins.length ? 
        Math.abs(wins.reduce((s, w) => s + w.profit, 0) / losses.reduce((s, l) => s + l.profit, 0)) : 1,
      bestTrade: Math.max(...history.map(h => h.profit), 0),
      worstTrade: Math.min(...history.map(h => h.profit), 0),
      avgHoldTime: 0
    };
  }
}

// ============ Signal Filter ============

export class SignalFilterEngine {
  private dailyTrades: Map<string, number> = new Map();
  private lastReset: Date = new Date();

  constructor(private config: SignalFilter) {}

  async shouldExecute(signal: Signal, marketData?: any): Promise<{ pass: boolean; reason?: string }> {
    // Reset daily counter
    const today = new Date().toDateString();
    if (this.lastReset.toDateString() !== today) {
      this.dailyTrades.clear();
      this.lastReset = new Date();
    }

    // Blacklist check
    if (this.config.blacklist?.includes(signal.symbol)) {
      return { pass: false, reason: 'Symbol blacklisted' };
    }

    // Whitelist check
    if (this.config.whitelist?.length && !this.config.whitelist.includes(signal.symbol)) {
      return { pass: false, reason: 'Symbol not in whitelist' };
    }

    // Daily trade limit
    if (this.config.maxDailyTrades) {
      const todayCount = this.dailyTrades.get(today) || 0;
      if (todayCount >= this.config.maxDailyTrades) {
        return { pass: false, reason: 'Daily trade limit reached' };
      }
    }

    // Time window check
    if (this.config.timeWindows?.length) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const inWindow = this.config.timeWindows.some(window => {
        const [start, end] = window.split('-');
        return currentTime >= start && currentTime <= end;
      });
      if (!inWindow) {
        return { pass: false, reason: 'Outside trading hours' };
      }
    }

    // Minimum signal score
    if (this.config.minSignalScore && signal.confidence) {
      if (signal.confidence < this.config.minSignalScore) {
        return { pass: false, reason: `Signal score ${signal.confidence} below minimum ${this.config.minSignalScore}` };
      }
    }

    // RSI range (requires market data)
    if (this.config.rsiRange && marketData?.rsi) {
      const [min, max] = this.config.rsiRange;
      if (marketData.rsi < min || marketData.rsi > max) {
        return { pass: false, reason: `RSI ${marketData.rsi} outside range [${min}, ${max}]` };
      }
    }

    // Volume check
    if (this.config.volumeMin && marketData?.volumeRatio) {
      if (marketData.volumeRatio < this.config.volumeMin) {
        return { pass: false, reason: `Volume ratio ${marketData.volumeRatio} below ${this.config.volumeMin}` };
      }
    }

    // Spread check
    if (this.config.spreadMax && marketData?.spread) {
      if (marketData.spread > this.config.spreadMax) {
        return { pass: false, reason: `Spread ${marketData.spread}% above ${this.config.spreadMax}%` };
      }
    }

    // Track daily count
    const current = this.dailyTrades.get(today) || 0;
    this.dailyTrades.set(today, current + 1);

    return { pass: true };
  }
}

// ============ Position Manager ============

export class PositionManager {
  private positions: Map<string, Position> = new Map();

  addPosition(position: Position): void {
    this.positions.set(position.id, position);
  }

  getPosition(id: string): Position | undefined {
    return this.positions.get(id);
  }

  getPositionBySymbol(symbol: string, exchange: string): Position | undefined {
    return Array.from(this.positions.values()).find(
      p => p.symbol === symbol && p.exchange === exchange
    );
  }

  updatePosition(id: string, updates: Partial<Position>): void {
    const position = this.positions.get(id);
    if (position) {
      Object.assign(position, updates);
    }
  }

  closePosition(id: string): Position | undefined {
    const position = this.positions.get(id);
    this.positions.delete(id);
    return position;
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getOpenCount(): number {
    return this.positions.size;
  }
}

// ============ Main Signal Bot ============

export class SignalBot extends EventEmitter {
  private config: SignalBotConfig;
  private parser: TelegramSignalParser;
  private scorer: SignalScorer;
  private filter: SignalFilterEngine | null;
  private positionManager: PositionManager;
  private signalHistory: Signal[] = [];
  private dailyPnl = 0;
  private isRunning = false;

  constructor(config: SignalBotConfig) {
    super();
    this.config = config;
    this.parser = new TelegramSignalParser();
    this.scorer = new SignalScorer();
    this.filter = config.filter ? new SignalFilterEngine(config.filter) : null;
    this.positionManager = new PositionManager();
  }

  // -------- Lifecycle --------

  start(): void {
    this.isRunning = true;
    this.emit('started');
    console.log('[SignalBot] Started with config:', {
      exchanges: this.config.exchanges,
      sizeMode: this.config.sizeMode,
      maxConcurrent: this.config.maxConcurrentTrades
    });
  }

  stop(): void {
    this.isRunning = false;
    this.emit('stopped');
  }

  // -------- Signal Processing --------

  async processWebhook(payload: any, signature?: string): Promise<{ success: boolean; message: string; signalId?: string }> {
    // Verify webhook signature
    if (this.config.webhookSecret && signature) {
      const expected = crypto.createHmac('sha256', this.config.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      if (signature !== expected) {
        return { success: false, message: 'Invalid webhook signature' };
      }
    }

    // Parse signal
    const signal = this.parseWebhookPayload(payload);
    if (!signal) {
      return { success: false, message: 'Could not parse signal from payload' };
    }

    return this.executeSignal(signal);
  }

  async processTelegramMessage(message: string, channel: string): Promise<{ success: boolean; message: string; signalId?: string }> {
    const signal = this.parser.parse(message, `telegram:${channel}`);
    if (!signal) {
      return { success: false, message: 'No trading signal found in message' };
    }

    return this.executeSignal(signal);
  }

  async executeSignal(signal: Signal): Promise<{ success: boolean; message: string; signalId?: string }> {
    if (!this.isRunning) {
      return { success: false, message: 'Signal bot is not running' };
    }

    // Check max concurrent
    if (this.config.maxConcurrentTrades && 
        this.positionManager.getOpenCount() >= this.config.maxConcurrentTrades) {
      return { success: false, message: 'Max concurrent trades reached' };
    }

    // Check daily loss limit
    if (this.config.maxDailyLoss && this.dailyPnl <= -this.config.maxDailyLoss) {
      return { success: false, message: 'Daily loss limit reached' };
    }

    // Score the signal
    signal.confidence = this.scorer.score(signal);
    this.emit('signal:scored', signal);

    // Apply filters
    if (this.filter) {
      const filterResult = await this.filter.shouldExecute(signal);
      if (!filterResult.pass) {
        this.emit('signal:filtered', signal, filterResult.reason);
        return { success: false, message: `Signal filtered: ${filterResult.reason}` };
      }
    }

    // Handle different signal types
    switch (signal.signal) {
      case 'buy':
      case 'sell':
        return this.openPosition(signal);
      case 'close':
        return this.closeAllPositions(signal.symbol);
      case 'scale_in':
        return this.scaleInPosition(signal);
      case 'scale_out':
        return this.scaleOutPosition(signal);
      default:
        return { success: false, message: `Unknown signal type: ${signal.signal}` };
    }
  }

  // -------- Position Management --------

  private async openPosition(signal: Signal): Promise<{ success: boolean; message: string; signalId?: string }> {
    const size = this.calculatePositionSize(signal);
    const side = signal.signal === 'buy' ? 'long' : 'short';

    // Create position for each exchange
    for (const exchange of this.config.exchanges) {
      const allocation = this.config.accountAllocation?.[exchange] || 100 / this.config.exchanges.length;
      const exchangeSize = size * (allocation / 100);

      const position: Position = {
        id: crypto.randomUUID(),
        symbol: signal.symbol,
        side,
        entryPrice: signal.price || 0,
        size: exchangeSize,
        unrealizedPnl: 0,
        tpOrders: [],
        dcaOrders: [],
        exchange,
        signalId: signal.id,
        openedAt: new Date()
      };

      // Apply auto TP
      if (this.config.autoTakeProfit?.enabled && signal.price) {
        position.tpOrders = this.calculateTakeProfitOrders(signal, position);
      }

      // Apply auto SL
      if (this.config.autoStopLoss?.enabled && signal.price) {
        position.slPrice = this.calculateStopLoss(signal, position);
      }

      // Apply auto DCA
      if (this.config.autoDCA?.enabled && signal.price) {
        position.dcaOrders = this.calculateDCAOrders(signal, position);
      }

      this.positionManager.addPosition(position);

      // TODO: Actually place orders on exchange
      console.log('[SignalBot] Opening position:', position);
      this.emit('position:opened', position);
    }

    this.signalHistory.push(signal);

    return { 
      success: true, 
      message: `Opened ${side} position on ${this.config.exchanges.join(', ')}`,
      signalId: signal.id 
    };
  }

  private async closeAllPositions(symbol: string): Promise<{ success: boolean; message: string }> {
    const positions = this.positionManager.getAllPositions()
      .filter(p => p.symbol === symbol);

    for (const position of positions) {
      this.positionManager.closePosition(position.id);
      this.emit('position:closed', position);
    }

    return { success: true, message: `Closed ${positions.length} positions for ${symbol}` };
  }

  private async scaleInPosition(signal: Signal): Promise<{ success: boolean; message: string }> {
    const position = this.positionManager.getPositionBySymbol(
      signal.symbol, 
      this.config.exchanges[0]
    );
    
    if (!position) {
      return { success: false, message: 'No position found to scale into' };
    }

    const addSize = signal.size || position.size * 0.5;
    position.size += addSize;
    // Recalculate average entry
    this.emit('position:scaled_in', position, addSize);

    return { success: true, message: `Scaled into position with ${addSize} units` };
  }

  private async scaleOutPosition(signal: Signal): Promise<{ success: boolean; message: string }> {
    const position = this.positionManager.getPositionBySymbol(
      signal.symbol,
      this.config.exchanges[0]
    );

    if (!position) {
      return { success: false, message: 'No position found to scale out of' };
    }

    const reduceSize = signal.size || position.size * 0.5;
    position.size -= reduceSize;
    this.emit('position:scaled_out', position, reduceSize);

    if (position.size <= 0) {
      this.positionManager.closePosition(position.id);
      this.emit('position:closed', position);
    }

    return { success: true, message: `Scaled out of position by ${reduceSize} units` };
  }

  // -------- Calculations --------

  private calculatePositionSize(signal: Signal): number {
    switch (this.config.sizeMode) {
      case 'fixed':
        return this.config.fixedSize || 100;
      
      case 'signal':
        return signal.size || 100;
      
      case 'risk-percent':
        // Risk-based sizing: (Account * RiskPercent) / (Entry - SL)
        if (signal.sl && signal.price && this.config.riskPercent) {
          const riskAmount = 10000 * (this.config.riskPercent / 100); // Assume 10k account
          const riskPerUnit = Math.abs(signal.price - signal.sl);
          const size = riskAmount / riskPerUnit;
          return this.config.maxPositionSize ? 
            Math.min(size, this.config.maxPositionSize) : size;
        }
        return 100;
      
      case 'kelly':
        // Kelly Criterion: f* = (bp - q) / b
        // Where b = odds, p = win prob, q = lose prob
        const stats = this.scorer.getSourceStats(signal.source);
        if (stats.winRate > 0 && stats.avgProfit && stats.avgLoss) {
          const b = stats.avgProfit / Math.abs(stats.avgLoss);
          const p = stats.winRate;
          const q = 1 - p;
          const kelly = (b * p - q) / b;
          const fraction = Math.max(0, Math.min(0.25, kelly)); // Cap at 25%
          return 10000 * fraction;
        }
        return 100;
      
      default:
        return 100;
    }
  }

  private calculateTakeProfitOrders(signal: Signal, position: Position): Array<{ price: number; size: number; filled: boolean }> {
    const tpConfig = this.config.autoTakeProfit!;
    const orders: Array<{ price: number; size: number; filled: boolean }> = [];

    // Use signal TPs if provided
    if (signal.tp) {
      const tps = Array.isArray(signal.tp) ? signal.tp : [signal.tp];
      const sizePerTp = position.size / tps.length;
      for (const tp of tps) {
        orders.push({ price: tp, size: sizePerTp, filled: false });
      }
      return orders;
    }

    // Calculate from config
    for (const target of tpConfig.targets) {
      const multiplier = position.side === 'long' ? 1 + target.percent / 100 : 1 - target.percent / 100;
      const tpPrice = position.entryPrice * multiplier;
      const tpSize = position.size * (target.closePercent / 100);
      orders.push({ price: tpPrice, size: tpSize, filled: false });
    }

    return orders;
  }

  private calculateStopLoss(signal: Signal, position: Position): number {
    // Use signal SL if provided
    if (signal.sl) return signal.sl;

    // Calculate from config
    const slConfig = this.config.autoStopLoss!;
    const multiplier = position.side === 'long' ? 1 - slConfig.percent / 100 : 1 + slConfig.percent / 100;
    return position.entryPrice * multiplier;
  }

  private calculateDCAOrders(signal: Signal, position: Position): Array<{ price: number; size: number; filled: boolean }> {
    const dcaConfig = this.config.autoDCA!;
    const orders: Array<{ price: number; size: number; filled: boolean }> = [];

    for (let i = 0; i < Math.min(dcaConfig.levels.length, dcaConfig.maxOrders); i++) {
      const level = dcaConfig.levels[i];
      const multiplier = position.side === 'long' ? 1 - level.dropPercent / 100 : 1 + level.dropPercent / 100;
      const dcaPrice = position.entryPrice * multiplier;
      const dcaSize = position.size * level.sizeMultiplier;
      orders.push({ price: dcaPrice, size: dcaSize, filled: false });
    }

    return orders;
  }

  private parseWebhookPayload(payload: any): Signal | null {
    // Standard format
    if (payload.signal && payload.symbol) {
      return {
        id: payload.id || crypto.randomUUID(),
        signal: payload.signal.toLowerCase(),
        symbol: payload.symbol.toUpperCase(),
        price: payload.price,
        tp: payload.tp,
        sl: payload.sl,
        size: payload.size,
        leverage: payload.leverage,
        confidence: payload.confidence,
        source: payload.source || 'webhook',
        strategy: payload.strategy,
        message: payload.message,
        timestamp: new Date(),
        raw: payload
      };
    }

    // TradingView format
    if (payload.strategy?.order) {
      return {
        id: crypto.randomUUID(),
        signal: payload.strategy.order.action.includes('buy') ? 'buy' : 'sell',
        symbol: payload.ticker?.toUpperCase() || '',
        price: payload.close,
        source: 'tradingview',
        strategy: payload.strategy.name,
        timestamp: new Date(),
        raw: payload
      };
    }

    return null;
  }

  // -------- Stats & Getters --------

  getStats(): SignalStats[] {
    const sources = new Set(this.signalHistory.map(s => s.source));
    return Array.from(sources).map(source => this.scorer.getSourceStats(source));
  }

  getPositions(): Position[] {
    return this.positionManager.getAllPositions();
  }

  getSignalHistory(): Signal[] {
    return [...this.signalHistory];
  }

  getConfig(): SignalBotConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<SignalBotConfig>): void {
    Object.assign(this.config, updates);
    if (updates.filter) {
      this.filter = new SignalFilterEngine(updates.filter);
    }
    this.emit('config:updated', this.config);
  }
}

// ============ Express Router Factory ============

export function createSignalBotRouter(bot: SignalBot): any {
  // Returns Express router (import express in actual implementation)
  return {
    routes: [
      { method: 'POST', path: '/api/signals/webhook', handler: 'processWebhook' },
      { method: 'POST', path: '/api/signals/execute', handler: 'executeSignal' },
      { method: 'GET', path: '/api/signals/history', handler: 'getSignalHistory' },
      { method: 'GET', path: '/api/signals/stats', handler: 'getStats' },
      { method: 'GET', path: '/api/signals/positions', handler: 'getPositions' },
      { method: 'PUT', path: '/api/signals/config', handler: 'updateConfig' }
    ]
  };
}

export default SignalBot;
