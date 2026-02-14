/**
 * Monthly Report Hook Handler
 * Generates comprehensive monthly trading performance reports
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

interface MonthlyStats {
  month: number;
  year: number;
  monthName: string;
  totalPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  tradingDays: number;
  avgDailyPnl: number;
  bestDay: { date: string; pnl: number } | null;
  worstDay: { date: string; pnl: number } | null;
  topWinners: Array<{ symbol: string; pnl: number }>;
  topLosers: Array<{ symbol: string; pnl: number }>;
  byStrategy: Record<string, { trades: number; pnl: number; winRate: number }>;
  weeklyBreakdown: Array<{ week: number; pnl: number; trades: number }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function loadMonthTrades(kitHome: string, year: number, month: number): Trade[] {
  const tradesLogPath = path.join(kitHome, 'logs', 'trades.log');
  const trades: Trade[] = [];
  
  if (!fs.existsSync(tradesLogPath)) {
    return trades;
  }
  
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const lines = fs.readFileSync(tradesLogPath, 'utf8').split('\n').filter(Boolean);
  
  for (const line of lines) {
    try {
      const trade = JSON.parse(line) as Trade;
      if (trade.timestamp?.startsWith(monthStr) && typeof trade.pnl === 'number') {
        trades.push(trade);
      }
    } catch {
      // Skip invalid lines
    }
  }
  
  return trades;
}

function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const firstDayOfWeek = firstDay.getDay();
  return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
}

function calculateStats(trades: Trade[], year: number, month: number): MonthlyStats {
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  
  // Max drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let cumPnl = 0;
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  for (const trade of sortedTrades) {
    cumPnl += trade.pnl;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }
  
  // Daily breakdown
  const dailyPnl: Record<string, number> = {};
  for (const trade of trades) {
    const date = trade.timestamp.split('T')[0];
    dailyPnl[date] = (dailyPnl[date] || 0) + trade.pnl;
  }
  
  const dailyEntries = Object.entries(dailyPnl);
  const tradingDays = dailyEntries.length;
  const avgDailyPnl = tradingDays > 0 ? totalPnl / tradingDays : 0;
  
  const bestDay = dailyEntries.length > 0
    ? dailyEntries.reduce((best, [date, pnl]) => 
        pnl > (best?.pnl ?? -Infinity) ? { date, pnl } : best, null as { date: string; pnl: number } | null)
    : null;
  const worstDay = dailyEntries.length > 0
    ? dailyEntries.reduce((worst, [date, pnl]) => 
        pnl < (worst?.pnl ?? Infinity) ? { date, pnl } : worst, null as { date: string; pnl: number } | null)
    : null;
  
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
  
  // Weekly breakdown
  const weeklyData: Record<number, { pnl: number; trades: number }> = {};
  for (const trade of trades) {
    const week = getWeekOfMonth(new Date(trade.timestamp));
    if (!weeklyData[week]) {
      weeklyData[week] = { pnl: 0, trades: 0 };
    }
    weeklyData[week].pnl += trade.pnl;
    weeklyData[week].trades++;
  }
  
  const weeklyBreakdown = Object.entries(weeklyData)
    .map(([week, data]) => ({
      week: parseInt(week),
      pnl: Math.round(data.pnl * 100) / 100,
      trades: data.trades
    }))
    .sort((a, b) => a.week - b.week);
  
  // Top winners/losers by symbol
  const bySymbol: Record<string, number> = {};
  for (const trade of trades) {
    bySymbol[trade.symbol] = (bySymbol[trade.symbol] || 0) + trade.pnl;
  }
  
  const symbolEntries = Object.entries(bySymbol);
  const topWinners = symbolEntries
    .filter(([, pnl]) => pnl > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([symbol, pnl]) => ({ symbol, pnl: Math.round(pnl * 100) / 100 }));
  
  const topLosers = symbolEntries
    .filter(([, pnl]) => pnl < 0)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 5)
    .map(([symbol, pnl]) => ({ symbol, pnl: Math.round(pnl * 100) / 100 }));
  
  return {
    month,
    year,
    monthName: MONTH_NAMES[month],
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? Math.round((wins.length / trades.length) * 100) : 0,
    avgWin: wins.length > 0 ? Math.round((grossProfit / wins.length) * 100) / 100 : 0,
    avgLoss: losses.length > 0 ? Math.round((grossLoss / losses.length) * 100) / 100 : 0,
    profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? Infinity : 0,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    tradingDays,
    avgDailyPnl: Math.round(avgDailyPnl * 100) / 100,
    bestDay,
    worstDay,
    topWinners,
    topLosers,
    byStrategy: byStrategyWithRate,
    weeklyBreakdown
  };
}

function generateMarkdownReport(stats: MonthlyStats): string {
  const emoji = stats.totalPnl >= 0 ? '📈' : '📉';
  const pnlSign = stats.totalPnl >= 0 ? '+' : '';
  
  let report = `# ${emoji} Monthly Trading Report - ${stats.monthName} ${stats.year}\n\n`;
  
  report += `## 💰 Executive Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total P&L | ${pnlSign}$${stats.totalPnl} |\n`;
  report += `| Total Trades | ${stats.totalTrades} |\n`;
  report += `| Win Rate | ${stats.winRate}% |\n`;
  report += `| Profit Factor | ${stats.profitFactor === Infinity ? '∞' : stats.profitFactor} |\n`;
  report += `| Max Drawdown | $${stats.maxDrawdown} |\n`;
  report += `| Trading Days | ${stats.tradingDays} |\n`;
  report += `| Avg Daily P&L | $${stats.avgDailyPnl} |\n\n`;
  
  report += `## 📊 Trade Statistics\n\n`;
  report += `- **Wins:** ${stats.wins} (avg: $${stats.avgWin})\n`;
  report += `- **Losses:** ${stats.losses} (avg: -$${stats.avgLoss})\n`;
  report += `- **Risk/Reward:** ${stats.avgLoss > 0 ? (stats.avgWin / stats.avgLoss).toFixed(2) : 'N/A'}:1\n\n`;
  
  if (stats.bestDay) {
    report += `### 🌟 Best Trading Day\n`;
    report += `**${stats.bestDay.date}**: +$${Math.round(stats.bestDay.pnl * 100) / 100}\n\n`;
  }
  
  if (stats.worstDay) {
    report += `### ⚠️ Worst Trading Day\n`;
    report += `**${stats.worstDay.date}**: $${Math.round(stats.worstDay.pnl * 100) / 100}\n\n`;
  }
  
  if (stats.weeklyBreakdown.length > 0) {
    report += `## 📅 Weekly Breakdown\n\n`;
    report += `| Week | P&L | Trades |\n`;
    report += `|------|-----|--------|\n`;
    for (const week of stats.weeklyBreakdown) {
      const sign = week.pnl >= 0 ? '+' : '';
      report += `| Week ${week.week} | ${sign}$${week.pnl} | ${week.trades} |\n`;
    }
    report += '\n';
  }
  
  if (stats.topWinners.length > 0) {
    report += `## 🏆 Top Performing Assets\n\n`;
    for (const asset of stats.topWinners) {
      report += `- **${asset.symbol}**: +$${asset.pnl}\n`;
    }
    report += '\n';
  }
  
  if (stats.topLosers.length > 0) {
    report += `## 💔 Worst Performing Assets\n\n`;
    for (const asset of stats.topLosers) {
      report += `- **${asset.symbol}**: $${asset.pnl}\n`;
    }
    report += '\n';
  }
  
  if (Object.keys(stats.byStrategy).length > 0) {
    report += `## 🎯 Strategy Performance\n\n`;
    report += `| Strategy | Trades | P&L | Win Rate |\n`;
    report += `|----------|--------|-----|----------|\n`;
    const sorted = Object.entries(stats.byStrategy).sort(([, a], [, b]) => b.pnl - a.pnl);
    for (const [name, data] of sorted) {
      const sign = data.pnl >= 0 ? '+' : '';
      report += `| ${name} | ${data.trades} | ${sign}$${data.pnl} | ${data.winRate}% |\n`;
    }
    report += '\n';
  }
  
  report += `---\n*Generated by K.I.T. Monthly Report Hook at ${new Date().toISOString()}*\n`;
  
  return report;
}

const handler: HookHandler = async (ctx) => {
  const kitHome = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.kit'
  );
  
  // Report on previous month (since this typically runs at start of new month)
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() - 1;
  if (month < 0) {
    month = 11;
    year--;
  }
  
  // Load month's trades
  const trades = loadMonthTrades(kitHome, year, month);
  
  // Calculate stats
  const stats = calculateStats(trades, year, month);
  
  // Generate report
  const report = generateMarkdownReport(stats);
  
  // Save to file
  const reportsDir = path.join(kitHome, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const monthStr = String(month + 1).padStart(2, '0');
  const reportPath = path.join(reportsDir, `monthly-${year}-${monthStr}.md`);
  fs.writeFileSync(reportPath, report);
  
  // Also save JSON
  const jsonPath = path.join(reportsDir, `monthly-${year}-${monthStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(stats, null, 2));
  
  // Push notification
  if (ctx.messages && trades.length > 0) {
    const emoji = stats.totalPnl >= 0 ? '📈' : '📉';
    const pnlSign = stats.totalPnl >= 0 ? '+' : '';
    ctx.messages.push(
      `${emoji} **Monthly Report - ${stats.monthName} ${stats.year}**\n\n` +
      `P&L: ${pnlSign}$${stats.totalPnl}\n` +
      `Trades: ${stats.totalTrades} (${stats.winRate}% win rate)\n` +
      `Profit Factor: ${stats.profitFactor === Infinity ? '∞' : stats.profitFactor}\n` +
      `Trading Days: ${stats.tradingDays}\n` +
      `Avg Daily: $${stats.avgDailyPnl}\n\n` +
      `Full report: ${reportPath}`
    );
  }
};

export default handler;
