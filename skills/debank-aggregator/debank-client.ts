/**
 * DeBank DeFi Portfolio Aggregator
 * K.I.T. Skill - Multi-chain DeFi tracking via DeBank API
 */

import { EventEmitter } from 'events';

const DEBANK_API_BASE = 'https://pro-openapi.debank.com';
const DEBANK_FREE_API = 'https://openapi.debank.com';

interface DeBankConfig {
  apiKey?: string;
  watchlist?: string[];
  alerts?: {
    portfolioChange?: number;
    protocolRisk?: boolean;
    whaleMovement?: number;
  };
}

interface TokenBalance {
  id: string;
  chain: string;
  name: string;
  symbol: string;
  amount: number;
  price: number;
  value: number;
  logo?: string;
}

interface ProtocolPosition {
  id: string;
  chain: string;
  name: string;
  logo?: string;
  siteUrl?: string;
  netUsdValue: number;
  assetUsdValue: number;
  debtUsdValue: number;
  portfolioItemList: PortfolioItem[];
}

interface PortfolioItem {
  name: string;
  detail: {
    supplyTokenList?: TokenDetail[];
    rewardTokenList?: TokenDetail[];
    borrowTokenList?: TokenDetail[];
  };
  netUsdValue: number;
}

interface TokenDetail {
  id: string;
  symbol: string;
  amount: number;
  price: number;
}

interface ChainBalance {
  id: string;
  name: string;
  logo?: string;
  usdValue: number;
}

interface Portfolio {
  address: string;
  totalUsdValue: number;
  chains: ChainBalance[];
  tokens: TokenBalance[];
  protocols: ProtocolPosition[];
  timestamp: number;
}

interface WhaleActivity {
  address: string;
  action: 'buy' | 'sell' | 'stake' | 'unstake' | 'lp_add' | 'lp_remove';
  protocol?: string;
  token?: string;
  amount: number;
  usdValue: number;
  txHash: string;
  timestamp: number;
}

export class DeBankClient extends EventEmitter {
  private config: DeBankConfig;
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private cacheTTL = 60000; // 1 minute cache

  constructor(config: DeBankConfig = {}) {
    super();
    this.config = config;
  }

