/**
 * Volatility Monitor Hook
 * 
 * Monitors real-time market volatility and detects regime changes.
 * Uses rolling windows to calculate annualized volatility.
 */

import type { HookHandler, HookContext } from '../../types.js';
import * as fs from 'fs';
import * as path from 'path';

type VolatilityRegime = 'low' | 'medium' | 'high' | 'extreme';

interface PricePoint {
  timestamp: number;
  price: number;
  return: number;
}

interface VolatilityData {
  symbol: string;
  currentRegime: VolatilityRegime;
  vol1h: number;
  vol4h: number;
  vol24h: number;
  volPercentile: number;
  lastPrice: number;
  priceChange24h: number;
  lastUpdated: string;
  regimeHistory: Array<{ regime: VolatilityRegime; timestamp: string }>;
}

const REGIME_THRESHOLDS = {
  low: 20,      // < 20% annualized vol
  medium: 40,   // 20-40%
  high: 80,     // 40-80%
  extreme: 100  // > 80%
};

function calculateVolatility(returns: number[], periodsPerYear: number): number {
  if (returns.length < 2) return 0;
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  
  // Annualize
  return stdDev * Math.sqrt(periodsPerYear) * 100;
}

function determineRegime(vol: number): VolatilityRegime {
  if (vol < REGIME_THRESHOLDS.low) return 'low';
  if (vol < REGIME_THRESHOLDS.medium) return 'medium';
  if (vol < REGIME_THRESHOLDS.high) return 'high';
  return 'extreme';
}

function determineVolFromRegime(regime: VolatilityRegime): number {
  switch (regime) {
    case 'low': return 10;
    case 'medium': return 30;
    case 'high': return 60;
    case 'extreme': return 100;
  }
}

function getRegimeEmoji(regime: VolatilityRegime): string {
  switch (regime) {
    case 'low': return '😴';
    case 'medium': return '👀';
    case 'high': return '🔥';
    case 'extreme': return '🌋';
  }
}

