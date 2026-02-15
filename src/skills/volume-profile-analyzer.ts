/**
 * K.I.T. Skill #156: Volume Profile Analyzer
 * 
 * TradingView Premium-style Volume Profile analysis
 * Identifies high-volume nodes, POC, value areas, and low-volume gaps
 */

import { Skill, SkillContext, SkillResult } from '../types/skill.js';

interface VolumeProfileBar {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number; // buyVolume - sellVolume
  percentage: number;
}

interface VolumeProfile {
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  bars: VolumeProfileBar[];
  poc: number; // Point of Control
  vah: number; // Value Area High
  val: number; // Value Area Low
  highVolumeNodes: number[];
  lowVolumeNodes: number[];
  valueAreaVolume: number;
  totalVolume: number;
}

interface VolumeAnalysis {
  profile: VolumeProfile;
  interpretation: {
    marketType: 'trending' | 'ranging' | 'breakout_imminent';
    bias: 'bullish' | 'bearish' | 'neutral';
    keyLevels: { level: number; type: string; strength: number }[];
    tradingZones: { entry: [number, number]; target: number; stop: number }[];
  };
  deltaDivergence: {
    detected: boolean;
    type?: 'bullish' | 'bearish';
    description?: string;
  };
}

export class VolumeProfileAnalyzer implements Skill {
  name = 'volume-profile-analyzer';
  description = 'Professional volume profile analysis with POC, value areas, and delta';
  version = '1.0.0';
  
  async execute(context: SkillContext): Promise<SkillResult> {
    const { action, symbol, timeframe, candles, params } = context.input?.params || {};
    
    switch (action) {
      case 'build':
        return this.buildProfile(symbol, timeframe, candles, params);
      case 'compare':
        return this.compareProfiles(params?.profiles);
      case 'composite':
        return this.buildComposite(symbol, params?.sessions);
      case 'vwap':
        return this.calculateVWAP(candles, params);
      case 'delta':
        return this.analyzeDelta(candles);
      default:
        return this.analyze(symbol, timeframe, candles);
    }
  }
  
  private buildProfile(symbol: string, timeframe: string, candles: any[], params?: any): SkillResult {
    const tickSize = params?.tickSize || 1;
    const valueAreaPercent = params?.valueAreaPercent || 70;
    
    // Find price range
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    
    // Create price buckets
    const numBuckets = Math.ceil((maxPrice - minPrice) / tickSize);
    const buckets: Map<number, VolumeProfileBar> = new Map();
    
    for (let i = 0; i < numBuckets; i++) {
      const price = minPrice + i * tickSize;
      buckets.set(price, {
        price,
        volume: 0,
        buyVolume: 0,
        sellVolume: 0,
        delta: 0,
        percentage: 0
      });
    }
    
    // Distribute volume across price range
    let totalVolume = 0;
    for (const candle of candles) {
      const { high, low, close, open, volume } = candle;
      const range = high - low || tickSize;
      const isBullish = close >= open;
      
      // Distribute volume proportionally across candle range
      for (const [price, bar] of buckets) {
        if (price >= low && price <= high) {
          const priceVolume = volume / Math.ceil(range / tickSize);
          bar.volume += priceVolume;
          
          if (isBullish) {
            bar.buyVolume += priceVolume * 0.6;
            bar.sellVolume += priceVolume * 0.4;
          } else {
            bar.buyVolume += priceVolume * 0.4;
            bar.sellVolume += priceVolume * 0.6;
          }
          
          bar.delta = bar.buyVolume - bar.sellVolume;
          totalVolume += priceVolume;
        }
      }
    }
    
    // Calculate percentages
    const bars = Array.from(buckets.values()).map(bar => ({
      ...bar,
      percentage: totalVolume > 0 ? (bar.volume / totalVolume) * 100 : 0
    }));
    
    // Find POC (highest volume price)
    const poc = bars.reduce((max, bar) => bar.volume > max.volume ? bar : max, bars[0]);
    
    // Calculate Value Area (70% of volume)
    const sortedByVolume = [...bars].sort((a, b) => b.volume - a.volume);
    let valueAreaVolume = 0;
    const valueAreaBars: VolumeProfileBar[] = [];
    
    for (const bar of sortedByVolume) {
      if (valueAreaVolume >= totalVolume * (valueAreaPercent / 100)) break;
      valueAreaBars.push(bar);
      valueAreaVolume += bar.volume;
    }
    
    const valuePrices = valueAreaBars.map(b => b.price);
    const vah = Math.max(...valuePrices);
    const val = Math.min(...valuePrices);
    
    // Find high and low volume nodes
    const avgVolume = totalVolume / bars.length;
    const highVolumeNodes = bars.filter(b => b.volume > avgVolume * 1.5).map(b => b.price);
    const lowVolumeNodes = bars.filter(b => b.volume < avgVolume * 0.3 && b.volume > 0).map(b => b.price);
    
    const profile: VolumeProfile = {
      symbol,
      timeframe,
      startDate: candles[0]?.time || new Date().toISOString(),
      endDate: candles[candles.length - 1]?.time || new Date().toISOString(),
      bars: bars.filter(b => b.volume > 0),
      poc: poc.price,
      vah,
      val,
      highVolumeNodes,
      lowVolumeNodes,
      valueAreaVolume,
      totalVolume
    };
    
    return {
      success: true,
      data: profile,
      metadata: { message: `Volume profile built: POC at ${poc.price}, VA: ${val}-${vah}` }
    };
  }
  
