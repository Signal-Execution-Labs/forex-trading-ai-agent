/**
 * DeFi Dashboard - Zapper-style portfolio tracker
 * Skill #62 - Comprehensive DeFi position aggregation
 */

import { EventEmitter } from 'events';

// Types
interface Wallet {
  address: string;
  label?: string;
  chains: string[] | 'all';
}

interface Position {
  id: string;
  wallet: string;
  chain: string;
  protocol: string;
  type: 'token' | 'lp' | 'staking' | 'lending-supply' | 'lending-borrow' | 'yield' | 'nft' | 'vesting';
  tokens: TokenBalance[];
  valueUsd: number;
  apy?: number;
  healthFactor?: number;
  rewards?: TokenBalance[];
  meta?: Record<string, unknown>;
}

interface TokenBalance {
  symbol: string;
  address: string;
  balance: number;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  change24h?: number;
}

interface Activity {
  hash: string;
  timestamp: number;
  chain: string;
  type: 'swap' | 'transfer' | 'approve' | 'stake' | 'unstake' | 'borrow' | 'repay' | 'supply' | 'withdraw' | 'claim' | 'mint' | 'burn';
  protocol?: string;
  description: string;
  tokensIn: TokenBalance[];
  tokensOut: TokenBalance[];
  gasCostUsd: number;
  status: 'success' | 'failed' | 'pending';
}

interface Portfolio {
  wallets: string[];
  netWorth: number;
  netWorthChange24h: number;
  positions: Position[];
  byChain: Record<string, { value: number; count: number }>;
  byProtocol: Record<string, { value: number; count: number }>;
  byType: Record<string, { value: number; count: number }>;
  lastUpdated: Date;
}

interface Alert {
  id: string;
  type: 'price' | 'healthFactor' | 'impermanentLoss' | 'largeTransfer' | 'airdrop';
  condition: Record<string, unknown>;
  enabled: boolean;
  notifyChannels: string[];
}

interface DashboardConfig {
  wallets: Wallet[];
  updateInterval?: number;
  alerts?: {
    healthFactor?: { enabled: boolean; threshold: number };
    impermanentLoss?: { enabled: boolean; threshold: number };
    largeTransfer?: { enabled: boolean; minValue: number };
  };
  display?: {
    currency?: string;
    showNFTs?: boolean;
    showDust?: boolean;
    dustThreshold?: number;
    groupBy?: 'protocol' | 'chain' | 'type';
  };
}

// Supported chains
const SUPPORTED_CHAINS = [
  'ethereum', 'polygon', 'arbitrum', 'optimism',
  'bsc', 'avalanche', 'base', 'zksync'
];

// Protocol adapters registry
const PROTOCOL_ADAPTERS: Record<string, string[]> = {
  'uniswap': ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
  'aave': ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'],
  'compound': ['ethereum'],
  'curve': ['ethereum', 'polygon', 'arbitrum'],
  'lido': ['ethereum'],
  'gmx': ['arbitrum', 'avalanche'],
  'yearn': ['ethereum'],
  'convex': ['ethereum'],
  'balancer': ['ethereum', 'polygon', 'arbitrum'],
  'sushiswap': ['ethereum', 'polygon', 'arbitrum', 'bsc', 'avalanche'],
  'pancakeswap': ['bsc', 'ethereum'],
  'makerdao': ['ethereum'],
  'rocket-pool': ['ethereum'],
  'frax': ['ethereum'],
  'beefy': ['polygon', 'bsc', 'avalanche', 'arbitrum', 'optimism']
};

export class DeFiDashboard extends EventEmitter {
  private config: DashboardConfig;
  private portfolio: Portfolio | null = null;
  private alerts: Alert[] = [];
  private updateTimer: NodeJS.Timer | null = null;
  
  constructor(config: DashboardConfig) {
    super();
    this.config = {
      updateInterval: 60,
      display: {
        currency: 'USD',
        showNFTs: true,
        showDust: false,
        dustThreshold: 1,
        groupBy: 'protocol'
      },
      ...config
    };
  }

  /**
   * Initialize dashboard and start tracking
   */
  async start(): Promise<void> {
    console.log('🔍 Starting DeFi Dashboard...');
    
    // Initial portfolio fetch
    await this.refreshPortfolio();
    
    // Set up periodic updates
    if (this.config.updateInterval) {
      this.updateTimer = setInterval(
        () => this.refreshPortfolio(),
        this.config.updateInterval * 1000
      );
    }
    
    console.log('✅ DeFi Dashboard active');
  }

