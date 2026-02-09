/**
 * K.I.T. Auto-Trader Tool
 * 
 * Issue #3: Auto-Trader Tool Integration
 * 
 * Provides automated trading capabilities with:
 * - Strategy execution
 * - Risk management
 * - Position sizing
 * - Stop-loss / Take-profit
 * - Order management
 */

import ccxt, { Exchange, Ticker as CcxtTicker } from 'ccxt';
import { EventEmitter } from 'events';
import {
  Order,
  OrderSide,
  OrderType,
  Position,
  RiskConfig,
  Trade,
  ExchangeConfig,
} from './types';

// Helper to safely convert ccxt Num to number
const toNum = (val: number | string | undefined, def: number = 0): number => {
  if (val === undefined || val === null) return def;
  return typeof val === 'string' ? parseFloat(val) : val;
};

export interface TradeParams {
  symbol: string;
  side: OrderSide;
  amount?: number;
  amountUsd?: number;
  type?: OrderType;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  riskPercent?: number;
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  order?: Order;
  error?: string;
  position?: Position;
}

export interface AutoTraderConfig {
  exchange: ExchangeConfig;
  risk: RiskConfig;
  dryRun?: boolean;
  logTrades?: boolean;
}

const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxPositionPct: 5,
  maxDailyLossPct: 3,
  defaultStopLossPct: 2,
  defaultTakeProfitPct: 4,
  maxOpenTrades: 3,
  trailingStopPct: 1.5,
};

export class AutoTrader extends EventEmitter {
  private exchange: Exchange | null = null;
  private config: AutoTraderConfig;
  private openPositions: Map<string, Position> = new Map();
  private dailyPnl: number = 0;
  private trades: Trade[] = [];
  private isRunning: boolean = false;

  constructor(config?: Partial<AutoTraderConfig>) {
    super();
    this.config = {
      exchange: config?.exchange || { id: 'binance', sandbox: true },
      risk: { ...DEFAULT_RISK_CONFIG, ...config?.risk },
      dryRun: config?.dryRun ?? true,
      logTrades: config?.logTrades ?? true,
    };
  }

  async connect(exchangeConfig?: ExchangeConfig): Promise<boolean> {
    try {
      const cfg = exchangeConfig || this.config.exchange;
      const exchangeId = cfg.id.toLowerCase();
      
      if (!(exchangeId in ccxt)) {
        throw new Error(`Exchange ${cfg.id} not supported`);
      }

      const ExchangeClass = (ccxt as any)[exchangeId];
      this.exchange = new ExchangeClass({
        apiKey: cfg.apiKey || process.env[`${cfg.id.toUpperCase()}_API_KEY`],
        secret: cfg.secret || process.env[`${cfg.id.toUpperCase()}_SECRET`],
        sandbox: cfg.sandbox ?? true,
        enableRateLimit: true,
      }) as Exchange;

      await this.exchange.loadMarkets();
      this.emit('connected', { exchange: cfg.id });
      return true;
    } catch (error: any) {
      this.emit('error', { type: 'connection', error: error.message });
      return false;
    }
  }

  async trade(params: TradeParams): Promise<TradeResult> {
    try {
      const validation = await this.validateTrade(params);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const amount = await this.calculatePositionSize(params);
      if (amount <= 0) {
        return { success: false, error: 'Invalid position size calculated' };
      }

      const riskCheck = await this.checkRiskLimits(params.symbol, amount, params.side);
      if (!riskCheck.allowed) {
        return { success: false, error: riskCheck.reason };
      }

      const order = await this.executeOrder({ ...params, amount });
      if (!order) {
        return { success: false, error: 'Order execution failed' };
      }

      if (params.stopLoss || params.takeProfit) {
        await this.setStopLossAndTakeProfit(
          params.symbol,
          params.side,
          amount,
          order.price || params.price || 0,
          params.stopLoss,
          params.takeProfit
        );
      }

      const position = this.trackPosition(params.symbol, params.side, amount, order.price || params.price || 0);
      this.emit('trade', { order, position });

      return { success: true, orderId: order.id, order, position };
    } catch (error: any) {
      this.emit('error', { type: 'trade', error: error.message });
      return { success: false, error: error.message };
    }
  }

  async closePosition(symbol: string, percentage: number = 100): Promise<TradeResult> {
    const position = this.openPositions.get(symbol);
    if (!position) {
      return { success: false, error: `No open position for ${symbol}` };
    }

    const closeAmount = position.amount * (percentage / 100);
    const closeSide: OrderSide = position.side === 'long' ? 'sell' : 'buy';

    return this.trade({ symbol, side: closeSide, amount: closeAmount, type: 'market' });
  }

