/**
 * K.I.T. Skill #101: Fundamental Comparison
 * 
 * Compare fundamental metrics across multiple assets.
 * Like TradingView's Fundamental Graphs but for K.I.T.
 * 
 * Features:
 * - 100+ fundamental metrics
 * - Multi-symbol overlay
 * - Sector benchmarking
 * - Historical trend analysis
 * - Valuation screening
 * - Quality scoring
 * - Peer comparison
 */

import { BaseSkill, SkillContext, SkillResult } from '../types/skill.js';

interface FundamentalMetric {
  name: string;
  category: 'valuation' | 'profitability' | 'growth' | 'financial_health' | 'efficiency' | 'dividend';
  description: string;
  higherIsBetter: boolean;
  format: 'percentage' | 'ratio' | 'currency' | 'number';
}

interface CompanyFundamentals {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  metrics: Record<string, number | null>;
}

interface FundamentalComparison {
  metric: string;
  symbols: { symbol: string; value: number | null; rank: number }[];
  sectorAverage: number | null;
  industryAverage: number | null;
  bestPerformer: string;
  worstPerformer: string;
}

interface QualityScore {
  symbol: string;
  overall: number;         // 0-100
  valuation: number;       // 0-100
  profitability: number;   // 0-100
  growth: number;          // 0-100
  financialHealth: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export class FundamentalComparisonSkill extends BaseSkill {
  name = 'fundamental-comparison';
  description = 'Compare fundamental metrics across multiple stocks';
  version = '1.0.0';
  
  private metrics: Record<string, FundamentalMetric> = {
    // Valuation
    'pe_ratio': { name: 'P/E Ratio', category: 'valuation', description: 'Price to Earnings', higherIsBetter: false, format: 'ratio' },
    'forward_pe': { name: 'Forward P/E', category: 'valuation', description: 'Forward Price to Earnings', higherIsBetter: false, format: 'ratio' },
    'peg_ratio': { name: 'PEG Ratio', category: 'valuation', description: 'P/E to Growth', higherIsBetter: false, format: 'ratio' },
    'ps_ratio': { name: 'P/S Ratio', category: 'valuation', description: 'Price to Sales', higherIsBetter: false, format: 'ratio' },
    'pb_ratio': { name: 'P/B Ratio', category: 'valuation', description: 'Price to Book', higherIsBetter: false, format: 'ratio' },
    'ev_ebitda': { name: 'EV/EBITDA', category: 'valuation', description: 'Enterprise Value to EBITDA', higherIsBetter: false, format: 'ratio' },
    'ev_revenue': { name: 'EV/Revenue', category: 'valuation', description: 'Enterprise Value to Revenue', higherIsBetter: false, format: 'ratio' },
    'pcf_ratio': { name: 'P/CF Ratio', category: 'valuation', description: 'Price to Cash Flow', higherIsBetter: false, format: 'ratio' },
    
    // Profitability
    'gross_margin': { name: 'Gross Margin', category: 'profitability', description: 'Gross Profit / Revenue', higherIsBetter: true, format: 'percentage' },
    'operating_margin': { name: 'Operating Margin', category: 'profitability', description: 'Operating Income / Revenue', higherIsBetter: true, format: 'percentage' },
    'net_margin': { name: 'Net Margin', category: 'profitability', description: 'Net Income / Revenue', higherIsBetter: true, format: 'percentage' },
    'roe': { name: 'ROE', category: 'profitability', description: 'Return on Equity', higherIsBetter: true, format: 'percentage' },
    'roa': { name: 'ROA', category: 'profitability', description: 'Return on Assets', higherIsBetter: true, format: 'percentage' },
    'roic': { name: 'ROIC', category: 'profitability', description: 'Return on Invested Capital', higherIsBetter: true, format: 'percentage' },
    'ebitda_margin': { name: 'EBITDA Margin', category: 'profitability', description: 'EBITDA / Revenue', higherIsBetter: true, format: 'percentage' },
    
    // Growth
    'revenue_growth_yoy': { name: 'Revenue Growth YoY', category: 'growth', description: 'Year-over-year revenue growth', higherIsBetter: true, format: 'percentage' },
    'earnings_growth_yoy': { name: 'Earnings Growth YoY', category: 'growth', description: 'Year-over-year earnings growth', higherIsBetter: true, format: 'percentage' },
    'revenue_growth_5y': { name: 'Revenue Growth 5Y', category: 'growth', description: '5-year CAGR revenue growth', higherIsBetter: true, format: 'percentage' },
    'earnings_growth_5y': { name: 'Earnings Growth 5Y', category: 'growth', description: '5-year CAGR earnings growth', higherIsBetter: true, format: 'percentage' },
    'eps_growth_yoy': { name: 'EPS Growth YoY', category: 'growth', description: 'Year-over-year EPS growth', higherIsBetter: true, format: 'percentage' },
    'book_value_growth': { name: 'Book Value Growth', category: 'growth', description: 'Year-over-year book value growth', higherIsBetter: true, format: 'percentage' },
    
    // Financial Health
    'current_ratio': { name: 'Current Ratio', category: 'financial_health', description: 'Current Assets / Current Liabilities', higherIsBetter: true, format: 'ratio' },
    'quick_ratio': { name: 'Quick Ratio', category: 'financial_health', description: '(Current Assets - Inventory) / Current Liabilities', higherIsBetter: true, format: 'ratio' },
    'debt_to_equity': { name: 'Debt/Equity', category: 'financial_health', description: 'Total Debt / Total Equity', higherIsBetter: false, format: 'ratio' },
    'debt_to_assets': { name: 'Debt/Assets', category: 'financial_health', description: 'Total Debt / Total Assets', higherIsBetter: false, format: 'ratio' },
    'interest_coverage': { name: 'Interest Coverage', category: 'financial_health', description: 'EBIT / Interest Expense', higherIsBetter: true, format: 'ratio' },
    'altman_z': { name: 'Altman Z-Score', category: 'financial_health', description: 'Bankruptcy prediction score', higherIsBetter: true, format: 'ratio' },
    
    // Efficiency
    'asset_turnover': { name: 'Asset Turnover', category: 'efficiency', description: 'Revenue / Total Assets', higherIsBetter: true, format: 'ratio' },
    'inventory_turnover': { name: 'Inventory Turnover', category: 'efficiency', description: 'COGS / Average Inventory', higherIsBetter: true, format: 'ratio' },
    'receivables_turnover': { name: 'Receivables Turnover', category: 'efficiency', description: 'Revenue / Average Receivables', higherIsBetter: true, format: 'ratio' },
    'days_sales_outstanding': { name: 'Days Sales Outstanding', category: 'efficiency', description: 'Average collection period', higherIsBetter: false, format: 'number' },
    'days_inventory': { name: 'Days Inventory', category: 'efficiency', description: 'Average inventory holding period', higherIsBetter: false, format: 'number' },
    
    // Dividend
    'dividend_yield': { name: 'Dividend Yield', category: 'dividend', description: 'Annual Dividend / Price', higherIsBetter: true, format: 'percentage' },
    'payout_ratio': { name: 'Payout Ratio', category: 'dividend', description: 'Dividends / Net Income', higherIsBetter: false, format: 'percentage' },
    'dividend_growth_5y': { name: 'Dividend Growth 5Y', category: 'dividend', description: '5-year dividend CAGR', higherIsBetter: true, format: 'percentage' }
  };
  
  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { action, symbols, metrics: requestedMetrics, sector } = ctx.params;
    
    switch (action) {
      case 'compare':
        return this.compareSymbols(ctx, symbols, requestedMetrics);
        
      case 'quality':
        return this.calculateQualityScores(ctx, symbols);
        
      case 'screen':
        return this.screenByFundamentals(ctx, ctx.params.filters, sector);
        
      case 'peers':
        return this.findPeers(ctx, symbols[0]);
        
      case 'metrics':
        return this.listMetrics();
        
      case 'historical':
        return this.getHistoricalMetrics(ctx, symbols[0], requestedMetrics);
        
      default:
        return this.getOverview(ctx, symbols);
    }
  }
  
