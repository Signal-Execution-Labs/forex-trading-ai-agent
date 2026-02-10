/**
 * K.I.T. DCA Bot
 * 
 * Intelligent Dollar-Cost Averaging bot inspired by 3Commas
 * with AI-enhanced entry optimization.
 */

import { EventEmitter } from 'events';

export interface DCABotConfig {
  name: string;
  exchange: string;
  symbol: string;
  
  // Order sizing
  baseOrderSize: number;
  safetyOrderSize: number;
  maxSafetyOrders: number;
  safetyOrderDeviation: number;    // % drop per safety order
  safetyOrderMultiplier: number;   // Size increase per order
  
  // Take profit
  takeProfit: number;              // %
  trailingTP?: boolean;
  trailingDeviation?: number;      // %
  
  // Stop loss
  stopLoss?: number;               // %
  breakEvenStop?: number;          // Move SL to entry after X% profit
  
  // Schedule
  scheduleType: 'interval' | 'cron' | 'signal' | 'manual';
  intervalMs?: number;
  cronExpression?: string;
  
  // Conditions
  conditions?: DCACondition[];
  
  // AI features
  aiOptimization?: boolean;
  adaptiveSizing?: boolean;
}

export interface DCACondition {
  indicator: string;
  timeframe?: string;
  condition: 'lt' | 'gt' | 'eq' | 'between' | 'below_sma' | 'above_sma';
  value: number | [number, number];
  period?: number;
}

export interface DCAPosition {
  symbol: string;
  totalInvested: number;
  averagePrice: number;
  quantity: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  safetyOrdersUsed: number;
  lastOrderTime: Date;
}

export interface DCAOrder {
  id: string;
  type: 'base' | 'safety' | 'take_profit' | 'stop_loss';
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  filledAt: Date;
  safetyLevel?: number;
}

export class DCABot extends EventEmitter {
  private config: DCABotConfig;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private position: DCAPosition | null = null;
  private orders: DCAOrder[] = [];
  private scheduleTimer: NodeJS.Timeout | null = null;
  private priceCheckTimer: NodeJS.Timeout | null = null;
  
  constructor(config: Partial<DCABotConfig> & Pick<DCABotConfig, 'exchange' | 'symbol' | 'baseOrderSize'>) {
    super();
    this.config = {
      name: config.name || `DCA-${config.symbol}`,
      safetyOrderSize: config.baseOrderSize * 0.5,
      maxSafetyOrders: 5,
      safetyOrderDeviation: 2,
      safetyOrderMultiplier: 1.5,
      takeProfit: 5,
      trailingTP: true,
      trailingDeviation: 1,
      scheduleType: 'manual',
      aiOptimization: true,
      adaptiveSizing: true,
      ...config,
    };
  }
  
  /**
   * Start the DCA bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Bot is already running');
    }
    
    this.isRunning = true;
    this.isPaused = false;
    
    console.log(`[DCA Bot] Starting ${this.config.name}`);
    console.log(`[DCA Bot] Symbol: ${this.config.symbol}`);
    console.log(`[DCA Bot] Exchange: ${this.config.exchange}`);
    console.log(`[DCA Bot] Base Order: $${this.config.baseOrderSize}`);
    console.log(`[DCA Bot] Max Safety Orders: ${this.config.maxSafetyOrders}`);
    console.log(`[DCA Bot] Take Profit: ${this.config.takeProfit}%`);
    
    this.emit('started', this.config);
    
    // Start price monitoring
    this.startPriceMonitoring();
    
    // Start schedule if configured
    if (this.config.scheduleType === 'interval' && this.config.intervalMs) {
      this.startIntervalSchedule();
    }
    
    // Execute base order if no position exists
    if (!this.position) {
      await this.executeBaseOrder();
    }
  }
  
  /**
   * Stop the DCA bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    
    if (this.priceCheckTimer) {
      clearInterval(this.priceCheckTimer);
      this.priceCheckTimer = null;
    }
    
    console.log(`[DCA Bot] Stopped ${this.config.name}`);
    this.emit('stopped');
  }
  
  /**
   * Pause DCA (keeps monitoring, stops new orders)
   */
  pause(): void {
    this.isPaused = true;
    console.log(`[DCA Bot] Paused ${this.config.name}`);
    this.emit('paused');
  }
  
  /**
   * Resume DCA
   */
  resume(): void {
    this.isPaused = false;
    console.log(`[DCA Bot] Resumed ${this.config.name}`);
    this.emit('resumed');
  }
  
  /**
   * Get current position
   */
  getPosition(): DCAPosition | null {
    return this.position;
  }
  
  /**
   * Get order history
   */
  getOrders(): DCAOrder[] {
    return [...this.orders];
  }
  
