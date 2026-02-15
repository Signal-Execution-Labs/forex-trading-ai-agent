/**
 * Session P&L Reset Hook
 * 
 * Automatically resets daily P&L tracking at market open times.
 */

import type { HookHandler, HookContext } from '../../types.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

interface ResetTime {
  hour: number;
  minute: number;
  timezone: string;
  label: string;
}

interface ResetConfig {
  resetTimes: ResetTime[];
  archivePath?: string;
  retainDays?: number;
}

interface PnLArchive {
  date: string;
  session: string;
  closingPnL: number;
  trades: number;
  winRate: number;
  timestamp: number;
}

interface TradingBrain {
  sessionPnL?: number;
  sessionTrades?: number;
  sessionWins?: number;
  [key: string]: any;
}

// Track last reset to avoid duplicate resets within the same minute
const lastResetTimes: Map<string, number> = new Map();

const sessionPnlResetHandler: HookHandler = async (context: HookContext) => {
  // Only handle market tick events for periodic checks
  if (context.event !== 'market:tick' && context.event !== 'session:start') {
    return;
  }
  
  try {
    const workspaceDir = context.context.workspaceDir || join(process.cwd(), 'workspace');
    const configPath = join(workspaceDir, 'pnl-reset.json');
    
    let config: ResetConfig;
    try {
      const content = await readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      // Use default config if none exists
      config = {
        resetTimes: [
          { hour: 0, minute: 0, timezone: 'UTC', label: 'Daily Reset' }
        ]
      };
    }
    
    if (!config.resetTimes || config.resetTimes.length === 0) {
      return;
    }
    
    const now = new Date();
    
    for (const resetTime of config.resetTimes) {
      // Get current time in the specified timezone
      const timeInZone = new Date(now.toLocaleString('en-US', { timeZone: resetTime.timezone }));
      const currentHour = timeInZone.getHours();
      const currentMinute = timeInZone.getMinutes();
      
      // Check if it's time to reset
      if (currentHour === resetTime.hour && currentMinute === resetTime.minute) {
        const resetKey = `${resetTime.label}-${timeInZone.toDateString()}`;
        const lastReset = lastResetTimes.get(resetKey);
        
        // Only reset once per minute window
        if (lastReset && (now.getTime() - lastReset) < 60000) {
          continue;
        }
        
        lastResetTimes.set(resetKey, now.getTime());
        
        // Read current trading brain state
        const brainPath = join(workspaceDir, 'trading_brain.json');
        let brain: TradingBrain = {};
        
        try {
          const brainContent = await readFile(brainPath, 'utf-8');
          brain = JSON.parse(brainContent);
        } catch {
          // No existing brain state
        }
        
        // Archive current P&L
        const archivePath = config.archivePath || join(workspaceDir, 'pnl-history');
        const dateStr = now.toISOString().split('T')[0];
        const archiveFile = join(archivePath, `${dateStr}-${resetTime.label.replace(/\s+/g, '-')}.json`);
        
        const archive: PnLArchive = {
          date: dateStr,
          session: resetTime.label,
          closingPnL: brain.sessionPnL || 0,
          trades: brain.sessionTrades || 0,
          winRate: brain.sessionTrades && brain.sessionTrades > 0 
            ? (brain.sessionWins || 0) / brain.sessionTrades 
            : 0,
          timestamp: now.getTime()
        };
        
        // Ensure archive directory exists
        await mkdir(dirname(archiveFile), { recursive: true });
        await writeFile(archiveFile, JSON.stringify(archive, null, 2), 'utf-8');
        
        // Reset session P&L counters
        brain.sessionPnL = 0;
        brain.sessionTrades = 0;
        brain.sessionWins = 0;
        brain.lastPnLReset = now.toISOString();
        brain.lastPnLResetSession = resetTime.label;
        
        await writeFile(brainPath, JSON.stringify(brain, null, 2), 'utf-8');
        
        const message = `🔄 Session P&L reset for ${resetTime.label}. Previous: $${archive.closingPnL.toFixed(2)} (${archive.trades} trades, ${(archive.winRate * 100).toFixed(1)}% win rate)`;
        
        console.log(`[session-pnl-reset] ${message}`);
        context.messages.push(message);
      }
    }
    
  } catch (error) {
    console.error('[session-pnl-reset] Error:', error);
  }
};

export default sessionPnlResetHandler;
