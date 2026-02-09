/**
 * K.I.T. SMA/EMA Crossover Strategy
 * Generates signals when fast MA crosses slow MA
 */

import { SMA, EMA, CrossUp, CrossDown } from 'technicalindicators';
import { BaseStrategy, Signal, OHLCV } from './base';
import { MarketData } from '../exchanges/manager';

interface CrossoverConfig {
  fastPeriod: number;
  slowPeriod: number;
  useEMA: boolean;
  confirmationBars: number;
  minCrossoverStrength: number;
}

export class SMACrossoverStrategy extends BaseStrategy {
  private params: CrossoverConfig;

  constructor() {
    super(
      'SMA_Crossover',
      'Generates buy signals on golden cross (fast MA crosses above slow MA) and sell signals on death cross (fast MA crosses below slow MA)'
    );
    
    this.params = {
      fastPeriod: 9,
      slowPeriod: 21,
      useEMA: true,
      confirmationBars: 1,
      minCrossoverStrength: 0.001
    };
    
    this.minDataPoints = this.params.slowPeriod + 10;
  }

  configure(params: Partial<CrossoverConfig>): void {
    this.params = { ...this.params, ...params };
    this.minDataPoints = this.params.slowPeriod + 10;
  }

  async analyze(data: MarketData[], historicalData?: Map<string, OHLCV[]>): Promise<Signal[]> {
    const signals: Signal[] = [];

    if (!historicalData) return signals;

    for (const market of data) {
      const history = historicalData.get(`${market.exchange}:${market.symbol}`);
      if (!history || !this.hasEnoughData(history)) continue;

      const signal = this.analyzeSymbol(market, history);
      if (signal) signals.push(signal);
    }

    return signals;
  }

  private analyzeSymbol(market: MarketData, history: OHLCV[]): Signal | null {
    const closes = this.getClosePrices(history);
    
    // Calculate Moving Averages
    const MAClass = this.params.useEMA ? EMA : SMA;
    
    const fastMA = MAClass.calculate({
      period: this.params.fastPeriod,
      values: closes
    });

    const slowMA = MAClass.calculate({
      period: this.params.slowPeriod,
      values: closes
    });

    if (fastMA.length < 2 || slowMA.length < 2) return null;

    // Align arrays (slow MA starts later)
    const offset = this.params.slowPeriod - this.params.fastPeriod;
    const alignedFastMA = fastMA.slice(offset);
    
    if (alignedFastMA.length < 2 || slowMA.length < 2) return null;

    // Get recent values
    const currentFast = alignedFastMA[alignedFastMA.length - 1];
    const previousFast = alignedFastMA[alignedFastMA.length - 2];
    const currentSlow = slowMA[slowMA.length - 1];
    const previousSlow = slowMA[slowMA.length - 2];

    // Detect crossover
    const crossUp = previousFast <= previousSlow && currentFast > currentSlow;
    const crossDown = previousFast >= previousSlow && currentFast < currentSlow;

    if (!crossUp && !crossDown) return null;

    // Calculate crossover strength
    const crossoverStrength = Math.abs(currentFast - currentSlow) / currentSlow;
    if (crossoverStrength < this.params.minCrossoverStrength) return null;

    // Calculate confidence based on strength and trend alignment
    const trendStrength = this.calculateTrendStrength(closes);
    const confidence = this.calculateConfidence(crossoverStrength, trendStrength, crossUp);

    // Calculate stop loss and take profit
    const atr = this.calculateATR(history, 14);
    const stopDistance = atr * 2;
    
    const side = crossUp ? 'buy' : 'sell';
    const stopLoss = crossUp ? market.price - stopDistance : market.price + stopDistance;
    const takeProfit = crossUp ? market.price + (stopDistance * 2) : market.price - (stopDistance * 2);

    return this.createSignal(market, side, confidence, {
      reason: crossUp 
        ? `Golden Cross: Fast ${this.params.useEMA ? 'EMA' : 'SMA'}(${this.params.fastPeriod}) crossed above Slow ${this.params.useEMA ? 'EMA' : 'SMA'}(${this.params.slowPeriod})`
        : `Death Cross: Fast ${this.params.useEMA ? 'EMA' : 'SMA'}(${this.params.fastPeriod}) crossed below Slow ${this.params.useEMA ? 'EMA' : 'SMA'}(${this.params.slowPeriod})`,
      indicators: {
        fastMA: currentFast,
        slowMA: currentSlow,
        crossoverStrength,
        trendStrength
      },
      stopLoss,
      takeProfit
    });
  }

  private calculateTrendStrength(closes: number[]): number {
    if (closes.length < 20) return 0;
    
    const recent = closes.slice(-20);
    const sma20 = recent.reduce((a, b) => a + b, 0) / 20;
    const currentPrice = recent[recent.length - 1];
    
    return (currentPrice - sma20) / sma20;
  }

  private calculateConfidence(crossoverStrength: number, trendStrength: number, isBuy: boolean): number {
    // Base confidence from crossover strength
    let confidence = Math.min(crossoverStrength * 100, 0.5);
    
    // Bonus if trend aligns with signal
    if ((isBuy && trendStrength > 0) || (!isBuy && trendStrength < 0)) {
      confidence += 0.2;
    }
    
    // Scale to reasonable range
    return Math.min(0.9, Math.max(0.3, confidence + 0.3));
  }

  private calculateATR(history: OHLCV[], period: number): number {
    if (history.length < period + 1) return 0;

    const trueRanges: number[] = [];
    
    for (let i = 1; i < history.length; i++) {
      const high = history[i].high;
      const low = history[i].low;
      const prevClose = history[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    const recentTR = trueRanges.slice(-period);
    return recentTR.reduce((a, b) => a + b, 0) / period;
  }
}