  /**
   * Stop dashboard
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Get full portfolio across all wallets/chains
   */
  async getPortfolio(): Promise<Portfolio> {
    if (!this.portfolio) {
      await this.refreshPortfolio();
    }
    return this.portfolio!;
  }

  /**
   * Refresh portfolio data
   */
  async refreshPortfolio(): Promise<void> {
    const positions: Position[] = [];
    let netWorth = 0;
    
    for (const wallet of this.config.wallets) {
      const chains = wallet.chains === 'all' ? SUPPORTED_CHAINS : wallet.chains;
      
      for (const chain of chains) {
        // Fetch native token balance
        const nativeBalance = await this.fetchNativeBalance(wallet.address, chain);
        if (nativeBalance.valueUsd > 0) {
          positions.push({
            id: `${wallet.address}-${chain}-native`,
            wallet: wallet.address,
            chain,
            protocol: 'wallet',
            type: 'token',
            tokens: [nativeBalance],
            valueUsd: nativeBalance.valueUsd
          });
          netWorth += nativeBalance.valueUsd;
        }
        
        // Fetch ERC20 tokens
        const tokens = await this.fetchTokenBalances(wallet.address, chain);
        for (const token of tokens) {
          if (this.shouldShowPosition(token.valueUsd)) {
            positions.push({
              id: `${wallet.address}-${chain}-${token.address}`,
              wallet: wallet.address,
              chain,
              protocol: 'wallet',
              type: 'token',
              tokens: [token],
              valueUsd: token.valueUsd
            });
            netWorth += token.valueUsd;
          }
        }
        
        // Fetch protocol positions
        for (const [protocol, supportedChains] of Object.entries(PROTOCOL_ADAPTERS)) {
          if (supportedChains.includes(chain)) {
            const protocolPositions = await this.fetchProtocolPositions(
              wallet.address,
              chain,
              protocol
            );
            for (const pos of protocolPositions) {
              if (this.shouldShowPosition(pos.valueUsd)) {
                positions.push(pos);
                netWorth += pos.valueUsd;
              }
            }
          }
        }
      }
    }
    
    // Calculate aggregations
    const byChain: Record<string, { value: number; count: number }> = {};
    const byProtocol: Record<string, { value: number; count: number }> = {};
    const byType: Record<string, { value: number; count: number }> = {};
    
    for (const pos of positions) {
      // By chain
      if (!byChain[pos.chain]) byChain[pos.chain] = { value: 0, count: 0 };
      byChain[pos.chain].value += pos.valueUsd;
      byChain[pos.chain].count++;
      
      // By protocol
      if (!byProtocol[pos.protocol]) byProtocol[pos.protocol] = { value: 0, count: 0 };
      byProtocol[pos.protocol].value += pos.valueUsd;
      byProtocol[pos.protocol].count++;
      
      // By type
      if (!byType[pos.type]) byType[pos.type] = { value: 0, count: 0 };
      byType[pos.type].value += pos.valueUsd;
      byType[pos.type].count++;
    }
    
    // Calculate 24h change (placeholder - needs historical data)
    const previousNetWorth = this.portfolio?.netWorth ?? netWorth;
    const netWorthChange24h = netWorth - previousNetWorth;
    
    this.portfolio = {
      wallets: this.config.wallets.map(w => w.address),
      netWorth,
      netWorthChange24h,
      positions,
      byChain,
      byProtocol,
      byType,
      lastUpdated: new Date()
    };
    
    this.emit('portfolioUpdate', this.portfolio);
    this.checkAlerts();
  }

  /**
   * Get activity feed for wallets
   */
  async getActivity(options: { limit?: number; type?: string }): Promise<Activity[]> {
    const activities: Activity[] = [];
    const limit = options.limit ?? 50;
    
    for (const wallet of this.config.wallets) {
      const chains = wallet.chains === 'all' ? SUPPORTED_CHAINS : wallet.chains;
      
      for (const chain of chains) {
        const chainActivities = await this.fetchChainActivity(wallet.address, chain);
        activities.push(...chainActivities);
      }
    }
    
    // Sort by timestamp, newest first
    activities.sort((a, b) => b.timestamp - a.timestamp);
    
    // Filter by type if specified
    const filtered = options.type
      ? activities.filter(a => a.type === options.type)
      : activities;
    
    return filtered.slice(0, limit);
  }

  /**
   * Get health factors for all lending positions
   */
  async getHealthFactors(): Promise<Array<{ protocol: string; chain: string; healthFactor: number }>> {
    if (!this.portfolio) await this.refreshPortfolio();
    
    return this.portfolio!.positions
      .filter(p => p.healthFactor !== undefined)
      .map(p => ({
        protocol: p.protocol,
        chain: p.chain,
        healthFactor: p.healthFactor!
      }));
  }

