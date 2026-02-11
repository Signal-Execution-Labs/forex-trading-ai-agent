/**
 * Social Activity Feed - Zapper/Nansen style
 * Skill #63 - Follow wallets, track whales, copy trades
 */

import { EventEmitter } from 'events';

// Types
interface FollowedWallet {
  address: string;
  label: string;
  tags: string[];
  notify: boolean;
  addedAt: Date;
  stats?: {
    totalTx: number;
    profitLoss: number;
    winRate: number;
  };
}

interface Activity {
  hash: string;
  timestamp: number;
  wallet: string;
  walletLabel?: string;
  chain: string;
  type: 'swap' | 'transfer' | 'mint' | 'stake' | 'unstake' | 'borrow' | 'repay' | 'supply' | 'withdraw' | 'claim' | 'bridge' | 'approve' | 'deploy';
  protocol?: string;
  description: string;
  tokensIn: TokenInfo[];
  tokensOut: TokenInfo[];
  valueUsd: number;
  gasCostUsd: number;
}

interface TokenInfo {
  symbol: string;
  address: string;
  amount: number;
  valueUsd: number;
}

interface TrendingToken {
  symbol: string;
  address: string;
  chain: string;
  buyCount: number;
  sellCount: number;
  netFlow: number; // positive = accumulation
  whaleCount: number;
  avgTxSize: number;
  score: number;
}

interface CopyTradeConfig {
  wallet: string;
  enabled: boolean;
  maxAmount: number;
  slippage: number;
  tokens?: string[]; // Only copy these tokens, empty = all
  excludeTokens?: string[];
  minWalletConfidence: number; // 0-1
}

interface SocialFeedConfig {
  following?: FollowedWallet[];
  watchlists?: Array<{
    name: string;
    autoDiscover: boolean;
    minBalance?: number;
    minActivity?: number;
    chains: string[];
  }>;
  filters?: {
    minValue?: number;
    hideSpam?: boolean;
  };
  notifications?: {
    telegram?: boolean;
    discord?: boolean;
    minValue?: number;
  };
  copyTrade?: {
    enabled: boolean;
    configs: CopyTradeConfig[];
  };
}

const SUPPORTED_CHAINS = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche', 'base'];

export class SocialFeed extends EventEmitter {
  private config: SocialFeedConfig;
  private following: Map<string, FollowedWallet> = new Map();
  private activityCache: Activity[] = [];
  private trendingCache: TrendingToken[] = [];
  private updateTimer: NodeJS.Timer | null = null;

