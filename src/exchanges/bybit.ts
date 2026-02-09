/**
 * K.I.T. Bybit Exchange Adapter
 * Supports Spot, Perpetual Futures (Linear & Inverse)
 */

import { BaseExchange, ExchangeCredentials, MarketData, OHLCV, OrderBook, Trade, Order, Balance, Position, WebSocketCallback } from './base';
import WebSocket from 'ws';
import crypto from 'crypto';

type Category = 'spot' | 'linear' | 'inverse';

export class BybitExchange extends BaseExchange {
  public readonly name = 'bybit';
  public readonly displayName = 'Bybit';
  public readonly supportsFutures = true;
  public readonly supportsMargin = true;
  public readonly supportsWebSocket = true;

  private baseUrl: string;
  private wsPublicUrl: string;
  private wsPrivateUrl: string;
  private ws: WebSocket | null = null;
  private wsPrivate: WebSocket | null = null;
  private wsHeartbeat: NodeJS.Timeout | null = null;
  private category: Category;
  private recvWindow = 5000;

  constructor(credentials: ExchangeCredentials, category: Category = 'linear') {
    super(credentials);
    this.category = category;
    
    if (credentials.testnet) {
      this.baseUrl = 'https://api-testnet.bybit.com';
      this.wsPublicUrl = `wss://stream-testnet.bybit.com/v5/public/${category}`;
      this.wsPrivateUrl = 'wss://stream-testnet.bybit.com/v5/private';
    } else {
      this.baseUrl = 'https://api.bybit.com';
      this.wsPublicUrl = `wss://stream.bybit.com/v5/public/${category}`;
      this.wsPrivateUrl = 'wss://stream.bybit.com/v5/private';
    }
  }

  private sign(timestamp: number, params: string): string {
    const message = `${timestamp}${this.credentials.apiKey}${this.recvWindow}${params}`;
    return crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(message)
      .digest('hex');
  }

  private async request(endpoint: string, method: string = 'GET', params: any = {}, signed: boolean = false): Promise<any> {
    const url = new URL(endpoint, this.baseUrl);
    const timestamp = Date.now();
    
    const headers: any = {
      'Content-Type': 'application/json',
    };

    let body: string | undefined;
    let queryString = '';

    if (method === 'GET') {
      queryString = new URLSearchParams(params).toString();
      if (queryString) url.search = queryString;
    } else {
      body = JSON.stringify(params);
      queryString = body;
    }

    if (signed) {
      headers['X-BAPI-API-KEY'] = this.credentials.apiKey;
      headers['X-BAPI-TIMESTAMP'] = timestamp.toString();
      headers['X-BAPI-RECV-WINDOW'] = this.recvWindow.toString();
      headers['X-BAPI-SIGN'] = this.sign(timestamp, queryString);
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: method !== 'GET' ? body : undefined,
    });

    const data = await response.json();

    if (data.retCode !== 0) {
      throw new Error(`Bybit API Error: ${data.retMsg}`);
    }

