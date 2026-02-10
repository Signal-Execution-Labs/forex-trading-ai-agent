/**
 * K.I.T. Multi-Asset Manager
 * Issue #2: Unified interface for Crypto, Forex, Stocks, ETFs, DeFi
 * 
 * One interface to rule them all!
 */

import { DeFiConnector, createDeFiConnector, DeFiPosition } from './defi-connector';
import { StockConnector, createStockConnector, StockPosition, AccountInfo as StockAccountInfo } from './stock-connector';

// ============================================================
// TYPES
// ============================================================

export type AssetCategory = 'crypto' | 'forex' | 'stocks' | 'etfs' | 'defi';

export interface UnifiedPosition {
  id: string;
  category: AssetCategory;
  source: string;  // Exchange/Broker/Protocol name
  
  // Core fields
  symbol: string;
  amount: number;
  valueUsd: number;
  entryPrice?: number;
  currentPrice?: number;
  
  // P&L
  unrealizedPL: number;
  unrealizedPLPercent: number;
  
  // Additional info
  apy?: number;  // For staking/lending
  healthFactor?: number;  // For DeFi lending
  side?: 'long' | 'short';
  
  // Metadata
  lastUpdate: Date;
}

export interface PortfolioSummary {
  totalValueUsd: number;
  totalPL: number;
  totalPLPercent: number;
  
  byCategory: Record<AssetCategory, {
    valueUsd: number;
    percentage: number;
    positions: number;
    pl: number;
  }>;
  
  topPerformers: UnifiedPosition[];
  worstPerformers: UnifiedPosition[];
  
  positions: UnifiedPosition[];
}

export interface MultiAssetConfig {
  crypto?: {
    exchanges: string[];  // e.g., ['binance', 'kraken']
  };
  forex?: {
    mt5Account?: number;
    mt5Server?: string;
    mt5Password?: string;
  };
  stocks?: {
    broker: 'alpaca' | 'ibkr';
    apiKey?: string;
    apiSecret?: string;
    paper?: boolean;
  };
  defi?: {
    enabled: boolean;
    wallets?: Record<string, string>;
  };
}

// ============================================================
// MOCK DATA (for demo/testing)
// ============================================================

const MOCK_CRYPTO_POSITIONS: UnifiedPosition[] = [
  {
    id: 'crypto_btc_1',
    category: 'crypto',
    source: 'binance',
    symbol: 'BTC',
    amount: 0.5,
    valueUsd: 33750,
    entryPrice: 62000,
    currentPrice: 67500,
    unrealizedPL: 2750,
    unrealizedPLPercent: 8.87,
    side: 'long',
    lastUpdate: new Date(),
  },
  {
    id: 'crypto_eth_1',
    category: 'crypto',
    source: 'binance',
    symbol: 'ETH',
    amount: 5.0,
    valueUsd: 17500,
    entryPrice: 3200,
    currentPrice: 3500,
    unrealizedPL: 1500,
    unrealizedPLPercent: 9.37,
    side: 'long',
    lastUpdate: new Date(),
  },
];

const MOCK_FOREX_POSITIONS: UnifiedPosition[] = [
  {
    id: 'forex_eurusd_1',
    category: 'forex',
    source: 'mt5-roboforex',
    symbol: 'EURUSD',
    amount: 0.5,  // Lots
    valueUsd: 5000,  // Margin used
    entryPrice: 1.0850,
    currentPrice: 1.0920,
    unrealizedPL: 350,
    unrealizedPLPercent: 7.0,
    side: 'long',
    lastUpdate: new Date(),
  },
];

// ============================================================
// MULTI-ASSET MANAGER
// ============================================================

export class MultiAssetManager {
  private config: MultiAssetConfig;
  private defiConnector: DeFiConnector | null = null;
  private stockConnector: StockConnector | null = null;
  
  constructor(config: MultiAssetConfig = {}) {
    this.config = config;
  }
  
  // --------------------------------------------------------
  // Initialization
  // --------------------------------------------------------
  
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Multi-Asset Manager...');
    
    // Initialize DeFi if enabled
    if (this.config.defi?.enabled) {
      this.defiConnector = createDeFiConnector({
        wallets: this.config.defi.wallets,
      });
      console.log('  ✅ DeFi Connector ready');
    }
    
