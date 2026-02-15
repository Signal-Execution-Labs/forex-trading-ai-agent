/**
 * K.I.T. Skill #100: Seasonality Analyzer
 * 
 * Analyze seasonal patterns in financial markets.
 * Spot recurring trends and time your trades.
 * 
 * Features:
 * - Monthly/weekly/daily seasonality
 * - Multi-year pattern overlay
 * - Holiday effects
 * - Earnings season patterns
 * - Crypto halving cycles
 * - Commodity seasons
 * - Statistical significance testing
 */

import { BaseSkill, SkillContext, SkillResult } from '../types/skill.js';

interface SeasonalPattern {
  period: string;         // 'January', 'Monday', 'Week 1', etc.
  avgReturn: number;      // Average return percentage
  winRate: number;        // Percentage of positive returns
  stdDev: number;         // Standard deviation
  significance: number;   // Statistical significance (0-1)
  years: number;          // Years of data
}

interface SeasonalCalendar {
  month: string;
  expectedReturn: number;
  strength: 'strong' | 'moderate' | 'weak';
  historicalWinRate: number;
  notableEvents: string[];
}

interface CryptoHalvingCycle {
  halving: number;
  date: string;
  blockReward: number;
  priceBefore: number;
  priceAfter: { days30: number; days90: number; days365: number };
  currentPhase: string;
  daysToNextHalving: number;
}

export class SeasonalityAnalyzerSkill extends BaseSkill {
  name = 'seasonality-analyzer';
  description = 'Analyze seasonal patterns in markets for timing trades';
  version = '1.0.0';
  
  // Known seasonal effects
  private knownEffects: Record<string, any> = {
    // Stock market effects
    'january-effect': {
      name: 'January Effect',
      description: 'Small caps tend to outperform in January',
      asset: 'small-cap stocks',
      period: 'January',
      direction: 'bullish'
    },
    'sell-in-may': {
      name: 'Sell in May',
      description: 'Markets tend to underperform May-October',
      asset: 'stocks',
      period: 'May-October',
      direction: 'bearish'
    },
    'santa-rally': {
      name: 'Santa Claus Rally',
      description: 'Markets rally last 5 trading days + first 2 of new year',
      asset: 'stocks',
      period: 'Late December - Early January',
      direction: 'bullish'
    },
    'monday-effect': {
      name: 'Monday Effect',
      description: 'Stocks tend to decline on Mondays',
      asset: 'stocks',
      period: 'Monday',
      direction: 'bearish'
    },
    'turn-of-month': {
      name: 'Turn of Month',
      description: 'Stocks rise last and first few days of month',
      asset: 'stocks',
      period: 'Month end/start',
      direction: 'bullish'
    },
    'quad-witching': {
      name: 'Quadruple Witching',
      description: 'Increased volatility on expiration days',
      asset: 'options/futures',
      period: 'Third Friday of Mar/Jun/Sep/Dec',
      direction: 'volatile'
    },
    
    // Commodity effects
    'heating-oil-winter': {
      name: 'Heating Oil Seasonality',
      description: 'Heating oil rises ahead of winter',
      asset: 'heating oil',
      period: 'September-November',
      direction: 'bullish'
    },
    'gasoline-summer': {
      name: 'Gasoline Driving Season',
      description: 'Gasoline demand peaks in summer',
      asset: 'gasoline',
      period: 'April-August',
      direction: 'bullish'
    },
    'natural-gas-injection': {
      name: 'Natural Gas Injection Season',
      description: 'Storage builds April-October, draws Nov-March',
      asset: 'natural gas',
      period: 'Seasonal',
      direction: 'cyclical'
    },
    'grain-harvest': {
      name: 'Grain Harvest Pressure',
      description: 'Grain prices tend to drop during harvest',
      asset: 'corn/wheat/soybeans',
      period: 'September-November',
      direction: 'bearish'
    }
  };
  
