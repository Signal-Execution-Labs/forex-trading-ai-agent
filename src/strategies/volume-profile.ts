/**
 * K.I.T. Volume Profile Strategy
 * Volume-based analysis for identifying support/resistance and breakouts
 */

import { SMA, EMA, VWAP, OBV } from 'technicalindicators';
import { BaseStrategy, Signal, OHLCV } from './base';
import { MarketData } from '../exchanges/manager';

interface VolumeConfig {
  volumeMAPeriod: number;
  volumeSpikeMultiplier: number;
  obySensitivity: number;
  vwapEnabled: boolean;
  volumeProfileBins: number;
  lookbackPeriod: number;
}

interface VolumeProfileLevel {
  priceLevel: number;
  volume: number;
  isSupport: boolean;
  isResistance: boolean;
}

export class VolumeProfileStrategy extends BaseStrategy {
  private params: VolumeConfig;

  constructor() {
    super(
      'Volume_Profile',
      'Analyzes volume patterns, VWAP, OBV, and volume profile for trading signals'
    );
    
    this.params = {
      volumeMAPeriod: 20,
      volumeSpikeMultiplier: 2.0,
      obySensitivity: 0.02,
      vwapEnabled: true,
      volumeProfileBins: 20,
      lookbackPeriod: 50
    };
    
    this.minDataPoints = Math.max(this.params.volumeMAPeriod, this.params.lookbackPeriod) + 10;
  }