  async setTrailingStop(symbol: string, trailingPercent: number): Promise<boolean> {
    const position = this.openPositions.get(symbol);
    if (!position) return false;
    this.monitorTrailingStop(symbol, position, trailingPercent);
    return true;
  }

  getOpenPositions(): Position[] {
    return Array.from(this.openPositions.values());
  }

  getPosition(symbol: string): Position | undefined {
    return this.openPositions.get(symbol);
  }

  async getBalance(): Promise<{ total: number; free: number; used: number }> {
    if (!this.exchange) throw new Error('Exchange not connected');
    const balance = await this.exchange.fetchBalance();
    const usdt = balance['USDT'] || { total: 0, free: 0, used: 0 };
    return {
      total: toNum(usdt.total),
      free: toNum(usdt.free),
      used: toNum(usdt.used),
    };
  }

  getDailyPnl(): number { return this.dailyPnl; }
  getTrades(): Trade[] { return [...this.trades]; }
  
  disconnect(): void {
    this.isRunning = false;
    this.exchange = null;
    this.emit('disconnected');
  }

  private async validateTrade(params: TradeParams): Promise<{ valid: boolean; error?: string }> {
    if (!this.exchange) return { valid: false, error: 'Exchange not connected' };
    if (!params.symbol) return { valid: false, error: 'Symbol is required' };
    if (!params.side || !['buy', 'sell'].includes(params.side)) {
      return { valid: false, error: 'Invalid order side' };
    }
    if (!this.exchange.markets[params.symbol]) {
      return { valid: false, error: `Invalid symbol: ${params.symbol}` };
    }
    return { valid: true };
  }

  private async calculatePositionSize(params: TradeParams): Promise<number> {
    if (params.amount) return params.amount;

    const balance = await this.getBalance();
    const ticker = await this.exchange!.fetchTicker(params.symbol);
    const price = toNum(ticker.last, 1);

    if (params.amountUsd) return params.amountUsd / price;
    if (params.riskPercent) {
      const riskAmount = balance.free * (params.riskPercent / 100);
      const stopLossDistance = price * (this.config.risk.defaultStopLossPct / 100);
      return riskAmount / stopLossDistance;
    }

    const positionValue = balance.free * (this.config.risk.maxPositionPct / 100);
    return positionValue / price;
  }

  private async checkRiskLimits(symbol: string, amount: number, side: OrderSide): Promise<{ allowed: boolean; reason?: string }> {
    if (this.openPositions.size >= this.config.risk.maxOpenTrades) {
      if (!this.openPositions.has(symbol)) {
        return { allowed: false, reason: `Max open trades (${this.config.risk.maxOpenTrades}) reached` };
      }
    }

    if (this.dailyPnl < 0) {
      const balance = await this.getBalance();
      const lossPercent = Math.abs(this.dailyPnl / balance.total) * 100;
      if (lossPercent >= this.config.risk.maxDailyLossPct) {
        return { allowed: false, reason: `Daily loss limit (${this.config.risk.maxDailyLossPct}%) reached` };
      }
    }

    const balance = await this.getBalance();
    const ticker = await this.exchange!.fetchTicker(symbol);
    const positionValue = amount * toNum(ticker.last, 1);
    const positionPercent = (positionValue / balance.total) * 100;

    if (positionPercent > this.config.risk.maxPositionPct) {
      return { allowed: false, reason: `Position size exceeds max (${this.config.risk.maxPositionPct}%)` };
    }

    return { allowed: true };
  }

  private async executeOrder(params: TradeParams & { amount: number }): Promise<Order | null> {
    if (!this.exchange) return null;
    const orderType = params.type || 'market';

    if (this.config.dryRun) {
      const ticker = await this.exchange.fetchTicker(params.symbol);
      const price = params.price || toNum(ticker.last, 1);
      const simulatedOrder: Order = {
        id: `sim_${Date.now()}`,
        symbol: params.symbol,
        type: orderType,
        side: params.side,
        amount: params.amount,
        price: price,
        status: 'closed',
        filled: params.amount,
        remaining: 0,
        cost: params.amount * price,
        timestamp: Date.now(),
      };
      this.logTrade(simulatedOrder);
      return simulatedOrder;
    }

    let order: any;
    if (orderType === 'market') {
      order = params.side === 'buy'
        ? await this.exchange.createMarketBuyOrder(params.symbol, params.amount)
        : await this.exchange.createMarketSellOrder(params.symbol, params.amount);
    } else if (orderType === 'limit') {
      if (!params.price) throw new Error('Price required for limit order');
      order = params.side === 'buy'
        ? await this.exchange.createLimitBuyOrder(params.symbol, params.amount, params.price)
        : await this.exchange.createLimitSellOrder(params.symbol, params.amount, params.price);
    } else {
      throw new Error(`Unsupported order type: ${orderType}`);
    }

    const result: Order = {
      id: order.id,
      symbol: order.symbol,
      type: order.type as OrderType,
      side: order.side as OrderSide,
      amount: toNum(order.amount),
      price: toNum(order.price || order.average),
      status: order.status as any,
      filled: toNum(order.filled),
      remaining: toNum(order.remaining),
      cost: toNum(order.cost),
      fee: order.fee ? { cost: toNum(order.fee.cost), currency: order.fee.currency || '' } : undefined,
      timestamp: order.timestamp || Date.now(),
    };

    this.logTrade(result);
    return result;
  }

