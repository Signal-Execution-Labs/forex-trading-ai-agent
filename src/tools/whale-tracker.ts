/**
 * K.I.T. WHALE TRACKER
 * 
 * Track and follow big money movements.
 * "Follow the whales, not the crowd."
 * 
 * Features:
 * - On-chain whale movement detection
 * - Exchange inflow/outflow tracking
 * - Smart money wallet monitoring
 * - CEX whale alerts
 * - Copy whale strategies
 */

import { EventEmitter } from 'events';

// ============================================================
// TYPES
// ============================================================

export type WhaleCategory = 'exchange' | 'defi' | 'fund' | 'influencer' | 'unknown';
export type MovementType = 'deposit' | 'withdrawal' | 'transfer' | 'swap' | 'stake' | 'unstake';

export interface WhaleTx {
  id: string;
  hash: string;
  chain: string;
  
  // Addresses
  fromAddress: string;
  toAddress: string;
  fromLabel?: string;
  toLabel?: string;
  
  // Transaction details
  token: string;
  amount: number;
  valueUsd: number;
  movementType: MovementType;
  
  // Analysis
  fromCategory: WhaleCategory;
  toCategory: WhaleCategory;
  significance: 'low' | 'medium' | 'high' | 'critical';
  
  // Market impact
  priceImpact?: number;  // % price change after tx
  
  // Metadata
  timestamp: Date;
  blockNumber: number;
}

export interface TrackedWallet {
  address: string;
  chain: string;
  label: string;
  category: WhaleCategory;
  
  // Stats
  portfolioValueUsd: number;
  profitAllTime?: number;
  winRate?: number;
  
  // Tracking
  isActive: boolean;
  lastActivity: Date;
  followWeight: number;  // How closely to copy (0-100)
}

export interface ExchangeFlow {
  exchange: string;
  token: string;
  inflow24h: number;
  outflow24h: number;
  netFlow24h: number;  // Negative = more withdrawals
  netFlowValueUsd: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  timestamp: Date;
}

export interface WhaleAlert {
  id: string;
  type: 'large_transfer' | 'exchange_deposit' | 'exchange_withdrawal' | 'smart_money_move' | 'unusual_activity';
  severity: 'info' | 'warning' | 'alert';
  title: string;
  description: string;
  tx?: WhaleTx;
  suggestedAction?: string;
  timestamp: Date;
}

export interface WhaleTrackerConfig {
  enabled: boolean;
  minTransactionUsd: number;  // Min USD to track
  chains: string[];
  trackedWallets: TrackedWallet[];
  autoAlert: boolean;
  copyTradeEnabled: boolean;
  copyTradeMaxUsd: number;
}

// ============================================================
// KNOWN WHALES DATABASE
// ============================================================

const KNOWN_WHALES: Omit<TrackedWallet, 'isActive' | 'lastActivity'>[] = [
  // Legendary traders
  {
    address: '0x7431931094e8bae1ecaa7d0b57d2284e121f760e',
    chain: 'ethereum',
    label: 'Tetranode',
    category: 'influencer',
    portfolioValueUsd: 50_000_000,
    profitAllTime: 100_000_000,
    winRate: 75,
    followWeight: 80,
  },
  {
    address: '0x28c6c06298d514db089934071355e5743bf21d60',
    chain: 'ethereum',
    label: 'Binance Hot Wallet',
    category: 'exchange',
    portfolioValueUsd: 10_000_000_000,
    followWeight: 30,  // Monitor, don't copy
  },
  {
    address: '0x21a31ee1afc51d94c2efccaa2092ad1028285549',
    chain: 'ethereum',
    label: 'Bitfinex Hot Wallet',
    category: 'exchange',
    portfolioValueUsd: 5_000_000_000,
    followWeight: 30,
  },
  {
    address: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
    chain: 'ethereum',
    label: 'GCR (Gigantic Crypto Returns)',
    category: 'influencer',
    portfolioValueUsd: 20_000_000,
    profitAllTime: 50_000_000,
    winRate: 70,
    followWeight: 70,
  },
  // DeFi protocols & DAOs
  {
    address: '0xbcca60bb61934080951369a648fb03df4f96263c',
    chain: 'ethereum',
    label: 'Aave: aUSDC',
    category: 'defi',
    portfolioValueUsd: 2_000_000_000,
    followWeight: 20,
  },
  // Funds
  {
    address: '0x0716a17fbaee714f1e6ab0f9d59edbc5f09815c0',
    chain: 'ethereum',
    label: 'Jump Trading',
    category: 'fund',
    portfolioValueUsd: 1_000_000_000,
    followWeight: 60,
  },
];

