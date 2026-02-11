/**
 * TWAP Bot - Time-Weighted Average Price Execution
 * K.I.T. Financial Agent
 */

import { EventEmitter } from 'events';

export interface TWAPConfig {
  id?: string;
  symbol: string;
  side: 'buy' | 'sell';
  totalQuantity: number;
  durationMinutes: number;
  sliceCount?: number;
  minSliceSize?: number;
  maxSliceSize?: number;
  randomizeTime?: boolean;
  randomizeSize?: boolean;
  urgency?: 'low' | 'medium' | 'high';
  exchanges?: string[];
  priceLimit?: number;
  volumeParticipation?: number;
  adaptiveMode?: boolean;
}

export interface TWAPSlice {
  index: number;
  scheduledTime: Date;
  executedTime?: Date;
  targetQuantity: number;
  executedQuantity?: number;
  price?: number;
  exchange?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  error?: string;
}

export interface TWAPProgress {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  totalQuantity: number;
  executedQuantity: number;
  remainingQuantity: number;
  slicesCompleted: number;
  slicesTotal: number;
  averagePrice: number;
  startTime: Date;
  estimatedEndTime: Date;
  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'error';
  slices: TWAPSlice[];
}

export class TWAPBot extends EventEmitter {
  private config: TWAPConfig;
  private slices: TWAPSlice[] = [];
  private executedQuantity: number = 0;
  private totalCost: number = 0;
  private status: 'idle' | 'active' | 'paused' | 'completed' | 'cancelled' | 'error' = 'idle';
  private intervalId?: NodeJS.Timeout;
  private currentSliceIndex: number = 0;
  private startTime?: Date;
  private orderId: string;

