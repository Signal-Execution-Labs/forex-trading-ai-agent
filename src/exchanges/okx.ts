/**
 * K.I.T. OKX Exchange Adapter
 * Supports Spot, Perpetual Swaps, Futures, Options
 */

import { BaseExchange, ExchangeCredentials, MarketData, OHLCV, OrderBook, Trade, Order, Balance, Position, WebSocketCallback } from './base';
import WebSocket from 'ws';
import crypto from 'crypto';

type InstType = 'SPOT' | 'MARGIN' | 'SWAP' | 'FUTURES' | 'OPTION';

export class OKXExchange extends BaseExchange {
  public readonly name = 'okx';
  public readonly displayName = 'OKX';
  public readonly supportsFutures = true;
  public readonly supportsMargin = true;
  public readonly supportsWebSocket = true;

  private baseUrl: string;
  private wsPublicUrl: string;
  private wsPrivateUrl: string;
  private ws: WebSocket | null = null;
  private wsPrivate: WebSocket | null = null;
  private wsHeartbeat: NodeJS.Timeout | null = null;
  private instType: InstType;

  constructor(credentials: ExchangeCredentials, instType: InstType = 'SWAP') {
    super(credentials);
    this.instType = instType;
    
    if (credentials.testnet) {
      this.baseUrl = 'https://www.okx.com'; // OKX uses same URL with simulated trading flag
      this.wsPublicUrl = 'wss://wspap.okx.com:8443/ws/v5/public?brokerId=9999';
      this.wsPrivateUrl = 'wss://wspap.okx.com:8443/ws/v5/private?brokerId=9999';
    } else {
      this.baseUrl = 'https://www.okx.com';
      this.wsPublicUrl = 'wss://ws.okx.com:8443/ws/v5/public';
      this.wsPrivateUrl = 'wss://ws.okx.com:8443/ws/v5/private';
    }
  }

  private sign(timestamp: string, method: string, requestPath: string, body: string = ''): string {
    const message = timestamp + method + requestPath + body;
    return crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(message)
      .digest('base64');
  }

  private async request(endpoint: string, method: string = 'GET', params: any = {}, signed: boolean = false): Promise<any> {
    const timestamp = new Date().toISOString();
    const url = new URL(endpoint, this.baseUrl);
    
    const headers: any = {
      'Content-Type': 'application/json',
    };

    let body = '';
    if (method === 'GET' && Object.keys(params).length > 0) {
      url.search = new URLSearchParams(params).toString();
    } else if (method !== 'GET') {
      body = JSON.stringify(params);
    }

    if (signed) {
      headers['OK-ACCESS-KEY'] = this.credentials.apiKey;
      headers['OK-ACCESS-SIGN'] = this.sign(timestamp, method, endpoint + (url.search || ''), body);
      headers['OK-ACCESS-TIMESTAMP'] = timestamp;
      headers['OK-ACCESS-PASSPHRASE'] = this.credentials.passphrase || '';
      
      if (this.credentials.testnet) {
        headers['x-simulated-trading'] = '1';
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: method !== 'GET' ? body : undefined,
    });

    const data = await response.json();

    if (data.code !== '0') {
      throw new Error(`OKX API Error: ${data.msg}`);
    }

    return data.data;
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting to OKX...');
    await this.fetchMarkets();
    this.connected = true;
    this.logger.info('✅ Connected to OKX');
  }

