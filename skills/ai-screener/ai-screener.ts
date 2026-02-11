/**
 * K.I.T. AI Stock Screener
 * 
 * Inspired by: TrendSpider, Trade Ideas (Holly AI), Zen Ratings
 * Multi-factor stock screening with AI predictions
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type Rating = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
export type Market = 'US_STOCKS' | 'CRYPTO' | 'FOREX' | 'EU_STOCKS' | 'COMMODITIES';
export type PatternType = 
  | 'double_top' | 'double_bottom' 
  | 'head_shoulders' | 'inverse_head_shoulders'
  | 'ascending_triangle' | 'descending_triangle' | 'symmetrical_triangle'
  | 'rising_wedge' | 'falling_wedge'
  | 'flag' | 'pennant'
  | 'cup_handle' | 'breakout' | 'breakdown';

export interface StockGrades {
  fundamentals: Rating;
  growth: Rating;
  momentum: Rating;
  safety: Rating;
  sentiment: Rating;
  value: Rating;
  ai: Rating;
}

export interface Signal {
  type: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  details?: string;
}

export interface Pattern {
  type: PatternType;
  confidence: number;
  breakoutTarget?: number;
  breakdownTarget?: number;
  neckline?: number;
}

export interface AIPrediction {
  direction: 'up' | 'down' | 'neutral';
  probability: number;
  priceTarget: {
    '1d'?: number;
    '7d'?: number;
    '30d'?: number;
    '90d'?: number;
  };
}

export interface StockAnalysis {
  symbol: string;
  name?: string;
  price: number;
  overallRating: Rating;
  score: number;
  confidence: number;
  grades: StockGrades;
  signals: Signal[];
  patterns: Pattern[];
  aiPrediction: AIPrediction;
  updatedAt: Date;
}

export interface ScreenerAlert {
  id: string;
  symbol: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  price: number;
  timestamp: Date;
}

export interface ScanCondition {
  type: 'breakout' | 'breakdown' | 'rsi' | 'volume_spike' | 'macd_cross' | 'ma_cross' | 'pattern';
  direction?: 'up' | 'down' | 'oversold' | 'overbought';
  threshold?: number;
  multiple?: number;
  pattern?: PatternType;
}

export interface ScreenerConfig {
  markets: Market[];
  conditions: ScanCondition[];
  minConfidence?: number;
  onAlert: (alert: ScreenerAlert) => void;
}

// ============================================================================
// Factor Calculations
// ============================================================================

export class FactorCalculator {
  /**
   * Calculate fundamental score (0-100)
   */
  calculateFundamentals(data: {
    pe?: number;
    pb?: number;
    roe?: number;
    debtEquity?: number;
    grossMargin?: number;
    netMargin?: number;
  }): number {
    let score = 50; // Start neutral
    
    // P/E: Lower is better (within reason)
    if (data.pe !== undefined) {
      if (data.pe > 0 && data.pe < 15) score += 15;
      else if (data.pe >= 15 && data.pe < 25) score += 10;
      else if (data.pe >= 25 && data.pe < 40) score += 5;
      else if (data.pe >= 40 || data.pe < 0) score -= 10;
    }
    
    // ROE: Higher is better
    if (data.roe !== undefined) {
      if (data.roe > 20) score += 15;
      else if (data.roe > 15) score += 10;
      else if (data.roe > 10) score += 5;
      else if (data.roe < 5) score -= 10;
    }
    
    // Debt/Equity: Lower is better
    if (data.debtEquity !== undefined) {
      if (data.debtEquity < 0.5) score += 15;
      else if (data.debtEquity < 1) score += 10;
      else if (data.debtEquity < 2) score += 5;
      else score -= 10;
    }
    
    // Margins: Higher is better
    if (data.grossMargin !== undefined && data.grossMargin > 40) score += 5;
    if (data.netMargin !== undefined && data.netMargin > 15) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate momentum score (0-100)
   */
  calculateMomentum(data: {
    rsi?: number;
    macdSignal?: 'bullish' | 'bearish' | 'neutral';
    priceVs50MA?: number; // % above/below 50-day MA
    priceVs200MA?: number;
    volumeRatio?: number; // current vs average
  }): number {
    let score = 50;
    
    // RSI: Best at 40-60 for continuation, extreme for reversals
    if (data.rsi !== undefined) {
      if (data.rsi >= 40 && data.rsi <= 60) score += 10;
      else if (data.rsi >= 30 && data.rsi < 40) score += 5; // Potential bounce
      else if (data.rsi > 60 && data.rsi <= 70) score += 5; // Strong momentum
    }
    
    // MACD
    if (data.macdSignal === 'bullish') score += 15;
    else if (data.macdSignal === 'bearish') score -= 15;
    
    // Price vs MAs
    if (data.priceVs50MA !== undefined && data.priceVs50MA > 0) score += 10;
    if (data.priceVs200MA !== undefined && data.priceVs200MA > 0) score += 10;
    
    // Volume
    if (data.volumeRatio !== undefined && data.volumeRatio > 1.5) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate sentiment score (0-100)
   */
  calculateSentiment(data: {
    analystRating?: number; // 1-5 scale
    analystUpgrades?: number;
    analystDowngrades?: number;
    socialSentiment?: number; // -1 to 1
    newsSentiment?: number; // -1 to 1
  }): number {
    let score = 50;
    
    if (data.analystRating !== undefined) {
      score += (data.analystRating - 3) * 10; // +/-20 max
    }
    
    if (data.analystUpgrades && data.analystDowngrades !== undefined) {
      const netUpgrades = data.analystUpgrades - data.analystDowngrades;
      score += Math.min(15, Math.max(-15, netUpgrades * 5));
    }
    
    if (data.socialSentiment !== undefined) {
      score += data.socialSentiment * 15;
    }
    
    if (data.newsSentiment !== undefined) {
      score += data.newsSentiment * 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Convert numeric score to letter rating
   */
  scoreToRating(score: number): Rating {
    if (score >= 90) return 'A+';
    if (score >= 75) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    if (score >= 25) return 'D';
    return 'F';
  }
}

// ============================================================================
// Pattern Recognition
// ============================================================================

export class PatternRecognizer {
  /**
   * Detect chart patterns from OHLCV data
   */
  detectPatterns(ohlcv: Array<{
    time: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>): Pattern[] {
    const patterns: Pattern[] = [];
    
    if (ohlcv.length < 20) return patterns;
    
    // Simple breakout detection
    const recent = ohlcv.slice(-20);
    const current = recent[recent.length - 1];
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);
    const maxHigh = Math.max(...highs.slice(0, -1));
    const minLow = Math.min(...lows.slice(0, -1));
    
    // Breakout detection
    if (current.close > maxHigh) {
      patterns.push({
        type: 'breakout',
        confidence: this.calculateBreakoutConfidence(current, maxHigh, recent),
        breakoutTarget: maxHigh * 1.05 // 5% extension
      });
    }
    
    // Breakdown detection
    if (current.close < minLow) {
      patterns.push({
        type: 'breakdown',
        confidence: this.calculateBreakoutConfidence(current, minLow, recent),
        breakdownTarget: minLow * 0.95
      });
    }
    
    // Double bottom detection (simplified)
    const doubleBottom = this.detectDoubleBottom(recent);
    if (doubleBottom) patterns.push(doubleBottom);
    
    // Double top detection (simplified)
    const doubleTop = this.detectDoubleTop(recent);
    if (doubleTop) patterns.push(doubleTop);
    
    return patterns;
  }
  
  private calculateBreakoutConfidence(
    current: { close: number; volume: number },
    level: number,
    recent: Array<{ volume: number }>
  ): number {
    const avgVolume = recent.reduce((sum, c) => sum + c.volume, 0) / recent.length;
    const volumeRatio = current.volume / avgVolume;
    const priceStrength = Math.abs((current.close - level) / level) * 100;
    
    let confidence = 50;
    if (volumeRatio > 2) confidence += 25;
    else if (volumeRatio > 1.5) confidence += 15;
    if (priceStrength > 2) confidence += 15;
    
    return Math.min(95, confidence);
  }
  
  private detectDoubleBottom(data: Array<{
    time: Date;
    low: number;
    close: number;
  }>): Pattern | null {
    // Simplified double bottom: look for two similar lows with a peak between
    if (data.length < 10) return null;
    
    const lows = data.map((d, i) => ({ value: d.low, index: i }));
    lows.sort((a, b) => a.value - b.value);
    
    const lowest1 = lows[0];
    const lowest2 = lows.find(l => Math.abs(l.index - lowest1.index) > 3);
    
    if (!lowest2) return null;
    
    const tolerance = lowest1.value * 0.02; // 2% tolerance
    if (Math.abs(lowest1.value - lowest2.value) < tolerance) {
      const neckline = Math.max(
        ...data.slice(
          Math.min(lowest1.index, lowest2.index),
          Math.max(lowest1.index, lowest2.index)
        ).map(d => d.close)
      );
      
      return {
        type: 'double_bottom',
        confidence: 65,
        breakoutTarget: neckline + (neckline - lowest1.value),
        neckline
      };
    }
    
    return null;
  }
  
  private detectDoubleTop(data: Array<{
    time: Date;
    high: number;
    close: number;
  }>): Pattern | null {
    if (data.length < 10) return null;
    
    const highs = data.map((d, i) => ({ value: d.high, index: i }));
    highs.sort((a, b) => b.value - a.value);
    
    const highest1 = highs[0];
    const highest2 = highs.find(h => Math.abs(h.index - highest1.index) > 3);
    
    if (!highest2) return null;
    
    const tolerance = highest1.value * 0.02;
    if (Math.abs(highest1.value - highest2.value) < tolerance) {
      const neckline = Math.min(
        ...data.slice(
          Math.min(highest1.index, highest2.index),
          Math.max(highest1.index, highest2.index)
        ).map(d => d.close)
      );
      
      return {
        type: 'double_top',
        confidence: 65,
        breakdownTarget: neckline - (highest1.value - neckline),
        neckline
      };
    }
    
    return null;
  }
}

// ============================================================================
// NLP Query Parser
// ============================================================================

export class NLPQueryParser {
  private keywords = {
    bullish: ['bullish', 'uptrend', 'rising', 'growth', 'momentum', 'breakout'],
    bearish: ['bearish', 'downtrend', 'falling', 'decline', 'breakdown'],
    oversold: ['oversold', 'undervalued', 'cheap', 'discount', 'dip'],
    overbought: ['overbought', 'overvalued', 'expensive', 'stretched'],
    sectors: {
      tech: ['tech', 'technology', 'software', 'ai', 'semiconductor', 'chip'],
      finance: ['finance', 'bank', 'financial', 'insurance'],
      healthcare: ['health', 'healthcare', 'pharma', 'biotech', 'medical'],
      energy: ['energy', 'oil', 'gas', 'solar', 'renewable'],
      consumer: ['consumer', 'retail', 'ecommerce']
    },
    markets: {
      crypto: ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'coin', 'token'],
      forex: ['forex', 'fx', 'currency', 'eur', 'usd', 'gbp'],
      stocks: ['stock', 'equity', 'share']
    }
  };
  
  /**
   * Parse natural language query into filter conditions
   */
  parse(query: string): {
    markets: Market[];
    sectors: string[];
    conditions: Array<{
      type: string;
      operator: 'gt' | 'lt' | 'eq' | 'between';
      value: number | [number, number];
    }>;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    limit: number;
  } {
    const q = query.toLowerCase();
    
    // Detect market
    const markets: Market[] = [];
    if (this.keywords.markets.crypto.some(k => q.includes(k))) markets.push('CRYPTO');
    if (this.keywords.markets.forex.some(k => q.includes(k))) markets.push('FOREX');
    if (markets.length === 0 || this.keywords.markets.stocks.some(k => q.includes(k))) {
      markets.push('US_STOCKS');
    }
    
    // Detect sectors
    const sectors: string[] = [];
    for (const [sector, keywords] of Object.entries(this.keywords.sectors)) {
      if (keywords.some(k => q.includes(k))) sectors.push(sector);
    }
    
    // Detect sentiment
    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (this.keywords.bullish.some(k => q.includes(k))) sentiment = 'bullish';
    if (this.keywords.bearish.some(k => q.includes(k))) sentiment = 'bearish';
    
    // Extract numeric conditions
    const conditions: Array<{
      type: string;
      operator: 'gt' | 'lt' | 'eq' | 'between';
      value: number | [number, number];
    }> = [];
    
    // RSI extraction
    const rsiMatch = q.match(/rsi\s*(below|under|above|over)?\s*(\d+)/i);
    if (rsiMatch) {
      conditions.push({
        type: 'rsi',
        operator: rsiMatch[1]?.match(/below|under/i) ? 'lt' : 'gt',
        value: parseInt(rsiMatch[2])
      });
    } else if (this.keywords.oversold.some(k => q.includes(k))) {
      conditions.push({ type: 'rsi', operator: 'lt', value: 30 });
    } else if (this.keywords.overbought.some(k => q.includes(k))) {
      conditions.push({ type: 'rsi', operator: 'gt', value: 70 });
    }
    
    // Price extraction
    const priceMatch = q.match(/(?:price\s+)?(?:under|below|above|over)\s+\$?(\d+)/i);
    if (priceMatch) {
      conditions.push({
        type: 'price',
        operator: q.includes('under') || q.includes('below') ? 'lt' : 'gt',
        value: parseFloat(priceMatch[1])
      });
    }
    
    // Limit extraction
    const limitMatch = q.match(/(?:top|first|show)\s*(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1]) : 20;
    
    return { markets, sectors, conditions, sentiment, limit };
  }
}

// ============================================================================
// AI Screener
// ============================================================================

export class AIScreener extends EventEmitter {
  private factorCalc: FactorCalculator;
  private patternRecog: PatternRecognizer;
  private nlpParser: NLPQueryParser;
  private scanInterval?: NodeJS.Timeout;
  
  constructor() {
    super();
    this.factorCalc = new FactorCalculator();
    this.patternRecog = new PatternRecognizer();
    this.nlpParser = new NLPQueryParser();
  }
  
  /**
   * Get top rated stocks
   */
  async getTopRated(options: {
    market?: Market;
    minRating?: Rating;
    sector?: string;
    limit?: number;
  } = {}): Promise<StockAnalysis[]> {
    const { market = 'US_STOCKS', minRating = 'B', limit = 20 } = options;
    
    // In production, fetch real data from APIs
    // This is a demonstration structure
    console.log(`Scanning ${market} for top ${minRating}+ rated stocks...`);
    
    // Simulated top picks structure
    const mockResults: StockAnalysis[] = [
      this.createMockAnalysis('NVDA', 'NVIDIA Corporation', 920.50, 'A+', 94),
      this.createMockAnalysis('MSFT', 'Microsoft Corporation', 415.20, 'A', 88),
      this.createMockAnalysis('GOOGL', 'Alphabet Inc', 175.30, 'A', 85),
      this.createMockAnalysis('META', 'Meta Platforms', 485.60, 'B', 78),
      this.createMockAnalysis('AMZN', 'Amazon.com Inc', 178.90, 'B', 75),
    ].slice(0, limit);
    
    return mockResults;
  }
  
  /**
   * Natural language query
   */
  async query(naturalQuery: string): Promise<StockAnalysis[]> {
    const parsed = this.nlpParser.parse(naturalQuery);
    console.log('Parsed query:', parsed);
    
    // Filter and return results based on parsed conditions
    return this.getTopRated({
      market: parsed.markets[0],
      limit: parsed.limit
    });
  }
  
  /**
   * Deep analysis of a single symbol
   */
  async analyze(symbol: string): Promise<StockAnalysis> {
    console.log(`Analyzing ${symbol}...`);
    
    // In production: fetch real data and calculate
    // Demo structure:
    return this.createMockAnalysis(symbol, `${symbol} Inc`, 100, 'B', 72);
  }
  
  /**
   * Scan for specific patterns
   */
  async scanPatterns(options: {
    symbols: string[];
    patterns: PatternType[];
  }): Promise<Array<{ symbol: string; patterns: Pattern[] }>> {
    const results: Array<{ symbol: string; patterns: Pattern[] }> = [];
    
    for (const symbol of options.symbols) {
      // In production: fetch OHLCV and detect patterns
      const detectedPatterns = options.patterns.map(type => ({
        type,
        confidence: Math.random() * 30 + 60 // 60-90%
      })).filter(() => Math.random() > 0.7); // Random filter for demo
      
      if (detectedPatterns.length > 0) {
        results.push({ symbol, patterns: detectedPatterns });
      }
    }
    
    return results;
  }
  
  /**
   * Start real-time scanner
   */
  startScanner(config: ScreenerConfig): void {
    console.log('Starting AI Scanner with conditions:', config.conditions);
    
    this.scanInterval = setInterval(async () => {
      // Scan markets for conditions
      for (const market of config.markets) {
        // In production: scan all symbols for conditions
        // Demo: random alerts
        if (Math.random() > 0.9) {
          const alert: ScreenerAlert = {
            id: Date.now().toString(),
            symbol: 'DEMO',
            type: config.conditions[0]?.type || 'breakout',
            message: `Demo alert triggered for ${market}`,
            severity: 'medium',
            price: 100,
            timestamp: new Date()
          };
          
          config.onAlert(alert);
          this.emit('alert', alert);
        }
      }
    }, 60000); // Every minute
    
    console.log('Scanner started. Listening for opportunities...');
  }
  
  /**
   * Stop scanner
   */
  stopScanner(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
      console.log('Scanner stopped.');
    }
  }
  
  /**
   * Holly AI - Get today's top picks
   */
  async getHollyPicks(): Promise<Array<{
    symbol: string;
    setup: string;
    entry: number;
    target: number;
    stopLoss: number;
    confidence: number;
  }>> {
    // AI-generated trade setups
    return [
      {
        symbol: 'AAPL',
        setup: 'Morning gap reversal',
        entry: 175.50,
        target: 180.00,
        stopLoss: 173.00,
        confidence: 78
      },
      {
        symbol: 'TSLA',
        setup: 'Breakout from consolidation',
        entry: 245.00,
        target: 260.00,
        stopLoss: 238.00,
        confidence: 72
      },
      {
        symbol: 'AMD',
        setup: 'RSI divergence bounce',
        entry: 118.50,
        target: 125.00,
        stopLoss: 115.00,
        confidence: 68
      }
    ];
  }
  
  /**
   * Create mock analysis (for demo purposes)
   */
  private createMockAnalysis(
    symbol: string,
    name: string,
    price: number,
    rating: Rating,
    score: number
  ): StockAnalysis {
    const fc = this.factorCalc;
    
    return {
      symbol,
      name,
      price,
      overallRating: rating,
      score,
      confidence: score - 5 + Math.random() * 10,
      grades: {
        fundamentals: fc.scoreToRating(score + Math.random() * 20 - 10),
        growth: fc.scoreToRating(score + Math.random() * 20 - 10),
        momentum: fc.scoreToRating(score + Math.random() * 20 - 10),
        safety: fc.scoreToRating(score - 10 + Math.random() * 20),
        sentiment: fc.scoreToRating(score + Math.random() * 20 - 10),
        value: fc.scoreToRating(score - 15 + Math.random() * 20),
        ai: fc.scoreToRating(score + Math.random() * 10)
      },
      signals: [
        { type: 'MACD_CROSS', direction: 'bullish', strength: 'moderate' },
        { type: 'ABOVE_50MA', direction: 'bullish', strength: 'strong' }
      ],
      patterns: [],
      aiPrediction: {
        direction: 'up',
        probability: (score / 100) * 0.3 + 0.5,
        priceTarget: {
          '7d': price * 1.02,
          '30d': price * 1.05,
          '90d': price * 1.12
        }
      },
      updatedAt: new Date()
    };
  }
}

// Export singleton
export const aiScreener = new AIScreener();

// Quick functions
export const quickScan = (query: string) => aiScreener.query(query);
export const topPicks = () => aiScreener.getTopRated({ minRating: 'A', limit: 10 });
export const hollyPicks = () => aiScreener.getHollyPicks();
export const analyze = (symbol: string) => aiScreener.analyze(symbol);
