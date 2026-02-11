/**
 * K.I.T. Wyckoff Analysis Skill
 * 
 * Smart money detection using Wyckoff Method
 * Identifies accumulation/distribution phases and key events
 */

import { Skill, SkillContext, SkillResult } from '../../src/skills/types.js';

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

interface WyckoffEvent {
  type: string;
  name: string;
  price: number;
  timestamp: number;
  confidence: number;
  description: string;
}

interface WyckoffPhase {
  phase: 'accumulation' | 'distribution' | 'markup' | 'markdown' | 'unknown';
  subPhase: string;
  confidence: number;
  startTimestamp: number;
  events: WyckoffEvent[];
}

interface VolumeAnalysis {
  effortResult: 'bullish' | 'bearish' | 'neutral';
  stoppingVolume: boolean;
  stoppingVolumePrice?: number;
  noSupply: boolean;
  noDemand: boolean;
  climaxVolume: boolean;
}

interface CompositeManActivity {
  position: 'long' | 'short' | 'neutral';
  aggression: 'high' | 'moderate' | 'low';
  accumulationDays: number;
  distributionDays: number;
}

interface WyckoffAnalysis {
  symbol: string;
  timestamp: number;
  currentPhase: WyckoffPhase;
  recentEvents: WyckoffEvent[];
  volumeAnalysis: VolumeAnalysis;
  compositeMan: CompositeManActivity;
  projection: {
    nextTarget: number;
    invalidation: number;
    bias: 'bullish' | 'bearish' | 'neutral';
  };
}

export class WyckoffAnalysisSkill implements Skill {
  name = 'wyckoff-analysis';
  description = 'Wyckoff Method analysis for smart money detection';
  version = '1.0.0';

  private config = {
    lookbackPeriods: 200,
    volumeThreshold: 1.5,
    priceTolerance: 0.02,
    minPhaseBars: 20
  };

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { command, args, symbol } = ctx;

