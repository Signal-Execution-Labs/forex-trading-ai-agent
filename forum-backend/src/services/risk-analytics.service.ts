/**
 * Risk Analytics Service
 * Advanced portfolio risk metrics: VaR, CVaR, Sharpe, Sortino, drawdown analysis
 */

import db from '../db/database.ts';

export interface RiskMetrics {
  totalReturn: number;
  avgDailyReturn: number;
  annualizedReturn: number;
  volatility: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  currentDrawdown: number;
  avgDrawdown: number;
  recoveryFactor: number;
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  payoffRatio: number;
  expectancy: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgTradesPerDay: number;
  avgHoldingPeriod: number;
  longExposure: number;
  shortExposure: number;
  netExposure: number;
  grossExposure: number;
  leverageUsed: number;
  betaToMarket: number;
  correlationToBTC: number;
  periodStart: string;
  periodEnd: string;
  calculatedAt: string;
}

export interface DrawdownPeriod {
  startDate: string;
  endDate?: string;
  recoveryDate?: string;
  peakValue: number;
  troughValue: number;
  drawdownPercent: number;
  duration: number;
  recovered: boolean;
}

export interface DailySnapshot {
  date: string;
  equity: number;
  dailyPnl: number;
  dailyReturn: number;
  drawdown: number;
  trades: number;
  cumulativePnl: number;
}

export interface PositionRisk {
  asset: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  riskAmount: number;
  riskPercent: number;
  var95: number;
  contribution: number;
}

