/**
 * K.I.T. eToro API Client
 * 
 * Integrates with eToro's public APIs (launched Oct 2025)
 * - Real-time market data (free)
 * - Portfolio analytics
 * - CopyTrader features
 * - Social feed
 */

import { EventEmitter } from 'events';

// Types
interface EtoroConfig {
  apiKey?: string;
  baseUrl?: string;
  wsUrl?: string;
}

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: Date;
}

interface PopularInvestor {
  username: string;
  displayName: string;
  avatarUrl: string;
  riskScore: number;  // 1-10
  copiers: number;
  aum: number;  // Assets under management
  performance: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
    allTime: number;
  };
  stats: {
    winRate: number;
    avgTradeDuration: string;
    profitableWeeks: number;
    totalTrades: number;
  };
  tradingStyle: string;
  topAssets: string[];
  bio: string;
}

interface CopySettings {
  amount: number;
  copyExisting?: boolean;
  stopLoss?: number;  // -10 = -10%
  takeProfit?: number;
  pauseOnDrawdown?: number;
}

interface PortfolioAnalytics {
  totalValue: number;
  cash: number;
  invested: number;
  allocation: {
    stocks: number;
    crypto: number;
    etfs: number;
    commodities: number;
    forex: number;
  };
  performance: {
    today: number;
    week: number;
    month: number;
    ytd: number;
    allTime: number;
  };
  risk: {
    beta: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  diversificationScore: number;
}

interface SocialPost {
  id: string;
  username: string;
  content: string;
  timestamp: Date;
  likes: number;
  comments: number;
  shares: number;
  mentionedAssets: string[];
}

export class EtoroClient extends EventEmitter {
  private apiKey: string;
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<(data: MarketData) => void>> = new Map();

  constructor(config: EtoroConfig = {}) {
    super();
    this.apiKey = config.apiKey || process.env.ETORO_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.etoro.com/v1';
    this.wsUrl = config.wsUrl || 'wss://api.etoro.com/ws';
  }

  // ============================================================
  // Market Data (Free API)
  // ============================================================

  /**
   * Get real-time price for a symbol
   */
  async getPrice(symbol: string): Promise<MarketData> {
    const response = await this.request(`/markets/${symbol}/quote`);
    return this.parseMarketData(response);
  }

  /**
   * Get prices for multiple symbols
   */
  async getPrices(symbols: string[]): Promise<MarketData[]> {
    const response = await this.request('/markets/quotes', {
      method: 'POST',
      body: JSON.stringify({ symbols })
    });
    return response.map(this.parseMarketData);
  }

  /**
   * Get all markets by category
   */
  async getMarkets(categories: string[] = ['stocks', 'crypto', 'etfs']): Promise<Record<string, MarketData[]>> {
    const results: Record<string, MarketData[]> = {};
    
    for (const category of categories) {
      const response = await this.request(`/markets/${category}`);
      results[category] = response.instruments.map(this.parseMarketData);
    }
    
    return results;
  }

  /**
   * Get trending assets
   */
  async getTrending(limit: number = 10): Promise<Array<{ symbol: string; mentions: number; sentiment: number }>> {
    const response = await this.request('/social/trending', { 
      params: { limit } 
    });
    return response.trending;
  }

  // ============================================================
  // CopyTrader
  // ============================================================

  /**
   * Discover Popular Investors
   */
  async discoverTraders(filters: {
    minReturn?: number;
    maxRisk?: number;
    minMonths?: number;
    minCopiers?: number;
    sortBy?: 'return' | 'copiers' | 'risk' | 'sharpe';
    limit?: number;
  } = {}): Promise<PopularInvestor[]> {
    const params = {
      min_return: filters.minReturn,
      max_risk: filters.maxRisk,
      min_months: filters.minMonths,
      min_copiers: filters.minCopiers,
      sort: filters.sortBy || 'copiers',
      limit: filters.limit || 20
    };

    const response = await this.request('/copytrader/discover', { params });
    return response.investors.map(this.parseInvestor);
  }

  /**
   * Get detailed trader profile
   */
  async getTraderProfile(username: string): Promise<PopularInvestor> {
    const response = await this.request(`/copytrader/users/${username}`);
    return this.parseInvestor(response);
  }

  /**
   * Get trader's current positions
   */
  async getTraderPositions(username: string): Promise<Array<{
    symbol: string;
    direction: 'buy' | 'sell';
    openPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
    size: number;
    openDate: Date;
  }>> {
    const response = await this.request(`/copytrader/users/${username}/positions`);
    return response.positions;
  }

