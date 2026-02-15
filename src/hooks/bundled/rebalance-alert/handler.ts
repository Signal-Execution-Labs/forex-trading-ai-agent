/**
 * Rebalance Alert Hook
 * 
 * Monitors portfolio allocations and alerts on drift:
 * - Warning at 5% drift from target
 * - Critical at 10% drift
 * - Suggests rebalancing trades
 * 
 * @event portfolio_update
 * @event price_tick
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Holding {
  symbol: string;
  quantity: number;
  value: number;
  allocation: number; // Percentage
}

interface TargetAllocation {
  symbol: string;
  target: number; // Target percentage
  tolerance: number; // Allowed drift percentage
}

interface RebalanceState {
  holdings: Holding[];
  totalValue: number;
  drifts: Record<string, number>;
  lastAlert: number;
  lastUpdated: number;
}

// Default thresholds
const THRESHOLDS = {
  warning: 5,   // 5% drift
  critical: 10, // 10% drift
};

const ALERT_COOLDOWN = 60 * 60 * 1000; // 1 hour

const STATE_FILE = path.join(os.homedir(), '.kit', 'rebalance-state.json');
const TARGETS_FILE = path.join(os.homedir(), '.kit', 'rebalance-targets.json');

function loadState(): RebalanceState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {
    // Ignore
  }
  return {
    holdings: [],
    totalValue: 0,
    drifts: {},
    lastAlert: 0,
    lastUpdated: Date.now(),
  };
}

function saveState(state: RebalanceState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[rebalance-alert] Failed to save state:', e);
  }
}

function loadTargets(): TargetAllocation[] {
  try {
    if (fs.existsSync(TARGETS_FILE)) {
      return JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf-8'));
    }
  } catch {
    // Ignore
  }
  // Default balanced portfolio
  return [
    { symbol: 'BTC', target: 40, tolerance: 5 },
    { symbol: 'ETH', target: 30, tolerance: 5 },
    { symbol: 'USDT', target: 30, tolerance: 10 },
  ];
}

function calculateDrifts(
  holdings: Holding[],
  targets: TargetAllocation[]
): Record<string, { current: number; target: number; drift: number }> {
  const result: Record<string, { current: number; target: number; drift: number }> = {};
  
  for (const target of targets) {
    const holding = holdings.find(h => h.symbol === target.symbol);
    const current = holding?.allocation ?? 0;
    const drift = current - target.target;
    
    result[target.symbol] = {
      current,
      target: target.target,
      drift,
    };
  }
  
  return result;
}

function formatRebalanceAlert(
  drifts: Record<string, { current: number; target: number; drift: number }>,
  totalValue: number
): string {
  const lines: string[] = ['⚖️ Portfolio Rebalance Needed:'];
  
  for (const [symbol, data] of Object.entries(drifts)) {
    const absDrift = Math.abs(data.drift);
    if (absDrift >= THRESHOLDS.warning) {
      const icon = data.drift > 0 ? '📈' : '📉';
      const action = data.drift > 0 ? 'Overweight' : 'Underweight';
      const tradeValue = Math.abs(data.drift / 100 * totalValue);
      lines.push(`  ${icon} ${symbol}: ${data.current.toFixed(1)}% (target: ${data.target}%) - ${action} by $${tradeValue.toFixed(0)}`);
    }
  }
  
  return lines.join('\n');
}

export async function handler(event: string, data: any): Promise<void> {
  if (event !== 'portfolio_update' && event !== 'price_tick') return;
  
  const state = loadState();
  const targets = loadTargets();
  const now = Date.now();
  
  if (event === 'portfolio_update') {
    const { holdings, totalValue } = data || {};
    if (!Array.isArray(holdings)) return;
    
    state.holdings = holdings;
    state.totalValue = totalValue || holdings.reduce((sum: number, h: Holding) => sum + h.value, 0);
    state.lastUpdated = now;
  }
  
  if (state.holdings.length === 0) {
    saveState(state);
    return;
  }
  
  // Calculate drifts
  const drifts = calculateDrifts(state.holdings, targets);
  
  // Check for significant drifts
  let maxDrift = 0;
  let criticalDrifts = 0;
  
  for (const [symbol, data] of Object.entries(drifts)) {
    const absDrift = Math.abs(data.drift);
    state.drifts[symbol] = data.drift;
    
    if (absDrift > maxDrift) maxDrift = absDrift;
    if (absDrift >= THRESHOLDS.critical) criticalDrifts++;
  }
  
  // Alert logic
  if (maxDrift >= THRESHOLDS.warning && now - state.lastAlert > ALERT_COOLDOWN) {
    const level = maxDrift >= THRESHOLDS.critical ? '❌ CRITICAL' : '⚠️ WARNING';
    console.log(`[rebalance-alert] ${level}: Max drift ${maxDrift.toFixed(1)}%`);
    console.log(formatRebalanceAlert(drifts, state.totalValue));
    
    if (criticalDrifts > 0) {
      console.log('[rebalance-alert] 💡 Consider running: kit portfolio rebalance');
    }
    
    state.lastAlert = now;
  }
  
  state.lastUpdated = now;
  saveState(state);
}

export const events = ['portfolio_update', 'price_tick'];
export const name = 'rebalance-alert';
export const description = 'Alerts when portfolio allocations drift from targets';