  private get apiBase(): string {
    return this.config.apiKey ? DEBANK_API_BASE : DEBANK_FREE_API;
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['AccessKey'] = this.config.apiKey;
    }
    return headers;
  }

  private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }

    const url = new URL(`${this.apiBase}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`DeBank API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.cache.set(cacheKey, { data, expires: Date.now() + this.cacheTTL });
    
    return data as T;
  }

  /**
   * Get total portfolio value across all chains
   */
  async getTotalBalance(address: string): Promise<number> {
    const data = await this.request<{ total_usd_value: number }>('/v1/user/total_balance', {
      id: address.toLowerCase(),
    });
    return data.total_usd_value;
  }

  /**
   * Get balance breakdown by chain
   */
  async getChainBalances(address: string): Promise<ChainBalance[]> {
    const data = await this.request<any[]>('/v1/user/chain_balance', {
      id: address.toLowerCase(),
    });
    
    return data.map(chain => ({
      id: chain.id,
      name: chain.name,
      logo: chain.logo_url,
      usdValue: chain.usd_value,
    }));
  }

  /**
   * Get all token balances
   */
  async getTokenBalances(address: string, chainId?: string): Promise<TokenBalance[]> {
    const params: Record<string, any> = {
      id: address.toLowerCase(),
      is_all: !chainId,
    };
    if (chainId) {
      params.chain_id = chainId;
    }

    const data = await this.request<any[]>('/v1/user/token_list', params);
    
    return data.map(token => ({
      id: token.id,
      chain: token.chain,
      name: token.name,
      symbol: token.symbol,
      amount: token.amount,
      price: token.price,
      value: token.amount * token.price,
      logo: token.logo_url,
    }));
  }

  /**
   * Get protocol positions (lending, staking, LP, etc.)
   */
  async getProtocolPositions(address: string, chainId?: string): Promise<ProtocolPosition[]> {
    const params: Record<string, any> = {
      id: address.toLowerCase(),
    };
    if (chainId) {
      params.chain_id = chainId;
    }

    const data = await this.request<any[]>('/v1/user/complex_protocol_list', params);
    
    return data.map(protocol => ({
      id: protocol.id,
      chain: protocol.chain,
      name: protocol.name,
      logo: protocol.logo_url,
      siteUrl: protocol.site_url,
      netUsdValue: protocol.net_usd_value,
      assetUsdValue: protocol.asset_usd_value,
      debtUsdValue: protocol.debt_usd_value,
      portfolioItemList: protocol.portfolio_item_list?.map((item: any) => ({
        name: item.name,
        detail: item.detail,
        netUsdValue: item.stats?.net_usd_value || 0,
      })) || [],
    }));
  }

  /**
   * Get complete portfolio summary
   */
  async getPortfolio(address: string): Promise<Portfolio> {
    const [totalBalance, chains, tokens, protocols] = await Promise.all([
      this.getTotalBalance(address),
      this.getChainBalances(address),
      this.getTokenBalances(address),
      this.getProtocolPositions(address),
    ]);

    return {
      address: address.toLowerCase(),
      totalUsdValue: totalBalance,
      chains,
      tokens,
      protocols,
      timestamp: Date.now(),
    };
  }

  /**
   * Get transaction history (Pro API required)
   */
  async getTransactionHistory(address: string, options: {
    chainId?: string;
    startTime?: number;
    pageCount?: number;
  } = {}): Promise<any[]> {
    if (!this.config.apiKey) {
      throw new Error('Transaction history requires DeBank Pro API key');
    }

    const data = await this.request<{ history_list: any[] }>('/v1/user/history_list', {
      id: address.toLowerCase(),
      chain_id: options.chainId,
      start_time: options.startTime,
      page_count: options.pageCount || 20,
    });

    return data.history_list;
  }

  /**
   * Get NFT holdings (Pro API required)
   */
  async getNFTHoldings(address: string, chainId?: string): Promise<any[]> {
    if (!this.config.apiKey) {
      throw new Error('NFT holdings requires DeBank Pro API key');
    }

    const params: Record<string, any> = {
      id: address.toLowerCase(),
      is_all: !chainId,
    };
    if (chainId) {
      params.chain_id = chainId;
    }

    return this.request<any[]>('/v1/user/nft_list', params);
  }

  /**
   * Watch address for changes
   */
  startWatching(address: string, intervalMs: number = 300000): void {
    let lastValue: number | null = null;

    const check = async () => {
      try {
        const portfolio = await this.getPortfolio(address);
        
        if (lastValue !== null) {
          const change = ((portfolio.totalUsdValue - lastValue) / lastValue) * 100;
          const threshold = this.config.alerts?.portfolioChange || 5;
          
          if (Math.abs(change) >= threshold) {
            this.emit('portfolioChange', {
              address,
              previousValue: lastValue,
              currentValue: portfolio.totalUsdValue,
              changePercent: change,
              portfolio,
            });
          }
        }
        
        lastValue = portfolio.totalUsdValue;
        this.emit('portfolioUpdate', portfolio);
      } catch (error) {
        this.emit('error', error);
      }
    };

    check();
    setInterval(check, intervalMs);
  }

  /**
   * Get supported chains
   */
  async getSupportedChains(): Promise<{ id: string; name: string; logo: string }[]> {
    const data = await this.request<any[]>('/v1/chain/list');
    return data.map(chain => ({
      id: chain.id,
      name: chain.name,
      logo: chain.logo_url,
    }));
  }

  /**
   * Get all supported protocols
   */
  async getSupportedProtocols(): Promise<{ id: string; name: string; chain: string; logo: string }[]> {
    const data = await this.request<any[]>('/v1/protocol/list');
    return data.map(protocol => ({
      id: protocol.id,
      name: protocol.name,
      chain: protocol.chain,
      logo: protocol.logo_url,
    }));
  }
}

// Convenience functions
export async function getPortfolio(address: string, apiKey?: string): Promise<Portfolio> {
  const client = new DeBankClient({ apiKey });
  return client.getPortfolio(address);
}

export async function getTokenBalances(address: string, apiKey?: string): Promise<TokenBalance[]> {
  const client = new DeBankClient({ apiKey });
  return client.getTokenBalances(address);
}

export async function getProtocolPositions(address: string, apiKey?: string): Promise<ProtocolPosition[]> {
  const client = new DeBankClient({ apiKey });
  return client.getProtocolPositions(address);
}

export async function getTotalBalance(address: string, apiKey?: string): Promise<number> {
  const client = new DeBankClient({ apiKey });
  return client.getTotalBalance(address);
}

// Quick portfolio summary
export async function quickSummary(address: string): Promise<string> {
  const client = new DeBankClient();
  const portfolio = await client.getPortfolio(address);
  
  let summary = `📊 Portfolio: $${portfolio.totalUsdValue.toLocaleString()}\n\n`;
  
  summary += `🔗 Chains:\n`;
  portfolio.chains
    .filter(c => c.usdValue > 0)
    .sort((a, b) => b.usdValue - a.usdValue)
    .slice(0, 5)
    .forEach(chain => {
      summary += `  ${chain.name}: $${chain.usdValue.toLocaleString()}\n`;
    });
  
  if (portfolio.protocols.length > 0) {
    summary += `\n🏦 Top Protocols:\n`;
    portfolio.protocols
      .sort((a, b) => b.netUsdValue - a.netUsdValue)
      .slice(0, 5)
      .forEach(protocol => {
        summary += `  ${protocol.name}: $${protocol.netUsdValue.toLocaleString()}\n`;
      });
  }
  
  return summary;
}
