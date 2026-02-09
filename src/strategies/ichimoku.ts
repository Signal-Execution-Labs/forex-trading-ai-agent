/**
 * K.I.T. Ichimoku Cloud Strategy
 * Comprehensive trend following system using Ichimoku Kinko Hyo
 */

import { IchimokuCloud } from 'technicalindicators';
import { BaseStrategy, Signal, OHLCV } from './base';
import { MarketData } from '../exchanges/manager';

interface IchimokuConfig {
  conversionPeriod: number;  // Tenkan-sen
  basePeriod: number;        // Kijun-sen
  spanPeriod: number;        // Senkou Span B
  displacement: number;      // Chikou Span displacement
  minCloudThickness: number;
  tkCrossEnabled: boolean;
  kumoBreakoutEnabled: boolean;
  chikouConfirmation: boolean;
}

interface IchimokuValue {
  conversion: number;   // Tenkan-sen
  base: number;         // Kijun-sen
  spanA: number;        // Senkou Span A
  spanB: number;        // Senkou Span B
}

export class IchimokuStrategy extends BaseStrategy {
  private params: IchimokuConfig;

  constructor() {
    super(
      'Ichimoku_Cloud',
      'Generates signals using Ichimoku Cloud (Kumo), TK cross, and Chikou span confirmation'
    );
    
    this.params = {
      conversionPeriod: 9,
      basePeriod: 26,
      spanPeriod: 52,
      displacement: 26,
      minCloudThickness: 0.005,
      tkCrossEnabled: true,
      kumoBreakoutEnabled: true,
      chikouConfirmation: true
    };
    
    this.minDataPoints = this.params.spanPeriod + this.params.displacement + 10;
  }

  configure(params: Partial<IchimokuConfig>): void {
    this.params = { ...this.params, ...params };
    this.minDataPoints = this.params.spanPeriod + this.params.displacement + 10;
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
    const highs = this.getHighPrices(history);
    const lows = this.getLowPrices(history);
    const closes = this.getClosePrices(history);
    
    // Calculate Ichimoku
    const ichimokuResult = IchimokuCloud.calculate({
      high: highs,
      low: lows,
      conversionPeriod: this.params.conversionPeriod,
      basePeriod: this.params.basePeriod,
      spanPeriod: this.params.spanPeriod,
      displacement: this.params.displacement
    }) as IchimokuValue[];

    if (ichimokuResult.length < 3) return null;

    const current = ichimokuResult[ichimokuResult.length - 1];
    const previous = ichimokuResult[ichimokuResult.length - 2];
    const currentPrice = closes[closes.length - 1];
    const previousPrice = closes[closes.length - 2];

    if (!current.conversion || !current.base || !current.spanA || !current.spanB) return null;

    // Analyze cloud (Kumo)
    const kumoAnalysis = this.analyzeKumo(current, currentPrice);
    
    // Analyze TK Cross (Tenkan-sen / Kijun-sen)
    const tkCross = this.params.tkCrossEnabled 
      ? this.detectTKCross(current, previous)
      : null;
    
    // Analyze Kumo Breakout
    const kumoBreakout = this.params.kumoBreakoutEnabled
      ? this.detectKumoBreakout(currentPrice, previousPrice, current, previous)
      : null;

    // Chikou Span Confirmation (price vs price 26 periods ago)
    const chikouConfirm = this.params.chikouConfirmation
      ? this.checkChikouConfirmation(closes)
      : true;

    let signal: Signal | null = null;

    // Strong bullish: TK Cross above cloud with Chikou confirmation
    if (tkCross === 'bullish' && kumoAnalysis.pricePosition === 'above' && chikouConfirm) {
      const confidence = this.calculateConfidence('tk_cross', kumoAnalysis, true);
      
      signal = this.createSignal(market, 'buy', confidence, {
        reason: `Ichimoku bullish TK cross above cloud - Strong buy signal`,
        indicators: {
          tenkanSen: current.conversion,
          kijunSen: current.base,
          senkouSpanA: current.spanA,
          senkouSpanB: current.spanB,
          cloudThickness: kumoAnalysis.thickness,
          priceVsCloud: kumoAnalysis.distanceFromCloud
        },
        stopLoss: Math.min(current.base, Math.min(current.spanA, current.spanB)),
        takeProfit: market.price * 1.08
      });
    }
    // Strong bearish: TK Cross below cloud
    else if (tkCross === 'bearish' && kumoAnalysis.pricePosition === 'below' && !chikouConfirm) {
      const confidence = this.calculateConfidence('tk_cross', kumoAnalysis, true);
      
      signal = this.createSignal(market, 'sell', confidence, {
        reason: `Ichimoku bearish TK cross below cloud - Strong sell signal`,
        indicators: {
          tenkanSen: current.conversion,
          kijunSen: current.base,
          senkouSpanA: current.spanA,
          senkouSpanB: current.spanB,
          cloudThickness: kumoAnalysis.thickness,
          priceVsCloud: kumoAnalysis.distanceFromCloud
        },
        stopLoss: Math.max(current.base, Math.max(current.spanA, current.spanB)),
        takeProfit: market.price * 0.92
      });
    }
    // Kumo breakout (bullish)
    else if (kumoBreakout === 'bullish') {
      const confidence = this.calculateConfidence('kumo_breakout', kumoAnalysis, chikouConfirm);
      
      signal = this.createSignal(market, 'buy', confidence, {
        reason: `Price broke above Ichimoku Cloud (Kumo breakout)`,
        indicators: {
          tenkanSen: current.conversion,
          kijunSen: current.base,
          senkouSpanA: current.spanA,
          senkouSpanB: current.spanB,
          cloudTop: Math.max(current.spanA, current.spanB)
        },
        stopLoss: Math.min(current.spanA, current.spanB),
        takeProfit: market.price * 1.06
      });
    }
    // Kumo breakout (bearish)
    else if (kumoBreakout === 'bearish') {
      const confidence = this.calculateConfidence('kumo_breakout', kumoAnalysis, !chikouConfirm);
      
      signal = this.createSignal(market, 'sell', confidence, {
        reason: `Price broke below Ichimoku Cloud (Kumo breakdown)`,
        indicators: {
          tenkanSen: current.conversion,
          kijunSen: current.base,
          senkouSpanA: current.spanA,
          senkouSpanB: current.spanB,
          cloudBottom: Math.min(current.spanA, current.spanB)
        },
        stopLoss: Math.max(current.spanA, current.spanB),
        takeProfit: market.price * 0.94
      });
    }
    // Weak signal: TK Cross in cloud (less reliable)
    else if (tkCross && kumoAnalysis.pricePosition === 'inside') {
      const confidence = 0.45;
      const isBuy = tkCross === 'bullish';
      
      signal = this.createSignal(market, isBuy ? 'buy' : 'sell', confidence, {
        reason: `Ichimoku ${tkCross} TK cross inside cloud - Weak signal, wait for confirmation`,
        indicators: {
          tenkanSen: current.conversion,
          kijunSen: current.base,
          senkouSpanA: current.spanA,
          senkouSpanB: current.spanB,
          inCloud: 1
        },
        stopLoss: isBuy ? Math.min(current.spanA, current.spanB) : Math.max(current.spanA, current.spanB),
        takeProfit: isBuy ? Math.max(current.spanA, current.spanB) * 1.02 : Math.min(current.spanA, current.spanB) * 0.98
      });
    }

    return signal;
  }

