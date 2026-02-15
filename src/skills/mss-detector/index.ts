/**
 * MSS Detector Skill (#67)
 * Market Structure Shift detection for reversal trading
 * Implements Smart Money Concepts (SMC) structure analysis
 */

import { Skill, SkillContext, SkillResult } from '../../types/skill.js';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface SwingPoint {
  type: 'high' | 'low';
  price: number;
  index: number;
  time: number;
  confirmed: boolean;
}

interface MSSSignal {
  type: 'BULLISH_MSS' | 'BEARISH_MSS' | 'MSS_SWEEP' | 'MSS_FAILED';
  confidence: number;
  entryZone: { start: number; end: number };
  stopLoss: number;
  targets: number[];
  timestamp: string;
  details: string;
}

interface MSSConfig {
  swingLookback: number;
  confirmationCandles: number;
  aiConfirmation: boolean;
  minSwingSize: number; // percentage
  liquiditySweep: boolean;
  timeframes: string[];
}

const DEFAULT_CONFIG: MSSConfig = {
  swingLookback: 10,
  confirmationCandles: 1,
  aiConfirmation: true,
  minSwingSize: 0.5,
  liquiditySweep: true,
  timeframes: ['15m', '1h', '4h'],
};

export class MSSDetectorSkill implements Skill {
  name = 'mss-detector';
  description = 'Detect market structure shifts for reversal trading';
  version = '1.0.0';

  private _config: MSSConfig;
  private logger: any;

  constructor(config: Partial<MSSConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    if (!context.input) {
      return { success: false, error: 'No input provided' };
    }

    this.logger = context.logger;
    const { action, params } = context.input;

    switch (action) {
      case 'detect':
      case 'analyze':
        return this.detectMSS(params);
      case 'multi-tf':
        return this.multiTimeframeAnalysis(params);
      case 'history':
        return this.getMSSHistory(params);
      case 'swings':
        return this.getSwingPoints(params);
      default:
        return this.detectMSS(params);
    }
  }

