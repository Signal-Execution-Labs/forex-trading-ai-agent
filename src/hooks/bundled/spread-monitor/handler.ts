/**
 * Spread Monitor Hook
 * 
 * Monitors bid-ask spreads for watchlist assets.
 * Tracks spread patterns by time and exchange for execution optimization.
 */

import type { HookHandler, HookContext } from '../../types.js';
import * as fs from 'fs';
import * as path from 'path';

interface SpreadSnapshot {
  timestamp: string;
  symbol: string;
  exchange: string;
  bid: number;
  ask: number;
  spread: number;
  spreadPct: number;
  spreadBps: number;
  midPrice: number;
}

interface SpreadStats {
  symbol: string;
  exchange: string;
  avgSpread: number;
  avgSpreadPct: number;
  minSpread: number;
  maxSpread: number;
  stdDev: number;
  samples: number;
  byHour: Record<number, { avgSpread: number; count: number }>;
}

const handler: HookHandler = async (ctx: HookContext) => {
  const validEvents = ['market:tick', 'trade:executed'];
  if (!validEvents.includes(ctx.event as string)) return;
  
  const data = ctx.data || {};
  const tick = data.tick || data.trade || data;
  const config = ctx.context?.cfg || {};
  
  if (!tick || (!tick.bid && !tick.ask)) return;
  
  // Skip if no valid bid/ask
  const bid = tick.bid || tick.price * 0.9995;
  const ask = tick.ask || tick.price * 1.0005;
  
  if (bid <= 0 || ask <= 0 || ask < bid) return;
  
  const alertThreshold = config?.spreadMonitor?.alertThreshold ?? 0.3;
  
  // Calculate spread metrics
  const spread = ask - bid;
  const midPrice = (bid + ask) / 2;
  const spreadPct = (spread / midPrice) * 100;
  const spreadBps = spreadPct * 100;
  
  const snapshot: SpreadSnapshot = {
    timestamp: new Date().toISOString(),
    symbol: tick.symbol,
    exchange: tick.exchange || 'unknown',
    bid,
    ask,
    spread: parseFloat(spread.toFixed(8)),
    spreadPct: parseFloat(spreadPct.toFixed(4)),
    spreadBps: parseFloat(spreadBps.toFixed(2)),
    midPrice: parseFloat(midPrice.toFixed(8))
  };
  
  // Store spread data
  const workspaceDir = ctx.context?.workspaceDir || process.env.KIT_WORKSPACE || '';
  if (workspaceDir) {
    const spreadDir = path.join(workspaceDir, 'spreads');
    if (!fs.existsSync(spreadDir)) {
      fs.mkdirSync(spreadDir, { recursive: true });
    }
    
    const symbolKey = tick.symbol.replace(/\//g, '-');
    const spreadFile = path.join(spreadDir, `${symbolKey}-${tick.exchange || 'default'}.json`);
    
    let snapshots: SpreadSnapshot[] = [];
    try {
      if (fs.existsSync(spreadFile)) {
        snapshots = JSON.parse(fs.readFileSync(spreadFile, 'utf-8')).snapshots || [];
      }
    } catch (e) {
      snapshots = [];
    }
    
    snapshots.push(snapshot);
    
    // Keep last 24 hours (assuming ~1 snapshot per minute = 1440)
    if (snapshots.length > 1500) {
      snapshots = snapshots.slice(-1500);
    }
    
    // Calculate statistics
    const spreads = snapshots.map(s => s.spreadPct);
    const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
    const stdDev = Math.sqrt(
      spreads.reduce((sum, s) => sum + Math.pow(s - avgSpread, 2), 0) / spreads.length
    );
    
    // Group by hour
    const byHour: Record<number, { total: number; count: number }> = {};
    for (const s of snapshots) {
      const hour = new Date(s.timestamp).getHours();
      if (!byHour[hour]) byHour[hour] = { total: 0, count: 0 };
      byHour[hour].total += s.spreadPct;
      byHour[hour].count++;
    }
    
    const stats: SpreadStats = {
      symbol: tick.symbol,
      exchange: tick.exchange || 'unknown',
      avgSpread: parseFloat(avgSpread.toFixed(4)),
      avgSpreadPct: avgSpread,
      minSpread: Math.min(...spreads),
      maxSpread: Math.max(...spreads),
      stdDev: parseFloat(stdDev.toFixed(4)),
      samples: snapshots.length,
      byHour: Object.fromEntries(
        Object.entries(byHour).map(([h, v]) => [
          h,
          { avgSpread: v.total / v.count, count: v.count }
        ])
      )
    };
    
    fs.writeFileSync(spreadFile, JSON.stringify({ snapshots, stats }, null, 2));
    
    // Alert if spread exceeds threshold or is abnormally wide
    const isAbnormal = spreadPct > avgSpread + (2 * stdDev);
    
    if (spreadPct > alertThreshold || (isAbnormal && snapshots.length > 100)) {
      ctx.messages?.push(
        `↔️ **Spread Alert**: ${tick.symbol}\n` +
        `Current: ${spreadPct.toFixed(3)}% (${spreadBps.toFixed(1)} bps)\n` +
        `Average: ${avgSpread.toFixed(3)}%\n` +
        `Bid: ${bid} | Ask: ${ask}` +
        (isAbnormal ? '\n⚠️ Abnormally wide spread detected!' : '')
      );
    }
  }
};

export default handler;