class RiskAnalyticsService {
  async calculateRiskMetrics(agentId: string, periodDays: number = 30): Promise<RiskMetrics> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 86400000);
    
    const signals = (db.data as any).signals || [];
    const trades = signals
      .filter((s: any) => s.agentId === agentId && s.status === 'closed')
      .filter((s: any) => new Date(s.createdAt) >= periodStart);
    
    const snapshots = await this.getEquitySnapshots(agentId, periodDays);
    const dailyReturns = snapshots.map(s => s.dailyReturn);
    
    const totalReturn = snapshots.length > 1 
      ? ((snapshots[snapshots.length - 1].equity - snapshots[0].equity) / snapshots[0].equity) * 100 : 0;
    const avgDailyReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const annualizedReturn = avgDailyReturn * 252;
    
    const volatility = this.stdDev(dailyReturns);
    const annualizedVolatility = volatility * Math.sqrt(252);
    const downsideDeviation = this.stdDev(dailyReturns.filter(r => r < 0));
    
    const riskFreeRate = 0.05 / 252;
    const sharpeRatio = volatility > 0 ? ((avgDailyReturn - riskFreeRate) / volatility) * Math.sqrt(252) : 0;
    const sortinoRatio = downsideDeviation > 0 ? ((avgDailyReturn - riskFreeRate) / downsideDeviation) * Math.sqrt(252) : 0;
    
    const drawdowns = this.calculateDrawdowns(snapshots);
    const maxDrawdown = Math.max(...drawdowns.map(d => d.drawdownPercent), 0);
    const maxDrawdownDuration = Math.max(...drawdowns.map(d => d.duration), 0);
    const currentDrawdown = snapshots.length > 0 ? snapshots[snapshots.length - 1].drawdown : 0;
    const avgDrawdown = drawdowns.length > 0 ? drawdowns.reduce((sum, d) => sum + d.drawdownPercent, 0) / drawdowns.length : 0;
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
    const recoveryFactor = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;
    
    const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
    const var95 = this.percentile(sortedReturns, 5);
    const var99 = this.percentile(sortedReturns, 1);
    const cvar95 = this.cvar(sortedReturns, 5);
    const cvar99 = this.cvar(sortedReturns, 1);
    
    const wins = trades.filter((t: any) => (t.pnl || 0) > 0);
    const losses = trades.filter((t: any) => (t.pnl || 0) < 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const totalWins = wins.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? Infinity : 0);
    
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
    const largestWin = Math.max(...trades.map((t: any) => t.pnl || 0), 0);
    const largestLoss = Math.min(...trades.map((t: any) => t.pnl || 0), 0);
    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
    
    return {
      totalReturn, avgDailyReturn, annualizedReturn, volatility, annualizedVolatility,
      sharpeRatio, sortinoRatio, calmarRatio, informationRatio: 0,
      maxDrawdown, maxDrawdownDuration, currentDrawdown, avgDrawdown, recoveryFactor,
      var95, var99, cvar95, cvar99,
      winRate, profitFactor, avgWin, avgLoss, largestWin, largestLoss, payoffRatio, expectancy,
      totalTrades: trades.length, winningTrades: wins.length, losingTrades: losses.length,
      avgTradesPerDay: trades.length / periodDays, avgHoldingPeriod: 0,
      longExposure: 0, shortExposure: 0, netExposure: 0, grossExposure: 0, leverageUsed: 1,
      betaToMarket: 0, correlationToBTC: 0,
      periodStart: periodStart.toISOString(), periodEnd: now.toISOString(), calculatedAt: new Date().toISOString()
    };
  }

  async getEquitySnapshots(agentId: string, periodDays: number): Promise<DailySnapshot[]> {
    const snapshots = ((db.data as any).portfolio_snapshots || [])
      .filter((s: any) => s.agentId === agentId)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (snapshots.length === 0) return this.generateSnapshots(agentId, periodDays);
    return snapshots.slice(-periodDays);
  }

  private async generateSnapshots(agentId: string, periodDays: number): Promise<DailySnapshot[]> {
    const now = new Date();
    const startDate = new Date(now.getTime() - periodDays * 86400000);
    const signals = (db.data as any).signals || [];
    const trades = signals
      .filter((s: any) => s.agentId === agentId && s.status === 'closed')
      .filter((s: any) => new Date(s.closedAt || s.updatedAt) >= startDate)
      .sort((a: any, b: any) => new Date(a.closedAt || a.updatedAt).getTime() - new Date(b.closedAt || b.updatedAt).getTime());
    
    const dayMap = new Map<string, any[]>();
    for (const t of trades) {
      const date = new Date(t.closedAt || t.updatedAt).toISOString().split('T')[0];
      if (!dayMap.has(date)) dayMap.set(date, []);
      dayMap.get(date)!.push(t);
    }
    
    const snapshots: DailySnapshot[] = [];
    let cumulativePnl = 0, equity = 10000, peak = 10000;
    
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayTrades = dayMap.get(dateStr) || [];
      const dailyPnl = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      cumulativePnl += dailyPnl;
      equity += dailyPnl;
      peak = Math.max(peak, equity);
      const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      const dailyReturn = equity - dailyPnl > 0 ? (dailyPnl / (equity - dailyPnl)) * 100 : 0;
      snapshots.push({ date: dateStr, equity, dailyPnl, dailyReturn, drawdown, trades: dayTrades.length, cumulativePnl });
    }
    return snapshots;
  }

  private stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1));
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    return sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];
  }

  private cvar(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const cutoff = Math.max(Math.floor((p / 100) * sorted.length), 1);
    return sorted.slice(0, cutoff).reduce((a, b) => a + b, 0) / cutoff;
  }

  private calculateDrawdowns(snapshots: DailySnapshot[]): DrawdownPeriod[] {
    const drawdowns: DrawdownPeriod[] = [];
    let peak = snapshots[0]?.equity || 0, inDrawdown = false;
    let current: Partial<DrawdownPeriod> = {};
    
    for (const s of snapshots) {
      if (s.equity > peak) {
        if (inDrawdown) { current.recoveryDate = s.date; current.recovered = true; drawdowns.push(current as DrawdownPeriod); inDrawdown = false; }
        peak = s.equity;
      } else if (s.equity < peak) {
        const ddPercent = ((peak - s.equity) / peak) * 100;
        if (!inDrawdown) {
          inDrawdown = true;
          current = { startDate: s.date, peakValue: peak, troughValue: s.equity, drawdownPercent: ddPercent, duration: 1, recovered: false };
        } else {
          current.duration!++;
          if (s.equity < (current.troughValue || Infinity)) { current.troughValue = s.equity; current.drawdownPercent = ddPercent; }
        }
        current.endDate = s.date;
      }
    }
    if (inDrawdown) drawdowns.push(current as DrawdownPeriod);
    return drawdowns;
  }

  async analyzePositionRisk(agentId: string, positions: any[]): Promise<PositionRisk[]> {
    return positions.map(pos => {
      const unrealizedPnl = pos.direction === 'long'
        ? (pos.currentPrice - pos.entryPrice) * pos.size
        : (pos.entryPrice - pos.currentPrice) * pos.size;
      const riskAmount = pos.stopLoss ? Math.abs(pos.stopLoss - pos.entryPrice) * pos.size : pos.entryPrice * pos.size * 0.1;
      return {
        asset: pos.asset, direction: pos.direction, size: pos.size,
        entryPrice: pos.entryPrice, currentPrice: pos.currentPrice,
        unrealizedPnl, unrealizedPnlPercent: (unrealizedPnl / (pos.entryPrice * pos.size)) * 100,
        stopLoss: pos.stopLoss, takeProfit: pos.takeProfit,
        riskAmount, riskPercent: (riskAmount / (pos.entryPrice * pos.size)) * 100,
        var95: pos.currentPrice * pos.size * 0.02 * 1.65, contribution: 0
      };
    });
  }

  async getRiskSummary(agentId: string): Promise<{ metrics: RiskMetrics; drawdowns: DrawdownPeriod[]; equityCurve: DailySnapshot[]; riskGrade: 'A'|'B'|'C'|'D'|'F'; warnings: string[] }> {
    const metrics = await this.calculateRiskMetrics(agentId, 30);
    const snapshots = await this.getEquitySnapshots(agentId, 30);
    const drawdowns = this.calculateDrawdowns(snapshots);
    
    let score = 100;
    const warnings: string[] = [];
    if (metrics.maxDrawdown > 20) { score -= 20; warnings.push('High max drawdown (>20%)'); }
    if (metrics.sharpeRatio < 0.5) { score -= 15; warnings.push('Low Sharpe ratio (<0.5)'); }
    if (metrics.winRate < 40) { score -= 15; warnings.push('Low win rate (<40%)'); }
    if (metrics.profitFactor < 1) { score -= 20; warnings.push('Profit factor below 1'); }
    if (Math.abs(metrics.var99) > 5) { score -= 10; warnings.push('High 99% VaR (>5%)'); }
    
    const riskGrade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';
    return { metrics, drawdowns, equityCurve: snapshots, riskGrade, warnings };
  }

  async storeSnapshot(snapshot: DailySnapshot & { agentId: string }): Promise<void> {
    (db.data as any).portfolio_snapshots = (db.data as any).portfolio_snapshots || [];
    (db.data as any).portfolio_snapshots.push(snapshot);
    await db.write();
  }
}

export const riskAnalyticsService = new RiskAnalyticsService();
