/**
 * K.I.T. Exchange Manager
 * 
 * Unified interface for trading on multiple crypto exchanges.
 * Uses CCXT for exchange connectivity.
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/19
 */

import ccxt, { Exchange, Order as CCXTOrder, Balances, Ticker as CCXTTicker, OrderBook as CCXTOrderBook } from 'ccxt';
import { EventEmitter } from 'events';

// ============================================
// Types
// ============================================

export type SupportedExchange = 
  | 'binance' 
  | 'binanceusdm'  // Binance Futures
  | 'coinbase' 
  | 'kraken' 
  | 'kucoin' 
  | 'bybit' 
  | 'okx'
  | 'demo';

export interface ExchangeCredentials {
  apiKey: string;
  secret: string;
  password?: string;  // For exchanges that require it (KuCoin, OKX)
  testnet?: boolean;
}

export interface ExchangeConfig {
  exchange: SupportedExchange;
  credentials?: ExchangeCredentials;
  sandbox?: boolean;
}

export interface Balance {
  asset: string;
  free: number;
  used: number;
  total: number;
  usdValue?: number;
}

export interface Order {
  id: string;
  exchange: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  filled: number;
  remaining: number;
  status: 'open' | 'closed' | 'canceled';
  timestamp: Date;
  fee?: number;
}

export interface Ticker {
  symbol: string;
  exchange: string;
  bid: number;
  ask: number;
  last: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h: number;
  changePercent24h: number;
  timestamp: Date;
}

export interface OrderBook {
  symbol: string;
  exchange: string;
  bids: [number, number][];  // [price, amount]
  asks: [number, number][];
  timestamp: Date;
}

export interface Position {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice?: number;
  unrealizedPnl: number;
  leverage: number;
  margin: number;
}

export interface TradeResult {
  success: boolean;
  order?: Order;
  error?: string;
}

// ============================================
// Exchange Manager
// ============================================

/**
 * Exchange Manager - Unified interface for crypto trading
 */
export class ExchangeManager extends EventEmitter {
  private exchanges: Map<string, Exchange> = new Map();
  private configs: Map<string, ExchangeConfig> = new Map();
  private verbose: boolean;
  
  constructor(verbose: boolean = true) {
    super();
    this.verbose = verbose;
  }
  
  // ============================================
  // Connection Management
  // ============================================
  
