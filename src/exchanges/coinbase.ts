/**
 * K.I.T. Coinbase Exchange Adapter
 * Supports Coinbase Advanced Trade API (formerly Coinbase Pro)
 */

import { BaseExchange, ExchangeCredentials, MarketData, OHLCV, OrderBook, Trade, Order, Balance, Position, WebSocketCallback } from './base';
import WebSocket from 'ws';
import crypto from 'crypto';

export class CoinbaseExchange extends BaseExchange {
  public readonly name = 'coinbase';
  public readonly displayName = 'Coinbase';
  public readonly supportsFutures = false;
  public readonly supportsMargin = false;
  public readonly supportsWebSocket = true;

  private baseUrl = 'https://api.coinbase.com';
  private wsUrl = 'wss://advanced-trade-ws.coinbase.com';
  private ws: WebSocket | null = null;
  private wsHeartbeat: NodeJS.Timeout | null = null;

  constructor(credentials: ExchangeCredentials) {
    super(credentials);
  }

  private sign(timestamp: string, method: string, requestPath: string, body: string = ''): string {
    const message = timestamp + method + requestPath + body;
    return crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(message)
      .digest('hex');
  }

  private async request(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    
    const headers: any = {
      'Content-Type': 'application/json',
      'CB-ACCESS-KEY': this.credentials.apiKey,
      'CB-ACCESS-SIGN': this.sign(timestamp, method, endpoint, bodyStr),
      'CB-ACCESS-TIMESTAMP': timestamp,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? bodyStr : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Coinbase API Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting to Coinbase...');
    await this.fetchMarkets();
    this.connected = true;
    this.logger.info('✅ Connected to Coinbase');
  }

  async disconnect(): Promise<void> {
    await this.disconnectWebSocket();
    this.connected = false;
    this.logger.info('Disconnected from Coinbase');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/api/v3/brokerage/time');
      return true;
    } catch {
      return false;
    }
  }

  async fetchMarkets(): Promise<any[]> {
    const data = await this.request('/api/v3/brokerage/products');

    this.markets.clear();
    for (const product of data.products || []) {
      const symbol = `${product.base_currency_id}/${product.quote_currency_id}`;
      
      this.markets.set(symbol, {
        id: product.product_id,
        symbol,
        base: product.base_currency_id,
        quote: product.quote_currency_id,
        active: product.status === 'online',
        precision: {
          price: this.getPrecision(product.quote_increment),
          amount: this.getPrecision(product.base_increment),
        },
        limits: {
          amount: {
            min: parseFloat(product.base_min_size || '0'),
            max: parseFloat(product.base_max_size || '0'),
          },
          price: {
            min: parseFloat(product.quote_min_size || '0'),
            max: parseFloat(product.quote_max_size || '0'),
          },
        },
      });
    }

    return Array.from(this.markets.values());
  }

  async fetchTicker(symbol: string): Promise<MarketData> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const [product, ticker] = await Promise.all([
      this.request(`/api/v3/brokerage/products/${market.id}`),
      this.request(`/api/v3/brokerage/products/${market.id}/ticker`),
    ]);

    const price = parseFloat(product.price || ticker.trades?.[0]?.price || '0');
    const bid = parseFloat(ticker.best_bid || '0');
    const ask = parseFloat(ticker.best_ask || '0');

