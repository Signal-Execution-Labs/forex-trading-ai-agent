/**
 * Slippage Monitor Hook
 * 
 * Monitors execution slippage and alerts on significant price deviation.
 * Tracks slippage per exchange/asset for optimization insights.
 */

import type { HookHandler, HookContext } from '../../types.js';
import * as fs from 'fs';
import * as path from 'path';

interface SlippageEntry {
  timestamp: string;
  symbol: string;
  exchange: string;
  side: 'buy' | 'sell';
  expectedPrice: number;
  executedPrice: number;
  slippagePct: number;
  slippageBps: number;
  quantity: number;
  impact: number;
}

interface SlippageStats {
  totalTrades: number;
  avgSlippagePct: number;
  avgSlippageBps: number;
  maxSlippagePct: number;
  totalImpact: number;
  byExchange: Record<string, { count: number; avgSlippage: number }>;
  byAsset: Record<string, { count: number; avgSlippage: number }>;
  lastUpdated: string;
}

const handler: HookHandler = async (ctx: HookContext) => {
  if (ctx.event !== 'trade:executed') return;
  
  const trade = ctx.data?.trade || ctx.data;
  if (!trade || !trade.expectedPrice || !trade.executedPrice) return;
  
  const config = ctx.context?.cfg || {};
  const threshold = config?.slippageMonitor?.threshold ?? 0.5;
  const alertOnPositive = config?.slippageMonitor?.alertOnPositive ?? false;
  
  // Calculate slippage
  const slippagePct = ((trade.executedPrice - trade.expectedPrice) / trade.expectedPrice) * 100;
  const slippageBps = slippagePct * 100; // Basis points
  
  // For buys, positive slippage is bad. For sells, negative slippage is bad.
  const effectiveSlippage = trade.side === 'buy' ? slippagePct : -slippagePct;
  
  // Calculate dollar impact
  const impact = Math.abs(slippagePct / 100) * trade.expectedPrice * (trade.quantity || 1);
  
  const entry: SlippageEntry = {
    timestamp: new Date().toISOString(),
    symbol: trade.symbol,
    exchange: trade.exchange || 'unknown',
    side: trade.side,
    expectedPrice: trade.expectedPrice,
    executedPrice: trade.executedPrice,
    slippagePct: parseFloat(slippagePct.toFixed(4)),
    slippageBps: parseFloat(slippageBps.toFixed(2)),
    quantity: trade.quantity || 1,
    impact: parseFloat(impact.toFixed(2))
  };
  
  // Log to file
  const workspaceDir = ctx.context?.workspaceDir || process.env.KIT_WORKSPACE || '';
  if (workspaceDir) {
    const logPath = path.join(workspaceDir, 'slippage-log.json');
    let entries: SlippageEntry[] = [];
    
    try {
      if (fs.existsSync(logPath)) {
        entries = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      }
    } catch (e) {
      entries = [];
    }
    
    entries.push(entry);
    
    // Keep last 1000 entries
    if (entries.length > 1000) {
      entries = entries.slice(-1000);
    }
    
    // Calculate stats
    const stats: SlippageStats = {
      totalTrades: entries.length,
      avgSlippagePct: entries.reduce((sum, e) => sum + Math.abs(e.slippagePct), 0) / entries.length,
      avgSlippageBps: entries.reduce((sum, e) => sum + Math.abs(e.slippageBps), 0) / entries.length,
      maxSlippagePct: Math.max(...entries.map(e => Math.abs(e.slippagePct))),
      totalImpact: entries.reduce((sum, e) => sum + e.impact, 0),
      byExchange: {},
      byAsset: {},
      lastUpdated: new Date().toISOString()
    };
    
    // Aggregate by exchange
    for (const e of entries) {
      if (!stats.byExchange[e.exchange]) {
        stats.byExchange[e.exchange] = { count: 0, avgSlippage: 0 };
      }
      stats.byExchange[e.exchange].count++;
    }
    for (const ex of Object.keys(stats.byExchange)) {
      const exEntries = entries.filter(e => e.exchange === ex);
      stats.byExchange[ex].avgSlippage = exEntries.reduce((sum, e) => sum + Math.abs(e.slippagePct), 0) / exEntries.length;
    }
    
    // Aggregate by asset
    for (const e of entries) {
      if (!stats.byAsset[e.symbol]) {
        stats.byAsset[e.symbol] = { count: 0, avgSlippage: 0 };
      }
      stats.byAsset[e.symbol].count++;
    }
    for (const asset of Object.keys(stats.byAsset)) {
      const assetEntries = entries.filter(e => e.symbol === asset);
      stats.byAsset[asset].avgSlippage = assetEntries.reduce((sum, e) => sum + Math.abs(e.slippagePct), 0) / assetEntries.length;
    }
    
    fs.writeFileSync(logPath, JSON.stringify({ entries, stats }, null, 2));
  }
  
  // Alert if threshold exceeded
  if (effectiveSlippage > threshold || (alertOnPositive && effectiveSlippage < -threshold)) {
    const emoji = effectiveSlippage > 0 ? '📉' : '📈';
    const direction = effectiveSlippage > 0 ? 'negative' : 'positive';
    
    ctx.messages?.push(
      `${emoji} **Slippage Alert**\n` +
      `${trade.symbol} ${trade.side.toUpperCase()}: ${slippagePct.toFixed(3)}% ${direction} slippage\n` +
      `Expected: ${trade.expectedPrice} | Executed: ${trade.executedPrice}\n` +
      `Impact: $${impact.toFixed(2)}`
    );
  }
};

export default handler;
