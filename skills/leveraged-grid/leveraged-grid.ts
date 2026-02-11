/**
 * K.I.T. Leveraged Grid Bot
 * 
 * Grid trading on futures/perpetuals with leverage for amplified returns.
 * Inspired by Pionex Futures Grid, Bybit Grid Bot, 3Commas Futures Grid.
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type GridType = 'long' | 'short' | 'neutral';
export type MarginMode = 'isolated' | 'cross';
export type TrailDirection = 'up' | 'down' | 'both';
export type PositionSide = 'LONG' | 'SHORT' | 'BOTH';

export interface GridLevel {
  id: string;
  price: number;
  side: 'buy' | 'sell';
  positionSide: PositionSide;
  quantity: number;
  filled: boolean;
  orderId?: string;
  filledAt?: Date;
  pnl?: number;
}

export interface LeveragedGridConfig {
  exchange: string;
  symbol: string;
  leverage: number;
  gridType: GridType;
  priceRange: {
    lower: number;
    upper: number;
  };
  gridCount: number;
  investmentAmount: number;
  marginMode: MarginMode;
  
  riskManagement: {
    maxDrawdownPercent: number;
    liquidationBuffer: number;
    maxPositionSize: number;
    fundingRateThreshold: number;
  };
  
  aiOptimization: {
    enabled: boolean;
    lookbackDays: number;
    adjustLeverage: boolean;
    adjustGridSpacing: boolean;
  };
  
  trailing: {
    enabled: boolean;
    direction: TrailDirection;
    triggerPercent: number;
  };
}

export interface Position {
  symbol: string;
  side: PositionSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  marginRatio: number;
  liquidationPrice: number;
  leverage: number;
}

export interface FundingRate {
  symbol: string;
  fundingRate: number;
  fundingTime: Date;
  nextFundingTime: Date;
}

export interface GridStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  fundingPaid: number;
  maxDrawdown: number;
  currentDrawdown: number;
  runTime: number;
  apy: number;
}

// ============================================================================
// Exchange Interface (Abstract)
// ============================================================================

export interface FuturesExchange {
  name: string;
  
  // Account
  setLeverage(symbol: string, leverage: number): Promise<void>;
  setMarginMode(symbol: string, mode: MarginMode): Promise<void>;
  getBalance(): Promise<{ available: number; total: number }>;
  
  // Positions
  getPosition(symbol: string): Promise<Position | null>;
  getPositions(): Promise<Position[]>;
  
  // Orders
  createOrder(params: {
    symbol: string;
    side: 'buy' | 'sell';
    positionSide: PositionSide;
    type: 'limit' | 'market';
    quantity: number;
    price?: number;
    reduceOnly?: boolean;
  }): Promise<{ orderId: string }>;
  
  cancelOrder(symbol: string, orderId: string): Promise<void>;
  cancelAllOrders(symbol: string): Promise<void>;
  getOpenOrders(symbol: string): Promise<any[]>;
  
  // Market Data
  getTicker(symbol: string): Promise<{ price: number; volume: number }>;
  getFundingRate(symbol: string): Promise<FundingRate>;
  getKlines(symbol: string, interval: string, limit: number): Promise<any[]>;
  
  // WebSocket
  subscribePrice(symbol: string, callback: (price: number) => void): void;
  subscribePosition(symbol: string, callback: (position: Position) => void): void;
}

// ============================================================================
// AI Optimizer
// ============================================================================

export class GridAIOptimizer {
  /**
   * Calculate optimal leverage based on historical volatility
   */
  static calculateOptimalLeverage(
    klines: any[],
    maxLeverage: number = 10
  ): { leverage: number; volatility: number; confidence: number } {
    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < klines.length; i++) {
      const prevClose = parseFloat(klines[i - 1].close);
      const currClose = parseFloat(klines[i].close);
      returns.push((currClose - prevClose) / prevClose);
    }
    
    // Calculate volatility (standard deviation of returns)
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365); // Annualized
    
    // Higher volatility = lower recommended leverage
    // Using inverse relationship: leverage = 1 / (volatility * factor)
    const factor = 2; // Safety factor
    let optimalLeverage = Math.min(maxLeverage, Math.max(2, 1 / (volatility * factor)));
    optimalLeverage = Math.round(optimalLeverage);
    
    // Confidence based on data quality
    const confidence = Math.min(1, klines.length / 30);
    
    return {
      leverage: optimalLeverage,
      volatility,
      confidence
    };
  }
  
  /**
   * Calculate optimal grid range using support/resistance levels
   */
  static calculateOptimalRange(
    klines: any[],
    currentPrice: number
  ): { lower: number; upper: number; confidence: number } {
    const highs = klines.map(k => parseFloat(k.high));
    const lows = klines.map(k => parseFloat(k.low));
    
    // Find significant levels using percentiles
    const sortedHighs = [...highs].sort((a, b) => a - b);
    const sortedLows = [...lows].sort((a, b) => a - b);
    
    // 10th percentile of lows = support, 90th percentile of highs = resistance
    const supportIndex = Math.floor(sortedLows.length * 0.1);
    const resistanceIndex = Math.floor(sortedHighs.length * 0.9);
    
    let lower = sortedLows[supportIndex];
    let upper = sortedHighs[resistanceIndex];
    
    // Ensure current price is within range
    if (currentPrice < lower) lower = currentPrice * 0.95;
    if (currentPrice > upper) upper = currentPrice * 1.05;
    
    // Add buffer
    const range = upper - lower;
    lower -= range * 0.05;
    upper += range * 0.05;
    
    return {
      lower: Math.round(lower * 100) / 100,
      upper: Math.round(upper * 100) / 100,
      confidence: Math.min(1, klines.length / 30)
    };
  }
  
  /**
   * Calculate optimal grid count based on range and average volatility
   */
  static calculateOptimalGridCount(
    priceRange: { lower: number; upper: number },
    avgTrueRange: number,
    investmentAmount: number,
    leverage: number
  ): number {
    // Each grid should capture at least 2x ATR movement for meaningful profit
    const rangeSize = priceRange.upper - priceRange.lower;
    const optimalSpacing = avgTrueRange * 0.5;
    let gridCount = Math.floor(rangeSize / optimalSpacing);
    
    // Ensure minimum order size (at least $10 per grid with leverage)
    const perGridValue = (investmentAmount * leverage) / gridCount;
    while (perGridValue < 10 && gridCount > 5) {
      gridCount--;
    }
    
    // Clamp to reasonable range
    return Math.max(5, Math.min(200, gridCount));
  }
  
  /**
   * Calculate ATR (Average True Range)
   */
  static calculateATR(klines: any[], period: number = 14): number {
    const trs: number[] = [];
    
    for (let i = 1; i < klines.length; i++) {
      const high = parseFloat(klines[i].high);
      const low = parseFloat(klines[i].low);
      const prevClose = parseFloat(klines[i - 1].close);
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trs.push(tr);
    }
    
    // Simple moving average of TR
    const recentTRs = trs.slice(-period);
    return recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length;
  }
}

