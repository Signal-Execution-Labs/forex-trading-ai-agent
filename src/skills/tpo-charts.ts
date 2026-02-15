/**
 * K.I.T. Skill #97: TPO Charts (Time Price Opportunity)
 * 
 * Market Profile / TPO analysis - shows price auction theory in action.
 * Visualizes where price spent the most time, not just volume.
 * 
 * Features:
 * - TPO letter generation (A-Z per time period)
 * - Value Area calculation (70% of TPO activity)
 * - Point of Control (POC) detection
 * - Initial Balance tracking (first hour range)
 * - Single prints identification (low participation zones)
 * - Poor highs/lows detection
 * - Profile shape classification (P, b, D, double-distribution)
 */

import { BaseSkill, SkillContext, SkillResult } from '../types/skill.js';

interface TPOBar {
  time: string;
  letter: string;
  prices: number[];
}

interface TPOProfile {
  date: string;
  poc: number;           // Point of Control
  vah: number;           // Value Area High
  val: number;           // Value Area Low
  ibHigh: number;        // Initial Balance High
  ibLow: number;         // Initial Balance Low
  singlePrints: number[];
  poorHigh: boolean;
  poorLow: boolean;
  shape: 'P' | 'b' | 'D' | 'double' | 'normal';
  tpos: Map<number, string[]>;  // price -> letters
}

interface TPOAnalysis {
  currentProfile: TPOProfile;
  priorProfiles: TPOProfile[];
  nakedPOCs: number[];      // Untested POCs from prior days
  balanceAreas: { high: number; low: number }[];
  trendBias: 'long' | 'short' | 'neutral';
  tradeSetup: string | null;
}

export class TPOChartsSkill extends BaseSkill {
  name = 'tpo-charts';
  description = 'Time Price Opportunity / Market Profile analysis';
  version = '1.0.0';
  
  private tickSize = 0.25;  // Configurable per instrument
  private letterSequence = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  private valueAreaPercent = 0.70;
  
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { symbol, timeframe = '30min', lookback = 5 } = ctx.params;
    
    ctx.log(`Generating TPO profile for ${symbol}`);
    
    // Fetch OHLC data
    const candles = await this.fetchCandles(ctx, symbol, timeframe, lookback);
    
    // Build TPO profiles for each session
    const profiles = this.buildTPOProfiles(candles);
    
    // Analyze current profile
    const analysis = this.analyzeProfiles(profiles);
    
    // Generate trade signals based on profile
    const signals = this.generateSignals(analysis, candles[candles.length - 1]?.close);
    