  /**
   * Get trader's trade history
   */
  async getTraderHistory(username: string, limit: number = 50): Promise<Array<{
    symbol: string;
    direction: 'buy' | 'sell';
    openPrice: number;
    closePrice: number;
    pnl: number;
    pnlPercent: number;
    openDate: Date;
    closeDate: Date;
  }>> {
    const response = await this.request(`/copytrader/users/${username}/history`, {
      params: { limit }
    });
    return response.trades;
  }

  /**
   * Start copying a trader
   */
  async copyTrader(username: string, settings: CopySettings): Promise<{
    copyId: string;
    status: string;
    message: string;
  }> {
    const response = await this.request(`/copytrader/copy/${username}`, {
      method: 'POST',
      body: JSON.stringify({
        amount: settings.amount,
        copy_existing: settings.copyExisting ?? true,
        stop_loss: settings.stopLoss,
        take_profit: settings.takeProfit,
        pause_on_drawdown: settings.pauseOnDrawdown
      })
    });
    return response;
  }

  /**
   * Stop copying a trader
   */
  async stopCopy(copyId: string, closePositions: boolean = true): Promise<void> {
    await this.request(`/copytrader/copy/${copyId}`, {
      method: 'DELETE',
      body: JSON.stringify({ close_positions: closePositions })
    });
  }

  /**
   * Get active copy relationships
   */
  async getActiveCopies(): Promise<Array<{
    copyId: string;
    username: string;
    amount: number;
    currentValue: number;
    pnl: number;
    pnlPercent: number;
    startDate: Date;
    positions: number;
  }>> {
    const response = await this.request('/copytrader/copies');
    return response.copies;
  }

  // ============================================================
  // Portfolio Analytics
  // ============================================================

  /**
   * Get portfolio analytics
   */
  async getPortfolioAnalytics(): Promise<PortfolioAnalytics> {
    const response = await this.request('/portfolio/analytics');
    return {
      totalValue: response.total_value,
      cash: response.cash,
      invested: response.invested,
      allocation: {
        stocks: response.allocation.stocks || 0,
        crypto: response.allocation.crypto || 0,
        etfs: response.allocation.etfs || 0,
        commodities: response.allocation.commodities || 0,
        forex: response.allocation.forex || 0
      },
      performance: {
        today: response.performance.daily,
        week: response.performance.weekly,
        month: response.performance.monthly,
        ytd: response.performance.ytd,
        allTime: response.performance.all_time
      },
      risk: {
        beta: response.risk.beta,
        volatility: response.risk.volatility,
        sharpeRatio: response.risk.sharpe_ratio,
        maxDrawdown: response.risk.max_drawdown
      },
      diversificationScore: response.diversification_score
    };
  }

  /**
   * Get portfolio positions
   */
  async getPositions(): Promise<Array<{
    symbol: string;
    name: string;
    type: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    value: number;
    pnl: number;
    pnlPercent: number;
    allocation: number;
  }>> {
    const response = await this.request('/portfolio/positions');
    return response.positions;
  }

  // ============================================================
  // Social Features
  // ============================================================

  /**
   * Get social feed
   */
  async getSocialFeed(options: {
    fromCopied?: boolean;
    trending?: boolean;
    username?: string;
    asset?: string;
    limit?: number;
  } = {}): Promise<SocialPost[]> {
    const params: any = { limit: options.limit || 20 };
    
    if (options.fromCopied) params.from = 'copied';
    if (options.trending) params.trending = true;
    if (options.username) params.user = options.username;
    if (options.asset) params.asset = options.asset;

    const response = await this.request('/social/feed', { params });
    return response.posts.map(this.parsePost);
  }

  /**
   * Get market sentiment for an asset
   */
  async getSentiment(symbol: string): Promise<{
    symbol: string;
    bullish: number;  // percentage
    bearish: number;
    neutral: number;
    totalMentions: number;
    change24h: number;
  }> {
    const response = await this.request(`/social/sentiment/${symbol}`);
    return response;
  }

  // ============================================================
  // WebSocket Streaming
  // ============================================================

  /**
   * Connect to WebSocket for real-time updates
   */
  connect(): void {
    if (this.ws) return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.emit('connected');
      // Resubscribe to existing subscriptions
      for (const symbol of this.subscriptions.keys()) {
        this.sendSubscribe(symbol);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'quote' && data.symbol) {
          const callbacks = this.subscriptions.get(data.symbol);
          if (callbacks) {
            const marketData = this.parseMarketData(data);
            callbacks.forEach(cb => cb(marketData));
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.emit('disconnected');
      // Reconnect after 5 seconds
      setTimeout(() => this.connect(), 5000);
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };
  }

  /**
   * Subscribe to real-time quotes
   */
  subscribe(symbol: string, callback: (data: MarketData) => void): () => void {
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendSubscribe(symbol);
      }
    }

