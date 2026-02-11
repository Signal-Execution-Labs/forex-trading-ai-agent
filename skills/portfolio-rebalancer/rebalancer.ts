/**
 * Portfolio Rebalancer - Core Logic
 * 
 * Maintains target allocations across multiple exchanges with
 * intelligent drift detection and tax-efficient execution.
 */

import { createLogger } from '../../src/core/logger';

const logger = createLogger('skill:rebalancer');

// ============================================================================
// Types
// ============================================================================

export interface PortfolioTarget {
  asset: string;
  targetPercent: number;
  minPercent?: number;  // Band lower bound
  maxPercent?: number;  // Band upper bound
}

export interface PortfolioHolding {
  asset: string;
  quantity: number;
  valueUSD: number;
  exchange: string;
  costBasis?: number;
  acquiredAt?: Date;
}

export interface DriftAnalysis {
  asset: string;
  currentPercent: number;
  targetPercent: number;
  driftPercent: number;
  driftUSD: number;
  status: 'overweight' | 'underweight' | 'on-target';
  requiresAction: boolean;
}

export interface RebalanceTrade {
  asset: string;
  side: 'buy' | 'sell';
  quantity: number;
  valueUSD: number;
  fromExchange?: string;
  toExchange?: string;
  taxLot?: TaxLot;
  estimatedFees?: number;
  priority: number;
}

export interface TaxLot {
  id: string;
  asset: string;
  quantity: number;
  costBasis: number;
  acquiredAt: Date;
  isLongTerm: boolean;
  unrealizedGainUSD: number;
}

export interface RebalanceConfig {
  strategy: 'threshold' | 'calendar' | 'cash-flow' | 'band';
  driftThreshold: number;       // % drift to trigger rebalance
  minTradeValue: number;        // Minimum trade size in USD
  
  execution: {
    slippageTolerance: number;
    useLimitOrders: boolean;
    splitLargeOrders: boolean;
    splitThreshold: number;
    preferDex: boolean;
  };
  
  tax: {
    enableTLH: boolean;         // Tax-loss harvesting
    lotSelection: 'fifo' | 'lifo' | 'hifo' | 'specific';
    washSaleDays: number;
    longTermPreference: boolean;
  };
  