    return {
      symbol,
      exchange: this.name,
      price,
      bid,
      ask,
      spread: ask - bid,
      volume: parseFloat(product.volume_24h || '0'),
      high24h: parseFloat(product.high_24h || '0'),
      low24h: parseFloat(product.low_24h || '0'),
      change24h: parseFloat(product.price_percentage_change_24h || '0'),
      timestamp: new Date(),
    };
  }

  async fetchTickers(symbols?: string[]): Promise<MarketData[]> {
    const data = await this.request('/api/v3/brokerage/products');
    
    const products = (data.products || []).filter((p: any) => {
      const symbol = `${p.base_currency_id}/${p.quote_currency_id}`;
      return !symbols || symbols.includes(symbol);
    });

    return products.map((p: any) => ({
      symbol: `${p.base_currency_id}/${p.quote_currency_id}`,
      exchange: this.name,
      price: parseFloat(p.price || '0'),
      bid: parseFloat(p.bid || '0'),
      ask: parseFloat(p.ask || '0'),
      spread: parseFloat(p.ask || '0') - parseFloat(p.bid || '0'),
      volume: parseFloat(p.volume_24h || '0'),
      high24h: parseFloat(p.high_24h || '0'),
      low24h: parseFloat(p.low_24h || '0'),
      change24h: parseFloat(p.price_percentage_change_24h || '0'),
      timestamp: new Date(),
    }));
  }

  async fetchOrderBook(symbol: string, limit: number = 50): Promise<OrderBook> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request(`/api/v3/brokerage/products/${market.id}/book?limit=${limit}`);

    return {
      bids: (data.pricebook?.bids || []).map((b: any) => [parseFloat(b.price), parseFloat(b.size)]),
      asks: (data.pricebook?.asks || []).map((a: any) => [parseFloat(a.price), parseFloat(a.size)]),
      timestamp: new Date(data.pricebook?.time || Date.now()),
      exchange: this.name,
      symbol,
    };
  }

  async fetchOHLCV(symbol: string, timeframe: string = '1h', since?: number, limit: number = 300): Promise<OHLCV[]> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const granularity = this.convertTimeframe(timeframe);
    const end = Math.floor(Date.now() / 1000);
    const start = since ? Math.floor(since / 1000) : end - (parseInt(granularity) * limit);

    const data = await this.request(
      `/api/v3/brokerage/products/${market.id}/candles?start=${start}&end=${end}&granularity=${granularity}`
    );

    return (data.candles || []).map((c: any) => ({
      timestamp: new Date(parseInt(c.start) * 1000),
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume),
    })).reverse();
  }

  async fetchTrades(symbol: string, limit: number = 100): Promise<Trade[]> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request(`/api/v3/brokerage/products/${market.id}/ticker?limit=${limit}`);

    return (data.trades || []).map((t: any) => ({
      id: t.trade_id,
      symbol,
      side: t.side.toLowerCase() as 'buy' | 'sell',
      amount: parseFloat(t.size),
      price: parseFloat(t.price),
      cost: parseFloat(t.size) * parseFloat(t.price),
      fee: 0,
      timestamp: new Date(t.time),
    }));
  }

  async fetchBalance(): Promise<Balance[]> {
    const data = await this.request('/api/v3/brokerage/accounts');

    return (data.accounts || [])
      .filter((a: any) => parseFloat(a.available_balance?.value || '0') > 0 || parseFloat(a.hold?.value || '0') > 0)
      .map((a: any) => ({
        currency: a.currency,
        free: parseFloat(a.available_balance?.value || '0'),
        used: parseFloat(a.hold?.value || '0'),
        total: parseFloat(a.available_balance?.value || '0') + parseFloat(a.hold?.value || '0'),
      }));
  }

  async fetchPositions(): Promise<Position[]> {
    // Coinbase doesn't support margin/futures positions
    return [];
  }

  async createOrder(symbol: string, type: Order['type'], side: Order['side'], amount: number, price?: number, params?: any): Promise<Order> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const orderConfig: any = {
      product_id: market.id,
    };

    if (type === 'market') {
      if (side === 'buy') {
        orderConfig.market_market_ioc = {
          quote_size: (amount * (price || 0)).toFixed(2),
        };
      } else {
        orderConfig.market_market_ioc = {
          base_size: amount.toString(),
        };
      }
    } else if (type === 'limit') {
      orderConfig.limit_limit_gtc = {
        base_size: amount.toString(),
        limit_price: price!.toString(),
        post_only: params?.postOnly || false,
      };
    }

    const data = await this.request('/api/v3/brokerage/orders', 'POST', {
      client_order_id: crypto.randomUUID(),
      side: side.toUpperCase(),
      order_configuration: orderConfig,
    });

    return {
      id: data.order_id,
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
    await this.request('/api/v3/brokerage/orders/batch_cancel', 'POST', {
      order_ids: [orderId],
    });
    return true;
  }

  async fetchOrder(orderId: string, symbol?: string): Promise<Order> {
    const data = await this.request(`/api/v3/brokerage/orders/historical/${orderId}`);
    return this.parseOrder(data.order);
  }

  async fetchOpenOrders(symbol?: string): Promise<Order[]> {
    const params = symbol ? `?product_id=${this.markets.get(symbol)?.id}` : '';
    const data = await this.request(`/api/v3/brokerage/orders/historical/batch${params}&order_status=OPEN`);

    return (data.orders || []).map((o: any) => this.parseOrder(o));
  }

  async fetchClosedOrders(symbol?: string, since?: number, limit?: number): Promise<Order[]> {
    let params = '?order_status=FILLED,CANCELLED,EXPIRED';
    if (symbol) params += `&product_id=${this.markets.get(symbol)?.id}`;
    if (since) params += `&start_date=${new Date(since).toISOString()}`;
    if (limit) params += `&limit=${limit}`;

    const data = await this.request(`/api/v3/brokerage/orders/historical/batch${params}`);

    return (data.orders || []).map((o: any) => this.parseOrder(o));
  }

  // WebSocket Implementation
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.logger.info('✅ Coinbase WebSocket connected');
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
    this.wsConnected = false;
  }

  private startHeartbeat(): void {
    this.wsHeartbeat = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.wsHeartbeat) {
      clearInterval(this.wsHeartbeat);
      this.wsHeartbeat = null;
    }
  }

  private handleWsMessage(message: any): void {
    const { channel, events } = message;

    if (!events) return;

    for (const event of events) {
      const { type, tickers, trades, updates } = event;

      if (channel === 'ticker' && tickers) {
        for (const ticker of tickers) {
          const symbol = this.getSymbolFromProductId(ticker.product_id);
          this.emitWsEvent(`ticker:${symbol}`, this.parseWsTicker(ticker, symbol));
        }
      } else if (channel === 'market_trades' && trades) {
        for (const trade of trades) {
          const symbol = this.getSymbolFromProductId(trade.product_id);
          this.emitWsEvent(`trades:${symbol}`, this.parseWsTrade(trade, symbol));
        }
      } else if (channel === 'level2' && updates) {
        // Handle orderbook updates
        const productId = updates[0]?.product_id;
        if (productId) {
          const symbol = this.getSymbolFromProductId(productId);
          this.emitWsEvent(`orderbook:${symbol}`, this.parseWsOrderBook(updates, symbol));
        }
      }
    }
  }

  async subscribeToTicker(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`ticker:${symbol}`, callback);
    await this.wsSubscribe('ticker', [market.id]);
  }

  async subscribeToOrderBook(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`orderbook:${symbol}`, callback);
    await this.wsSubscribe('level2', [market.id]);
  }

  async subscribeToTrades(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`trades:${symbol}`, callback);
    await this.wsSubscribe('market_trades', [market.id]);
  }

  async subscribeToOHLCV(symbol: string, timeframe: string, callback: WebSocketCallback): Promise<void> {
    // Coinbase doesn't have native OHLCV WebSocket, use ticker to build candles
    this.logger.warn('Coinbase WebSocket does not support native OHLCV streams, using ticker fallback');
    await this.subscribeToTicker(symbol, callback);
  }

  private async wsSubscribe(channel: string, productIds: string[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign(timestamp, 'GET', '/ws', '');

    const message = {
      type: 'subscribe',
      product_ids: productIds,
      channel,
      api_key: this.credentials.apiKey,
      timestamp,
      signature,
    };

    this.ws.send(JSON.stringify(message));
  }

  // Helper methods
  private getPrecision(increment: string): number {
    if (!increment) return 8;
    const parts = increment.split('.');
    return parts[1] ? parts[1].replace(/0+$/, '').length : 0;
  }

  private convertTimeframe(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': 'ONE_MINUTE',
      '5m': 'FIVE_MINUTE',
      '15m': 'FIFTEEN_MINUTE',
      '30m': 'THIRTY_MINUTE',
      '1h': 'ONE_HOUR',
      '2h': 'TWO_HOUR',
      '6h': 'SIX_HOUR',
      '1d': 'ONE_DAY',
    };
    return map[timeframe] || 'ONE_HOUR';
  }

  private getSymbolFromProductId(productId: string): string {
    for (const [symbol, market] of this.markets) {
      if (market.id === productId) return symbol;
    }
    return productId.replace('-', '/');
  }

  private parseOrder(order: any): Order {
    const statusMap: Record<string, Order['status']> = {
      'PENDING': 'open',
      'OPEN': 'open',
      'FILLED': 'closed',
      'CANCELLED': 'canceled',
      'EXPIRED': 'expired',
      'FAILED': 'rejected',
    };

    const symbol = this.getSymbolFromProductId(order.product_id);
    const config = order.order_configuration || {};
    const limitConfig = config.limit_limit_gtc || config.limit_limit_gtd || {};
    const marketConfig = config.market_market_ioc || {};

    return {
      id: order.order_id,
      clientOrderId: order.client_order_id,
      symbol,
      type: limitConfig.limit_price ? 'limit' : 'market',
      side: order.side?.toLowerCase() as Order['side'],
      amount: parseFloat(limitConfig.base_size || marketConfig.base_size || order.filled_size || '0'),
      price: limitConfig.limit_price ? parseFloat(limitConfig.limit_price) : undefined,
      status: statusMap[order.status] || 'open',
      filled: parseFloat(order.filled_size || '0'),
      remaining: parseFloat(limitConfig.base_size || '0') - parseFloat(order.filled_size || '0'),
      timestamp: new Date(order.created_time),
    };
  }

  private parseWsTicker(data: any, symbol: string): MarketData {
    return {
      symbol,
      exchange: this.name,
      price: parseFloat(data.price || '0'),
      bid: parseFloat(data.best_bid || '0'),
      ask: parseFloat(data.best_ask || '0'),
      spread: parseFloat(data.best_ask || '0') - parseFloat(data.best_bid || '0'),
      volume: parseFloat(data.volume_24_h || '0'),
      high24h: parseFloat(data.high_24_h || '0'),
      low24h: parseFloat(data.low_24_h || '0'),
      change24h: parseFloat(data.price_percent_chg_24_h || '0'),
      timestamp: new Date(),
    };
  }

  private parseWsTrade(data: any, symbol: string): Trade {
    return {
      id: data.trade_id,
      symbol,
      side: data.side?.toLowerCase() as 'buy' | 'sell',
      amount: parseFloat(data.size || '0'),
      price: parseFloat(data.price || '0'),
      cost: parseFloat(data.size || '0') * parseFloat(data.price || '0'),
      fee: 0,
      timestamp: new Date(data.time),
    };
  }

  private parseWsOrderBook(updates: any[], symbol: string): OrderBook {
    const bids: [number, number][] = [];
    const asks: [number, number][] = [];

    for (const update of updates) {
      const entry: [number, number] = [parseFloat(update.price_level), parseFloat(update.new_quantity)];
      if (update.side === 'bid') {
        bids.push(entry);
      } else {
        asks.push(entry);
      }
    }

    return {
      bids,
      asks,
      timestamp: new Date(),
      exchange: this.name,
      symbol,
    };
  }
}