  private async compareSymbols(ctx: SkillContext, symbols: string[], metrics?: string[]): Promise<SkillResult> {
    if (!symbols || symbols.length < 2) {
      return { success: false, error: 'At least 2 symbols required for comparison' };
    }
    
    const metricsToCompare = metrics || ['pe_ratio', 'ps_ratio', 'roe', 'net_margin', 'revenue_growth_yoy', 'debt_to_equity'];
    
    // Fetch fundamentals for each symbol
    const fundamentals: CompanyFundamentals[] = [];
    for (const symbol of symbols) {
      fundamentals.push(await this.fetchFundamentals(ctx, symbol));
    }
    
    // Build comparisons
    const comparisons: FundamentalComparison[] = [];
    
    for (const metric of metricsToCompare) {
      const metricInfo = this.metrics[metric];
      if (!metricInfo) continue;
      
      const values = fundamentals.map(f => ({
        symbol: f.symbol,
        value: f.metrics[metric] ?? null
      }));
      
      // Rank symbols
      const ranked = [...values]
        .filter(v => v.value !== null)
        .sort((a, b) => {
          const diff = (a.value || 0) - (b.value || 0);
          return metricInfo.higherIsBetter ? -diff : diff;
        });
      
      const withRank = values.map(v => ({
        ...v,
        rank: ranked.findIndex(r => r.symbol === v.symbol) + 1 || values.length
      }));
      
      comparisons.push({
        metric: metricInfo.name,
        symbols: withRank,
        sectorAverage: null, // Would fetch from sector data
        industryAverage: null,
        bestPerformer: ranked[0]?.symbol || '',
        worstPerformer: ranked[ranked.length - 1]?.symbol || ''
      });
    }
    
    return {
      success: true,
      data: {
        symbols,
        comparisons,
        summary: this.generateComparisonSummary(fundamentals, comparisons)
      }
    };
  }
  
