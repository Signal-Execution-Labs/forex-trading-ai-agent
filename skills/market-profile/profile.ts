/**
 * K.I.T. Market Profile Skill
 * 
 * TPO and Volume Profile analysis for market structure understanding
 */

import { Skill, SkillContext, SkillResult } from '../../src/skills/types.js';

interface TPOBar {
  price: number;
  letters: string[];
  volume: number;
}

interface MarketProfile {
  symbol: string;
  date: string;
  poc: number;
  pocVolume: number;
  vah: number;
  val: number;
  high: number;
  low: number;
  initialBalance: { high: number; low: number };
  rangeExtension: 'up' | 'down' | 'both' | 'none';
  shape: 'normal' | 'p-shape' | 'b-shape' | 'd-shape' | 'double';
  tpos: TPOBar[];
  singlePrints: number[];
  totalVolume: number;
  volumeAbovePoc: number;
  volumeBelowPoc: number;
}

interface VolumeProfile {
  poc: number;
  vah: number;
  val: number;
  hvn: number[];  // High Volume Nodes
  lvn: number[];  // Low Volume Nodes
  levels: { price: number; volume: number; percentage: number }[];
}

interface VWAPData {
  vwap: number;
  upperBand1: number;
  upperBand2: number;
  upperBand3: number;
  lowerBand1: number;
  lowerBand2: number;
  lowerBand3: number;
}

export class MarketProfileSkill implements Skill {
  name = 'market-profile';
  description = 'TPO and Volume Profile analysis';
  version = '1.0.0';

  private config = {
    tpoPeriod: 30,      // 30 minutes
    valueArea: 0.70,    // 70%
    tickSize: 0.25,
    sessions: {
      asia: { start: '00:00', end: '08:00' },
      london: { start: '08:00', end: '12:00' },
      ny: { start: '12:00', end: '21:00' }
    },
    vwapDeviations: [1, 2, 3]
  };

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { command, args, symbol } = ctx;
    const targetSymbol = symbol || args[0];