  constructor(config: TWAPConfig) {
    super();
    this.config = {
      ...config,
      sliceCount: config.sliceCount || this.calculateOptimalSlices(config),
      randomizeTime: config.randomizeTime ?? true,
      randomizeSize: config.randomizeSize ?? false,
      urgency: config.urgency || 'medium',
      adaptiveMode: config.adaptiveMode ?? true,
    };
    this.orderId = config.id || `twap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.initializeSlices();
  }

  private calculateOptimalSlices(config: TWAPConfig): number {
    // Base slices on duration and urgency
    const baseSlices = Math.ceil(config.durationMinutes / 5); // One slice per 5 minutes default
    
    const urgencyMultiplier = {
      low: 0.5,
      medium: 1,
      high: 2,
    };

    return Math.max(
      Math.min(Math.ceil(baseSlices * urgencyMultiplier[config.urgency || 'medium']), 100),
      3 // Minimum 3 slices
    );
  }

  private initializeSlices(): void {
    const sliceCount = this.config.sliceCount!;
    const intervalMs = (this.config.durationMinutes * 60 * 1000) / sliceCount;
    const baseSliceSize = this.config.totalQuantity / sliceCount;

    for (let i = 0; i < sliceCount; i++) {
      let scheduledDelay = intervalMs * i;
      let sliceQuantity = baseSliceSize;

      // Add randomization if enabled
      if (this.config.randomizeTime) {
        const jitter = intervalMs * 0.15; // ±15%
        scheduledDelay += (Math.random() - 0.5) * 2 * jitter;
      }

      if (this.config.randomizeSize && i < sliceCount - 1) {
        const sizeJitter = baseSliceSize * 0.1; // ±10%
        sliceQuantity += (Math.random() - 0.5) * 2 * sizeJitter;
      }

      // Apply min/max constraints
      if (this.config.minSliceSize) {
        sliceQuantity = Math.max(sliceQuantity, this.config.minSliceSize);
      }
      if (this.config.maxSliceSize) {
        sliceQuantity = Math.min(sliceQuantity, this.config.maxSliceSize);
      }

      this.slices.push({
        index: i,
        scheduledTime: new Date(Date.now() + Math.max(0, scheduledDelay)),
        targetQuantity: sliceQuantity,
        status: 'pending',
      });
    }

    // Normalize slice quantities to match total
    this.normalizeSlices();
  }

  private normalizeSlices(): void {
    const currentTotal = this.slices.reduce((sum, s) => sum + s.targetQuantity, 0);
    const ratio = this.config.totalQuantity / currentTotal;
    
    let runningTotal = 0;
    this.slices.forEach((slice, i) => {
      if (i === this.slices.length - 1) {
        // Last slice gets the remainder
        slice.targetQuantity = this.config.totalQuantity - runningTotal;
      } else {
        slice.targetQuantity *= ratio;
        runningTotal += slice.targetQuantity;
      }
    });
  }

  async start(): Promise<void> {
    if (this.status === 'active') {
      throw new Error('TWAP already running');
    }

    this.status = 'active';
    this.startTime = new Date();
    this.emit('started', { orderId: this.orderId, config: this.config });

    // Execute first slice immediately
    await this.executeNextSlice();

    // Schedule remaining slices
    this.scheduleSlices();
  }

  private scheduleSlices(): void {
    const checkInterval = 1000; // Check every second
    
    this.intervalId = setInterval(async () => {
      if (this.status !== 'active') return;

      const now = Date.now();
      const pendingSlice = this.slices.find(
        s => s.status === 'pending' && s.scheduledTime.getTime() <= now
      );

      if (pendingSlice) {
        await this.executeSlice(pendingSlice);
      }

      // Check if all slices are complete
      if (this.slices.every(s => s.status === 'completed' || s.status === 'skipped' || s.status === 'failed')) {
        this.complete();
      }
    }, checkInterval);
  }

  private async executeNextSlice(): Promise<void> {
    const slice = this.slices.find(s => s.status === 'pending');
    if (slice) {
      await this.executeSlice(slice);
    }
  }

  private async executeSlice(slice: TWAPSlice): Promise<void> {
    slice.status = 'executing';
    this.emit('slice:executing', { orderId: this.orderId, slice });

    try {
      // Check price limit
      if (this.config.priceLimit) {
        const currentPrice = await this.getCurrentPrice();
        if (
          (this.config.side === 'buy' && currentPrice > this.config.priceLimit) ||
          (this.config.side === 'sell' && currentPrice < this.config.priceLimit)
        ) {
          slice.status = 'skipped';
          slice.error = 'Price limit exceeded';
          this.emit('slice:skipped', { orderId: this.orderId, slice, reason: 'price_limit' });
          return;
        }
      }

      // Adaptive mode: check liquidity
      if (this.config.adaptiveMode) {
        const adjustedQuantity = await this.adjustForLiquidity(slice.targetQuantity);
        slice.targetQuantity = adjustedQuantity;
      }

      // Execute the trade
      const result = await this.executeTrade(slice);
      
      slice.status = 'completed';
      slice.executedTime = new Date();
      slice.executedQuantity = result.quantity;
      slice.price = result.price;
      slice.exchange = result.exchange;

      this.executedQuantity += result.quantity;
      this.totalCost += result.quantity * result.price;

      this.emit('slice:completed', { orderId: this.orderId, slice, result });
    } catch (error) {
      slice.status = 'failed';
      slice.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('slice:failed', { orderId: this.orderId, slice, error });
    }
  }

  private async getCurrentPrice(): Promise<number> {
    // TODO: Integrate with exchange-connector
    // This is a placeholder
    return 0;
  }

  private async adjustForLiquidity(quantity: number): Promise<number> {
    // TODO: Check order book depth and adjust
    // If volume participation is set, ensure we don't exceed it
    if (this.config.volumeParticipation) {
      // Placeholder: would check actual volume
      const estimatedVolume = quantity * 100; // Fake
      const maxQuantity = estimatedVolume * this.config.volumeParticipation;
      return Math.min(quantity, maxQuantity);
    }
    return quantity;
  }

  private async executeTrade(slice: TWAPSlice): Promise<{
    quantity: number;
    price: number;
    exchange: string;
  }> {
    // TODO: Integrate with exchange-connector or smart-router
    // This is a placeholder that simulates execution
    
    const exchange = this.config.exchanges?.[0] || 'binance';
    
    // Simulate market execution
    // In reality, this would call the exchange API
    console.log(`[TWAP] Executing slice ${slice.index + 1}: ${this.config.side} ${slice.targetQuantity} ${this.config.symbol} on ${exchange}`);

    return {
      quantity: slice.targetQuantity,
      price: 0, // Would come from actual execution
      exchange,
    };
  }

  pause(): void {
    if (this.status !== 'active') return;
    this.status = 'paused';
    this.emit('paused', { orderId: this.orderId });
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.status = 'active';
    this.emit('resumed', { orderId: this.orderId });
  }

  cancel(): void {
    if (this.status === 'completed' || this.status === 'cancelled') return;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.status = 'cancelled';
    this.slices.filter(s => s.status === 'pending').forEach(s => {
      s.status = 'skipped';
      s.error = 'Cancelled by user';
    });

    this.emit('cancelled', { orderId: this.orderId, progress: this.getProgress() });
  }

  private complete(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.status = 'completed';
    this.emit('completed', { orderId: this.orderId, progress: this.getProgress() });
  }

  getProgress(): TWAPProgress {
    const completedSlices = this.slices.filter(s => s.status === 'completed').length;
    const averagePrice = this.executedQuantity > 0 
      ? this.totalCost / this.executedQuantity 
      : 0;

    return {
      orderId: this.orderId,
      symbol: this.config.symbol,
      side: this.config.side,
      totalQuantity: this.config.totalQuantity,
      executedQuantity: this.executedQuantity,
      remainingQuantity: this.config.totalQuantity - this.executedQuantity,
      slicesCompleted: completedSlices,
      slicesTotal: this.slices.length,
      averagePrice,
      startTime: this.startTime || new Date(),
      estimatedEndTime: new Date(
        (this.startTime?.getTime() || Date.now()) + this.config.durationMinutes * 60 * 1000
      ),
      status: this.status === 'idle' ? 'active' : this.status as any,
      slices: this.slices,
    };
  }

  getStatus(): string {
    return this.status;
  }

  getOrderId(): string {
    return this.orderId;
  }
}

// Helper function to create and start a TWAP order
export async function executeTWAP(config: TWAPConfig): Promise<TWAPBot> {
  const bot = new TWAPBot(config);
  await bot.start();
  return bot;
}

// Quick TWAP for simple use cases
export function quickTWAP(
  symbol: string,
  side: 'buy' | 'sell',
  quantity: number,
  durationMinutes: number = 60
): TWAPBot {
  return new TWAPBot({
    symbol,
    side,
    totalQuantity: quantity,
    durationMinutes,
    randomizeTime: true,
    randomizeSize: true,
    adaptiveMode: true,
  });
}

export default TWAPBot;