  constructor(config: SocialFeedConfig = {}) {
    super();
    this.config = {
      filters: { minValue: 100, hideSpam: true },
      notifications: { minValue: 10000 },
      ...config
    };
    
    // Load initial following
    if (config.following) {
      for (const wallet of config.following) {
        this.following.set(wallet.address.toLowerCase(), wallet);
      }
    }
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    console.log('📡 Starting Social Feed...');
    
    // Initial fetch
    await this.refreshFeed();
    await this.refreshTrending();
    
    // Auto-discover whales if configured
    if (this.config.watchlists?.some(w => w.autoDiscover)) {
      await this.discoverSmartMoney();
    }
    
    // Set up polling (30 seconds)
    this.updateTimer = setInterval(async () => {
      await this.refreshFeed();
    }, 30000);
    
    console.log('✅ Social Feed active');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Follow a wallet
   */
  async follow(address: string, options: { label?: string; tags?: string[]; notify?: boolean } = {}): Promise<void> {
    const wallet: FollowedWallet = {
      address: address.toLowerCase(),
      label: options.label ?? `Wallet ${address.slice(0, 8)}`,
      tags: options.tags ?? [],
      notify: options.notify ?? true,
      addedAt: new Date()
    };
    
    this.following.set(wallet.address, wallet);
    this.emit('followed', wallet);
  }

  /**
   * Unfollow a wallet
   */
  unfollow(address: string): void {
    const wallet = this.following.get(address.toLowerCase());
    if (wallet) {
      this.following.delete(address.toLowerCase());
      this.emit('unfollowed', wallet);
    }
  }

  /**
   * Get followed wallets
   */
  getFollowing(): FollowedWallet[] {
    return Array.from(this.following.values());
  }

  /**
   * Get activity feed
   */
  async getFeed(options: {
    limit?: number;
    minValue?: number;
    types?: string[];
    chains?: string[];
    wallets?: string[];
  } = {}): Promise<Activity[]> {
    let activities = [...this.activityCache];
    
    // Apply filters
    if (options.minValue) {
      activities = activities.filter(a => a.valueUsd >= options.minValue!);
    }
    if (options.types?.length) {
      activities = activities.filter(a => options.types!.includes(a.type));
    }
    if (options.chains?.length) {
      activities = activities.filter(a => options.chains!.includes(a.chain));
    }
    if (options.wallets?.length) {
      const walletsLower = options.wallets.map(w => w.toLowerCase());
      activities = activities.filter(a => walletsLower.includes(a.wallet.toLowerCase()));
    }
    
    // Sort by timestamp, newest first
    activities.sort((a, b) => b.timestamp - a.timestamp);
    
    return activities.slice(0, options.limit ?? 50);
  }

  /**
   * Get trending tokens by whale activity
   */
  async getTrendingTokens(timeframe: '1h' | '24h' | '7d' = '24h'): Promise<TrendingToken[]> {
    if (this.trendingCache.length === 0) {
      await this.refreshTrending();
    }
    return this.trendingCache;
  }

  /**
   * Get smart money insights for a chain
   */
  async getSmartMoneyInsights(chain: string): Promise<{
    topBuyers: Array<{ address: string; label?: string; tokens: string[] }>;
    topSellers: Array<{ address: string; label?: string; tokens: string[] }>;
    accumulating: TrendingToken[];
    distributing: TrendingToken[];
  }> {
    // Placeholder - would analyze on-chain data
    return {
      topBuyers: [],
      topSellers: [],
      accumulating: this.trendingCache.filter(t => t.netFlow > 0 && t.chain === chain),
      distributing: this.trendingCache.filter(t => t.netFlow < 0 && t.chain === chain)
    };
  }

  /**
   * Enable copy trading for a wallet
   */
  async enableCopyTrade(wallet: string, options: Partial<CopyTradeConfig>): Promise<void> {
    const config: CopyTradeConfig = {
      wallet: wallet.toLowerCase(),
      enabled: true,
      maxAmount: options.maxAmount ?? 500,
      slippage: options.slippage ?? 1,
      tokens: options.tokens,
      excludeTokens: options.excludeTokens,
      minWalletConfidence: options.minWalletConfidence ?? 0.7
    };
    
    if (!this.config.copyTrade) {
      this.config.copyTrade = { enabled: true, configs: [] };
    }
    
    // Update or add config
    const existingIndex = this.config.copyTrade.configs.findIndex(c => c.wallet === config.wallet);
    if (existingIndex >= 0) {
      this.config.copyTrade.configs[existingIndex] = config;
    } else {
      this.config.copyTrade.configs.push(config);
    }
    
    this.emit('copyTradeEnabled', config);
  }

  /**
   * Disable copy trading for a wallet
   */
  disableCopyTrade(wallet: string): void {
    if (this.config.copyTrade) {
      this.config.copyTrade.configs = this.config.copyTrade.configs.filter(
        c => c.wallet !== wallet.toLowerCase()
      );
    }
  }

  /**
   * Get wallet analysis
   */
  async analyzeWallet(address: string): Promise<{
    address: string;
    label?: string;
    netWorth: number;
    chains: string[];
    topHoldings: TokenInfo[];
    recentActivity: Activity[];
    stats: {
      totalTx: number;
      profitLoss: number;
      winRate: number;
      avgHoldTime: number;
      favoriteProtocols: string[];
    };
    score: number; // 0-100 smart money score
  }> {
    const wallet = this.following.get(address.toLowerCase());
    
    // Placeholder - would do full chain analysis
    return {
      address,
      label: wallet?.label,
      netWorth: 0,
      chains: [],
      topHoldings: [],
      recentActivity: [],
      stats: {
        totalTx: 0,
        profitLoss: 0,
        winRate: 0,
        avgHoldTime: 0,
        favoriteProtocols: []
      },
      score: 0
    };
  }

  // Private methods

  private async refreshFeed(): Promise<void> {
    const activities: Activity[] = [];
    
    for (const wallet of this.following.values()) {
      for (const chain of SUPPORTED_CHAINS) {
        const walletActivities = await this.fetchWalletActivity(wallet.address, chain);
        
        for (const activity of walletActivities) {
          activity.walletLabel = wallet.label;
          activities.push(activity);
          
          // Check for notifications
          if (wallet.notify && activity.valueUsd >= (this.config.notifications?.minValue ?? 10000)) {
            this.emit('whaleMove', activity);
          }
          
          // Check for copy trade
          if (this.config.copyTrade?.enabled) {
            await this.checkCopyTrade(activity);
          }
        }
      }
    }
    
    this.activityCache = activities;
  }

  private async refreshTrending(): Promise<void> {
    // Placeholder - would aggregate whale trading data
    this.trendingCache = [];
  }

  private async discoverSmartMoney(): Promise<void> {
    for (const watchlist of this.config.watchlists ?? []) {
      if (!watchlist.autoDiscover) continue;
      
      for (const chain of watchlist.chains) {
        const whales = await this.findWhalesOnChain(chain, {
          minBalance: watchlist.minBalance,
          minActivity: watchlist.minActivity
        });
        
        for (const whale of whales) {
          if (!this.following.has(whale.address.toLowerCase())) {
            await this.follow(whale.address, {
              label: `${watchlist.name} - ${whale.address.slice(0, 8)}`,
              tags: ['auto-discovered', watchlist.name],
              notify: true
            });
          }
        }
      }
    }
  }

  private async fetchWalletActivity(address: string, chain: string): Promise<Activity[]> {
    // Placeholder - integrate with block explorer / Alchemy APIs
    return [];
  }

  private async findWhalesOnChain(chain: string, criteria: { minBalance?: number; minActivity?: number }): Promise<Array<{ address: string }>> {
    // Placeholder - would scan chain for high value wallets
    return [];
  }

  private async checkCopyTrade(activity: Activity): Promise<void> {
    const config = this.config.copyTrade?.configs.find(c => c.wallet === activity.wallet.toLowerCase());
    if (!config || !config.enabled) return;
    
    // Only copy swaps
    if (activity.type !== 'swap') return;
    
    // Check token filters
    const tokenSymbol = activity.tokensOut[0]?.symbol;
    if (config.tokens?.length && !config.tokens.includes(tokenSymbol)) return;
    if (config.excludeTokens?.includes(tokenSymbol)) return;
    
    // Emit copy trade signal
    this.emit('copyTradeSignal', {
      originalActivity: activity,
      config,
      action: 'buy',
      token: activity.tokensOut[0],
      maxAmount: config.maxAmount,
      slippage: config.slippage
    });
  }
}

// Export factory
export function createSocialFeed(config?: SocialFeedConfig): SocialFeed {
  return new SocialFeed(config);
}

export default SocialFeed;