    // Initialize Stocks if configured
    if (this.config.stocks?.apiKey) {
      this.stockConnector = createStockConnector();
      await this.stockConnector.connect({
        broker: this.config.stocks.broker,
        apiKey: this.config.stocks.apiKey,
        apiSecret: this.config.stocks.apiSecret || '',
        paper: this.config.stocks.paper ?? true,
      });
      console.log('  ✅ Stock Connector ready');
    }
    
    // Note: MT5 and Crypto connectors would be initialized similarly
    // For now, they use mock data
    
    console.log('✅ Multi-Asset Manager initialized');
  }
  
  // --------------------------------------------------------
  // Unified Portfolio
  // --------------------------------------------------------
  
  async getPortfolio(): Promise<PortfolioSummary> {
    const positions: UnifiedPosition[] = [];
    
    // 1. Get Crypto positions
    const cryptoPositions = await this.getCryptoPositions();
    positions.push(...cryptoPositions);
    
    // 2. Get Forex positions
    const forexPositions = await this.getForexPositions();
    positions.push(...forexPositions);
    
    // 3. Get Stock positions
    const stockPositions = await this.getStockPositions();
    positions.push(...stockPositions);
    
    // 4. Get DeFi positions
    const defiPositions = await this.getDeFiPositions();
    positions.push(...defiPositions);
    
    // Calculate totals
    const totalValueUsd = positions.reduce((sum, p) => sum + p.valueUsd, 0);
    const totalPL = positions.reduce((sum, p) => sum + p.unrealizedPL, 0);
    const totalCost = positions.reduce((sum, p) => {
      if (p.entryPrice && p.amount) {
        return sum + (p.entryPrice * p.amount);
      }
      return sum + (p.valueUsd - p.unrealizedPL);
    }, 0);
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    
    // Group by category
    const byCategory: Record<AssetCategory, { valueUsd: number; percentage: number; positions: number; pl: number }> = {
      crypto: { valueUsd: 0, percentage: 0, positions: 0, pl: 0 },
      forex: { valueUsd: 0, percentage: 0, positions: 0, pl: 0 },
      stocks: { valueUsd: 0, percentage: 0, positions: 0, pl: 0 },
      etfs: { valueUsd: 0, percentage: 0, positions: 0, pl: 0 },
      defi: { valueUsd: 0, percentage: 0, positions: 0, pl: 0 },
    };
    
    for (const pos of positions) {
      byCategory[pos.category].valueUsd += pos.valueUsd;
      byCategory[pos.category].positions += 1;
      byCategory[pos.category].pl += pos.unrealizedPL;
    }
    
    // Calculate percentages
    for (const cat of Object.keys(byCategory) as AssetCategory[]) {
      byCategory[cat].percentage = totalValueUsd > 0 
        ? (byCategory[cat].valueUsd / totalValueUsd) * 100 
        : 0;
    }
    
    // Top/Worst performers
    const sortedByPL = [...positions].sort((a, b) => b.unrealizedPLPercent - a.unrealizedPLPercent);
    const topPerformers = sortedByPL.slice(0, 3);
    const worstPerformers = sortedByPL.slice(-3).reverse();
    
    return {
      totalValueUsd,
      totalPL,
      totalPLPercent,
      byCategory,
      topPerformers,
      worstPerformers,
      positions,
    };
  }
  
  // --------------------------------------------------------
  // Category-specific getters
  // --------------------------------------------------------
  
  async getCryptoPositions(): Promise<UnifiedPosition[]> {
    // In production, this would fetch from CCXT/Exchange APIs
    // For now, return mock data
    return MOCK_CRYPTO_POSITIONS;
  }
  
  async getForexPositions(): Promise<UnifiedPosition[]> {
    // In production, this would fetch from MT5
    // For now, return mock data
    return MOCK_FOREX_POSITIONS;
  }
  
  async getStockPositions(): Promise<UnifiedPosition[]> {
    if (!this.stockConnector) return [];
    
    try {
      const stockPositions = await this.stockConnector.getPositions();
      return stockPositions.map((pos: StockPosition) => ({
        id: `stock_${pos.symbol}_${Date.now()}`,
        category: 'stocks' as AssetCategory,
        source: 'alpaca',
        symbol: pos.symbol,
        amount: pos.qty,
        valueUsd: pos.marketValue,
        entryPrice: pos.avgEntryPrice,
        currentPrice: pos.currentPrice,
        unrealizedPL: pos.unrealizedPL,
        unrealizedPLPercent: pos.unrealizedPLPercent,
        side: pos.side,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      console.error('Failed to fetch stock positions:', error);
      return [];
    }
  }
  
  async getDeFiPositions(): Promise<UnifiedPosition[]> {
    if (!this.defiConnector) return [];
    
    const defiPositions = this.defiConnector.getAllPositions();
    return defiPositions.map((pos: DeFiPosition) => ({
      id: pos.id,
      category: 'defi' as AssetCategory,
      source: pos.protocol,
      symbol: pos.asset,
      amount: pos.amount,
      valueUsd: pos.valueUsd,
      unrealizedPL: pos.pendingRewardsUsd,
      unrealizedPLPercent: pos.apy,  // Using APY as "potential gain"
      apy: pos.apy,
      healthFactor: pos.healthFactor,
      lastUpdate: pos.lastUpdate,
    }));
  }
  
  // --------------------------------------------------------
  // Cross-Asset Trading
  // --------------------------------------------------------
  
  async buy(
    category: AssetCategory,
    symbol: string,
    amount: number,
    options?: { type?: 'market' | 'limit'; price?: number }
  ): Promise<{ success: boolean; orderId?: string; message: string }> {
    switch (category) {
      case 'stocks':
      case 'etfs':
        if (!this.stockConnector) {
          return { success: false, message: 'Stock connector not initialized' };
        }
        const order = await this.stockConnector.buy(symbol, amount, {
          type: options?.type,
          limitPrice: options?.price,
        });
        return { success: true, orderId: order.id, message: `Bought ${amount} ${symbol}` };
      
      case 'defi':
        if (!this.defiConnector) {
          return { success: false, message: 'DeFi connector not initialized' };
        }
        // For DeFi, "buy" means stake or supply
        const position = await this.defiConnector.stake('lido', symbol, amount);
        return { success: true, orderId: position.id, message: `Staked ${amount} ${symbol}` };
      
      case 'crypto':
      case 'forex':
        // Would integrate with CCXT/MT5
        return { success: false, message: `${category} trading coming soon!` };
      
      default:
        return { success: false, message: `Unknown category: ${category}` };
    }
  }
  
  async sell(
    category: AssetCategory,
    symbol: string,
    amount: number,
    options?: { type?: 'market' | 'limit'; price?: number }
  ): Promise<{ success: boolean; orderId?: string; message: string }> {
    switch (category) {
      case 'stocks':
      case 'etfs':
        if (!this.stockConnector) {
          return { success: false, message: 'Stock connector not initialized' };
        }
        const order = await this.stockConnector.sell(symbol, amount, {
          type: options?.type,
          limitPrice: options?.price,
        });
        return { success: true, orderId: order.id, message: `Sold ${amount} ${symbol}` };
      
      case 'crypto':
      case 'forex':
      case 'defi':
        return { success: false, message: `${category} selling coming soon!` };
      
      default:
        return { success: false, message: `Unknown category: ${category}` };
    }
  }
  
  // --------------------------------------------------------
  // Cross-Asset Analysis
  // --------------------------------------------------------
  
  async getCorrelation(symbol1: string, symbol2: string): Promise<number> {
    // Calculate correlation between two assets
    // In production, this would use historical price data
    return 0.65;  // Mock correlation
  }
  
  async getDiversificationScore(): Promise<{
    score: number;  // 0-100
    recommendations: string[];
  }> {
    const portfolio = await this.getPortfolio();
    
    // Calculate diversification based on category distribution
    const categories = Object.values(portfolio.byCategory);
    const activeCategories = categories.filter(c => c.positions > 0);
    
    // More categories = better diversification
    const categoryScore = (activeCategories.length / 5) * 40;
    
    // Check for over-concentration (max 50% in one category is ideal)
    const maxConcentration = Math.max(...categories.map(c => c.percentage));
    const concentrationScore = maxConcentration < 50 ? 30 : (100 - maxConcentration) * 0.6;
    
    // Number of positions (10+ is good)
    const positionScore = Math.min(portfolio.positions.length / 10, 1) * 30;
    
    const score = Math.round(categoryScore + concentrationScore + positionScore);
    
    const recommendations: string[] = [];
    
    if (activeCategories.length < 3) {
      recommendations.push('Consider diversifying into more asset categories');
    }
    if (maxConcentration > 60) {
      const overweightCat = Object.entries(portfolio.byCategory)
        .find(([_, v]) => v.percentage === maxConcentration)?.[0];
      recommendations.push(`${overweightCat} is overweight at ${maxConcentration.toFixed(1)}%. Consider rebalancing.`);
    }
    if (portfolio.positions.length < 5) {
      recommendations.push('Consider adding more positions for better diversification');
    }
    if (portfolio.byCategory.defi.percentage === 0 && portfolio.byCategory.crypto.percentage > 0) {
      recommendations.push('Consider DeFi staking/lending for passive yield on crypto');
    }
    
    return { score, recommendations };
  }
  
  // --------------------------------------------------------
  // Reports
  // --------------------------------------------------------
  
  async generateReport(): Promise<string> {
    const portfolio = await this.getPortfolio();
    const diversification = await this.getDiversificationScore();
    
    let report = `
🌐 MULTI-ASSET PORTFOLIO REPORT
${'='.repeat(70)}
Generated: ${new Date().toISOString()}

OVERVIEW
${'-'.repeat(70)}
Total Value:        $${portfolio.totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Total P&L:          $${portfolio.totalPL.toFixed(2)} (${portfolio.totalPLPercent >= 0 ? '+' : ''}${portfolio.totalPLPercent.toFixed(2)}%)
Diversification:    ${diversification.score}/100

ALLOCATION BY CATEGORY
${'-'.repeat(70)}
`;

    const categoryEmojis: Record<AssetCategory, string> = {
      crypto: '🪙',
      forex: '💱',
      stocks: '📈',
      etfs: '📊',
      defi: '🌾',
    };

    for (const [cat, data] of Object.entries(portfolio.byCategory)) {
      if (data.positions > 0) {
        const emoji = categoryEmojis[cat as AssetCategory];
        const bar = '█'.repeat(Math.round(data.percentage / 5)) + '░'.repeat(20 - Math.round(data.percentage / 5));
        report += `${emoji} ${cat.toUpperCase().padEnd(8)} ${bar} ${data.percentage.toFixed(1).padStart(5)}% ($${data.valueUsd.toLocaleString()})\n`;
      }
    }

    report += `
TOP PERFORMERS
${'-'.repeat(70)}
`;

    for (const pos of portfolio.topPerformers) {
      report += `📈 ${pos.symbol.padEnd(8)} ${pos.category.padEnd(8)} +${pos.unrealizedPLPercent.toFixed(2)}% ($${pos.unrealizedPL.toFixed(2)})\n`;
    }

    report += `
WORST PERFORMERS
${'-'.repeat(70)}
`;

    for (const pos of portfolio.worstPerformers) {
      const sign = pos.unrealizedPLPercent >= 0 ? '+' : '';
      report += `📉 ${pos.symbol.padEnd(8)} ${pos.category.padEnd(8)} ${sign}${pos.unrealizedPLPercent.toFixed(2)}% ($${pos.unrealizedPL.toFixed(2)})\n`;
    }

    if (diversification.recommendations.length > 0) {
      report += `
💡 RECOMMENDATIONS
${'-'.repeat(70)}
`;
      for (const rec of diversification.recommendations) {
        report += `• ${rec}\n`;
      }
    }

    report += `
ALL POSITIONS (${portfolio.positions.length})
${'-'.repeat(70)}
${'Symbol'.padEnd(10)} ${'Category'.padEnd(10)} ${'Value'.padStart(12)} ${'P&L %'.padStart(10)}
`;

    for (const pos of portfolio.positions) {
      const plSign = pos.unrealizedPLPercent >= 0 ? '+' : '';
      report += `${pos.symbol.padEnd(10)} ${pos.category.padEnd(10)} $${pos.valueUsd.toLocaleString().padStart(10)} ${plSign}${pos.unrealizedPLPercent.toFixed(2).padStart(8)}%\n`;
    }

    return report;
  }
}

// ============================================================
// FACTORY & EXPORTS
// ============================================================

let multiAssetManagerInstance: MultiAssetManager | null = null;

export function createMultiAssetManager(config?: MultiAssetConfig): MultiAssetManager {
  if (!multiAssetManagerInstance) {
    multiAssetManagerInstance = new MultiAssetManager(config);
  }
  return multiAssetManagerInstance;
}

export function getMultiAssetManager(): MultiAssetManager {
  if (!multiAssetManagerInstance) {
    multiAssetManagerInstance = new MultiAssetManager();
  }
  return multiAssetManagerInstance;
}

export default MultiAssetManager;
