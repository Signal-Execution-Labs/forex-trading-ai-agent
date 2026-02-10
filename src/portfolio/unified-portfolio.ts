/**
 * K.I.T. Unified Portfolio Manager
 * 
 * Aggregates all financial assets across ALL platforms into ONE view:
 * - CEX balances (Binance, Coinbase, etc.)
 * - DEX positions (Uniswap LP, etc.)
 * - DeFi positions (Aave, Lido, etc.)
 * - Forex/MT5 positions
 * - Wallet addresses (ETH, BTC, etc.)
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/22
 */

import { EventEmitter } from 'events';

// ============================================
// Types
// ============================================

export type AssetClass = 'crypto' | 'defi' | 'forex' | 'stocks' | 'commodities' | 'cash';
export type Platform = 'cex' | 'dex' | 'defi' | 'mt5' | 'broker' | 'wallet';

export interface AssetPosition {
  /** Unique identifier */
  id: string;
  
  /** Asset symbol */
  symbol: string;
  
  /** Human-readable name */
  name: string;
  
  /** Asset class */
  class: AssetClass;
  
  /** Platform type */
  platform: Platform;
  
  /** Specific platform name (e.g., "Binance", "Aave", "RoboForex") */
  source: string;
  
  /** Chain for crypto assets */
  chain?: string;
  
  /** Quantity held */
  quantity: number;
  
  /** Current price in USD */
  priceUsd: number;
  
  /** Total value in USD */
  valueUsd: number;
  
  /** Entry/average cost (if known) */
  costBasis?: number;
  
  /** Unrealized P&L */
  pnl?: number;
  pnlPercent?: number;
  
  /** Additional metadata */
  meta?: Record<string, any>;
  
  /** Last updated */
  updatedAt: Date;
}

export interface PortfolioSummary {
  /** Total net worth */
  totalValueUsd: number;
  
  /** Total P&L */
  totalPnl: number;
  totalPnlPercent: number;
  
  /** Breakdown by asset class */
  byClass: {
    class: AssetClass;
    valueUsd: number;
    percentage: number;
    positions: number;
  }[];
  
  /** Breakdown by platform */
  byPlatform: {
    platform: string;
    valueUsd: number;
    percentage: number;
    positions: number;
  }[];
  
  /** Top holdings */
  topHoldings: AssetPosition[];
  
  /** Timestamp */
  timestamp: Date;
}

export interface PnLReport {
  /** Time period */
  period: '24h' | '7d' | '30d' | 'all';
  
  /** Starting value */
  startValue: number;
  
  /** Current value */
  currentValue: number;
  
  /** Absolute change */
  change: number;
  
  /** Percentage change */
  changePercent: number;
  
  /** Best performer */
  bestPerformer?: { symbol: string; changePercent: number };
  
  /** Worst performer */
  worstPerformer?: { symbol: string; changePercent: number };
}

export interface UnifiedPortfolioConfig {
  /** Auto-refresh interval in ms (0 = disabled) */
  refreshInterval?: number;
  
  /** Cache duration in ms */
  cacheDuration?: number;
  
  /** Verbose logging */
  verbose?: boolean;
}

// ============================================
// Data Source Interfaces
// ============================================

export interface PortfolioDataSource {
  name: string;
  platform: Platform;
  isConnected(): boolean;
  connect(): Promise<boolean>;
  getPositions(): Promise<AssetPosition[]>;
  disconnect(): void;
}

// ============================================
// Unified Portfolio Manager
// ============================================

const DEFAULT_CONFIG: UnifiedPortfolioConfig = {
  refreshInterval: 60000, // 1 minute
  cacheDuration: 30000,   // 30 seconds
  verbose: true
};

/**
 * Unified Portfolio Manager - All assets, one view
 */
export class UnifiedPortfolio extends EventEmitter {
  private config: UnifiedPortfolioConfig;
  private sources: PortfolioDataSource[] = [];
  private positions: AssetPosition[] = [];
  private lastRefresh: Date | null = null;
  private refreshTimer?: ReturnType<typeof setInterval>;
  
