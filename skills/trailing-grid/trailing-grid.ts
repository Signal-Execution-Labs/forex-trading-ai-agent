/**
 * K.I.T. Trailing Grid Bot
 * 
 * Advanced grid trading with auto-trailing capabilities.
 * Grid automatically follows price movements to stay in profitable range.
 */

import { EventEmitter } from 'events';

// Types
interface TrailingGridConfig {
  symbol: string;
  exchange: string;
  lower: number;
  upper: number;
  grids: number;
  investment: number;
  trailUp: boolean;
  trailDown: boolean;
  trailTrigger: number;  // Percentage (0.03 = 3%)
  trailStep: number;     // Percentage (0.02 = 2%)
  maxTrail?: number;     // Maximum total trail percentage
  stopLoss?: StopLossConfig;
  profitLock?: number;
}

interface StopLossConfig {
  type: 'fixed' | 'trailing' | 'atr';
  value: number;
}

interface GridLevel {
  price: number;
  side: 'buy' | 'sell';
  orderId?: string;
  filled: boolean;
  quantity: number;
}

interface TrailEvent {
  timestamp: Date;
  direction: 'up' | 'down';
  oldRange: { lower: number; upper: number };
  newRange: { lower: number; upper: number };
  reason: string;
}

interface GridStatus {
  symbol: string;
  status: 'running' | 'stopped' | 'paused';
  originalRange: { lower: number; upper: number };
  currentRange: { lower: number; upper: number };
  currentPrice: number;
  activeGrids: number;
  totalGrids: number;
  trades: { buys: number; sells: number };
  profit: number;
  holdingValue: number;
  totalValue: number;
  trailEvents: TrailEvent[];
  runTime: number;  // milliseconds
}

interface AIOptimization {
  symbol: string;
  analysisdays: number;
  priceRange: { low: number; high: number };
  volatility: number;
  atr: number;
  recommended: {
    lower: number;
    upper: number;
    grids: number;
    investmentPerGrid: number;
    profitPerGrid: number;
    trailTrigger: number;
    trailStep: number;
  };
  expectedPerformance: {
    monthlyFills: { min: number; max: number };
    monthlyROI: { min: number; max: number };
    annualROI: { min: number; max: number };
  };
}

// Exchange client interface (implement per exchange)
interface ExchangeClient {
  getPrice(symbol: string): Promise<number>;
  placeOrder(order: { symbol: string; side: 'buy' | 'sell'; price: number; quantity: number }): Promise<string>;
  cancelOrder(symbol: string, orderId: string): Promise<void>;
  getBalance(asset: string): Promise<number>;
  getKlines(symbol: string, interval: string, limit: number): Promise<{ open: number; high: number; low: number; close: number }[]>;
}

/**
 * Trailing Grid Bot Implementation
 */
export class TrailingGridBot extends EventEmitter {
  private config: TrailingGridConfig;
  private exchange: ExchangeClient;
  private grids: GridLevel[] = [];
  private status: 'running' | 'stopped' | 'paused' = 'stopped';
  private originalRange: { lower: number; upper: number };
  private currentRange: { lower: number; upper: number };
  private trailEvents: TrailEvent[] = [];
  private startTime: Date;
  private trades = { buys: 0, sells: 0 };
  private profit = 0;
  private holdings = 0;
  private priceMonitorInterval?: NodeJS.Timeout;

  constructor(exchange: ExchangeClient) {
    super();
    this.exchange = exchange;
  }

  /**
   * Start trailing grid bot
   */
  async start(config: TrailingGridConfig): Promise<void> {
    this.config = config;
    this.originalRange = { lower: config.lower, upper: config.upper };
    this.currentRange = { lower: config.lower, upper: config.upper };
    this.startTime = new Date();
    
    // Initialize grid levels
    this.initializeGrid();
    
    // Place initial orders
    await this.placeGridOrders();
    
    // Start price monitoring for trailing
    this.startPriceMonitor();
    
    this.status = 'running';
    this.emit('started', { config, grids: this.grids.length });
  }

  /**
   * Initialize grid levels based on configuration
   */
  private initializeGrid(): void {
    const { lower, upper, grids, investment } = this.config;
    const spacing = (upper - lower) / grids;
    const investmentPerGrid = investment / grids;
    
    this.grids = [];
    
    for (let i = 0; i <= grids; i++) {
      const price = lower + (spacing * i);
      const quantity = investmentPerGrid / price;
      
      // Below current price = buy orders, above = sell orders
      // Will be determined when we get current price
      this.grids.push({
        price,
        side: 'buy',  // Will be updated
        filled: false,
        quantity
      });
    }
  }

