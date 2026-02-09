/**
 * K.I.T. Exchange Manager
 * Unified interface for managing multiple exchange connections
 * Supports: Binance, Kraken, Coinbase, Bybit, OKX, OANDA (Forex)
 */

import { Logger } from '../core/logger';
import { BaseExchange, ExchangeCredentials, MarketData, OHLCV, OrderBook, Trade, Order, Balance, Position, WebSocketCallback } from './base';
import { BinanceExchange } from './binance';
import { KrakenExchange } from './kraken';
import { CoinbaseExchange } from './coinbase';
import { BybitExchange } from './bybit';
import { OKXExchange } from './okx';
import { OANDAExchange } from './oanda';

export interface ExchangeConfig {
  name: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;     // For Coinbase, OKX
  accountId?: string;      // For OANDA
  testnet?: boolean;
  futuresMode?: boolean;   // For Binance, Kraken
  category?: string;       // For Bybit (spot, linear, inverse)
  instType?: string;       // For OKX (SPOT, MARGIN, SWAP, FUTURES, OPTION)
}

export { MarketData, OHLCV, OrderBook, Trade, Order, Balance, Position };

export class ExchangeManager {
  private logger: Logger;
  private exchanges: Map<string, BaseExchange> = new Map();
  private connected: boolean = false;

  constructor() {
    this.logger = new Logger('ExchangeManager');
  }

  /**
   * Initialize and connect to all configured exchanges
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing exchange connections...');
    
    const configs = this.loadConfigs();
    
    for (const config of configs) {
      try {
        await this.connectExchange(config);
      } catch (error) {
        this.logger.error(`Failed to connect to ${config.name}:`, error);
      }
    }
    
    this.connected = true;
    this.logger.info(`✅ Connected to ${this.exchanges.size} exchanges`);
  }

  /**
   * Load exchange configurations from environment variables
   */
  private loadConfigs(): ExchangeConfig[] {
    const configs: ExchangeConfig[] = [];
    
    // Binance
    if (process.env.BINANCE_API_KEY) {
      configs.push({
        name: 'binance',
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_API_SECRET || '',
        testnet: process.env.BINANCE_TESTNET === 'true',
        futuresMode: process.env.BINANCE_FUTURES === 'true',
      });
    }
    
    // Kraken
    if (process.env.KRAKEN_API_KEY) {
      configs.push({
        name: 'kraken',
        apiKey: process.env.KRAKEN_API_KEY,
        apiSecret: process.env.KRAKEN_API_SECRET || '',
        futuresMode: process.env.KRAKEN_FUTURES === 'true',
      });
    }

    // Coinbase
    if (process.env.COINBASE_API_KEY) {
      configs.push({
        name: 'coinbase',
        apiKey: process.env.COINBASE_API_KEY,
        apiSecret: process.env.COINBASE_API_SECRET || '',
      });
    }

    // Bybit
    if (process.env.BYBIT_API_KEY) {
      configs.push({
        name: 'bybit',
        apiKey: process.env.BYBIT_API_KEY,
        apiSecret: process.env.BYBIT_API_SECRET || '',
        testnet: process.env.BYBIT_TESTNET === 'true',
        category: process.env.BYBIT_CATEGORY || 'linear',
      });
    }

    // OKX
    if (process.env.OKX_API_KEY) {
      configs.push({
        name: 'okx',
        apiKey: process.env.OKX_API_KEY,
        apiSecret: process.env.OKX_API_SECRET || '',
        passphrase: process.env.OKX_PASSPHRASE || '',
        testnet: process.env.OKX_TESTNET === 'true',
        instType: process.env.OKX_INST_TYPE || 'SWAP',
      });
    }

    // OANDA (Forex)
    if (process.env.OANDA_API_KEY) {
      configs.push({
        name: 'oanda',
        apiKey: process.env.OANDA_API_KEY,
        apiSecret: '', // Not used
        accountId: process.env.OANDA_ACCOUNT_ID || '',
        testnet: process.env.OANDA_TESTNET === 'true',
      });
    }
    
    return configs;
  }