// ============================================================================
// Leveraged Grid Bot
// ============================================================================

export class LeveragedGridBot extends EventEmitter {
  private config: LeveragedGridConfig;
  private exchange: FuturesExchange;
  private grids: GridLevel[] = [];
  private currentPrice: number = 0;
  private stats: GridStats;
  private isRunning: boolean = false;
  private initialEquity: number = 0;
  private peakEquity: number = 0;
  
  constructor(config: LeveragedGridConfig, exchange: FuturesExchange) {
    super();
    this.config = config;
    this.exchange = exchange;
    this.stats = this.initStats();
  }
  
  private initStats(): GridStats {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnl: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      fundingPaid: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      runTime: 0,
      apy: 0
    };
  }
  
  /**
   * Initialize the bot with AI optimization if enabled
   */
  async initialize(): Promise<void> {
    this.emit('log', 'Initializing Leveraged Grid Bot...');
    
    // Get current price
    const ticker = await this.exchange.getTicker(this.config.symbol);
    this.currentPrice = ticker.price;
    
    // AI Optimization
    if (this.config.aiOptimization.enabled) {
      await this.runAIOptimization();
    }
    
    // Validate configuration
    this.validateConfig();
    
    // Set exchange configuration
    await this.exchange.setLeverage(this.config.symbol, this.config.leverage);
    await this.exchange.setMarginMode(this.config.symbol, this.config.marginMode);
    
    // Build grid levels
    this.buildGrid();
    
    // Get initial balance
    const balance = await this.exchange.getBalance();
    this.initialEquity = balance.available;
    this.peakEquity = this.initialEquity;
    
    this.emit('initialized', {
      config: this.config,
      grids: this.grids,
      currentPrice: this.currentPrice,
      initialEquity: this.initialEquity
    });
  }
  
  /**
   * Run AI optimization to adjust parameters
   */
  private async runAIOptimization(): Promise<void> {
    this.emit('log', 'Running AI optimization...');
    
    const klines = await this.exchange.getKlines(
      this.config.symbol,
      '1d',
      this.config.aiOptimization.lookbackDays
    );
    
    // Optimize leverage
    if (this.config.aiOptimization.adjustLeverage) {
      const leverageResult = GridAIOptimizer.calculateOptimalLeverage(
        klines,
        this.config.leverage
      );
      
      if (leverageResult.confidence > 0.7) {
        this.emit('log', `AI suggests leverage: ${leverageResult.leverage}x (volatility: ${(leverageResult.volatility * 100).toFixed(1)}%)`);
        this.config.leverage = leverageResult.leverage;
      }
    }
    
    // Optimize grid spacing
    if (this.config.aiOptimization.adjustGridSpacing) {
      const rangeResult = GridAIOptimizer.calculateOptimalRange(klines, this.currentPrice);
      
      if (rangeResult.confidence > 0.7) {
        this.emit('log', `AI suggests range: $${rangeResult.lower} - $${rangeResult.upper}`);
        this.config.priceRange = { lower: rangeResult.lower, upper: rangeResult.upper };
      }
      
      const atr = GridAIOptimizer.calculateATR(klines);
      const optimalGridCount = GridAIOptimizer.calculateOptimalGridCount(
        this.config.priceRange,
        atr,
        this.config.investmentAmount,
        this.config.leverage
      );
      
      this.emit('log', `AI suggests grid count: ${optimalGridCount}`);
      this.config.gridCount = optimalGridCount;
    }
  }
  
  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const { priceRange, gridCount, leverage, investmentAmount } = this.config;
    
    if (priceRange.lower >= priceRange.upper) {
      throw new Error('Lower price must be less than upper price');
    }
    
    if (gridCount < 2 || gridCount > 500) {
      throw new Error('Grid count must be between 2 and 500');
    }
    
    if (leverage < 1 || leverage > 125) {
      throw new Error('Leverage must be between 1 and 125');
    }
    
    if (investmentAmount < 10) {
      throw new Error('Minimum investment is $10');
    }
    
    // Check if current price is within range
    if (this.currentPrice < priceRange.lower || this.currentPrice > priceRange.upper) {
      this.emit('warning', `Current price ${this.currentPrice} is outside grid range. Adjusting...`);
      // Adjust range to include current price
      const rangeSize = priceRange.upper - priceRange.lower;
      if (this.currentPrice < priceRange.lower) {
        this.config.priceRange.lower = this.currentPrice * 0.95;
        this.config.priceRange.upper = this.config.priceRange.lower + rangeSize;
      } else {
        this.config.priceRange.upper = this.currentPrice * 1.05;
        this.config.priceRange.lower = this.config.priceRange.upper - rangeSize;
      }
    }
  }
  
  /**
   * Build grid levels based on configuration
   */
  private buildGrid(): void {
    const { priceRange, gridCount, gridType, investmentAmount, leverage } = this.config;
    
    const gridSpacing = (priceRange.upper - priceRange.lower) / gridCount;
    const perGridValue = (investmentAmount * leverage) / gridCount;
    
    this.grids = [];
    
    for (let i = 0; i <= gridCount; i++) {
      const price = priceRange.lower + (gridSpacing * i);
      const quantity = perGridValue / price;
      
      // Determine grid direction based on type and position relative to current price
      let side: 'buy' | 'sell';
      let positionSide: PositionSide;
      
      switch (gridType) {
        case 'long':
          // Long grid: buy below current, sell above current
          side = price < this.currentPrice ? 'buy' : 'sell';
          positionSide = 'LONG';
          break;
          
        case 'short':
          // Short grid: sell above current, buy below current
          side = price > this.currentPrice ? 'sell' : 'buy';
          positionSide = 'SHORT';
          break;
          
        case 'neutral':
        default:
          // Neutral: both directions
          if (price < this.currentPrice) {
            side = 'buy';
            positionSide = 'LONG';
          } else {
            side = 'sell';
            positionSide = 'SHORT';
          }
          break;
      }
      
      this.grids.push({
        id: `grid-${i}`,
        price: Math.round(price * 100) / 100,
        side,
        positionSide,
        quantity: Math.round(quantity * 1000000) / 1000000,
        filled: false
      });
    }
    
    this.emit('log', `Built ${this.grids.length} grid levels from $${priceRange.lower} to $${priceRange.upper}`);
  }
  
  /**
   * Start the grid bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Bot is already running');
    }
    
    this.isRunning = true;
    this.emit('started');
    
    // Place initial grid orders
    await this.placeGridOrders();
    
    // Subscribe to price updates
    this.exchange.subscribePrice(this.config.symbol, (price) => {
      this.onPriceUpdate(price);
    });
    
    // Subscribe to position updates
    this.exchange.subscribePosition(this.config.symbol, (position) => {
      this.onPositionUpdate(position);
    });
    
    // Start funding rate monitor
    this.startFundingMonitor();
    
    // Start drawdown monitor
    this.startDrawdownMonitor();
    
    this.emit('log', 'Leveraged Grid Bot started successfully');
  }
  
  /**
   * Place all grid orders
   */
  private async placeGridOrders(): Promise<void> {
    this.emit('log', 'Placing grid orders...');
    
    let placedCount = 0;
    
    for (const grid of this.grids) {
      if (grid.filled) continue;
      
      // Skip grids at current price level
      if (Math.abs(grid.price - this.currentPrice) / this.currentPrice < 0.001) {
        continue;
      }
      
      try {
        const order = await this.exchange.createOrder({
          symbol: this.config.symbol,
          side: grid.side,
          positionSide: grid.positionSide,
          type: 'limit',
          quantity: grid.quantity,
          price: grid.price
        });
        
        grid.orderId = order.orderId;
        placedCount++;
      } catch (error: any) {
        this.emit('error', `Failed to place order at ${grid.price}: ${error.message}`);
      }
    }
    
    this.emit('log', `Placed ${placedCount} grid orders`);
  }
  
  /**
   * Handle price updates
   */
  private async onPriceUpdate(price: number): Promise<void> {
    this.currentPrice = price;
    
    // Check for filled grids and place counter orders
    for (const grid of this.grids) {
      if (!grid.filled && grid.orderId) {
        // Check if this grid level was crossed
        const crossed = grid.side === 'buy' 
          ? price <= grid.price 
          : price >= grid.price;
          
        if (crossed) {
          // Mark as filled and place counter order
          await this.onGridFilled(grid);
        }
      }
    }
    
    // Handle trailing if enabled
    if (this.config.trailing.enabled) {
      await this.handleTrailing();
    }
    
    this.emit('priceUpdate', { price, stats: this.stats });
  }
  
  /**
   * Handle grid fill
   */
  private async onGridFilled(grid: GridLevel): Promise<void> {
    grid.filled = true;
    grid.filledAt = new Date();
    
    this.stats.totalTrades++;
    
    // Calculate P&L for this grid
    const gridProfit = this.calculateGridProfit(grid);
    grid.pnl = gridProfit;
    
    if (gridProfit > 0) {
      this.stats.winningTrades++;
    } else {
      this.stats.losingTrades++;
    }
    
    this.stats.realizedPnl += gridProfit;
    this.stats.totalPnl = this.stats.realizedPnl + this.stats.unrealizedPnl;
    
    this.emit('gridFilled', { grid, profit: gridProfit, stats: this.stats });
    
    // Place counter order (opposite side at same price)
    try {
      const counterSide = grid.side === 'buy' ? 'sell' : 'buy';
      
      await this.exchange.createOrder({
        symbol: this.config.symbol,
        side: counterSide,
        positionSide: grid.positionSide,
        type: 'limit',
        quantity: grid.quantity,
        price: grid.price
      });
      
      // Reset grid for next cycle
      grid.filled = false;
      grid.side = counterSide;
      
    } catch (error: any) {
      this.emit('error', `Failed to place counter order: ${error.message}`);
    }
  }
  
  /**
   * Calculate profit for a grid trade
   */
  private calculateGridProfit(grid: GridLevel): number {
    const gridSpacing = (this.config.priceRange.upper - this.config.priceRange.lower) / this.config.gridCount;
    const profitPercent = (gridSpacing / grid.price) * this.config.leverage;
    const profitUsd = (this.config.investmentAmount / this.config.gridCount) * profitPercent;
    return profitUsd;
  }
  
  /**
   * Handle position updates
   */
  private onPositionUpdate(position: Position): void {
    this.stats.unrealizedPnl = position.unrealizedPnl;
    this.stats.totalPnl = this.stats.realizedPnl + this.stats.unrealizedPnl;
    
    // Check liquidation risk
    const liqDistance = Math.abs(position.markPrice - position.liquidationPrice) / position.markPrice;
    if (liqDistance * 100 < this.config.riskManagement.liquidationBuffer) {
      this.emit('warning', `⚠️ LIQUIDATION RISK! Price: ${position.markPrice}, Liq: ${position.liquidationPrice}`);
      this.emit('liquidationRisk', { position, distance: liqDistance });
      
      // Auto-reduce position
      this.reducePosition(position, 0.5); // Reduce by 50%
    }
    
    this.emit('positionUpdate', { position, stats: this.stats });
  }
  
  /**
   * Reduce position size
   */
  private async reducePosition(position: Position, fraction: number): Promise<void> {
    const reduceAmount = position.size * fraction;
    
    try {
      await this.exchange.createOrder({
        symbol: this.config.symbol,
        side: position.side === 'LONG' ? 'sell' : 'buy',
        positionSide: position.side,
        type: 'market',
        quantity: reduceAmount,
        reduceOnly: true
      });
      
      this.emit('log', `Reduced position by ${fraction * 100}% to avoid liquidation`);
    } catch (error: any) {
      this.emit('error', `Failed to reduce position: ${error.message}`);
    }
  }
  
  /**
   * Handle trailing grid
   */
  private async handleTrailing(): Promise<void> {
    const { direction, triggerPercent } = this.config.trailing;
    const { lower, upper } = this.config.priceRange;
    
    let shouldTrail = false;
    let trailDirection: 'up' | 'down' | null = null;
    
    // Check if price moved enough to trigger trail
    const upperDistance = (upper - this.currentPrice) / upper;
    const lowerDistance = (this.currentPrice - lower) / lower;
    
    if (direction === 'up' || direction === 'both') {
      if (upperDistance * 100 < triggerPercent) {
        shouldTrail = true;
        trailDirection = 'up';
      }
    }
    
    if (direction === 'down' || direction === 'both') {
      if (lowerDistance * 100 < triggerPercent) {
        shouldTrail = true;
        trailDirection = 'down';
      }
    }
    
    if (shouldTrail && trailDirection) {
      await this.trailGrid(trailDirection);
    }
  }
  
  /**
   * Trail the grid in specified direction
   */
  private async trailGrid(direction: 'up' | 'down'): Promise<void> {
    const rangeSize = this.config.priceRange.upper - this.config.priceRange.lower;
    const shiftAmount = rangeSize * 0.1; // Shift by 10% of range
    
    // Cancel existing orders
    await this.exchange.cancelAllOrders(this.config.symbol);
    
    // Shift range
    if (direction === 'up') {
      this.config.priceRange.lower += shiftAmount;
      this.config.priceRange.upper += shiftAmount;
    } else {
      this.config.priceRange.lower -= shiftAmount;
      this.config.priceRange.upper -= shiftAmount;
    }
    
    // Rebuild and place new grid
    this.buildGrid();
    await this.placeGridOrders();
    
    this.emit('gridTrailed', { direction, newRange: this.config.priceRange });
  }
  
  /**
   * Monitor funding rate
   */
  private startFundingMonitor(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const funding = await this.exchange.getFundingRate(this.config.symbol);
        const fundingPercent = Math.abs(funding.fundingRate * 100);
        
        if (fundingPercent > this.config.riskManagement.fundingRateThreshold) {
          this.emit('warning', `⚠️ High funding rate: ${fundingPercent.toFixed(4)}%`);
        }
        
        // Track funding payments
        const position = await this.exchange.getPosition(this.config.symbol);
        if (position && position.size > 0) {
          const fundingPayment = position.size * funding.fundingRate * position.markPrice;
          this.stats.fundingPaid += Math.abs(fundingPayment);
        }
        
        this.emit('fundingUpdate', { funding, totalPaid: this.stats.fundingPaid });
      } catch (error) {
        // Silently ignore funding errors
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
  
  /**
   * Monitor drawdown
   */
  private startDrawdownMonitor(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const balance = await this.exchange.getBalance();
        const currentEquity = balance.total + this.stats.unrealizedPnl;
        
        // Update peak equity
        if (currentEquity > this.peakEquity) {
          this.peakEquity = currentEquity;
        }
        
        // Calculate drawdown
        this.stats.currentDrawdown = ((this.peakEquity - currentEquity) / this.peakEquity) * 100;
        
        if (this.stats.currentDrawdown > this.stats.maxDrawdown) {
          this.stats.maxDrawdown = this.stats.currentDrawdown;
        }
        
        // Check max drawdown threshold
        if (this.stats.currentDrawdown > this.config.riskManagement.maxDrawdownPercent) {
          this.emit('warning', `⚠️ MAX DRAWDOWN EXCEEDED: ${this.stats.currentDrawdown.toFixed(2)}%`);
          await this.emergencyStop();
        }
        
        // Calculate APY
        const runTimeHours = this.stats.runTime / 3600000;
        if (runTimeHours > 0) {
          const returnPercent = (this.stats.totalPnl / this.initialEquity) * 100;
          this.stats.apy = (returnPercent / runTimeHours) * 24 * 365;
        }
        
      } catch (error) {
        // Silently ignore
      }
    }, 60 * 1000); // Check every minute
  }
  
  /**
   * Emergency stop
   */
  async emergencyStop(): Promise<void> {
    this.emit('log', '🚨 EMERGENCY STOP - Max drawdown exceeded');
    
    // Cancel all orders
    await this.exchange.cancelAllOrders(this.config.symbol);
    
    // Close all positions
    const position = await this.exchange.getPosition(this.config.symbol);
    if (position && position.size > 0) {
      await this.exchange.createOrder({
        symbol: this.config.symbol,
        side: position.side === 'LONG' ? 'sell' : 'buy',
        positionSide: position.side,
        type: 'market',
        quantity: position.size,
        reduceOnly: true
      });
    }
    
    this.isRunning = false;
    this.emit('stopped', { reason: 'emergency', stats: this.stats });
  }
  
  /**
   * Stop the bot gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.emit('log', 'Stopping Leveraged Grid Bot...');
    
    // Cancel all pending orders
    await this.exchange.cancelAllOrders(this.config.symbol);
    
    this.isRunning = false;
    this.emit('stopped', { reason: 'manual', stats: this.stats });
  }
  
  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    config: LeveragedGridConfig;
    stats: GridStats;
    grids: GridLevel[];
    currentPrice: number;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      stats: this.stats,
      grids: this.grids,
      currentPrice: this.currentPrice
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLeveragedGridBot(
  config: Partial<LeveragedGridConfig>,
  exchange: FuturesExchange
): LeveragedGridBot {
  const defaultConfig: LeveragedGridConfig = {
    exchange: 'binance-futures',
    symbol: 'BTC/USDT:USDT',
    leverage: 5,
    gridType: 'neutral',
    priceRange: { lower: 90000, upper: 110000 },
    gridCount: 50,
    investmentAmount: 1000,
    marginMode: 'isolated',
    riskManagement: {
      maxDrawdownPercent: 15,
      liquidationBuffer: 10,
      maxPositionSize: 5000,
      fundingRateThreshold: 0.1
    },
    aiOptimization: {
      enabled: true,
      lookbackDays: 30,
      adjustLeverage: true,
      adjustGridSpacing: true
    },
    trailing: {
      enabled: false,
      direction: 'both',
      triggerPercent: 5
    }
  };
  
  const mergedConfig = { ...defaultConfig, ...config };
  return new LeveragedGridBot(mergedConfig, exchange);
}
