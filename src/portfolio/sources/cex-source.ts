/**
 * CEX Data Source
 * 
 * Aggregates balances from centralized exchanges via CCXT.
 */

import ccxt, { Exchange } from 'ccxt';
import { 
  PortfolioDataSource, 
  AssetPosition,
  Platform 
} from '../unified-portfolio';

export interface CEXConfig {
  exchange: string;
  apiKey?: string;
  secret?: string;
  password?: string;
  sandbox?: boolean;
}

export class CEXSource implements PortfolioDataSource {
  name: string;
  platform: Platform = 'cex';
  
  private config: CEXConfig;
  private exchange: Exchange | null = null;
  
  constructor(config: CEXConfig) {
    this.config = config;
    this.name = config.exchange;
  }
  
  isConnected(): boolean {
    return this.exchange !== null;
  }
  
  async connect(): Promise<boolean> {
    try {
      const exchangeId = this.config.exchange.toLowerCase();
      if (!(exchangeId in ccxt)) {
        throw new Error(`Exchange ${this.config.exchange} not supported`);
      }
      
      const ExchangeClass = (ccxt as any)[exchangeId];
      this.exchange = new ExchangeClass({
        apiKey: this.config.apiKey || process.env[`${this.config.exchange.toUpperCase()}_API_KEY`],
        secret: this.config.secret || process.env[`${this.config.exchange.toUpperCase()}_SECRET`],
        password: this.config.password,
        sandbox: this.config.sandbox ?? false,
        enableRateLimit: true,
      }) as Exchange;
      
      await this.exchange.loadMarkets();
      return true;
    } catch (error) {
      this.exchange = null;
      throw error;
    }
  }
  
  async getPositions(): Promise<AssetPosition[]> {
    if (!this.exchange) {
      throw new Error('Not connected');
    }
    
    const positions: AssetPosition[] = [];
    const balance = await this.exchange.fetchBalance();
    const now = new Date();
    
    // Stablecoins to treat as cash
    const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP'];
    
    for (const [currency, amount] of Object.entries(balance.total || {})) {
      const total = amount as number;
      if (!total || total < 0.00000001) continue;
      
      let priceUsd = 1;
      const isCash = stablecoins.includes(currency) || currency === 'USD';
      
      if (!isCash) {
        try {
          // Try to get price
          const symbol = `${currency}/USDT`;
          if (this.exchange.markets[symbol]) {
            const ticker = await this.exchange.fetchTicker(symbol);
            priceUsd = ticker.last || 0;
          }
        } catch {
          // Skip assets we can't price
          continue;
        }
      }
      
      positions.push({
        id: `${this.name}-${currency}`,
        symbol: currency,
        name: currency,
        class: isCash ? 'cash' : 'crypto',
        platform: 'cex',
        source: this.name,
        quantity: total,
        priceUsd,
        valueUsd: total * priceUsd,
        updatedAt: now
      });
    }
    
    return positions;
  }
  
  disconnect(): void {
    this.exchange = null;
  }
}

export function createCEXSource(config: CEXConfig): CEXSource {
  return new CEXSource(config);
}