const handler: HookHandler = async (ctx: HookContext) => {
  const validEvents = ['market:tick', 'session:start'];
  if (!validEvents.includes(ctx.event as string)) return;
  
  const data = ctx.data || {};
  const tick = data.tick || data;
  const config = ctx.context?.cfg || {};
  
  // On session start, just report current regime
  if (ctx.event === 'session:start') {
    return reportCurrentVolatility(ctx);
  }
  
  if (!tick || !tick.price || !tick.symbol) return;
  
  const alertOnRegimeChange = config?.volatilityMonitor?.alertOnRegimeChange ?? true;
  const extremeThreshold = config?.volatilityMonitor?.extremeVolThreshold ?? 80;
  
  const workspaceDir = ctx.context?.workspaceDir || process.env.KIT_WORKSPACE || '';
  if (!workspaceDir) return;
  
  const volDir = path.join(workspaceDir, 'volatility');
  if (!fs.existsSync(volDir)) {
    fs.mkdirSync(volDir, { recursive: true });
  }
  
  const symbolKey = tick.symbol.replace(/\//g, '-');
  const volFile = path.join(volDir, `${symbolKey}.json`);
  
  // Load existing data
  let prices: PricePoint[] = [];
  let previousRegime: VolatilityRegime | null = null;
  let regimeHistory: Array<{ regime: VolatilityRegime; timestamp: string }> = [];
  
  try {
    if (fs.existsSync(volFile)) {
      const fileData = JSON.parse(fs.readFileSync(volFile, 'utf-8'));
      prices = fileData.prices || [];
      previousRegime = fileData.currentRegime;
      regimeHistory = fileData.regimeHistory || [];
    }
  } catch (e) {
    prices = [];
  }
  
  // Calculate return from last price
  const lastPrice = prices.length > 0 ? prices[prices.length - 1].price : tick.price;
  const ret = lastPrice > 0 ? (tick.price - lastPrice) / lastPrice : 0;
  
  prices.push({
    timestamp: Date.now(),
    price: tick.price,
    return: ret
  });
  
  // Keep 24 hours of minute data (1440 points)
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  prices = prices.filter(p => p.timestamp > twentyFourHoursAgo);
  
  // Calculate volatilities for different windows
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
  
  const returns1h = prices.filter(p => p.timestamp > oneHourAgo).map(p => p.return);
  const returns4h = prices.filter(p => p.timestamp > fourHoursAgo).map(p => p.return);
  const returns24h = prices.map(p => p.return);
  
  // Assuming 1-minute data: 525600 periods per year
  const periodsPerYear = 365 * 24 * 60;
  
  const vol1h = calculateVolatility(returns1h, periodsPerYear);
  const vol4h = calculateVolatility(returns4h, periodsPerYear);
  const vol24h = calculateVolatility(returns24h, periodsPerYear);
  
  const currentRegime = determineRegime(vol24h);
  
  // Calculate percentile (simple: where does current vol rank in history)
  const volPercentile = regimeHistory.length > 10 
    ? Math.round((regimeHistory.filter(r => determineVolFromRegime(r.regime) < vol24h).length / regimeHistory.length) * 100)
    : 50;
  
  // Price change 24h
  const oldestPrice = prices.length > 0 ? prices[0].price : tick.price;
  const priceChange24h = ((tick.price - oldestPrice) / oldestPrice) * 100;
  
  // Check for regime change
  if (previousRegime && currentRegime !== previousRegime) {
    regimeHistory.push({ regime: currentRegime, timestamp: new Date().toISOString() });
    
    // Keep last 100 regime changes
    if (regimeHistory.length > 100) {
      regimeHistory = regimeHistory.slice(-100);
    }
    
    if (alertOnRegimeChange) {
      const emoji = getRegimeEmoji(currentRegime);
      ctx.messages?.push(
        `🌊 **Volatility Regime Change**: ${tick.symbol}\n` +
        `${previousRegime.toUpperCase()} → ${currentRegime.toUpperCase()} ${emoji}\n` +
        `24H Vol: ${vol24h.toFixed(1)}% | 1H Vol: ${vol1h.toFixed(1)}%\n` +
        `Price: ${tick.price} (${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%)`
      );
    }
  }
  
  // Alert on extreme volatility
  if (vol1h > extremeThreshold && prices.length > 30) {
    ctx.messages?.push(
      `⚠️ **Extreme Volatility**: ${tick.symbol}\n` +
      `1H Vol: ${vol1h.toFixed(1)}% (annualized)\n` +
      `Consider reducing position sizes or pausing new trades.`
    );
  }
  
  const volData: VolatilityData = {
    symbol: tick.symbol,
    currentRegime,
    vol1h: parseFloat(vol1h.toFixed(2)),
    vol4h: parseFloat(vol4h.toFixed(2)),
    vol24h: parseFloat(vol24h.toFixed(2)),
    volPercentile,
    lastPrice: tick.price,
    priceChange24h: parseFloat(priceChange24h.toFixed(2)),
    lastUpdated: new Date().toISOString(),
    regimeHistory
  };
  
  fs.writeFileSync(volFile, JSON.stringify({ prices, ...volData }, null, 2));
};

async function reportCurrentVolatility(ctx: HookContext): Promise<void> {
  const workspaceDir = ctx.context?.workspaceDir || process.env.KIT_WORKSPACE || '';
  if (!workspaceDir) return;
  
  const volDir = path.join(workspaceDir, 'volatility');
  if (!fs.existsSync(volDir)) return;
  
  const files = fs.readdirSync(volDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) return;
  
  const summary: string[] = ['🌊 **Volatility Summary**'];
  
  for (const file of files.slice(0, 5)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(path.join(volDir, file), 'utf-8'));
      const emoji = getRegimeEmoji(fileData.currentRegime);
      summary.push(
        `${emoji} ${fileData.symbol}: ${fileData.currentRegime.toUpperCase()} (${fileData.vol24h}% 24H)`
      );
    } catch (e) {
      // Skip invalid files
    }
  }
  
  if (summary.length > 1) {
    ctx.messages?.push(summary.join('\n'));
  }
}

export default handler;
