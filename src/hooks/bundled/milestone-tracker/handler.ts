/**
 * Milestone Tracker Hook
 * 
 * Tracks and celebrates significant P&L milestones:
 * - First profitable trade
 * - 10/50/100 winning trades
 * - $100/$1K/$10K profit milestones
 * - Win streak achievements
 * 
 * @event trade_closed
 * @event daily_summary
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface MilestoneState {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  currentStreak: number;
  longestStreak: number;
  achievedMilestones: string[];
  lastUpdated: number;
}

interface TradeData {
  symbol: string;
  pnl: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

// Milestone definitions
const PROFIT_MILESTONES = [100, 500, 1000, 5000, 10000, 50000, 100000];
const TRADE_MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1000];
const STREAK_MILESTONES = [3, 5, 7, 10, 15, 20];

const STATE_FILE = path.join(os.homedir(), '.kit', 'milestones.json');

function loadState(): MilestoneState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {
    // Ignore errors, return default state
  }
  return {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalProfit: 0,
    currentStreak: 0,
    longestStreak: 0,
    achievedMilestones: [],
    lastUpdated: Date.now(),
  };
}

function saveState(state: MilestoneState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[milestone-tracker] Failed to save state:', e);
  }
}

function checkMilestones(state: MilestoneState): string[] {
  const newMilestones: string[] = [];
  
  // Check profit milestones
  for (const milestone of PROFIT_MILESTONES) {
    const key = `profit_${milestone}`;
    if (state.totalProfit >= milestone && !state.achievedMilestones.includes(key)) {
      newMilestones.push(key);
      state.achievedMilestones.push(key);
    }
  }
  
  // Check winning trade milestones
  for (const milestone of TRADE_MILESTONES) {
    const key = `wins_${milestone}`;
    if (state.winningTrades >= milestone && !state.achievedMilestones.includes(key)) {
      newMilestones.push(key);
      state.achievedMilestones.push(key);
    }
  }
  
  // Check streak milestones
  for (const milestone of STREAK_MILESTONES) {
    const key = `streak_${milestone}`;
    if (state.currentStreak >= milestone && !state.achievedMilestones.includes(key)) {
      newMilestones.push(key);
      state.achievedMilestones.push(key);
    }
  }
  
  // First profitable trade
  if (state.winningTrades === 1 && !state.achievedMilestones.includes('first_win')) {
    newMilestones.push('first_win');
    state.achievedMilestones.push('first_win');
  }
  
  return newMilestones;
}

function formatMilestone(milestone: string): string {
  if (milestone === 'first_win') {
    return '🎉 First winning trade! Your K.I.T. journey begins!';
  }
  
  if (milestone.startsWith('profit_')) {
    const amount = parseInt(milestone.replace('profit_', ''));
    const formatted = amount >= 1000 ? `$${amount / 1000}K` : `$${amount}`;
    return `💰 Profit milestone reached: ${formatted} total profit!`;
  }
  
  if (milestone.startsWith('wins_')) {
    const count = parseInt(milestone.replace('wins_', ''));
    return `🏆 ${count} winning trades achieved!`;
  }
  
  if (milestone.startsWith('streak_')) {
    const count = parseInt(milestone.replace('streak_', ''));
    return `🔥 ${count}-trade winning streak! You're on fire!`;
  }
  
  return `✨ Milestone achieved: ${milestone}`;
}

export async function handler(event: string, data: any): Promise<void> {
  if (event !== 'trade_closed') return;
  
  const trade = data as TradeData;
  if (!trade || typeof trade.pnl !== 'number') return;
  
  const state = loadState();
  
  // Update stats
  state.totalTrades++;
  state.totalProfit += trade.pnl;
  
  if (trade.pnl > 0) {
    state.winningTrades++;
    state.currentStreak++;
    if (state.currentStreak > state.longestStreak) {
      state.longestStreak = state.currentStreak;
    }
  } else {
    state.losingTrades++;
    state.currentStreak = 0;
  }
  
  state.lastUpdated = Date.now();
  
  // Check for new milestones
  const newMilestones = checkMilestones(state);
  
  // Save state
  saveState(state);
  
  // Log new milestones
  for (const milestone of newMilestones) {
    const message = formatMilestone(milestone);
    console.log(`[milestone-tracker] ${message}`);
    
    // Could integrate with notification system here
    // e.g., send Telegram message, push notification, etc.
  }
}

export const events = ['trade_closed'];
export const name = 'milestone-tracker';
export const description = 'Tracks and celebrates P&L milestones and achievements';
