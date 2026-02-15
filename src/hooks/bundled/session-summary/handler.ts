/**
 * Session Summary Hook Handler
 * Tracks trades and generates end-of-session performance summaries
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler } from '../../types.js';

interface SessionTrade {
  symbol: string;
  pnl: number;
  isWin: boolean;
  timestamp: string;
}

interface SessionData {
  date: string;
  trades: SessionTrade[];
  peakPnL: number;
  troughPnL: number;
}

// State file for tracking session data
function getStateFile(): string {
  return path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.kit',
    'state',
    'session-summary.json'
  );
}

function loadState(): SessionData {
  const file = getStateFile();
  const today = new Date().toISOString().split('T')[0];
  
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as SessionData;
      if (data.date === today) return data;
    }
  } catch { }
  
  return { date: today, trades: [], peakPnL: 0, troughPnL: 0 };
}

function saveState(state: SessionData): void {
  const file = getStateFile();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

function formatCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getGrade(winRate: number, profitFactor: number): { grade: string; emoji: string } {
  if (winRate >= 60 && profitFactor >= 2) return { grade: 'A+', emoji: '🏆' };
  if (winRate >= 55 && profitFactor >= 1.5) return { grade: 'A', emoji: '⭐' };
  if (winRate >= 50 && profitFactor >= 1.2) return { grade: 'B', emoji: '👍' };
  if (winRate >= 45 && profitFactor >= 1) return { grade: 'C', emoji: '📊' };
  if (winRate >= 40) return { grade: 'D', emoji: '⚠️' };
  return { grade: 'F', emoji: '🔴' };
}

function generateSparkline(trades: SessionTrade[]): string {
  if (trades.length < 2) return '';
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  
  // Build running P&L
  const pnlCurve: number[] = [];
  let running = 0;
  for (const t of trades) {
    running += t.pnl;
    pnlCurve.push(running);
  }
  
  const min = Math.min(...pnlCurve);
  const max = Math.max(...pnlCurve);
  const range = max - min || 1;
  
  return pnlCurve.map(v => {
    const normalized = (v - min) / range;
    const index = Math.min(Math.floor(normalized * blocks.length), blocks.length - 1);
    return blocks[index];
  }).join('');
}

const handler: HookHandler = async (ctx) => {
  const state = loadState();

  // Track trade closures
  if (ctx.event === 'trade:closed' && ctx.data) {
    const trade: SessionTrade = {
      symbol: ctx.data.symbol || 'UNKNOWN',
      pnl: ctx.data.pnl || 0,
      isWin: (ctx.data.pnl || 0) > 0,
      timestamp: ctx.timestamp.toISOString()
    };

    state.trades.push(trade);
    
    // Update peak/trough
    const totalPnL = state.trades.reduce((sum, t) => sum + t.pnl, 0);
    state.peakPnL = Math.max(state.peakPnL, totalPnL);
    state.troughPnL = Math.min(state.troughPnL, totalPnL);
    
    saveState(state);
    
    ctx.messages.push(`📊 Trade logged: ${trade.symbol} ${formatCurrency(trade.pnl)} | Session: ${formatCurrency(totalPnL)}`);
    return;
  }

  // Generate summary on session end
  if (ctx.event === 'session:end') {
    if (state.trades.length === 0) {
      ctx.messages.push('📋 **Session Summary**: No trades today');
      return;
    }

    const wins = state.trades.filter(t => t.isWin);
    const losses = state.trades.filter(t => !t.isWin);
    const totalPnL = state.trades.reduce((sum, t) => sum + t.pnl, 0);
    
    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    
    const winRate = (wins.length / state.trades.length) * 100;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const maxDrawdown = state.peakPnL - state.troughPnL;
    
    const grade = getGrade(winRate, profitFactor);
    
    // Build summary
    let summary = `📋 **Trading Session Summary** ${grade.emoji}\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `📅 Date: ${state.date}\n`;
    summary += `🎯 Grade: **${grade.grade}**\n\n`;
    
    summary += `💰 **P&L Performance**\n`;
    summary += `• Net P&L: **${formatCurrency(totalPnL)}**\n`;
    summary += `• Peak: ${formatCurrency(state.peakPnL)} | Trough: ${formatCurrency(state.troughPnL)}\n`;
    summary += `• Max Drawdown: ${formatCurrency(maxDrawdown)}\n\n`;
    
    summary += `📊 **Statistics**\n`;
    summary += `• Trades: ${state.trades.length} (${Math.round(winRate)}% win rate)\n`;
    summary += `• Profit Factor: ${profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}\n`;
    summary += `• Avg Win: ${formatCurrency(avgWin)} | Avg Loss: ${formatCurrency(avgLoss)}\n`;

    const sparkline = generateSparkline(state.trades);
    if (sparkline) {
      summary += `\n📈 **Equity Curve**\n${sparkline}`;
    }

    // Best/worst trades
    const sorted = [...state.trades].sort((a, b) => b.pnl - a.pnl);
    if (sorted.length > 0) {
      summary += `\n\n🏆 **Best**: ${sorted[0].symbol} ${formatCurrency(sorted[0].pnl)}`;
      if (sorted.length > 1 && sorted[sorted.length - 1].pnl < 0) {
        summary += `\n💔 **Worst**: ${sorted[sorted.length - 1].symbol} ${formatCurrency(sorted[sorted.length - 1].pnl)}`;
      }
    }

    ctx.messages.push(summary);
  }
};

export default handler;