  /**
   * Get claimable rewards across all positions
   */
  async getClaimableRewards(): Promise<TokenBalance[]> {
    if (!this.portfolio) await this.refreshPortfolio();
    
    const rewards: TokenBalance[] = [];
    
    for (const pos of this.portfolio!.positions) {
      if (pos.rewards) {
        rewards.push(...pos.rewards);
      }
    }
    
    return rewards;
  }

  /**
   * Add a new alert
   */
  addAlert(alert: Omit<Alert, 'id'>): string {
    const id = `alert-${Date.now()}`;
    this.alerts.push({ ...alert, id });
    return id;
  }

  /**
   * Remove an alert
   */
  removeAlert(id: string): void {
    this.alerts = this.alerts.filter(a => a.id !== id);
  }

  /**
   * Export portfolio for taxes
   */
  async exportForTaxes(year: number, format: 'csv' | 'json' = 'csv'): Promise<string> {
    const activities = await this.getActivity({ limit: 10000 });
    
    // Filter by year
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year + 1, 0, 1).getTime();
    const yearActivities = activities.filter(
      a => a.timestamp >= yearStart && a.timestamp < yearEnd
    );
    
    if (format === 'json') {
      return JSON.stringify(yearActivities, null, 2);
    }
    
    // CSV format
    const headers = ['Date', 'Type', 'Protocol', 'Chain', 'Token In', 'Amount In', 'Token Out', 'Amount Out', 'Gas (USD)', 'TX Hash'];
    const rows = yearActivities.map(a => [
      new Date(a.timestamp).toISOString(),
      a.type,
      a.protocol ?? '',
      a.chain,
      a.tokensIn[0]?.symbol ?? '',
      a.tokensIn[0]?.balance.toString() ?? '',
      a.tokensOut[0]?.symbol ?? '',
      a.tokensOut[0]?.balance.toString() ?? '',
      a.gasCostUsd.toString(),
      a.hash
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // Private methods

  private shouldShowPosition(valueUsd: number): boolean {
    if (this.config.display?.showDust) return true;
    return valueUsd >= (this.config.display?.dustThreshold ?? 1);
  }

  private async fetchNativeBalance(address: string, chain: string): Promise<TokenBalance> {
    // Placeholder - integrate with actual RPC
    const nativeTokens: Record<string, { symbol: string; price: number }> = {
      ethereum: { symbol: 'ETH', price: 2500 },
      polygon: { symbol: 'MATIC', price: 0.5 },
      arbitrum: { symbol: 'ETH', price: 2500 },
      optimism: { symbol: 'ETH', price: 2500 },
      bsc: { symbol: 'BNB', price: 300 },
      avalanche: { symbol: 'AVAX', price: 25 },
      base: { symbol: 'ETH', price: 2500 },
      zksync: { symbol: 'ETH', price: 2500 }
    };
    
    const native = nativeTokens[chain] ?? { symbol: 'ETH', price: 2500 };
    const balance = 0; // Would fetch from RPC
    
    return {
      symbol: native.symbol,
      address: '0x0000000000000000000000000000000000000000',
      balance,
      decimals: 18,
      priceUsd: native.price,
      valueUsd: balance * native.price
    };
  }

  private async fetchTokenBalances(address: string, chain: string): Promise<TokenBalance[]> {
    // Placeholder - integrate with Alchemy/Moralis API
    return [];
  }

  private async fetchProtocolPositions(address: string, chain: string, protocol: string): Promise<Position[]> {
    // Placeholder - integrate with protocol-specific adapters
    return [];
  }

  private async fetchChainActivity(address: string, chain: string): Promise<Activity[]> {
    // Placeholder - integrate with block explorer APIs
    return [];
  }

  private checkAlerts(): void {
    if (!this.portfolio) return;
    
    for (const alert of this.alerts.filter(a => a.enabled)) {
      // Health factor alerts
      if (alert.type === 'healthFactor' && this.config.alerts?.healthFactor) {
        const threshold = this.config.alerts.healthFactor.threshold;
        for (const pos of this.portfolio.positions) {
          if (pos.healthFactor && pos.healthFactor < threshold) {
            this.emit('alert', {
              alert,
              message: `⚠️ Health factor warning: ${pos.protocol} on ${pos.chain} is at ${pos.healthFactor.toFixed(2)}`
            });
          }
        }
      }
    }
  }
}

// Export factory function
export function createDeFiDashboard(config: DashboardConfig): DeFiDashboard {
  return new DeFiDashboard(config);
}

export default DeFiDashboard;
