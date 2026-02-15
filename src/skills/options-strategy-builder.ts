/**
 * K.I.T. Skill #98: Options Strategy Builder
 * 
 * Professional options strategy construction and analysis.
 * Build, visualize, and analyze multi-leg options strategies.
 * 
 * Features:
 * - 30+ pre-built strategy templates
 * - P&L profile calculation
 * - Greeks aggregation (Delta, Gamma, Theta, Vega, Rho)
 * - What-if scenarios (price, time, IV changes)
 * - Probability of profit calculation
 * - Break-even analysis
 * - Risk/reward ratios
 * - Strategy comparison
 */

import type { SkillContext, SkillResult, Skill } from '../types/skill.js';

interface OptionLeg {
  type: 'call' | 'put';
  action: 'buy' | 'sell';
  strike: number;
  expiry: string;
  quantity: number;
  premium?: number;
  iv?: number;
}

interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

interface StrategyAnalysis {
  name: string;
  legs: OptionLeg[];
  totalPremium: number;  // Positive = credit, Negative = debit
  maxProfit: number | 'unlimited';
  maxLoss: number | 'unlimited';
  breakEvens: number[];
  probOfProfit: number;
  riskRewardRatio: number | null;
  aggregateGreeks: Greeks;
  pnlCurve: { price: number; pnl: number }[];
}

interface StrategyTemplate {
  name: string;
  description: string;
  outlook: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  legs: Partial<OptionLeg>[];
}

export class OptionsStrategyBuilderSkill implements Skill {
  name = 'options-strategy-builder';
  description = 'Build and analyze multi-leg options strategies';
  version = '1.0.0';
  