  private async setStopLossAndTakeProfit(symbol: string, side: OrderSide, amount: number, entryPrice: number, stopLoss?: number, takeProfit?: number): Promise<void> {
    if (this.config.dryRun) {
      console.log(`[DRY RUN] Setting SL: ${stopLoss}, TP: ${takeProfit} for ${symbol}`);
      return;
    }
    if (stopLoss) this.emit('stopLossSet', { symbol, side, amount, stopLoss });
    if (takeProfit) this.emit('takeProfitSet', { symbol, side, amount, takeProfit });
  }

  private trackPosition(symbol: string, side: OrderSide, amount: number, entryPrice: number): Position {
    const existingPosition = this.openPositions.get(symbol);
    if (existingPosition) {
      const isSameDirection = side === (existingPosition.side === 'long' ? 'buy' : 'sell');
      const newAmount = isSameDirection 
        ? existingPosition.amount + amount 
        : existingPosition.amount - amount;

      if (Math.abs(newAmount) < 0.00000001) {
        this.openPositions.delete(symbol);
        this.updateDailyPnl(existingPosition);
      } else {
        existingPosition.amount = Math.abs(newAmount);
        if (!isSameDirection && newAmount < 0) {
          existingPosition.side = existingPosition.side === 'long' ? 'short' : 'long';
        }
      }
      return existingPosition;
    }

    const position: Position = {
      symbol,
      side: side === 'buy' ? 'long' : 'short',
      amount,
      entryPrice,
      currentPrice: entryPrice,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      timestamp: Date.now(),
    };
    this.openPositions.set(symbol, position);
    return position;
  }

  private updateDailyPnl(closedPosition: Position): void {
    this.dailyPnl += closedPosition.unrealizedPnl;
    this.emit('pnlUpdate', { dailyPnl: this.dailyPnl, positionPnl: closedPosition.unrealizedPnl });
  }

  private monitorTrailingStop(symbol: string, position: Position, trailingPercent: number): void {
    let highestPrice = position.currentPrice;
    let stopPrice = position.currentPrice * (1 - trailingPercent / 100);
    this.isRunning = true;

    const interval = setInterval(async () => {
      if (!this.isRunning || !this.openPositions.has(symbol)) {
        clearInterval(interval);
        return;
      }

      try {
        const ticker = await this.exchange!.fetchTicker(symbol);
        const currentPrice = toNum(ticker.last, highestPrice);

        if (currentPrice > highestPrice) {
          highestPrice = currentPrice;
          stopPrice = highestPrice * (1 - trailingPercent / 100);
          this.emit('trailingStopUpdated', { symbol, highestPrice, stopPrice });
        }

        if (currentPrice <= stopPrice) {
          this.emit('trailingStopHit', { symbol, stopPrice, currentPrice });
          await this.closePosition(symbol);
          clearInterval(interval);
        }
      } catch (error: any) {
        console.error(`Trailing stop error for ${symbol}:`, error.message);
      }
    }, 5000);
  }

  private logTrade(order: Order): void {
    if (!this.config.logTrades) return;
    const trade: Trade = {
      id: `trade_${Date.now()}`,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      amount: order.filled,
      price: order.price!,
      cost: order.cost,
      fee: order.fee,
      timestamp: order.timestamp,
    };
    this.trades.push(trade);
    console.log(`[TRADE] ${order.side.toUpperCase()} ${order.filled} ${order.symbol} @ ${order.price}`);
  }
}

export function createAutoTrader(config?: Partial<AutoTraderConfig>): AutoTrader {
  return new AutoTrader(config);
}

export default AutoTrader;
