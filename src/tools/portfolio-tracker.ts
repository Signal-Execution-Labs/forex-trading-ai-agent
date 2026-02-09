/**
 * K.I.T. Portfolio Tracker Tool
 * 
 * Issue #5: Portfolio-Tracker Tool
 * 
 * Provides portfolio management capabilities:
 * - Holdings tracking
 * - P&L calculation
 * - Asset allocation
 * - Performance metrics
 * - Historical snapshots
 */

import ccxt, { Exchange } from 'ccxt';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import {
  Balance,
  AccountBalance,
  PortfolioHolding,
  PortfolioSnapshot,
  ExchangeConfig,
  Trade,
} from './types';

const toNum = (val: number | string | undefined, def: number = 0): number => {
  if (val === undefined || val === null) return def;
  return typeof val === 'string' ? parseFloat(val) : val;
};

export interface PortfolioConfig {
  exchanges: ExchangeConfig[];
  trackingCurrency: string;
  snapshotInterval?: number;
  persistPath?: string;
}

export interface PnLResult {
  totalPnl: number;
  totalPnlPercent: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
}

export interface AllocationResult {
  allocations: { asset: string; percentage: number; value: number }[];
  topHoldings: string[];
  diversificationScore: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  bestPerformer: { symbol: string; returnPercent: number };
  worstPerformer: { symbol: string; returnPercent: number };
  avgHoldingPeriod: number;
  winRate: number;
}

const DEFAULT_CONFIG: PortfolioConfig = {
  exchanges: [{ id: 'binance', sandbox: true }],
  trackingCurrency: 'USDT',
  snapshotInterval: 60,
  persistPath: path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'portfolio'),
};

export class PortfolioTracker extends EventEmitter {
  private exchanges: Map<string, Exchange> = new Map();
  private config: PortfolioConfig;
  private snapshots: PortfolioSnapshot[] = [];
  private trades: Trade[] = [];
  private costBasis: Map<string, { totalCost: number; amount: number }> = new Map();
  private snapshotTimer?: ReturnType<typeof setInterval>;

  constructor(config?: Partial<PortfolioConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadPersistedData();
  }

  async connect(): Promise<boolean> {
    try {
      for (const cfg of this.config.exchanges) {
        const exchangeId = cfg.id.toLowerCase();
        if (!(exchangeId in ccxt)) {
          console.warn(`Exchange ${cfg.id} not supported`);
          continue;
        }

        const ExchangeClass = (ccxt as any)[exchangeId];
        const exchange = new ExchangeClass({
          apiKey: cfg.apiKey || process.env[`${cfg.id.toUpperCase()}_API_KEY`],
          secret: cfg.secret || process.env[`${cfg.id.toUpperCase()}_SECRET`],
          sandbox: cfg.sandbox ?? true,
          enableRateLimit: true,
        }) as Exchange;

        await exchange.loadMarkets();
        this.exchanges.set(cfg.id, exchange);
        console.log(`✓ Connected to ${cfg.id}`);
      }

      if (this.config.snapshotInterval && this.config.snapshotInterval > 0) {
        this.startSnapshotTimer();
      }
      return true;
    } catch (error: any) {
      console.error('Failed to connect:', error.message);
      return false;
    }
  }

  async snapshot(): Promise<PortfolioSnapshot> {
    const holdings: PortfolioHolding[] = [];
    let totalValue = 0;
    let totalCost = 0;
    let cash = 0;

    for (const [exchangeId, exchange] of this.exchanges) {
      try {
        const balance = await exchange.fetchBalance();
        
        for (const [currency, balanceInfo] of Object.entries(balance.total || {})) {
          const amount = toNum(balanceInfo as any);
          if (!amount || amount < 0.00000001) continue;

          if (['USDT', 'USDC', 'USD', 'BUSD', 'DAI'].includes(currency)) {
            cash += amount;
            totalValue += amount;
            continue;
          }

          let currentPrice = 0;
          let value = 0;
          try {
            const symbol = `${currency}/${this.config.trackingCurrency}`;
            if (exchange.markets[symbol]) {
              const ticker = await exchange.fetchTicker(symbol);
              currentPrice = toNum(ticker.last);
              value = amount * currentPrice;
            }
          } catch {
            try {
              const ticker = await exchange.fetchTicker(`${currency}/USDT`);
              currentPrice = toNum(ticker.last);
              value = amount * currentPrice;
            } catch { continue; }
          }

          const costBasisData = this.costBasis.get(currency);
          const avgCost = costBasisData ? costBasisData.totalCost / costBasisData.amount : currentPrice;
          const cost = avgCost * amount;
          const pnl = value - cost;
          const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

          holdings.push({
            symbol: currency, amount, avgCost, currentPrice, value, pnl, pnlPercent, allocation: 0,
          });

          totalValue += value;
          totalCost += cost;
        }
      } catch (error: any) {
        console.error(`Error fetching balance from ${exchangeId}:`, error.message);
      }
    }

    for (const h of holdings) {
      h.allocation = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
    }
    holdings.sort((a, b) => b.value - a.value);

    const snapshot: PortfolioSnapshot = {
      totalValue, totalCost,
      totalPnl: totalValue - totalCost,
      totalPnlPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      holdings, cash, timestamp: Date.now(),
    };

    this.snapshots.push(snapshot);
    this.emit('snapshot', snapshot);
    this.persistData();
    return snapshot;
  }