  private async detectMSS(params: any): Promise<SkillResult> {
    const { symbol, timeframe = '15m', candles, aiConfirm } = params || {};
    
    if (!symbol) {
      return { success: false, error: 'Symbol is required' };
    }

    try {
      // Get candle data (use provided or generate mock for demonstration)
      const candleData = candles || await this.fetchCandleData(symbol, timeframe);
      
      if (candleData.length < this._config.swingLookback * 2) {
        return { success: false, error: 'Insufficient candle data for analysis' };
      }

      // Identify swing points
      const swings = this.identifySwings(candleData);
      
      // Detect MSS
      const mssSignal = this.analyzeMSS(candleData, swings);
      
      // Check for liquidity sweep
      const liquiditySweep = this._config.liquiditySweep 
        ? this.detectLiquiditySweep(candleData, swings)
        : null;

      // AI confirmation if enabled
      let aiScore = null;
      if (this._config.aiConfirmation || aiConfirm) {
        aiScore = this.getAIConfirmation(mssSignal, liquiditySweep);
      }

      const result = {
        symbol,
        timeframe,
        timestamp: new Date().toISOString(),
        structure: this.identifyCurrentStructure(swings),
        swingPoints: swings.slice(-6), // Last 6 swings
        mssSignal,
        liquiditySweep,
        aiConfirmation: aiScore,
        recommendation: this.generateRecommendation(mssSignal, liquiditySweep, aiScore),
      };

      this.logger?.info(`MSS Analysis for ${symbol}/${timeframe}: ${mssSignal?.type || 'NO_SIGNAL'}`);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `MSS detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async multiTimeframeAnalysis(params: any): Promise<SkillResult> {
    const { symbol, timeframes } = params || {};
    const tfList = timeframes || this._config.timeframes;
    
    if (!symbol) {
      return { success: false, error: 'Symbol is required' };
    }

    const results: Record<string, any> = {};
    let alignment = 0;
    let bullishCount = 0;
    let bearishCount = 0;

    for (const tf of tfList) {
      const analysis = await this.detectMSS({ symbol, timeframe: tf });
      if (analysis.success) {
        results[tf] = analysis.data;
        if ((analysis.data as any).mssSignal?.type === 'BULLISH_MSS') {
          bullishCount++;
        } else if ((analysis.data as any).mssSignal?.type === 'BEARISH_MSS') {
          bearishCount++;
        }
      }
    }

    // Calculate alignment score
    const totalSignals = bullishCount + bearishCount;
    if (totalSignals > 0) {
      alignment = Math.abs(bullishCount - bearishCount) / totalSignals;
    }

    return {
      success: true,
      data: {
        symbol,
        timeframes: tfList,
        analyses: results,
        confluence: {
          bullishTimeframes: bullishCount,
          bearishTimeframes: bearishCount,
          alignmentScore: parseFloat(alignment.toFixed(2)),
          bias: bullishCount > bearishCount ? 'BULLISH' : bearishCount > bullishCount ? 'BEARISH' : 'NEUTRAL',
        },
        recommendation: this.getMultiTFRecommendation(bullishCount, bearishCount, tfList.length),
      },
    };
  }

  private async getMSSHistory(params: any): Promise<SkillResult> {
    const { symbol, timeframe = '1h', limit = 10 } = params || {};
    
    if (!symbol) {
      return { success: false, error: 'Symbol is required' };
    }

    // Generate mock historical MSS signals for demonstration
    const history: any[] = [];
    let lastType: 'BULLISH_MSS' | 'BEARISH_MSS' = 'BULLISH_MSS';

    for (let i = 0; i < limit; i++) {
      const date = new Date();
      date.setHours(date.getHours() - (i * 4));
      
      lastType = lastType === 'BULLISH_MSS' ? 'BEARISH_MSS' : 'BULLISH_MSS';
      
      history.push({
        timestamp: date.toISOString(),
        type: lastType,
        confidence: 0.6 + Math.random() * 0.35,
        outcome: Math.random() > 0.35 ? 'WIN' : 'LOSS',
        maxFavorableMove: parseFloat((Math.random() * 3).toFixed(2)) + '%',
      });
    }

    const wins = history.filter(h => h.outcome === 'WIN').length;

    return {
      success: true,
      data: {
        symbol,
        timeframe,
        history,
        statistics: {
          totalSignals: limit,
          wins,
          losses: limit - wins,
          winRate: parseFloat(((wins / limit) * 100).toFixed(1)) + '%',
          avgConfidence: parseFloat((history.reduce((sum, h) => sum + h.confidence, 0) / limit).toFixed(2)),
        },
      },
    };
  }

  private async getSwingPoints(params: any): Promise<SkillResult> {
    const { symbol, timeframe = '15m', candles } = params || {};
    
    if (!symbol) {
      return { success: false, error: 'Symbol is required' };
    }

    const candleData = candles || await this.fetchCandleData(symbol, timeframe);
    const swings = this.identifySwings(candleData);

    return {
      success: true,
      data: {
        symbol,
        timeframe,
        swings,
        currentStructure: this.identifyCurrentStructure(swings),
        keyLevels: {
          lastSwingHigh: swings.filter(s => s.type === 'high').slice(-1)[0]?.price,
          lastSwingLow: swings.filter(s => s.type === 'low').slice(-1)[0]?.price,
        },
      },
    };
  }

  private identifySwings(candles: Candle[]): SwingPoint[] {
    const swings: SwingPoint[] = [];
    const lookback = this._config.swingLookback;

    for (let i = lookback; i < candles.length - lookback; i++) {
      const candle = candles[i];
      
      // Check for swing high
      let isSwingHigh = true;
      let isSwingLow = true;

      for (let j = 1; j <= lookback; j++) {
        if (candles[i - j].high >= candle.high || candles[i + j].high >= candle.high) {
          isSwingHigh = false;
        }
        if (candles[i - j].low <= candle.low || candles[i + j].low <= candle.low) {
          isSwingLow = false;
        }
      }

      if (isSwingHigh) {
        swings.push({
          type: 'high',
          price: candle.high,
          index: i,
          time: candle.time,
          confirmed: true,
        });
      }

      if (isSwingLow) {
        swings.push({
          type: 'low',
          price: candle.low,
          index: i,
          time: candle.time,
          confirmed: true,
        });
      }
    }

    // Sort by index
    return swings.sort((a, b) => a.index - b.index);
  }

  private analyzeMSS(candles: Candle[], swings: SwingPoint[]): MSSSignal | null {
    if (swings.length < 4) return null;

    const currentPrice = candles[candles.length - 1].close;
    const recentSwings = swings.slice(-4);
    
    // Find last swing high and low
    const lastHigh = recentSwings.filter(s => s.type === 'high').pop();
    const lastLow = recentSwings.filter(s => s.type === 'low').pop();

    if (!lastHigh || !lastLow) return null;

    // Check for bullish MSS (break above last swing high in downtrend)
    if (currentPrice > lastHigh.price) {
      const priorLow = swings.filter(s => s.type === 'low' && s.index < lastHigh.index).pop();
      
      return {
        type: 'BULLISH_MSS',
        confidence: this.calculateConfidence(candles, lastHigh, 'bullish'),
        entryZone: {
          start: lastHigh.price * 0.998,
          end: lastHigh.price,
        },
        stopLoss: priorLow ? priorLow.price * 0.995 : lastLow.price * 0.995,
        targets: [
          lastHigh.price * 1.01,
          lastHigh.price * 1.02,
          lastHigh.price * 1.035,
        ],
        timestamp: new Date().toISOString(),
        details: `Price broke above swing high at ${lastHigh.price.toFixed(5)}, indicating potential bullish reversal`,
      };
    }

    // Check for bearish MSS (break below last swing low in uptrend)
    if (currentPrice < lastLow.price) {
      const priorHigh = swings.filter(s => s.type === 'high' && s.index < lastLow.index).pop();
      
      return {
        type: 'BEARISH_MSS',
        confidence: this.calculateConfidence(candles, lastLow, 'bearish'),
        entryZone: {
          start: lastLow.price,
          end: lastLow.price * 1.002,
        },
        stopLoss: priorHigh ? priorHigh.price * 1.005 : lastHigh.price * 1.005,
        targets: [
          lastLow.price * 0.99,
          lastLow.price * 0.98,
          lastLow.price * 0.965,
        ],
        timestamp: new Date().toISOString(),
        details: `Price broke below swing low at ${lastLow.price.toFixed(5)}, indicating potential bearish reversal`,
      };
    }

    return null;
  }

  private detectLiquiditySweep(candles: Candle[], swings: SwingPoint[]): any {
    if (swings.length < 3) return null;
    
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];
    const recentLow = swings.filter(s => s.type === 'low').slice(-1)[0];
    const recentHigh = swings.filter(s => s.type === 'high').slice(-1)[0];

    // Check for liquidity sweep below (wick below swing low but close above)
    if (recentLow && prevCandle.low < recentLow.price && prevCandle.close > recentLow.price) {
      return {
        type: 'BUY_SIDE_SWEEP',
        level: recentLow.price,
        wickDepth: ((recentLow.price - prevCandle.low) / recentLow.price * 100).toFixed(2) + '%',
        recovery: true,
        implication: 'Bullish - liquidity grabbed, potential reversal',
      };
    }

    // Check for liquidity sweep above (wick above swing high but close below)
    if (recentHigh && prevCandle.high > recentHigh.price && prevCandle.close < recentHigh.price) {
      return {
        type: 'SELL_SIDE_SWEEP',
        level: recentHigh.price,
        wickDepth: ((prevCandle.high - recentHigh.price) / recentHigh.price * 100).toFixed(2) + '%',
        recovery: true,
        implication: 'Bearish - liquidity grabbed, potential reversal',
      };
    }

    return null;
  }

  private calculateConfidence(candles: Candle[], swingPoint: SwingPoint, direction: 'bullish' | 'bearish'): number {
    let confidence = 0.6;

    // Check volume confirmation
    const avgVolume = candles.slice(-20).reduce((sum, c) => sum + (c.volume || 0), 0) / 20;
    const breakoutVolume = candles[candles.length - 1].volume || 0;
    if (breakoutVolume > avgVolume * 1.5) confidence += 0.15;

    // Check candle body size (strong close)
    const lastCandle = candles[candles.length - 1];
    const bodySize = Math.abs(lastCandle.close - lastCandle.open);
    const totalRange = lastCandle.high - lastCandle.low;
    if (bodySize / totalRange > 0.6) confidence += 0.1;

    // Check if price closed strong in direction
    if (direction === 'bullish' && lastCandle.close > lastCandle.open) confidence += 0.1;
    if (direction === 'bearish' && lastCandle.close < lastCandle.open) confidence += 0.1;

    return Math.min(0.95, confidence);
  }

  private identifyCurrentStructure(swings: SwingPoint[]): string {
    if (swings.length < 4) return 'UNDEFINED';

    const highs = swings.filter(s => s.type === 'high').slice(-3);
    const lows = swings.filter(s => s.type === 'low').slice(-3);

    if (highs.length < 2 || lows.length < 2) return 'UNDEFINED';

    const isHigherHighs = highs[highs.length - 1].price > highs[highs.length - 2].price;
    const isHigherLows = lows[lows.length - 1].price > lows[lows.length - 2].price;
    const isLowerHighs = highs[highs.length - 1].price < highs[highs.length - 2].price;
    const isLowerLows = lows[lows.length - 1].price < lows[lows.length - 2].price;

    if (isHigherHighs && isHigherLows) return 'BULLISH_TREND';
    if (isLowerHighs && isLowerLows) return 'BEARISH_TREND';
    if (isHigherHighs && isLowerLows) return 'EXPANSION';
    if (isLowerHighs && isHigherLows) return 'CONSOLIDATION';

    return 'CHOPPY';
  }

  private getAIConfirmation(mssSignal: MSSSignal | null, liquiditySweep: any): any {
    if (!mssSignal) return null;

    let score = mssSignal.confidence;
    
    // Boost score if liquidity sweep confirms
    if (liquiditySweep) {
      if (mssSignal.type === 'BULLISH_MSS' && liquiditySweep.type === 'BUY_SIDE_SWEEP') {
        score += 0.15;
      } else if (mssSignal.type === 'BEARISH_MSS' && liquiditySweep.type === 'SELL_SIDE_SWEEP') {
        score += 0.15;
      }
    }

    return {
      score: Math.min(0.98, score),
      recommendation: score > 0.75 ? 'TAKE_TRADE' : score > 0.6 ? 'WAIT_CONFIRMATION' : 'SKIP',
      factors: [
        mssSignal.confidence > 0.7 ? '✅ Strong structure break' : '⚠️ Weak structure break',
        liquiditySweep ? '✅ Liquidity sweep confirmed' : '⚠️ No liquidity sweep',
        score > 0.75 ? '✅ High probability setup' : '⚠️ Medium probability',
      ],
    };
  }

  private generateRecommendation(mssSignal: MSSSignal | null, liquiditySweep: any, aiScore: any): string {
    if (!mssSignal) {
      return 'No MSS detected. Wait for structure break.';
    }

    const hasLiqSweep = liquiditySweep !== null;
    const highConfidence = aiScore?.score > 0.75;

    if (mssSignal.type === 'BULLISH_MSS') {
      if (hasLiqSweep && highConfidence) {
        return `🟢 HIGH PROBABILITY LONG: MSS + Liquidity Sweep. Entry zone: ${mssSignal.entryZone.start.toFixed(5)} - ${mssSignal.entryZone.end.toFixed(5)}`;
      }
      return `🟡 BULLISH MSS detected. Consider longs on pullback to entry zone.`;
    }

    if (mssSignal.type === 'BEARISH_MSS') {
      if (hasLiqSweep && highConfidence) {
        return `🔴 HIGH PROBABILITY SHORT: MSS + Liquidity Sweep. Entry zone: ${mssSignal.entryZone.start.toFixed(5)} - ${mssSignal.entryZone.end.toFixed(5)}`;
      }
      return `🟡 BEARISH MSS detected. Consider shorts on pullback to entry zone.`;
    }

    return 'Mixed signals. Wait for cleaner setup.';
  }

  private getMultiTFRecommendation(bullish: number, bearish: number, total: number): string {
    const ratio = total > 0 ? Math.max(bullish, bearish) / total : 0;
    
    if (ratio >= 0.8) {
      return bullish > bearish 
        ? '🟢 STRONG BULLISH CONFLUENCE: Multiple timeframes showing bullish MSS'
        : '🔴 STRONG BEARISH CONFLUENCE: Multiple timeframes showing bearish MSS';
    }
    
    if (ratio >= 0.6) {
      return bullish > bearish
        ? '🟡 Moderate bullish bias - watch for confirmations'
        : '🟡 Moderate bearish bias - watch for confirmations';
    }
    
    return '⚪ No clear multi-timeframe alignment. Best to wait.';
  }

  private async fetchCandleData(symbol: string, timeframe: string): Promise<Candle[]> {
    // Generate mock candle data for demonstration
    // In production, this would call a real data provider
    const candles: Candle[] = [];
    let basePrice = symbol.includes('BTC') ? 45000 : symbol.includes('ETH') ? 2500 : 1.05;
    const now = Date.now();
    const tfMs = this.timeframeToMs(timeframe);

    for (let i = 100; i >= 0; i--) {
      const time = now - (i * tfMs);
      const change = (Math.random() - 0.5) * basePrice * 0.02;
      basePrice += change;
      
      const open = basePrice;
      const high = basePrice * (1 + Math.random() * 0.015);
      const low = basePrice * (1 - Math.random() * 0.015);
      const close = low + (high - low) * Math.random();
      
      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000000,
      });

      basePrice = close;
    }

    return candles;
  }

  private timeframeToMs(tf: string): number {
    const map: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };
    return map[tf] || 3600000;
  }
}

// Export singleton instance
export const mssDetector = new MSSDetectorSkill();
export default mssDetector;