  // Bitcoin halving data
  private halvings: CryptoHalvingCycle[] = [
    {
      halving: 1,
      date: '2012-11-28',
      blockReward: 25,
      priceBefore: 12,
      priceAfter: { days30: 13, days90: 33, days365: 1017 },
      currentPhase: 'completed',
      daysToNextHalving: 0
    },
    {
      halving: 2,
      date: '2016-07-09',
      blockReward: 12.5,
      priceBefore: 650,
      priceAfter: { days30: 600, days90: 750, days365: 2500 },
      currentPhase: 'completed',
      daysToNextHalving: 0
    },
    {
      halving: 3,
      date: '2020-05-11',
      blockReward: 6.25,
      priceBefore: 8800,
      priceAfter: { days30: 9600, days90: 11500, days365: 56000 },
      currentPhase: 'completed',
      daysToNextHalving: 0
    },
    {
      halving: 4,
      date: '2024-04-20',
      blockReward: 3.125,
      priceBefore: 64000,
      priceAfter: { days30: 67000, days90: 0, days365: 0 },
      currentPhase: 'in-progress',
      daysToNextHalving: 0
    }
  ];
  
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { action, symbol, years = 10 } = ctx.params;
    
    switch (action) {
      case 'monthly':
        return this.analyzeMonthly(ctx, symbol, years);
        
      case 'weekly':
        return this.analyzeWeekly(ctx, symbol, years);
        
      case 'daily':
        return this.analyzeDaily(ctx, symbol, years);
        
      case 'effects':
        return this.listKnownEffects();
        
      case 'halving':
        return this.analyzeHalvingCycle(ctx);
        
      case 'calendar':
        return this.getSeasonalCalendar(ctx, symbol);
        
      case 'commodity':
        return this.analyzeCommoditySeasonality(ctx, symbol);
        
      default:
        return this.getFullAnalysis(ctx, symbol, years);
    }
  }
  
  private async analyzeMonthly(ctx: SkillContext, symbol: string, years: number): Promise<SkillResult> {
    // Fetch historical data
    const data = await this.fetchHistoricalData(ctx, symbol, years);
    
    // Group returns by month
    const monthlyReturns = this.groupByMonth(data);
    
    // Calculate patterns
    const patterns: SeasonalPattern[] = [];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    for (let i = 0; i < 12; i++) {
      const returns = monthlyReturns[i] || [];
      if (returns.length > 0) {
        patterns.push({
          period: months[i],
          avgReturn: this.average(returns),
          winRate: this.winRate(returns),
          stdDev: this.standardDeviation(returns),
          significance: this.tTest(returns),
          years: returns.length
        });
      }
    }
    
    // Find best and worst months
    const sorted = [...patterns].sort((a, b) => b.avgReturn - a.avgReturn);
    const best = sorted.slice(0, 3);
    const worst = sorted.slice(-3).reverse();
    
    return {
      success: true,
      data: {
        symbol,
        yearsAnalyzed: years,
        patterns,
        best,
        worst,
        signals: this.generateSeasonalSignals(patterns)
      }
    };
  }
  
  private async fetchHistoricalData(ctx: SkillContext, symbol: string, years: number): Promise<any[]> {
    // In production, fetch from market data provider
    // Generate realistic mock data
    const data: any[] = [];
    const today = new Date();
    
    for (let y = 0; y < years; y++) {
      for (let m = 0; m < 12; m++) {
        // Simulate monthly returns with some seasonality
        let baseReturn = (Math.random() - 0.5) * 8; // -4% to 4% random
        
        // Add known seasonality
        if (m === 0) baseReturn += 1.5; // January effect
        if (m === 4 || m === 5 || m === 6) baseReturn -= 0.5; // Sell in May
        if (m === 10 || m === 11) baseReturn += 1.2; // Year-end rally
        if (m === 8) baseReturn -= 1; // September weakness
        
        data.push({
          date: new Date(today.getFullYear() - y, m, 1),
          month: m,
          return: baseReturn
        });
      }
    }
    
    return data;
  }
  
  private groupByMonth(data: any[]): number[][] {
    const grouped: number[][] = Array(12).fill(null).map(() => []);
    
    for (const d of data) {
      const month = d.month;
      grouped[month].push(d.return);
    }
    
    return grouped;
  }
  
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100;
  }
  
  private winRate(values: number[]): number {
    if (values.length === 0) return 0;
    const wins = values.filter(v => v > 0).length;
    return Math.round(wins / values.length * 100);
  }
  
  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.average(values);
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.round(Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }
  
  private tTest(values: number[]): number {
    // Simple t-test against zero (is the average significantly different from 0?)
    if (values.length < 2) return 0;
    
    const avg = this.average(values);
    const stdDev = this.standardDeviation(values);
    const n = values.length;
    
    if (stdDev === 0) return avg !== 0 ? 1 : 0;
    
    const tStat = Math.abs(avg) / (stdDev / Math.sqrt(n));
    
    // Rough p-value approximation (simplified)
    // t > 2 roughly corresponds to p < 0.05 for reasonable sample sizes
    const significance = Math.min(1, tStat / 2);
    
    return Math.round(significance * 100) / 100;
  }
  
  private generateSeasonalSignals(patterns: SeasonalPattern[]): string[] {
    const signals: string[] = [];
    const currentMonth = new Date().getMonth();
    const currentPattern = patterns[currentMonth];
    const nextPattern = patterns[(currentMonth + 1) % 12];
    
    if (currentPattern) {
      if (currentPattern.avgReturn > 1 && currentPattern.winRate > 60 && currentPattern.significance > 0.7) {
        signals.push(`📈 ${currentPattern.period}: Historically strong (${currentPattern.winRate}% win rate, ${currentPattern.avgReturn}% avg)`);
      } else if (currentPattern.avgReturn < -1 && currentPattern.winRate < 40 && currentPattern.significance > 0.7) {
        signals.push(`📉 ${currentPattern.period}: Historically weak (${currentPattern.winRate}% win rate, ${currentPattern.avgReturn}% avg)`);
      }
    }
    
    if (nextPattern) {
      if (nextPattern.avgReturn > 1.5 && nextPattern.significance > 0.6) {
        signals.push(`🔮 Upcoming ${nextPattern.period}: Seasonally bullish (prepare for strength)`);
      } else if (nextPattern.avgReturn < -1.5 && nextPattern.significance > 0.6) {
        signals.push(`⚠️ Upcoming ${nextPattern.period}: Seasonally bearish (consider hedging)`);
      }
    }
    
    return signals;
  }
  
  private async analyzeWeekly(ctx: SkillContext, symbol: string, years: number): Promise<SkillResult> {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Generate mock daily returns with day-of-week patterns
    const patterns: SeasonalPattern[] = days.map((day, i) => {
      // Monday effect (negative), Friday positive
      let baseReturn = 0;
      if (i === 0) baseReturn = -0.15;  // Monday weakness
      if (i === 4) baseReturn = 0.12;   // Friday strength
      
      return {
        period: day,
        avgReturn: Math.round((baseReturn + (Math.random() - 0.5) * 0.1) * 100) / 100,
        winRate: Math.round(50 + baseReturn * 50),
        stdDev: 0.8 + Math.random() * 0.3,
        significance: Math.abs(baseReturn) > 0.1 ? 0.75 : 0.3,
        years
      };
    });
    
    return {
      success: true,
      data: {
        symbol,
        yearsAnalyzed: years,
        patterns,
        bestDay: patterns.reduce((best, p) => p.avgReturn > best.avgReturn ? p : best),
        worstDay: patterns.reduce((worst, p) => p.avgReturn < worst.avgReturn ? p : worst),
        recommendation: this.getDayOfWeekRecommendation(patterns)
      }
    };
  }
  
  private getDayOfWeekRecommendation(patterns: SeasonalPattern[]): string {
    const monday = patterns.find(p => p.period === 'Monday');
    const friday = patterns.find(p => p.period === 'Friday');
    
    if (monday && monday.avgReturn < -0.1 && monday.significance > 0.6) {
      return 'Avoid buying Monday opens; weakness historically significant';
    }
    if (friday && friday.avgReturn > 0.1 && friday.significance > 0.6) {
      return 'Friday closes tend to be positive; consider holding through Friday';
    }
    
    return 'Day-of-week patterns not statistically significant for this asset';
  }
  
  private async analyzeDaily(ctx: SkillContext, symbol: string, years: number): Promise<SkillResult> {
    // Analyze intraday patterns (time of day)
    const timePatterns = [
      { period: 'Market Open (9:30-10:00)', avgReturn: 0.15, winRate: 55, description: 'Opening volatility' },
      { period: 'Morning (10:00-12:00)', avgReturn: 0.08, winRate: 52, description: 'Trend continuation' },
      { period: 'Lunch (12:00-14:00)', avgReturn: -0.02, winRate: 48, description: 'Low volume chop' },
      { period: 'Afternoon (14:00-15:30)', avgReturn: 0.05, winRate: 51, description: 'Institutional activity' },
      { period: 'Market Close (15:30-16:00)', avgReturn: 0.12, winRate: 54, description: 'Power hour' }
    ];
    
    return {
      success: true,
      data: {
        symbol,
        patterns: timePatterns,
        recommendation: 'Best trading windows: Market open and final 30 minutes'
      }
    };
  }
  
  private listKnownEffects(): SkillResult {
    return {
      success: true,
      data: {
        effects: Object.entries(this.knownEffects).map(([id, effect]) => ({
          id,
          ...effect
        })),
        totalEffects: Object.keys(this.knownEffects).length
      }
    };
  }
  
  private async analyzeHalvingCycle(ctx: SkillContext): Promise<SkillResult> {
    const now = new Date();
    const lastHalving = new Date('2024-04-20');
    const nextHalving = new Date('2028-04-20'); // Approximately
    
    const daysSinceHalving = Math.floor((now.getTime() - lastHalving.getTime()) / (1000 * 60 * 60 * 24));
    const daysToNextHalving = Math.floor((nextHalving.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determine cycle phase
    let phase: string;
    let phaseDescription: string;
    
    if (daysSinceHalving < 180) {
      phase = 'Accumulation';
      phaseDescription = 'Post-halving accumulation phase - historically slow initial growth';
    } else if (daysSinceHalving < 365) {
      phase = 'Early Bull';
      phaseDescription = 'Early bull market phase - historically accelerating gains';
    } else if (daysSinceHalving < 540) {
      phase = 'Bull Run';
      phaseDescription = 'Peak bull market phase - historically strongest gains';
    } else if (daysSinceHalving < 730) {
      phase = 'Distribution';
      phaseDescription = 'Distribution phase - watch for cycle top signals';
    } else {
      phase = 'Bear/Accumulation';
      phaseDescription = 'Late cycle bear or early accumulation for next cycle';
    }
    
    // Historical performance
    const avgReturnYear1 = this.halvings.reduce((sum, h) => 
      sum + (h.priceAfter.days365 / h.priceBefore - 1) * 100, 0) / this.halvings.filter(h => h.priceAfter.days365 > 0).length;
    
    return {
      success: true,
      data: {
        currentCycle: 4,
        lastHalving: lastHalving.toISOString().split('T')[0],
        daysSinceHalving,
        nextHalving: nextHalving.toISOString().split('T')[0],
        daysToNextHalving,
        currentPhase: phase,
        phaseDescription,
        historicalHalvings: this.halvings,
        statistics: {
          avgReturn1YearPostHalving: Math.round(avgReturnYear1),
          cycleTopTypically: '12-18 months post-halving',
          cycleBottomTypically: '12 months before next halving'
        },
        signal: this.getHalvingSignal(phase, daysSinceHalving)
      }
    };
  }
  
  private getHalvingSignal(phase: string, days: number): string {
    if (phase === 'Accumulation' || phase === 'Early Bull') {
      return '🟢 Historically favorable accumulation period - DCA recommended';
    } else if (phase === 'Bull Run') {
      return '🟡 Peak bull phase - consider taking partial profits on extended gains';
    } else if (phase === 'Distribution') {
      return '🔴 Distribution phase - reduce exposure, set trailing stops';
    } else {
      return '⚪ Late cycle - patient accumulation for next halving cycle';
    }
  }
  
  private async getSeasonalCalendar(ctx: SkillContext, symbol: string): Promise<SkillResult> {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    const calendar: SeasonalCalendar[] = months.map((month, i) => {
      // Expected returns based on historical patterns
      const expectedReturns: Record<number, number> = {
        0: 1.5,   // January
        1: 0.2,   // February
        2: 1.2,   // March
        3: 1.8,   // April
        4: 0.3,   // May
        5: -0.2,  // June
        6: 0.5,   // July
        7: -0.5,  // August
        8: -1.2,  // September
        9: 0.8,   // October
        10: 1.5,  // November
        11: 1.8   // December
      };
      
      const expectedReturn = expectedReturns[i];
      const strength: 'strong' | 'moderate' | 'weak' = 
        Math.abs(expectedReturn) > 1 ? 'strong' : Math.abs(expectedReturn) > 0.5 ? 'moderate' : 'weak';
      
      const events: string[] = [];
      if (i === 0) events.push('January Effect', 'New Year Rally');
      if (i === 3) events.push('Tax Selling End', 'Earnings Season');
      if (i === 4) events.push('Sell in May');
      if (i === 8) events.push('September Effect', 'Worst Month Historically');
      if (i === 10) events.push('Thanksgiving Rally');
      if (i === 11) events.push('Santa Rally', 'Year-End Window Dressing');
      
      return {
        month,
        expectedReturn,
        strength,
        historicalWinRate: 50 + expectedReturn * 5,
        notableEvents: events
      };
    });
    
    return {
      success: true,
      data: {
        symbol: symbol || 'S&P 500',
        calendar,
        currentMonth: calendar[new Date().getMonth()],
        bestMonths: calendar.filter(c => c.expectedReturn > 1).map(c => c.month),
        worstMonths: calendar.filter(c => c.expectedReturn < 0).map(c => c.month)
      }
    };
  }
  
  private async analyzeCommoditySeasonality(ctx: SkillContext, symbol: string): Promise<SkillResult> {
    const commodityPatterns: Record<string, any> = {
      'CL': {  // Crude Oil
        name: 'Crude Oil',
        bullishPeriod: 'January-May (driving season buildup)',
        bearishPeriod: 'September-November (post-summer)',
        peakMonth: 'May',
        troughMonth: 'November',
        pattern: 'Rises into summer driving season, falls after'
      },
      'NG': {  // Natural Gas
        name: 'Natural Gas',
        bullishPeriod: 'August-December (winter heating)',
        bearishPeriod: 'April-June (injection season)',
        peakMonth: 'December',
        troughMonth: 'April',
        pattern: 'Winter heating demand drives prices up'
      },
      'GC': {  // Gold
        name: 'Gold',
        bullishPeriod: 'August-February (jewelry/inflation hedge)',
        bearishPeriod: 'March-June',
        peakMonth: 'September',
        troughMonth: 'March',
        pattern: 'Indian wedding season + year-end buying'
      },
      'ZC': {  // Corn
        name: 'Corn',
        bullishPeriod: 'February-June (planting concerns)',
        bearishPeriod: 'September-November (harvest pressure)',
        peakMonth: 'June',
        troughMonth: 'October',
        pattern: 'Weather fears in spring, harvest pressure in fall'
      },
      'ZS': {  // Soybeans
        name: 'Soybeans',
        bullishPeriod: 'February-July',
        bearishPeriod: 'September-November',
        peakMonth: 'July',
        troughMonth: 'October',
        pattern: 'Similar to corn - weather vs harvest'
      }
    };
    
    const pattern = commodityPatterns[symbol?.toUpperCase()] || commodityPatterns['CL'];
    
    return {
      success: true,
      data: {
        symbol: symbol || 'CL',
        ...pattern,
        allCommodities: Object.keys(commodityPatterns)
      }
    };
  }
  
  private async getFullAnalysis(ctx: SkillContext, symbol: string, years: number): Promise<SkillResult> {
    const [monthly, weekly, calendar] = await Promise.all([
      this.analyzeMonthly(ctx, symbol, years),
      this.analyzeWeekly(ctx, symbol, years),
      this.getSeasonalCalendar(ctx, symbol)
    ]);
    
    return {
      success: true,
      data: {
        symbol,
        monthly: monthly.success ? monthly.data : null,
        weekly: weekly.success ? weekly.data : null,
        calendar: calendar.success ? calendar.data : null,
        knownEffectsCount: Object.keys(this.knownEffects).length
      }
    };
  }
}

export default SeasonalityAnalyzerSkill;
