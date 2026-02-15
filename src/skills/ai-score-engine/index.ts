/**
 * AI Score Engine Skill (#69)
 * Quant scoring system (0-100) for any asset
 * Combines technical, momentum, sentiment, and fundamental factors
 */

import { Skill, SkillContext, SkillResult } from '../../types/skill.js';

interface ScoreWeights {
  technical: number;
  momentum: number;
  sentiment: number;
  fundamental: number;
}

interface ScoreBreakdown {
  technical: number;
  momentum: number;
  sentiment: number;
  fundamental: number;
}

interface ScoreResult {
  symbol: string;
  score: number;
  rating: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  signal: 'LONG' | 'FLAT' | 'SHORT';
  breakdown: ScoreBreakdown;
  keyFactors: string[];
  confidence: number;
  lastUpdate: string;
}

interface AIScoreConfig {
  weights: ScoreWeights;
  thresholds: {
    strongBuy: number;
    buy: number;
    neutral: number;
    sell: number;
  };
  model?: 'conservative' | 'aggressive' | 'balanced';
}

const DEFAULT_CONFIG: AIScoreConfig = {
  weights: {
    technical: 0.40,
    momentum: 0.25,
    sentiment: 0.20,
    fundamental: 0.15,
  },
  thresholds: {
    strongBuy: 80,
    buy: 60,
    neutral: 40,
    sell: 20,
  },
};

const MODEL_CONFIGS: Record<string, Partial<ScoreWeights>> = {
  conservative: { technical: 0.50, momentum: 0.15, sentiment: 0.10, fundamental: 0.25 },
  aggressive: { technical: 0.25, momentum: 0.50, sentiment: 0.20, fundamental: 0.05 },
  balanced: { technical: 0.35, momentum: 0.25, sentiment: 0.20, fundamental: 0.20 },
};

export class AIScoreEngineSkill implements Skill {
  name = 'ai-score-engine';
  description = 'Quant scoring system (0-100) for any asset';
  version = '1.0.0';

  private _config: AIScoreConfig;
  private logger: any;

  constructor(config: Partial<AIScoreConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    if (config.model && MODEL_CONFIGS[config.model]) {
      this._config.weights = { ...this._config.weights, ...MODEL_CONFIGS[config.model] };
    }
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    if (!context.input) {
      return { success: false, error: 'No input provided' };
    }

    this.logger = context.logger;
    const { action, params } = context.input;

    switch (action) {
      case 'score':
        return this.scoreAsset(params);
      case 'batch':
        return this.batchScore(params);
      case 'compare':
        return this.compareAssets(params);
      case 'history':
        return this.getScoreHistory(params);
      default:
        return this.scoreAsset(params);
    }
  }