  risk: {
    maxSingleAsset: number;     // Max % in single asset
    maxCorrelation: number;
    minCashReserve: number;
    drawdownReduceAt: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultConfig: RebalanceConfig = {
  strategy: 'threshold',
  driftThreshold: 5,
  minTradeValue: 100,
  
  execution: {
    slippageTolerance: 0.5,
    useLimitOrders: true,
    splitLargeOrders: true,
    splitThreshold: 10000,
    preferDex: false,
  },
  
  tax: {
    enableTLH: true,
    lotSelection: 'hifo',
    washSaleDays: 30,
    longTermPreference: true,
  },
  
  risk: {
    maxSingleAsset: 50,
    maxCorrelation: 0.8,
    minCashReserve: 10,
    drawdownReduceAt: 20,
  },
};

// ============================================================================
// Portfolio Rebalancer Class
// ============================================================================

export class PortfolioRebalancer {
  private targets: Map<string, PortfolioTarget> = new Map();
  private holdings: Map<string, PortfolioHolding[]> = new Map();
  private config: RebalanceConfig;
  private taxLots: TaxLot[] = [];
  
  constructor(config: Partial<RebalanceConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }
  
  // ---------------------------------------------------------------------------
  // Target Management
  // ---------------------------------------------------------------------------
  
  setTarget(asset: string, targetPercent: number, bands?: { min?: number; max?: number }): void {
    this.targets.set(asset, {
      asset,
      targetPercent,
      minPercent: bands?.min ?? targetPercent - this.config.driftThreshold,
      maxPercent: bands?.max ?? targetPercent + this.config.driftThreshold,
    });
    logger.info(`Target set: ${asset} = ${targetPercent}%`);
  }
  
  setTargets(targets: Record<string, number>): void {
    // Validate targets sum to 100%
    const total = Object.values(targets).reduce((sum, pct) => sum + pct, 0);
    if (Math.abs(total - 100) > 0.1) {
      throw new Error(`Targets must sum to 100%, got ${total}%`);
    }
    
    for (const [asset, pct] of Object.entries(targets)) {
      this.setTarget(asset, pct);
    }
  }
  
  getTargets(): PortfolioTarget[] {
    return Array.from(this.targets.values());
  }
  
  // ---------------------------------------------------------------------------
  // Holdings Management
  // ---------------------------------------------------------------------------
  
  updateHoldings(holdings: PortfolioHolding[]): void {
    this.holdings.clear();
    
    for (const holding of holdings) {
      if (!this.holdings.has(holding.asset)) {
        this.holdings.set(holding.asset, []);
      }
      this.holdings.get(holding.asset)!.push(holding);
    }
    
    logger.info(`Updated holdings: ${holdings.length} positions across ${this.holdings.size} assets`);
  }
  
  getTotalValue(): number {
    let total = 0;
    for (const holdings of this.holdings.values()) {
      for (const h of holdings) {
        total += h.valueUSD;
      }
    }
    return total;
  }
  
  getHoldingsByAsset(asset: string): PortfolioHolding[] {
    return this.holdings.get(asset) || [];
  }
  
  // ---------------------------------------------------------------------------
  // Drift Analysis
  // ---------------------------------------------------------------------------
  
  analyzeDrift(): DriftAnalysis[] {
    const totalValue = this.getTotalValue();
    if (totalValue === 0) return [];
    
    const analysis: DriftAnalysis[] = [];
    
    // Analyze each target
    for (const target of this.targets.values()) {
      const holdings = this.holdings.get(target.asset) || [];
      const currentValue = holdings.reduce((sum, h) => sum + h.valueUSD, 0);
      const currentPercent = (currentValue / totalValue) * 100;
      const driftPercent = currentPercent - target.targetPercent;
      const driftUSD = (driftPercent / 100) * totalValue;
      
      let status: DriftAnalysis['status'] = 'on-target';
      if (driftPercent > this.config.driftThreshold) status = 'overweight';
      else if (driftPercent < -this.config.driftThreshold) status = 'underweight';
      
      const requiresAction = Math.abs(driftPercent) > this.config.driftThreshold;
      
      analysis.push({
        asset: target.asset,
        currentPercent,
        targetPercent: target.targetPercent,
        driftPercent,
        driftUSD,
        status,
        requiresAction,
      });
    }
    
    // Check for assets we hold but don't have targets for
    for (const [asset, holdings] of this.holdings) {
      if (!this.targets.has(asset)) {
        const currentValue = holdings.reduce((sum, h) => sum + h.valueUSD, 0);
        const currentPercent = (currentValue / totalValue) * 100;
        
        if (currentPercent > 0.1) { // Ignore dust
          analysis.push({
            asset,
            currentPercent,
            targetPercent: 0,
            driftPercent: currentPercent,
            driftUSD: currentValue,
            status: 'overweight',
            requiresAction: true,
          });
        }
      }
    }
    
    // Sort by absolute drift (largest first)
    analysis.sort((a, b) => Math.abs(b.driftPercent) - Math.abs(a.driftPercent));
    
    return analysis;
  }
  
  // ---------------------------------------------------------------------------
  // Rebalancing Logic
  // ---------------------------------------------------------------------------
  
  calculateRebalanceTrades(): RebalanceTrade[] {
    const drift = this.analyzeDrift();
    const trades: RebalanceTrade[] = [];
    const totalValue = this.getTotalValue();
    
    // Separate sells and buys
    const sells = drift.filter(d => d.status === 'overweight' && d.requiresAction);
    const buys = drift.filter(d => d.status === 'underweight' && d.requiresAction);
    
    // Process sells first (generate cash)
    for (const item of sells) {
      const sellValueUSD = Math.abs(item.driftUSD);
      
      if (sellValueUSD < this.config.minTradeValue) continue;
      
      const holdings = this.getHoldingsByAsset(item.asset);
      const totalHolding = holdings.reduce((sum, h) => sum + h.quantity, 0);
      const avgPrice = holdings.reduce((sum, h) => sum + h.valueUSD, 0) / totalHolding;
      const sellQuantity = sellValueUSD / avgPrice;
      
      // Select tax lot if tax optimization enabled
      let taxLot: TaxLot | undefined;
      if (this.config.tax.enableTLH) {
        taxLot = this.selectTaxLot(item.asset, sellQuantity);
      }
      
      trades.push({
        asset: item.asset,
        side: 'sell',
        quantity: sellQuantity,
        valueUSD: sellValueUSD,
        fromExchange: this.selectBestExchange(holdings),
        taxLot,
        priority: Math.abs(item.driftPercent),
      });
    }
    
    // Process buys
    for (const item of buys) {
      const buyValueUSD = Math.abs(item.driftUSD);
      
      if (buyValueUSD < this.config.minTradeValue) continue;
      
      // Estimate quantity based on current price
      const currentPrice = this.estimatePrice(item.asset);
      const buyQuantity = buyValueUSD / currentPrice;
      
      trades.push({
        asset: item.asset,
        side: 'buy',
        quantity: buyQuantity,
        valueUSD: buyValueUSD,
        toExchange: this.config.execution.preferDex ? 'dex' : 'binance',
        priority: Math.abs(item.driftPercent),
      });
    }
    
    // Sort by priority
    trades.sort((a, b) => b.priority - a.priority);
    
    return trades;
  }
  
  // ---------------------------------------------------------------------------
  // Tax Optimization
  // ---------------------------------------------------------------------------
  
  setTaxLots(lots: TaxLot[]): void {
    this.taxLots = lots;
  }
  
  private selectTaxLot(asset: string, quantity: number): TaxLot | undefined {
    const lots = this.taxLots.filter(l => l.asset === asset && l.quantity >= quantity);
    if (lots.length === 0) return undefined;
    
    switch (this.config.tax.lotSelection) {
      case 'fifo':
        lots.sort((a, b) => a.acquiredAt.getTime() - b.acquiredAt.getTime());
        break;
      case 'lifo':
        lots.sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime());
        break;
      case 'hifo':
        lots.sort((a, b) => b.costBasis - a.costBasis);
        break;
    }
    
    // If long-term preference, prefer lots > 1 year
    if (this.config.tax.longTermPreference) {
      const longTermLots = lots.filter(l => l.isLongTerm);
      if (longTermLots.length > 0) {
        return longTermLots[0];
      }
    }
    
    return lots[0];
  }
  
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  
  private selectBestExchange(holdings: PortfolioHolding[]): string {
    // Return exchange with largest holding
    let best = holdings[0];
    for (const h of holdings) {
      if (h.valueUSD > best.valueUSD) {
        best = h;
      }
    }
    return best.exchange;
  }
  
  private estimatePrice(asset: string): number {
    // In real implementation, would fetch from price oracle
    const prices: Record<string, number> = {
      BTC: 98500,
      ETH: 2650,
      SOL: 65,
      USDC: 1,
      SPY: 595,
    };
    return prices[asset] || 100;
  }
  
  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------
  
  async executeRebalance(trades: RebalanceTrade[]): Promise<{
    executed: RebalanceTrade[];
    failed: Array<{ trade: RebalanceTrade; error: string }>;
  }> {
    const executed: RebalanceTrade[] = [];
    const failed: Array<{ trade: RebalanceTrade; error: string }> = [];
    
    for (const trade of trades) {
      try {
        // In real implementation, would call exchange APIs
        logger.info(`Executing ${trade.side} ${trade.quantity} ${trade.asset} ($${trade.valueUSD.toFixed(2)})`);
        
        // Simulate execution
        await new Promise(resolve => setTimeout(resolve, 100));
        
        executed.push(trade);
        logger.info(`✅ ${trade.side.toUpperCase()} executed: ${trade.asset}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        failed.push({ trade, error: errMsg });
        logger.error(`❌ ${trade.side.toUpperCase()} failed: ${trade.asset} - ${errMsg}`);
      }
    }
    
    return { executed, failed };
  }
  
  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  
  generateSummary(): string {
    const drift = this.analyzeDrift();
    const totalValue = this.getTotalValue();
    const needsAction = drift.filter(d => d.requiresAction);
    
    let summary = `📊 Portfolio Summary\n\n`;
    summary += `Total Value: $${totalValue.toLocaleString()}\n`;
    summary += `Assets: ${drift.length}\n`;
    summary += `Needs Rebalancing: ${needsAction.length > 0 ? 'Yes' : 'No'}\n\n`;
    
    summary += `Asset Allocation:\n`;
    for (const item of drift) {
      const indicator = item.status === 'overweight' ? '▲' : item.status === 'underweight' ? '▼' : '●';
      summary += `  ${indicator} ${item.asset}: ${item.currentPercent.toFixed(1)}% (target: ${item.targetPercent}%, drift: ${item.driftPercent > 0 ? '+' : ''}${item.driftPercent.toFixed(1)}%)\n`;
    }
    
    if (needsAction.length > 0) {
      summary += `\n⚠️ ${needsAction.length} asset(s) exceed ${this.config.driftThreshold}% drift threshold.\n`;
    }
    
    return summary;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createRebalancer(config?: Partial<RebalanceConfig>): PortfolioRebalancer {
  return new PortfolioRebalancer(config);
}
