/**
 * K.I.T. Base Exchange Adapter
 * Abstract base class for all exchange implementations
 */

import { Logger } from '../core/logger';

export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;  // For Coinbase Pro, OKX
  subaccount?: string;  // For Bybit
  testnet?: boolean;
}

export interface MarketData {
  symbol: string;
  exchange: string;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  volume: number;
  high24h: number;
  low24h: number;
  change24h: number;
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

export interface OrderBook {
  bids: [number, number][]; // [price, amount]
  asks: [number, number][];
  timestamp: Date;
  exchange: string;
  symbol: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  cost: number;
  fee: number;
  timestamp: Date;
}

export interface Order {
  id: string;
  clientOrderId?: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stopPrice?: number;
  status: 'open' | 'closed' | 'canceled' | 'expired' | 'rejected';
  filled: number;
  remaining: number;
  timestamp: Date;
}

export interface Balance {
  currency: string;
  free: number;
  used: number;
  total: number;
}

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  liquidationPrice?: number;
}

export type WebSocketCallback = (data: any) => void;

export interface WebSocketSubscription {
  channel: string;
  symbol?: string;
  callback: WebSocketCallback;
}

export abstract class BaseExchange {
  protected logger: Logger;
  protected credentials: ExchangeCredentials;
  protected connected: boolean = false;
  protected wsConnected: boolean = false;
  protected markets: Map<string, any> = new Map();
  protected wsCallbacks: Map<string, WebSocketCallback[]> = new Map();
  
  public abstract readonly name: string;
  public abstract readonly displayName: string;
  public abstract readonly supportsFutures: boolean;
  public abstract readonly supportsMargin: boolean;
  public abstract readonly supportsWebSocket: boolean;

  constructor(credentials: ExchangeCredentials) {
    this.credentials = credentials;
    this.logger = new Logger(`Exchange:${this.constructor.name}`);
  }

  // Connection methods
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<boolean>;

  // Market data methods
  abstract fetchMarkets(): Promise<any[]>;
  abstract fetchTicker(symbol: string): Promise<MarketData>;
  abstract fetchTickers(symbols?: string[]): Promise<MarketData[]>;
  abstract fetchOrderBook(symbol: string, limit?: number): Promise<OrderBook>;
  abstract fetchOHLCV(symbol: string, timeframe: string, since?: number, limit?: number): Promise<OHLCV[]>;
  abstract fetchTrades(symbol: string, limit?: number): Promise<Trade[]>;

  // Account methods
  abstract fetchBalance(): Promise<Balance[]>;
  abstract fetchPositions(): Promise<Position[]>;

  // Order methods
  abstract createOrder(symbol: string, type: Order['type'], side: Order['side'], amount: number, price?: number, params?: any): Promise<Order>;
  abstract cancelOrder(orderId: string, symbol?: string): Promise<boolean>;
  abstract fetchOrder(orderId: string, symbol?: string): Promise<Order>;
  abstract fetchOpenOrders(symbol?: string): Promise<Order[]>;
  abstract fetchClosedOrders(symbol?: string, since?: number, limit?: number): Promise<Order[]>;

  // WebSocket methods (optional)
  async connectWebSocket(): Promise<void> {
    throw new Error('WebSocket not supported by this exchange');
  }

  async disconnectWebSocket(): Promise<void> {
    this.wsConnected = false;
  }

  async subscribeToTicker(symbol: string, callback: WebSocketCallback): Promise<void> {
    throw new Error('WebSocket not supported by this exchange');
  }

  async subscribeToOrderBook(symbol: string, callback: WebSocketCallback): Promise<void> {
    throw new Error('WebSocket not supported by this exchange');
  }

  async subscribeToTrades(symbol: string, callback: WebSocketCallback): Promise<void> {
    throw new Error('WebSocket not supported by this exchange');
  }

  async subscribeToOHLCV(symbol: string, timeframe: string, callback: WebSocketCallback): Promise<void> {
    throw new Error('WebSocket not supported by this exchange');
  }

  // Utility methods
  isConnected(): boolean {
    return this.connected;
  }

  isWebSocketConnected(): boolean {
    return this.wsConnected;
  }

  getMarkets(): Map<string, any> {
    return this.markets;
  }

  protected addWsCallback(channel: string, callback: WebSocketCallback): void {
    const callbacks = this.wsCallbacks.get(channel) || [];
    callbacks.push(callback);
    this.wsCallbacks.set(channel, callbacks);
  }

  protected emitWsEvent(channel: string, data: any): void {
    const callbacks = this.wsCallbacks.get(channel) || [];
    callbacks.forEach(cb => cb(data));
  }

  // Rate limiting helper
  protected async rateLimitedRequest<T>(fn: () => Promise<T>, delayMs: number = 100): Promise<T> {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return fn();
  }
}
