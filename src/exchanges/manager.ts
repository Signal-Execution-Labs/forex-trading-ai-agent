/**
 * K.I.T. Exchange Manager
 * Handles connections to multiple trading platforms
 */

import { Logger } from '../core/logger';
import { Trade } from '../core/engine';

export interface ExchangeConfig {
  name: string;
  apiKey: string;
  apiSecret: string;
  testnet?: boolean;
}

export interface MarketData {
  symbol: string;
  exchange: string;
  price: number;
  volume: number;
  high24h: number;
  low24h: number;
  timestamp: Date;
}

export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class ExchangeManager {
  private logger: Logger;
  private exchanges: Map<string, any> = new Map();
  private connected: boolean = false;

  constructor() {
    this.logger = new Logger('Exchanges');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing exchange connections...');
    
    // Load exchange configs from environment
    const configs = this.loadConfigs();
    
    for (const config of configs) {
      await this.connectExchange(config);
    }
    
    this.connected = true;
    this.logger.info(`Connected to ${this.exchanges.size} exchanges`);
  }

  private loadConfigs(): ExchangeConfig[] {
    const configs: ExchangeConfig[] = [];
    
    // Binance
    if (process.env.BINANCE_API_KEY) {
      configs.push({
        name: 'binance',
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_API_SECRET || '',
        testnet: process.env.BINANCE_TESTNET === 'true'
      });
    }
    
    // Kraken
    if (process.env.KRAKEN_API_KEY) {
      configs.push({
        name: 'kraken',
        apiKey: process.env.KRAKEN_API_KEY,
        apiSecret: process.env.KRAKEN_API_SECRET || ''
      });
    }
    
    // Add more exchanges as needed...
    
    return configs;
  }

  private async connectExchange(config: ExchangeConfig): Promise<void> {
    this.logger.info(`Connecting to ${config.name}...`);
    
    try {
      // Using CCXT for unified exchange interface
      const ccxt = await import('ccxt');
      const ExchangeClass = (ccxt as any)[config.name];
      
      if (!ExchangeClass) {
        throw new Error(`Exchange ${config.name} not supported`);
      }
      
      const exchange = new ExchangeClass({
        apiKey: config.apiKey,
        secret: config.apiSecret,
        sandbox: config.testnet
      });
      
      // Test connection
      await exchange.loadMarkets();
      
      this.exchanges.set(config.name, exchange);
      this.logger.info(`✅ Connected to ${config.name}`);
      
    } catch (error) {
      this.logger.error(`Failed to connect to ${config.name}:`, error);
    }
  }

  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from exchanges...');
    this.exchanges.clear();
    this.connected = false;
  }

  async getMarketData(): Promise<MarketData[]> {
    const allData: MarketData[] = [];
    
    for (const [name, exchange] of this.exchanges) {
      try {
        // Get ticker data for main trading pairs
        const symbols = this.getTradingSymbols(name);
        
        for (const symbol of symbols) {
          const ticker = await exchange.fetchTicker(symbol);
          
          allData.push({
            symbol,
            exchange: name,
            price: ticker.last,
            volume: ticker.baseVolume,
            high24h: ticker.high,
            low24h: ticker.low,
            timestamp: new Date()
          });
        }
      } catch (error) {
        this.logger.error(`Error fetching data from ${name}:`, error);
      }
    }
    
    return allData;
  }

  async getOHLCV(exchange: string, symbol: string, timeframe: string = '1h', limit: number = 100): Promise<OHLCV[]> {
    const ex = this.exchanges.get(exchange);
    if (!ex) throw new Error(`Exchange ${exchange} not connected`);
    
    const data = await ex.fetchOHLCV(symbol, timeframe, undefined, limit);
    
    return data.map((candle: number[]) => ({
      timestamp: new Date(candle[0]),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5]
    }));
  }

  async executeOrder(trade: Trade): Promise<any> {
    const exchange = this.exchanges.get(trade.exchange);
    if (!exchange) throw new Error(`Exchange ${trade.exchange} not connected`);
    
    const order = await exchange.createOrder(
      trade.symbol,
      'market', // or 'limit'
      trade.side,
      trade.amount,
      trade.price
    );
    
    return order;
  }

  private getTradingSymbols(exchange: string): string[] {
    // Default trading pairs per exchange
    const defaultPairs: Record<string, string[]> = {
      binance: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'],
      kraken: ['BTC/USD', 'ETH/USD', 'XRP/USD'],
      default: ['BTC/USDT', 'ETH/USDT']
    };
    
    return defaultPairs[exchange] || defaultPairs.default;
  }

  getExchange(name: string): any {
    return this.exchanges.get(name);
  }

  listExchanges(): string[] {
    return Array.from(this.exchanges.keys());
  }
}