    this.subscriptions.get(symbol)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(symbol);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(symbol);
          this.sendUnsubscribe(symbol);
        }
      }
    };
  }

  private sendSubscribe(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'subscribe', symbol }));
    }
  }

  private sendUnsubscribe(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'unsubscribe', symbol }));
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private async request(
    endpoint: string, 
    options: { 
      method?: string; 
      body?: string;
      params?: Record<string, any>;
    } = {}
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers,
      body: options.body
    });

    if (!response.ok) {
      throw new Error(`eToro API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private parseMarketData(data: any): MarketData {
    return {
      symbol: data.symbol || data.instrument_id,
      price: data.price || data.last_price,
      change: data.change || 0,
      changePercent: data.change_percent || data.change_pct || 0,
      bid: data.bid || data.price,
      ask: data.ask || data.price,
      volume: data.volume || 0,
      timestamp: new Date(data.timestamp || Date.now())
    };
  }

  private parseInvestor(data: any): PopularInvestor {
    return {
      username: data.username,
      displayName: data.display_name || data.username,
      avatarUrl: data.avatar_url || '',
      riskScore: data.risk_score || 5,
      copiers: data.copiers || 0,
      aum: data.aum || 0,
      performance: {
        daily: data.performance?.daily || 0,
        weekly: data.performance?.weekly || 0,
        monthly: data.performance?.monthly || 0,
        yearly: data.performance?.yearly || 0,
        allTime: data.performance?.all_time || 0
      },
      stats: {
        winRate: data.stats?.win_rate || 0,
        avgTradeDuration: data.stats?.avg_trade_duration || 'N/A',
        profitableWeeks: data.stats?.profitable_weeks || 0,
        totalTrades: data.stats?.total_trades || 0
      },
      tradingStyle: data.trading_style || 'Unknown',
      topAssets: data.top_assets || [],
      bio: data.bio || ''
    };
  }

  private parsePost(data: any): SocialPost {
    return {
      id: data.id,
      username: data.username,
      content: data.content || data.text,
      timestamp: new Date(data.timestamp || data.created_at),
      likes: data.likes || 0,
      comments: data.comments || 0,
      shares: data.shares || 0,
      mentionedAssets: data.mentioned_assets || []
    };
  }
}

// ============================================================
// Quick Functions (for CLI/Agent use)
// ============================================================

/**
 * Quick check of top traders
 */
export async function topTraders(count: number = 5): Promise<void> {
  const client = new EtoroClient();
  const traders = await client.discoverTraders({ limit: count });
  
  console.log('\n🌐 eToro Top Traders\n');
  traders.forEach((t, i) => {
    console.log(`${i + 1}. @${t.username}`);
    console.log(`   Return: ${t.performance.yearly > 0 ? '+' : ''}${t.performance.yearly}%`);
    console.log(`   Risk: ${t.riskScore}/10 | Copiers: ${t.copiers.toLocaleString()}`);
    console.log();
  });
}

/**
 * Get trader info
 */
export async function traderInfo(username: string): Promise<void> {
  const client = new EtoroClient();
  const trader = await client.getTraderProfile(username);
  
  console.log(`\n👤 @${trader.username}\n`);
  console.log(`Risk Score: ${trader.riskScore}/10`);
  console.log(`Copiers: ${trader.copiers.toLocaleString()}`);
  console.log(`AUM: $${(trader.aum / 1e6).toFixed(1)}M`);
  console.log(`\nPerformance:`);
  console.log(`  Monthly: ${trader.performance.monthly > 0 ? '+' : ''}${trader.performance.monthly}%`);
  console.log(`  Yearly: ${trader.performance.yearly > 0 ? '+' : ''}${trader.performance.yearly}%`);
  console.log(`  Win Rate: ${trader.stats.winRate}%`);
}

/**
 * Market overview
 */
export async function marketOverview(): Promise<void> {
  const client = new EtoroClient();
  const markets = await client.getMarkets(['crypto', 'stocks']);
  
  console.log('\n📊 eToro Markets\n');
  
  console.log('Crypto:');
  markets.crypto?.slice(0, 5).forEach(m => {
    const sign = m.changePercent >= 0 ? '+' : '';
    console.log(`  ${m.symbol}: $${m.price.toLocaleString()} (${sign}${m.changePercent.toFixed(1)}%)`);
  });
  
  console.log('\nStocks:');
  markets.stocks?.slice(0, 5).forEach(m => {
    const sign = m.changePercent >= 0 ? '+' : '';
    console.log(`  ${m.symbol}: $${m.price.toLocaleString()} (${sign}${m.changePercent.toFixed(1)}%)`);
  });
}

export default EtoroClient;
