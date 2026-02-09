/**
 * K.I.T. Kraken Exchange Adapter
 * Supports Spot and Futures trading
 */

import { BaseExchange, ExchangeCredentials, MarketData, OHLCV, OrderBook, Trade, Order, Balance, Position, WebSocketCallback } from './base';
import WebSocket from 'ws';
import crypto from 'crypto';

export class KrakenExchange extends BaseExchange {
  public readonly name = 'kraken';
  public readonly displayName = 'Kraken';
  public readonly supportsFutures = true;
  public readonly supportsMargin = true;
  public readonly supportsWebSocket = true;

  private baseUrl = 'https://api.kraken.com';
  private futuresUrl = 'https://futures.kraken.com';
  private wsUrl = 'wss://ws.kraken.com';
  private wsAuthUrl = 'wss://ws-auth.kraken.com';
  private ws: WebSocket | null = null;
  private wsAuth: WebSocket | null = null;
  private futuresMode: boolean = false;

  constructor(credentials: ExchangeCredentials, futuresMode: boolean = false) {
    super(credentials);
    this.futuresMode = futuresMode;
  }

  private getMessageSignature(path: string, request: any, nonce: number): string {
    const message = new URLSearchParams({ ...request, nonce: nonce.toString() }).toString();
    const secretBuffer = Buffer.from(this.credentials.apiSecret, 'base64');
    const hash = crypto.createHash('sha256');
    const hmac = crypto.createHmac('sha512', secretBuffer);

    const hashDigest = hash.update(nonce.toString() + message).digest();
    const hmacDigest = hmac.update(Buffer.concat([Buffer.from(path), hashDigest])).digest('base64');

    return hmacDigest;
  }

  private async request(endpoint: string, method: string = 'GET', params: any = {}, signed: boolean = false): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: any = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    let body: string | undefined;

    if (signed) {
      const nonce = Date.now() * 1000;
      params.nonce = nonce;
      body = new URLSearchParams(params).toString();
      headers['API-Key'] = this.credentials.apiKey;
      headers['API-Sign'] = this.getMessageSignature(endpoint, params, nonce);
    } else if (method === 'POST') {
      body = new URLSearchParams(params).toString();
    }

    const response = await fetch(url + (method === 'GET' && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''), {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
    });