  async getBalance(exchangeId?: string): Promise<AccountBalance> {
    const balances: Balance[] = [];
    let totalUsd = 0;

    const exchangesToCheck = exchangeId
      ? [[exchangeId, this.exchanges.get(exchangeId)] as const]
      : Array.from(this.exchanges.entries());

    for (const [id, exchange] of exchangesToCheck) {
      if (!exchange) continue;
      try {
        const balance = await exchange.fetchBalance();
        for (const [currency, info] of Object.entries(balance)) {
          if (['info', 'timestamp', 'datetime', 'free', 'used', 'total'].includes(currency)) continue;
          const balanceInfo = info as any;
          if (!balanceInfo?.total || toNum(balanceInfo.total) < 0.00000001) continue;

          balances.push({
            currency,
            free: toNum(balanceInfo.free),
            used: toNum(balanceInfo.used),
            total: toNum(balanceInfo.total),
          });

          if (['USDT', 'USDC', 'USD', 'BUSD'].includes(currency)) {
            totalUsd += toNum(balanceInfo.total);
          } else {
            try {
              const ticker = await exchange.fetchTicker(`${currency}/USDT`);
              totalUsd += toNum(balanceInfo.total) * toNum(ticker.last);
            } catch {}
          }
        }
      } catch (error: any) {
        console.error(`Error from ${id}:`, error.message);
      }
    }

    return { balances, totalUsd, timestamp: Date.now() };
  }

  async getPnL(): Promise<PnLResult> {
    const current = await this.snapshot();
    const now = Date.now();

    const daySnapshot = this.findClosestSnapshot(now - 24 * 60 * 60 * 1000);
    const weekSnapshot = this.findClosestSnapshot(now - 7 * 24 * 60 * 60 * 1000);
    const monthSnapshot = this.findClosestSnapshot(now - 30 * 24 * 60 * 60 * 1000);

    return {
      totalPnl: current.totalPnl,
      totalPnlPercent: current.totalPnlPercent,
      realizedPnl: this.calculateRealizedPnl(),
      unrealizedPnl: current.totalPnl - this.calculateRealizedPnl(),
      dailyPnl: daySnapshot ? current.totalValue - daySnapshot.totalValue : 0,
      weeklyPnl: weekSnapshot ? current.totalValue - weekSnapshot.totalValue : 0,
      monthlyPnl: monthSnapshot ? current.totalValue - monthSnapshot.totalValue : 0,
    };
  }

  async getAllocation(): Promise<AllocationResult> {
    const snapshot = await this.snapshot();
    const allocations = snapshot.holdings.map(h => ({
      asset: h.symbol, percentage: h.allocation, value: h.value,
    }));

    if (snapshot.cash > 0) {
      allocations.push({
        asset: 'CASH',
        percentage: (snapshot.cash / snapshot.totalValue) * 100,
        value: snapshot.cash,
      });
    }

    const hhi = allocations.reduce((sum, a) => sum + Math.pow(a.percentage, 2), 0);
    return {
      allocations,
      topHoldings: allocations.slice(0, 5).map(a => a.asset),
      diversificationScore: Math.max(0, Math.min(100, 100 - (hhi / 100))),
    };
  }

  async getPerformance(): Promise<PerformanceMetrics> {
    const snapshot = await this.snapshot();
    let best = { symbol: '', returnPercent: -Infinity };
    let worst = { symbol: '', returnPercent: Infinity };

    for (const h of snapshot.holdings) {
      if (h.pnlPercent > best.returnPercent) best = { symbol: h.symbol, returnPercent: h.pnlPercent };
      if (h.pnlPercent < worst.returnPercent) worst = { symbol: h.symbol, returnPercent: h.pnlPercent };
    }

    const winningTrades = this.trades.filter(t => {
      const cb = this.costBasis.get(t.symbol.split('/')[0]);
      return cb && t.price > (cb.totalCost / cb.amount);
    });

    return {
      totalReturn: snapshot.totalPnl,
      totalReturnPercent: snapshot.totalPnlPercent,
      bestPerformer: best,
      worstPerformer: worst,
      avgHoldingPeriod: this.calculateAvgHoldingPeriod(),
      winRate: this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0,
    };
  }

