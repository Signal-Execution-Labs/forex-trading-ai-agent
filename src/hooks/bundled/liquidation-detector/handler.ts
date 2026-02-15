/**
 * Liquidation Detector Hook
 * 
 * Monitors leveraged positions for liquidation risk:
 * - Warning at 80% distance to liquidation price
 * - Critical at 90% distance to liquidation price
 * - Emergency at 95% - suggests reducing position
 * 
 * @event position_update
 * @event price_tick
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  leverage: number;
  liquidationPrice: number;
  margin: number;
}

interface LiquidationState {
  positions: Record<string, Position>;
  alerts: Record<string, { level: string; timestamp: number }>;
  lastUpdated: number;
}

// Alert thresholds (percentage to liquidation)
const THRESHOLDS = {
  warning: 80,     // 80% of the way to liquidation
  critical: 90,    // 90% of the way
  emergency: 95,   // 95% - very close
};

// Cooldown between alerts for same position (ms)
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes

const STATE_FILE = path.join(os.homedir(), '.kit', 'liquidation-state.json');

function loadState(): LiquidationState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return {
    positions: {},
    alerts: {},
    lastUpdated: Date.now(),
  };
}

function saveState(state: LiquidationState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[liquidation-detector] Failed to save state:', e);
  }
}

function calculateDistanceToLiquidation(
  currentPrice: number,
  entryPrice: number,
  liquidationPrice: number,
  side: 'long' | 'short'
): number {
  // Returns 0-100 where 100 = at liquidation price
  const totalDistance = Math.abs(entryPrice - liquidationPrice);
  const currentDistance = side === 'long' 
    ? entryPrice - currentPrice
    : currentPrice - entryPrice;
  
  if (totalDistance === 0) return 0;
  
  const distancePercent = (currentDistance / totalDistance) * 100;
  return Math.max(0, Math.min(100, distancePercent));
}

function getAlertLevel(distancePercent: number): string | null {
  if (distancePercent >= THRESHOLDS.emergency) return 'emergency';
  if (distancePercent >= THRESHOLDS.critical) return 'critical';
  if (distancePercent >= THRESHOLDS.warning) return 'warning';
  return null;
}

function formatAlert(
  level: string,
  position: Position,
  currentPrice: number,
  distance: number
): string {
  const direction = position.side === 'long' ? '📈' : '📉';
  const priceToLiq = Math.abs(currentPrice - position.liquidationPrice);
  
  switch (level) {
    case 'emergency':
      return `💀 EMERGENCY: ${position.symbol} ${direction} ${position.leverage}x is ${distance.toFixed(1)}% to liquidation! Current: $${currentPrice.toFixed(2)}, Liq: $${position.liquidationPrice.toFixed(2)}. REDUCE NOW!`;
    case 'critical':
      return `⚠️ CRITICAL: ${position.symbol} ${direction} ${position.leverage}x at ${distance.toFixed(1)}% to liq. $${priceToLiq.toFixed(2)} until liquidation.`;
    case 'warning':
      return `⚡ WARNING: ${position.symbol} ${direction} ${position.leverage}x approaching liquidation (${distance.toFixed(1)}%).`;
    default:
      return `📊 ${position.symbol} liquidation check: ${distance.toFixed(1)}%`;
  }
}

function shouldAlert(
  state: LiquidationState,
  positionId: string,
  level: string
): boolean {
  const now = Date.now();
  const existingAlert = state.alerts[positionId];
  
  if (!existingAlert) return true;
  
  // Always alert on emergency
  if (level === 'emergency') return true;
  
  // Alert if level increased
  const levels = ['warning', 'critical', 'emergency'];
  const currentIndex = levels.indexOf(existingAlert.level);
  const newIndex = levels.indexOf(level);
  
  if (newIndex > currentIndex) return true;
  
  // Check cooldown
  if (now - existingAlert.timestamp > ALERT_COOLDOWN) return true;
  
  return false;
}

export async function handler(event: string, data: any): Promise<void> {
  if (event !== 'position_update' && event !== 'price_tick') return;
  
  const state = loadState();
  const now = Date.now();
  
  if (event === 'position_update') {
    // Update tracked position
    const position = data as Position;
    if (!position?.id || position.leverage <= 1) return;
    
    if (position.size === 0) {
      // Position closed
      delete state.positions[position.id];
      delete state.alerts[position.id];
    } else {
      state.positions[position.id] = position;
    }
    
    state.lastUpdated = now;
    saveState(state);
    return;
  }
  
  // price_tick event
  const { symbol, price } = data || {};
  if (!symbol || typeof price !== 'number') return;
  
  // Check all positions for this symbol
  for (const [posId, position] of Object.entries(state.positions)) {
    if (position.symbol !== symbol) continue;
    
    const distance = calculateDistanceToLiquidation(
      price,
      position.entryPrice,
      position.liquidationPrice,
      position.side
    );
    
    const level = getAlertLevel(distance);
    
    if (level && shouldAlert(state, posId, level)) {
      const message = formatAlert(level, position, price, distance);
      console.log(`[liquidation-detector] ${message}`);
      
      state.alerts[posId] = { level, timestamp: now };
      
      if (level === 'emergency') {
        console.log('[liquidation-detector] 🛑 Consider running: kit position reduce');
      }
    }
    
    // Clear alert if recovered
    if (!level && state.alerts[posId]) {
      console.log(`[liquidation-detector] ✅ ${position.symbol} liquidation risk cleared`);
      delete state.alerts[posId];
    }
  }
  
  state.lastUpdated = now;
  saveState(state);
}

export const events = ['position_update', 'price_tick'];
export const name = 'liquidation-detector';
export const description = 'Monitors leveraged positions for liquidation risk';
