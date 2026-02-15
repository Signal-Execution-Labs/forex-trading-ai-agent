/**
 * Strategy Leaderboard Hook
 * 
 * Tracks and ranks trading strategy performance over time.
 * Generates weekly reports with top performers and underperformers.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface StrategyStats {
  id: string;
  name: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  maxDrawdown: number;
  returns: number[];
  lastUpdated: string;
}

interface LeaderboardEntry {
  rank: number;
  strategyId: string;
  strategyName: string;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  totalReturn: number;
  maxDrawdown: number;
  totalTrades: number;
}

interface LeaderboardData {
  strategies: Record<string, StrategyStats>;
  lastWeeklyReport?: string;
}

const KIT_HOME = path.join(os.homedir(), '.kit');
const DATA_DIR = path.join(KIT_HOME, 'data');
const REPORTS_DIR = path.join(KIT_HOME, 'reports');
const STATS_FILE = path.join(DATA_DIR, 'strategy-stats.json');

// Ensure directories exist
function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

// Load leaderboard data
function loadData(): LeaderboardData {
  ensureDirs();
  if (fs.existsSync(STATS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    } catch {
      return { strategies: {} };
    }
  }
  return { strategies: {} };
}

// Save leaderboard data
function saveData(data: LeaderboardData): void {
  ensureDirs();
  fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
}

// Calculate Sharpe ratio (simplified)
function calculateSharpe(returns: number[], riskFreeRate = 0.02): number {
  if (returns.length < 2) return 0;
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  // Annualized Sharpe (assuming daily returns)
  const annualizedReturn = avgReturn * 252;
  const annualizedStdDev = stdDev * Math.sqrt(252);
  
  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

// Calculate win rate
function calculateWinRate(stats: StrategyStats): number {
  if (stats.totalTrades === 0) return 0;
  return (stats.winningTrades / stats.totalTrades) * 100;
}

// Calculate profit factor
function calculateProfitFactor(stats: StrategyStats): number {
  if (stats.grossLoss === 0) return stats.grossProfit > 0 ? Infinity : 0;
  return stats.grossProfit / Math.abs(stats.grossLoss);
}

// Generate leaderboard
function generateLeaderboard(
  data: LeaderboardData, 
  metric: string
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  
  for (const [id, stats] of Object.entries(data.strategies)) {
    const sharpe = calculateSharpe(stats.returns);
    const winRate = calculateWinRate(stats);
    const profitFactor = calculateProfitFactor(stats);
    const totalReturn = stats.totalPnl;
    
    entries.push({
      rank: 0,
      strategyId: id,
      strategyName: stats.name,
      sharpeRatio: sharpe,
      winRate,
      profitFactor,
      totalReturn,
      maxDrawdown: stats.maxDrawdown,
      totalTrades: stats.totalTrades,
    });
  }
  
  // Sort by chosen metric (descending, except for drawdown)
  entries.sort((a, b) => {
    switch (metric) {
      case 'sharpe': return b.sharpeRatio - a.sharpeRatio;
      case 'winrate': return b.winRate - a.winRate;
      case 'profit_factor': return b.profitFactor - a.profitFactor;
      case 'return': return b.totalReturn - a.totalReturn;
      case 'drawdown': return a.maxDrawdown - b.maxDrawdown; // Lower is better
      default: return b.sharpeRatio - a.sharpeRatio;
    }
  });
  
  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  
  return entries;
}

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Generate weekly report
function generateWeeklyReport(leaderboard: LeaderboardEntry[]): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);
  const reportFile = path.join(REPORTS_DIR, `leaderboard-${year}-W${week.toString().padStart(2, '0')}.json`);
  
  const report = {
    year,
    week,
    generatedAt: now.toISOString(),
    leaderboard,
    topPerformers: leaderboard.slice(0, 3),
    totalStrategies: leaderboard.length,
    avgSharpe: leaderboard.reduce((sum, e) => sum + e.sharpeRatio, 0) / leaderboard.length || 0,
    avgWinRate: leaderboard.reduce((sum, e) => sum + e.winRate, 0) / leaderboard.length || 0,
  };
  
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  return reportFile;
}

// Format leaderboard message
function formatLeaderboardMessage(leaderboard: LeaderboardEntry[], topN: number): string {
  const medals = ['🥇', '🥈', '🥉'];
  const lines = ['🏆 **Weekly Strategy Leaderboard**\n'];
  
  for (let i = 0; i < Math.min(topN, leaderboard.length); i++) {
    const entry = leaderboard[i];
    const medal = medals[i] || `#${i + 1}`;
    lines.push(
      `${medal} **${entry.strategyName}**\n` +
      `   Sharpe: ${entry.sharpeRatio.toFixed(2)} | ` +
      `Win: ${entry.winRate.toFixed(1)}% | ` +
      `P&L: $${entry.totalReturn.toFixed(2)}`
    );
  }
  
  return lines.join('\n');
}

interface HookEvent {
  type: string;
  action: string;
  sessionKey?: string;
  timestamp: Date;
  messages: string[];
  context: {
    trade?: {
      strategyId: string;
      strategyName: string;
      pnl: number;
      returnPercent: number;
    };
    [key: string]: unknown;
  };
}

type HookHandler = (event: HookEvent) => Promise<void>;

const handler: HookHandler = async (event) => {
  const metric = process.env.RANKING_METRIC || 'sharpe';
  const weeklyReportDay = process.env.WEEKLY_REPORT_DAY || 'sunday';
  const topN = parseInt(process.env.ANNOUNCE_TOP_N || '3', 10);

  try {
    const data = loadData();
    
    // Handle trade closed event
    if (event.type === 'trade' && event.action === 'closed' && event.context.trade) {
      const trade = event.context.trade;
      
      if (!data.strategies[trade.strategyId]) {
        data.strategies[trade.strategyId] = {
          id: trade.strategyId,
          name: trade.strategyName,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalPnl: 0,
          grossProfit: 0,
          grossLoss: 0,
          maxDrawdown: 0,
          returns: [],
          lastUpdated: new Date().toISOString(),
        };
      }
      
      const stats = data.strategies[trade.strategyId];
      stats.totalTrades++;
      stats.totalPnl += trade.pnl;
      stats.returns.push(trade.returnPercent);
      
      if (trade.pnl >= 0) {
        stats.winningTrades++;
        stats.grossProfit += trade.pnl;
      } else {
        stats.losingTrades++;
        stats.grossLoss += Math.abs(trade.pnl);
      }
      
      // Update max drawdown (simplified)
      const currentDrawdown = Math.min(...stats.returns.slice(-20).map((_, i, arr) => 
        arr.slice(i).reduce((a, b) => a + b, 0)
      ));
      if (currentDrawdown < stats.maxDrawdown) {
        stats.maxDrawdown = currentDrawdown;
      }
      
      stats.lastUpdated = new Date().toISOString();
      saveData(data);
      
      console.log(`[strategy-leaderboard] Updated ${stats.name}: ${stats.totalTrades} trades, $${stats.totalPnl.toFixed(2)} P&L`);
    }
    
    // Handle heartbeat - check for weekly report
    if (event.type === 'gateway' && event.action === 'heartbeat') {
      const now = new Date();
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const thisWeek = `${now.getFullYear()}-W${getWeekNumber(now).toString().padStart(2, '0')}`;
      
      // Generate weekly report on configured day
      if (dayOfWeek === weeklyReportDay.toLowerCase() && data.lastWeeklyReport !== thisWeek) {
        const leaderboard = generateLeaderboard(data, metric);
        
        if (leaderboard.length > 0) {
          generateWeeklyReport(leaderboard);
          
          const message = formatLeaderboardMessage(leaderboard, topN);
          event.messages.push(message);
          
          data.lastWeeklyReport = thisWeek;
          saveData(data);
          
          console.log(`[strategy-leaderboard] Weekly report generated for ${thisWeek}`);
        }
      }
    }
    
  } catch (error) {
    console.error('[strategy-leaderboard] Error:', error);
  }
};

export default handler;