  /**
   * Place grid orders on exchange
   */
  private async placeGridOrders(): Promise<void> {
    const currentPrice = await this.exchange.getPrice(this.config.symbol);
    
    for (const grid of this.grids) {
      // Determine side based on current price
      grid.side = grid.price < currentPrice ? 'buy' : 'sell';
      
      if (grid.filled) continue;  // Skip already filled
      
      try {
        grid.orderId = await this.exchange.placeOrder({
          symbol: this.config.symbol,
          side: grid.side,
          price: grid.price,
          quantity: grid.quantity
        });
        
        this.emit('orderPlaced', { grid });
      } catch (error) {
        this.emit('error', { type: 'orderPlacement', grid, error });
      }
    }
  }

  /**
   * Start monitoring price for trail triggers
   */
  private startPriceMonitor(): void {
    this.priceMonitorInterval = setInterval(async () => {
      try {
        const price = await this.exchange.getPrice(this.config.symbol);
        await this.checkTrailConditions(price);
        await this.checkOrderFills(price);
      } catch (error) {
        this.emit('error', { type: 'priceMonitor', error });
      }
    }, 5000);  // Check every 5 seconds
  }

  /**
   * Check if trailing should be triggered
   */
  private async checkTrailConditions(currentPrice: number): Promise<void> {
    const { trailUp, trailDown, trailTrigger, trailStep, maxTrail } = this.config;
    const { lower, upper } = this.currentRange;
    const range = upper - lower;
    
    // Check max trail limit
    if (maxTrail) {
      const totalTrail = Math.abs(this.currentRange.lower - this.originalRange.lower) / this.originalRange.lower;
      if (totalTrail >= maxTrail) {
        return;  // Max trail reached
      }
    }
    
    // Trail up: Price is approaching upper limit
    if (trailUp && currentPrice > upper - (range * trailTrigger)) {
      await this.trailGrid('up', trailStep);
    }
    
    // Trail down: Price is approaching lower limit
    if (trailDown && currentPrice < lower + (range * trailTrigger)) {
      await this.trailGrid('down', trailStep);
    }
  }

  /**
   * Trail the grid in specified direction
   */
  private async trailGrid(direction: 'up' | 'down', step: number): Promise<void> {
    const oldRange = { ...this.currentRange };
    const shiftAmount = (this.currentRange.upper - this.currentRange.lower) * step;
    
    if (direction === 'up') {
      this.currentRange.lower += shiftAmount;
      this.currentRange.upper += shiftAmount;
    } else {
      this.currentRange.lower -= shiftAmount;
      this.currentRange.upper -= shiftAmount;
    }
    
    // Record trail event
    this.trailEvents.push({
      timestamp: new Date(),
      direction,
      oldRange,
      newRange: { ...this.currentRange },
      reason: `Price ${direction === 'up' ? 'rising' : 'falling'} toward range edge`
    });
    
    // Cancel existing orders and replace with new grid
    await this.cancelAllOrders();
    this.config.lower = this.currentRange.lower;
    this.config.upper = this.currentRange.upper;
    this.initializeGrid();
    await this.placeGridOrders();
    
    this.emit('trailed', { direction, oldRange, newRange: this.currentRange });
  }

  /**
   * Check for filled orders and handle them
   */
  private async checkOrderFills(currentPrice: number): Promise<void> {
    for (const grid of this.grids) {
      if (grid.filled) continue;
      
      // Simplified fill detection (real implementation checks exchange)
      const isFilled = grid.side === 'buy' 
        ? currentPrice <= grid.price
        : currentPrice >= grid.price;
      
      if (isFilled) {
        grid.filled = true;
        
        if (grid.side === 'buy') {
          this.trades.buys++;
          this.holdings += grid.quantity;
        } else {
          this.trades.sells++;
          this.holdings -= grid.quantity;
          // Calculate profit (simplified)
          this.profit += grid.quantity * (this.config.upper - this.config.lower) / this.config.grids;
        }
        
        // Place opposite order at next grid
        this.emit('orderFilled', { grid, profit: this.profit });
      }
    }
  }

  /**
   * Cancel all open orders
   */
  private async cancelAllOrders(): Promise<void> {
    for (const grid of this.grids) {
      if (grid.orderId && !grid.filled) {
        try {
          await this.exchange.cancelOrder(this.config.symbol, grid.orderId);
        } catch (error) {
          // Order may already be filled or cancelled
        }
      }
    }
  }

  /**
   * Stop the trailing grid bot
   */
  async stop(): Promise<void> {
    if (this.priceMonitorInterval) {
      clearInterval(this.priceMonitorInterval);
    }
    
    await this.cancelAllOrders();
    this.status = 'stopped';
    this.emit('stopped', await this.getStatus());
  }

  /**
   * Get current bot status
   */
  async getStatus(): Promise<GridStatus> {
    const currentPrice = await this.exchange.getPrice(this.config.symbol);
    const activeGrids = this.grids.filter(g => !g.filled).length;
    
    return {
      symbol: this.config.symbol,
      status: this.status,
      originalRange: this.originalRange,
      currentRange: this.currentRange,
      currentPrice,
      activeGrids,
      totalGrids: this.grids.length,
      trades: this.trades,
      profit: this.profit,
      holdingValue: this.holdings * currentPrice,
      totalValue: this.config.investment + this.profit,
      trailEvents: this.trailEvents,
      runTime: Date.now() - this.startTime.getTime()
    };
  }

