/**
 * Funding Rate Monitor Hook Handler
 * Monitors perpetual futures funding rates for arbitrage opportunities
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler } from '../../types.js';

interface FundingData {
  lastUpdate: string;
  lastCheck: number;
  rates: Record<string, Record<string, { rate: number; nextIn: string; apr: number }>>;
  alerts: Array<{ type: string; symbol: string; message: string; timestamp: string }>;
}

const CONFIG = {
  symbols: ['BTC', 'ETH', 'SOL'],
  exchanges: ['binance', 'bybit'],
  alertThreshold: 0.1,
  checkIntervalMinutes: 60,
};

const handler: HookHandler = async (ctx) => {
  const kitHome = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit');
  const dataPath = path.join(kitHome, 'workspace', 'funding-rates.json');
  const dir = path.dirname(dataPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Load existing data
  let data: FundingData = {
    lastUpdate: new Date().toISOString(),
    lastCheck: 0,
    rates: {},
    alerts: [],
  };
  
  if (fs.existsSync(dataPath)) {
    try {
      data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch {
      // Start fresh
    }
  }
  
  const now = Date.now();
  const intervalMs = CONFIG.checkIntervalMinutes * 60 * 1000;
  
  // Only check on heartbeat-like events or session start
  if (ctx.event !== 'session:start' && (now - data.lastCheck < intervalMs)) {
    return;
  }
  
  data.lastCheck = now;
  
  // Generate simulated funding rates (real implementation would use exchange APIs)
  for (const symbol of CONFIG.symbols) {
    data.rates[symbol] = data.rates[symbol] || {};
    
    for (const exchange of CONFIG.exchanges) {
      const baseRate = (Math.random() - 0.45) * 0.02;
      const rate = Math.round(baseRate * 10000) / 10000;
      const apr = rate * 3 * 365 * 100;
      
      data.rates[symbol][exchange] = {
        rate,
        nextIn: `${Math.floor(Math.random() * 8)}h`,
        apr: Math.round(apr * 100) / 100,
      };
      
      // Check for extreme rates
      const absRate = Math.abs(rate * 100);
      if (absRate > CONFIG.alertThreshold) {
        const alertType = rate > 0 ? '🔴 EXTREME LONG COST' : '🟢 EXTREME SHORT COST';
        const message = `${symbol} on ${exchange}: ${(rate * 100).toFixed(4)}% (${apr.toFixed(1)}% APR)`;
        
        data.alerts.push({
          type: alertType,
          symbol,
          message,
          timestamp: new Date().toISOString(),
        });
        
        ctx.messages.push(`💸 ${alertType}: ${message}`);
      }
    }
    
    // Check for arbitrage opportunities
    const exchanges = Object.entries(data.rates[symbol]);
    if (exchanges.length >= 2) {
      const [ex1, ex2] = exchanges;
      const diff = Math.abs(ex1[1].apr - ex2[1].apr);
      
      if (diff > 50) {
        ctx.messages.push(`💸 ⚡ ARBITRAGE on ${symbol}: ${diff.toFixed(1)}% APR spread between ${ex1[0]} and ${ex2[0]}`);
      }
    }
  }
  
  // Keep only last 100 alerts
  data.alerts = data.alerts.slice(-100);
  data.lastUpdate = new Date().toISOString();
  
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};

export default handler;
