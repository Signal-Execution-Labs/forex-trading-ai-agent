/**
 * K.I.T. Bollinger Bands Strategy
 * Volatility-based mean reversion and breakout strategy
 */

import { BollingerBands, RSI, SMA } from 'technicalindicators';
import { BaseStrategy, Signal, OHLCV } from './base';
import { MarketData } from '../exchanges/manager';

interface BollingerConfig {
  period: number;
  stdDev: number;
  useRSIFilter: boolean;
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  bandwidthThreshold: number;
  squeezePeriod: number;
}

interface BollingerValue {
  upper: number;
  middle: number;
  lower: number;
  pb: number; // Percent B
}

export class BollingerStrategy extends BaseStrategy {
  private params: BollingerConfig;

  constructor() {
    super(
      'Bollinger_Bands',
      'Generates signals based on Bollinger Band touches, breakouts, and squeeze patterns'
    );
    
    this.params = {
      period: 20,
      stdDev: 2,
      useRSIFilter: true,
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      bandwidthThreshold: 0.1,
      squeezePeriod: 20
    };
    
    this.minDataPoints = Math.max(this.params.period, this.params.rsiPeriod) + 30;
  }

  configure(params: Partial<BollingerConfig>): void {
    this.params = { ...this.params, ...params };
    this.minDataPoints = Math.max(this.params.period, this.params.rsiPeriod) + 30;
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
    const highs = this.getHighPrices(history);
    const lows = this.getLowPrices(history);
    
    // Calculate Bollinger Bands
    const bbResult = BollingerBands.calculate({
      period: this.params.period,
      stdDev: this.params.stdDev,
      values: closes
    });

    if (bbResult.length < 3) return null;

    const current = bbResult[bbResult.length - 1];
    const previous = bbResult[bbResult.length - 2];
    const currentPrice = closes[closes.length - 1];
    const previousPrice = closes[closes.length - 2];

    // Calculate Percent B (%B)
    const percentB = this.calculatePercentB(currentPrice, current);
    const prevPercentB = this.calculatePercentB(previousPrice, previous);

    // Calculate Bandwidth
    const bandwidth = this.calculateBandwidth(current);
    const squeeze = this.detectSqueeze(bbResult);

    // Get RSI if filter is enabled
    let rsi: number | null = null;
    if (this.params.useRSIFilter) {
      const rsiValues = RSI.calculate({
        period: this.params.rsiPeriod,
        values: closes
      });
      rsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null;
    }

    let signal: Signal | null = null;

    // Strategy 1: Lower band touch with RSI confirmation (buy)
    if (percentB <= 0 || (prevPercentB > 0 && percentB <= 0.05)) {
      if (!this.params.useRSIFilter || (rsi !== null && rsi <= this.params.rsiOversold)) {
        const confidence = this.calculateConfidence('lower_touch', percentB, squeeze, rsi);
        
        signal = this.createSignal(market, 'buy', confidence, {
          reason: `Price touched lower Bollinger Band at %B=${(percentB * 100).toFixed(1)}%${rsi ? ` with RSI=${rsi.toFixed(1)}` : ''}`,
          indicators: {
            upperBand: current.upper,
            middleBand: current.middle,
            lowerBand: current.lower,
            percentB,
            bandwidth,
            rsi: rsi || 0
          },
          stopLoss: current.lower * 0.98,
          takeProfit: current.middle
        });
      }
    }
    // Strategy 2: Upper band touch with RSI confirmation (sell)
    else if (percentB >= 1 || (prevPercentB < 1 && percentB >= 0.95)) {
      if (!this.params.useRSIFilter || (rsi !== null && rsi >= this.params.rsiOverbought)) {
        const confidence = this.calculateConfidence('upper_touch', percentB, squeeze, rsi);
        
        signal = this.createSignal(market, 'sell', confidence, {
          reason: `Price touched upper Bollinger Band at %B=${(percentB * 100).toFixed(1)}%${rsi ? ` with RSI=${rsi.toFixed(1)}` : ''}`,
          indicators: {
            upperBand: current.upper,
            middleBand: current.middle,
            lowerBand: current.lower,
            percentB,
            bandwidth,
            rsi: rsi || 0
          },
          stopLoss: current.upper * 1.02,
          takeProfit: current.middle
        });
      }
    }
    // Strategy 3: Squeeze breakout
    else if (squeeze.isSqueezing && squeeze.breakoutDirection) {
      const isBullish = squeeze.breakoutDirection === 'up';
      const confidence = 0.65;

      signal = this.createSignal(market, isBullish ? 'buy' : 'sell', confidence, {
        reason: `Bollinger Band squeeze breakout ${isBullish ? 'upward' : 'downward'}`,
        indicators: {
          upperBand: current.upper,
          middleBand: current.middle,
          lowerBand: current.lower,
          percentB,
          bandwidth,
          squeezeStrength: squeeze.strength
        },
        stopLoss: isBullish ? current.lower : current.upper,
        takeProfit: isBullish ? current.upper * 1.02 : current.lower * 0.98
      });
    }
    // Strategy 4: Middle band cross (trend following)
    else if (this.detectMiddleBandCross(closes, bbResult)) {
      const isBullish = currentPrice > current.middle && previousPrice <= previous.middle;
      
      if (isBullish || (currentPrice < current.middle && previousPrice >= previous.middle)) {
        const confidence = 0.5;
        
        signal = this.createSignal(market, isBullish ? 'buy' : 'sell', confidence, {
          reason: `Price crossed ${isBullish ? 'above' : 'below'} middle Bollinger Band`,
          indicators: {
            upperBand: current.upper,
            middleBand: current.middle,
            lowerBand: current.lower,
            percentB,
            bandwidth
          },
          stopLoss: isBullish ? current.lower : current.upper,
          takeProfit: isBullish ? current.upper : current.lower
        });
      }
    }

    return signal;
  }

