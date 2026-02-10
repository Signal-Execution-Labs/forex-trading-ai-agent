/**
 * TradingView Realtime Client
 * Unofficial WebSocket API for TradingView data
 * 
 * Based on: https://github.com/Mathieu2301/TradingView-API
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface TVQuote {
  symbol: string;
  lp?: number;       // Last price
  ch?: number;       // Change
  chp?: number;      // Change percent
  volume?: number;
  bid?: number;
  ask?: number;
  high?: number;
  low?: number;
  open?: number;
  prev_close?: number;
  timestamp?: number;
}

export interface TVIndicatorValue {
  name: string;
  value: number | number[];
  timestamp: number;
}

export interface TVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ScreenerFilter {
  [key: string]: { gte?: number; lte?: number; eq?: string | number };
}

export interface ScreenerOptions {
  sort?: { sortBy: string; sortOrder: 'asc' | 'desc' };
  filter?: ScreenerFilter;
  columns?: string[];
  limit?: number;
}

type QuoteCallback = (data: TVQuote) => void;

export class TradingViewClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private sessionId: string = '';
  private chartSessionId: string = '';
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private subscriptions: Map<string, QuoteCallback[]> = new Map();
  private messageQueue: string[] = [];
  
  private readonly WS_URL = 'wss://data.tradingview.com/socket.io/websocket';
  private readonly CHART_URL = 'wss://prodata.tradingview.com/socket.io/websocket';

  constructor(private sessionToken?: string) {
    super();
  }

  /**
   * Connect to TradingView WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sessionId = this.generateSessionId('qs');
      this.chartSessionId = this.generateSessionId('cs');

      this.ws = new WebSocket(this.WS_URL, {
        headers: {
          'Origin': 'https://www.tradingview.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      this.ws.on('open', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.initSession();
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
        this.attemptReconnect();
      });
    });
  }

  /**
   * Disconnect from TradingView
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.subscriptions.clear();
  }

  /**
   * Subscribe to realtime quotes for a symbol
   */
  subscribeQuote(symbol: string, callback: QuoteCallback): void {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    
    if (!this.subscriptions.has(normalizedSymbol)) {
      this.subscriptions.set(normalizedSymbol, []);
      this.sendMessage('quote_add_symbols', [this.sessionId, normalizedSymbol]);
    }
    
    this.subscriptions.get(normalizedSymbol)!.push(callback);
  }

  /**
   * Subscribe to multiple symbols at once
   */
  subscribeQuotes(symbols: string[], callback?: QuoteCallback): void {
    for (const symbol of symbols) {
      this.subscribeQuote(symbol, callback || ((data) => this.emit('quote', data)));
    }
  }

  /**
   * Unsubscribe from a symbol
   */
  unsubscribeQuote(symbol: string): void {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    
    if (this.subscriptions.has(normalizedSymbol)) {
      this.subscriptions.delete(normalizedSymbol);
      this.sendMessage('quote_remove_symbols', [this.sessionId, normalizedSymbol]);
    }
  }

  /**
   * Get current quote for a symbol (one-time fetch)
   */
  async getQuote(symbol: string): Promise<TVQuote> {
    return new Promise((resolve) => {
      let resolved = false;
      const callback = (data: TVQuote) => {
        if (!resolved) {
          resolved = true;
          this.unsubscribeQuote(symbol);
          resolve(data);
        }
      };
      this.subscribeQuote(symbol, callback);
      
      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.unsubscribeQuote(symbol);
          resolve({ symbol, lp: 0 });
        }
      }, 5000);
    });
  }

  /**
   * Get historical bars/candles
   */
  async getBars(symbol: string, options: {
    timeframe: string;
    from?: number;
    to?: number;
    count?: number;
  }): Promise<TVBar[]> {
    // This requires chart session - simplified implementation
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const resolution = this.mapTimeframe(options.timeframe);
    
    return new Promise((resolve) => {
      const bars: TVBar[] = [];
      
      this.sendMessage('create_series', [
        this.chartSessionId,
        'sds_1',
        's1',
        normalizedSymbol,
        resolution,
        options.count || 300
      ]);

      // Listen for series data
      const timeout = setTimeout(() => resolve(bars), 10000);
      
      this.once('series_data', (data: TVBar[]) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
  }

  /**
   * Get screener data
   */
  async getScreener(market: string, options: ScreenerOptions): Promise<any[]> {
    // Screener uses REST API, not WebSocket
    const screenerMap: Record<string, string> = {
      'crypto': 'crypto',
      'america': 'america',
      'forex': 'forex',
      'cfd': 'cfd'
    };

    const url = `https://scanner.tradingview.com/${screenerMap[market] || market}/scan`;
    
    const body = {
      filter: this.buildScreenerFilter(options.filter || {}),
      symbols: { query: { types: [] } },
      columns: options.columns || ['name', 'close', 'change', 'volume'],
      sort: options.sort || { sortBy: 'volume', sortOrder: 'desc' },
      range: [0, options.limit || 50]
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  // === Private Methods ===

  private generateSessionId(prefix: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = prefix + '_';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private initSession(): void {
    // Initialize quote session
    this.sendMessage('quote_create_session', [this.sessionId]);
    this.sendMessage('quote_set_fields', [
      this.sessionId,
      'ch', 'chp', 'lp', 'volume', 'bid', 'ask',
      'high_price', 'low_price', 'open_price', 'prev_close_price'
    ]);

    // Re-subscribe to existing symbols
    for (const symbol of this.subscriptions.keys()) {
      this.sendMessage('quote_add_symbols', [this.sessionId, symbol]);
    }
  }

  private sendMessage(func: string, args: any[]): void {
    if (!this.ws || !this.connected) {
      this.messageQueue.push(JSON.stringify({ m: func, p: args }));
      return;
    }

    const message = JSON.stringify({ m: func, p: args });
    const packet = `~m~${message.length}~m~${message}`;
    this.ws.send(packet);
  }

  private handleMessage(raw: string): void {
    // Parse TradingView packet format
    const matches = raw.match(/~m~(\d+)~m~(.+)/);
    if (!matches) return;

    const payload = matches[2];
    
    // Heartbeat
    if (payload.startsWith('~h~')) {
      this.ws?.send(raw);
      return;
    }

    try {
      const data = JSON.parse(payload);
      
      if (data.m === 'qsd') {
        // Quote data
        const quoteData = data.p[1];
        const symbol = quoteData.n;
        const values = quoteData.v;
        
        const quote: TVQuote = {
          symbol,
          lp: values.lp,
          ch: values.ch,
          chp: values.chp,
          volume: values.volume,
          bid: values.bid,
          ask: values.ask,
          high: values.high_price,
          low: values.low_price,
          open: values.open_price,
          prev_close: values.prev_close_price,
          timestamp: Date.now()
        };

        // Emit to subscribers
        const callbacks = this.subscriptions.get(symbol);
        if (callbacks) {
          callbacks.forEach(cb => cb(quote));
        }
        
        this.emit('quote', quote);
      }
      else if (data.m === 'timescale_update' || data.m === 'series_completed') {
        // Chart/series data
        this.emit('series_data', data.p);
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }

  private normalizeSymbol(symbol: string): string {
    // Ensure format is EXCHANGE:SYMBOL
    if (!symbol.includes(':')) {
      // Default to common exchanges
      if (symbol.endsWith('USDT') || symbol.endsWith('USD')) {
        return `BINANCE:${symbol}`;
      }
      return `NASDAQ:${symbol}`;
    }
    return symbol.toUpperCase();
  }

  private mapTimeframe(tf: string): string {
    const map: Record<string, string> = {
      '1m': '1', '5m': '5', '15m': '15', '30m': '30',
      '1h': '60', '1H': '60', '4h': '240', '4H': '240',
      '1d': 'D', '1D': 'D', '1w': 'W', '1W': 'W', '1M': 'M'
    };
    return map[tf] || tf;
  }

  private buildScreenerFilter(filter: ScreenerFilter): any[] {
    const result: any[] = [];
    
    for (const [field, conditions] of Object.entries(filter)) {
      if (conditions.gte !== undefined) {
        result.push({ left: field, operation: 'greater_or_equal', right: conditions.gte });
      }
      if (conditions.lte !== undefined) {
        result.push({ left: field, operation: 'less_or_equal', right: conditions.lte });
      }
      if (conditions.eq !== undefined) {
        result.push({ left: field, operation: 'equal', right: conditions.eq });
      }
    }
    
    return result;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    this.emit('reconnecting', this.reconnectAttempts);
    
    setTimeout(() => {
      this.connect().catch(() => {});
    }, this.reconnectDelay);
  }
}

// Export convenience functions
export async function getQuote(symbol: string): Promise<TVQuote> {
  const client = new TradingViewClient();
  await client.connect();
  const quote = await client.getQuote(symbol);
  client.disconnect();
  return quote;
}

export async function getScreener(market: string, options: ScreenerOptions = {}): Promise<any[]> {
  const client = new TradingViewClient();
  return client.getScreener(market, options);
}
