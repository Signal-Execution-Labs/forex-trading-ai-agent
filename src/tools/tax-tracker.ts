/**
 * K.I.T. Tax Tracker Tool
 * 
 * Issue #7: Tax Tracking & Reporting
 * 
 * Provides tax calculation and reporting capabilities:
 * - Track cost basis (FIFO, LIFO, HIFO, Specific ID)
 * - Calculate capital gains/losses
 * - Generate tax reports
 * - Support multiple tax jurisdictions
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { Trade, OrderSide } from './types';

export type CostBasisMethod = 'fifo' | 'lifo' | 'hifo' | 'specific';
export type TaxJurisdiction = 'us' | 'de' | 'uk' | 'generic';

export interface TaxLot {
  id: string;
  symbol: string;
  amount: number;
  costBasis: number;
  costPerUnit: number;
  acquiredAt: number;
  exchange?: string;
  tradeId?: string;
}

export interface DisposalEvent {
  id: string;
  symbol: string;
  amount: number;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  isShortTerm: boolean;
  disposedAt: number;
  acquiredAt: number;
  lotId: string;
  exchange?: string;
  tradeId?: string;
}

export interface TaxSummary {
  year: number;
  shortTermGains: number;
  shortTermLosses: number;
  longTermGains: number;
  longTermLosses: number;
  netShortTerm: number;
  netLongTerm: number;
  totalGainLoss: number;
  disposalCount: number;
  jurisdiction: TaxJurisdiction;
}

export interface TaxReport {
  period: { start: string; end: string };
  summary: TaxSummary;
  disposals: DisposalEvent[];
  unrealizedGains: { symbol: string; amount: number; costBasis: number; unrealized: number }[];
  generatedAt: number;
}

export interface TaxTrackerConfig {
  costBasisMethod: CostBasisMethod;
  jurisdiction: TaxJurisdiction;
  shortTermThresholdDays?: number;
  persistPath?: string;
}

const DEFAULT_CONFIG: TaxTrackerConfig = {
  costBasisMethod: 'fifo',
  jurisdiction: 'generic',
  shortTermThresholdDays: 365, // 1 year for most jurisdictions
  persistPath: path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'tax'),
};

// Jurisdiction-specific settings
const JURISDICTION_CONFIG: Record<TaxJurisdiction, { shortTermDays: number; name: string }> = {
  us: { shortTermDays: 365, name: 'United States' },
  de: { shortTermDays: 365, name: 'Germany (Spekulationsfrist)' },
  uk: { shortTermDays: 0, name: 'United Kingdom (no distinction)' },
  generic: { shortTermDays: 365, name: 'Generic' },
};

export class TaxTracker extends EventEmitter {
  private config: TaxTrackerConfig;
  private lots: Map<string, TaxLot[]> = new Map(); // symbol -> lots
  private disposals: DisposalEvent[] = [];

  constructor(config?: Partial<TaxTrackerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Apply jurisdiction-specific settings
    const jurisdictionSettings = JURISDICTION_CONFIG[this.config.jurisdiction];
    this.config.shortTermThresholdDays = jurisdictionSettings.shortTermDays;
    
    this.loadData();
  }

  /**
   * Record a buy transaction (adds tax lot)
   */
  recordBuy(params: {
    symbol: string;
    amount: number;
    price: number;
    timestamp: number;
    exchange?: string;
    tradeId?: string;
  }): TaxLot {
    const lot: TaxLot = {
      id: `lot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: params.symbol,
      amount: params.amount,
      costBasis: params.amount * params.price,
      costPerUnit: params.price,
      acquiredAt: params.timestamp,
      exchange: params.exchange,
      tradeId: params.tradeId,
    };

    const symbolLots = this.lots.get(params.symbol) || [];
    symbolLots.push(lot);
    this.lots.set(params.symbol, symbolLots);

    this.persistData();
    this.emit('lotAdded', lot);

    return lot;
  }

  /**
   * Record a sell transaction (disposes of lots, calculates gains)
   */
  recordSell(params: {
    symbol: string;
    amount: number;
    price: number;
    timestamp: number;
    exchange?: string;
    tradeId?: string;
    specificLotId?: string; // For specific identification method
  }): DisposalEvent[] {
    const symbolLots = this.lots.get(params.symbol) || [];
    
    if (symbolLots.length === 0) {
      throw new Error(`No tax lots found for ${params.symbol}`);
    }

    const totalAvailable = symbolLots.reduce((sum, lot) => sum + lot.amount, 0);
    if (totalAvailable < params.amount) {
      throw new Error(`Insufficient lots for ${params.symbol}: have ${totalAvailable}, need ${params.amount}`);
    }

    // Sort lots based on cost basis method
    const sortedLots = this.sortLotsByMethod(symbolLots, params.specificLotId);
    
    let remainingAmount = params.amount;
    const proceeds = params.amount * params.price;
    const events: DisposalEvent[] = [];
    const lotsToRemove: string[] = [];

    for (const lot of sortedLots) {
      if (remainingAmount <= 0) break;

      const disposedAmount = Math.min(remainingAmount, lot.amount);
      const disposedCostBasis = (disposedAmount / lot.amount) * lot.costBasis;
      const disposedProceeds = (disposedAmount / params.amount) * proceeds;
      const gainLoss = disposedProceeds - disposedCostBasis;

      const holdingPeriodMs = params.timestamp - lot.acquiredAt;
      const holdingPeriodDays = holdingPeriodMs / (1000 * 60 * 60 * 24);
      const isShortTerm = holdingPeriodDays < (this.config.shortTermThresholdDays || 365);

      const disposal: DisposalEvent = {
        id: `disposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol: params.symbol,
        amount: disposedAmount,
        proceeds: disposedProceeds,
        costBasis: disposedCostBasis,
        gainLoss,
        isShortTerm,
        disposedAt: params.timestamp,
        acquiredAt: lot.acquiredAt,
        lotId: lot.id,
        exchange: params.exchange,
        tradeId: params.tradeId,
      };

      events.push(disposal);
      this.disposals.push(disposal);

      // Update or remove lot
      lot.amount -= disposedAmount;
      lot.costBasis -= disposedCostBasis;

      if (lot.amount <= 0.00000001) {
        lotsToRemove.push(lot.id);
      }

      remainingAmount -= disposedAmount;
    }

    // Remove depleted lots
    const updatedLots = symbolLots.filter(lot => !lotsToRemove.includes(lot.id));
    this.lots.set(params.symbol, updatedLots);

    this.persistData();
    for (const event of events) {
      this.emit('disposal', event);
    }

    return events;
  }

  /**
   * Record a trade (auto-detects buy/sell)
   */
  recordTrade(trade: Trade): DisposalEvent[] | TaxLot {
    const baseAsset = trade.symbol.split('/')[0];
    
    if (trade.side === 'buy') {
      return this.recordBuy({
        symbol: baseAsset,
        amount: trade.amount,
        price: trade.price,
        timestamp: trade.timestamp,
        tradeId: trade.id,
      });
    } else {
      return this.recordSell({
        symbol: baseAsset,
        amount: trade.amount,
        price: trade.price,
        timestamp: trade.timestamp,
        tradeId: trade.id,
      });
    }
  }

  /**
   * Get tax summary for a year
   */
  getSummary(year: number): TaxSummary {
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year + 1, 0, 1).getTime();

    const yearDisposals = this.disposals.filter(
      d => d.disposedAt >= yearStart && d.disposedAt < yearEnd
    );

    let shortTermGains = 0, shortTermLosses = 0;
    let longTermGains = 0, longTermLosses = 0;

    for (const disposal of yearDisposals) {
      if (disposal.isShortTerm) {
        if (disposal.gainLoss >= 0) shortTermGains += disposal.gainLoss;
        else shortTermLosses += Math.abs(disposal.gainLoss);
      } else {
        if (disposal.gainLoss >= 0) longTermGains += disposal.gainLoss;
        else longTermLosses += Math.abs(disposal.gainLoss);
      }
    }

    return {
      year,
      shortTermGains,
      shortTermLosses,
      longTermGains,
      longTermLosses,
      netShortTerm: shortTermGains - shortTermLosses,
      netLongTerm: longTermGains - longTermLosses,
      totalGainLoss: (shortTermGains - shortTermLosses) + (longTermGains - longTermLosses),
      disposalCount: yearDisposals.length,
      jurisdiction: this.config.jurisdiction,
    };
  }

  /**
   * Generate full tax report
   */
  generateReport(year: number): TaxReport {
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year + 1, 0, 1).getTime();

    const yearDisposals = this.disposals.filter(
      d => d.disposedAt >= yearStart && d.disposedAt < yearEnd
    );

    // Calculate unrealized gains
    const unrealizedGains: TaxReport['unrealizedGains'] = [];
    // Note: Would need current prices - placeholder
    for (const [symbol, lots] of this.lots) {
      const totalAmount = lots.reduce((sum, lot) => sum + lot.amount, 0);
      const totalCostBasis = lots.reduce((sum, lot) => sum + lot.costBasis, 0);
      
      if (totalAmount > 0) {
        unrealizedGains.push({
          symbol,
          amount: totalAmount,
          costBasis: totalCostBasis,
          unrealized: 0, // Would need current price
        });
      }
    }

    return {
      period: {
        start: new Date(yearStart).toISOString().split('T')[0],
        end: new Date(yearEnd - 1).toISOString().split('T')[0],
      },
      summary: this.getSummary(year),
      disposals: yearDisposals.sort((a, b) => a.disposedAt - b.disposedAt),
      unrealizedGains,
      generatedAt: Date.now(),
    };
  }

  /**
   * Export report as CSV
   */
  exportCSV(year: number): string {
    const report = this.generateReport(year);
    
    const headers = [
      'Date', 'Symbol', 'Amount', 'Proceeds', 'Cost Basis', 
      'Gain/Loss', 'Type', 'Acquired Date', 'Holding Days'
    ].join(',');

    const rows = report.disposals.map(d => {
      const disposedDate = new Date(d.disposedAt).toISOString().split('T')[0];
      const acquiredDate = new Date(d.acquiredAt).toISOString().split('T')[0];
      const holdingDays = Math.floor((d.disposedAt - d.acquiredAt) / (1000 * 60 * 60 * 24));
      
      return [
        disposedDate,
        d.symbol,
        d.amount.toFixed(8),
        d.proceeds.toFixed(2),
        d.costBasis.toFixed(2),
        d.gainLoss.toFixed(2),
        d.isShortTerm ? 'Short-Term' : 'Long-Term',
        acquiredDate,
        holdingDays,
      ].join(',');
    });

    return [headers, ...rows].join('\n');
  }

  /**
   * Get current lots for a symbol
   */
  getLots(symbol?: string): TaxLot[] {
    if (symbol) {
      return this.lots.get(symbol) || [];
    }
    return Array.from(this.lots.values()).flat();
  }

  /**
   * Get disposal history
   */
  getDisposals(year?: number): DisposalEvent[] {
    if (year) {
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year + 1, 0, 1).getTime();
      return this.disposals.filter(d => d.disposedAt >= yearStart && d.disposedAt < yearEnd);
    }
    return [...this.disposals];
  }

  /**
   * Change cost basis method
   */
  setCostBasisMethod(method: CostBasisMethod): void {
    this.config.costBasisMethod = method;
    this.emit('methodChanged', method);
  }

  /**
   * Get total cost basis across all holdings
   */
  getTotalCostBasis(): number {
    let total = 0;
    for (const lots of this.lots.values()) {
      total += lots.reduce((sum, lot) => sum + lot.costBasis, 0);
    }
    return total;
  }

  // Private methods

  private sortLotsByMethod(lots: TaxLot[], specificLotId?: string): TaxLot[] {
    if (specificLotId) {
      const specific = lots.find(l => l.id === specificLotId);
      if (specific) return [specific, ...lots.filter(l => l.id !== specificLotId)];
    }

    const sortedLots = [...lots];

    switch (this.config.costBasisMethod) {
      case 'fifo': // First In, First Out
        return sortedLots.sort((a, b) => a.acquiredAt - b.acquiredAt);
      
      case 'lifo': // Last In, First Out
        return sortedLots.sort((a, b) => b.acquiredAt - a.acquiredAt);
      
      case 'hifo': // Highest In, First Out (minimizes gains)
        return sortedLots.sort((a, b) => b.costPerUnit - a.costPerUnit);
      
      default:
        return sortedLots;
    }
  }

  private loadData(): void {
    if (!this.config.persistPath) return;
    try {
      const lotsPath = path.join(this.config.persistPath, 'lots.json');
      const disposalsPath = path.join(this.config.persistPath, 'disposals.json');

      if (fs.existsSync(lotsPath)) {
        const lotsData = JSON.parse(fs.readFileSync(lotsPath, 'utf-8'));
        for (const [symbol, lots] of Object.entries(lotsData)) {
          this.lots.set(symbol, lots as TaxLot[]);
        }
      }

      if (fs.existsSync(disposalsPath)) {
        this.disposals = JSON.parse(fs.readFileSync(disposalsPath, 'utf-8'));
      }

      console.log(`Loaded ${this.lots.size} symbols, ${this.disposals.length} disposals`);
    } catch (e: any) {
      console.warn('Could not load tax data:', e.message);
    }
  }

  private persistData(): void {
    if (!this.config.persistPath) return;
    try {
      if (!fs.existsSync(this.config.persistPath)) {
        fs.mkdirSync(this.config.persistPath, { recursive: true });
      }

      const lotsObj: Record<string, TaxLot[]> = {};
      for (const [symbol, lots] of this.lots) {
        lotsObj[symbol] = lots;
      }

      fs.writeFileSync(
        path.join(this.config.persistPath, 'lots.json'),
        JSON.stringify(lotsObj, null, 2)
      );

      fs.writeFileSync(
        path.join(this.config.persistPath, 'disposals.json'),
        JSON.stringify(this.disposals, null, 2)
      );
    } catch (e: any) {
      console.error('Could not persist tax data:', e.message);
    }
  }
}

export function createTaxTracker(config?: Partial<TaxTrackerConfig>): TaxTracker {
  return new TaxTracker(config);
}

export default TaxTracker;