    return {
      success: true,
      data: {
        symbol,
        currentProfile: analysis.currentProfile,
        priorProfiles: analysis.priorProfiles,
        nakedPOCs: analysis.nakedPOCs,
        trendBias: analysis.trendBias,
        tradeSetup: analysis.tradeSetup,
        signals
      }
    };
  }
  
  private async fetchCandles(ctx: SkillContext, symbol: string, timeframe: string, days: number): Promise<any[]> {
    // Use market data provider
    const provider = ctx.providers.marketData;
    if (!provider) {
      throw new Error('Market data provider not configured');
    }
    
    return provider.getOHLCV(symbol, timeframe, days * 24 * 2); // ~48 periods per day
  }
  
  private buildTPOProfiles(candles: any[]): TPOProfile[] {
    const profiles: TPOProfile[] = [];
    const sessionCandles = this.groupBySession(candles);
    
    for (const [date, session] of Object.entries(sessionCandles)) {
      const tpos = new Map<number, string[]>();
      let letterIndex = 0;
      
      // Build TPO letters for each period
      for (const candle of session as any[]) {
        const letter = this.letterSequence[letterIndex % this.letterSequence.length];
        const priceRange = this.getPriceRange(candle.low, candle.high);
        
        for (const price of priceRange) {
          if (!tpos.has(price)) {
            tpos.set(price, []);
          }
          tpos.get(price)!.push(letter);
        }
        letterIndex++;
      }
      
      // Calculate POC (price with most TPOs)
      let poc = 0;
      let maxTpos = 0;
      for (const [price, letters] of tpos) {
        if (letters.length > maxTpos) {
          maxTpos = letters.length;
          poc = price;
        }
      }
      
      // Calculate Value Area (70% of activity)
      const { vah, val } = this.calculateValueArea(tpos, poc);
      
      // Initial Balance (first 2 periods)
      const ibCandles = (session as any[]).slice(0, 2);
      const ibHigh = Math.max(...ibCandles.map(c => c.high));
      const ibLow = Math.min(...ibCandles.map(c => c.low));
      
      // Detect single prints
      const singlePrints = this.findSinglePrints(tpos);
      
      // Check for poor high/low
      const prices = Array.from(tpos.keys()).sort((a, b) => a - b);
      const highPrice = prices[prices.length - 1];
      const lowPrice = prices[0];
      const poorHigh = (tpos.get(highPrice)?.length || 0) > 2;
      const poorLow = (tpos.get(lowPrice)?.length || 0) > 2;
      
      // Classify profile shape
      const shape = this.classifyShape(tpos, poc);
      
      profiles.push({
        date,
        poc,
        vah,
        val,
        ibHigh,
        ibLow,
        singlePrints,
        poorHigh,
        poorLow,
        shape,
        tpos
      });
    }
    
    return profiles;
  }
  
  private groupBySession(candles: any[]): Record<string, any[]> {
    const sessions: Record<string, any[]> = {};
    
    for (const candle of candles) {
      const date = new Date(candle.time).toISOString().split('T')[0];
      if (!sessions[date]) {
        sessions[date] = [];
      }
      sessions[date].push(candle);
    }
    
    return sessions;
  }
  
  private getPriceRange(low: number, high: number): number[] {
    const prices: number[] = [];
    let price = Math.floor(low / this.tickSize) * this.tickSize;
    
    while (price <= high) {
      prices.push(price);
      price += this.tickSize;
    }
    
    return prices;
  }
  
  private calculateValueArea(tpos: Map<number, string[]>, poc: number): { vah: number; val: number } {
    const totalTpos = Array.from(tpos.values()).reduce((sum, letters) => sum + letters.length, 0);
    const targetTpos = Math.floor(totalTpos * this.valueAreaPercent);
    
    const prices = Array.from(tpos.keys()).sort((a, b) => a - b);
    const pocIndex = prices.indexOf(poc);
    
    let vah = poc;
    let val = poc;
    let currentTpos = tpos.get(poc)?.length || 0;
    let upperIndex = pocIndex + 1;
    let lowerIndex = pocIndex - 1;
    
    while (currentTpos < targetTpos && (upperIndex < prices.length || lowerIndex >= 0)) {
      const upperTpos = upperIndex < prices.length ? (tpos.get(prices[upperIndex])?.length || 0) : 0;
      const lowerTpos = lowerIndex >= 0 ? (tpos.get(prices[lowerIndex])?.length || 0) : 0;
      
      if (upperTpos >= lowerTpos && upperIndex < prices.length) {
        vah = prices[upperIndex];
        currentTpos += upperTpos;
        upperIndex++;
      } else if (lowerIndex >= 0) {
        val = prices[lowerIndex];
        currentTpos += lowerTpos;
        lowerIndex--;
      }
    }
    
    return { vah, val };
  }
  
  private findSinglePrints(tpos: Map<number, string[]>): number[] {
    const singles: number[] = [];
    const prices = Array.from(tpos.keys()).sort((a, b) => a - b);
    
    for (let i = 1; i < prices.length - 1; i++) {
      const tpoCount = tpos.get(prices[i])?.length || 0;
      if (tpoCount === 1) {
        singles.push(prices[i]);
      }
    }
    
    return singles;
  }
  
  private classifyShape(tpos: Map<number, string[]>, poc: number): 'P' | 'b' | 'D' | 'double' | 'normal' {
    const prices = Array.from(tpos.keys()).sort((a, b) => a - b);
    const midPrice = prices[Math.floor(prices.length / 2)];
    const upperHalf = prices.filter(p => p > midPrice);
    const lowerHalf = prices.filter(p => p <= midPrice);
    
    const upperVolume = upperHalf.reduce((sum, p) => sum + (tpos.get(p)?.length || 0), 0);
    const lowerVolume = lowerHalf.reduce((sum, p) => sum + (tpos.get(p)?.length || 0), 0);
    
    const ratio = upperVolume / (lowerVolume || 1);
    
    if (ratio > 1.5) return 'P';  // Buying tail (bullish)
    if (ratio < 0.67) return 'b'; // Selling tail (bearish)
    if (poc === midPrice) return 'D';  // Balanced
    
    // Check for double distribution
    const tpoCounts = prices.map(p => tpos.get(p)?.length || 0);
    const peaks = this.findPeaks(tpoCounts);
    if (peaks.length >= 2) return 'double';
    
    return 'normal';
  }
  
  private findPeaks(data: number[]): number[] {
    const peaks: number[] = [];
    const threshold = Math.max(...data) * 0.7;
    
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] >= threshold) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  private analyzeProfiles(profiles: TPOProfile[]): TPOAnalysis {
    const currentProfile = profiles[profiles.length - 1];
    const priorProfiles = profiles.slice(0, -1);
    
    // Find naked (untested) POCs
    const nakedPOCs: number[] = [];
    const currentRange = { high: currentProfile.vah, low: currentProfile.val };
    
    for (const prior of priorProfiles) {
      if (prior.poc < currentRange.low || prior.poc > currentRange.high) {
        nakedPOCs.push(prior.poc);
      }
    }
    
    // Identify balance areas
    const balanceAreas = priorProfiles
      .filter(p => p.shape === 'D')
      .map(p => ({ high: p.vah, low: p.val }));
    
    // Determine trend bias based on profile shapes
    const recentShapes = profiles.slice(-3).map(p => p.shape);
    let bullishCount = recentShapes.filter(s => s === 'P').length;
    let bearishCount = recentShapes.filter(s => s === 'b').length;
    
    let trendBias: 'long' | 'short' | 'neutral' = 'neutral';
    if (bullishCount > bearishCount) trendBias = 'long';
    if (bearishCount > bullishCount) trendBias = 'short';
    
    // Generate trade setup
    let tradeSetup: string | null = null;
    
    if (currentProfile.shape === 'P' && !currentProfile.poorLow) {
      tradeSetup = 'LONG: P-shape profile with clean low - buy pullbacks to VAL';
    } else if (currentProfile.shape === 'b' && !currentProfile.poorHigh) {
      tradeSetup = 'SHORT: b-shape profile with clean high - sell rallies to VAH';
    } else if (currentProfile.singlePrints.length > 0) {
      tradeSetup = `FADE: Single prints at ${currentProfile.singlePrints.join(', ')} - price likely to revisit`;
    }
    
    return {
      currentProfile,
      priorProfiles,
      nakedPOCs,
      balanceAreas,
      trendBias,
      tradeSetup
    };
  }
  
  private generateSignals(analysis: TPOAnalysis, currentPrice: number): any[] {
    const signals: any[] = [];
    const { currentProfile, nakedPOCs, trendBias } = analysis;
    
    // Signal: Price at VAH/VAL
    if (currentPrice && Math.abs(currentPrice - currentProfile.vah) < this.tickSize * 2) {
      signals.push({
        type: trendBias === 'long' ? 'breakout_watch' : 'short_entry',
        price: currentProfile.vah,
        reason: 'Price at Value Area High'
      });
    }
    
    if (currentPrice && Math.abs(currentPrice - currentProfile.val) < this.tickSize * 2) {
      signals.push({
        type: trendBias === 'short' ? 'breakdown_watch' : 'long_entry',
        price: currentProfile.val,
        reason: 'Price at Value Area Low'
      });
    }
    
    // Signal: Naked POC targets
    for (const poc of nakedPOCs) {
      signals.push({
        type: 'target',
        price: poc,
        reason: `Naked POC from prior session - magnetic target`
      });
    }
    
    // Signal: POC acceptance/rejection
    if (currentPrice && Math.abs(currentPrice - currentProfile.poc) < this.tickSize * 2) {
      signals.push({
        type: 'inflection',
        price: currentProfile.poc,
        reason: 'Price at Point of Control - watch for acceptance/rejection'
      });
    }
    
    return signals;
  }
}

export default TPOChartsSkill;
