/**
 * K.I.T. Tax Tracker - Automated Tax Tracking for Trading
 * Issue #7: Calculate capital gains, generate tax reports, tax-loss harvesting
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// TYPES
// ============================================================

export type TaxMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'ACB';  // Average Cost Basis

export type Jurisdiction = 'DE' | 'AT' | 'CH' | 'US' | 'UK';

export interface Trade {
  id: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  cost: number;  // amount * price
  fee: number;
  feeCurrency: string;
  timestamp: number;
  date: string;  // ISO date
}

export interface TaxLot {
  id: string;
  asset: string;
  amount: number;
  costBasis: number;  // Per unit
  totalCost: number;
  acquiredAt: Date;
  exchange: string;
  remainingAmount: number;
}

export interface CapitalGain {
  id: string;
  asset: string;
  amount: number;
  proceeds: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
  holdingDays: number;
  isLongTerm: boolean;
  isTaxFree: boolean;  // Germany: 1 year holding = tax free
  taxableGain: number;
  disposedAt: Date;
  acquiredAt: Date;
  method: TaxMethod;
}

export interface TaxLossHarvestOpportunity {
  asset: string;
  currentAmount: number;
  costBasis: number;
  currentPrice: number;
  currentValue: number;
  unrealizedLoss: number;
  potentialTaxSavings: number;  // At estimated rate
  holdingDays: number;
  recommendation: string;
}

export interface TaxSummary {
  year: number;
  jurisdiction: Jurisdiction;
  method: TaxMethod;
  
  // Gains
  totalProceeds: number;
  totalCostBasis: number;
  totalGains: number;
  totalLosses: number;
  netGainLoss: number;
  
  // Tax-free (Germany specific)
  longTermGains: number;
  shortTermGains: number;
  taxFreeGains: number;
  taxableGains: number;
  
  // Fees
  totalFees: number;
  
  // Estimated tax
  estimatedTax: number;
  effectiveRate: number;
  
  // By asset
  byAsset: Record<string, {
    gains: number;
    losses: number;
    net: number;
    taxable: number;
  }>;
  
  // Trade stats
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
}

export interface TaxConfig {
  jurisdiction: Jurisdiction;
  method: TaxMethod;
  taxYear: number;
  
  // Tax rates by jurisdiction
  shortTermRate: number;  // For short-term gains
  longTermRate: number;   // For long-term gains
  cryptoHoldingPeriod: number;  // Days for tax-free (DE: 365)
  
  // Paths
  persistPath: string;
}

// ============================================================
// TAX TRACKER CLASS
// ============================================================

export class TaxTracker {
  private config: TaxConfig;
  private trades: Trade[] = [];
  private lots: Map<string, TaxLot[]> = new Map();  // asset -> lots
  private gains: CapitalGain[] = [];
  
  constructor(config: Partial<TaxConfig> = {}) {
    this.config = {
      jurisdiction: 'DE',
      method: 'FIFO',
      taxYear: new Date().getFullYear(),
      shortTermRate: 0.42,  // Germany: up to 45% + Soli
      longTermRate: 0,      // Germany: crypto tax-free after 1 year
      cryptoHoldingPeriod: 365,
      persistPath: path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'tax'),
      ...config
    };
    
    this.ensureDirectory();
    this.loadData();
  }
  
  // --------------------------------------------------------
  // Trade Import
  // --------------------------------------------------------
  
  importTrade(trade: Omit<Trade, 'id'>): Trade {
    const fullTrade: Trade = {
      ...trade,
      id: this.generateId('trade')
    };
    
    this.trades.push(fullTrade);
    
    // Update tax lots
    if (trade.side === 'buy') {
      this.addLot(trade);
    } else {
      this.disposeLots(trade);
    }
    
    this.saveData();
    return fullTrade;
  }
  
  importTrades(trades: Omit<Trade, 'id'>[]): Trade[] {
    // Sort by timestamp to process in order
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    return sorted.map(t => this.importTrade(t));
  }
  
  // --------------------------------------------------------
  // Tax Lot Management
  // --------------------------------------------------------
  
  private addLot(trade: Omit<Trade, 'id'>): void {
    const asset = trade.symbol.split('/')[0];  // BTC from BTC/USDT
    
    const lot: TaxLot = {
      id: this.generateId('lot'),
      asset,
      amount: trade.amount,
      costBasis: trade.price,
      totalCost: trade.cost + trade.fee,
      acquiredAt: new Date(trade.timestamp),
      exchange: trade.exchange,
      remainingAmount: trade.amount
    };
    
    if (!this.lots.has(asset)) {
      this.lots.set(asset, []);
    }
    this.lots.get(asset)!.push(lot);
  }
  
  private disposeLots(trade: Omit<Trade, 'id'>): void {
    const asset = trade.symbol.split('/')[0];
    const lots = this.lots.get(asset) || [];
    
    if (lots.length === 0) {
      console.warn(`No tax lots found for ${asset} - trade may be missing`);
      return;
    }
    
    // Sort lots based on method
    const sortedLots = this.sortLotsByMethod(lots);
    
    let remainingToSell = trade.amount;
    const sellDate = new Date(trade.timestamp);
    
    for (const lot of sortedLots) {
      if (remainingToSell <= 0) break;
      if (lot.remainingAmount <= 0) continue;
      
      const soldAmount = Math.min(lot.remainingAmount, remainingToSell);
      const proceeds = soldAmount * trade.price;
      const costBasis = soldAmount * (lot.totalCost / lot.amount);
      const gain = proceeds - costBasis;
      const holdingDays = Math.floor((sellDate.getTime() - lot.acquiredAt.getTime()) / (1000 * 60 * 60 * 24));
      
      const isLongTerm = holdingDays >= this.config.cryptoHoldingPeriod;
      const isTaxFree = this.config.jurisdiction === 'DE' && isLongTerm;
      
      const capitalGain: CapitalGain = {
        id: this.generateId('gain'),
        asset,
        amount: soldAmount,
        proceeds,
        costBasis,
        gain,
        gainPercent: (gain / costBasis) * 100,
        holdingDays,
        isLongTerm,
        isTaxFree,
        taxableGain: isTaxFree ? 0 : gain,
        disposedAt: sellDate,
        acquiredAt: lot.acquiredAt,
        method: this.config.method
      };
      
      this.gains.push(capitalGain);
      
      // Update lot
      lot.remainingAmount -= soldAmount;
      remainingToSell -= soldAmount;
    }
  }
  
  private sortLotsByMethod(lots: TaxLot[]): TaxLot[] {
    const available = lots.filter(l => l.remainingAmount > 0);
    
    switch (this.config.method) {
      case 'FIFO':  // First In, First Out
        return available.sort((a, b) => a.acquiredAt.getTime() - b.acquiredAt.getTime());
        
      case 'LIFO':  // Last In, First Out
        return available.sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime());
        
      case 'HIFO':  // Highest In, First Out
        return available.sort((a, b) => b.costBasis - a.costBasis);
        
      case 'ACB':   // Average Cost Basis - treat as single lot
      default:
        return available;
    }
  }
  
  // --------------------------------------------------------
  // Tax Calculations
  // --------------------------------------------------------
  
  calculateTaxSummary(year?: number): TaxSummary {
    const taxYear = year || this.config.taxYear;
    const yearGains = this.gains.filter(g => g.disposedAt.getFullYear() === taxYear);
    const yearTrades = this.trades.filter(t => new Date(t.timestamp).getFullYear() === taxYear);
    
    // Calculate totals
    let totalProceeds = 0;
    let totalCostBasis = 0;
    let totalGains = 0;
    let totalLosses = 0;
    let longTermGains = 0;
    let shortTermGains = 0;
    let taxFreeGains = 0;
    let taxableGains = 0;
    const byAsset: TaxSummary['byAsset'] = {};
    
    for (const gain of yearGains) {
      totalProceeds += gain.proceeds;
      totalCostBasis += gain.costBasis;
      
      if (gain.gain > 0) {
        totalGains += gain.gain;
        if (gain.isLongTerm) longTermGains += gain.gain;
        else shortTermGains += gain.gain;
      } else {
        totalLosses += Math.abs(gain.gain);
      }
      
      if (gain.isTaxFree) {
        taxFreeGains += Math.max(0, gain.gain);
      } else {
        taxableGains += gain.gain;
      }
      
      // By asset
      if (!byAsset[gain.asset]) {
        byAsset[gain.asset] = { gains: 0, losses: 0, net: 0, taxable: 0 };
      }
      if (gain.gain > 0) {
        byAsset[gain.asset].gains += gain.gain;
      } else {
        byAsset[gain.asset].losses += Math.abs(gain.gain);
      }
      byAsset[gain.asset].net += gain.gain;
      byAsset[gain.asset].taxable += gain.taxableGain;
    }
    
    // Calculate fees
    const totalFees = yearTrades.reduce((sum, t) => sum + t.fee, 0);
    
    // Estimate tax
    const estimatedTax = Math.max(0, taxableGains * this.config.shortTermRate);
    const effectiveRate = totalGains > 0 ? estimatedTax / totalGains : 0;
    
    return {
      year: taxYear,
      jurisdiction: this.config.jurisdiction,
      method: this.config.method,
      totalProceeds,
      totalCostBasis,
      totalGains,
      totalLosses,
      netGainLoss: totalGains - totalLosses,
      longTermGains,
      shortTermGains,
      taxFreeGains,
      taxableGains: Math.max(0, taxableGains),
      totalFees,
      estimatedTax,
      effectiveRate,
      byAsset,
      totalTrades: yearTrades.length,
      buyTrades: yearTrades.filter(t => t.side === 'buy').length,
      sellTrades: yearTrades.filter(t => t.side === 'sell').length
    };
  }
  
  // --------------------------------------------------------
  // Tax-Loss Harvesting
  // --------------------------------------------------------
  
  findTaxLossOpportunities(currentPrices: Record<string, number>): TaxLossHarvestOpportunity[] {
    const opportunities: TaxLossHarvestOpportunity[] = [];
    const now = new Date();
    
    for (const [asset, lots] of this.lots.entries()) {
      const availableLots = lots.filter(l => l.remainingAmount > 0);
      if (availableLots.length === 0) continue;
      
      const currentPrice = currentPrices[asset];
      if (!currentPrice) continue;
      
      // Calculate totals for this asset
      let totalAmount = 0;
      let totalCost = 0;
      let weightedHoldingDays = 0;
      
      for (const lot of availableLots) {
        totalAmount += lot.remainingAmount;
        totalCost += lot.remainingAmount * (lot.totalCost / lot.amount);
        const days = Math.floor((now.getTime() - lot.acquiredAt.getTime()) / (1000 * 60 * 60 * 24));
        weightedHoldingDays += days * lot.remainingAmount;
      }
      
      const avgCostBasis = totalCost / totalAmount;
      const currentValue = totalAmount * currentPrice;
      const unrealizedPnL = currentValue - totalCost;
      const avgHoldingDays = Math.floor(weightedHoldingDays / totalAmount);
      
      // Only show losses
      if (unrealizedPnL >= 0) continue;
      
      const unrealizedLoss = Math.abs(unrealizedPnL);
      const potentialTaxSavings = unrealizedLoss * this.config.shortTermRate;
      
      // Determine recommendation
      let recommendation = '';
      if (unrealizedLoss > 500) {
        if (avgHoldingDays < this.config.cryptoHoldingPeriod - 30) {
          recommendation = 'Consider selling to realize loss for tax offset. Can rebuy after wash sale period.';
        } else if (avgHoldingDays >= this.config.cryptoHoldingPeriod) {
          recommendation = 'Position is already long-term. Harvesting may not be optimal.';
        } else {
          recommendation = `Close to long-term threshold (${this.config.cryptoHoldingPeriod - avgHoldingDays} days). Consider waiting.`;
        }
      } else {
        recommendation = 'Loss too small to justify transaction costs.';
      }
      
      opportunities.push({
        asset,
        currentAmount: totalAmount,
        costBasis: avgCostBasis,
        currentPrice,
        currentValue,
        unrealizedLoss,
        potentialTaxSavings,
        holdingDays: avgHoldingDays,
        recommendation
      });
    }
    
    // Sort by potential savings
    return opportunities.sort((a, b) => b.potentialTaxSavings - a.potentialTaxSavings);
  }
  
  // --------------------------------------------------------
  // Reports
  // --------------------------------------------------------
  
  generateReport(year?: number): string {
    const summary = this.calculateTaxSummary(year);
    
    let report = `
🧾 ANNUAL TAX REPORT ${summary.year}
${'='.repeat(60)}
Jurisdiction: ${summary.jurisdiction}
Method: ${summary.method}

SUMMARY
${'-'.repeat(60)}
Total Proceeds:     €${summary.totalProceeds.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
Total Cost Basis:   €${summary.totalCostBasis.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
Total Gains:        €${summary.totalGains.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
Total Losses:       €${summary.totalLosses.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
Net Gain/Loss:      €${summary.netGainLoss.toLocaleString('de-DE', { minimumFractionDigits: 2 })}

TAX BREAKDOWN
${'-'.repeat(60)}
Long-Term Gains:    €${summary.longTermGains.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
Short-Term Gains:   €${summary.shortTermGains.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
Tax-Free Gains:     €${summary.taxFreeGains.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ✨
Taxable Gains:      €${summary.taxableGains.toLocaleString('de-DE', { minimumFractionDigits: 2 })}

Estimated Tax:      €${summary.estimatedTax.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
Effective Rate:     ${(summary.effectiveRate * 100).toFixed(1)}%

TRADING ACTIVITY
${'-'.repeat(60)}
Total Trades:       ${summary.totalTrades}
Buy Orders:         ${summary.buyTrades}
Sell Orders:        ${summary.sellTrades}
Total Fees:         €${summary.totalFees.toLocaleString('de-DE', { minimumFractionDigits: 2 })}

BY ASSET
${'-'.repeat(60)}
`;

    for (const [asset, data] of Object.entries(summary.byAsset)) {
      const status = data.net >= 0 ? '📈' : '📉';
      report += `${status} ${asset.padEnd(6)} | Gains: €${data.gains.toFixed(2).padStart(10)} | Losses: €${data.losses.toFixed(2).padStart(10)} | Taxable: €${data.taxable.toFixed(2).padStart(10)}\n`;
    }
    
    return report;
  }
  
  exportToCSV(year?: number): string {
    const taxYear = year || this.config.taxYear;
    const yearGains = this.gains.filter(g => g.disposedAt.getFullYear() === taxYear);
    
    const headers = [
      'Date', 'Asset', 'Amount', 'Proceeds', 'Cost Basis', 'Gain/Loss',
      'Holding Days', 'Long Term', 'Tax Free', 'Taxable Amount', 'Method'
    ].join(',');
    
    const rows = yearGains.map(g => [
      g.disposedAt.toISOString().split('T')[0],
      g.asset,
      g.amount.toFixed(8),
      g.proceeds.toFixed(2),
      g.costBasis.toFixed(2),
      g.gain.toFixed(2),
      g.holdingDays,
      g.isLongTerm ? 'Yes' : 'No',
      g.isTaxFree ? 'Yes' : 'No',
      g.taxableGain.toFixed(2),
      g.method
    ].join(','));
    
    return [headers, ...rows].join('\n');
  }
  
  // --------------------------------------------------------
  // Holdings & Lots
  // --------------------------------------------------------
  
  getHoldings(): Record<string, { amount: number; avgCost: number; totalCost: number }> {
    const holdings: Record<string, { amount: number; avgCost: number; totalCost: number }> = {};
    
    for (const [asset, lots] of this.lots.entries()) {
      let totalAmount = 0;
      let totalCost = 0;
      
      for (const lot of lots) {
        if (lot.remainingAmount > 0) {
          totalAmount += lot.remainingAmount;
          totalCost += lot.remainingAmount * (lot.totalCost / lot.amount);
        }
      }
      
      if (totalAmount > 0) {
        holdings[asset] = {
          amount: totalAmount,
          avgCost: totalCost / totalAmount,
          totalCost
        };
      }
    }
    
    return holdings;
  }
  
  getLots(asset?: string): TaxLot[] {
    if (asset) {
      return this.lots.get(asset)?.filter(l => l.remainingAmount > 0) || [];
    }
    
    const allLots: TaxLot[] = [];
    for (const lots of this.lots.values()) {
      allLots.push(...lots.filter(l => l.remainingAmount > 0));
    }
    return allLots;
  }
  
  // --------------------------------------------------------
  // Persistence
  // --------------------------------------------------------
  
  private ensureDirectory(): void {
    if (!fs.existsSync(this.config.persistPath)) {
      fs.mkdirSync(this.config.persistPath, { recursive: true });
    }
  }
  
  private getDataFilePath(): string {
    return path.join(this.config.persistPath, 'tax-data.json');
  }
  
  private saveData(): void {
    const data = {
      config: this.config,
      trades: this.trades,
      lots: Array.from(this.lots.entries()),
      gains: this.gains
    };
    
    fs.writeFileSync(this.getDataFilePath(), JSON.stringify(data, null, 2));
  }
  
  private loadData(): void {
    const filePath = this.getDataFilePath();
    if (!fs.existsSync(filePath)) return;
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.trades = data.trades || [];
      this.lots = new Map(
        (data.lots || []).map(([asset, lots]: [string, TaxLot[]]) => [
          asset,
          lots.map(l => ({ ...l, acquiredAt: new Date(l.acquiredAt) }))
        ])
      );
      this.gains = (data.gains || []).map((g: CapitalGain) => ({
        ...g,
        disposedAt: new Date(g.disposedAt),
        acquiredAt: new Date(g.acquiredAt)
      }));
    } catch (error) {
      console.error('Failed to load tax data:', error);
    }
  }
  
  // --------------------------------------------------------
  // Utilities
  // --------------------------------------------------------
  
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  setConfig(updates: Partial<TaxConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveData();
  }
  
  getConfig(): TaxConfig {
    return { ...this.config };
  }
  
  clearData(): void {
    this.trades = [];
    this.lots = new Map();
    this.gains = [];
    this.saveData();
  }
}

// ============================================================
// FACTORY & EXPORT
// ============================================================

let taxTrackerInstance: TaxTracker | null = null;

export function createTaxTracker(config?: Partial<TaxConfig>): TaxTracker {
  if (!taxTrackerInstance) {
    taxTrackerInstance = new TaxTracker(config);
  }
  return taxTrackerInstance;
}

export function getTaxTracker(): TaxTracker {
  if (!taxTrackerInstance) {
    taxTrackerInstance = new TaxTracker();
  }
  return taxTrackerInstance;
}

export default TaxTracker;