  /**
   * Connect to a single exchange
   */
  private async connectExchange(config: ExchangeConfig): Promise<void> {
    this.logger.info(`Connecting to ${config.name}...`);
    
    let exchange: BaseExchange;
    
    const credentials: ExchangeCredentials = {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      passphrase: config.passphrase,
      testnet: config.testnet,
    };

    switch (config.name.toLowerCase()) {
      case 'binance':
        exchange = new BinanceExchange(credentials, config.futuresMode);
        break;
        
      case 'kraken':
        exchange = new KrakenExchange(credentials, config.futuresMode);
        break;
        
      case 'coinbase':
        exchange = new CoinbaseExchange(credentials);
        break;
        
      case 'bybit':
        exchange = new BybitExchange(credentials, config.category as any || 'linear');
        break;
        
      case 'okx':
        exchange = new OKXExchange(credentials, config.instType as any || 'SWAP');
        break;
        
      case 'oanda':
        exchange = new OANDAExchange({
          ...credentials,
          accountId: config.accountId || '',
        });
        break;
        
      default:
        throw new Error(`Unsupported exchange: ${config.name}`);
    }

    await exchange.connect();
    this.exchanges.set(config.name.toLowerCase(), exchange);
    this.logger.info(`✅ Connected to ${config.name}`);
  }

  /**
   * Manually add an exchange instance
   */
  addExchange(name: string, exchange: BaseExchange): void {
    this.exchanges.set(name.toLowerCase(), exchange);
  }

  /**
   * Disconnect all exchanges
   */
  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from all exchanges...');
    
    for (const [name, exchange] of this.exchanges) {
      try {
        await exchange.disconnect();
        this.logger.info(`Disconnected from ${name}`);
      } catch (error) {
        this.logger.error(`Error disconnecting from ${name}:`, error);
      }
    }
    