  /**
   * Add an exchange connection
   */
  async addExchange(config: ExchangeConfig): Promise<boolean> {
    const { exchange, credentials, sandbox } = config;
    
    try {
      // Create exchange instance
      const ExchangeClass = ccxt[exchange as keyof typeof ccxt] as any;
      if (!ExchangeClass) {
        throw new Error(`Exchange ${exchange} not supported by CCXT`);
      }
      
      const exchangeConfig: any = {
        enableRateLimit: true,
        options: {
          adjustForTimeDifference: true
        }
      };
      
      if (credentials) {
        exchangeConfig.apiKey = credentials.apiKey;
        exchangeConfig.secret = credentials.secret;
        if (credentials.password) {
          exchangeConfig.password = credentials.password;
        }
      }
      
      const instance = new ExchangeClass(exchangeConfig);
      
      // Enable sandbox/testnet if configured
      if (sandbox || credentials?.testnet) {
        instance.setSandboxMode(true);
      }
      
      // Load markets
      await instance.loadMarkets();
      
      // Store
      this.exchanges.set(exchange, instance);
      this.configs.set(exchange, config);
      
      if (this.verbose) {
        const marketCount = Object.keys(instance.markets).length;
        console.log(`✅ Connected to ${exchange} (${marketCount} markets)`);
      }
      
      this.emit('exchange_connected', exchange);
      return true;
      
    } catch (error: any) {
      console.error(`❌ Failed to connect to ${exchange}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Remove an exchange connection
   */
  removeExchange(exchange: SupportedExchange): void {
    this.exchanges.delete(exchange);
    this.configs.delete(exchange);
    console.log(`🔌 Disconnected from ${exchange}`);
  }
  
  /**
   * Get connected exchanges
   */
  getConnectedExchanges(): SupportedExchange[] {
    return Array.from(this.exchanges.keys()) as SupportedExchange[];
  }
  
  /**
   * Check if an exchange is connected
   */
  isConnected(exchange: SupportedExchange): boolean {
    return this.exchanges.has(exchange);
  }
  
  // ============================================
  // Balance Operations
  // ============================================
  
  /**
   * Get balance for a specific exchange
   */
  async getBalance(exchange: SupportedExchange): Promise<Balance[]> {
    const ex = this.getExchange(exchange);
    
    try {
      const balances = await ex.fetchBalance();
      const result: Balance[] = [];
      
      for (const [asset, balance] of Object.entries(balances.total || {})) {
        const total = balance as number;
        if (total > 0) {
          const free = (balances.free?.[asset] as number) || 0;
          const used = (balances.used?.[asset] as number) || 0;
          
          result.push({
            asset,
            free,
            used,
            total
          });
        }
      }
      
      return result;
    } catch (error: any) {
      console.error(`Error fetching balance from ${exchange}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get balances from all connected exchanges
   */
  async getAllBalances(): Promise<Map<string, Balance[]>> {
    const results = new Map<string, Balance[]>();
    
    for (const exchange of this.exchanges.keys()) {
      const balances = await this.getBalance(exchange as SupportedExchange);
      results.set(exchange, balances);
    }
    
    return results;
  }
  
  /**
   * Get aggregated balance across all exchanges
   */
  async getAggregatedBalance(): Promise<Balance[]> {
    const allBalances = await this.getAllBalances();
    const aggregated = new Map<string, Balance>();
    
    for (const balances of allBalances.values()) {
      for (const balance of balances) {
        const existing = aggregated.get(balance.asset);
        if (existing) {
          existing.free += balance.free;
          existing.used += balance.used;
          existing.total += balance.total;
        } else {
          aggregated.set(balance.asset, { ...balance });
        }
      }
    }
    
    return Array.from(aggregated.values());
  }
  
  // ============================================
  // Market Data
  // ============================================
  
  /**
   * Get ticker for a symbol
   */
  async getTicker(exchange: SupportedExchange, symbol: string): Promise<Ticker | null> {
    const ex = this.getExchange(exchange);
    
    try {
      const ticker = await ex.fetchTicker(symbol);
      
      return {
        symbol,
        exchange,
        bid: ticker.bid || 0,
        ask: ticker.ask || 0,
        last: ticker.last || 0,
        high24h: ticker.high || 0,
        low24h: ticker.low || 0,
        volume24h: ticker.baseVolume || 0,
        change24h: ticker.change || 0,
        changePercent24h: ticker.percentage || 0,
        timestamp: new Date(ticker.timestamp || Date.now())
      };
    } catch (error: any) {
      console.error(`Error fetching ticker for ${symbol} on ${exchange}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get order book
   */
  async getOrderBook(exchange: SupportedExchange, symbol: string, limit: number = 10): Promise<OrderBook | null> {
    const ex = this.getExchange(exchange);
    
    try {
      const ob = await ex.fetchOrderBook(symbol, limit);
      
      return {
        symbol,
        exchange,
        bids: ob.bids.slice(0, limit) as [number, number][],
        asks: ob.asks.slice(0, limit) as [number, number][],
        timestamp: new Date(ob.timestamp || Date.now())
      };
    } catch (error: any) {
      console.error(`Error fetching order book for ${symbol} on ${exchange}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get available symbols on an exchange
   */
  getSymbols(exchange: SupportedExchange): string[] {
    const ex = this.exchanges.get(exchange);
    if (!ex) return [];
    return Object.keys(ex.markets || {});
  }
  
  // ============================================
  // Trading Operations
  // ============================================
  
  /**
   * Place a market order
   */
  async marketOrder(
    exchange: SupportedExchange,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number
  ): Promise<TradeResult> {
    const ex = this.getExchange(exchange);
    
    try {
      if (this.verbose) {
        console.log(`📈 ${side.toUpperCase()} ${amount} ${symbol} on ${exchange} (MARKET)`);
      }
      
      const order = await ex.createOrder(symbol, 'market', side, amount);
      
      return {
        success: true,
        order: this.convertOrder(order, exchange)
      };
    } catch (error: any) {
      console.error(`Trade failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Place a limit order
   */
  async limitOrder(
    exchange: SupportedExchange,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number
  ): Promise<TradeResult> {
    const ex = this.getExchange(exchange);
    
    try {
      if (this.verbose) {
        console.log(`📈 ${side.toUpperCase()} ${amount} ${symbol} @ ${price} on ${exchange} (LIMIT)`);
      }
      
      const order = await ex.createOrder(symbol, 'limit', side, amount, price);
      
      return {
        success: true,
        order: this.convertOrder(order, exchange)
      };
    } catch (error: any) {
      console.error(`Trade failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Cancel an order
   */
  async cancelOrder(exchange: SupportedExchange, orderId: string, symbol: string): Promise<boolean> {
    const ex = this.getExchange(exchange);
    
    try {
      await ex.cancelOrder(orderId, symbol);
      console.log(`❌ Order ${orderId} cancelled`);
      return true;
    } catch (error: any) {
      console.error(`Cancel failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get open orders
   */
  async getOpenOrders(exchange: SupportedExchange, symbol?: string): Promise<Order[]> {
    const ex = this.getExchange(exchange);
    
    try {
      const orders = await ex.fetchOpenOrders(symbol);
      return orders.map(o => this.convertOrder(o, exchange));
    } catch (error: any) {
      console.error(`Error fetching open orders: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get order history
   */
  async getOrderHistory(exchange: SupportedExchange, symbol?: string, limit: number = 50): Promise<Order[]> {
    const ex = this.getExchange(exchange);
    
    try {
      const orders = await ex.fetchOrders(symbol, undefined, limit);
      return orders.map(o => this.convertOrder(o, exchange));
    } catch (error: any) {
      console.error(`Error fetching order history: ${error.message}`);
      return [];
    }
  }
  
  // ============================================
  // Futures/Margin (for supported exchanges)
  // ============================================
  
  /**
   * Get futures positions
   */
  async getPositions(exchange: SupportedExchange, symbol?: string): Promise<Position[]> {
    const ex = this.getExchange(exchange);
    
    // Check if exchange supports futures
    if (!ex.has['fetchPositions']) {
      return [];
    }
    
    try {
      const positions = await ex.fetchPositions(symbol ? [symbol] : undefined);
      return positions
        .filter((p: any) => p.contracts > 0)
        .map((p: any) => ({
          symbol: p.symbol,
          exchange,
          side: p.side === 'long' ? 'long' : 'short',
          size: p.contracts || p.contractSize || 0,
          entryPrice: p.entryPrice || 0,
          markPrice: p.markPrice || 0,
          liquidationPrice: p.liquidationPrice,
          unrealizedPnl: p.unrealizedPnl || 0,
          leverage: p.leverage || 1,
          margin: p.initialMargin || p.collateral || 0
        } as Position));
    } catch (error: any) {
      console.error(`Error fetching positions: ${error.message}`);
      return [];
    }
  }
  
  // ============================================
  // Helpers
  // ============================================
  
  private getExchange(exchange: SupportedExchange): Exchange {
    const ex = this.exchanges.get(exchange);
    if (!ex) {
      throw new Error(`Exchange ${exchange} not connected`);
    }
    return ex;
  }
  
  private convertOrder(order: CCXTOrder, exchange: string): Order {
    return {
      id: order.id,
      exchange,
      symbol: order.symbol,
      type: order.type as 'market' | 'limit' | 'stop',
      side: order.side as 'buy' | 'sell',
      amount: order.amount,
      price: order.price,
      filled: order.filled || 0,
      remaining: order.remaining || order.amount,
      status: order.status as 'open' | 'closed' | 'canceled',
      timestamp: new Date(order.timestamp || Date.now()),
      fee: order.fee?.cost
    };
  }
  
  /**
   * Get exchange instance for advanced operations
   */
  getRawExchange(exchange: SupportedExchange): Exchange | undefined {
    return this.exchanges.get(exchange);
  }
}

/**
 * Factory function
 */
export function createExchangeManager(verbose?: boolean): ExchangeManager {
  return new ExchangeManager(verbose);
}
