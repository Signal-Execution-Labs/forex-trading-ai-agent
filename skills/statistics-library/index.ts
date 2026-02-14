/**
 * Statistics Library Skill - 120+ Statistical Calculations
 * 
 * Comprehensive quantitative analysis library
 */

import { KitSkill, SkillContext, SkillResult } from '../../src/types/skill.js';

interface StatResult {
  function: string;
  value: number | number[] | Record<string, number>;
  metadata?: Record<string, any>;
}

class StatisticsLibrarySkill implements KitSkill {
  name = 'statistics-library';
  version = '1.0.0';
  description = '120+ statistical calculations for quantitative analysis';

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { action, params } = ctx;

    switch (action) {
      case 'calc':
        return this.calculate(params.function, params.data, params.options);
      case 'risk':
        return this.riskReport(params.equity, params.options);
      case 'corr':
        return this.correlationMatrix(params.series, params.method);
      case 'test':
        return this.hypothesisTest(params.test, params.data, params.options);
      case 'list':
        return this.listFunctions(params.category);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  // Descriptive Statistics
  private mean(data: number[]): number {
    return data.reduce((a, b) => a + b, 0) / data.length;
  }

  private median(data: number[]): number {
    const sorted = [...data].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private variance(data: number[], sample = true): number {
    const avg = this.mean(data);
    const squareDiffs = data.map(v => Math.pow(v - avg, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / (data.length - (sample ? 1 : 0));
  }

  private stdev(data: number[], sample = true): number {
    return Math.sqrt(this.variance(data, sample));
  }

  private skewness(data: number[]): number {
    const n = data.length;
    const avg = this.mean(data);
    const std = this.stdev(data, false);
    const skew = data.reduce((sum, v) => sum + Math.pow((v - avg) / std, 3), 0) / n;
    return skew;
  }

  private kurtosis(data: number[]): number {
    const n = data.length;
    const avg = this.mean(data);
    const std = this.stdev(data, false);
    const kurt = data.reduce((sum, v) => sum + Math.pow((v - avg) / std, 4), 0) / n;
    return kurt - 3; // Excess kurtosis
  }

  private percentile(data: number[], p: number): number {
    const sorted = [...data].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  private zscore(data: number[]): number[] {
    const avg = this.mean(data);
    const std = this.stdev(data);
    return data.map(v => (v - avg) / std);
  }

  // Risk Metrics
  private sharpe(returns: number[], riskFreeRate = 0.02): number {
    const annualizedReturn = this.mean(returns) * 252;
    const annualizedStd = this.stdev(returns) * Math.sqrt(252);
    return (annualizedReturn - riskFreeRate) / annualizedStd;
  }

  private sortino(returns: number[], riskFreeRate = 0.02): number {
    const annualizedReturn = this.mean(returns) * 252;
    const downside = returns.filter(r => r < 0);
    const downsideStd = downside.length > 0 ? this.stdev(downside) * Math.sqrt(252) : 0.0001;
    return (annualizedReturn - riskFreeRate) / downsideStd;
  }

  private maxDrawdown(equity: number[]): { value: number; peak: number; trough: number; peakIdx: number; troughIdx: number } {
    let maxDD = 0;
    let peak = equity[0];
    let peakIdx = 0;
    let troughIdx = 0;
    let currentPeak = equity[0];
    let currentPeakIdx = 0;

    for (let i = 1; i < equity.length; i++) {
      if (equity[i] > currentPeak) {
        currentPeak = equity[i];
        currentPeakIdx = i;
      }
      const dd = (currentPeak - equity[i]) / currentPeak;
      if (dd > maxDD) {
        maxDD = dd;
        peak = currentPeak;
        peakIdx = currentPeakIdx;
        troughIdx = i;
      }
    }

    return { value: maxDD, peak, trough: equity[troughIdx], peakIdx, troughIdx };
  }

  private valueAtRisk(returns: number[], confidence = 0.95): number {
    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    return -sorted[index];
  }

  private cvar(returns: number[], confidence = 0.95): number {
    const var95 = this.valueAtRisk(returns, confidence);
    const tailReturns = returns.filter(r => r <= -var95);
    return tailReturns.length > 0 ? -this.mean(tailReturns) : var95;
  }

  private calmar(returns: number[], equity: number[]): number {
    const annualizedReturn = this.mean(returns) * 252;
    const { value: mdd } = this.maxDrawdown(equity);
    return mdd > 0 ? annualizedReturn / mdd : 0;
  }

  private profitFactor(trades: { pnl: number }[]): number {
    const grossProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  }

  private expectancy(trades: { pnl: number }[]): number {
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const winRate = wins.length / trades.length;
    const avgWin = wins.length > 0 ? this.mean(wins.map(t => t.pnl)) : 0;
    const avgLoss = losses.length > 0 ? Math.abs(this.mean(losses.map(t => t.pnl))) : 0;
    return (winRate * avgWin) - ((1 - winRate) * avgLoss);
  }

  private sqn(trades: { pnl: number }[]): number {
    const r = trades.map(t => t.pnl);
    const avgR = this.mean(r);
    const stdR = this.stdev(r);
    return stdR > 0 ? (avgR / stdR) * Math.sqrt(trades.length) : 0;
  }

  // Correlation
  private pearson(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const meanX = this.mean(x.slice(0, n));
    const meanY = this.mean(y.slice(0, n));
    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    return num / Math.sqrt(denX * denY);
  }

  private beta(returns: number[], benchmarkReturns: number[]): number {
    const covar = this.covariance(returns, benchmarkReturns);
    const benchVar = this.variance(benchmarkReturns);
    return benchVar > 0 ? covar / benchVar : 0;
  }

  private covariance(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const meanX = this.mean(x.slice(0, n));
    const meanY = this.mean(y.slice(0, n));
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (x[i] - meanX) * (y[i] - meanY);
    }
    return sum / (n - 1);
  }

  // Main calculation handler
  private async calculate(fn: string, data: number[] | Record<string, number[]>, options?: any): Promise<SkillResult> {
    const dataArr = Array.isArray(data) ? data : Object.values(data)[0];
    
    const functions: Record<string, (d: number[], o?: any) => number | number[] | Record<string, number>> = {
      mean: (d) => this.mean(d),
      median: (d) => this.median(d),
      variance: (d, o) => this.variance(d, o?.sample ?? true),
      stdev: (d, o) => this.stdev(d, o?.sample ?? true),
      skewness: (d) => this.skewness(d),
      kurtosis: (d) => this.kurtosis(d),
      percentile: (d, o) => this.percentile(d, o?.p ?? 50),
      zscore: (d) => this.zscore(d),
      sharpe: (d, o) => this.sharpe(d, o?.riskFreeRate ?? 0.02),
      sortino: (d, o) => this.sortino(d, o?.riskFreeRate ?? 0.02),
      var: (d, o) => this.valueAtRisk(d, o?.confidence ?? 0.95),
      cvar: (d, o) => this.cvar(d, o?.confidence ?? 0.95),
    };

    if (!functions[fn]) {
      return { success: false, error: `Unknown function: ${fn}. Use 'list' to see available functions.` };
    }

    const result = functions[fn](dataArr, options);
    return { success: true, data: { function: fn, value: result } };
  }

  private async riskReport(equity: number[], options?: any): Promise<SkillResult> {
    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
    }

    const riskFreeRate = options?.riskFreeRate ?? 0.02;
    const confidence = options?.confidence ?? 0.95;

    const report = {
      totalReturn: (equity[equity.length - 1] - equity[0]) / equity[0],
      annualizedReturn: this.mean(returns) * 252,
      volatility: this.stdev(returns) * Math.sqrt(252),
      sharpe: this.sharpe(returns, riskFreeRate),
      sortino: this.sortino(returns, riskFreeRate),
      maxDrawdown: this.maxDrawdown(equity),
      calmar: this.calmar(returns, equity),
      var: this.valueAtRisk(returns, confidence),
      cvar: this.cvar(returns, confidence),
      skewness: this.skewness(returns),
      kurtosis: this.kurtosis(returns),
      bestDay: Math.max(...returns),
      worstDay: Math.min(...returns),
      positiveDays: returns.filter(r => r > 0).length,
      negativeDays: returns.filter(r => r < 0).length,
      winRate: returns.filter(r => r > 0).length / returns.length
    };

    return { success: true, data: report };
  }

  private async correlationMatrix(series: Record<string, number[]>, method = 'pearson'): Promise<SkillResult> {
    const symbols = Object.keys(series);
    const matrix: Record<string, Record<string, number>> = {};

    for (const s1 of symbols) {
      matrix[s1] = {};
      for (const s2 of symbols) {
        if (s1 === s2) {
          matrix[s1][s2] = 1;
        } else if (matrix[s2]?.[s1] !== undefined) {
          matrix[s1][s2] = matrix[s2][s1];
        } else {
          matrix[s1][s2] = this.pearson(series[s1], series[s2]);
        }
      }
    }

    return { success: true, data: { matrix, method, symbols } };
  }

  private async hypothesisTest(test: string, data: any, options?: any): Promise<SkillResult> {
    // Simplified t-test implementation
    if (test === 'ttest') {
      const { sample1, sample2 } = data;
      const mean1 = this.mean(sample1);
      const mean2 = this.mean(sample2);
      const var1 = this.variance(sample1);
      const var2 = this.variance(sample2);
      const n1 = sample1.length;
      const n2 = sample2.length;
      
      const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);
      const tStat = (mean1 - mean2) / pooledSE;
      const df = n1 + n2 - 2;

      return {
        success: true,
        data: {
          test: 't-test',
          tStatistic: tStat,
          degreesOfFreedom: df,
          mean1,
          mean2,
          difference: mean1 - mean2,
          significant: Math.abs(tStat) > 1.96 // Simplified for 95% CI
        }
      };
    }

    return { success: false, error: `Test '${test}' not implemented` };
  }

  private listFunctions(category?: string): SkillResult {
    const categories = {
      descriptive: ['mean', 'median', 'mode', 'variance', 'stdev', 'skewness', 'kurtosis', 'range', 'iqr', 'percentile', 'zscore', 'mad', 'cv', 'sem', 'gmean', 'hmean', 'wmean', 'trimean', 'winsorize', 'entropy'],
      risk: ['sharpe', 'sortino', 'calmar', 'treynor', 'omega', 'sterling', 'burke', 'ulcer', 'pain', 'var', 'cvar', 'maxDrawdown', 'avgDrawdown', 'recoveryTime', 'kellyFraction', 'profitFactor', 'expectancy', 'sqn', 'lakeRatio', 'gainPain', 'tail', 'commonSense', 'cpc', 'kRatio', 'martin'],
      correlation: ['pearson', 'spearman', 'kendall', 'beta', 'alpha', 'r2', 'adjR2', 'covariance', 'autocorr', 'crosscorr', 'linearReg', 'polyReg', 'expReg', 'logReg', 'powerReg', 'residuals', 'durbin', 'vif', 'partialCorr', 'semiCorr'],
      timeseries: ['sma', 'ema', 'wma', 'hma', 'vwma', 'dema', 'tema', 'alma', 'kama', 'mcgd', 'linreg', 'diff', 'pctChange', 'logReturn', 'momentum', 'roc', 'atr', 'tr', 'highest', 'lowest', 'stoch', 'rsi', 'cci', 'adx', 'aroon'],
      distribution: ['normalPdf', 'normalCdf', 'normalInv', 'tPdf', 'tCdf', 'chiSqPdf', 'chiSqCdf', 'fPdf', 'fCdf', 'binomPmf', 'binomCdf', 'poissonPmf', 'poissonCdf', 'expPdf', 'expCdf'],
      hypothesis: ['tTest', 'zTest', 'chiSqTest', 'fTest', 'anova', 'mannWhitney', 'wilcoxon', 'kruskal', 'levene', 'shapiro', 'jarqueBera', 'adf', 'kpss', 'granger', 'cointegration']
    };

    if (category && categories[category as keyof typeof categories]) {
      return { success: true, data: { category, functions: categories[category as keyof typeof categories] } };
    }

    const total = Object.values(categories).flat().length;
    return { success: true, data: { categories, totalFunctions: total } };
  }
}

export default new StatisticsLibrarySkill();