  private analyzeKumo(ichimoku: IchimokuValue, price: number): {
    pricePosition: 'above' | 'below' | 'inside';
    cloudColor: 'green' | 'red';
    thickness: number;
    distanceFromCloud: number;
  } {
    const cloudTop = Math.max(ichimoku.spanA, ichimoku.spanB);
    const cloudBottom = Math.min(ichimoku.spanA, ichimoku.spanB);
    const thickness = (cloudTop - cloudBottom) / cloudBottom;
    
    let pricePosition: 'above' | 'below' | 'inside';
    let distanceFromCloud: number;

    if (price > cloudTop) {
      pricePosition = 'above';
      distanceFromCloud = (price - cloudTop) / cloudTop;
    } else if (price < cloudBottom) {
      pricePosition = 'below';
      distanceFromCloud = (cloudBottom - price) / cloudBottom;
    } else {
      pricePosition = 'inside';
      distanceFromCloud = 0;
    }

    // Green cloud = bullish (Span A > Span B)
    const cloudColor = ichimoku.spanA > ichimoku.spanB ? 'green' : 'red';

    return { pricePosition, cloudColor, thickness, distanceFromCloud };
  }

  private detectTKCross(current: IchimokuValue, previous: IchimokuValue): 'bullish' | 'bearish' | null {
    if (!previous.conversion || !previous.base) return null;

    // Bullish: Tenkan crosses above Kijun
    if (previous.conversion <= previous.base && current.conversion > current.base) {
      return 'bullish';
    }
    // Bearish: Tenkan crosses below Kijun
    if (previous.conversion >= previous.base && current.conversion < current.base) {
      return 'bearish';
    }

    return null;
  }

  private detectKumoBreakout(
    currentPrice: number,
    previousPrice: number,
    current: IchimokuValue,
    previous: IchimokuValue
  ): 'bullish' | 'bearish' | null {
    const currentCloudTop = Math.max(current.spanA, current.spanB);
    const currentCloudBottom = Math.min(current.spanA, current.spanB);
    const previousCloudTop = Math.max(previous.spanA, previous.spanB);
    const previousCloudBottom = Math.min(previous.spanA, previous.spanB);

    // Bullish breakout: was inside or below, now above
    if (previousPrice <= previousCloudTop && currentPrice > currentCloudTop) {
      return 'bullish';
    }
    // Bearish breakdown: was inside or above, now below
    if (previousPrice >= previousCloudBottom && currentPrice < currentCloudBottom) {
      return 'bearish';
    }

    return null;
  }

  private checkChikouConfirmation(closes: number[]): boolean {
    if (closes.length < this.params.displacement + 1) return false;

    const currentPrice = closes[closes.length - 1];
    const priceNPeriodsAgo = closes[closes.length - 1 - this.params.displacement];

    // Chikou (current price) should be above price 26 periods ago for bullish
    return currentPrice > priceNPeriodsAgo;
  }

  private calculateConfidence(
    signalType: 'tk_cross' | 'kumo_breakout',
    kumoAnalysis: { pricePosition: string; cloudColor: string; thickness: number; distanceFromCloud: number },
    hasConfirmation: boolean
  ): number {
    let confidence = 0.5;

    // Signal type base confidence
    if (signalType === 'tk_cross') {
      confidence = 0.6;
    } else if (signalType === 'kumo_breakout') {
      confidence = 0.65;
    }

    // Price position
    if (kumoAnalysis.pricePosition !== 'inside') {
      confidence += 0.1;
    }

    // Cloud thickness (thicker cloud = stronger support/resistance)
    if (kumoAnalysis.thickness > this.params.minCloudThickness) {
      confidence += 0.05;
    }

    // Distance from cloud
    confidence += Math.min(kumoAnalysis.distanceFromCloud * 0.5, 0.1);

    // Chikou confirmation
    if (hasConfirmation) {
      confidence += 0.1;
    }

    return Math.min(0.9, Math.max(0.4, confidence));
  }
}