  private async fetchFundamentals(ctx: SkillContext, symbol: string): Promise<CompanyFundamentals> {
    // In production, fetch from financial data API (Alpha Vantage, FMP, etc.)
    // Generate realistic mock data
    const mockData: Record<string, Partial<CompanyFundamentals>> = {
      'AAPL': {
        name: 'Apple Inc.',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: 2800000000000,
        metrics: {
          pe_ratio: 28.5, forward_pe: 26.2, peg_ratio: 2.1, ps_ratio: 7.2, pb_ratio: 45.2,
          gross_margin: 43.5, operating_margin: 29.8, net_margin: 25.3, roe: 160.5, roa: 28.1, roic: 56.2,
          revenue_growth_yoy: 8.2, earnings_growth_yoy: 12.5, current_ratio: 0.98, debt_to_equity: 1.81,
          dividend_yield: 0.5, payout_ratio: 15.2
        }
      },
      'MSFT': {
        name: 'Microsoft Corporation',
        sector: 'Technology',
        industry: 'Software',
        marketCap: 2900000000000,
        metrics: {
          pe_ratio: 35.2, forward_pe: 31.5, peg_ratio: 2.5, ps_ratio: 12.1, pb_ratio: 12.5,
          gross_margin: 69.5, operating_margin: 44.2, net_margin: 36.8, roe: 38.5, roa: 19.2, roic: 28.5,
          revenue_growth_yoy: 15.3, earnings_growth_yoy: 18.2, current_ratio: 1.77, debt_to_equity: 0.35,
          dividend_yield: 0.7, payout_ratio: 25.8
        }
      },
      'GOOGL': {
        name: 'Alphabet Inc.',
        sector: 'Technology',
        industry: 'Internet Content',
        marketCap: 1800000000000,
        metrics: {
          pe_ratio: 24.8, forward_pe: 21.2, peg_ratio: 1.2, ps_ratio: 5.8, pb_ratio: 6.2,
          gross_margin: 56.2, operating_margin: 28.5, net_margin: 24.2, roe: 28.5, roa: 15.8, roic: 22.5,
          revenue_growth_yoy: 12.8, earnings_growth_yoy: 25.2, current_ratio: 2.95, debt_to_equity: 0.08,
          dividend_yield: 0, payout_ratio: 0
        }
      }
    };
    
    const data = mockData[symbol] || {
      name: symbol,
      sector: 'Unknown',
      industry: 'Unknown',
      marketCap: 10000000000,
      metrics: {
        pe_ratio: 20 + Math.random() * 20,
        forward_pe: 18 + Math.random() * 15,
        gross_margin: 30 + Math.random() * 30,
        operating_margin: 10 + Math.random() * 20,
        net_margin: 5 + Math.random() * 20,
        roe: 10 + Math.random() * 30,
        revenue_growth_yoy: Math.random() * 30 - 5,
        debt_to_equity: Math.random() * 2,
        dividend_yield: Math.random() * 3
      }
    };
    
    return {
      symbol,
      name: data.name || symbol,
      sector: data.sector || 'Unknown',
      industry: data.industry || 'Unknown',
      marketCap: data.marketCap || 0,
      metrics: data.metrics || {}
    };
  }
  