  async disconnect(): Promise<void> {
    await this.disconnectWebSocket();
    this.connected = false;
    this.logger.info('Disconnected from OKX');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/api/v5/public/time');
      return true;
    } catch {
      return false;
    }
  }

  async fetchMarkets(): Promise<any[]> {
    const data = await this.request('/api/v5/public/instruments', 'GET', { instType: this.instType });

    this.markets.clear();
    for (const inst of data || []) {
      const symbol = this.parseSymbol(inst.instId);
      
      this.markets.set(symbol, {
        id: inst.instId,
        symbol,
        base: inst.baseCcy || inst.ctValCcy,
        quote: inst.quoteCcy || inst.settleCcy,
        active: inst.state === 'live',
        type: this.instType.toLowerCase(),
        precision: {
          price: this.getPrecision(inst.tickSz),
          amount: this.getPrecision(inst.lotSz),
        },
        limits: {
          amount: {
            min: parseFloat(inst.minSz || '0'),
          },
        },
        contractValue: inst.ctVal ? parseFloat(inst.ctVal) : undefined,
        settleCurrency: inst.settleCcy,
        expiry: inst.expTime ? new Date(parseInt(inst.expTime)) : undefined,
      });
    }

    return Array.from(this.markets.values());
  }

  async fetchTicker(symbol: string): Promise<MarketData> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/api/v5/market/ticker', 'GET', { instId: market.id });
    const ticker = data?.[0];
    if (!ticker) throw new Error(`No ticker data for ${symbol}`);

    return this.parseTicker(ticker, symbol);
  }

  async fetchTickers(symbols?: string[]): Promise<MarketData[]> {
    const data = await this.request('/api/v5/market/tickers', 'GET', { instType: this.instType });

    return (data || [])
      .filter((t: any) => {
        const symbol = this.parseSymbol(t.instId);
        return !symbols || symbols.includes(symbol);
      })
      .map((t: any) => this.parseTicker(t, this.parseSymbol(t.instId)));
  }

  async fetchOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/api/v5/market/books', 'GET', { instId: market.id, sz: limit });
    const book = data?.[0];

    return {
      bids: (book?.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (book?.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: new Date(parseInt(book?.ts || Date.now())),
      exchange: this.name,
      symbol,
    };
  }

  async fetchOHLCV(symbol: string, timeframe: string = '1H', since?: number, limit: number = 100): Promise<OHLCV[]> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const bar = this.convertTimeframe(timeframe);
    const params: any = { instId: market.id, bar, limit: limit.toString() };
    if (since) params.after = since.toString();

    const data = await this.request('/api/v5/market/candles', 'GET', params);

    return (data || []).map((c: string[]) => ({
      timestamp: new Date(parseInt(c[0])),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
    })).reverse();
  }

  async fetchTrades(symbol: string, limit: number = 100): Promise<Trade[]> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/api/v5/market/trades', 'GET', { instId: market.id, limit: limit.toString() });

    return (data || []).map((t: any) => ({
      id: t.tradeId,
      symbol,
      side: t.side.toLowerCase() as 'buy' | 'sell',
      amount: parseFloat(t.sz),
      price: parseFloat(t.px),
      cost: parseFloat(t.sz) * parseFloat(t.px),
      fee: 0,
      timestamp: new Date(parseInt(t.ts)),
    }));
  }

  async fetchBalance(): Promise<Balance[]> {
    const data = await this.request('/api/v5/account/balance', 'GET', {}, true);

    const balances: Balance[] = [];
    for (const account of data || []) {
      for (const detail of account.details || []) {
        if (parseFloat(detail.cashBal) > 0) {
          balances.push({
            currency: detail.ccy,
            free: parseFloat(detail.availBal || '0'),
            used: parseFloat(detail.frozenBal || '0'),
            total: parseFloat(detail.cashBal),
          });
        }
      }
    }

    return balances;
  }

  async fetchPositions(): Promise<Position[]> {
    if (this.instType === 'SPOT') return [];

    const data = await this.request('/api/v5/account/positions', 'GET', { instType: this.instType }, true);

    return (data || [])
      .filter((p: any) => parseFloat(p.pos) !== 0)
      .map((p: any) => ({
        symbol: this.parseSymbol(p.instId),
        side: p.posSide === 'long' || parseFloat(p.pos) > 0 ? 'long' : 'short',
        amount: Math.abs(parseFloat(p.pos)),
        entryPrice: parseFloat(p.avgPx),
        markPrice: parseFloat(p.markPx),
        unrealizedPnl: parseFloat(p.upl),
        leverage: parseFloat(p.lever),
        liquidationPrice: p.liqPx ? parseFloat(p.liqPx) : undefined,
      }));
  }

  async createOrder(symbol: string, type: Order['type'], side: Order['side'], amount: number, price?: number, params?: any): Promise<Order> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const orderParams: any = {
      instId: market.id,
      tdMode: this.instType === 'SPOT' ? 'cash' : (params?.marginMode || 'cross'),
      side: side,
      ordType: type === 'market' ? 'market' : type === 'limit' ? 'limit' : 'trigger',
      sz: amount.toString(),
    };

    if (type === 'limit' && price) {
      orderParams.px = price.toString();
    }

    if (params?.posSide) {
      orderParams.posSide = params.posSide;
    }

    if (params?.reduceOnly) {
      orderParams.reduceOnly = true;
    }

    const data = await this.request('/api/v5/trade/order', 'POST', orderParams, true);
    const result = data?.[0];

    return {
      id: result.ordId,
      clientOrderId: result.clOrdId,
      symbol,
      type,
      side,
      amount,
      price,
      status: 'open',
      filled: 0,
      remaining: amount,
      timestamp: new Date(),
    };
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<boolean> {
    if (!symbol) throw new Error('Symbol required for OKX order cancellation');

    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    await this.request('/api/v5/trade/cancel-order', 'POST', {
      instId: market.id,
      ordId: orderId,
    }, true);

    return true;
  }

  async fetchOrder(orderId: string, symbol?: string): Promise<Order> {
    if (!symbol) throw new Error('Symbol required for OKX order fetch');

    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/api/v5/trade/order', 'GET', {
      instId: market.id,
      ordId: orderId,
    }, true);

    const order = data?.[0];
    if (!order) throw new Error(`Order ${orderId} not found`);

    return this.parseOrder(order, symbol);
  }

  async fetchOpenOrders(symbol?: string): Promise<Order[]> {
    const params: any = { instType: this.instType };
    if (symbol) {
      const market = this.markets.get(symbol);
      if (market) params.instId = market.id;
    }

    const data = await this.request('/api/v5/trade/orders-pending', 'GET', params, true);

    return (data || []).map((o: any) =>
      this.parseOrder(o, symbol || this.parseSymbol(o.instId))
    );
  }

  async fetchClosedOrders(symbol?: string, since?: number, limit: number = 100): Promise<Order[]> {
    const params: any = { instType: this.instType, limit: limit.toString() };
    if (symbol) {
      const market = this.markets.get(symbol);
      if (market) params.instId = market.id;
    }
    if (since) params.begin = since.toString();

    const data = await this.request('/api/v5/trade/orders-history', 'GET', params, true);

    return (data || []).map((o: any) =>
      this.parseOrder(o, symbol || this.parseSymbol(o.instId))
    );
  }

  // WebSocket Implementation
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsPublicUrl);

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.logger.info('✅ OKX WebSocket connected');
        this.startHeartbeat();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWsMessage(message);
        } catch (error) {
          this.logger.error('WebSocket message parse error:', error);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        this.wsConnected = false;
        this.stopHeartbeat();
        this.logger.warn('WebSocket disconnected');
      });
    });
  }

  async disconnectWebSocket(): Promise<void> {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.wsPrivate) {
      this.wsPrivate.close();
      this.wsPrivate = null;
    }
    this.wsConnected = false;
  }

  private startHeartbeat(): void {
    this.wsHeartbeat = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.wsHeartbeat) {
      clearInterval(this.wsHeartbeat);
      this.wsHeartbeat = null;
    }
  }

  private handleWsMessage(message: any): void {
    if (message === 'pong') return;

    const { arg, data } = message;
    if (!arg || !data) return;

    const { channel, instId } = arg;
    const symbol = this.parseSymbol(instId);

    if (channel === 'tickers') {
      for (const ticker of data) {
        this.emitWsEvent(`ticker:${symbol}`, this.parseWsTicker(ticker, symbol));
      }
    } else if (channel === 'books5' || channel === 'books' || channel === 'books50-l2-tbt') {
      for (const book of data) {
        this.emitWsEvent(`orderbook:${symbol}`, this.parseWsOrderBook(book, symbol));
      }
    } else if (channel === 'trades') {
      for (const trade of data) {
        this.emitWsEvent(`trades:${symbol}`, this.parseWsTrade(trade, symbol));
      }
    } else if (channel.startsWith('candle')) {
      const tf = channel.replace('candle', '');
      for (const candle of data) {
        this.emitWsEvent(`ohlcv:${symbol}:${tf}`, this.parseWsOHLCV(candle));
      }
    }
  }

  async subscribeToTicker(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`ticker:${symbol}`, callback);
    await this.wsSubscribe([{ channel: 'tickers', instId: market.id }]);
  }

  async subscribeToOrderBook(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`orderbook:${symbol}`, callback);
    await this.wsSubscribe([{ channel: 'books5', instId: market.id }]);
  }

  async subscribeToTrades(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`trades:${symbol}`, callback);
    await this.wsSubscribe([{ channel: 'trades', instId: market.id }]);
  }

  async subscribeToOHLCV(symbol: string, timeframe: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const bar = this.convertTimeframe(timeframe);
    this.addWsCallback(`ohlcv:${symbol}:${bar}`, callback);
    await this.wsSubscribe([{ channel: `candle${bar}`, instId: market.id }]);
  }

  private async wsSubscribe(args: any[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      op: 'subscribe',
      args,
    };

    this.ws.send(JSON.stringify(message));
  }

  // Helper methods
  private getPrecision(value: string | undefined): number {
    if (!value) return 8;
    const parts = value.split('.');
    return parts[1] ? parts[1].replace(/0+$/, '').length : 0;
  }

  private convertTimeframe(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
      '1h': '1H', '2h': '2H', '4h': '4H', '6h': '6H', '12h': '12H',
      '1d': '1D', '1w': '1W', '1M': '1M',
    };
    return map[timeframe] || '1H';
  }

  private parseSymbol(instId: string): string {
    // OKX format: BTC-USDT, BTC-USDT-SWAP, BTC-USDT-231229
    const parts = instId.split('-');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return instId;
  }

  private parseTicker(ticker: any, symbol: string): MarketData {
    return {
      symbol,
      exchange: this.name,
      price: parseFloat(ticker.last),
      bid: parseFloat(ticker.bidPx || '0'),
      ask: parseFloat(ticker.askPx || '0'),
      spread: parseFloat(ticker.askPx || '0') - parseFloat(ticker.bidPx || '0'),
      volume: parseFloat(ticker.vol24h || ticker.volCcy24h || '0'),
      high24h: parseFloat(ticker.high24h || '0'),
      low24h: parseFloat(ticker.low24h || '0'),
      change24h: ((parseFloat(ticker.last) - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h)) * 100,
      timestamp: new Date(parseInt(ticker.ts)),
    };
  }

  private parseOrder(order: any, symbol: string): Order {
    const statusMap: Record<string, Order['status']> = {
      'live': 'open',
      'partially_filled': 'open',
      'filled': 'closed',
      'canceled': 'canceled',
      'mmp_canceled': 'canceled',
    };

    return {
      id: order.ordId,
      clientOrderId: order.clOrdId,
      symbol,
      type: order.ordType as Order['type'],
      side: order.side as Order['side'],
      amount: parseFloat(order.sz),
      price: order.px ? parseFloat(order.px) : undefined,
      status: statusMap[order.state] || 'open',
      filled: parseFloat(order.accFillSz || '0'),
      remaining: parseFloat(order.sz) - parseFloat(order.accFillSz || '0'),
      timestamp: new Date(parseInt(order.cTime)),
    };
  }

  private parseWsTicker(data: any, symbol: string): MarketData {
    return {
      symbol,
      exchange: this.name,
      price: parseFloat(data.last),
      bid: parseFloat(data.bidPx || '0'),
      ask: parseFloat(data.askPx || '0'),
      spread: parseFloat(data.askPx || '0') - parseFloat(data.bidPx || '0'),
      volume: parseFloat(data.vol24h || '0'),
      high24h: parseFloat(data.high24h || '0'),
      low24h: parseFloat(data.low24h || '0'),
      change24h: ((parseFloat(data.last) - parseFloat(data.open24h)) / parseFloat(data.open24h)) * 100,
      timestamp: new Date(parseInt(data.ts)),
    };
  }

  private parseWsOrderBook(data: any, symbol: string): OrderBook {
    return {
      bids: (data.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (data.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: new Date(parseInt(data.ts)),
      exchange: this.name,
      symbol,
    };
  }

  private parseWsTrade(data: any, symbol: string): Trade {
    return {
      id: data.tradeId,
      symbol,
      side: data.side as 'buy' | 'sell',
      amount: parseFloat(data.sz),
      price: parseFloat(data.px),
      cost: parseFloat(data.sz) * parseFloat(data.px),
      fee: 0,
      timestamp: new Date(parseInt(data.ts)),
    };
  }

  private parseWsOHLCV(data: string[]): OHLCV {
    return {
      timestamp: new Date(parseInt(data[0])),
      open: parseFloat(data[1]),
      high: parseFloat(data[2]),
      low: parseFloat(data[3]),
      close: parseFloat(data[4]),
      volume: parseFloat(data[5]),
    };
  }

  // OKX-specific methods
  async setLeverage(symbol: string, leverage: number, marginMode: 'cross' | 'isolated' = 'cross'): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    await this.request('/api/v5/account/set-leverage', 'POST', {
      instId: market.id,
      lever: leverage.toString(),
      mgnMode: marginMode,
    }, true);
  }

  async setPositionMode(mode: 'long_short_mode' | 'net_mode'): Promise<void> {
    await this.request('/api/v5/account/set-position-mode', 'POST', {
      posMode: mode,
    }, true);
  }
}