  private analyze(symbol: string, timeframe: string, candles: any[]): SkillResult {
    const profileResult = this.buildProfile(symbol, timeframe, candles);
    const profile = profileResult.data as VolumeProfile;
    
    const currentPrice = candles[candles.length - 1]?.close || profile.poc;
    
    // Determine market type
    let marketType: VolumeAnalysis['interpretation']['marketType'];
    const vaWidth = profile.vah - profile.val;
    const priceRange = Math.max(...candles.map(c => c.high)) - Math.min(...candles.map(c => c.low));
    
    if (vaWidth / priceRange < 0.3) {
      marketType = 'breakout_imminent';
    } else if (vaWidth / priceRange > 0.6) {
      marketType = 'ranging';
    } else {
      marketType = 'trending';
    }
    
    // Determine bias
    let bias: VolumeAnalysis['interpretation']['bias'];
    if (currentPrice > profile.vah) {
      bias = 'bullish';
    } else if (currentPrice < profile.val) {
      bias = 'bearish';
    } else {
      // Within value area - check POC position
      const pocPosition = (profile.poc - profile.val) / (profile.vah - profile.val);
      bias = pocPosition > 0.5 ? 'bullish' : pocPosition < 0.5 ? 'bearish' : 'neutral';
    }
    
    // Identify key levels
    const keyLevels = [
      { level: profile.poc, type: 'POC', strength: 100 },
      { level: profile.vah, type: 'VAH', strength: 80 },
      { level: profile.val, type: 'VAL', strength: 80 },
      ...profile.highVolumeNodes.map(l => ({ level: l, type: 'HVN', strength: 70 })),
      ...profile.lowVolumeNodes.slice(0, 3).map(l => ({ level: l, type: 'LVN', strength: 50 }))
    ];
    
    // Generate trading zones
    const tradingZones = [];
    
    if (currentPrice > profile.vah) {
      // Breakout above value area
      tradingZones.push({
        entry: [profile.vah, profile.vah * 1.005] as [number, number],
        target: profile.vah + (profile.vah - profile.val),
        stop: profile.poc
      });
    } else if (currentPrice < profile.val) {
      // Breakout below value area
      tradingZones.push({
        entry: [profile.val * 0.995, profile.val] as [number, number],
        target: profile.val - (profile.vah - profile.val),
        stop: profile.poc
      });
    } else {
      // Mean reversion within value area
      tradingZones.push({
        entry: [profile.val, profile.val * 1.01] as [number, number],
        target: profile.poc,
        stop: profile.val * 0.99
      });
    }
    
    // Check for delta divergence
    const deltaSum = profile.bars.reduce((sum, b) => sum + b.delta, 0);
    const priceChange = currentPrice - candles[0]?.open;
    const deltaDivergence: VolumeAnalysis['deltaDivergence'] = {
      detected: (deltaSum > 0 && priceChange < 0) || (deltaSum < 0 && priceChange > 0),
      type: deltaSum > 0 ? 'bullish' : 'bearish',
      description: deltaSum > 0 && priceChange < 0 
        ? 'Bullish divergence: Price down but buying pressure dominant'
        : deltaSum < 0 && priceChange > 0
        ? 'Bearish divergence: Price up but selling pressure dominant'
        : undefined
    };
    
    const analysis: VolumeAnalysis = {
      profile,
      interpretation: {
        marketType,
        bias,
        keyLevels,
        tradingZones
      },
      deltaDivergence
    };
    
    return {
      success: true,
      data: analysis,
      metadata: { message: `${marketType.replace('_', ' ')} market with ${bias} bias. POC: ${profile.poc}` }
    };
  }
  
  private compareProfiles(profiles: VolumeProfile[]): SkillResult {
    if (!profiles || profiles.length < 2) {
      return { success: false, error: 'Need at least 2 profiles to compare' };
    }
    
    const comparisons = [];
    
    for (let i = 0; i < profiles.length - 1; i++) {
      const p1 = profiles[i];
      const p2 = profiles[i + 1];
      
      comparisons.push({
        period1: `${p1.startDate} - ${p1.endDate}`,
        period2: `${p2.startDate} - ${p2.endDate}`,
        pocShift: p2.poc - p1.poc,
        pocShiftPercent: ((p2.poc - p1.poc) / p1.poc) * 100,
        valueAreaExpansion: (p2.vah - p2.val) - (p1.vah - p1.val),
        volumeChange: ((p2.totalVolume - p1.totalVolume) / p1.totalVolume) * 100,
        interpretation: p2.poc > p1.poc 
          ? 'Value migrating higher - bullish'
          : p2.poc < p1.poc
          ? 'Value migrating lower - bearish'
          : 'Value stable'
      });
    }
    
    return {
      success: true,
      data: { comparisons },
      metadata: { message: `Compared ${profiles.length} volume profiles` }
    };
  }
  