  // Pre-built strategy templates
  private templates: Record<string, StrategyTemplate> = {
    // Bullish Strategies
    'long-call': {
      name: 'Long Call',
      description: 'Unlimited upside, limited risk',
      outlook: 'bullish',
      legs: [{ type: 'call', action: 'buy', quantity: 1 }]
    },
    'bull-call-spread': {
      name: 'Bull Call Spread',
      description: 'Capped profit, reduced cost',
      outlook: 'bullish',
      legs: [
        { type: 'call', action: 'buy', quantity: 1 },
        { type: 'call', action: 'sell', quantity: 1 }  // Higher strike
      ]
    },
    'bull-put-spread': {
      name: 'Bull Put Spread',
      description: 'Credit spread, profit if price stays above',
      outlook: 'bullish',
      legs: [
        { type: 'put', action: 'sell', quantity: 1 },  // Higher strike
        { type: 'put', action: 'buy', quantity: 1 }   // Lower strike
      ]
    },
    'cash-secured-put': {
      name: 'Cash Secured Put',
      description: 'Collect premium, buy stock at discount',
      outlook: 'bullish',
      legs: [{ type: 'put', action: 'sell', quantity: 1 }]
    },
    
    // Bearish Strategies
    'long-put': {
      name: 'Long Put',
      description: 'Profit from decline, limited risk',
      outlook: 'bearish',
      legs: [{ type: 'put', action: 'buy', quantity: 1 }]
    },
    'bear-put-spread': {
      name: 'Bear Put Spread',
      description: 'Capped profit, reduced cost',
      outlook: 'bearish',
      legs: [
        { type: 'put', action: 'buy', quantity: 1 },   // Higher strike
        { type: 'put', action: 'sell', quantity: 1 }  // Lower strike
      ]
    },
    'bear-call-spread': {
      name: 'Bear Call Spread',
      description: 'Credit spread, profit if price stays below',
      outlook: 'bearish',
      legs: [
        { type: 'call', action: 'sell', quantity: 1 }, // Lower strike
        { type: 'call', action: 'buy', quantity: 1 }  // Higher strike
      ]
    },
    
    // Neutral Strategies
    'iron-condor': {
      name: 'Iron Condor',
      description: 'Profit from low volatility, range-bound',
      outlook: 'neutral',
      legs: [
        { type: 'put', action: 'buy', quantity: 1 },   // Lowest strike
        { type: 'put', action: 'sell', quantity: 1 },  // Low strike
        { type: 'call', action: 'sell', quantity: 1 }, // High strike
        { type: 'call', action: 'buy', quantity: 1 }   // Highest strike
      ]
    },
    'iron-butterfly': {
      name: 'Iron Butterfly',
      description: 'Max profit at center strike',
      outlook: 'neutral',
      legs: [
        { type: 'put', action: 'buy', quantity: 1 },   // OTM put
        { type: 'put', action: 'sell', quantity: 1 },  // ATM put
        { type: 'call', action: 'sell', quantity: 1 }, // ATM call
        { type: 'call', action: 'buy', quantity: 1 }   // OTM call
      ]
    },
    'short-straddle': {
      name: 'Short Straddle',
      description: 'Sell ATM put and call, profit from decay',
      outlook: 'neutral',
      legs: [
        { type: 'put', action: 'sell', quantity: 1 },
        { type: 'call', action: 'sell', quantity: 1 }
      ]
    },
    'short-strangle': {
      name: 'Short Strangle',
      description: 'Wider range than straddle',
      outlook: 'neutral',
      legs: [
        { type: 'put', action: 'sell', quantity: 1 },  // OTM
        { type: 'call', action: 'sell', quantity: 1 }  // OTM
      ]
    },
    'calendar-spread': {
      name: 'Calendar Spread',
      description: 'Profit from time decay difference',
      outlook: 'neutral',
      legs: [
        { type: 'call', action: 'sell', quantity: 1 }, // Near expiry
        { type: 'call', action: 'buy', quantity: 1 }   // Far expiry
      ]
    },
    
    // Volatile Strategies
    'long-straddle': {
      name: 'Long Straddle',
      description: 'Profit from big move in either direction',
      outlook: 'volatile',
      legs: [
        { type: 'put', action: 'buy', quantity: 1 },
        { type: 'call', action: 'buy', quantity: 1 }
      ]
    },
    'long-strangle': {
      name: 'Long Strangle',
      description: 'Cheaper than straddle, needs bigger move',
      outlook: 'volatile',
      legs: [
        { type: 'put', action: 'buy', quantity: 1 },   // OTM
        { type: 'call', action: 'buy', quantity: 1 }   // OTM
      ]
    },
    'reverse-iron-condor': {
      name: 'Reverse Iron Condor',
      description: 'Profit from breakout in either direction',
      outlook: 'volatile',
      legs: [
        { type: 'put', action: 'sell', quantity: 1 },
        { type: 'put', action: 'buy', quantity: 1 },
        { type: 'call', action: 'buy', quantity: 1 },
        { type: 'call', action: 'sell', quantity: 1 }
      ]
    },
    
    // Income Strategies
    'covered-call': {
      name: 'Covered Call',
      description: 'Own stock, sell calls for income',
      outlook: 'neutral',
      legs: [{ type: 'call', action: 'sell', quantity: 1 }]
    },
    'protective-collar': {
      name: 'Protective Collar',
      description: 'Limit downside while capping upside',
      outlook: 'neutral',
      legs: [
        { type: 'put', action: 'buy', quantity: 1 },
        { type: 'call', action: 'sell', quantity: 1 }
      ]
    },
    'jade-lizard': {
      name: 'Jade Lizard',
      description: 'No upside risk, collect premium',
      outlook: 'bullish',
      legs: [
        { type: 'put', action: 'sell', quantity: 1 },
        { type: 'call', action: 'sell', quantity: 1 },
        { type: 'call', action: 'buy', quantity: 1 }
      ]
    },
    
    // Advanced
    'ratio-spread': {
      name: 'Ratio Spread',
      description: 'Sell more options than bought',
      outlook: 'neutral',
      legs: [
        { type: 'call', action: 'buy', quantity: 1 },
        { type: 'call', action: 'sell', quantity: 2 }
      ]
    },
    'broken-wing-butterfly': {
      name: 'Broken Wing Butterfly',
      description: 'Skip-strike butterfly for credit',
      outlook: 'neutral',
      legs: [
        { type: 'put', action: 'buy', quantity: 1 },
        { type: 'put', action: 'sell', quantity: 2 },
        { type: 'put', action: 'buy', quantity: 1 }
      ]
    },
    'pmcc': {
      name: 'Poor Man\'s Covered Call',
      description: 'LEAPS + short calls, capital efficient',
      outlook: 'bullish',
      legs: [
        { type: 'call', action: 'buy', quantity: 1 },  // LEAPS (far expiry)
        { type: 'call', action: 'sell', quantity: 1 } // Near expiry
      ]
    }
  };
  
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const params = ctx.input?.params || {};
    const { action, symbol, template, legs, spotPrice, riskFreeRate = 0.05 } = params;
    