  private async scoreAsset(params: any): Promise<SkillResult> {
    const { symbol, model } = params || {};
    
    if (!symbol) {
      return { success: false, error: 'Symbol is required' };
    }

    // Apply model weights if specified
    if (model && MODEL_CONFIGS[model]) {
      this._config.weights = { ...this._config.weights, ...MODEL_CONFIGS[model] };
    }

    try {
      const breakdown = await this.calculateBreakdown(symbol);
      const score = this.calculateWeightedScore(breakdown);
      const { rating, signal } = this.getRatingAndSignal(score);
      const keyFactors = this.identifyKeyFactors(breakdown, symbol);
      const confidence = this.calculateConfidence(breakdown);

      const result: ScoreResult = {
        symbol,
        score: Math.round(score),
        rating,
        signal,
        breakdown,
        keyFactors,
        confidence: parseFloat(confidence.toFixed(2)),
        lastUpdate: new Date().toISOString(),
      };

      this.logger?.info(`AI Score for ${symbol}: ${score} (${rating})`);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to score ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async batchScore(params: any): Promise<SkillResult> {
    const { symbols, watchlist, sort = 'desc', limit = 20 } = params || {};
    
    const symbolList = symbols || this.getWatchlistSymbols(watchlist);
    
    if (!symbolList || symbolList.length === 0) {
      return { success: false, error: 'No symbols provided or watchlist not found' };
    }

    const results: ScoreResult[] = [];
    
    for (const symbol of symbolList.slice(0, limit)) {
      const result = await this.scoreAsset({ symbol });
      if (result.success && result.data) {
        results.push(result.data as ScoreResult);
      }
    }

    // Sort results
    results.sort((a, b) => sort === 'desc' ? b.score - a.score : a.score - b.score);

    return {
      success: true,
      data: {
        count: results.length,
        sort,
        results,
        topPicks: results.filter(r => r.score >= this._config.thresholds.buy),
        bottomPicks: results.filter(r => r.score < this._config.thresholds.sell),
      },
    };
  }

  private async compareAssets(params: any): Promise<SkillResult> {
    const { symbols } = params || {};
    
    if (!symbols || symbols.length < 2) {
      return { success: false, error: 'At least 2 symbols required for comparison' };
    }

    const batchResult = await this.batchScore({ symbols, sort: 'desc' });
    if (!batchResult.success) return batchResult;

    const results = (batchResult.data as any).results as ScoreResult[];
    const winner = results[0];
    const loser = results[results.length - 1];

    return {
      success: true,
      data: {
        comparison: results.map(r => ({
          symbol: r.symbol,
          score: r.score,
          rating: r.rating,
          signal: r.signal,
        })),
        winner: {
          symbol: winner.symbol,
          score: winner.score,
          advantage: `${(winner.score - loser.score).toFixed(0)} points higher`,
        },
        recommendation: winner.signal === 'LONG' 
          ? `Consider ${winner.symbol} as the stronger asset`
          : 'No strong buy signal in comparison',
      },
    };
  }

  private async getScoreHistory(params: any): Promise<SkillResult> {
    const { symbol, days = 7 } = params || {};
    
    if (!symbol) {
      return { success: false, error: 'Symbol is required' };
    }

    // Generate mock historical data for demonstration
    const history: { date: string; score: number; rating: string }[] = [];
    let baseScore = 50 + Math.random() * 30;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Add some variance
      baseScore = Math.max(10, Math.min(95, baseScore + (Math.random() - 0.5) * 10));
      const { rating } = this.getRatingAndSignal(baseScore);

      history.push({
        date: date.toISOString().split('T')[0],
        score: Math.round(baseScore),
        rating,
      });
    }

    return {
      success: true,
      data: {
        symbol,
        days,
        history,
        trend: history[history.length - 1].score > history[0].score ? 'improving' : 'declining',
        avgScore: Math.round(history.reduce((sum, h) => sum + h.score, 0) / history.length),
      },
    };
  }

  private async calculateBreakdown(symbol: string): Promise<ScoreBreakdown> {
    // In production, these would call real APIs/data sources
    // For now, generate realistic mock scores based on symbol characteristics
    
    const baseVariance = this.getSymbolVariance(symbol);
    
    return {
      technical: this.clampScore(65 + baseVariance.technical + (Math.random() - 0.5) * 20),
      momentum: this.clampScore(60 + baseVariance.momentum + (Math.random() - 0.5) * 25),
      sentiment: this.clampScore(55 + baseVariance.sentiment + (Math.random() - 0.5) * 30),
      fundamental: this.clampScore(58 + baseVariance.fundamental + (Math.random() - 0.5) * 20),
    };
  }

  private getSymbolVariance(symbol: string): ScoreBreakdown {
    // Different asset classes have different base characteristics
    const upperSymbol = symbol.toUpperCase();
    
    if (upperSymbol.includes('BTC')) {
      return { technical: 10, momentum: 15, sentiment: 20, fundamental: 5 };
    } else if (upperSymbol.includes('ETH')) {
      return { technical: 8, momentum: 12, sentiment: 18, fundamental: 10 };
    } else if (upperSymbol.includes('USD')) {
      return { technical: 5, momentum: -5, sentiment: 0, fundamental: 15 };
    } else if (upperSymbol.includes('EUR')) {
      return { technical: 3, momentum: -3, sentiment: 2, fundamental: 12 };
    }
    
    return { technical: 0, momentum: 0, sentiment: 0, fundamental: 0 };
  }

  private calculateWeightedScore(breakdown: ScoreBreakdown): number {
    const { weights } = this._config;
    return (
      breakdown.technical * weights.technical +
      breakdown.momentum * weights.momentum +
      breakdown.sentiment * weights.sentiment +
      breakdown.fundamental * weights.fundamental
    );
  }

  private getRatingAndSignal(score: number): { rating: ScoreResult['rating']; signal: ScoreResult['signal'] } {
    const { thresholds } = this._config;
    
    if (score >= thresholds.strongBuy) {
      return { rating: 'Strong Buy', signal: 'LONG' };
    } else if (score >= thresholds.buy) {
      return { rating: 'Buy', signal: 'LONG' };
    } else if (score >= thresholds.neutral) {
      return { rating: 'Neutral', signal: 'FLAT' };
    } else if (score >= thresholds.sell) {
      return { rating: 'Sell', signal: 'SHORT' };
    } else {
      return { rating: 'Strong Sell', signal: 'SHORT' };
    }
  }

  private identifyKeyFactors(breakdown: ScoreBreakdown, symbol: string): string[] {
    const factors: string[] = [];
    
    if (breakdown.technical > 70) {
      factors.push('Strong technical setup on multiple timeframes');
    } else if (breakdown.technical < 40) {
      factors.push('Weak technical picture, bearish structure');
    }

    if (breakdown.momentum > 75) {
      factors.push('High momentum, potential continuation');
    } else if (breakdown.momentum < 35) {
      factors.push('Momentum declining, caution advised');
    }

    if (breakdown.sentiment > 70) {
      factors.push('Bullish market sentiment');
    } else if (breakdown.sentiment < 35) {
      factors.push('Bearish sentiment prevailing');
    }

    if (breakdown.fundamental > 70) {
      factors.push('Strong fundamentals support price');
    }

    // Add at least one factor
    if (factors.length === 0) {
      factors.push(`${symbol} showing mixed signals`);
    }

    return factors.slice(0, 4);
  }

  private calculateConfidence(breakdown: ScoreBreakdown): number {
    // Confidence is higher when all factors align
    const scores = Object.values(breakdown);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower std dev = higher confidence (factors are aligned)
    // Max confidence when stdDev = 0, decreases as stdDev increases
    return Math.max(0.5, 1 - (stdDev / 50));
  }

  private clampScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private getWatchlistSymbols(watchlistName: string): string[] | null {
    // Common watchlists
    const watchlists: Record<string, string[]> = {
      crypto_top_20: [
        'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
        'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT',
        'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'NEAR/USDT', 'APT/USDT',
        'ARB/USDT', 'OP/USDT', 'INJ/USDT', 'IMX/USDT', 'FTM/USDT',
      ],
      forex_majors: [
        'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
      ],
      tech_stocks: [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'CRM',
      ],
    };

    return watchlists[watchlistName] || null;
  }
}

// Export singleton instance
export const aiScoreEngine = new AIScoreEngineSkill();
export default aiScoreEngine;
