/**
 * Weekly Report Hook Handler
 * Generates comprehensive weekly trading performance reports
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler } from '../../types.js';

interface Trade {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  pnl: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  strategy?: string;
  timestamp: string;
}

interface WeeklyStats {
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  totalPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: Trade | null;
  largestLoss: Trade | null;
  maxDrawdown: number;
  bestAsset: { symbol: string; pnl: number } | null;
  worstAsset: { symbol: string; pnl: number } | null;
  byStrategy: Record<string, { trades: number; pnl: number; winRate: number }>;
  byAsset: Record<string, { trades: number; pnl: number }>;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

function loadWeekTrades(kitHome: string, start: Date, end: Date): Trade[] {
  const tradesLogPath = path.join(kitHome, 'logs', 'trades.log');
  const trades: Trade[] = [];
  
  if (!fs.existsSync(tradesLogPath)) {
    return trades;
  }
  
  const lines = fs.readFileSync(tradesLogPath, 'utf8').split('\n').filter(Boolean);
  
  for (const line of lines) {
    try {
      const trade = JSON.parse(line) as Trade;
      const tradeDate = new Date(trade.timestamp);
      if (tradeDate >= start && tradeDate <= end && typeof trade.pnl === 'number') {
        trades.push(trade);
      }
    } catch {
      // Skip invalid lines
    }
  }
  
  return trades;
}

function calculateStats(trades: Trade[], now: Date): WeeklyStats {
  const { start, end } = getWeekBounds(now);
  const weekNumber = getWeekNumber(now);
  const year = now.getFullYear();
  
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const breakeven = trades.filter(t => t.pnl === 0);
  
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  
  // Calculate max drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let cumPnl = 0;
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  for (const trade of sortedTrades) {
    cumPnl += trade.pnl;
    if (cumPnl > peak) peak = cumPnl;
    const drawdown = peak - cumPnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  // By strategy
  const byStrategy: Record<string, { trades: number; pnl: number; wins: number }> = {};
  for (const trade of trades) {
    const strategy = trade.strategy || 'unknown';
    if (!byStrategy[strategy]) {
      byStrategy[strategy] = { trades: 0, pnl: 0, wins: 0 };
    }
    byStrategy[strategy].trades++;
    byStrategy[strategy].pnl += trade.pnl;
    if (trade.pnl > 0) byStrategy[strategy].wins++;
  }
  
  const byStrategyWithRate: Record<string, { trades: number; pnl: number; winRate: number }> = {};
  for (const [key, val] of Object.entries(byStrategy)) {
    byStrategyWithRate[key] = {
      trades: val.trades,
      pnl: Math.round(val.pnl * 100) / 100,
      winRate: val.trades > 0 ? Math.round((val.wins / val.trades) * 100) : 0
    };
  }
  
  // By asset
  const byAsset: Record<string, { trades: number; pnl: number }> = {};
  for (const trade of trades) {
    if (!byAsset[trade.symbol]) {
      byAsset[trade.symbol] = { trades: 0, pnl: 0 };
    }
    byAsset[trade.symbol].trades++;
    byAsset[trade.symbol].pnl += trade.pnl;
  }
  
  // Round asset P&L
  for (const key of Object.keys(byAsset)) {
    byAsset[key].pnl = Math.round(byAsset[key].pnl * 100) / 100;
  }
  
  // Best/worst assets
  const assetEntries = Object.entries(byAsset);
  const bestAsset = assetEntries.length > 0
    ? assetEntries.reduce((best, [symbol, data]) => 
        data.pnl > (best?.pnl ?? -Infinity) ? { symbol, pnl: data.pnl } : best, 
        null as { symbol: string; pnl: number } | null)
    : null;
  const worstAsset = assetEntries.length > 0
    ? assetEntries.reduce((worst, [symbol, data]) => 
        data.pnl < (worst?.pnl ?? Infinity) ? { symbol, pnl: data.pnl } : worst,
        null as { symbol: string; pnl: number } | null)
    : null;
  
  return {
    weekNumber,
    year,
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate: trades.length > 0 ? Math.round((wins.length / trades.length) * 100) : 0,
    avgWin: wins.length > 0 ? Math.round((grossProfit / wins.length) * 100) / 100 : 0,
    avgLoss: losses.length > 0 ? Math.round((grossLoss / losses.length) * 100) / 100 : 0,
    profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? Infinity : 0,
    largestWin: wins.length > 0 ? wins.reduce((max, t) => t.pnl > max.pnl ? t : max) : null,
    largestLoss: losses.length > 0 ? losses.reduce((min, t) => t.pnl < min.pnl ? t : min) : null,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    bestAsset,
    worstAsset,
    byStrategy: byStrategyWithRate,
    byAsset
  };
}

function generateMarkdownReport(stats: WeeklyStats): string {
  const emoji = stats.totalPnl >= 0 ? '📈' : '📉';
  const pnlSign = stats.totalPnl >= 0 ? '+' : '';
  
  let report = `# ${emoji} Weekly Trading Report - Week ${stats.weekNumber}, ${stats.year}\n\n`;
  report += `**Period:** ${stats.startDate} to ${stats.endDate}\n\n`;
  
  report += `## 💰 Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total P&L | ${pnlSign}$${stats.totalPnl} |\n`;
  report += `| Total Trades | ${stats.totalTrades} |\n`;
  report += `| Win Rate | ${stats.winRate}% |\n`;
  report += `| Profit Factor | ${stats.profitFactor === Infinity ? '∞' : stats.profitFactor} |\n`;
  report += `| Max Drawdown | $${stats.maxDrawdown} |\n\n`;
  
  report += `## 📊 Trade Breakdown\n\n`;
  report += `- **Wins:** ${stats.wins} (avg: $${stats.avgWin})\n`;
  report += `- **Losses:** ${stats.losses} (avg: -$${stats.avgLoss})\n`;
  report += `- **Breakeven:** ${stats.breakeven}\n\n`;
  
  if (stats.largestWin) {
    report += `### 🏆 Best Trade\n`;
    report += `- **${stats.largestWin.symbol}** (${stats.largestWin.direction}): +$${Math.round(stats.largestWin.pnl * 100) / 100}\n\n`;
  }
  
  if (stats.largestLoss) {
    report += `### 💔 Worst Trade\n`;
    report += `- **${stats.largestLoss.symbol}** (${stats.largestLoss.direction}): -$${Math.abs(Math.round(stats.largestLoss.pnl * 100) / 100)}\n\n`;
  }
  
  if (Object.keys(stats.byStrategy).length > 0) {
    report += `## 🎯 Performance by Strategy\n\n`;
    report += `| Strategy | Trades | P&L | Win Rate |\n`;
    report += `|----------|--------|-----|----------|\n`;
    for (const [name, data] of Object.entries(stats.byStrategy)) {
      const sign = data.pnl >= 0 ? '+' : '';
      report += `| ${name} | ${data.trades} | ${sign}$${data.pnl} | ${data.winRate}% |\n`;
    }
    report += '\n';
  }
  
  if (Object.keys(stats.byAsset).length > 0) {
    report += `## 📈 Performance by Asset\n\n`;
    report += `| Asset | Trades | P&L |\n`;
    report += `|-------|--------|-----|\n`;
    const sortedAssets = Object.entries(stats.byAsset)
      .sort(([, a], [, b]) => b.pnl - a.pnl)
      .slice(0, 10);
    for (const [symbol, data] of sortedAssets) {
      const sign = data.pnl >= 0 ? '+' : '';
      report += `| ${symbol} | ${data.trades} | ${sign}$${data.pnl} |\n`;
    }
    report += '\n';
  }
  
  report += `---\n*Generated by K.I.T. Weekly Report Hook at ${new Date().toISOString()}*\n`;
  
  return report;
}

const handler: HookHandler = async (ctx) => {
  const kitHome = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.kit'
  );
  
  const now = new Date();
  const { start, end } = getWeekBounds(now);
  
  // Load this week's trades
  const trades = loadWeekTrades(kitHome, start, end);
  
  // Calculate statistics
  const stats = calculateStats(trades, now);
  
  // Generate report
  const report = generateMarkdownReport(stats);
  
  // Save to file
  const reportsDir = path.join(kitHome, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportPath = path.join(reportsDir, `weekly-${stats.year}-W${String(stats.weekNumber).padStart(2, '0')}.md`);
  fs.writeFileSync(reportPath, report);
  
  // Also save JSON for programmatic access
  const jsonPath = path.join(reportsDir, `weekly-${stats.year}-W${String(stats.weekNumber).padStart(2, '0')}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(stats, null, 2));
  
  // Push notification
  if (ctx.messages && trades.length > 0) {
    const emoji = stats.totalPnl >= 0 ? '📈' : '📉';
    const pnlSign = stats.totalPnl >= 0 ? '+' : '';
    ctx.messages.push(
      `${emoji} **Weekly Report - Week ${stats.weekNumber}**\n\n` +
      `P&L: ${pnlSign}$${stats.totalPnl}\n` +
      `Trades: ${stats.totalTrades} (${stats.winRate}% win rate)\n` +
      `Profit Factor: ${stats.profitFactor === Infinity ? '∞' : stats.profitFactor}\n` +
      `Max Drawdown: $${stats.maxDrawdown}\n\n` +
      `Full report: ${reportPath}`
    );
  }
};

export default handler;