    this.exchanges.clear();
    this.connected = false;
  }

  /**
   * Get a specific exchange instance
   */
  getExchange(name: string): BaseExchange | undefined {
    return this.exchanges.get(name.toLowerCase());
  }

  /**
   * List all connected exchanges
   */
  listExchanges(): string[] {
    return Array.from(this.exchanges.keys());
  }

  /**
   * Check if manager is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  // ==================== Market Data Methods ====================

  /**
   * Fetch market data from all exchanges or specific ones
   */
  async getMarketData(exchangeNames?: string[]): Promise<MarketData[]> {
    const allData: MarketData[] = [];
    const exchanges = this.getTargetExchanges(exchangeNames);
    
    for (const [name, exchange] of exchanges) {
      try {
        const symbols = this.getDefaultSymbols(name);
        
        for (const symbol of symbols) {
          try {
            const ticker = await exchange.fetchTicker(symbol);
            allData.push(ticker);
          } catch (error) {
            this.logger.warn(`Error fetching ${symbol} from ${name}:`, error);
          }
        }
      } catch (error) {
        this.logger.error(`Error fetching data from ${name}:`, error);
      }
    }
    
    return allData;
  }

  /**
   * Fetch ticker from specific exchange
   */
  async getTicker(exchangeName: string, symbol: string): Promise<MarketData> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    return exchange.fetchTicker(symbol);
  }

  /**
   * Fetch tickers from all exchanges
   */
  async getAllTickers(symbols?: string[]): Promise<Map<string, MarketData[]>> {
    const result = new Map<string, MarketData[]>();
    
    for (const [name, exchange] of this.exchanges) {
      try {
        const tickers = await exchange.fetchTickers(symbols);
        result.set(name, tickers);
      } catch (error) {
        this.logger.error(`Error fetching tickers from ${name}:`, error);
      }
    }
    
    return result;
  }

  /**
   * Fetch order book from specific exchange
   */
  async getOrderBook(exchangeName: string, symbol: string, limit?: number): Promise<OrderBook> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    return exchange.fetchOrderBook(symbol, limit);
  }

  /**
   * Fetch OHLCV candles
   */
  async getOHLCV(exchangeName: string, symbol: string, timeframe: string = '1h', limit: number = 100): Promise<OHLCV[]> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    return exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
  }

  /**
   * Fetch recent trades
   */
  async getTrades(exchangeName: string, symbol: string, limit?: number): Promise<Trade[]> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    return exchange.fetchTrades(symbol, limit);
  }

  // ==================== Account Methods ====================

  /**
   * Fetch balances from all exchanges
   */
  async getAllBalances(): Promise<Map<string, Balance[]>> {
    const result = new Map<string, Balance[]>();
    
    for (const [name, exchange] of this.exchanges) {
      try {
        const balances = await exchange.fetchBalance();
        result.set(name, balances);
      } catch (error) {
        this.logger.error(`Error fetching balance from ${name}:`, error);
      }
    }
    
    return result;
  }

  /**
   * Fetch balance from specific exchange
   */
  async getBalance(exchangeName: string): Promise<Balance[]> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    return exchange.fetchBalance();
  }

  /**
   * Fetch positions from all futures exchanges
   */
  async getAllPositions(): Promise<Map<string, Position[]>> {
    const result = new Map<string, Position[]>();
    
    for (const [name, exchange] of this.exchanges) {
      if (exchange.supportsFutures) {
        try {
          const positions = await exchange.fetchPositions();
          result.set(name, positions);
        } catch (error) {
          this.logger.error(`Error fetching positions from ${name}:`, error);
        }
      }
    }
    
    return result;
  }

  /**
   * Fetch positions from specific exchange
   */
  async getPositions(exchangeName: string): Promise<Position[]> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    return exchange.fetchPositions();
  }

  // ==================== Order Methods ====================

  /**
   * Create an order on specific exchange
   */
  async createOrder(
    exchangeName: string,
    symbol: string,
    type: Order['type'],
    side: Order['side'],
    amount: number,
    price?: number,
    params?: any
  ): Promise<Order> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    
    this.logger.info(`Creating ${type} ${side} order: ${amount} ${symbol} @ ${price || 'market'} on ${exchangeName}`);
    return exchange.createOrder(symbol, type, side, amount, price, params);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(exchangeName: string, orderId: string, symbol?: string): Promise<boolean> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    return exchange.cancelOrder(orderId, symbol);
  }

  /**
   * Fetch a specific order
   */
  async getOrder(exchangeName: string, orderId: string, symbol?: string): Promise<Order> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    return exchange.fetchOrder(orderId, symbol);
  }

  /**
   * Fetch open orders
   */
  async getOpenOrders(exchangeName: string, symbol?: string): Promise<Order[]> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    return exchange.fetchOpenOrders(symbol);
  }

  /**
   * Fetch all open orders from all exchanges
   */
  async getAllOpenOrders(): Promise<Map<string, Order[]>> {
    const result = new Map<string, Order[]>();
    
    for (const [name, exchange] of this.exchanges) {
      try {
        const orders = await exchange.fetchOpenOrders();
        result.set(name, orders);
      } catch (error) {
        this.logger.error(`Error fetching open orders from ${name}:`, error);
      }
    }
    
    return result;
  }

  // ==================== WebSocket Methods ====================

  /**
   * Connect WebSocket for real-time data
   */
  async connectWebSocket(exchangeName: string): Promise<void> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    
    if (!exchange.supportsWebSocket) {
      throw new Error(`Exchange ${exchangeName} does not support WebSocket`);
    }
    
    await exchange.connectWebSocket();
  }

  /**
   * Connect WebSockets for all exchanges
   */
  async connectAllWebSockets(): Promise<void> {
    for (const [name, exchange] of this.exchanges) {
      if (exchange.supportsWebSocket) {
        try {
          await exchange.connectWebSocket();
          this.logger.info(`WebSocket connected for ${name}`);
        } catch (error) {
          this.logger.error(`Failed to connect WebSocket for ${name}:`, error);
        }
      }
    }
  }

  /**
   * Subscribe to ticker updates
   */
  async subscribeToTicker(exchangeName: string, symbol: string, callback: WebSocketCallback): Promise<void> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    await exchange.subscribeToTicker(symbol, callback);
  }

  /**
   * Subscribe to order book updates
   */
  async subscribeToOrderBook(exchangeName: string, symbol: string, callback: WebSocketCallback): Promise<void> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    await exchange.subscribeToOrderBook(symbol, callback);
  }

  /**
   * Subscribe to trade updates
   */
  async subscribeToTrades(exchangeName: string, symbol: string, callback: WebSocketCallback): Promise<void> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    await exchange.subscribeToTrades(symbol, callback);
  }

  /**
   * Subscribe to OHLCV candle updates
   */
  async subscribeToOHLCV(exchangeName: string, symbol: string, timeframe: string, callback: WebSocketCallback): Promise<void> {
    const exchange = this.exchanges.get(exchangeName.toLowerCase());
    if (!exchange) throw new Error(`Exchange ${exchangeName} not connected`);
    await exchange.subscribeToOHLCV(symbol, timeframe, callback);
  }

  // ==================== Utility Methods ====================

  /**
   * Find the best price across all exchanges
   */
  async findBestPrice(symbol: string): Promise<{ exchange: string; bid: number; ask: number; spread: number }[]> {
    const prices: { exchange: string; bid: number; ask: number; spread: number }[] = [];
    
    for (const [name, exchange] of this.exchanges) {
      try {
        const ticker = await exchange.fetchTicker(symbol);
        prices.push({
          exchange: name,
          bid: ticker.bid,
          ask: ticker.ask,
          spread: ticker.spread,
        });
      } catch (error) {
        // Symbol might not exist on this exchange
      }
    }
    
    return prices.sort((a, b) => a.spread - b.spread);
  }

  /**
   * Execute arbitrage opportunity detection
   */
  async detectArbitrage(symbol: string, minSpreadPercent: number = 0.5): Promise<{
    buyExchange: string;
    sellExchange: string;
    buyPrice: number;
    sellPrice: number;
    spreadPercent: number;
  } | null> {
    const prices = await this.findBestPrice(symbol);
    
    if (prices.length < 2) return null;
    
    let bestBuy = prices[0];
    let bestSell = prices[0];
    
    for (const price of prices) {
      if (price.ask < bestBuy.ask) bestBuy = price;
      if (price.bid > bestSell.bid) bestSell = price;
    }
    
    const spreadPercent = ((bestSell.bid - bestBuy.ask) / bestBuy.ask) * 100;
    
    if (spreadPercent >= minSpreadPercent) {
      return {
        buyExchange: bestBuy.exchange,
        sellExchange: bestSell.exchange,
        buyPrice: bestBuy.ask,
        sellPrice: bestSell.bid,
        spreadPercent,
      };
    }
    
    return null;
  }

  /**
   * Get total portfolio value in quote currency
   */
  async getTotalPortfolioValue(quoteCurrency: string = 'USDT'): Promise<number> {
    const balances = await this.getAllBalances();
    let totalValue = 0;
    
    for (const [exchangeName, exchangeBalances] of balances) {
      for (const balance of exchangeBalances) {
        if (balance.currency === quoteCurrency || balance.currency === 'USD') {
          totalValue += balance.total;
        } else if (balance.total > 0) {
          // Try to get price
          try {
            const symbol = `${balance.currency}/${quoteCurrency}`;
            const ticker = await this.getTicker(exchangeName, symbol);
            totalValue += balance.total * ticker.price;
          } catch {
            // Skip if no trading pair
          }
        }
      }
    }
    
    return totalValue;
  }

  // ==================== Private Helpers ====================

  private getTargetExchanges(exchangeNames?: string[]): Map<string, BaseExchange> {
    if (!exchangeNames) return this.exchanges;
    
    const result = new Map<string, BaseExchange>();
    for (const name of exchangeNames) {
      const exchange = this.exchanges.get(name.toLowerCase());
      if (exchange) result.set(name.toLowerCase(), exchange);
    }
    return result;
  }

  private getDefaultSymbols(exchange: string): string[] {
    const defaultPairs: Record<string, string[]> = {
      binance: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT'],
      kraken: ['BTC/USD', 'ETH/USD', 'XRP/USD', 'SOL/USD'],
      coinbase: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
      bybit: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      okx: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      oanda: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'],
    };
    
    return defaultPairs[exchange.toLowerCase()] || ['BTC/USDT', 'ETH/USDT'];
  }
}

// Export singleton instance
export const exchangeManager = new ExchangeManager();