    switch (command) {
      case 'analyze':
        return this.fullAnalysis(symbol || args[0], ctx);
      case 'phase':
        return this.detectPhase(symbol || args[0], ctx);
      case 'events':
        return this.identifyEvents(symbol || args[0], ctx);
      case 'composite':
        return this.analyzeCompositeMan(symbol || args[0], ctx);
      case 'volume':
        return this.volumeSpreadAnalysis(symbol || args[0], ctx);
      default:
        return this.fullAnalysis(symbol || args[0], ctx);
    }
  }

  async fullAnalysis(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    const candles = await this.fetchCandles(symbol, ctx);
    
    const phase = this.detectWyckoffPhase(candles);
    const events = this.findWyckoffEvents(candles);
    const volume = this.analyzeVolume(candles);
    const composite = this.analyzeCompositeManBehavior(candles, events);
    const projection = this.calculateProjection(candles, phase, events);

    const analysis: WyckoffAnalysis = {
      symbol,
      timestamp: Date.now(),
      currentPhase: phase,
      recentEvents: events.slice(-10),
      volumeAnalysis: volume,
      compositeMan: composite,
      projection
    };

    return {
      success: true,
      data: analysis,
      message: this.formatAnalysis(analysis)
    };
  }

  private detectWyckoffPhase(candles: Candle[]): WyckoffPhase {
    const recent = candles.slice(-this.config.lookbackPeriods);
    
    // Find swing highs and lows
    const swings = this.findSwings(recent);
    
    // Analyze trend and volume
    const trend = this.analyzeTrend(recent);
    const volumeProfile = this.getVolumeProfile(recent);
    
    // Determine phase based on structure
    let phase: WyckoffPhase['phase'] = 'unknown';
    let subPhase = '';
    let confidence = 0;

    if (this.isAccumulation(swings, volumeProfile, trend)) {
      phase = 'accumulation';
      subPhase = this.getAccumulationSubPhase(swings, recent);
      confidence = this.calculatePhaseConfidence(swings, volumeProfile, 'accumulation');
    } else if (this.isDistribution(swings, volumeProfile, trend)) {
      phase = 'distribution';
      subPhase = this.getDistributionSubPhase(swings, recent);
      confidence = this.calculatePhaseConfidence(swings, volumeProfile, 'distribution');
    } else if (trend === 'up') {
      phase = 'markup';
      subPhase = 'trending';
      confidence = 70;
    } else if (trend === 'down') {
      phase = 'markdown';
      subPhase = 'trending';
      confidence = 70;
    }

    return {
      phase,
      subPhase,
      confidence,
      startTimestamp: recent[0]?.timestamp || Date.now(),
      events: []
    };
  }

  private findWyckoffEvents(candles: Candle[]): WyckoffEvent[] {
    const events: WyckoffEvent[] = [];
    const recent = candles.slice(-this.config.lookbackPeriods);
    
    // Find Selling Climax (SC) - High volume spike with wide range down
    const scEvents = this.findSellingClimax(recent);
    events.push(...scEvents);
    
    // Find Buying Climax (BC) - High volume spike with wide range up
    const bcEvents = this.findBuyingClimax(recent);
    events.push(...bcEvents);
    
    // Find Spring - False breakdown below support with reversal
    const springEvents = this.findSpring(recent);
    events.push(...springEvents);
    
    // Find Upthrust - False breakout above resistance with reversal
    const utEvents = this.findUpthrust(recent);
    events.push(...utEvents);
    
    // Find Sign of Strength (SOS) - Strong move up on high volume
    const sosEvents = this.findSignOfStrength(recent);
    events.push(...sosEvents);
    
    // Find Sign of Weakness (SOW) - Strong move down on high volume
    const sowEvents = this.findSignOfWeakness(recent);
    events.push(...sowEvents);

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  private findSellingClimax(candles: Candle[]): WyckoffEvent[] {
    const events: WyckoffEvent[] = [];
    const avgVolume = this.averageVolume(candles);
    
    for (let i = 5; i < candles.length - 2; i++) {
      const c = candles[i];
      const range = c.high - c.low;
      const avgRange = this.averageRange(candles.slice(i - 5, i));
      
      // High volume, wide range, closes near low, then reversal
      if (
        c.volume > avgVolume * 2 &&
        range > avgRange * 1.5 &&
        c.close < c.open &&
        (c.close - c.low) / range < 0.3 &&
        candles[i + 1].close > candles[i + 1].open // Reversal candle
      ) {
        events.push({
          type: 'SC',
          name: 'Selling Climax',
          price: c.low,
          timestamp: c.timestamp,
          confidence: 75,
          description: 'High volume capitulation with reversal'
        });
      }
    }
    
    return events;
  }

  private findBuyingClimax(candles: Candle[]): WyckoffEvent[] {
    const events: WyckoffEvent[] = [];
    const avgVolume = this.averageVolume(candles);
    
    for (let i = 5; i < candles.length - 2; i++) {
      const c = candles[i];
      const range = c.high - c.low;
      const avgRange = this.averageRange(candles.slice(i - 5, i));
      
      // High volume, wide range, closes near high, then reversal
      if (
        c.volume > avgVolume * 2 &&
        range > avgRange * 1.5 &&
        c.close > c.open &&
        (c.high - c.close) / range < 0.3 &&
        candles[i + 1].close < candles[i + 1].open // Reversal candle
      ) {
        events.push({
          type: 'BC',
          name: 'Buying Climax',
          price: c.high,
          timestamp: c.timestamp,
          confidence: 75,
          description: 'High volume euphoria with reversal'
        });
      }
    }
    
    return events;
  }

  private findSpring(candles: Candle[]): WyckoffEvent[] {
    const events: WyckoffEvent[] = [];
    const support = this.findSupportLevel(candles);
    
    for (let i = 10; i < candles.length - 1; i++) {
      const c = candles[i];
      
      // Price dips below support then closes back above
      if (
        c.low < support * (1 - this.config.priceTolerance) &&
        c.close > support &&
        c.close > c.open &&
        candles[i + 1].close > candles[i + 1].open // Confirmation
      ) {
        events.push({
          type: 'SPRING',
          name: 'Spring',
          price: c.low,
          timestamp: c.timestamp,
          confidence: 80,
          description: 'False breakdown below support - bullish reversal'
        });
      }
    }
    
    return events;
  }

  private findUpthrust(candles: Candle[]): WyckoffEvent[] {
    const events: WyckoffEvent[] = [];
    const resistance = this.findResistanceLevel(candles);
    
    for (let i = 10; i < candles.length - 1; i++) {
      const c = candles[i];
      
      // Price spikes above resistance then closes back below
      if (
        c.high > resistance * (1 + this.config.priceTolerance) &&
        c.close < resistance &&
        c.close < c.open &&
        candles[i + 1].close < candles[i + 1].open // Confirmation
      ) {
        events.push({
          type: 'UT',
          name: 'Upthrust',
          price: c.high,
          timestamp: c.timestamp,
          confidence: 80,
          description: 'False breakout above resistance - bearish reversal'
        });
      }
    }
    
    return events;
  }

  private findSignOfStrength(candles: Candle[]): WyckoffEvent[] {
    const events: WyckoffEvent[] = [];
    const avgVolume = this.averageVolume(candles);
    const avgRange = this.averageRange(candles);
    
    for (let i = 3; i < candles.length; i++) {
      // Look for 3 consecutive up candles with increasing volume
      const c1 = candles[i - 2];
      const c2 = candles[i - 1];
      const c3 = candles[i];
      
      if (
        c1.close > c1.open && c2.close > c2.open && c3.close > c3.open &&
        c3.volume > avgVolume * 1.5 &&
        (c3.close - c3.open) > avgRange
      ) {
        events.push({
          type: 'SOS',
          name: 'Sign of Strength',
          price: c3.close,
          timestamp: c3.timestamp,
          confidence: 70,
          description: 'Strong advance on increased volume'
        });
      }
    }
    
    return events;
  }

  private findSignOfWeakness(candles: Candle[]): WyckoffEvent[] {
    const events: WyckoffEvent[] = [];
    const avgVolume = this.averageVolume(candles);
    const avgRange = this.averageRange(candles);
    
    for (let i = 3; i < candles.length; i++) {
      // Look for 3 consecutive down candles with increasing volume
      const c1 = candles[i - 2];
      const c2 = candles[i - 1];
      const c3 = candles[i];
      
      if (
        c1.close < c1.open && c2.close < c2.open && c3.close < c3.open &&
        c3.volume > avgVolume * 1.5 &&
        (c3.open - c3.close) > avgRange
      ) {
        events.push({
          type: 'SOW',
          name: 'Sign of Weakness',
          price: c3.close,
          timestamp: c3.timestamp,
          confidence: 70,
          description: 'Strong decline on increased volume'
        });
      }
    }
    
    return events;
  }

  private analyzeVolume(candles: Candle[]): VolumeAnalysis {
    const recent = candles.slice(-20);
    const avgVolume = this.averageVolume(candles.slice(-50));
    
    // Effort vs Result
    const priceChange = recent[recent.length - 1].close - recent[0].close;
    const volumeSum = recent.reduce((sum, c) => sum + c.volume, 0);
    const avgVolumeRecent = volumeSum / recent.length;
    
    let effortResult: VolumeAnalysis['effortResult'] = 'neutral';
    if (priceChange > 0 && avgVolumeRecent > avgVolume) effortResult = 'bullish';
    if (priceChange < 0 && avgVolumeRecent > avgVolume) effortResult = 'bearish';
    
    // Stopping Volume
    const lastCandle = recent[recent.length - 1];
    const stoppingVolume = lastCandle.volume > avgVolume * 2;
    
    // No Supply / No Demand
    const last5 = recent.slice(-5);
    const noSupply = last5.every(c => 
      c.close < c.open && c.volume < avgVolume * 0.7
    );
    const noDemand = last5.every(c => 
      c.close > c.open && c.volume < avgVolume * 0.7
    );
    
    // Climax Volume
    const climaxVolume = lastCandle.volume > avgVolume * 3;
    
    return {
      effortResult,
      stoppingVolume,
      stoppingVolumePrice: stoppingVolume ? lastCandle.close : undefined,
      noSupply,
      noDemand,
      climaxVolume
    };
  }

  private analyzeCompositeManBehavior(
    candles: Candle[], 
    events: WyckoffEvent[]
  ): CompositeManActivity {
    // Count accumulation vs distribution events
    const accEvents = events.filter(e => 
      ['SC', 'SPRING', 'SOS', 'LPS'].includes(e.type)
    );
    const distEvents = events.filter(e => 
      ['BC', 'UT', 'SOW', 'LPSY'].includes(e.type)
    );
    
    let position: CompositeManActivity['position'] = 'neutral';
    if (accEvents.length > distEvents.length * 1.5) position = 'long';
    if (distEvents.length > accEvents.length * 1.5) position = 'short';
    
    // Estimate aggression based on event frequency
    const eventDensity = events.length / (candles.length / 20);
    let aggression: CompositeManActivity['aggression'] = 'moderate';
    if (eventDensity > 2) aggression = 'high';
    if (eventDensity < 0.5) aggression = 'low';
    
    return {
      position,
      aggression,
      accumulationDays: accEvents.length * 2,
      distributionDays: distEvents.length * 2
    };
  }

  private calculateProjection(
    candles: Candle[],
    phase: WyckoffPhase,
    events: WyckoffEvent[]
  ): WyckoffAnalysis['projection'] {
    const currentPrice = candles[candles.length - 1].close;
    const range = this.findTradingRange(candles);
    
    let nextTarget = currentPrice;
    let invalidation = currentPrice;
    let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    
    if (phase.phase === 'accumulation') {
      bias = 'bullish';
      nextTarget = range.high * 1.1; // 10% above range high
      invalidation = range.low * 0.95; // 5% below range low
    } else if (phase.phase === 'distribution') {
      bias = 'bearish';
      nextTarget = range.low * 0.9; // 10% below range low
      invalidation = range.high * 1.05; // 5% above range high
    } else if (phase.phase === 'markup') {
      bias = 'bullish';
      nextTarget = currentPrice * 1.15;
      invalidation = range.low;
    } else if (phase.phase === 'markdown') {
      bias = 'bearish';
      nextTarget = currentPrice * 0.85;
      invalidation = range.high;
    }
    
    return { nextTarget, invalidation, bias };
  }

  // Helper methods
  private async fetchCandles(symbol: string, ctx: SkillContext): Promise<Candle[]> {
    // Would integrate with exchange connector
    return []; // Placeholder
  }

  private findSwings(candles: Candle[]) {
    return { highs: [], lows: [] };
  }

  private analyzeTrend(candles: Candle[]): 'up' | 'down' | 'sideways' {
    const first = candles[0]?.close || 0;
    const last = candles[candles.length - 1]?.close || 0;
    const change = (last - first) / first;
    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'sideways';
  }

  private getVolumeProfile(candles: Candle[]) {
    return { increasing: false, decreasing: false, climax: false };
  }

  private isAccumulation(swings: any, volume: any, trend: string): boolean {
    return trend === 'sideways' || trend === 'down';
  }

  private isDistribution(swings: any, volume: any, trend: string): boolean {
    return trend === 'sideways' || trend === 'up';
  }

  private getAccumulationSubPhase(swings: any, candles: Candle[]): string {
    return 'Phase C - Spring';
  }

  private getDistributionSubPhase(swings: any, candles: Candle[]): string {
    return 'Phase C - UTAD';
  }

  private calculatePhaseConfidence(swings: any, volume: any, type: string): number {
    return 75;
  }

  private findSupportLevel(candles: Candle[]): number {
    const lows = candles.map(c => c.low);
    return Math.min(...lows) * 1.02;
  }

  private findResistanceLevel(candles: Candle[]): number {
    const highs = candles.map(c => c.high);
    return Math.max(...highs) * 0.98;
  }

  private findTradingRange(candles: Candle[]) {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    return { high: Math.max(...highs), low: Math.min(...lows) };
  }

  private averageVolume(candles: Candle[]): number {
    if (!candles.length) return 0;
    return candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
  }

  private averageRange(candles: Candle[]): number {
    if (!candles.length) return 0;
    return candles.reduce((sum, c) => sum + (c.high - c.low), 0) / candles.length;
  }

  async detectPhase(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    return this.fullAnalysis(symbol, ctx);
  }

  async identifyEvents(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    return this.fullAnalysis(symbol, ctx);
  }

  async analyzeCompositeMan(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    return this.fullAnalysis(symbol, ctx);
  }

  async volumeSpreadAnalysis(symbol: string, ctx: SkillContext): Promise<SkillResult> {
    return this.fullAnalysis(symbol, ctx);
  }

  private formatAnalysis(analysis: WyckoffAnalysis): string {
    const { currentPhase, volumeAnalysis, compositeMan, projection } = analysis;
    
    return `
┌─────────────────────────────────────────────────────────┐
│  WYCKOFF ANALYSIS: ${analysis.symbol.padEnd(36)}│
├─────────────────────────────────────────────────────────┤
│  Current Phase: ${currentPhase.phase.toUpperCase()} (${currentPhase.subPhase})
│  Confidence: ${currentPhase.confidence}%
│                                                        
│  Volume Analysis:                                      
│  • Effort/Result: ${volumeAnalysis.effortResult.toUpperCase()}
│  • Stopping Volume: ${volumeAnalysis.stoppingVolume ? 'DETECTED' : 'None'}
│  • No Supply: ${volumeAnalysis.noSupply ? 'Confirmed' : 'No'}
│  • No Demand: ${volumeAnalysis.noDemand ? 'Confirmed' : 'No'}
│                                                        
│  Composite Man:                                        
│  • Position: ${compositeMan.position.toUpperCase()}
│  • Aggression: ${compositeMan.aggression.toUpperCase()}
│                                                        
│  Projection:                                           
│  • Bias: ${projection.bias.toUpperCase()}
│  • Next Target: $${projection.nextTarget.toFixed(2)}
│  • Invalidation: $${projection.invalidation.toFixed(2)}
└─────────────────────────────────────────────────────────┘`;
  }
}

export default new WyckoffAnalysisSkill();
