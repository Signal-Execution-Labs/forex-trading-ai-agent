/**
 * Daily P&L Hook Handler
 * Summarizes daily trading performance at market close
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler } from '../../types.js';

interface Trade {
  pnl: number;
  symbol: string;
  direction: 'long' | 'short';
  timestamp: string;
}

const handler: HookHandler = async (ctx) => {
  const kitHome = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.kit'
  );
  const logPath = path.join(kitHome, 'logs', 'daily-pnl.log');
  const tradesLogPath = path.join(kitHome, 'logs', 'trades.log');
  
  // Ensure log directory exists
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Read today's trades from trades.log
  const today = new Date().toISOString().split('T')[0];
  let trades: Trade[] = [];
  
  if (fs.existsSync(tradesLogPath)) {
    const lines = fs.readFileSync(tradesLogPath, 'utf8').split('\n').filter(Boolean);
    trades = lines
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter((t): t is Trade => t && t.timestamp?.startsWith(today) && typeof t.pnl === 'number');
  }
  
  // Calculate stats
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const winRate = trades.length > 0 ? ((wins.length / trades.length) * 100).toFixed(1) : '0';
  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl)) : 0;
  
  const summary = {
    date: today,
    pnl: Math.round(totalPnl * 100) / 100,
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: `${winRate}%`,
    bestTrade: Math.round(bestTrade * 100) / 100,
    worstTrade: Math.round(worstTrade * 100) / 100,
    timestamp: ctx.timestamp.toISOString(),
  };
  
  // Log summary
  fs.appendFileSync(logPath, JSON.stringify(summary) + '\n');
  
  // Push message for notification
  if (ctx.messages && trades.length > 0) {
    const emoji = totalPnl >= 0 ? '📈' : '📉';
    ctx.messages.push(
      `${emoji} Daily P&L Summary (${today}):\n` +
      `   P&L: $${summary.pnl}\n` +
      `   Trades: ${summary.trades} (${summary.wins}W/${summary.losses}L)\n` +
      `   Win Rate: ${summary.winRate}\n` +
      `   Best: $${summary.bestTrade} | Worst: $${summary.worstTrade}`
    );
  }
};

export default handler;