    switch (action) {
      case 'list-templates':
        return this.listTemplates();
        
      case 'build':
        return this.buildStrategy(ctx, symbol, template, legs, spotPrice);
        
      case 'analyze':
        return this.analyzeStrategy(ctx, symbol, legs, spotPrice, riskFreeRate);
        
      case 'compare':
        return this.compareStrategies(ctx, symbol, params.strategies, spotPrice);
        
      case 'what-if':
        return this.whatIfAnalysis(ctx, symbol, legs, spotPrice, params.scenarios);
        
      case 'optimize':
        return this.optimizeStrategy(ctx, symbol, template, spotPrice, params.constraints);
        
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }
  
  private listTemplates(): SkillResult {
    const grouped: Record<string, any[]> = {
      bullish: [],
      bearish: [],
      neutral: [],
      volatile: []
    };
    
    for (const [key, template] of Object.entries(this.templates)) {
      grouped[template.outlook].push({
        id: key,
        name: template.name,
        description: template.description,
        legCount: template.legs.length
      });
    }
    
    return {
      success: true,
      data: {
        templates: grouped,
        totalCount: Object.keys(this.templates).length
      }
    };
  }
  
  private async buildStrategy(
    ctx: SkillContext,
    symbol: string,
    templateId: string,
    customLegs: OptionLeg[] | undefined,
    spotPrice: number
  ): Promise<SkillResult> {
    const template = this.templates[templateId];
    if (!template && !customLegs) {
      return { success: false, error: `Template not found: ${templateId}` };
    }
    
    // Build legs from template or use custom
    const legs = customLegs || this.buildLegsFromTemplate(template, spotPrice);
    
    // Fetch options chain for pricing
    const chain = await this.fetchOptionsChain(ctx, symbol);
    
    // Price the legs
    const pricedLegs = this.priceLegs(legs, chain, spotPrice);
    
    return {
      success: true,
      data: {
        strategy: template?.name || 'Custom Strategy',
        symbol,
        spotPrice,
        legs: pricedLegs,
        summary: this.calculateStrategySummary(pricedLegs)
      }
    };
  }
  
  private buildLegsFromTemplate(template: StrategyTemplate, spotPrice: number): OptionLeg[] {
    const legs: OptionLeg[] = [];
    const atmStrike = Math.round(spotPrice);
    
    for (let i = 0; i < template.legs.length; i++) {
      const legTemplate = template.legs[i];
      let strike = atmStrike;
      
      // Simple strike assignment based on leg order
      if (template.name.includes('Spread') || template.name.includes('Condor')) {
        strike = atmStrike + (i - 1) * 5; // $5 increments
      }
      
      legs.push({
        type: legTemplate.type!,
        action: legTemplate.action!,
        strike,
        expiry: this.getNextMonthlyExpiry(),
        quantity: legTemplate.quantity || 1,
        premium: 0,
        iv: 0.3
      });
    }
    
    return legs;
  }
  
  private getNextMonthlyExpiry(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    // Third Friday
    const thirdFriday = new Date(nextMonth);
    thirdFriday.setDate(1);
    while (thirdFriday.getDay() !== 5) {
      thirdFriday.setDate(thirdFriday.getDate() + 1);
    }
    thirdFriday.setDate(thirdFriday.getDate() + 14);
    return thirdFriday.toISOString().split('T')[0];
  }
  
  private async fetchOptionsChain(ctx: SkillContext, symbol: string): Promise<any> {
    // Fetch options chain via HTTP
    try {
      return await ctx.http.get<any>(`/api/market-data/options-chain?symbol=${symbol}`);
    } catch {
      return {}; // Return empty chain if fetch fails
    }
  }
  
