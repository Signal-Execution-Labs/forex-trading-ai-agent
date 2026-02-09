/**
 * K.I.T. Base Strategy Class
 * Abstract foundation for all trading strategies
 */

import { MarketData } from '../exchanges/manager';

export interface Signal {
  symbol: string;
  exchange: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  strategy: string;
  confidence: number;
  timestamp: Date;
  reason?: string;
  indicators?: Record<string, number>;
  stopLoss?: number;
  takeProfit?: number;
}

export interface StrategyConfig {
  enabled: boolean;
  symbols?: string[];
  timeframe?: string;
  params: Record<string, any>;
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export abstract class BaseStrategy {
  protected name: string;
  protected description: string;
  protected config: StrategyConfig;
  protected minDataPoints: number = 50;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
    this.config = {
      enabled: true,
      params: {}
    };
  }

  /**
   * Analyze market data and generate trading signals
   */
  abstract analyze(data: MarketData[], historicalData?: Map<string, OHLCV[]>): Promise<Signal[]>;

  /**
   * Configure strategy parameters
   */
  configure(params: Partial<StrategyConfig>): void {
    this.config = { ...this.config, ...params };
  }

  /**
   * Get strategy name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get strategy description
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * Check if strategy is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get minimum required data points
   */
  getMinDataPoints(): number {
    return this.minDataPoints;
  }

  /**
   * Get current configuration
   */
  getConfig(): StrategyConfig {
    return { ...this.config };
  }

  /**
   * Validate historical data sufficiency
   */
  protected hasEnoughData(data: OHLCV[]): boolean {
    return data && data.length >= this.minDataPoints;
  }

  /**
   * Extract closing prices from OHLCV data
   */
  protected getClosePrices(data: OHLCV[]): number[] {
    return data.map(candle => candle.close);
  }

  /**
   * Extract high prices from OHLCV data
   */
  protected getHighPrices(data: OHLCV[]): number[] {
    return data.map(candle => candle.high);
  }

  /**
   * Extract low prices from OHLCV data
   */
  protected getLowPrices(data: OHLCV[]): number[] {
    return data.map(candle => candle.low);
  }

  /**
   * Extract volumes from OHLCV data
   */
  protected getVolumes(data: OHLCV[]): number[] {
    return data.map(candle => candle.volume);
  }

  /**
   * Calculate position size based on risk management
   */
  protected calculatePositionSize(
    price: number,
    stopLoss: number,
    riskPercent: number = 1,
    accountBalance: number = 10000
  ): number {
    const riskAmount = accountBalance * (riskPercent / 100);
    const priceDiff = Math.abs(price - stopLoss);
    if (priceDiff === 0) return 0;
    return riskAmount / priceDiff;
  }

  /**
   * Create a standardized signal object
   */
  protected createSignal(
    market: MarketData,
    side: 'buy' | 'sell',
    confidence: number,
    options: {
      reason?: string;
      indicators?: Record<string, number>;
      stopLoss?: number;
      takeProfit?: number;
      amount?: number;
    } = {}
  ): Signal {
    return {
      symbol: market.symbol,
      exchange: market.exchange,
      side,
      amount: options.amount || 0.01,
      price: market.price,
      strategy: this.name,
      confidence: Math.max(0, Math.min(1, confidence)),
      timestamp: new Date(),
      reason: options.reason,
      indicators: options.indicators,
      stopLoss: options.stopLoss,
      takeProfit: options.takeProfit
    };
  }

  /**
   * Normalize confidence to 0-1 range
   */
  protected normalizeConfidence(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }
}
