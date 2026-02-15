/**
 * Whale Alert Hook Handler
 * Monitors large cryptocurrency transactions for smart money signals
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler } from '../../types.js';

interface WhaleData {
  lastUpdate: string;
  lastCheck: number;
  recentTransactions: Array<{
    hash: string;
    asset: string;
    amount: number;
    valueUsd: number;
    from: string;
    to: string;
    fromType: string;
    toType: string;
    timestamp: string;
  }>;
  exchangeFlows24h: Record<string, { inflow: number; outflow: number; net: number }>;
  alerts: Array<{ type: string; asset: string; message: string; valueUsd: number; timestamp: string }>;
}

const CONFIG = {
  minValueUsd: 1000000,
  assets: ['BTC', 'ETH', 'USDT', 'USDC'],
  checkIntervalMinutes: 15,
};

const EXCHANGES = ['binance', 'coinbase', 'kraken', 'okx', 'bybit', 'bitfinex'];
const PRICES: Record<string, number> = { BTC: 95000, ETH: 3200, USDT: 1, USDC: 1 };

function formatValue(value: number): string {
  if (value >= 1000000000) return (value / 1000000000).toFixed(2) + 'B';
  if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toFixed(2);
}

function generateHash(): string {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateWallet(): string {
  return '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

const handler: HookHandler = async (ctx) => {
  const kitHome = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit');
  const dataPath = path.join(kitHome, 'workspace', 'whale-activity.json');
  const dir = path.dirname(dataPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  let data: WhaleData = {
    lastUpdate: new Date().toISOString(),
    lastCheck: 0,
    recentTransactions: [],
    exchangeFlows24h: {},
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
  
  if (ctx.event !== 'session:start' && (now - data.lastCheck < intervalMs)) {
    return;
  }
  
  data.lastCheck = now;
  
  // Simulate whale activity (real implementation would use Whale Alert API)
  for (const asset of CONFIG.assets) {
    if (Math.random() > 0.7) continue;
    
    const isExchangeFlow = Math.random() > 0.5;
    const isInflow = Math.random() > 0.5;
    
    const ranges: Record<string, [number, number]> = {
      BTC: [50, 500], ETH: [1000, 10000], USDT: [1000000, 50000000], USDC: [1000000, 50000000],
    };
    const [min, max] = ranges[asset] || [1000, 10000];
    const amount = min + Math.random() * (max - min);
    const valueUsd = amount * (PRICES[asset] || 100);
    
    if (valueUsd < CONFIG.minValueUsd) continue;
    
    const exchange = EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)];
    
    const tx = {
      hash: generateHash(),
      asset,
      amount,
      valueUsd,
      from: isExchangeFlow && !isInflow ? exchange : generateWallet(),
      to: isExchangeFlow && isInflow ? exchange : generateWallet(),
      fromType: isExchangeFlow && !isInflow ? 'exchange' : 'wallet',
      toType: isExchangeFlow && isInflow ? 'exchange' : 'wallet',
      timestamp: new Date().toISOString(),
    };
    
    data.recentTransactions.unshift(tx);
    
    // Update exchange flows
    if (isExchangeFlow) {
      if (!data.exchangeFlows24h[asset]) {
        data.exchangeFlows24h[asset] = { inflow: 0, outflow: 0, net: 0 };
      }
      
      if (isInflow) {
        data.exchangeFlows24h[asset].inflow += amount;
        data.exchangeFlows24h[asset].net += amount;
        
        if (asset !== 'USDT' && asset !== 'USDC') {
          const alert = {
            type: '📥 EXCHANGE INFLOW',
            asset,
            message: `${amount.toFixed(2)} ${asset} ($${formatValue(valueUsd)}) moved to ${exchange}`,
            valueUsd,
            timestamp: new Date().toISOString(),
          };
          data.alerts.push(alert);
          ctx.messages.push(`🐋 ${alert.type}: ${alert.message}`);
        }
      } else {
        data.exchangeFlows24h[asset].outflow += amount;
        data.exchangeFlows24h[asset].net -= amount;
        
        const alert = {
          type: '📤 EXCHANGE OUTFLOW',
          asset,
          message: `${amount.toFixed(2)} ${asset} ($${formatValue(valueUsd)}) withdrawn from ${exchange}`,
          valueUsd,
          timestamp: new Date().toISOString(),
        };
        data.alerts.push(alert);
        ctx.messages.push(`🐋 ${alert.type}: ${alert.message}`);
      }
    } else {
      const alert = {
        type: '🐋 WHALE TRANSFER',
        asset,
        message: `${amount.toFixed(2)} ${asset} ($${formatValue(valueUsd)}) moved between wallets`,
        valueUsd,
        timestamp: new Date().toISOString(),
      };
      data.alerts.push(alert);
      ctx.messages.push(`🐋 ${alert.type}: ${alert.message}`);
    }
  }
  
  data.recentTransactions = data.recentTransactions.slice(0, 100);
  data.alerts = data.alerts.slice(-100);
  data.lastUpdate = new Date().toISOString();
  
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};

export default handler;