  configure(params: Partial<VolumeConfig>): void {
    this.params = { ...this.params, ...params };
    this.minDataPoints = Math.max(this.params.volumeMAPeriod, this.params.lookbackPeriod) + 10;
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
    const volumes = this.getVolumes(history);
    
    const currentPrice = closes[closes.length - 1];
    const currentVolume = volumes[volumes.length - 1];

    // Volume Analysis
    const volumeAnalysis = this.analyzeVolume(volumes);
    
    // OBV (On-Balance Volume) Analysis
    const obvAnalysis = this.analyzeOBV(closes, volumes);
    
    // Volume Profile (Value Areas)
    const volumeProfile = this.buildVolumeProfile(history);
    
    // VWAP Analysis
    const vwapAnalysis = this.params.vwapEnabled 
      ? this.analyzeVWAP(history, currentPrice)
      : null;

    // Price at key volume level
    const keyLevel = this.findNearestKeyLevel(volumeProfile, currentPrice);

    let signal: Signal | null = null;

    // Strategy 1: Volume Spike Breakout
    if (volumeAnalysis.isSpike && volumeAnalysis.spikeStrength > 1.5) {
      const priceChange = (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
      const isBullish = priceChange > 0;
      
      // Confirm with OBV
      const obvConfirms = (isBullish && obvAnalysis.trend === 'bullish') || 
                          (!isBullish && obvAnalysis.trend === 'bearish');
      
      if (obvConfirms) {
        const confidence = this.calculateSpikeConfidence(volumeAnalysis, obvAnalysis, isBullish);
        
        signal = this.createSignal(market, isBullish ? 'buy' : 'sell', confidence, {
          reason: `Volume spike (${volumeAnalysis.spikeStrength.toFixed(1)}x avg) with ${isBullish ? 'bullish' : 'bearish'} breakout confirmed by OBV`,
          indicators: {
            volumeSpike: volumeAnalysis.spikeStrength,
            volumeMA: volumeAnalysis.averageVolume,
            obvTrend: obvAnalysis.trend === 'bullish' ? 1 : -1,
            priceChange: priceChange * 100
          },
          stopLoss: isBullish ? market.price * 0.97 : market.price * 1.03,
          takeProfit: isBullish ? market.price * 1.05 : market.price * 0.95
        });
      }
    }
    // Strategy 2: OBV Divergence
    else if (obvAnalysis.divergence) {
      const isBullish = obvAnalysis.divergence === 'bullish';
      const confidence = 0.6;
      
      signal = this.createSignal(market, isBullish ? 'buy' : 'sell', confidence, {
        reason: `${isBullish ? 'Bullish' : 'Bearish'} OBV divergence detected`,
        indicators: {
          obv: obvAnalysis.currentOBV,
          obvMA: obvAnalysis.obvMA,
          divergence: isBullish ? 1 : -1
        },
        stopLoss: isBullish ? market.price * 0.96 : market.price * 1.04,
        takeProfit: isBullish ? market.price * 1.08 : market.price * 0.92
      });
    }
    // Strategy 3: VWAP Mean Reversion
    else if (vwapAnalysis && Math.abs(vwapAnalysis.deviation) > 0.02) {
      const isBullish = vwapAnalysis.deviation < -0.02; // Price below VWAP = buy
      const confidence = this.calculateVWAPConfidence(vwapAnalysis);
      
      signal = this.createSignal(market, isBullish ? 'buy' : 'sell', confidence, {
        reason: `Price ${isBullish ? 'below' : 'above'} VWAP by ${(Math.abs(vwapAnalysis.deviation) * 100).toFixed(1)}% - Mean reversion opportunity`,
        indicators: {
          vwap: vwapAnalysis.vwap,
          deviation: vwapAnalysis.deviation * 100,
          stdDev: vwapAnalysis.stdDev
        },
        stopLoss: isBullish ? market.price * 0.97 : market.price * 1.03,
        takeProfit: vwapAnalysis.vwap // Target VWAP
      });
    }
    // Strategy 4: Key Volume Level Bounce/Break
    else if (keyLevel && keyLevel.distance < 0.01) {
      const atSupport = keyLevel.level.isSupport && currentPrice >= keyLevel.level.priceLevel;
      const atResistance = keyLevel.level.isResistance && currentPrice <= keyLevel.level.priceLevel;
      
      if (atSupport && volumeAnalysis.trend === 'increasing') {
        signal = this.createSignal(market, 'buy', 0.55, {
          reason: `Price at high-volume support level with increasing volume`,
          indicators: {
            supportLevel: keyLevel.level.priceLevel,
            volumeAtLevel: keyLevel.level.volume,
            distanceToLevel: keyLevel.distance * 100
          },
          stopLoss: keyLevel.level.priceLevel * 0.98,
          takeProfit: market.price * 1.04
        });
      } else if (atResistance && volumeAnalysis.trend === 'decreasing') {
        signal = this.createSignal(market, 'sell', 0.55, {
          reason: `Price at high-volume resistance level with decreasing volume`,
          indicators: {
            resistanceLevel: keyLevel.level.priceLevel,
            volumeAtLevel: keyLevel.level.volume,
            distanceToLevel: keyLevel.distance * 100
          },
          stopLoss: keyLevel.level.priceLevel * 1.02,
          takeProfit: market.price * 0.96
        });
      }
    }

    return signal;
  }

  private analyzeVolume(volumes: number[]): {
    isSpike: boolean;
    spikeStrength: number;
    trend: 'increasing' | 'decreasing' | 'neutral';
    averageVolume: number;
  } {
    const recentVolumes = volumes.slice(-this.params.volumeMAPeriod);
    const averageVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const currentVolume = volumes[volumes.length - 1];
    
    const spikeStrength = currentVolume / averageVolume;
    const isSpike = spikeStrength >= this.params.volumeSpikeMultiplier;

    // Volume trend
    const firstHalf = volumes.slice(-this.params.volumeMAPeriod, -this.params.volumeMAPeriod / 2);
    const secondHalf = volumes.slice(-this.params.volumeMAPeriod / 2);
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trend: 'increasing' | 'decreasing' | 'neutral';
    if (secondHalfAvg > firstHalfAvg * 1.1) {
      trend = 'increasing';
    } else if (secondHalfAvg < firstHalfAvg * 0.9) {
      trend = 'decreasing';
    } else {
      trend = 'neutral';
    }

    return { isSpike, spikeStrength, trend, averageVolume };
  }

  private analyzeOBV(closes: number[], volumes: number[]): {
    currentOBV: number;
    obvMA: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    divergence: 'bullish' | 'bearish' | null;
  } {
    // Calculate OBV
    const obvValues = OBV.calculate({
      close: closes,
      volume: volumes
    });

    if (obvValues.length < 10) {
      return { currentOBV: 0, obvMA: 0, trend: 'neutral', divergence: null };
    }

    const currentOBV = obvValues[obvValues.length - 1];
    
    // OBV Moving Average
    const obvMA = SMA.calculate({
      period: 10,
      values: obvValues
    });
    const currentOBVMA = obvMA.length > 0 ? obvMA[obvMA.length - 1] : currentOBV;

    // Trend
    let trend: 'bullish' | 'bearish' | 'neutral';
    if (currentOBV > currentOBVMA * 1.02) {
      trend = 'bullish';
    } else if (currentOBV < currentOBVMA * 0.98) {
      trend = 'bearish';
    } else {
      trend = 'neutral';
    }

    // Divergence detection
    let divergence: 'bullish' | 'bearish' | null = null;
    const lookback = 14;
    
    if (closes.length >= lookback && obvValues.length >= lookback) {
      const priceChange = (closes[closes.length - 1] - closes[closes.length - lookback]) / closes[closes.length - lookback];
      const obvChange = (obvValues[obvValues.length - 1] - obvValues[obvValues.length - lookback]) / Math.abs(obvValues[obvValues.length - lookback]);

      // Bullish divergence: price down, OBV up
      if (priceChange < -this.params.obySensitivity && obvChange > this.params.obySensitivity) {
        divergence = 'bullish';
      }
      // Bearish divergence: price up, OBV down
      else if (priceChange > this.params.obySensitivity && obvChange < -this.params.obySensitivity) {
        divergence = 'bearish';
      }
    }

    return { currentOBV, obvMA: currentOBVMA, trend, divergence };
  }

  private analyzeVWAP(history: OHLCV[], currentPrice: number): {
    vwap: number;
    deviation: number;
    stdDev: number;
  } | null {
    if (history.length < 2) return null;

    // Simple VWAP calculation
    let cumulativeTPV = 0; // Typical Price * Volume
    let cumulativeVolume = 0;
    const tpvArray: number[] = [];

    for (const candle of history) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      cumulativeTPV += typicalPrice * candle.volume;
      cumulativeVolume += candle.volume;
      tpvArray.push(typicalPrice);
    }

    const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : currentPrice;
    const deviation = (currentPrice - vwap) / vwap;

    // Standard deviation from VWAP
    const squaredDiffs = tpvArray.map(tp => Math.pow(tp - vwap, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    return { vwap, deviation, stdDev };
  }

  private buildVolumeProfile(history: OHLCV[]): VolumeProfileLevel[] {
    const lookback = Math.min(this.params.lookbackPeriod, history.length);
    const recentHistory = history.slice(-lookback);

    // Find price range
    const allPrices = recentHistory.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const binSize = (maxPrice - minPrice) / this.params.volumeProfileBins;

    // Create bins
    const bins: { priceLevel: number; volume: number }[] = [];
    for (let i = 0; i < this.params.volumeProfileBins; i++) {
      bins.push({
        priceLevel: minPrice + binSize * (i + 0.5),
        volume: 0
      });
    }

    // Distribute volume across bins
    for (const candle of recentHistory) {
      const avgPrice = (candle.high + candle.low + candle.close) / 3;
      const binIndex = Math.min(
        Math.floor((avgPrice - minPrice) / binSize),
        this.params.volumeProfileBins - 1
      );
      if (binIndex >= 0) {
        bins[binIndex].volume += candle.volume;
      }
    }

    // Find POC (Point of Control) and Value Area
    const maxVolume = Math.max(...bins.map(b => b.volume));
    const avgVolume = bins.reduce((a, b) => a + b.volume, 0) / bins.length;

    // Mark support/resistance levels
    return bins.map(bin => ({
      ...bin,
      isSupport: bin.volume > avgVolume * 1.5 && bin.priceLevel < (minPrice + maxPrice) / 2,
      isResistance: bin.volume > avgVolume * 1.5 && bin.priceLevel > (minPrice + maxPrice) / 2
    }));
  }

  private findNearestKeyLevel(profile: VolumeProfileLevel[], currentPrice: number): {
    level: VolumeProfileLevel;
    distance: number;
  } | null {
    const keyLevels = profile.filter(l => l.isSupport || l.isResistance);
    if (keyLevels.length === 0) return null;

    let nearest = keyLevels[0];
    let minDistance = Math.abs(currentPrice - nearest.priceLevel) / currentPrice;

    for (const level of keyLevels) {
      const distance = Math.abs(currentPrice - level.priceLevel) / currentPrice;
      if (distance < minDistance) {
        minDistance = distance;
        nearest = level;
      }
    }

    return { level: nearest, distance: minDistance };
  }

  private calculateSpikeConfidence(
    volumeAnalysis: { spikeStrength: number; trend: string },
    obvAnalysis: { trend: string },
    isBullish: boolean
  ): number {
    let confidence = 0.55;

    // Spike strength
    confidence += Math.min((volumeAnalysis.spikeStrength - 2) * 0.1, 0.2);

    // Volume trend alignment
    if ((isBullish && volumeAnalysis.trend === 'increasing') ||
        (!isBullish && volumeAnalysis.trend === 'decreasing')) {
      confidence += 0.1;
    }

    // OBV confirmation
    if ((isBullish && obvAnalysis.trend === 'bullish') ||
        (!isBullish && obvAnalysis.trend === 'bearish')) {
      confidence += 0.1;
    }

    return Math.min(0.85, Math.max(0.4, confidence));
  }

  private calculateVWAPConfidence(vwapAnalysis: { deviation: number; stdDev: number }): number {
    let confidence = 0.5;

    // Larger deviation = higher confidence for mean reversion
    const deviationStrength = Math.abs(vwapAnalysis.deviation);
    confidence += Math.min(deviationStrength * 5, 0.25);

    // If within 2 std devs, more confident
    if (deviationStrength < vwapAnalysis.stdDev * 2) {
      confidence += 0.1;
    }

    return Math.min(0.8, Math.max(0.45, confidence));
  }
}
