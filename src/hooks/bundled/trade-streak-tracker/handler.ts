/**
 * Trade Streak Tracker Hook
 * 
 * Monitors trading performance patterns and alerts on significant streaks.
 */

import type { HookHandler, HookContext } from '../../types.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface StreakConfig {
  winStreakAlert: number;
  loseStreakWarn: number;
  loseStreakPause: number;
  trackBestStreaks: boolean;
  notifications?: {
    telegram?: boolean;
    dashboard?: boolean;
  };
}

interface StreakState {
  currentStreak: number; // Positive = wins, negative = losses
  streakStart: string;
  bestWinStreak: number;
  bestWinStreakDate: string;
  worstLoseStreak: number;
  worstLoseStreakDate: string;
  pausedUntil?: string;
  totalTrades: number;
  history: Array<{
    date: string;
    streak: number;
    type: 'win' | 'lose';
  }>;
}

interface TradeResult {
  symbol: string;
  pnl: number;
  isWin: boolean;
  timestamp: number;
}

const defaultConfig: StreakConfig = {
  winStreakAlert: 5,
  loseStreakWarn: 3,
  loseStreakPause: 5,
  trackBestStreaks: true
};

const tradeStreakHandler: HookHandler = async (context: HookContext) => {
  // Handle trade completion events
  if (context.event !== 'trade:closed') {
    return;
  }
  
  try {
    const workspaceDir = context.context.workspaceDir || join(process.cwd(), 'workspace');
    const configPath = join(workspaceDir, 'streak-config.json');
    const statePath = join(workspaceDir, 'streak-state.json');
    
    // Load config
    let config: StreakConfig;
    try {
      const content = await readFile(configPath, 'utf-8');
      config = { ...defaultConfig, ...JSON.parse(content) };
    } catch {
      config = defaultConfig;
    }
    
    // Load current state
    let state: StreakState;
    try {
      const content = await readFile(statePath, 'utf-8');
      state = JSON.parse(content);
    } catch {
      state = {
        currentStreak: 0,
        streakStart: new Date().toISOString(),
        bestWinStreak: 0,
        bestWinStreakDate: '',
        worstLoseStreak: 0,
        worstLoseStreakDate: '',
        totalTrades: 0,
        history: []
      };
    }
    
    // Get trade result from event
    const tradeData = context.data as TradeResult | undefined;
    if (!tradeData || typeof tradeData.pnl !== 'number') {
      return;
    }
    
    const isWin = tradeData.pnl > 0;
    const now = new Date();
    const dateStr = now.toISOString();
    
    // Check if trading is paused
    if (state.pausedUntil && new Date(state.pausedUntil) > now) {
      const message = `⏸️ Trading paused due to losing streak. Resume at ${state.pausedUntil}`;
      console.log(`[trade-streak-tracker] ${message}`);
      context.messages.push(message);
      return;
    }
    
    // Update streak
    if (isWin) {
      if (state.currentStreak >= 0) {
        state.currentStreak++;
      } else {
        // Streak broken, reset
        state.currentStreak = 1;
        state.streakStart = dateStr;
      }
    } else {
      if (state.currentStreak <= 0) {
        state.currentStreak--;
      } else {
        // Streak broken, reset
        state.currentStreak = -1;
        state.streakStart = dateStr;
      }
    }
    
    state.totalTrades++;
    
    const messages: string[] = [];
    
    // Check for new records
    if (config.trackBestStreaks) {
      if (state.currentStreak > state.bestWinStreak) {
        const oldBest = state.bestWinStreak;
        state.bestWinStreak = state.currentStreak;
        state.bestWinStreakDate = dateStr;
        
        if (oldBest > 0) {
          messages.push(`🏆 NEW RECORD! Win streak: ${state.currentStreak}! Previous best: ${oldBest}`);
        }
      }
      
      if (state.currentStreak < -state.worstLoseStreak) {
        state.worstLoseStreak = Math.abs(state.currentStreak);
        state.worstLoseStreakDate = dateStr;
      }
    }
    
    // Alert on win streaks
    if (state.currentStreak === config.winStreakAlert) {
      messages.push(`🎉 ${state.currentStreak} wins in a row! 🔥 Stay disciplined, don't get overconfident.`);
    } else if (state.currentStreak > config.winStreakAlert && state.currentStreak % 5 === 0) {
      messages.push(`🔥 Incredible! ${state.currentStreak} win streak! Keep your risk management tight.`);
    }
    
    // Warn on losing streaks
    const loseStreak = Math.abs(state.currentStreak);
    if (state.currentStreak < 0) {
      if (loseStreak === config.loseStreakWarn) {
        messages.push(`⚠️ ${loseStreak} losses in a row. Consider taking a short break to reset mentally.`);
      } else if (loseStreak === config.loseStreakPause) {
        // Auto-pause trading
        const pauseMinutes = 60;
        state.pausedUntil = new Date(now.getTime() + pauseMinutes * 60000).toISOString();
        messages.push(`🛑 ${loseStreak} consecutive losses. Trading auto-paused for ${pauseMinutes} minutes to prevent tilt.`);
      }
    }
    
    // Track history (keep last 100 entries)
    state.history.push({
      date: dateStr,
      streak: state.currentStreak,
      type: isWin ? 'win' : 'lose'
    });
    
    if (state.history.length > 100) {
      state.history = state.history.slice(-100);
    }
    
    // Save state
    await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
    
    // Send messages
    for (const message of messages) {
      console.log(`[trade-streak-tracker] ${message}`);
      context.messages.push(message);
    }
    
  } catch (error) {
    console.error('[trade-streak-tracker] Error:', error);
  }
};

export default tradeStreakHandler;