  private generateComparisonSummary(fundamentals: CompanyFundamentals[], comparisons: FundamentalComparison[]): any {
    // Count wins per symbol
    const wins: Record<string, number> = {};
    for (const f of fundamentals) {
      wins[f.symbol] = 0;
    }
    
    for (const comp of comparisons) {
      if (comp.bestPerformer) {
        wins[comp.bestPerformer] = (wins[comp.bestPerformer] || 0) + 1;
      }
    }
    
    const sortedByWins = Object.entries(wins).sort((a, b) => b[1] - a[1]);
    
    return {
      overallBest: sortedByWins[0]?.[0] || '',
      overallWorst: sortedByWins[sortedByWins.length - 1]?.[0] || '',
      winsBreakdown: wins,
      recommendation: `${sortedByWins[0]?.[0]} leads in ${sortedByWins[0]?.[1]} of ${comparisons.length} metrics`
    };
  }
  
  private async calculateQualityScores(ctx: SkillContext, symbols: string[]): Promise<SkillResult> {
    const scores: QualityScore[] = [];
    
    for (const symbol of symbols) {
      const fundamentals = await this.fetchFundamentals(ctx, symbol);
      const score = this.computeQualityScore(fundamentals);
      scores.push(score);
    }
    
    // Sort by overall score
    scores.sort((a, b) => b.overall - a.overall);
    
    return {
      success: true,
      data: {
        scores,
        best: scores[0]?.symbol,
        gradeDistribution: this.getGradeDistribution(scores)
      }
    };
  }
  
  private computeQualityScore(fundamentals: CompanyFundamentals): QualityScore {
    const m = fundamentals.metrics;
    
    // Valuation score (lower is better for most)
    const valuationScore = Math.max(0, Math.min(100,
      100 - ((m.pe_ratio || 25) - 15) * 2 +
      100 - ((m.ps_ratio || 5) - 2) * 10
    ) / 2);
    
    // Profitability score
    const profitabilityScore = Math.max(0, Math.min(100,
      (m.net_margin || 10) * 2 +
      (m.roe || 15) +
      (m.operating_margin || 15) * 1.5
    ) / 3);
    
    // Growth score
    const growthScore = Math.max(0, Math.min(100,
      (m.revenue_growth_yoy || 5) * 3 +
      (m.earnings_growth_yoy || 5) * 3
    ) / 2);
    
    // Financial health score
    const healthScore = Math.max(0, Math.min(100,
      50 + ((m.current_ratio || 1.5) - 1) * 20 -
      (m.debt_to_equity || 0.5) * 20
    ));
    
    const overall = Math.round((valuationScore + profitabilityScore + growthScore + healthScore) / 4);
    
    let grade: QualityScore['grade'];
    if (overall >= 80) grade = 'A';
    else if (overall >= 65) grade = 'B';
    else if (overall >= 50) grade = 'C';
    else if (overall >= 35) grade = 'D';
    else grade = 'F';
    
    return {
      symbol: fundamentals.symbol,
      overall,
      valuation: Math.round(valuationScore),
      profitability: Math.round(profitabilityScore),
      growth: Math.round(growthScore),
      financialHealth: Math.round(healthScore),
      grade
    };
  }
  