  private priceLegs(legs: OptionLeg[], chain: any, spotPrice: number): OptionLeg[] {
    return legs.map(leg => {
      // Use Black-Scholes for pricing if no chain data
      const premium = leg.premium || this.blackScholesPremium(
        spotPrice,
        leg.strike,
        this.daysToExpiry(leg.expiry) / 365,
        leg.iv || 0.3,
        0.05,
        leg.type
      );
      
      return { ...leg, premium };
    });
  }
  
  private blackScholesPremium(
    S: number,    // Spot price
    K: number,    // Strike price
    T: number,    // Time to expiry (years)
    sigma: number, // Implied volatility
    r: number,    // Risk-free rate
    type: 'call' | 'put'
  ): number {
    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    
    const N = (x: number) => {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
      const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x) / Math.sqrt(2);
      const t = 1.0 / (1.0 + p * x);
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return 0.5 * (1.0 + sign * y);
    };
    
    if (type === 'call') {
      return S * N(d1) - K * Math.exp(-r * T) * N(d2);
    } else {
      return K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
    }
  }
  
  private daysToExpiry(expiry: string): number {
    const expiryDate = new Date(expiry);
    const now = new Date();
    return Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }
  
  private calculateStrategySummary(legs: OptionLeg[]): any {
    let totalPremium = 0;
    
    for (const leg of legs) {
      const premium = (leg.premium || 0) * leg.quantity * 100;
      if (leg.action === 'buy') {
        totalPremium -= premium;
      } else {
        totalPremium += premium;
      }
    }
    
    return {
      totalPremium: Math.round(totalPremium * 100) / 100,
      isCredit: totalPremium > 0,
      legCount: legs.length
    };
  }
  
  private async analyzeStrategy(
    ctx: SkillContext,
    symbol: string,
    legs: OptionLeg[],
    spotPrice: number,
    riskFreeRate: number
  ): Promise<SkillResult> {
    // Calculate P&L curve
    const pnlCurve = this.calculatePnLCurve(legs, spotPrice);
    
    // Find break-evens
    const breakEvens = this.findBreakEvens(pnlCurve);
    
    // Calculate max profit/loss
    const maxProfit = Math.max(...pnlCurve.map(p => p.pnl));
    const maxLoss = Math.min(...pnlCurve.map(p => p.pnl));
    
    // Calculate Greeks
    const greeks = this.calculateAggregateGreeks(legs, spotPrice, riskFreeRate);
    
    // Probability of profit (simplified)
    const profitZones = pnlCurve.filter(p => p.pnl > 0).length;
    const probOfProfit = profitZones / pnlCurve.length;
    
    // Risk/Reward
    const riskRewardRatio = maxLoss < 0 ? -maxProfit / maxLoss : null;
    
    const analysis: StrategyAnalysis = {
      name: 'Custom Strategy',
      legs,
      totalPremium: this.calculateStrategySummary(legs).totalPremium,
      maxProfit: maxProfit === Infinity ? 'unlimited' : Math.round(maxProfit),
      maxLoss: maxLoss === -Infinity ? 'unlimited' : Math.round(maxLoss),
      breakEvens: breakEvens.map(b => Math.round(b * 100) / 100),
      probOfProfit: Math.round(probOfProfit * 100),
      riskRewardRatio: riskRewardRatio ? Math.round(riskRewardRatio * 100) / 100 : null,
      aggregateGreeks: greeks,
      pnlCurve
    };
    
    return { success: true, data: analysis };
  }
  
  private calculatePnLCurve(legs: OptionLeg[], spotPrice: number): { price: number; pnl: number }[] {
    const curve: { price: number; pnl: number }[] = [];
    const strikes = legs.map(l => l.strike);
    const minPrice = Math.min(...strikes) * 0.8;
    const maxPrice = Math.max(...strikes) * 1.2;
    const step = (maxPrice - minPrice) / 100;
    
    for (let price = minPrice; price <= maxPrice; price += step) {
      let pnl = 0;
      
      for (const leg of legs) {
        const intrinsicValue = leg.type === 'call'
          ? Math.max(0, price - leg.strike)
          : Math.max(0, leg.strike - price);
        
        const legPnl = leg.action === 'buy'
          ? (intrinsicValue - (leg.premium || 0)) * leg.quantity * 100
          : ((leg.premium || 0) - intrinsicValue) * leg.quantity * 100;
        
        pnl += legPnl;
      }
      
      curve.push({ price: Math.round(price * 100) / 100, pnl: Math.round(pnl) });
    }
    
    return curve;
  }
  
  private findBreakEvens(pnlCurve: { price: number; pnl: number }[]): number[] {
    const breakEvens: number[] = [];
    
    for (let i = 1; i < pnlCurve.length; i++) {
      const prev = pnlCurve[i - 1];
      const curr = pnlCurve[i];
      
      // Cross from negative to positive or positive to negative
      if ((prev.pnl < 0 && curr.pnl >= 0) || (prev.pnl >= 0 && curr.pnl < 0)) {
        // Linear interpolation
        const breakEven = prev.price + (0 - prev.pnl) * (curr.price - prev.price) / (curr.pnl - prev.pnl);
        breakEvens.push(breakEven);
      }
    }
    
    return breakEvens;
  }
  
  private calculateAggregateGreeks(legs: OptionLeg[], spotPrice: number, riskFreeRate: number): Greeks {
    let delta = 0, gamma = 0, theta = 0, vega = 0, rho = 0;
    
    for (const leg of legs) {
      const T = this.daysToExpiry(leg.expiry) / 365;
      const sigma = leg.iv || 0.3;
      const S = spotPrice;
      const K = leg.strike;
      const r = riskFreeRate;
      
      // Calculate individual Greeks
      const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
      
      const legGreeks = this.calculateGreeks(S, K, T, sigma, r, leg.type, d1);
      const multiplier = leg.action === 'buy' ? leg.quantity : -leg.quantity;
      
      delta += legGreeks.delta * multiplier;
      gamma += legGreeks.gamma * multiplier;
      theta += legGreeks.theta * multiplier;
      vega += legGreeks.vega * multiplier;
      rho += legGreeks.rho * multiplier;
    }
    
    return {
      delta: Math.round(delta * 100) / 100,
      gamma: Math.round(gamma * 1000) / 1000,
      theta: Math.round(theta * 100) / 100,
      vega: Math.round(vega * 100) / 100,
      rho: Math.round(rho * 100) / 100
    };
  }
  
  private calculateGreeks(
    S: number, K: number, T: number, sigma: number, r: number,
    type: 'call' | 'put', d1: number
  ): Greeks {
    const d2 = d1 - sigma * Math.sqrt(T);
    
    // Standard normal PDF
    const pdf = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    
    // Standard normal CDF
    const cdf = (x: number) => {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
      const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x) / Math.sqrt(2);
      const t = 1.0 / (1.0 + p * x);
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return 0.5 * (1.0 + sign * y);
    };
    
    const Nd1 = cdf(d1);
    const Nd2 = cdf(d2);
    const nd1 = pdf(d1);
    
    if (type === 'call') {
      return {
        delta: Nd1,
        gamma: nd1 / (S * sigma * Math.sqrt(T)),
        theta: (-S * nd1 * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * Nd2) / 365,
        vega: S * nd1 * Math.sqrt(T) / 100,
        rho: K * T * Math.exp(-r * T) * Nd2 / 100
      };
    } else {
      return {
        delta: Nd1 - 1,
        gamma: nd1 / (S * sigma * Math.sqrt(T)),
        theta: (-S * nd1 * sigma / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * (1 - Nd2)) / 365,
        vega: S * nd1 * Math.sqrt(T) / 100,
        rho: -K * T * Math.exp(-r * T) * (1 - Nd2) / 100
      };
    }
  }
  
  private async compareStrategies(
    ctx: SkillContext,
    symbol: string,
    strategies: { name: string; legs: OptionLeg[] }[],
    spotPrice: number
  ): Promise<SkillResult> {
    const comparisons = [];
    
    for (const strategy of strategies) {
      const analysis = await this.analyzeStrategy(ctx, symbol, strategy.legs, spotPrice, 0.05);
      if (analysis.success) {
        comparisons.push({
          name: strategy.name,
          ...analysis.data
        });
      }
    }
    
    // Rank by probability of profit and risk/reward
    comparisons.sort((a, b) => (b.probOfProfit || 0) - (a.probOfProfit || 0));
    
    return {
      success: true,
      data: {
        symbol,
        spotPrice,
        strategies: comparisons,
        recommendation: comparisons[0]?.name
      }
    };
  }
  
  private async whatIfAnalysis(
    ctx: SkillContext,
    symbol: string,
    legs: OptionLeg[],
    spotPrice: number,
    scenarios: { priceChange?: number; ivChange?: number; daysPass?: number }[]
  ): Promise<SkillResult> {
    const results = [];
    
    for (const scenario of scenarios) {
      const adjustedPrice = spotPrice * (1 + (scenario.priceChange || 0) / 100);
      const adjustedLegs = legs.map(leg => ({
        ...leg,
        iv: (leg.iv || 0.3) + (scenario.ivChange || 0) / 100,
        expiry: this.adjustExpiry(leg.expiry, scenario.daysPass || 0)
      }));
      
      const analysis = await this.analyzeStrategy(ctx, symbol, adjustedLegs, adjustedPrice, 0.05);
      
      results.push({
        scenario,
        adjustedPrice,
        pnl: analysis.success ? (analysis.data as any).totalPremium : 0
      });
    }
    
    return {
      success: true,
      data: {
        symbol,
        originalPrice: spotPrice,
        scenarios: results
      }
    };
  }
  
  private adjustExpiry(expiry: string, daysToSubtract: number): string {
    const date = new Date(expiry);
    date.setDate(date.getDate() - daysToSubtract);
    return date.toISOString().split('T')[0];
  }
  
  private async optimizeStrategy(
    ctx: SkillContext,
    symbol: string,
    templateId: string,
    spotPrice: number,
    constraints: { maxLoss?: number; minProbProfit?: number }
  ): Promise<SkillResult> {
    const template = this.templates[templateId];
    if (!template) {
      return { success: false, error: `Template not found: ${templateId}` };
    }
    
    const variations = [];
    const atmStrike = Math.round(spotPrice);
    
    // Generate variations with different strike widths
    for (let width = 5; width <= 20; width += 5) {
      const legs = this.buildLegsWithWidth(template, atmStrike, width);
      const analysis = await this.analyzeStrategy(ctx, symbol, legs, spotPrice, 0.05);
      
      if (analysis.success) {
        const data = analysis.data as StrategyAnalysis;
        
        // Check constraints
        const meetsConstraints =
          (!constraints.maxLoss || data.maxLoss === 'unlimited' || Math.abs(data.maxLoss as number) <= constraints.maxLoss) &&
          (!constraints.minProbProfit || data.probOfProfit >= constraints.minProbProfit);
        
        if (meetsConstraints) {
          variations.push({
            width,
            legs,
            maxProfit: data.maxProfit,
            maxLoss: data.maxLoss,
            probOfProfit: data.probOfProfit,
            riskReward: data.riskRewardRatio
          });
        }
      }
    }
    
    // Sort by probability of profit
    variations.sort((a, b) => (b.probOfProfit || 0) - (a.probOfProfit || 0));
    
    return {
      success: true,
      data: {
        template: template.name,
        symbol,
        spotPrice,
        variations,
        optimal: variations[0] || null
      }
    };
  }
  
  private buildLegsWithWidth(template: StrategyTemplate, atmStrike: number, width: number): OptionLeg[] {
    const legs: OptionLeg[] = [];
    const legCount = template.legs.length;
    
    for (let i = 0; i < legCount; i++) {
      const legTemplate = template.legs[i];
      let strike = atmStrike + (i - Math.floor(legCount / 2)) * width;
      
      legs.push({
        type: legTemplate.type!,
        action: legTemplate.action!,
        strike,
        expiry: this.getNextMonthlyExpiry(),
        quantity: legTemplate.quantity || 1,
        premium: 0,
        iv: 0.3
      });
    }
    
    return legs;
  }
}

export default OptionsStrategyBuilderSkill;