    switch (command) {
      case 'daily':
        return this.dailyProfile(targetSymbol, ctx);
      case 'weekly':
        return this.weeklyProfile(targetSymbol, ctx);
      case 'vp':
        return this.volumeProfile(targetSymbol, ctx);
      case 'vwap':
        return this.vwapAnalysis(targetSymbol, ctx);
      case 'session':
        return this.sessionProfile(targetSymbol, args[1], ctx);
      case 'poc':
        return this.findPOC(targetSymbol, ctx);
      case 'va':
        return this.calculateValueArea(targetSymbol, ctx);
      default:
        return this.dailyProfile(targetSymbol, ctx);
    }
  }

  async dailyProfile(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    const trades = await this.fetchTrades(symbol, '1d', ctx);
    const profile = this.buildTPOProfile(trades);
    
    return {
      success: true,
      data: profile,
      message: this.formatProfile(profile)
    };
  }

  async weeklyProfile(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    const trades = await this.fetchTrades(symbol, '1w', ctx);
    const profile = this.buildTPOProfile(trades);
    
    return {
      success: true,
      data: profile,
      message: this.formatProfile(profile)
    };
  }

  async volumeProfile(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    const trades = await this.fetchTrades(symbol, '1d', ctx);
    const vp = this.buildVolumeProfile(trades);
    
    return {
      success: true,
      data: vp,
      message: this.formatVolumeProfile(symbol, vp)
    };
  }

  async vwapAnalysis(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    const trades = await this.fetchTrades(symbol, '1d', ctx);
    const vwap = this.calculateVWAP(trades);
    
    return {
      success: true,
      data: vwap,
      message: this.formatVWAP(symbol, vwap)
    };
  }

  async sessionProfile(
    symbol: string, 
    session: string, 
    ctx: SkillContext
  ): Promise<SkillResult> {
    const sessionTimes = this.config.sessions[session as keyof typeof this.config.sessions];
    if (!sessionTimes) {
      return {
        success: false,
        error: `Unknown session: ${session}. Use: asia, london, ny`
      };
    }
    
    const trades = await this.fetchTrades(symbol, '1d', ctx);
    const filteredTrades = this.filterBySession(trades, sessionTimes);
    const profile = this.buildTPOProfile(filteredTrades);
    
    return {
      success: true,
      data: { session, ...profile },
      message: `${session.toUpperCase()} Session\n${this.formatProfile(profile)}`
    };
  }

  async findPOC(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    const trades = await this.fetchTrades(symbol, '1d', ctx);
    const vp = this.buildVolumeProfile(trades);
    
    return {
      success: true,
      data: { poc: vp.poc },
      message: `Point of Control for ${symbol}: $${vp.poc.toFixed(2)}`
    };
  }

  async calculateValueArea(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    const trades = await this.fetchTrades(symbol, '1d', ctx);
    const vp = this.buildVolumeProfile(trades);
    
    return {
      success: true,
      data: { vah: vp.vah, val: vp.val, poc: vp.poc },
      message: `Value Area for ${symbol}:\n• VAH: $${vp.vah.toFixed(2)}\n• POC: $${vp.poc.toFixed(2)}\n• VAL: $${vp.val.toFixed(2)}`
    };
  }

  private buildTPOProfile(trades: any[]): MarketProfile {
    // Group trades by TPO period and price level
    const tpoMap = new Map<number, { letters: Set<string>; volume: number }>();
    
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let letterIndex = 0;
    let currentPeriodStart = 0;
    
    let high = -Infinity;
    let low = Infinity;
    let totalVolume = 0;
    
    for (const trade of trades) {
      const price = Math.round(trade.price / this.config.tickSize) * this.config.tickSize;
      
      // Determine TPO letter based on time
      const periodIndex = Math.floor(trade.timestamp / (this.config.tpoPeriod * 60 * 1000));
      if (periodIndex !== currentPeriodStart) {
        currentPeriodStart = periodIndex;
        letterIndex = Math.min(letterIndex + 1, letters.length - 1);
      }
      
      if (!tpoMap.has(price)) {
        tpoMap.set(price, { letters: new Set(), volume: 0 });
      }
      
      const level = tpoMap.get(price)!;
      level.letters.add(letters[letterIndex]);
      level.volume += trade.volume;
      
      high = Math.max(high, price);
      low = Math.min(low, price);
      totalVolume += trade.volume;
    }
    
    // Convert to sorted TPO bars
    const tpos: TPOBar[] = Array.from(tpoMap.entries())
      .map(([price, data]) => ({
        price,
        letters: Array.from(data.letters).sort(),
        volume: data.volume
      }))
      .sort((a, b) => b.price - a.price);
    
    // Find POC (most TPO letters)
    const poc = tpos.reduce((max, t) => 
      t.letters.length > max.letters.length ? t : max, tpos[0]
    );
    
    // Calculate Value Area
    const { vah, val } = this.calculateVA(tpos, totalVolume);
    
    // Find Initial Balance (first 2 periods - A & B)
    const ibBars = tpos.filter(t => 
      t.letters.includes('A') || t.letters.includes('B')
    );
    const ibHigh = Math.max(...ibBars.map(t => t.price));
    const ibLow = Math.min(...ibBars.map(t => t.price));
    
    // Determine range extension
    let rangeExtension: MarketProfile['rangeExtension'] = 'none';
    if (high > ibHigh && low < ibLow) rangeExtension = 'both';
    else if (high > ibHigh) rangeExtension = 'up';
    else if (low < ibLow) rangeExtension = 'down';
    
    // Detect profile shape
    const shape = this.detectShape(tpos, poc.price);
    
    // Find single prints
    const singlePrints = tpos
      .filter(t => t.letters.length === 1)
      .map(t => t.price);
    
    // Volume distribution
    const volumeAbovePoc = tpos
      .filter(t => t.price > poc.price)
      .reduce((sum, t) => sum + t.volume, 0) / totalVolume;
    const volumeBelowPoc = tpos
      .filter(t => t.price < poc.price)
      .reduce((sum, t) => sum + t.volume, 0) / totalVolume;
    
    return {
      symbol: 'SYMBOL',
      date: new Date().toISOString().split('T')[0],
      poc: poc.price,
      pocVolume: poc.volume,
      vah,
      val,
      high,
      low,
      initialBalance: { high: ibHigh, low: ibLow },
      rangeExtension,
      shape,
      tpos,
      singlePrints,
      totalVolume,
      volumeAbovePoc,
      volumeBelowPoc
    };
  }

  private calculateVA(
    tpos: TPOBar[], 
    totalVolume: number
  ): { vah: number; val: number } {
    const targetVolume = totalVolume * this.config.valueArea;
    
    // Start from POC and expand outward
    const sorted = [...tpos].sort((a, b) => b.volume - a.volume);
    let includedVolume = 0;
    const includedPrices: number[] = [];
    
    for (const bar of sorted) {
      if (includedVolume >= targetVolume) break;
      includedVolume += bar.volume;
      includedPrices.push(bar.price);
    }
    
    return {
      vah: Math.max(...includedPrices),
      val: Math.min(...includedPrices)
    };
  }

  private detectShape(tpos: TPOBar[], poc: number): MarketProfile['shape'] {
    const upperHalf = tpos.filter(t => t.price > poc);
    const lowerHalf = tpos.filter(t => t.price <= poc);
    
    const upperTPOs = upperHalf.reduce((sum, t) => sum + t.letters.length, 0);
    const lowerTPOs = lowerHalf.reduce((sum, t) => sum + t.letters.length, 0);
    
    const ratio = upperTPOs / (lowerTPOs || 1);
    
    if (ratio > 1.5) return 'p-shape';      // More activity above = shorts trapped
    if (ratio < 0.67) return 'b-shape';     // More activity below = longs trapped
    if (ratio > 0.9 && ratio < 1.1) return 'normal';
    
    return 'd-shape'; // Trend day
  }

  private buildVolumeProfile(trades: any[]): VolumeProfile {
    const volumeByPrice = new Map<number, number>();
    let totalVolume = 0;
    
    for (const trade of trades) {
      const price = Math.round(trade.price / this.config.tickSize) * this.config.tickSize;
      volumeByPrice.set(price, (volumeByPrice.get(price) || 0) + trade.volume);
      totalVolume += trade.volume;
    }
    
    const levels = Array.from(volumeByPrice.entries())
      .map(([price, volume]) => ({
        price,
        volume,
        percentage: volume / totalVolume
      }))
      .sort((a, b) => b.volume - a.volume);
    
    const poc = levels[0]?.price || 0;
    const { vah, val } = this.calculateVA(
      levels.map(l => ({ price: l.price, letters: [], volume: l.volume })),
      totalVolume
    );
    
    // Find High Volume Nodes (top 20%)
    const threshold = levels[Math.floor(levels.length * 0.2)]?.volume || 0;
    const hvn = levels.filter(l => l.volume >= threshold).map(l => l.price);
    
    // Find Low Volume Nodes (bottom 20%)
    const lvnThreshold = levels[Math.floor(levels.length * 0.8)]?.volume || Infinity;
    const lvn = levels.filter(l => l.volume <= lvnThreshold).map(l => l.price);
    
    return { poc, vah, val, hvn, lvn, levels };
  }

  private calculateVWAP(trades: any[]): VWAPData {
    let cumulativeTPV = 0;  // Typical Price * Volume
    let cumulativeVolume = 0;
    const tpvs: number[] = [];
    
    for (const trade of trades) {
      const tp = (trade.high + trade.low + trade.close) / 3;
      cumulativeTPV += tp * trade.volume;
      cumulativeVolume += trade.volume;
      tpvs.push(tp);
    }
    
    const vwap = cumulativeTPV / cumulativeVolume;
    
    // Calculate standard deviation
    const variance = tpvs.reduce((sum, tp) => 
      sum + Math.pow(tp - vwap, 2), 0
    ) / tpvs.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      vwap,
      upperBand1: vwap + stdDev,
      upperBand2: vwap + stdDev * 2,
      upperBand3: vwap + stdDev * 3,
      lowerBand1: vwap - stdDev,
      lowerBand2: vwap - stdDev * 2,
      lowerBand3: vwap - stdDev * 3
    };
  }

  private async fetchTrades(
    symbol: string, 
    period: string, 
    ctx: SkillContext
  ): Promise<any[]> {
    // Would integrate with exchange connector
    return [];
  }

  private filterBySession(trades: any[], session: { start: string; end: string }): any[] {
    return trades; // Would filter by time
  }

  private formatProfile(profile: MarketProfile): string {
    const shapeEmoji = {
      'normal': '⚖️',
      'p-shape': '📈',
      'b-shape': '📉',
      'd-shape': '🚀',
      'double': '📊'
    };
    
    return `
┌─────────────────────────────────────────────────────────┐
│  MARKET PROFILE: ${profile.symbol.padEnd(36)}│
│  Date: ${profile.date.padEnd(45)}│
├─────────────────────────────────────────────────────────┤
│  Profile Shape: ${shapeEmoji[profile.shape]} ${profile.shape.toUpperCase()}
│  
│  Key Levels:
│  • POC: $${profile.poc.toFixed(2)} (${(profile.pocVolume / profile.totalVolume * 100).toFixed(1)}% volume)
│  • VAH: $${profile.vah.toFixed(2)}
│  • VAL: $${profile.val.toFixed(2)}
│  • High: $${profile.high.toFixed(2)}
│  • Low: $${profile.low.toFixed(2)}
│  
│  Initial Balance: $${profile.initialBalance.low.toFixed(2)} - $${profile.initialBalance.high.toFixed(2)}
│  Range Extension: ${profile.rangeExtension.toUpperCase()}
│  
│  Volume Distribution:
│  • Above POC: ${(profile.volumeAbovePoc * 100).toFixed(1)}%
│  • Below POC: ${(profile.volumeBelowPoc * 100).toFixed(1)}%
│  
│  Single Prints: ${profile.singlePrints.length > 0 ? profile.singlePrints.slice(0, 3).map(p => `$${p.toFixed(2)}`).join(', ') : 'None'}
└─────────────────────────────────────────────────────────┘`;
  }

  private formatVolumeProfile(symbol: string, vp: VolumeProfile): string {
    return `
Volume Profile: ${symbol}
━━━━━━━━━━━━━━━━━━━━
POC: $${vp.poc.toFixed(2)}
VAH: $${vp.vah.toFixed(2)}
VAL: $${vp.val.toFixed(2)}

High Volume Nodes (Support/Resistance):
${vp.hvn.slice(0, 5).map(p => `  • $${p.toFixed(2)}`).join('\n')}

Low Volume Nodes (Fast Move Zones):
${vp.lvn.slice(0, 5).map(p => `  • $${p.toFixed(2)}`).join('\n')}`;
  }

  private formatVWAP(symbol: string, vwap: VWAPData): string {
    return `
VWAP Analysis: ${symbol}
━━━━━━━━━━━━━━━━━━━━
VWAP: $${vwap.vwap.toFixed(2)}

Upper Bands:
  +1σ: $${vwap.upperBand1.toFixed(2)}
  +2σ: $${vwap.upperBand2.toFixed(2)}
  +3σ: $${vwap.upperBand3.toFixed(2)}

Lower Bands:
  -1σ: $${vwap.lowerBand1.toFixed(2)}
  -2σ: $${vwap.lowerBand2.toFixed(2)}
  -3σ: $${vwap.lowerBand3.toFixed(2)}`;
  }
}

export default new MarketProfileSkill();