  /**
   * AI-optimized grid parameters
   */
  static async optimize(
    exchange: ExchangeClient,
    symbol: string,
    investment: number,
    days: number = 30
  ): Promise<AIOptimization> {
    // Fetch historical data
    const klines = await exchange.getKlines(symbol, '1d', days);
    
    // Calculate statistics
    const prices = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    
    const low = Math.min(...lows);
    const high = Math.max(...highs);
    const priceRange = { low, high };
    
    // Calculate volatility
    const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * Math.sqrt(365);
    
    // Calculate ATR
    const trs = klines.map((k, i) => {
      if (i === 0) return k.high - k.low;
      const prev = klines[i - 1];
      return Math.max(
        k.high - k.low,
        Math.abs(k.high - prev.close),
        Math.abs(k.low - prev.close)
      );
    });
    const atr = trs.reduce((a, b) => a + b, 0) / trs.length;
    
    // Calculate optimal parameters
    const buffer = 0.06;  // 6% buffer above/below
    const recommendedLower = low * (1 - buffer);
    const recommendedUpper = high * (1 + buffer);
    const range = recommendedUpper - recommendedLower;
    
    // Optimal grids based on volatility
    const targetProfitPerGrid = 0.005;  // 0.5%
    const optimalGrids = Math.floor(range / (prices[prices.length - 1] * targetProfitPerGrid));
    const actualGrids = Math.min(Math.max(optimalGrids, 10), 100);  // 10-100 grids
    
    const investmentPerGrid = investment / actualGrids;
    const profitPerGrid = (range / actualGrids) / prices[prices.length - 1];
    
    // Trail parameters based on volatility
    const dailyVolatility = volatility / Math.sqrt(365);
    const trailTrigger = Math.max(0.02, Math.min(0.10, dailyVolatility * 1.5));
    const trailStep = trailTrigger * 0.7;
    
    // Expected performance
    const avgDailyRange = atr / prices[prices.length - 1];
    const expectedDailyFills = avgDailyRange / (range / actualGrids);
    
    return {
      symbol,
      analysisdays: days,
      priceRange,
      volatility: volatility * 100,
      atr,
      recommended: {
        lower: recommendedLower,
        upper: recommendedUpper,
        grids: actualGrids,
        investmentPerGrid,
        profitPerGrid: profitPerGrid * 100,
        trailTrigger: trailTrigger * 100,
        trailStep: trailStep * 100
      },
      expectedPerformance: {
        monthlyFills: {
          min: Math.floor(expectedDailyFills * 30 * 0.6),
          max: Math.ceil(expectedDailyFills * 30 * 1.4)
        },
        monthlyROI: {
          min: Math.floor(expectedDailyFills * 30 * 0.6 * profitPerGrid * 100),
          max: Math.ceil(expectedDailyFills * 30 * 1.4 * profitPerGrid * 100)
        },
        annualROI: {
          min: Math.floor(expectedDailyFills * 365 * 0.6 * profitPerGrid * 100),
          max: Math.ceil(expectedDailyFills * 365 * 1.4 * profitPerGrid * 100)
        }
      }
    };
  }
}

/**
 * Infinity Trailing Bot
 * 
 * Combines infinity grid (no upper limit) with trailing stops
 */
export class InfinityTrailingBot extends TrailingGridBot {
  private trailingStops: Map<string, { orderId: string; triggerPrice: number; stopPrice: number }> = new Map();
  
  /**
   * Override to use trailing stops instead of limit sells
   */
  async startInfinity(config: Omit<TrailingGridConfig, 'upper'> & { profitPerGrid: number }): Promise<void> {
    // Set virtual upper limit very high
    await this.start({
      ...config,
      upper: config.lower * 10,  // 10x current price
      trailUp: true,
      trailDown: false  // Infinity only trails up
    });
  }
}

// Quick functions for CLI/API
export async function quickStart(
  exchangeClient: ExchangeClient,
  symbol: string,
  lower: number,
  upper: number,
  grids: number,
  investment: number,
  options: { trailUp?: boolean; trailDown?: boolean; trailTrigger?: number } = {}
): Promise<TrailingGridBot> {
  const bot = new TrailingGridBot(exchangeClient);
  
  await bot.start({
    symbol,
    exchange: 'binance',
    lower,
    upper,
    grids,
    investment,
    trailUp: options.trailUp ?? true,
    trailDown: options.trailDown ?? false,
    trailTrigger: options.trailTrigger ?? 0.03,
    trailStep: 0.02
  });
  
  return bot;
}

export async function optimize(
  exchangeClient: ExchangeClient,
  symbol: string,
  investment: number,
  days: number = 30
): Promise<AIOptimization> {
  return TrailingGridBot.optimize(exchangeClient, symbol, investment, days);
}