  private buildComposite(symbol: string, sessions: any[]): SkillResult {
    // Build composite profile from multiple sessions
    const allBars: Map<number, VolumeProfileBar> = new Map();
    
    for (const session of sessions || []) {
      for (const bar of session.bars || []) {
        const existing = allBars.get(bar.price);
        if (existing) {
          existing.volume += bar.volume;
          existing.buyVolume += bar.buyVolume;
          existing.sellVolume += bar.sellVolume;
          existing.delta = existing.buyVolume - existing.sellVolume;
        } else {
          allBars.set(bar.price, { ...bar });
        }
      }
    }
    
    const bars = Array.from(allBars.values());
    const totalVolume = bars.reduce((sum, b) => sum + b.volume, 0);
    
    return {
      success: true,
      data: {
        symbol,
        type: 'composite',
        sessionsIncluded: sessions?.length || 0,
        bars: bars.sort((a, b) => a.price - b.price),
        totalVolume,
        poc: bars.reduce((max: VolumeProfileBar, b: VolumeProfileBar) => b.volume > max.volume ? b : max, bars[0]).price
      },
      metadata: { message: `Composite profile built from ${sessions?.length || 0} sessions` }
    };
  }
  
  private calculateVWAP(candles: any[], params?: any): SkillResult {
    const { includeBands = true, standardDeviations = [1, 2] } = params || {};
    
    let cumulativeTPV = 0; // Typical Price * Volume
    let cumulativeVolume = 0;
    const vwapData: { time: string; vwap: number; bands?: Record<string, number> }[] = [];
    const typicalPrices: number[] = [];
    
    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      typicalPrices.push(typicalPrice);
      
      cumulativeTPV += typicalPrice * candle.volume;
      cumulativeVolume += candle.volume;
      
      const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;
      
      const entry: any = { time: candle.time, vwap };
      
      if (includeBands && typicalPrices.length > 1) {
        // Calculate standard deviation
        const variance = typicalPrices.reduce((sum, tp) => sum + Math.pow(tp - vwap, 2), 0) / typicalPrices.length;
        const stdDev = Math.sqrt(variance);
        
        entry.bands = {};
        for (const sd of standardDeviations) {
          entry.bands[`upper${sd}`] = vwap + sd * stdDev;
          entry.bands[`lower${sd}`] = vwap - sd * stdDev;
        }
      }
      
      vwapData.push(entry);
    }
    
    const currentVWAP = vwapData[vwapData.length - 1];
    const currentPrice = candles[candles.length - 1]?.close;
    
    return {
      success: true,
      data: {
        vwapData,
        current: currentVWAP,
        priceRelation: currentPrice > currentVWAP.vwap ? 'above' : 'below',
        deviation: ((currentPrice - currentVWAP.vwap) / currentVWAP.vwap) * 100
      },
      metadata: { message: `VWAP: ${currentVWAP.vwap.toFixed(2)}, Price ${currentPrice > currentVWAP.vwap ? 'above' : 'below'}` }
    };
  }
  
  private analyzeDelta(candles: any[]): SkillResult {
    const deltaData = candles.map(candle => {
      const isBullish = candle.close >= candle.open;
      const buyRatio = isBullish ? 0.6 : 0.4;
      const buyVolume = candle.volume * buyRatio;
      const sellVolume = candle.volume * (1 - buyRatio);
      
      return {
        time: candle.time,
        buyVolume,
        sellVolume,
        delta: buyVolume - sellVolume,
        cumulativeDelta: 0 // Will be calculated
      };
    });
    
    // Calculate cumulative delta
    let cumDelta = 0;
    for (const bar of deltaData) {
      cumDelta += bar.delta;
      bar.cumulativeDelta = cumDelta;
    }
    
    // Analyze delta trend
    const recentDelta = deltaData.slice(-10);
    const deltaSum = recentDelta.reduce((sum, d) => sum + d.delta, 0);
    const priceChange = candles[candles.length - 1]?.close - candles[candles.length - 10]?.close;
    
    return {
      success: true,
      data: {
        deltaData,
        summary: {
          totalDelta: cumDelta,
          recentDelta: deltaSum,
          trend: deltaSum > 0 ? 'buying_pressure' : 'selling_pressure',
          divergence: (deltaSum > 0 && priceChange < 0) || (deltaSum < 0 && priceChange > 0)
        }
      },
      metadata: { message: `Delta analysis: ${deltaSum > 0 ? 'Net buying' : 'Net selling'} pressure` }
    };
  }
}

export default VolumeProfileAnalyzer;