    const data = await response.json();

    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken API Error: ${data.error.join(', ')}`);
    }

    return data.result;
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting to Kraken...');
    await this.fetchMarkets();
    this.connected = true;
    this.logger.info('✅ Connected to Kraken');
  }

  async disconnect(): Promise<void> {
    await this.disconnectWebSocket();
    this.connected = false;
    this.logger.info('Disconnected from Kraken');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/0/public/Time');
      return true;
    } catch {
      return false;
    }
  }

  async fetchMarkets(): Promise<any[]> {
    const data = await this.request('/0/public/AssetPairs');

    this.markets.clear();
    for (const [id, market] of Object.entries(data) as [string, any][]) {
      if (market.wsname) {
        const [base, quote] = market.wsname.split('/');
        const symbol = `${base}/${quote}`;
        
        this.markets.set(symbol, {
          id,
          symbol,
          wsName: market.wsname,
          base: market.base,
          quote: market.quote,
          active: true,
          precision: {
            price: market.pair_decimals,
            amount: market.lot_decimals,
          },
          limits: {
            amount: {
              min: parseFloat(market.ordermin || '0'),
            },
          },
          fees: {
            maker: parseFloat(market.fees_maker?.[0]?.[1] || '0.16') / 100,
            taker: parseFloat(market.fees?.[0]?.[1] || '0.26') / 100,
          },
        });
      }
    }

    return Array.from(this.markets.values());
  }

  async fetchTicker(symbol: string): Promise<MarketData> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/0/public/Ticker', 'GET', { pair: market.id });
    const ticker = Object.values(data)[0] as any;

    return {
      symbol,
      exchange: this.name,
      price: parseFloat(ticker.c[0]),
      bid: parseFloat(ticker.b[0]),
      ask: parseFloat(ticker.a[0]),
      spread: parseFloat(ticker.a[0]) - parseFloat(ticker.b[0]),
      volume: parseFloat(ticker.v[1]),
      high24h: parseFloat(ticker.h[1]),
      low24h: parseFloat(ticker.l[1]),
      change24h: ((parseFloat(ticker.c[0]) - parseFloat(ticker.o)) / parseFloat(ticker.o)) * 100,
      timestamp: new Date(),
    };
  }

  async fetchTickers(symbols?: string[]): Promise<MarketData[]> {
    const pairs = symbols 
      ? symbols.map(s => this.markets.get(s)?.id).filter(Boolean).join(',')
      : Array.from(this.markets.values()).map(m => m.id).join(',');

    const data = await this.request('/0/public/Ticker', 'GET', { pair: pairs });

    return Object.entries(data).map(([id, ticker]: [string, any]) => {
      const market = Array.from(this.markets.values()).find(m => m.id === id);
      return {
        symbol: market?.symbol || id,
        exchange: this.name,
        price: parseFloat(ticker.c[0]),
        bid: parseFloat(ticker.b[0]),
        ask: parseFloat(ticker.a[0]),
        spread: parseFloat(ticker.a[0]) - parseFloat(ticker.b[0]),
        volume: parseFloat(ticker.v[1]),
        high24h: parseFloat(ticker.h[1]),
        low24h: parseFloat(ticker.l[1]),
        change24h: ((parseFloat(ticker.c[0]) - parseFloat(ticker.o)) / parseFloat(ticker.o)) * 100,
        timestamp: new Date(),
      };
    });
  }

  async fetchOrderBook(symbol: string, limit: number = 100): Promise<OrderBook> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/0/public/Depth', 'GET', { pair: market.id, count: limit });
    const book = Object.values(data)[0] as any;

    return {
      bids: book.bids.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: book.asks.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: new Date(),
      exchange: this.name,
      symbol,
    };
  }

  async fetchOHLCV(symbol: string, timeframe: string = '1h', since?: number, limit?: number): Promise<OHLCV[]> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const interval = this.convertTimeframe(timeframe);
    const params: any = { pair: market.id, interval };
    if (since) params.since = Math.floor(since / 1000);

    const data = await this.request('/0/public/OHLC', 'GET', params);
    const candles = Object.values(data).find(Array.isArray) as any[];

    let result = candles.map((c: any[]) => ({
      timestamp: new Date(c[0] * 1000),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[6]),
    }));

    if (limit) result = result.slice(-limit);
    return result;
  }

  async fetchTrades(symbol: string, limit: number = 1000): Promise<Trade[]> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/0/public/Trades', 'GET', { pair: market.id });
    const trades = Object.values(data).find(Array.isArray) as any[];

    return trades.slice(-limit).map((t: any[], i: number) => ({
      id: `${t[2]}-${i}`,
      symbol,
      side: t[3] === 'b' ? 'buy' : 'sell',
      amount: parseFloat(t[1]),
      price: parseFloat(t[0]),
      cost: parseFloat(t[0]) * parseFloat(t[1]),
      fee: 0,
      timestamp: new Date(t[2] * 1000),
    }));
  }

  async fetchBalance(): Promise<Balance[]> {
    const data = await this.request('/0/private/Balance', 'POST', {}, true);

    return Object.entries(data)
      .filter(([_, amount]) => parseFloat(amount as string) > 0)
      .map(([currency, amount]) => ({
        currency: this.normalizeCurrency(currency),
        free: parseFloat(amount as string),
        used: 0,
        total: parseFloat(amount as string),
      }));
  }

  async fetchPositions(): Promise<Position[]> {
    if (!this.futuresMode) return [];

    const data = await this.request('/0/private/OpenPositions', 'POST', {}, true);

    return Object.entries(data).map(([id, pos]: [string, any]) => ({
      symbol: pos.pair,
      side: pos.type === 'buy' ? 'long' : 'short',
      amount: parseFloat(pos.vol),
      entryPrice: parseFloat(pos.cost) / parseFloat(pos.vol),
      markPrice: parseFloat(pos.value) / parseFloat(pos.vol),
      unrealizedPnl: parseFloat(pos.net),
      leverage: 1,
    }));
  }

  async createOrder(symbol: string, type: Order['type'], side: Order['side'], amount: number, price?: number, params?: any): Promise<Order> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const orderParams: any = {
      pair: market.id,
      type: side,
      ordertype: type,
      volume: amount.toString(),
      ...params,
    };

    if (type === 'limit' && price) {
      orderParams.price = price.toString();
    }

    if ((type === 'stop' || type === 'stop_limit') && params?.stopPrice) {
      orderParams.ordertype = type === 'stop' ? 'stop-loss' : 'stop-loss-limit';
      orderParams.stopprice = params.stopPrice.toString();
    }

    const data = await this.request('/0/private/AddOrder', 'POST', orderParams, true);

    return {
      id: data.txid[0],
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
    await this.request('/0/private/CancelOrder', 'POST', { txid: orderId }, true);
    return true;
  }

  async fetchOrder(orderId: string, symbol?: string): Promise<Order> {
    const data = await this.request('/0/private/QueryOrders', 'POST', { txid: orderId }, true);
    const order = data[orderId];

    return this.parseOrder(orderId, order);
  }

  async fetchOpenOrders(symbol?: string): Promise<Order[]> {
    const data = await this.request('/0/private/OpenOrders', 'POST', {}, true);

    return Object.entries(data.open || {}).map(([id, order]: [string, any]) => 
      this.parseOrder(id, order)
    );
  }

  async fetchClosedOrders(symbol?: string, since?: number, limit?: number): Promise<Order[]> {
    const params: any = {};
    if (since) params.start = Math.floor(since / 1000);

    const data = await this.request('/0/private/ClosedOrders', 'POST', params, true);

    let orders = Object.entries(data.closed || {}).map(([id, order]: [string, any]) =>
      this.parseOrder(id, order)
    );

    if (limit) orders = orders.slice(-limit);
    return orders;
  }

  // WebSocket Implementation
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.logger.info('✅ Kraken WebSocket connected');
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
        this.logger.warn('WebSocket disconnected');
      });
    });
  }

  async disconnectWebSocket(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.wsAuth) {
      this.wsAuth.close();
      this.wsAuth = null;
    }
    this.wsConnected = false;
  }

  private handleWsMessage(message: any): void {
    if (Array.isArray(message)) {
      const [channelId, data, channelName, pair] = message;
      
      if (typeof channelName === 'string') {
        const symbol = this.getSymbolFromWsName(pair);
        
        if (channelName === 'ticker') {
          this.emitWsEvent(`ticker:${symbol}`, this.parseWsTicker(data, symbol));
        } else if (channelName === 'book-10' || channelName === 'book-25' || channelName === 'book-100') {
          this.emitWsEvent(`orderbook:${symbol}`, this.parseWsOrderBook(data, symbol));
        } else if (channelName === 'trade') {
          data.forEach((t: any) => {
            this.emitWsEvent(`trades:${symbol}`, this.parseWsTrade(t, symbol));
          });
        } else if (channelName.startsWith('ohlc-')) {
          const tf = channelName.replace('ohlc-', '');
          this.emitWsEvent(`ohlcv:${symbol}:${tf}`, this.parseWsOHLCV(data, symbol));
        }
      }
    }
  }

  async subscribeToTicker(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`ticker:${symbol}`, callback);
    await this.wsSubscribe({ name: 'ticker' }, [market.wsName]);
  }

  async subscribeToOrderBook(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`orderbook:${symbol}`, callback);
    await this.wsSubscribe({ name: 'book', depth: 25 }, [market.wsName]);
  }

  async subscribeToTrades(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`trades:${symbol}`, callback);
    await this.wsSubscribe({ name: 'trade' }, [market.wsName]);
  }

  async subscribeToOHLCV(symbol: string, timeframe: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const interval = this.convertTimeframe(timeframe);
    this.addWsCallback(`ohlcv:${symbol}:${timeframe}`, callback);
    await this.wsSubscribe({ name: 'ohlc', interval: parseInt(interval) }, [market.wsName]);
  }

  private async wsSubscribe(subscription: any, pairs: string[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      event: 'subscribe',
      pair: pairs,
      subscription,
    };

    this.ws.send(JSON.stringify(message));
  }

  // Helper methods
  private convertTimeframe(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1', '5m': '5', '15m': '15', '30m': '30',
      '1h': '60', '4h': '240', '1d': '1440', '1w': '10080',
    };
    return map[timeframe] || '60';
  }

  private normalizeCurrency(currency: string): string {
    const map: Record<string, string> = {
      'XXBT': 'BTC', 'XBT': 'BTC',
      'XETH': 'ETH', 'XXRP': 'XRP',
      'ZUSD': 'USD', 'ZEUR': 'EUR', 'ZGBP': 'GBP',
    };
    return map[currency] || currency;
  }

  private getSymbolFromWsName(wsName: string): string {
    for (const [symbol, market] of this.markets) {
      if (market.wsName === wsName) return symbol;
    }
    return wsName;
  }

  private parseOrder(id: string, order: any): Order {
    const statusMap: Record<string, Order['status']> = {
      'pending': 'open',
      'open': 'open',
      'closed': 'closed',
      'canceled': 'canceled',
      'expired': 'expired',
    };

    const market = Array.from(this.markets.values()).find(m => m.id === order.descr.pair);

    return {
      id,
      symbol: market?.symbol || order.descr.pair,
      type: order.descr.ordertype as Order['type'],
      side: order.descr.type as Order['side'],
      amount: parseFloat(order.vol),
      price: order.descr.price ? parseFloat(order.descr.price) : undefined,
      status: statusMap[order.status] || 'open',
      filled: parseFloat(order.vol_exec),
      remaining: parseFloat(order.vol) - parseFloat(order.vol_exec),
      timestamp: new Date(order.opentm * 1000),
    };
  }

  private parseWsTicker(data: any, symbol: string): MarketData {
    return {
      symbol,
      exchange: this.name,
      price: parseFloat(data.c[0]),
      bid: parseFloat(data.b[0]),
      ask: parseFloat(data.a[0]),
      spread: parseFloat(data.a[0]) - parseFloat(data.b[0]),
      volume: parseFloat(data.v[1]),
      high24h: parseFloat(data.h[1]),
      low24h: parseFloat(data.l[1]),
      change24h: ((parseFloat(data.c[0]) - parseFloat(data.o[1])) / parseFloat(data.o[1])) * 100,
      timestamp: new Date(),
    };
  }

  private parseWsOrderBook(data: any, symbol: string): OrderBook {
    return {
      bids: (data.bs || data.b || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (data.as || data.a || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: new Date(),
      exchange: this.name,
      symbol,
    };
  }

  private parseWsTrade(data: any, symbol: string): Trade {
    return {
      id: `${data[2]}-${Date.now()}`,
      symbol,
      side: data[3] === 'b' ? 'buy' : 'sell',
      amount: parseFloat(data[1]),
      price: parseFloat(data[0]),
      cost: parseFloat(data[0]) * parseFloat(data[1]),
      fee: 0,
      timestamp: new Date(parseFloat(data[2]) * 1000),
    };
  }

  private parseWsOHLCV(data: any, symbol: string): OHLCV {
    return {
      timestamp: new Date(parseFloat(data[1]) * 1000),
      open: parseFloat(data[2]),
      high: parseFloat(data[3]),
      low: parseFloat(data[4]),
      close: parseFloat(data[5]),
      volume: parseFloat(data[7]),
    };
  }
}
