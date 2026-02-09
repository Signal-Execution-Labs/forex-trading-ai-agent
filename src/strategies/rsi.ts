/**
 * K.I.T. RSI Strategy
 * Relative Strength Index overbought/oversold strategy
 */

import { RSI, SMA } from 'technicalindicators';
import { BaseStrategy, Signal, OHLCV } from './base';
import { MarketData } from '../exchanges/manager';

interface RSIConfig {
  period: number;
  overbought: number;
  oversold: number;
  divergenceLookback: number;
  useDivergence: boolean;
  trendFilter: boolean;
  trendPeriod: number;
}

export class RSIStrategy extends BaseStrategy {
  private params: RSIConfig;

  constructor() {
    super(
      'RSI_Strategy',
      'Generates signals based on RSI overbought/oversold levels and divergences'
    );
    
    this.params = {
      period: 14,
      overbought: 70,
      oversold: 30,
      divergenceLookback: 14,
      useDivergence: true,
      trendFilter: true,
      trendPeriod: 50
    };
    
    this.minDataPoints = Math.max(this.params.period, this.params.trendPeriod) + 20;
  }

  configure(params: Partial<RSIConfig>): void {
    this.params = { ...this.params, ...params };
    this.minDataPoints = Math.max(this.params.period, this.params.trendPeriod) + 20;
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
    
    // Calculate RSI
    const rsiValues = RSI.calculate({
      period: this.params.period,
      values: closes
    });

    if (rsiValues.length < 2) return null;

    const currentRSI = rsiValues[rsiValues.length - 1];
    const previousRSI = rsiValues[rsiValues.length - 2];

    // Check trend filter
    if (this.params.trendFilter) {
      const trend = this.getTrend(closes);
      // Only take buy signals in uptrend, sell in downtrend
      if (currentRSI <= this.params.oversold && trend === 'down') return null;
      if (currentRSI >= this.params.overbought && trend === 'up') return null;
    }

    // Detect divergence
    const divergence = this.params.useDivergence 
      ? this.detectDivergence(closes, rsiValues) 
      : null;

    let signal: Signal | null = null;

    // Oversold condition (potential buy)
    if (currentRSI <= this.params.oversold) {
      // Wait for RSI to turn up from oversold
      if (currentRSI > previousRSI) {
        const confidence = this.calculateConfidence(currentRSI, 'buy', divergence);
        signal = this.createSignal(market, 'buy', confidence, {
          reason: `RSI oversold reversal at ${currentRSI.toFixed(2)}${divergence === 'bullish' ? ' with bullish divergence' : ''}`,
          indicators: {
            rsi: currentRSI,
            previousRSI,
            oversoldLevel: this.params.oversold
          },
          stopLoss: market.price * 0.97,
          takeProfit: market.price * 1.06
        });
      }
    }
    // Overbought condition (potential sell)
    else if (currentRSI >= this.params.overbought) {
      // Wait for RSI to turn down from overbought
      if (currentRSI < previousRSI) {
        const confidence = this.calculateConfidence(currentRSI, 'sell', divergence);
        signal = this.createSignal(market, 'sell', confidence, {
          reason: `RSI overbought reversal at ${currentRSI.toFixed(2)}${divergence === 'bearish' ? ' with bearish divergence' : ''}`,
          indicators: {
            rsi: currentRSI,
            previousRSI,
            overboughtLevel: this.params.overbought
          },
          stopLoss: market.price * 1.03,
          takeProfit: market.price * 0.94
        });
      }
    }
    // Divergence signals in neutral zone
    else if (divergence) {
      if (divergence === 'bullish' && currentRSI < 50) {
        signal = this.createSignal(market, 'buy', 0.6, {
          reason: `Bullish RSI divergence detected at ${currentRSI.toFixed(2)}`,
          indicators: { rsi: currentRSI, divergence: 1 },
          stopLoss: market.price * 0.96,
          takeProfit: market.price * 1.08
        });
      } else if (divergence === 'bearish' && currentRSI > 50) {
        signal = this.createSignal(market, 'sell', 0.6, {
          reason: `Bearish RSI divergence detected at ${currentRSI.toFixed(2)}`,
          indicators: { rsi: currentRSI, divergence: -1 },
          stopLoss: market.price * 1.04,
          takeProfit: market.price * 0.92
        });
      }
    }

    return signal;
  }

  private getTrend(closes: number[]): 'up' | 'down' | 'neutral' {
    const sma = SMA.calculate({
      period: this.params.trendPeriod,
      values: closes
    });

    if (sma.length === 0) return 'neutral';

    const currentPrice = closes[closes.length - 1];
    const currentSMA = sma[sma.length - 1];

    const deviation = (currentPrice - currentSMA) / currentSMA;

    if (deviation > 0.01) return 'up';
    if (deviation < -0.01) return 'down';
    return 'neutral';
  }

  private detectDivergence(prices: number[], rsiValues: number[]): 'bullish' | 'bearish' | null {
    const lookback = this.params.divergenceLookback;
    
    if (prices.length < lookback || rsiValues.length < lookback) return null;

    const recentPrices = prices.slice(-lookback);
    const recentRSI = rsiValues.slice(-lookback);

    // Find local lows and highs
    const priceLows = this.findLocalExtremes(recentPrices, 'low');
    const priceHighs = this.findLocalExtremes(recentPrices, 'high');
    const rsiLows = this.findLocalExtremes(recentRSI, 'low');
    const rsiHighs = this.findLocalExtremes(recentRSI, 'high');

    // Bullish divergence: Lower price lows, higher RSI lows
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const priceDowntrend = recentPrices[priceLows[priceLows.length - 1]] < recentPrices[priceLows[priceLows.length - 2]];
      const rsiUptrend = recentRSI[rsiLows[rsiLows.length - 1]] > recentRSI[rsiLows[rsiLows.length - 2]];
      
      if (priceDowntrend && rsiUptrend) return 'bullish';
    }

    // Bearish divergence: Higher price highs, lower RSI highs
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const priceUptrend = recentPrices[priceHighs[priceHighs.length - 1]] > recentPrices[priceHighs[priceHighs.length - 2]];
      const rsiDowntrend = recentRSI[rsiHighs[rsiHighs.length - 1]] < recentRSI[rsiHighs[rsiHighs.length - 2]];
      
      if (priceUptrend && rsiDowntrend) return 'bearish';
    }

    return null;
  }

  private findLocalExtremes(values: number[], type: 'high' | 'low'): number[] {
    const extremes: number[] = [];
    
    for (let i = 1; i < values.length - 1; i++) {
      if (type === 'high') {
        if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
          extremes.push(i);
        }
      } else {
        if (values[i] < values[i - 1] && values[i] < values[i + 1]) {
          extremes.push(i);
        }
      }
    }
    
    return extremes;
  }

  private calculateConfidence(rsi: number, side: 'buy' | 'sell', divergence: string | null): number {
    let confidence = 0.5;

    // Extreme RSI values increase confidence
    if (side === 'buy') {
      confidence += (this.params.oversold - rsi) / this.params.oversold * 0.3;
    } else {
      confidence += (rsi - this.params.overbought) / (100 - this.params.overbought) * 0.3;
    }

    // Divergence confirmation
    if (divergence) {
      if ((side === 'buy' && divergence === 'bullish') || 
          (side === 'sell' && divergence === 'bearish')) {
        confidence += 0.15;
      }
    }

    return Math.min(0.9, Math.max(0.3, confidence));
  }
}
