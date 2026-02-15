/**
 * Drawdown Alert Hook
 * 
 * Monitors portfolio equity and alerts on dangerous drawdowns:
 * - Warning at 5% drawdown
 * - Critical at 10% drawdown  
 * - Emergency at 15% drawdown (can auto-pause trading)
 * 
 * @event equity_update
 * @event trade_closed
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface DrawdownState {
  peakEquity: number;
  currentEquity: number;
  currentDrawdown: number;
  maxDrawdown: number;
  lastAlert: string | null;
  alertCooldown: number;
  emergencyTriggered: boolean;
  lastUpdated: number;
}

interface EquityUpdate {
  equity: number;
  timestamp: number;
  source?: string;
}

// Alert thresholds (percentages)
const THRESHOLDS = {
  warning: 5,      // Yellow alert
  critical: 10,    // Red alert
  emergency: 15,   // Emergency - consider pausing
};

// Cooldown between same-level alerts (ms)
const ALERT_COOLDOWN = 30 * 60 * 1000; // 30 minutes

const STATE_FILE = path.join(os.homedir(), '.kit', 'drawdown-state.json');

function loadState(): DrawdownState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {
    // Ignore errors
  }
  return {
    peakEquity: 0,
    currentEquity: 0,
    currentDrawdown: 0,
    maxDrawdown: 0,
    lastAlert: null,
    alertCooldown: 0,
    emergencyTriggered: false,
    lastUpdated: Date.now(),
  };
}

function saveState(state: DrawdownState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[drawdown-alert] Failed to save state:', e);
  }
}

function getAlertLevel(drawdown: number): string | null {
  if (drawdown >= THRESHOLDS.emergency) return 'emergency';
  if (drawdown >= THRESHOLDS.critical) return 'critical';
  if (drawdown >= THRESHOLDS.warning) return 'warning';
  return null;
}

function formatAlert(level: string, drawdown: number, equity: number, peak: number): string {
  const dd = drawdown.toFixed(2);
  const loss = (peak - equity).toFixed(2);
  
  switch (level) {
    case 'emergency':
      return `🚨 EMERGENCY: ${dd}% drawdown! Lost $${loss} from peak of $${peak.toFixed(2)}. Consider pausing trading!`;
    case 'critical':
      return `❌ CRITICAL: ${dd}% drawdown! Lost $${loss} from peak. Review open positions.`;
    case 'warning':
      return `⚠️ WARNING: ${dd}% drawdown. Current equity: $${equity.toFixed(2)}, Peak: $${peak.toFixed(2)}`;
    default:
      return `📊 Drawdown update: ${dd}%`;
  }
}

function shouldAlert(state: DrawdownState, level: string): boolean {
  const now = Date.now();
  
  // Always alert on emergency
  if (level === 'emergency' && !state.emergencyTriggered) {
    return true;
  }
  
  // Alert if level increased
  const levels = ['warning', 'critical', 'emergency'];
  const currentIndex = state.lastAlert ? levels.indexOf(state.lastAlert) : -1;
  const newIndex = levels.indexOf(level);
  
  if (newIndex > currentIndex) {
    return true;
  }
  
  // Check cooldown for same-level alerts
  if (now - state.alertCooldown > ALERT_COOLDOWN) {
    return true;
  }
  
  return false;
}

export async function handler(event: string, data: any): Promise<void> {
  if (event !== 'equity_update' && event !== 'trade_closed') return;
  
  let equity: number;
  
  if (event === 'equity_update') {
    const update = data as EquityUpdate;
    if (!update || typeof update.equity !== 'number') return;
    equity = update.equity;
  } else {
    // trade_closed event - extract equity from portfolio
    if (data?.portfolio?.equity) {
      equity = data.portfolio.equity;
    } else {
      return; // No equity info available
    }
  }
  
  const state = loadState();
  const now = Date.now();
  
  // Initialize peak if needed
  if (state.peakEquity === 0) {
    state.peakEquity = equity;
  }
  
  // Update peak if new high
  if (equity > state.peakEquity) {
    state.peakEquity = equity;
    state.emergencyTriggered = false; // Reset emergency flag on new peak
  }
  
  // Calculate drawdown
  state.currentEquity = equity;
  state.currentDrawdown = ((state.peakEquity - equity) / state.peakEquity) * 100;
  
  // Track max drawdown
  if (state.currentDrawdown > state.maxDrawdown) {
    state.maxDrawdown = state.currentDrawdown;
  }
  
  state.lastUpdated = now;
  
  // Check for alerts
  const level = getAlertLevel(state.currentDrawdown);
  
  if (level && shouldAlert(state, level)) {
    const message = formatAlert(level, state.currentDrawdown, equity, state.peakEquity);
    console.log(`[drawdown-alert] ${message}`);
    
    state.lastAlert = level;
    state.alertCooldown = now;
    
    if (level === 'emergency') {
      state.emergencyTriggered = true;
      // Could trigger auto-pause here
      console.log('[drawdown-alert] 🛑 Consider running: kit trading pause');
    }
  }
  
  // Recovery notification
  if (state.lastAlert && !level) {
    console.log(`[drawdown-alert] ✅ Drawdown recovered to ${state.currentDrawdown.toFixed(2)}%`);
    state.lastAlert = null;
  }
  
  saveState(state);
}

export const events = ['equity_update', 'trade_closed'];
export const name = 'drawdown-alert';
export const description = 'Monitors portfolio drawdown and sends alerts at dangerous levels';