    return data.result;
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting to Bybit...');
    await this.fetchMarkets();
    this.connected = true;
    this.logger.info('✅ Connected to Bybit');
  }

  async disconnect(): Promise<void> {
    await this.disconnectWebSocket();
    this.connected = false;
    this.logger.info('Disconnected from Bybit');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/v5/market/time');
      return true;
    } catch {
      return false;
    }
  }

  async fetchMarkets(): Promise<any[]> {
    const data = await this.request('/v5/market/instruments-info', 'GET', { category: this.category });

    this.markets.clear();
    for (const market of data.list || []) {
      const base = market.baseCoin;
      const quote = market.quoteCoin;
      const symbol = `${base}/${quote}`;

      this.markets.set(symbol, {
        id: market.symbol,
        symbol,
        base,
        quote,
        active: market.status === 'Trading',
        type: this.category,
        precision: {
          price: this.getPrecision(market.priceFilter?.tickSize),
          amount: this.getPrecision(market.lotSizeFilter?.basePrecision || market.lotSizeFilter?.qtyStep),
        },
        limits: {
          amount: {
            min: parseFloat(market.lotSizeFilter?.minOrderQty || '0'),
            max: parseFloat(market.lotSizeFilter?.maxOrderQty || '0'),
          },
          leverage: market.leverageFilter ? {
            min: parseFloat(market.leverageFilter.minLeverage || '1'),
            max: parseFloat(market.leverageFilter.maxLeverage || '100'),
          } : undefined,
        },
        contractType: market.contractType,
        settleCoin: market.settleCoin,
      });
    }

    return Array.from(this.markets.values());
  }

  async fetchTicker(symbol: string): Promise<MarketData> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/v5/market/tickers', 'GET', { 
      category: this.category, 
      symbol: market.id 
    });

    const ticker = data.list?.[0];
    if (!ticker) throw new Error(`No ticker data for ${symbol}`);

    return this.parseTicker(ticker, symbol);
  }

  async fetchTickers(symbols?: string[]): Promise<MarketData[]> {
    const data = await this.request('/v5/market/tickers', 'GET', { category: this.category });

    return (data.list || [])
      .filter((t: any) => {
        const symbol = this.getSymbolFromMarketId(t.symbol);
        return !symbols || symbols.includes(symbol);
      })
      .map((t: any) => this.parseTicker(t, this.getSymbolFromMarketId(t.symbol)));
  }

  async fetchOrderBook(symbol: string, limit: number = 50): Promise<OrderBook> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/v5/market/orderbook', 'GET', {
      category: this.category,
      symbol: market.id,
      limit,
    });

    return {
      bids: (data.b || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (data.a || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: new Date(parseInt(data.ts)),
      exchange: this.name,
      symbol,
    };
  }

  async fetchOHLCV(symbol: string, timeframe: string = '1h', since?: number, limit: number = 200): Promise<OHLCV[]> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const interval = this.convertTimeframe(timeframe);
    const params: any = {
      category: this.category,
      symbol: market.id,
      interval,
      limit,
    };

    if (since) params.start = since;

    const data = await this.request('/v5/market/kline', 'GET', params);

    return (data.list || []).map((c: string[]) => ({
      timestamp: new Date(parseInt(c[0])),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
    })).reverse();
  }

  async fetchTrades(symbol: string, limit: number = 60): Promise<Trade[]> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/v5/market/recent-trade', 'GET', {
      category: this.category,
      symbol: market.id,
      limit,
    });

    return (data.list || []).map((t: any) => ({
      id: t.execId,
      symbol,
      side: t.side.toLowerCase() as 'buy' | 'sell',
      amount: parseFloat(t.size),
      price: parseFloat(t.price),
      cost: parseFloat(t.size) * parseFloat(t.price),
      fee: 0,
      timestamp: new Date(parseInt(t.time)),
    }));
  }

  async fetchBalance(): Promise<Balance[]> {
    const accountType = this.category === 'spot' ? 'SPOT' : 'UNIFIED';
    const data = await this.request('/v5/account/wallet-balance', 'GET', { accountType }, true);

    const balances: Balance[] = [];
    for (const account of data.list || []) {
      for (const coin of account.coin || []) {
        if (parseFloat(coin.walletBalance) > 0) {
          balances.push({
            currency: coin.coin,
            free: parseFloat(coin.availableToWithdraw || coin.free || '0'),
            used: parseFloat(coin.locked || '0'),
            total: parseFloat(coin.walletBalance),
          });
        }
      }
    }

    return balances;
  }

  async fetchPositions(): Promise<Position[]> {
    if (this.category === 'spot') return [];

    const data = await this.request('/v5/position/list', 'GET', { 
      category: this.category,
      settleCoin: 'USDT',
    }, true);

    return (data.list || [])
      .filter((p: any) => parseFloat(p.size) !== 0)
      .map((p: any) => ({
        symbol: this.getSymbolFromMarketId(p.symbol),
        side: p.side === 'Buy' ? 'long' : 'short',
        amount: parseFloat(p.size),
        entryPrice: parseFloat(p.avgPrice),
        markPrice: parseFloat(p.markPrice),
        unrealizedPnl: parseFloat(p.unrealisedPnl),
        leverage: parseFloat(p.leverage),
        liquidationPrice: parseFloat(p.liqPrice) || undefined,
      }));
  }

  async createOrder(symbol: string, type: Order['type'], side: Order['side'], amount: number, price?: number, params?: any): Promise<Order> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const orderParams: any = {
      category: this.category,
      symbol: market.id,
      side: side === 'buy' ? 'Buy' : 'Sell',
      orderType: type === 'market' ? 'Market' : 'Limit',
      qty: amount.toString(),
      timeInForce: params?.timeInForce || (type === 'limit' ? 'GTC' : 'IOC'),
    };

    if (type === 'limit' && price) {
      orderParams.price = price.toString();
    }

    if (params?.stopPrice) {
      orderParams.triggerPrice = params.stopPrice.toString();
      orderParams.triggerDirection = side === 'buy' ? 1 : 2;
    }

    if (params?.reduceOnly) {
      orderParams.reduceOnly = true;
    }

    if (params?.positionIdx !== undefined) {
      orderParams.positionIdx = params.positionIdx;
    }

    const data = await this.request('/v5/order/create', 'POST', orderParams, true);

    return {
      id: data.orderId,
      clientOrderId: data.orderLinkId,
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
    if (!symbol) throw new Error('Symbol required for Bybit order cancellation');

    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    await this.request('/v5/order/cancel', 'POST', {
      category: this.category,
      symbol: market.id,
      orderId,
    }, true);

    return true;
  }

  async fetchOrder(orderId: string, symbol?: string): Promise<Order> {
    if (!symbol) throw new Error('Symbol required for Bybit order fetch');

    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request('/v5/order/realtime', 'GET', {
      category: this.category,
      symbol: market.id,
      orderId,
    }, true);

    const order = data.list?.[0];
    if (!order) throw new Error(`Order ${orderId} not found`);

    return this.parseOrder(order, symbol);
  }

  async fetchOpenOrders(symbol?: string): Promise<Order[]> {
    const params: any = { category: this.category };
    if (symbol) {
      const market = this.markets.get(symbol);
      if (market) params.symbol = market.id;
    }

    const data = await this.request('/v5/order/realtime', 'GET', params, true);

    return (data.list || []).map((o: any) => 
      this.parseOrder(o, symbol || this.getSymbolFromMarketId(o.symbol))
    );
  }

  async fetchClosedOrders(symbol?: string, since?: number, limit: number = 50): Promise<Order[]> {
    const params: any = { category: this.category, limit };
    if (symbol) {
      const market = this.markets.get(symbol);
      if (market) params.symbol = market.id;
    }
    if (since) params.startTime = since;

    const data = await this.request('/v5/order/history', 'GET', params, true);

    return (data.list || []).map((o: any) =>
      this.parseOrder(o, symbol || this.getSymbolFromMarketId(o.symbol))
    );
  }

  // WebSocket Implementation
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsPublicUrl);

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.logger.info('✅ Bybit WebSocket connected');
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
        this.ws.send(JSON.stringify({ op: 'ping' }));
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.wsHeartbeat) {
      clearInterval(this.wsHeartbeat);
      this.wsHeartbeat = null;
    }
  }

  private handleWsMessage(message: any): void {
    if (message.op === 'pong') return;
    if (message.success === false) {
      this.logger.error('WebSocket subscription error:', message.ret_msg);
      return;
    }

    const { topic, data } = message;
    if (!topic || !data) return;

    const [channel, marketId] = topic.split('.');

    if (channel === 'tickers') {
      const symbol = this.getSymbolFromMarketId(marketId);
      this.emitWsEvent(`ticker:${symbol}`, this.parseWsTicker(data, symbol));
    } else if (channel === 'orderbook') {
      const [, marketId, depth] = topic.split('.');
      const symbol = this.getSymbolFromMarketId(marketId);
      this.emitWsEvent(`orderbook:${symbol}`, this.parseWsOrderBook(data, symbol));
    } else if (channel === 'publicTrade') {
      const symbol = this.getSymbolFromMarketId(marketId);
      for (const trade of data) {
        this.emitWsEvent(`trades:${symbol}`, this.parseWsTrade(trade, symbol));
      }
    } else if (channel === 'kline') {
      const [, interval, marketId] = topic.split('.');
      const symbol = this.getSymbolFromMarketId(marketId);
      for (const candle of data) {
        this.emitWsEvent(`ohlcv:${symbol}:${interval}`, this.parseWsOHLCV(candle));
      }
    }
  }

  async subscribeToTicker(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`ticker:${symbol}`, callback);
    await this.wsSubscribe([`tickers.${market.id}`]);
  }

  async subscribeToOrderBook(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`orderbook:${symbol}`, callback);
    await this.wsSubscribe([`orderbook.50.${market.id}`]);
  }

  async subscribeToTrades(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`trades:${symbol}`, callback);
    await this.wsSubscribe([`publicTrade.${market.id}`]);
  }

  async subscribeToOHLCV(symbol: string, timeframe: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const interval = this.convertTimeframe(timeframe);
    this.addWsCallback(`ohlcv:${symbol}:${interval}`, callback);
    await this.wsSubscribe([`kline.${interval}.${market.id}`]);
  }

  private async wsSubscribe(args: string[]): Promise<void> {
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
      '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
      '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720',
      '1d': 'D', '1w': 'W', '1M': 'M',
    };
    return map[timeframe] || '60';
  }

  private getSymbolFromMarketId(marketId: string): string {
    for (const [symbol, market] of this.markets) {
      if (market.id === marketId) return symbol;
    }
    // Fallback
    if (marketId.endsWith('USDT')) {
      return `${marketId.slice(0, -4)}/USDT`;
    }
    return marketId;
  }

  private parseTicker(ticker: any, symbol: string): MarketData {
    return {
      symbol,
      exchange: this.name,
      price: parseFloat(ticker.lastPrice || ticker.last),
      bid: parseFloat(ticker.bid1Price || '0'),
      ask: parseFloat(ticker.ask1Price || '0'),
      spread: parseFloat(ticker.ask1Price || '0') - parseFloat(ticker.bid1Price || '0'),
      volume: parseFloat(ticker.volume24h || ticker.turnover24h || '0'),
      high24h: parseFloat(ticker.highPrice24h || '0'),
      low24h: parseFloat(ticker.lowPrice24h || '0'),
      change24h: parseFloat(ticker.price24hPcnt || '0') * 100,
      timestamp: new Date(),
    };
  }

  private parseOrder(order: any, symbol: string): Order {
    const statusMap: Record<string, Order['status']> = {
      'Created': 'open',
      'New': 'open',
      'PartiallyFilled': 'open',
      'Filled': 'closed',
      'Cancelled': 'canceled',
      'Rejected': 'rejected',
      'Expired': 'expired',
    };

    return {
      id: order.orderId,
      clientOrderId: order.orderLinkId,
      symbol,
      type: order.orderType?.toLowerCase() as Order['type'],
      side: order.side?.toLowerCase() as Order['side'],
      amount: parseFloat(order.qty),
      price: order.price ? parseFloat(order.price) : undefined,
      stopPrice: order.triggerPrice ? parseFloat(order.triggerPrice) : undefined,
      status: statusMap[order.orderStatus] || 'open',
      filled: parseFloat(order.cumExecQty || '0'),
      remaining: parseFloat(order.qty) - parseFloat(order.cumExecQty || '0'),
      timestamp: new Date(parseInt(order.createdTime)),
    };
  }

  private parseWsTicker(data: any, symbol: string): MarketData {
    return {
      symbol,
      exchange: this.name,
      price: parseFloat(data.lastPrice),
      bid: parseFloat(data.bid1Price || '0'),
      ask: parseFloat(data.ask1Price || '0'),
      spread: parseFloat(data.ask1Price || '0') - parseFloat(data.bid1Price || '0'),
      volume: parseFloat(data.volume24h || '0'),
      high24h: parseFloat(data.highPrice24h || '0'),
      low24h: parseFloat(data.lowPrice24h || '0'),
      change24h: parseFloat(data.price24hPcnt || '0') * 100,
      timestamp: new Date(),
    };
  }

  private parseWsOrderBook(data: any, symbol: string): OrderBook {
    return {
      bids: (data.b || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (data.a || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: new Date(parseInt(data.ts)),
      exchange: this.name,
      symbol,
    };
  }

  private parseWsTrade(data: any, symbol: string): Trade {
    return {
      id: data.i,
      symbol,
      side: data.S?.toLowerCase() as 'buy' | 'sell',
      amount: parseFloat(data.v),
      price: parseFloat(data.p),
      cost: parseFloat(data.v) * parseFloat(data.p),
      fee: 0,
      timestamp: new Date(parseInt(data.T)),
    };
  }

  private parseWsOHLCV(data: any): OHLCV {
    return {
      timestamp: new Date(parseInt(data.start)),
      open: parseFloat(data.open),
      high: parseFloat(data.high),
      low: parseFloat(data.low),
      close: parseFloat(data.close),
      volume: parseFloat(data.volume),
    };
  }

  // Bybit-specific methods
  async setLeverage(symbol: string, leverage: number): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    await this.request('/v5/position/set-leverage', 'POST', {
      category: this.category,
      symbol: market.id,
      buyLeverage: leverage.toString(),
      sellLeverage: leverage.toString(),
    }, true);
  }

  async setMarginMode(symbol: string, mode: 'ISOLATED' | 'CROSS'): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    await this.request('/v5/position/switch-isolated', 'POST', {
      category: this.category,
      symbol: market.id,
      tradeMode: mode === 'ISOLATED' ? 1 : 0,
      buyLeverage: '10',
      sellLeverage: '10',
    }, true);
  }
}