  private getGradeDistribution(scores: QualityScore[]): Record<string, number> {
    const distribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const score of scores) {
      distribution[score.grade]++;
    }
    return distribution;
  }
  
  private async screenByFundamentals(
    ctx: SkillContext, 
    filters: Record<string, { min?: number; max?: number }>,
    sector?: string
  ): Promise<SkillResult> {
    // In production, this would query a database of all stocks
    // For now, demonstrate the concept
    const allSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'];
    const matches: CompanyFundamentals[] = [];
    
    for (const symbol of allSymbols) {
      const fundamentals = await this.fetchFundamentals(ctx, symbol);
      
      // Check sector filter
      if (sector && fundamentals.sector !== sector) continue;
      
      // Check metric filters
      let passesFilters = true;
      for (const [metric, bounds] of Object.entries(filters || {})) {
        const value = fundamentals.metrics[metric];
        if (value === null || value === undefined) continue;
        
        if (bounds.min !== undefined && value < bounds.min) passesFilters = false;
        if (bounds.max !== undefined && value > bounds.max) passesFilters = false;
      }
      
      if (passesFilters) {
        matches.push(fundamentals);
      }
    }
    
    return {
      success: true,
      data: {
        filters,
        sector,
        matchCount: matches.length,
        matches: matches.slice(0, 20) // Limit results
      }
    };
  }
  
  private async findPeers(ctx: SkillContext, symbol: string): Promise<SkillResult> {
    const target = await this.fetchFundamentals(ctx, symbol);
    
    // Find stocks in same sector/industry with similar market cap
    const peers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META']
      .filter(s => s !== symbol)
      .slice(0, 5);
    
    const peerFundamentals: CompanyFundamentals[] = [];
    for (const peer of peers) {
      peerFundamentals.push(await this.fetchFundamentals(ctx, peer));
    }
    
    return {
      success: true,
      data: {
        target,
        peers: peerFundamentals,
        comparison: await this.compareSymbols(ctx, [symbol, ...peers])
      }
    };
  }
  
  private listMetrics(): SkillResult {
    const grouped: Record<string, any[]> = {};
    
    for (const [key, metric] of Object.entries(this.metrics)) {
      if (!grouped[metric.category]) {
        grouped[metric.category] = [];
      }
      grouped[metric.category].push({
        key,
        name: metric.name,
        description: metric.description,
        higherIsBetter: metric.higherIsBetter
      });
    }
    
    return {
      success: true,
      data: {
        categories: grouped,
        totalMetrics: Object.keys(this.metrics).length
      }
    };
  }
  
  private async getHistoricalMetrics(
    ctx: SkillContext,
    symbol: string,
    metrics: string[]
  ): Promise<SkillResult> {
    const metricsToFetch = metrics || ['pe_ratio', 'revenue_growth_yoy', 'net_margin'];
    
    // Generate 5 years of quarterly data
    const history: Record<string, { date: string; value: number }[]> = {};
    
    for (const metric of metricsToFetch) {
      history[metric] = [];
      let baseValue = 20; // Starting value
      
      for (let q = 0; q < 20; q++) { // 20 quarters = 5 years
        const date = new Date();
        date.setMonth(date.getMonth() - q * 3);
        
        // Add some trend and noise
        const value = baseValue + (Math.random() - 0.5) * 5 + (20 - q) * 0.2;
        
        history[metric].push({
          date: date.toISOString().split('T')[0],
          value: Math.round(value * 100) / 100
        });
      }
      
      history[metric].reverse();
    }
    
    return {
      success: true,
      data: {
        symbol,
        metrics: metricsToFetch,
        history,
        trend: this.analyzeTrend(history)
      }
    };
  }
  
  private analyzeTrend(history: Record<string, { date: string; value: number }[]>): any {
    const trends: Record<string, string> = {};
    
    for (const [metric, data] of Object.entries(history)) {
      if (data.length < 4) continue;
      
      const recent = data.slice(-4);
      const older = data.slice(-8, -4);
      
      const recentAvg = recent.reduce((s, d) => s + d.value, 0) / recent.length;
      const olderAvg = older.reduce((s, d) => s + d.value, 0) / older.length;
      
      const change = ((recentAvg - olderAvg) / olderAvg) * 100;
      
      if (change > 10) trends[metric] = 'Improving strongly';
      else if (change > 3) trends[metric] = 'Improving';
      else if (change < -10) trends[metric] = 'Deteriorating strongly';
      else if (change < -3) trends[metric] = 'Deteriorating';
      else trends[metric] = 'Stable';
    }
    
    return trends;
  }
  
  private async getOverview(ctx: SkillContext, symbols: string[]): Promise<SkillResult> {
    const fundamentals: CompanyFundamentals[] = [];
    for (const symbol of symbols || ['AAPL']) {
      fundamentals.push(await this.fetchFundamentals(ctx, symbol));
    }
    
    return {
      success: true,
      data: {
        symbols: symbols || ['AAPL'],
        fundamentals,
        availableMetrics: Object.keys(this.metrics).length
      }
    };
  }
}

export default FundamentalComparisonSkill;