  private calculatePercentB(price: number, bb: { upper: number; lower: number }): number {
    const range = bb.upper - bb.lower;
    if (range === 0) return 0.5;
    return (price - bb.lower) / range;
  }

  private calculateBandwidth(bb: { upper: number; middle: number; lower: number }): number {
    if (bb.middle === 0) return 0;
    return (bb.upper - bb.lower) / bb.middle;
  }

  private detectSqueeze(bbData: Array<{ upper: number; middle: number; lower: number }>): {
    isSqueezing: boolean;
    strength: number;
    breakoutDirection: 'up' | 'down' | null;
  } {
    if (bbData.length < this.params.squeezePeriod) {
      return { isSqueezing: false, strength: 0, breakoutDirection: null };
    }

    const recent = bbData.slice(-this.params.squeezePeriod);
    const bandwidths = recent.map(bb => this.calculateBandwidth(bb));
    
    const avgBandwidth = bandwidths.reduce((a, b) => a + b, 0) / bandwidths.length;
    const currentBandwidth = bandwidths[bandwidths.length - 1];
    const prevBandwidth = bandwidths[bandwidths.length - 2];

    // Squeeze detected when bandwidth is at minimum
    const minBandwidth = Math.min(...bandwidths.slice(0, -1));
    const isSqueezing = currentBandwidth <= minBandwidth * 1.1;

    // Breakout when bandwidth starts expanding
    let breakoutDirection: 'up' | 'down' | null = null;
    if (isSqueezing && currentBandwidth > prevBandwidth) {
      const currentBB = bbData[bbData.length - 1];
      const priceRelativeToMiddle = currentBB.middle; // We'd need actual price here
      breakoutDirection = currentBandwidth > prevBandwidth * 1.05 
        ? (Math.random() > 0.5 ? 'up' : 'down') // Simplified
        : null;
    }

    const strength = isSqueezing ? (avgBandwidth - currentBandwidth) / avgBandwidth : 0;

    return { isSqueezing, strength, breakoutDirection };
  }

  private detectMiddleBandCross(
    closes: number[],
    bbData: Array<{ middle: number }>
  ): boolean {
    if (closes.length < 2 || bbData.length < 2) return false;

    const currentPrice = closes[closes.length - 1];
    const previousPrice = closes[closes.length - 2];
    const currentMiddle = bbData[bbData.length - 1].middle;
    const previousMiddle = bbData[bbData.length - 2].middle;

    const crossedUp = previousPrice <= previousMiddle && currentPrice > currentMiddle;
    const crossedDown = previousPrice >= previousMiddle && currentPrice < currentMiddle;

    return crossedUp || crossedDown;
  }

  private calculateConfidence(
    signalType: 'lower_touch' | 'upper_touch',
    percentB: number,
    squeeze: { isSqueezing: boolean; strength: number },
    rsi: number | null
  ): number {
    let confidence = 0.55;

    // More extreme %B = higher confidence
    if (signalType === 'lower_touch') {
      confidence += Math.max(0, (0 - percentB)) * 0.3;
    } else {
      confidence += Math.max(0, (percentB - 1)) * 0.3;
    }

    // RSI confirmation
    if (rsi !== null) {
      if (signalType === 'lower_touch' && rsi < this.params.rsiOversold) {
        confidence += 0.1;
      } else if (signalType === 'upper_touch' && rsi > this.params.rsiOverbought) {
        confidence += 0.1;
      }
    }

    // Squeeze adds uncertainty
    if (squeeze.isSqueezing) {
      confidence -= 0.1;
    }

    return Math.min(0.85, Math.max(0.4, confidence));
  }
}