// ============================================================
// WHALE TRACKER CLASS
// ============================================================

export class WhaleTracker extends EventEmitter {
  private config: WhaleTrackerConfig;
  private recentTxs: WhaleTx[] = [];
  private alerts: WhaleAlert[] = [];
  private exchangeFlows: Map<string, ExchangeFlow[]> = new Map();
  
  constructor(config: Partial<WhaleTrackerConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      minTransactionUsd: 100_000,
      chains: ['ethereum', 'arbitrum', 'solana'],
      trackedWallets: KNOWN_WHALES.map(w => ({
        ...w,
        isActive: true,
        lastActivity: new Date(),
      })),
      autoAlert: true,
      copyTradeEnabled: false,
      copyTradeMaxUsd: 1000,
      ...config,
    };
    
    console.log(`🐋 Whale Tracker initialized. Tracking ${this.config.trackedWallets.length} wallets.`);
  }
  
  // --------------------------------------------------------
  // Real-time Monitoring (simulated)
  // --------------------------------------------------------
  
  async startMonitoring(): Promise<void> {
    console.log('🔍 Starting whale monitoring...');
    
    // In production, this would:
    // 1. Connect to blockchain nodes or APIs (Etherscan, Alchemy, etc.)
    // 2. Subscribe to mempool for pending large transactions
    // 3. Monitor exchange wallet activity
    
    // Simulate periodic whale activity
    setInterval(() => this.simulateWhaleActivity(), 30000);
  }
  
  private async simulateWhaleActivity(): Promise<void> {
    // Simulate random whale transactions for demo
    if (Math.random() > 0.7) {
      const whale = this.config.trackedWallets[Math.floor(Math.random() * this.config.trackedWallets.length)];
      
      const tx: WhaleTx = {
        id: `tx_${Date.now()}`,
        hash: `0x${Math.random().toString(16).slice(2)}`,
        chain: whale.chain,
        fromAddress: whale.address,
        toAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
        fromLabel: whale.label,
        token: ['ETH', 'USDC', 'USDT', 'WBTC'][Math.floor(Math.random() * 4)],
        amount: Math.random() * 1000 + 100,
        valueUsd: Math.random() * 5_000_000 + 100_000,
        movementType: ['transfer', 'swap', 'deposit', 'withdrawal'][Math.floor(Math.random() * 4)] as MovementType,
        fromCategory: whale.category,
        toCategory: Math.random() > 0.5 ? 'exchange' : 'defi',
        significance: Math.random() > 0.8 ? 'high' : 'medium',
        timestamp: new Date(),
        blockNumber: 18000000 + Math.floor(Math.random() * 100000),
      };
      
      await this.processTx(tx);
    }
  }
  
  private async processTx(tx: WhaleTx): Promise<void> {
    this.recentTxs.unshift(tx);
    if (this.recentTxs.length > 100) this.recentTxs.pop();
    
    // Generate alert if significant
    if (tx.valueUsd >= this.config.minTransactionUsd) {
      const alert = this.createAlert(tx);
      if (alert) {
        this.alerts.unshift(alert);
        if (this.alerts.length > 50) this.alerts.pop();
        
        if (this.config.autoAlert) {
          this.emit('whale_alert', alert);
          console.log(`🐋 ${alert.title}`);
        }
      }
    }
    
    // Check for copy trade opportunity
    if (this.config.copyTradeEnabled && tx.fromCategory === 'fund' || tx.fromCategory === 'influencer') {
      this.emit('copy_opportunity', tx);
    }
  }
  
  private createAlert(tx: WhaleTx): WhaleAlert | null {
    let type: WhaleAlert['type'] = 'large_transfer';
    let severity: WhaleAlert['severity'] = 'info';
    let suggestedAction: string | undefined;
    
    // Determine alert type and severity
    if (tx.toCategory === 'exchange' && tx.movementType === 'deposit') {
      type = 'exchange_deposit';
      severity = tx.valueUsd > 10_000_000 ? 'alert' : 'warning';
      suggestedAction = 'Large exchange deposit often precedes selling. Consider reducing position.';
    } else if (tx.fromCategory === 'exchange' && tx.movementType === 'withdrawal') {
      type = 'exchange_withdrawal';
      severity = tx.valueUsd > 10_000_000 ? 'alert' : 'info';
      suggestedAction = 'Exchange withdrawals often signal holding intent. Bullish signal.';
    } else if (tx.fromCategory === 'fund' || tx.fromCategory === 'influencer') {
      type = 'smart_money_move';
      severity = tx.valueUsd > 5_000_000 ? 'alert' : 'warning';
      suggestedAction = `Follow ${tx.fromLabel || 'smart money'}? Consider similar position.`;
    }
    
    const direction = tx.movementType === 'deposit' ? '→' : '←';
    const title = `🐋 $${(tx.valueUsd / 1_000_000).toFixed(2)}M ${tx.token} ${tx.movementType}`;
    const description = `${tx.fromLabel || tx.fromAddress.slice(0, 10)} ${direction} ${tx.toLabel || tx.toAddress.slice(0, 10)}`;
    
    return {
      id: `alert_${Date.now()}`,
      type,
      severity,
      title,
      description,
      tx,
      suggestedAction,
      timestamp: new Date(),
    };
  }
  
  // --------------------------------------------------------
  // Exchange Flow Analysis
  // --------------------------------------------------------
  
  async getExchangeFlows(token: string = 'BTC'): Promise<ExchangeFlow[]> {
    // In production, aggregate from multiple data sources
    // For now, return mock data
    
    const exchanges = ['binance', 'coinbase', 'kraken', 'okx', 'bybit'];
    
    return exchanges.map(exchange => {
      const inflow = Math.random() * 10000;
      const outflow = Math.random() * 10000;
      const netFlow = inflow - outflow;
      
      return {
        exchange,
        token,
        inflow24h: inflow,
        outflow24h: outflow,
        netFlow24h: netFlow,
        netFlowValueUsd: netFlow * 67000,  // Mock BTC price
        trend: netFlow > 0 ? 'bearish' : netFlow < -1000 ? 'bullish' : 'neutral',
        timestamp: new Date(),
      };
    });
  }
  
  getExchangeFlowSummary(flows: ExchangeFlow[]): {
    totalNetFlow: number;
    totalNetFlowUsd: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    interpretation: string;
  } {
    const totalNetFlow = flows.reduce((sum, f) => sum + f.netFlow24h, 0);
    const totalNetFlowUsd = flows.reduce((sum, f) => sum + f.netFlowValueUsd, 0);
    
    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let interpretation = 'Exchange flows are balanced.';
    
    if (totalNetFlow > 5000) {
      sentiment = 'bearish';
      interpretation = 'Large net inflows to exchanges suggest selling pressure incoming.';
    } else if (totalNetFlow < -5000) {
      sentiment = 'bullish';
      interpretation = 'Large net outflows from exchanges suggest accumulation. Bullish.';
    }
    
    return { totalNetFlow, totalNetFlowUsd, sentiment, interpretation };
  }
  
  // --------------------------------------------------------
  // Wallet Tracking
  // --------------------------------------------------------
  
  addWallet(wallet: Omit<TrackedWallet, 'isActive' | 'lastActivity'>): void {
    const fullWallet: TrackedWallet = {
      ...wallet,
      isActive: true,
      lastActivity: new Date(),
    };
    
    this.config.trackedWallets.push(fullWallet);
    console.log(`➕ Now tracking: ${wallet.label} (${wallet.address.slice(0, 10)}...)`);
  }
  
  removeWallet(address: string): boolean {
    const index = this.config.trackedWallets.findIndex(w => w.address.toLowerCase() === address.toLowerCase());
    if (index === -1) return false;
    
    const wallet = this.config.trackedWallets.splice(index, 1)[0];
    console.log(`➖ Stopped tracking: ${wallet.label}`);
    return true;
  }
  
  getTrackedWallets(): TrackedWallet[] {
    return [...this.config.trackedWallets];
  }
  
  getTopPerformers(): TrackedWallet[] {
    return this.config.trackedWallets
      .filter(w => w.winRate !== undefined)
      .sort((a, b) => (b.winRate || 0) - (a.winRate || 0))
      .slice(0, 10);
  }
  
  // --------------------------------------------------------
  // Alerts & History
  // --------------------------------------------------------
  
  getRecentAlerts(limit: number = 20): WhaleAlert[] {
    return this.alerts.slice(0, limit);
  }
  
  getRecentTransactions(limit: number = 50): WhaleTx[] {
    return this.recentTxs.slice(0, limit);
  }
  
  // --------------------------------------------------------
  // Copy Trading
  // --------------------------------------------------------
  
  async enableCopyTrading(walletAddress: string, maxUsd: number): Promise<void> {
    const wallet = this.config.trackedWallets.find(
      w => w.address.toLowerCase() === walletAddress.toLowerCase()
    );
    
    if (!wallet) {
      throw new Error('Wallet not found in tracked list');
    }
    
    this.config.copyTradeEnabled = true;
    this.config.copyTradeMaxUsd = maxUsd;
    
    console.log(`🔄 Copy trading enabled for ${wallet.label} (max: $${maxUsd})`);
    
    this.on('copy_opportunity', async (tx: WhaleTx) => {
      if (tx.fromAddress.toLowerCase() === walletAddress.toLowerCase()) {
        console.log(`📋 Copy signal: ${tx.movementType} ${tx.amount} ${tx.token}`);
        // In production, execute the copy trade
      }
    });
  }
  
  // --------------------------------------------------------
  // Reports
  // --------------------------------------------------------
  
  async generateReport(): Promise<string> {
    const flows = await this.getExchangeFlows('BTC');
    const flowSummary = this.getExchangeFlowSummary(flows);
    const topWhales = this.getTopPerformers();
    
    let report = `
🐋 K.I.T. WHALE TRACKER REPORT
${'='.repeat(60)}

EXCHANGE FLOW SUMMARY (BTC - 24h)
${'-'.repeat(60)}
Net Flow:       ${flowSummary.totalNetFlow > 0 ? '+' : ''}${flowSummary.totalNetFlow.toFixed(2)} BTC
Net Flow USD:   $${flowSummary.totalNetFlowUsd.toLocaleString()}
Sentiment:      ${flowSummary.sentiment === 'bullish' ? '🟢 BULLISH' : flowSummary.sentiment === 'bearish' ? '🔴 BEARISH' : '⚪ NEUTRAL'}

${flowSummary.interpretation}

EXCHANGE BREAKDOWN
${'-'.repeat(60)}
`;

    for (const flow of flows) {
      const arrow = flow.netFlow24h > 0 ? '📥' : '📤';
      report += `${arrow} ${flow.exchange.padEnd(12)} Net: ${flow.netFlow24h > 0 ? '+' : ''}${flow.netFlow24h.toFixed(2)} BTC\n`;
    }

    report += `
TOP TRACKED WHALES (by Win Rate)
${'-'.repeat(60)}
`;

    for (const whale of topWhales.slice(0, 5)) {
      report += `🐋 ${whale.label.padEnd(20)} Win: ${whale.winRate}% | $${(whale.portfolioValueUsd / 1_000_000).toFixed(1)}M\n`;
    }

    report += `
RECENT ALERTS
${'-'.repeat(60)}
`;

    for (const alert of this.alerts.slice(0, 5)) {
      const icon = alert.severity === 'alert' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
      report += `${icon} ${alert.title}\n   ${alert.description}\n`;
    }

    report += `
${'='.repeat(60)}
Tracking ${this.config.trackedWallets.length} wallets across ${this.config.chains.length} chains.
`;

    return report;
  }
}

// ============================================================
// FACTORY & EXPORTS
// ============================================================

let whaleTrackerInstance: WhaleTracker | null = null;

export function createWhaleTracker(config?: Partial<WhaleTrackerConfig>): WhaleTracker {
  if (!whaleTrackerInstance) {
    whaleTrackerInstance = new WhaleTracker(config);
  }
  return whaleTrackerInstance;
}

export function getWhaleTracker(): WhaleTracker {
  if (!whaleTrackerInstance) {
    whaleTrackerInstance = new WhaleTracker();
  }
  return whaleTrackerInstance;
}

export default WhaleTracker;
