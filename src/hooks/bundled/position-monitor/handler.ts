/**
 * Position Monitor Hook Handler
 * Monitors open positions for P&L changes, SL/TP proximity, and duration
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler } from '../../types.js';

interface Position {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  size: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: string;
  pnl: number;
  pnlPercent: number;
}

interface PositionState {
  lastPnl: number;
  lastCheck: string;
  alerts: string[];
}

const config = {
  slProximityPct: 10,      // Alert when within 10% of SL
  tpProximityPct: 10,      // Alert when within 10% of TP
  maxHoldHours: 4,         // Warn after 4 hours
  drawdownAlertPct: 5,     // Alert on 5% drawdown in 5 mins
};

const handler: HookHandler = async (ctx) => {
  const kitHome = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.kit'
  );
  const statePath = path.join(kitHome, 'state', 'positions.json');
  const logPath = path.join(kitHome, 'logs', 'position-monitor.log');
  
  // Ensure directories exist
  for (const p of [path.dirname(statePath), path.dirname(logPath)]) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }
  
  // Load position state
  let state: Record<string, PositionState> = {};
  if (fs.existsSync(statePath)) {
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch {}
  }
  
  // Get positions from context
  const positions: Position[] = ctx.data?.positions || [];
  const alerts: string[] = [];
  const now = new Date();
  
  for (const pos of positions) {
    const posState = state[pos.id] || { lastPnl: pos.pnl, lastCheck: now.toISOString(), alerts: [] };
    const openedAt = new Date(pos.openedAt);
    const holdHours = (now.getTime() - openedAt.getTime()) / (1000 * 60 * 60);
    
    // Check SL proximity
    if (pos.stopLoss && pos.currentPrice) {
      const distanceToSL = Math.abs(pos.currentPrice - pos.stopLoss) / pos.currentPrice * 100;
      if (distanceToSL <= config.slProximityPct && !posState.alerts.includes('sl')) {
        alerts.push(`🔴 ${pos.symbol}: Approaching stop loss (${distanceToSL.toFixed(1)}% away)`);
        posState.alerts.push('sl');
      }
    }
    
    // Check TP proximity
    if (pos.takeProfit && pos.currentPrice) {
      const distanceToTP = Math.abs(pos.takeProfit - pos.currentPrice) / pos.currentPrice * 100;
      if (distanceToTP <= config.tpProximityPct && !posState.alerts.includes('tp')) {
        alerts.push(`🟢 ${pos.symbol}: Approaching take profit (${distanceToTP.toFixed(1)}% away)`);
        posState.alerts.push('tp');
      }
    }
    
    // Check hold duration
    if (holdHours >= config.maxHoldHours && !posState.alerts.includes('duration')) {
      alerts.push(`⏰ ${pos.symbol}: Position held for ${holdHours.toFixed(1)} hours (P&L: ${pos.pnlPercent.toFixed(2)}%)`);
      posState.alerts.push('duration');
    }
    
    // Check rapid drawdown
    const pnlChange = pos.pnl - posState.lastPnl;
    const pnlChangePercent = Math.abs(pnlChange / (posState.lastPnl || 1)) * 100;
    if (pnlChange < 0 && pnlChangePercent >= config.drawdownAlertPct) {
      alerts.push(`📉 ${pos.symbol}: Rapid drawdown detected (-${pnlChangePercent.toFixed(1)}% in 5 mins)`);
    }
    
    // Update state
    state[pos.id] = {
      lastPnl: pos.pnl,
      lastCheck: now.toISOString(),
      alerts: posState.alerts,
    };
  }
  
  // Clean up closed positions from state
  const openIds = new Set(positions.map(p => p.id));
  for (const id of Object.keys(state)) {
    if (!openIds.has(id)) delete state[id];
  }
  
  // Save state
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  
  // Log and push alerts
  if (alerts.length > 0) {
    const logEntry = {
      timestamp: now.toISOString(),
      alerts,
      positionCount: positions.length,
    };
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    
    if (ctx.messages) {
      ctx.messages.push(`👁️ Position Monitor:\n${alerts.map(a => `   ${a}`).join('\n')}`);
    }
  }
};

export default handler;