  constructor(config: UnifiedPortfolioConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // ============================================
  // Source Management
  // ============================================
  
  /**
   * Register a data source
   */
  addSource(source: PortfolioDataSource): void {
    this.sources.push(source);
    if (this.config.verbose) {
      console.log(`📊 Added portfolio source: ${source.name} (${source.platform})`);
    }
  }
  
  /**
   * Remove a data source
   */
  removeSource(name: string): void {
    const idx = this.sources.findIndex(s => s.name === name);
    if (idx >= 0) {
      this.sources[idx].disconnect();
      this.sources.splice(idx, 1);
    }
  }
  
  /**
   * Get registered sources
   */
  getSources(): { name: string; platform: Platform; connected: boolean }[] {
    return this.sources.map(s => ({
      name: s.name,
      platform: s.platform,
      connected: s.isConnected()
    }));
  }
  
  // ============================================
  // Lifecycle
  // ============================================
  
  /**
   * Connect all sources and start monitoring
   */
  async start(): Promise<void> {
    // Connect all sources
    for (const source of this.sources) {
      try {
        await source.connect();
        console.log(`✅ Connected to ${source.name}`);
      } catch (error: any) {
        console.error(`❌ Failed to connect to ${source.name}: ${error.message}`);
      }
    }
    
    // Start auto-refresh
    if (this.config.refreshInterval && this.config.refreshInterval > 0) {
      this.refreshTimer = setInterval(() => {
        this.refresh();
      }, this.config.refreshInterval);
    }
    
    // Initial refresh
    await this.refresh();
  }
  
  /**
   * Stop monitoring and disconnect all sources
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    
    for (const source of this.sources) {
      source.disconnect();
    }
  }
  
  // ============================================
  // Data Retrieval
  // ============================================
  
  /**
   * Refresh all positions from all sources
   */
  async refresh(): Promise<AssetPosition[]> {
    const allPositions: AssetPosition[] = [];
    
    for (const source of this.sources) {
      if (!source.isConnected()) continue;
      
      try {
        const positions = await source.getPositions();
        allPositions.push(...positions);
        
        if (this.config.verbose) {
          console.log(`📦 ${source.name}: ${positions.length} positions`);
        }
      } catch (error: any) {
        console.error(`Error fetching from ${source.name}: ${error.message}`);
      }
    }
    
    this.positions = allPositions;
    this.lastRefresh = new Date();
    
    this.emit('refresh', this.positions);
    return this.positions;
  }
  
  /**
   * Get all positions
   */
  getPositions(): AssetPosition[] {
    return [...this.positions];
  }
  
  /**
   * Get positions by asset class
   */
  getPositionsByClass(assetClass: AssetClass): AssetPosition[] {
    return this.positions.filter(p => p.class === assetClass);
  }
  
  /**
   * Get positions by platform
   */
  getPositionsByPlatform(platform: Platform): AssetPosition[] {
    return this.positions.filter(p => p.platform === platform);
  }
  
  /**
   * Get positions by source
   */
  getPositionsBySource(source: string): AssetPosition[] {
    return this.positions.filter(p => p.source === source);
  }
  
  // ============================================
  // Portfolio Analysis
  // ============================================
  
  /**
   * Get portfolio summary
   */
  getSummary(): PortfolioSummary {
    const totalValueUsd = this.positions.reduce((sum, p) => sum + p.valueUsd, 0);
    const totalCostBasis = this.positions.reduce((sum, p) => sum + (p.costBasis || p.valueUsd), 0);
    const totalPnl = totalValueUsd - totalCostBasis;
    const totalPnlPercent = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;
    
    // Group by class
    const byClassMap = new Map<AssetClass, { valueUsd: number; positions: number }>();
    for (const p of this.positions) {
      const existing = byClassMap.get(p.class) || { valueUsd: 0, positions: 0 };
      existing.valueUsd += p.valueUsd;
      existing.positions++;
      byClassMap.set(p.class, existing);
    }
    
    const byClass = Array.from(byClassMap.entries()).map(([cls, data]) => ({
      class: cls,
      valueUsd: data.valueUsd,
      percentage: totalValueUsd > 0 ? (data.valueUsd / totalValueUsd) * 100 : 0,
      positions: data.positions
    })).sort((a, b) => b.valueUsd - a.valueUsd);
    
    // Group by platform
    const byPlatformMap = new Map<string, { valueUsd: number; positions: number }>();
    for (const p of this.positions) {
      const existing = byPlatformMap.get(p.source) || { valueUsd: 0, positions: 0 };
      existing.valueUsd += p.valueUsd;
      existing.positions++;
      byPlatformMap.set(p.source, existing);
    }
    
    const byPlatform = Array.from(byPlatformMap.entries()).map(([platform, data]) => ({
      platform,
      valueUsd: data.valueUsd,
      percentage: totalValueUsd > 0 ? (data.valueUsd / totalValueUsd) * 100 : 0,
      positions: data.positions
    })).sort((a, b) => b.valueUsd - a.valueUsd);
    
    // Top holdings
    const topHoldings = [...this.positions]
      .sort((a, b) => b.valueUsd - a.valueUsd)
      .slice(0, 10);
    
    return {
      totalValueUsd,
      totalPnl,
      totalPnlPercent,
      byClass,
      byPlatform,
      topHoldings,
      timestamp: new Date()
    };
  }
  
  /**
   * Get total net worth
   */
  getNetWorth(): number {
    return this.positions.reduce((sum, p) => sum + p.valueUsd, 0);
  }
  
  /**
   * Get exposure by asset
   */
  getExposure(symbol: string): { total: number; positions: AssetPosition[] } {
    const positions = this.positions.filter(p => 
      p.symbol.toUpperCase() === symbol.toUpperCase()
    );
    const total = positions.reduce((sum, p) => sum + p.valueUsd, 0);
    return { total, positions };
  }
  
  // ============================================
  // Formatted Output
  // ============================================
  
  /**
   * Get formatted portfolio overview
   */
  getFormattedOverview(): string {
    const summary = this.getSummary();
    const pnlEmoji = summary.totalPnl >= 0 ? '📈' : '📉';
    
    const lines = [
      '',
      '╔═══════════════════════════════════════════════════════════╗',
      '║           K.I.T. UNIFIED PORTFOLIO                        ║',
      '╚═══════════════════════════════════════════════════════════╝',
      '',
      `💰 NET WORTH: $${summary.totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `${pnlEmoji} P&L: $${summary.totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${summary.totalPnlPercent.toFixed(2)}%)`,
      '',
      '📊 BY ASSET CLASS',
      '─────────────────────────────────────────────────────────────'
    ];
    
    for (const cls of summary.byClass) {
      const bar = '█'.repeat(Math.round(cls.percentage / 5)) + '░'.repeat(20 - Math.round(cls.percentage / 5));
      lines.push(`  ${cls.class.padEnd(12)} ${bar} ${cls.percentage.toFixed(1)}% ($${(cls.valueUsd / 1000).toFixed(1)}k)`);
    }
    
    lines.push(
      '',
      '🏦 BY PLATFORM',
      '─────────────────────────────────────────────────────────────'
    );
    
    for (const plat of summary.byPlatform.slice(0, 5)) {
      lines.push(`  ${plat.platform.padEnd(15)} $${plat.valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(12)} (${plat.percentage.toFixed(1)}%)`);
    }
    
    lines.push(
      '',
      '🏆 TOP HOLDINGS',
      '─────────────────────────────────────────────────────────────'
    );
    
    for (const h of summary.topHoldings.slice(0, 5)) {
      const pnlStr = h.pnlPercent ? ` (${h.pnlPercent >= 0 ? '+' : ''}${h.pnlPercent.toFixed(1)}%)` : '';
      lines.push(`  ${h.symbol.padEnd(10)} ${h.quantity.toFixed(4).padStart(12)} = $${h.valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(10)}${pnlStr}`);
    }
    
    lines.push(
      '',
      `🕐 Last updated: ${summary.timestamp.toISOString()}`,
      ''
    );
    
    return lines.join('\n');
  }
  
  /**
   * Get formatted P&L report
   */
  getFormattedPnL(): string {
    const lines = [
      '',
      '╔═══════════════════════════════════════════════════════════╗',
      '║           K.I.T. P&L REPORT                               ║',
      '╚═══════════════════════════════════════════════════════════╝',
      ''
    ];
    
    // Group by symbol to show individual P&L
    const bySymbol = new Map<string, { pnl: number; value: number }>();
    for (const p of this.positions) {
      if (p.pnl === undefined) continue;
      const existing = bySymbol.get(p.symbol) || { pnl: 0, value: 0 };
      existing.pnl += p.pnl;
      existing.value += p.valueUsd;
      bySymbol.set(p.symbol, existing);
    }
    
    const sorted = Array.from(bySymbol.entries())
      .map(([symbol, data]) => ({ symbol, ...data, percent: (data.pnl / (data.value - data.pnl)) * 100 }))
      .sort((a, b) => b.pnl - a.pnl);
    
    lines.push('Symbol      Value           P&L         %');
    lines.push('───────────────────────────────────────────────');
    
    for (const item of sorted.slice(0, 15)) {
      const emoji = item.pnl >= 0 ? '🟢' : '🔴';
      const sign = item.pnl >= 0 ? '+' : '';
      lines.push(
        `${emoji} ${item.symbol.padEnd(8)} $${item.value.toFixed(2).padStart(10)} ` +
        `${sign}$${item.pnl.toFixed(2).padStart(8)} ${sign}${item.percent.toFixed(1)}%`
      );
    }
    
    lines.push('');
    return lines.join('\n');
  }
}

/**
 * Factory function
 */
export function createUnifiedPortfolio(config?: UnifiedPortfolioConfig): UnifiedPortfolio {
  return new UnifiedPortfolio(config);
}
