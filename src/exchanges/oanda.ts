/**
 * K.I.T. OANDA Exchange Adapter
 * Forex and CFD trading via OANDA v20 REST API
 */

import { BaseExchange, ExchangeCredentials, MarketData, OHLCV, OrderBook, Trade, Order, Balance, Position, WebSocketCallback } from './base';
import WebSocket from 'ws';

interface OANDACredentials extends ExchangeCredentials {
  accountId: string;
}

export class OANDAExchange extends BaseExchange {
  public readonly name = 'oanda';
  public readonly displayName = 'OANDA';
  public readonly supportsFutures = false;
  public readonly supportsMargin = true;
  public readonly supportsWebSocket = true;

  private baseUrl: string;
  private streamUrl: string;
  private ws: WebSocket | null = null;
  private accountId: string;

  constructor(credentials: OANDACredentials) {
    super(credentials);
    this.accountId = credentials.accountId;
    
    if (credentials.testnet) {
      this.baseUrl = 'https://api-fxpractice.oanda.com';
      this.streamUrl = 'https://stream-fxpractice.oanda.com';
    } else {
      this.baseUrl = 'https://api-fxtrade.oanda.com';
      this.streamUrl = 'https://stream-fxtrade.oanda.com';
    }
  }

  private async request(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.credentials.apiKey}`,
      'Accept-Datetime-Format': 'UNIX',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OANDA API Error: ${error.errorMessage || response.statusText}`);
    }

    return response.json();
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting to OANDA...');
    await this.fetchMarkets();
    this.connected = true;
    this.logger.info('✅ Connected to OANDA');
  }

  async disconnect(): Promise<void> {
    await this.disconnectWebSocket();
    this.connected = false;
    this.logger.info('Disconnected from OANDA');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request(`/v3/accounts/${this.accountId}`);
      return true;
    } catch {
      return false;
    }
  }

  async fetchMarkets(): Promise<any[]> {
    const data = await this.request(`/v3/accounts/${this.accountId}/instruments`);

    this.markets.clear();
    for (const inst of data.instruments || []) {
      const symbol = inst.name.replace('_', '/');
      
      this.markets.set(symbol, {
        id: inst.name,
        symbol,
        base: symbol.split('/')[0],
        quote: symbol.split('/')[1],
        active: inst.type !== 'CLOSED',
        type: inst.type.toLowerCase(),
        precision: {
          price: inst.displayPrecision,
          amount: inst.tradeUnitsPrecision,
        },
        limits: {
          amount: {
            min: parseFloat(inst.minimumTradeSize || '1'),
            max: parseFloat(inst.maximumOrderUnits || '100000000'),
          },
        },
        pipLocation: inst.pipLocation,
        marginRate: parseFloat(inst.marginRate || '0.02'),
      });
    }

    return Array.from(this.markets.values());
  }

  async fetchTicker(symbol: string): Promise<MarketData> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request(`/v3/accounts/${this.accountId}/pricing?instruments=${market.id}`);
    const price = data.prices?.[0];

    if (!price) throw new Error(`No pricing data for ${symbol}`);

    const bid = parseFloat(price.bids?.[0]?.price || '0');
    const ask = parseFloat(price.asks?.[0]?.price || '0');

    return {
      symbol,
      exchange: this.name,
      price: (bid + ask) / 2,
      bid,
      ask,
      spread: ask - bid,
      volume: 0, // OANDA doesn't provide volume
      high24h: 0,
      low24h: 0,
      change24h: 0,
      timestamp: new Date(parseFloat(price.time) * 1000),
    };
  }

  async fetchTickers(symbols?: string[]): Promise<MarketData[]> {
    const instruments = symbols
      ? symbols.map(s => this.markets.get(s)?.id).filter(Boolean).join(',')
      : Array.from(this.markets.values()).map(m => m.id).join(',');

    const data = await this.request(`/v3/accounts/${this.accountId}/pricing?instruments=${instruments}`);

    return (data.prices || []).map((price: any) => {
      const symbol = price.instrument.replace('_', '/');
      const bid = parseFloat(price.bids?.[0]?.price || '0');
      const ask = parseFloat(price.asks?.[0]?.price || '0');

      return {
        symbol,
        exchange: this.name,
        price: (bid + ask) / 2,
        bid,
        ask,
        spread: ask - bid,
        volume: 0,
        high24h: 0,
        low24h: 0,
        change24h: 0,
        timestamp: new Date(parseFloat(price.time) * 1000),
      };
    });
  }

  async fetchOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    // OANDA provides order book as depth levels
    const data = await this.request(`/v3/instruments/${market.id}/orderBook`);
    const book = data.orderBook;

    const bids: [number, number][] = [];
    const asks: [number, number][] = [];

    if (book?.buckets) {
      for (const bucket of book.buckets) {
        const price = parseFloat(bucket.price);
        const bidVolume = parseFloat(bucket.longCountPercent);
        const askVolume = parseFloat(bucket.shortCountPercent);

        if (bidVolume > 0) bids.push([price, bidVolume]);
        if (askVolume > 0) asks.push([price, askVolume]);
      }
    }

    // Sort and limit
    bids.sort((a, b) => b[0] - a[0]);
    asks.sort((a, b) => a[0] - b[0]);

    return {
      bids: bids.slice(0, limit),
      asks: asks.slice(0, limit),
      timestamp: book?.time ? new Date(parseFloat(book.time) * 1000) : new Date(),
      exchange: this.name,
      symbol,
    };
  }

  async fetchOHLCV(symbol: string, timeframe: string = 'H1', since?: number, limit: number = 500): Promise<OHLCV[]> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const granularity = this.convertTimeframe(timeframe);
    const params: any = { granularity, count: limit };
    if (since) params.from = Math.floor(since / 1000).toString();

    const queryString = new URLSearchParams(params).toString();
    const data = await this.request(`/v3/instruments/${market.id}/candles?${queryString}`);

    return (data.candles || [])
      .filter((c: any) => c.complete)
      .map((c: any) => ({
        timestamp: new Date(parseFloat(c.time) * 1000),
        open: parseFloat(c.mid.o),
        high: parseFloat(c.mid.h),
        low: parseFloat(c.mid.l),
        close: parseFloat(c.mid.c),
        volume: parseFloat(c.volume),
      }));
  }

  async fetchTrades(symbol: string, limit: number = 50): Promise<Trade[]> {
    // OANDA doesn't have public trades, return recent transactions
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const data = await this.request(`/v3/accounts/${this.accountId}/transactions?type=ORDER_FILL&count=${limit}`);

    return (data.transactions || [])
      .filter((t: any) => t.instrument === market.id)
      .map((t: any) => ({
        id: t.id,
        symbol,
        side: parseFloat(t.units) > 0 ? 'buy' : 'sell',
        amount: Math.abs(parseFloat(t.units)),
        price: parseFloat(t.price),
        cost: Math.abs(parseFloat(t.units)) * parseFloat(t.price),
        fee: parseFloat(t.commission || '0'),
        timestamp: new Date(parseFloat(t.time) * 1000),
      }));
  }

  async fetchBalance(): Promise<Balance[]> {
    const data = await this.request(`/v3/accounts/${this.accountId}`);
    const account = data.account;

    return [{
      currency: account.currency,
      free: parseFloat(account.marginAvailable),
      used: parseFloat(account.marginUsed),
      total: parseFloat(account.balance),
    }];
  }

  async fetchPositions(): Promise<Position[]> {
    const data = await this.request(`/v3/accounts/${this.accountId}/openPositions`);

    return (data.positions || []).map((pos: any) => {
      const longUnits = parseFloat(pos.long?.units || '0');
      const shortUnits = parseFloat(pos.short?.units || '0');
      const isLong = longUnits > 0;
      const side = isLong ? pos.long : pos.short;

      return {
        symbol: pos.instrument.replace('_', '/'),
        side: isLong ? 'long' : 'short',
        amount: Math.abs(isLong ? longUnits : shortUnits),
        entryPrice: parseFloat(side.averagePrice),
        markPrice: parseFloat(side.averagePrice), // Need live price
        unrealizedPnl: parseFloat(side.unrealizedPL),
        leverage: 1 / parseFloat(this.markets.get(pos.instrument.replace('_', '/'))?.marginRate || 0.02),
      };
    });
  }

  async createOrder(symbol: string, type: Order['type'], side: Order['side'], amount: number, price?: number, params?: any): Promise<Order> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const units = side === 'buy' ? amount : -amount;

    const orderRequest: any = {
      instrument: market.id,
      units: units.toString(),
      type: type === 'market' ? 'MARKET' : 'LIMIT',
      positionFill: 'DEFAULT',
    };

    if (type === 'limit' && price) {
      orderRequest.price = price.toString();
      orderRequest.timeInForce = params?.timeInForce || 'GTC';
    }

    if (params?.stopLoss) {
      orderRequest.stopLossOnFill = { price: params.stopLoss.toString() };
    }

    if (params?.takeProfit) {
      orderRequest.takeProfitOnFill = { price: params.takeProfit.toString() };
    }

    const data = await this.request(`/v3/accounts/${this.accountId}/orders`, 'POST', { order: orderRequest });

    const filledOrder = data.orderFillTransaction;
    const createdOrder = data.orderCreateTransaction;

    if (filledOrder) {
      return {
        id: filledOrder.id,
        symbol,
        type,
        side,
        amount: Math.abs(parseFloat(filledOrder.units)),
        price: parseFloat(filledOrder.price),
        status: 'closed',
        filled: Math.abs(parseFloat(filledOrder.units)),
        remaining: 0,
        timestamp: new Date(parseFloat(filledOrder.time) * 1000),
      };
    }

    return {
      id: createdOrder.id,
      symbol,
      type,
      side,
      amount,
      price,
      status: 'open',
      filled: 0,
      remaining: amount,
      timestamp: new Date(parseFloat(createdOrder.time) * 1000),
    };
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<boolean> {
    await this.request(`/v3/accounts/${this.accountId}/orders/${orderId}/cancel`, 'PUT');
    return true;
  }

  async fetchOrder(orderId: string, symbol?: string): Promise<Order> {
    const data = await this.request(`/v3/accounts/${this.accountId}/orders/${orderId}`);
    return this.parseOrder(data.order);
  }

  async fetchOpenOrders(symbol?: string): Promise<Order[]> {
    let endpoint = `/v3/accounts/${this.accountId}/pendingOrders`;
    if (symbol) {
      const market = this.markets.get(symbol);
      if (market) endpoint += `?instrument=${market.id}`;
    }

    const data = await this.request(endpoint);
    return (data.orders || []).map((o: any) => this.parseOrder(o));
  }

  async fetchClosedOrders(symbol?: string, since?: number, limit: number = 50): Promise<Order[]> {
    let endpoint = `/v3/accounts/${this.accountId}/orders?state=FILLED,CANCELLED&count=${limit}`;
    if (symbol) {
      const market = this.markets.get(symbol);
      if (market) endpoint += `&instrument=${market.id}`;
    }

    const data = await this.request(endpoint);
    return (data.orders || []).map((o: any) => this.parseOrder(o));
  }

  // Streaming API (WebSocket-like via HTTP Streaming)
  async connectWebSocket(): Promise<void> {
    this.logger.info('Starting OANDA price stream...');
    // OANDA uses HTTP streaming, not WebSocket
    // We'll simulate WebSocket behavior
    this.wsConnected = true;
    this.logger.info('✅ OANDA price stream ready');
  }

  async disconnectWebSocket(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected = false;
  }

  async subscribeToTicker(symbol: string, callback: WebSocketCallback): Promise<void> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    this.addWsCallback(`ticker:${symbol}`, callback);
    
    // Start streaming for this instrument
    this.startPriceStream([market.id]);
  }

  async subscribeToOrderBook(symbol: string, callback: WebSocketCallback): Promise<void> {
    this.logger.warn('OANDA does not support real-time order book streaming');
    // Poll order book instead
  }

  async subscribeToTrades(symbol: string, callback: WebSocketCallback): Promise<void> {
    this.logger.warn('OANDA does not support public trade streaming');
  }

  async subscribeToOHLCV(symbol: string, timeframe: string, callback: WebSocketCallback): Promise<void> {
    this.logger.warn('OANDA does not support OHLCV streaming, use polling');
  }

  private async startPriceStream(instruments: string[]): Promise<void> {
    const url = `${this.streamUrl}/v3/accounts/${this.accountId}/pricing/stream?instruments=${instruments.join(',')}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.credentials.apiKey}`,
        },
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.type === 'PRICE') {
                const symbol = data.instrument.replace('_', '/');
                const bid = parseFloat(data.bids?.[0]?.price || '0');
                const ask = parseFloat(data.asks?.[0]?.price || '0');

                this.emitWsEvent(`ticker:${symbol}`, {
                  symbol,
                  exchange: this.name,
                  price: (bid + ask) / 2,
                  bid,
                  ask,
                  spread: ask - bid,
                  volume: 0,
                  high24h: 0,
                  low24h: 0,
                  change24h: 0,
                  timestamp: new Date(parseFloat(data.time) * 1000),
                });
              }
            } catch (e) {
              // Heartbeat or invalid JSON
            }
          }
        }
      };

      processStream().catch(err => {
        this.logger.error('Price stream error:', err);
        this.wsConnected = false;
      });

    } catch (error) {
      this.logger.error('Failed to start price stream:', error);
      throw error;
    }
  }

  // Helper methods
  private convertTimeframe(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': 'M1', '5m': 'M5', '15m': 'M15', '30m': 'M30',
      '1h': 'H1', '2h': 'H2', '4h': 'H4', '6h': 'H6', '8h': 'H8', '12h': 'H12',
      '1d': 'D', '1w': 'W', '1M': 'M',
    };
    return map[timeframe] || 'H1';
  }

  private parseOrder(order: any): Order {
    const statusMap: Record<string, Order['status']> = {
      'PENDING': 'open',
      'FILLED': 'closed',
      'CANCELLED': 'canceled',
      'TRIGGERED': 'open',
    };

    const units = parseFloat(order.units || '0');

    return {
      id: order.id,
      clientOrderId: order.clientExtensions?.id,
      symbol: order.instrument?.replace('_', '/') || '',
      type: order.type?.toLowerCase()?.replace('_', '') as Order['type'],
      side: units > 0 ? 'buy' : 'sell',
      amount: Math.abs(units),
      price: order.price ? parseFloat(order.price) : undefined,
      status: statusMap[order.state] || 'open',
      filled: parseFloat(order.filledTime ? order.units : '0'),
      remaining: Math.abs(units),
      timestamp: new Date(parseFloat(order.createTime) * 1000),
    };
  }

  // OANDA-specific methods
  async closePosition(symbol: string, longUnits?: number, shortUnits?: number): Promise<any> {
    const market = this.markets.get(symbol);
    if (!market) throw new Error(`Unknown symbol: ${symbol}`);

    const body: any = {};
    if (longUnits !== undefined) {
      body.longUnits = longUnits === 0 ? 'ALL' : longUnits.toString();
    }
    if (shortUnits !== undefined) {
      body.shortUnits = shortUnits === 0 ? 'ALL' : shortUnits.toString();
    }

    return this.request(`/v3/accounts/${this.accountId}/positions/${market.id}/close`, 'PUT', body);
  }

  async getAccountSummary(): Promise<any> {
    const data = await this.request(`/v3/accounts/${this.accountId}/summary`);
    return data.account;
  }

  async getSpread(symbol: string): Promise<number> {
    const ticker = await this.fetchTicker(symbol);
    return ticker.spread;
  }
}
