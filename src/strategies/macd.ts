/**
 * K.I.T. MACD Strategy
 * Moving Average Convergence Divergence signal crossover strategy
 */

import { MACD, EMA } from 'technicalindicators';
import { BaseStrategy, Signal, OHLCV } from './base';
import { MarketData } from '../exchanges/manager';

interface MACDConfig {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  histogramThreshold: number;
  trendFilter: boolean;
  trendPeriod: number;
  zeroCrossEnabled: boolean;
}

interface MACDValue {
  MACD: number;
  signal: number;
  histogram: number;
}

export class MACDStrategy extends BaseStrategy {
  private params: MACDConfig;

  constructor() {
    super(
      'MACD_Strategy',
      'Generates signals based on MACD line crossing signal line and histogram analysis'
    );
    
    this.params = {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      histogramThreshold: 0,
      trendFilter: true,
      trendPeriod: 200,
      zeroCrossEnabled: true
    };
    
    this.minDataPoints = this.params.slowPeriod + this.params.signalPeriod + 20;
  }

  configure(params: Partial<MACDConfig>): void {
    this.params = { ...this.params, ...params };
    this.minDataPoints = this.params.slowPeriod + this.params.signalPeriod + 20;
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
    
    // Calculate MACD
    const macdResult = MACD.calculate({
      fastPeriod: this.params.fastPeriod,
      slowPeriod: this.params.slowPeriod,
      signalPeriod: this.params.signalPeriod,
      values: closes,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    }) as MACDValue[];

    if (macdResult.length < 3) return null;

    const current = macdResult[macdResult.length - 1];
    const previous = macdResult[macdResult.length - 2];
    const prevPrev = macdResult[macdResult.length - 3];

    if (!current.MACD || !current.signal || !previous.MACD || !previous.signal) return null;

    // Apply trend filter
    if (this.params.trendFilter) {
      const trend = this.getLongTermTrend(closes);
      // In uptrend, only take bullish signals; in downtrend, only bearish
      if (trend === 'up' && current.histogram < 0) return null;
      if (trend === 'down' && current.histogram > 0) return null;
    }

    // Detect signal line crossover
    const bullishCrossover = previous.MACD <= previous.signal && current.MACD > current.signal;
    const bearishCrossover = previous.MACD >= previous.signal && current.MACD < current.signal;

    // Detect zero line crossover
    const bullishZeroCross = this.params.zeroCrossEnabled && previous.MACD <= 0 && current.MACD > 0;
    const bearishZeroCross = this.params.zeroCrossEnabled && previous.MACD >= 0 && current.MACD < 0;

    // Detect histogram momentum
    const histogramMomentum = this.analyzeHistogramMomentum(macdResult);

    let signal: Signal | null = null;

    // Bullish signal
    if (bullishCrossover || (bullishZeroCross && current.histogram > 0)) {
      const confidence = this.calculateConfidence(current, histogramMomentum, 'bullish', bullishZeroCross);
      
      signal = this.createSignal(market, 'buy', confidence, {
        reason: bullishCrossover 
          ? `MACD bullish crossover: MACD(${current.MACD.toFixed(4)}) crossed above Signal(${current.signal.toFixed(4)})`
          : `MACD crossed above zero line with positive histogram`,
        indicators: {
          macd: current.MACD,
          signal: current.signal,
          histogram: current.histogram,
          histogramMomentum
        },
        stopLoss: market.price * 0.97,
        takeProfit: market.price * 1.06
      });
    }
    // Bearish signal
    else if (bearishCrossover || (bearishZeroCross && current.histogram < 0)) {
      const confidence = this.calculateConfidence(current, histogramMomentum, 'bearish', bearishZeroCross);
      
      signal = this.createSignal(market, 'sell', confidence, {
        reason: bearishCrossover
          ? `MACD bearish crossover: MACD(${current.MACD.toFixed(4)}) crossed below Signal(${current.signal.toFixed(4)})`
          : `MACD crossed below zero line with negative histogram`,
        indicators: {
          macd: current.MACD,
          signal: current.signal,
          histogram: current.histogram,
          histogramMomentum
        },
        stopLoss: market.price * 1.03,
        takeProfit: market.price * 0.94
      });
    }
    // Histogram divergence signal (early warning)
    else if (Math.abs(histogramMomentum) > 0.5) {
      const isBullish = histogramMomentum > 0 && current.histogram < 0;
      const isBearish = histogramMomentum < 0 && current.histogram > 0;

      if (isBullish) {
        signal = this.createSignal(market, 'buy', 0.55, {
          reason: `MACD histogram showing bullish momentum shift`,
          indicators: {
            macd: current.MACD,
            signal: current.signal,
            histogram: current.histogram,
            histogramMomentum
          },
          stopLoss: market.price * 0.96,
          takeProfit: market.price * 1.04
        });
      } else if (isBearish) {
        signal = this.createSignal(market, 'sell', 0.55, {
          reason: `MACD histogram showing bearish momentum shift`,
          indicators: {
            macd: current.MACD,
            signal: current.signal,
            histogram: current.histogram,
            histogramMomentum
          },
          stopLoss: market.price * 1.04,
          takeProfit: market.price * 0.96
        });
      }
    }

    return signal;
  }

  private getLongTermTrend(closes: number[]): 'up' | 'down' | 'neutral' {
    if (closes.length < this.params.trendPeriod) return 'neutral';

    const ema = EMA.calculate({
      period: this.params.trendPeriod,
      values: closes
    });

    if (ema.length === 0) return 'neutral';

    const currentPrice = closes[closes.length - 1];
    const currentEMA = ema[ema.length - 1];

    const deviation = (currentPrice - currentEMA) / currentEMA;

    if (deviation > 0.02) return 'up';
    if (deviation < -0.02) return 'down';
    return 'neutral';
  }

  private analyzeHistogramMomentum(macdData: MACDValue[]): number {
    if (macdData.length < 5) return 0;

    const recent = macdData.slice(-5);
    let momentum = 0;

    for (let i = 1; i < recent.length; i++) {
      const change = recent[i].histogram - recent[i - 1].histogram;
      momentum += change;
    }

    // Normalize
    const avgHistogram = recent.reduce((sum, d) => sum + Math.abs(d.histogram), 0) / recent.length;
    if (avgHistogram === 0) return 0;

    return momentum / avgHistogram;
  }

  private calculateConfidence(
    current: MACDValue,
    histogramMomentum: number,
    direction: 'bullish' | 'bearish',
    isZeroCross: boolean
  ): number {
    let confidence = 0.55;

    // Histogram strength
    const histogramStrength = Math.abs(current.histogram) / Math.abs(current.MACD || 1);
    confidence += Math.min(histogramStrength * 0.2, 0.15);

    // Momentum alignment
    if ((direction === 'bullish' && histogramMomentum > 0) ||
        (direction === 'bearish' && histogramMomentum < 0)) {
      confidence += 0.1;
    }

    // Zero cross adds confirmation
    if (isZeroCross) {
      confidence += 0.1;
    }

    // MACD distance from zero
    const macdStrength = Math.abs(current.MACD);
    if (macdStrength > 0.001) {
      confidence += 0.05;
    }

    return Math.min(0.9, Math.max(0.4, confidence));
  }
}