  getHistory(days: number = 30): PortfolioSnapshot[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.snapshots.filter(s => s.timestamp >= cutoff);
  }

  recordTrade(trade: Trade): void {
    this.trades.push(trade);
    const asset = trade.symbol.split('/')[0];
    const existing = this.costBasis.get(asset) || { totalCost: 0, amount: 0 };

    if (trade.side === 'buy') {
      existing.totalCost += trade.cost;
      existing.amount += trade.amount;
    } else {
      const avgCost = existing.amount > 0 ? existing.totalCost / existing.amount : 0;
      existing.totalCost -= avgCost * trade.amount;
      existing.amount -= trade.amount;
    }

    if (existing.amount > 0) this.costBasis.set(asset, existing);
    else this.costBasis.delete(asset);

    this.emit('trade', trade);
    this.persistData();
  }

  disconnect(): void {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.exchanges.clear();
    this.persistData();
    this.emit('disconnected');
  }

  private findClosestSnapshot(timestamp: number): PortfolioSnapshot | null {
    if (this.snapshots.length === 0) return null;
    let closest = this.snapshots[0];
    let minDiff = Math.abs(closest.timestamp - timestamp);

    for (const s of this.snapshots) {
      const diff = Math.abs(s.timestamp - timestamp);
      if (diff < minDiff) { minDiff = diff; closest = s; }
    }
    if (minDiff > 2 * 60 * 60 * 1000) return null;
    return closest;
  }

  private calculateRealizedPnl(): number {
    let realized = 0;
    for (const trade of this.trades) {
      if (trade.side === 'sell') {
        const cb = this.costBasis.get(trade.symbol.split('/')[0]);
        if (cb && cb.amount > 0) {
          realized += (trade.price - cb.totalCost / cb.amount) * trade.amount;
        }
      }
    }
    return realized;
  }

  private calculateAvgHoldingPeriod(): number {
    if (this.trades.length < 2) return 0;
    const assetTrades: Map<string, { buys: Trade[]; sells: Trade[] }> = new Map();

    for (const t of this.trades) {
      const asset = t.symbol.split('/')[0];
      if (!assetTrades.has(asset)) assetTrades.set(asset, { buys: [], sells: [] });
      const group = assetTrades.get(asset)!;
      if (t.side === 'buy') group.buys.push(t);
      else group.sells.push(t);
    }

    let totalDays = 0, count = 0;
    for (const [, { buys, sells }] of assetTrades) {
      if (buys.length > 0 && sells.length > 0) {
        totalDays += (sells[0].timestamp - buys[0].timestamp) / (24 * 60 * 60 * 1000);
        count++;
      }
    }
    return count > 0 ? totalDays / count : 0;
  }

  private startSnapshotTimer(): void {
    const intervalMs = (this.config.snapshotInterval || 60) * 60 * 1000;
    this.snapshotTimer = setInterval(async () => {
      try { await this.snapshot(); } catch (e: any) { console.error('Snapshot error:', e.message); }
    }, intervalMs);
  }

  private loadPersistedData(): void {
    if (!this.config.persistPath) return;
    try {
      const snapshotsPath = path.join(this.config.persistPath, 'snapshots.json');
      const tradesPath = path.join(this.config.persistPath, 'trades.json');
      const costBasisPath = path.join(this.config.persistPath, 'cost_basis.json');

      if (fs.existsSync(snapshotsPath)) this.snapshots = JSON.parse(fs.readFileSync(snapshotsPath, 'utf-8'));
      if (fs.existsSync(tradesPath)) this.trades = JSON.parse(fs.readFileSync(tradesPath, 'utf-8'));
      if (fs.existsSync(costBasisPath)) {
        this.costBasis = new Map(Object.entries(JSON.parse(fs.readFileSync(costBasisPath, 'utf-8'))));
      }
    } catch (e: any) { console.warn('Could not load persisted data:', e.message); }
  }

  private persistData(): void {
    if (!this.config.persistPath) return;
    try {
      if (!fs.existsSync(this.config.persistPath)) fs.mkdirSync(this.config.persistPath, { recursive: true });
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent = this.snapshots.filter(s => s.timestamp >= cutoff);

      fs.writeFileSync(path.join(this.config.persistPath, 'snapshots.json'), JSON.stringify(recent, null, 2));
      fs.writeFileSync(path.join(this.config.persistPath, 'trades.json'), JSON.stringify(this.trades, null, 2));
      fs.writeFileSync(path.join(this.config.persistPath, 'cost_basis.json'), JSON.stringify(Object.fromEntries(this.costBasis), null, 2));
    } catch (e: any) { console.error('Could not persist data:', e.message); }
  }
}

export function createPortfolioTracker(config?: Partial<PortfolioConfig>): PortfolioTracker {
  return new PortfolioTracker(config);
}

export default PortfolioTracker;