  /**
   * Get bot status
   */
  getStatus(): {
    name: string;
    isRunning: boolean;
    isPaused: boolean;
    position: DCAPosition | null;
    ordersCount: number;
    config: DCABotConfig;
  } {
    return {
      name: this.config.name,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      position: this.position,
      ordersCount: this.orders.length,
      config: this.config,
    };
  }
  
  /**
   * Manually add funds to position
   */
  async addFunds(amount: number): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Bot is not running');
    }
    
    console.log(`[DCA Bot] Adding $${amount} to position`);
    await this.executeBuy(amount, 'base');
  }
  
  /**
   * Close entire position at market
   */
  async closePosition(): Promise<void> {
    if (!this.position || this.position.quantity <= 0) {
      throw new Error('No position to close');
    }
    
    console.log(`[DCA Bot] Closing position: ${this.position.quantity} ${this.config.symbol}`);
    await this.executeSell(this.position.quantity, 'take_profit');
    this.position = null;
  }
  
  /**
   * Update take profit level
   */
  setTakeProfit(percent: number): void {
    this.config.takeProfit = percent;
    console.log(`[DCA Bot] Take profit updated to ${percent}%`);
    this.emit('configUpdated', { takeProfit: percent });
  }
  
  /**
   * Update stop loss level
   */
  setStopLoss(percent: number | undefined): void {
    this.config.stopLoss = percent;
    console.log(`[DCA Bot] Stop loss updated to ${percent ? percent + '%' : 'disabled'}`);
    this.emit('configUpdated', { stopLoss: percent });
  }
  
  // ─── Private Methods ───────────────────────────────────────────────────────
  
  private startPriceMonitoring(): void {
    // Check price every 10 seconds
    this.priceCheckTimer = setInterval(async () => {
      if (!this.isRunning || !this.position) return;
      
      try {
        const currentPrice = await this.getCurrentPrice();
        await this.checkPriceConditions(currentPrice);
      } catch (error) {
        console.error('[DCA Bot] Price check error:', error);
      }
    }, 10000);
  }
  
  private startIntervalSchedule(): void {
    this.scheduleTimer = setInterval(async () => {
      if (!this.isRunning || this.isPaused) return;
      
      // Check conditions before DCA
      const conditionsMet = await this.checkConditions();
      if (!conditionsMet) {
        console.log('[DCA Bot] Skipping scheduled DCA - conditions not met');
        return;
      }
      
      await this.executeDCA();
    }, this.config.intervalMs);
  }
  
  private async executeBaseOrder(): Promise<void> {
    if (this.isPaused) return;
    
    const conditionsMet = await this.checkConditions();
    if (!conditionsMet) {
      console.log('[DCA Bot] Waiting for conditions to be met for base order');
      return;
    }
    
    await this.executeBuy(this.config.baseOrderSize, 'base');
  }
  
  private async executeDCA(): Promise<void> {
    // Get current price and check if we should DCA
    const currentPrice = await this.getCurrentPrice();
    
    // AI optimization: Adjust size based on conditions
    let size = this.config.baseOrderSize;
    
    if (this.config.adaptiveSizing) {
      size = await this.calculateAdaptiveSize(currentPrice);
    }
    
    await this.executeBuy(size, 'base');
  }
  
  private async executeSafetyOrder(level: number): Promise<void> {
    if (this.isPaused) return;
    if (level > this.config.maxSafetyOrders) return;
    
    // Calculate safety order size with multiplier
    const size = this.config.safetyOrderSize * 
      Math.pow(this.config.safetyOrderMultiplier, level - 1);
    
    console.log(`[DCA Bot] Executing safety order #${level} - $${size.toFixed(2)}`);
    await this.executeBuy(size, 'safety', level);
  }
  
  private async executeBuy(amount: number, type: 'base' | 'safety', safetyLevel?: number): Promise<void> {
    const price = await this.getCurrentPrice();
    const quantity = amount / price;
    
    // TODO: Execute actual order via exchange connector
    console.log(`[DCA Bot] BUY ${quantity.toFixed(8)} ${this.config.symbol} @ $${price}`);
    
    const order: DCAOrder = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      side: 'buy',
      price,
      quantity,
      total: amount,
      filledAt: new Date(),
      safetyLevel,
    };
    
    this.orders.push(order);
    
    // Update position
    if (!this.position) {
      this.position = {
        symbol: this.config.symbol,
        totalInvested: amount,
        averagePrice: price,
        quantity,
        currentPrice: price,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        safetyOrdersUsed: type === 'safety' ? 1 : 0,
        lastOrderTime: new Date(),
      };
    } else {
      const newTotalInvested = this.position.totalInvested + amount;
      const newQuantity = this.position.quantity + quantity;
      this.position.averagePrice = newTotalInvested / newQuantity;
      this.position.totalInvested = newTotalInvested;
      this.position.quantity = newQuantity;
      this.position.currentPrice = price;
      this.position.lastOrderTime = new Date();
      if (type === 'safety') {
        this.position.safetyOrdersUsed++;
      }
    }
    
    this.emit(type === 'safety' ? 'safetyOrder' : 'baseOrder', order, safetyLevel);
  }
  
  private async executeSell(quantity: number, type: 'take_profit' | 'stop_loss'): Promise<void> {
    const price = await this.getCurrentPrice();
    const total = quantity * price;
    
    console.log(`[DCA Bot] SELL ${quantity.toFixed(8)} ${this.config.symbol} @ $${price}`);
    
    const order: DCAOrder = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      side: 'sell',
      price,
      quantity,
      total,
      filledAt: new Date(),
    };
    
    this.orders.push(order);
    
    const profit = this.position ? 
      (total - this.position.totalInvested) : 0;
    const profitPercent = this.position ? 
      ((price - this.position.averagePrice) / this.position.averagePrice) * 100 : 0;
    
    this.emit(type, { profit, profitPercent, order });
  }
  
  private async checkPriceConditions(currentPrice: number): Promise<void> {
    if (!this.position) return;
    
    // Update position with current price
    this.position.currentPrice = currentPrice;
    this.position.unrealizedPnL = 
      (currentPrice * this.position.quantity) - this.position.totalInvested;
    this.position.unrealizedPnLPercent = 
      ((currentPrice - this.position.averagePrice) / this.position.averagePrice) * 100;
    
    // Check take profit
    if (this.position.unrealizedPnLPercent >= this.config.takeProfit) {
      console.log(`[DCA Bot] Take profit hit! PnL: ${this.position.unrealizedPnLPercent.toFixed(2)}%`);
      await this.closePosition();
      return;
    }
    
    // Check stop loss
    if (this.config.stopLoss && this.position.unrealizedPnLPercent <= -this.config.stopLoss) {
      console.log(`[DCA Bot] Stop loss hit! PnL: ${this.position.unrealizedPnLPercent.toFixed(2)}%`);
      await this.executeSell(this.position.quantity, 'stop_loss');
      this.position = null;
      return;
    }
    
    // Check safety order trigger
    const priceDrop = ((this.position.averagePrice - currentPrice) / this.position.averagePrice) * 100;
    const expectedSafetyLevel = Math.floor(priceDrop / this.config.safetyOrderDeviation);
    
    if (expectedSafetyLevel > this.position.safetyOrdersUsed && 
        expectedSafetyLevel <= this.config.maxSafetyOrders) {
      await this.executeSafetyOrder(expectedSafetyLevel);
    }
  }
  
  private async checkConditions(): Promise<boolean> {
    if (!this.config.conditions || this.config.conditions.length === 0) {
      return true;
    }
    
    // TODO: Implement actual condition checking with indicators
    // For now, return true
    return true;
  }
  
  private async getCurrentPrice(): Promise<number> {
    // TODO: Get actual price from exchange connector
    // For demo, return simulated price
    return 45000 + (Math.random() - 0.5) * 1000;
  }
  
  private async calculateAdaptiveSize(currentPrice: number): Promise<number> {
    let size = this.config.baseOrderSize;
    
    if (!this.config.aiOptimization) return size;
    
    // AI-enhanced sizing based on:
    // 1. RSI - buy more when oversold
    // 2. Fear & Greed - buy more during fear
    // 3. Volatility - smaller orders in high volatility
    
    // TODO: Implement actual AI sizing
    // For now, simple example:
    const rsi = 50; // Would come from indicator
    
    if (rsi < 30) {
      size *= 1.5; // Buy 50% more when oversold
    } else if (rsi > 70) {
      size *= 0.5; // Buy 50% less when overbought
    }
    
    return size;
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

export function createDCABot(config: Partial<DCABotConfig> & Pick<DCABotConfig, 'exchange' | 'symbol' | 'baseOrderSize'>): DCABot {
  return new DCABot(config);
}

export function createBTCWeeklyDCA(baseOrderSize: number = 100): DCABot {
  return new DCABot({
    name: 'BTC Weekly DCA',
    exchange: 'binance',
    symbol: 'BTC/USDT',
    baseOrderSize,
    scheduleType: 'interval',
    intervalMs: 7 * 24 * 60 * 60 * 1000, // Weekly
    takeProfit: 50,
    trailingTP: true,
    trailingDeviation: 5,
    aiOptimization: true,
  });
}

export function createETHDailyDCA(baseOrderSize: number = 50): DCABot {
  return new DCABot({
    name: 'ETH Daily DCA',
    exchange: 'binance',
    symbol: 'ETH/USDT',
    baseOrderSize,
    scheduleType: 'interval',
    intervalMs: 24 * 60 * 60 * 1000, // Daily
    takeProfit: 30,
    aiOptimization: true,
  });
}
