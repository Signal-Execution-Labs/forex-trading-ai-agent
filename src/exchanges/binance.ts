/**
 * K.I.T. Binance Exchange Adapter
 * Supports Spot, Futures, and Margin trading
 */

import { BaseExchange, ExchangeCredentials, MarketData, OHLCV, OrderBook, Trade, Order, Balance, Position, WebSocketCallback } from './base';
import WebSocket from 'ws';
import crypto from 'crypto';

interface BinanceWsMessage {
  e: string;  // Event type
  s: string;  // Symbol
  [key: string]: any;
}

export class BinanceExchange extends BaseExchange {
  public readonly name = 'binance';
  public readonly displayName = 'Binance';
  public readonly supportsFutures = true;
  public readonly supportsMargin = true;
  public readonly supportsWebSocket = true;

  private baseUrl: string;
  private wsBaseUrl: string;
  private ws: WebSocket | null = null;
  private wsHeartbeat: NodeJS.Timeout | null = null;
  private futuresMode: boolean = false;

  constructor(credentials: ExchangeCredentials, futuresMode: boolean = false) {
    super(credentials);
    this.futuresMode = futuresMode;
    
    if (credentials.testnet) {
      this.baseUrl = futuresMode 
        ? 'https://testnet.binancefuture.com'
        : 'https://testnet.binance.vision';
      this.wsBaseUrl = futuresMode
        ? 'wss://stream.binancefuture.com'
        : 'wss://testnet.binance.vision';
    } else {
      this.baseUrl = futuresMode
        ? 'https://fapi.binance.com'
        : 'https://api.binance.com';
      this.wsBaseUrl = futuresMode
        ? 'wss://fstream.binance.com'
        : 'wss://stream.binance.com:9443';
    }
  }

  private sign(queryString: string): string {
    return crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async request(endpoint: string, method: string = 'GET', params: any = {}, signed: boolean = false): Promise<any> {
    const url = new URL(endpoint, this.baseUrl);
    
    if (signed) {
      params.timestamp = Date.now();
      params.recvWindow = 5000;
    }

    const queryString = new URLSearchParams(params).toString();
    
    if (signed) {
      const signature = this.sign(queryString);
      url.search = `${queryString}&signature=${signature}`;
    } else if (queryString) {
      url.search = queryString;
    }

    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (signed) {
      headers['X-MBX-APIKEY'] = this.credentials.apiKey;
    }

    const response = await fetch(url.toString(), { method, headers });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Binance API Error: ${error.msg || response.statusText}`);
    }

    return response.json();
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting to Binance...');
    await this.fetchMarkets();
    this.connected = true;
    this.logger.info('✅ Connected to Binance');
  }

  async disconnect(): Promise<void> {
    await this.disconnectWebSocket();
    this.connected = false;
    this.logger.info('Disconnected from Binance');
  }

  async testConnection(): Promise<boolean> {
    try {
      const endpoint = this.futuresMode ? '/fapi/v1/ping' : '/api/v3/ping';
      await this.request(endpoint);
      return true;
    } catch {
      return false;
    }
  }

  async fetchMarkets(): Promise<any[]> {
    const endpoint = this.futuresMode ? '/fapi/v1/exchangeInfo' : '/api/v3/exchangeInfo';
    const data = await this.request(endpoint);
    
    this.markets.clear();
    for (const market of data.symbols) {
      const symbol = `${market.baseAsset}/${market.quoteAsset}`;
      this.markets.set(symbol, {
        id: market.symbol,
        symbol,
        base: market.baseAsset,
        quote: market.quoteAsset,
        active: market.status === 'TRADING',
        precision: {
          price: market.pricePrecision || 8,
          amount: market.quantityPrecision || 8,
        },
        limits: {
          amount: {
            min: parseFloat(market.filters?.find((f: any) => f.filterType === 'LOT_SIZE')?.minQty || '0'),
            max: parseFloat(market.filters?.find((f: any) => f.filterType === 'LOT_SIZE')?.maxQty || '0'),
          },
        },
      });
    }

    return Array.from(this.markets.values());
  }

  async fetchTicker(symbol: string): Promise<MarketData> {
    const marketId = this.getMarketId(symbol);
    const endpoint = this.futuresMode ? '/fapi/v1/ticker/24hr' : '/api/v3/ticker/24hr';
    const data = await this.request(endpoint, 'GET', { symbol: marketId });

    return {
      symbol,
      exchange: this.name,
      price: parseFloat(data.lastPrice),
      bid: parseFloat(data.bidPrice),
      ask: parseFloat(data.askPrice),
      spread: parseFloat(data.askPrice) - parseFloat(data.bidPrice),
      volume: parseFloat(data.volume),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      change24h: parseFloat(data.priceChangePercent),
      timestamp: new Date(data.closeTime),
    };
  }

  async fetchTickers(symbols?: string[]): Promise<MarketData[]> {
    const endpoint = this.futuresMode ? '/fapi/v1/ticker/24hr' : '/api/v3/ticker/24hr';
    const data = await this.request(endpoint);
    
    return data
      .filter((t: any) => !symbols || symbols.some(s => this.getMarketId(s) === t.symbol))
      .map((t: any) => ({
        symbol: this.getSymbolFromMarketId(t.symbol),
        exchange: this.name,
        price: parseFloat(t.lastPrice),
        bid: parseFloat(t.bidPrice),
        ask: parseFloat(t.askPrice),
        spread: parseFloat(t.askPrice) - parseFloat(t.bidPrice),
        volume: parseFloat(t.volume),
        high24h: parseFloat(t.highPrice),
        low24h: parseFloat(t.lowPrice),
        change24h: parseFloat(t.priceChangePercent),
        timestamp: new Date(t.closeTime),
      }));
  }

  async fetchOrderBook(symbol: string, limit: number = 100): Promise<OrderBook> {
    const marketId = this.getMarketId(symbol);
    const endpoint = this.futuresMode ? '/fapi/v1/depth' : '/api/v3/depth';
    const data = await this.request(endpoint, 'GET', { symbol: marketId, limit });

    return {
      bids: data.bids.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: data.asks.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: new Date(),
      exchange: this.name,
      symbol,
    };
  }

  async fetchOHLCV(symbol: string, timeframe: string = '1h', since?: number, limit: number = 500): Promise<OHLCV[]> {
    const marketId = this.getMarketId(symbol);
    const endpoint = this.futuresMode ? '/fapi/v1/klines' : '/api/v3/klines';
    const interval = this.convertTimeframe(timeframe);
    
    const params: any = { symbol: marketId, interval, limit };
    if (since) params.startTime = since;

    const data = await this.request(endpoint, 'GET', params);

    return data.map((candle: any[]) => ({
      timestamp: new Date(candle[0]),
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
  }

  async fetchTrades(symbol: string, limit: number = 500): Promise<Trade[]> {
    const marketId = this.getMarketId(symbol);
    const endpoint = this.futuresMode ? '/fapi/v1/trades' : '/api/v3/trades';
    const data = await this.request(endpoint, 'GET', { symbol: marketId, limit });

    return data.map((t: any) => ({
      id: t.id.toString(),
      symbol,
      side: t.isBuyerMaker ? 'sell' : 'buy',
      amount: parseFloat(t.qty),
      price: parseFloat(t.price),
      cost: parseFloat(t.qty) * parseFloat(t.price),
      fee: 0,
      timestamp: new Date(t.time),
    }));
  }

  async fetchBalance(): Promise<Balance[]> {
    const endpoint = this.futuresMode ? '/fapi/v2/balance' : '/api/v3/account';
    const data = await this.request(endpoint, 'GET', {}, true);

    if (this.futuresMode) {
      return data.map((b: any) => ({
        currency: b.asset,
        free: parseFloat(b.availableBalance),
        used: parseFloat(b.balance) - parseFloat(b.availableBalance),
        total: parseFloat(b.balance),
      }));
    }

    return data.balances
      .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b: any) => ({
        currency: b.asset,
        free: parseFloat(b.free),
        used: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked),
      }));
  }

  async fetchPositions(): Promise<Position[]> {
    if (!this.futuresMode) return [];

    const data = await this.request('/fapi/v2/positionRisk', 'GET', {}, true);

    return data
      .filter((p: any) => parseFloat(p.positionAmt) !== 0)
      .map((p: any) => ({
        symbol: this.getSymbolFromMarketId(p.symbol),
        side: parseFloat(p.positionAmt) > 0 ? 'long' : 'short',
        amount: Math.abs(parseFloat(p.positionAmt)),
        entryPrice: parseFloat(p.entryPrice),
        markPrice: parseFloat(p.markPrice),
        unrealizedPnl: parseFloat(p.unRealizedProfit),
        leverage: parseInt(p.leverage),
        liquidationPrice: parseFloat(p.liquidationPrice),
      }));
  }

  async createOrder(symbol: string, type: Order['type'], side: Order['side'], amount: number, price?: number, params?: any): Promise<Order> {
    const marketId = this.getMarketId(symbol);
    const endpoint = this.futuresMode ? '/fapi/v1/order' : '/api/v3/order';
    
    const orderParams: any = {
      symbol: marketId,
      side: side.toUpperCase(),
      type: type.toUpperCase().replace('_', ''),
      quantity: amount,
      ...params,
    };

    if (type === 'limit' && price) {
      orderParams.price = price;
      orderParams.timeInForce = params?.timeInForce || 'GTC';
    }

    if ((type === 'stop' || type === 'stop_limit') && params?.stopPrice) {
      orderParams.stopPrice = params.stopPrice;
    }

    const data = await this.request(endpoint, 'POST', orderParams, true);

    return this.parseOrder(data, symbol);
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<boolean> {
    if (!symbol) throw new Error('Symbol required for Binance order cancellation');
    
    const marketId = this.getMarketId(symbol);
    const endpoint = this.futuresMode ? '/fapi/v1/order' : '/api/v3/order';
    
    await this.request(endpoint, 'DELETE', { symbol: marketId, orderId }, true);
    return true;
  }

  async fetchOrder(orderId: string, symbol?: string): Promise<Order> {
    if (!symbol) throw new Error('Symbol required for Binance order fetch');
    
    const marketId = this.getMarketId(symbol);
    const endpoint = this.futuresMode ? '/fapi/v1/order' : '/api/v3/order';
    
    const data = await this.request(endpoint, 'GET', { symbol: marketId, orderId }, true);
    return this.parseOrder(data, symbol);
  }

  async fetchOpenOrders(symbol?: string): Promise<Order[]> {
    const endpoint = this.futuresMode ? '/fapi/v1/openOrders' : '/api/v3/openOrders';
    const params: any = {};
    if (symbol) params.symbol = this.getMarketId(symbol);

    const data = await this.request(endpoint, 'GET', params, true);
    return data.map((o: any) => this.parseOrder(o, symbol || this.getSymbolFromMarketId(o.symbol)));
  }

  async fetchClosedOrders(symbol?: string, since?: number, limit: number = 500): Promise<Order[]> {
    const endpoint = this.futuresMode ? '/fapi/v1/allOrders' : '/api/v3/allOrders';
    const params: any = { limit };
    if (symbol) params.symbol = this.getMarketId(symbol);
    if (since) params.startTime = since;

    const data = await this.request(endpoint, 'GET', params, true);
    return data
      .filter((o: any) => o.status !== 'NEW')
      .map((o: any) => this.parseOrder(o, symbol || this.getSymbolFromMarketId(o.symbol)));
  }

  // WebSocket Implementation
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.wsBaseUrl}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.logger.info('✅ Binance WebSocket connected');
        this.startHeartbeat();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: BinanceWsMessage = JSON.parse(data.toString());
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

  private handleWsMessage(message: BinanceWsMessage): void {
    const eventType = message.e;
    const symbol = message.s ? this.getSymbolFromMarketId(message.s) : '';

    switch (eventType) {
      case '24hrTicker':
        this.emitWsEvent(`ticker:${symbol}`, this.parseWsTicker(message));
        break;
      case 'depthUpdate':
        this.emitWsEvent(`orderbook:${symbol}`, this.parseWsOrderBook(message));
        break;
      case 'trade':
        this.emitWsEvent(`trades:${symbol}`, this.parseWsTrade(message));
        break;
      case 'kline':
        const tf = message.k.i;
        this.emitWsEvent(`ohlcv:${symbol}:${tf}`, this.parseWsOHLCV(message));
        break;
    }
  }

  async subscribeToTicker(symbol: string, callback: WebSocketCallback): Promise<void> {
    const marketId = this.getMarketId(symbol).toLowerCase();
    this.addWsCallback(`ticker:${symbol}`, callback);
    await this.wsSubscribe([`${marketId}@ticker`]);
  }

  async subscribeToOrderBook(symbol: string, callback: WebSocketCallback): Promise<void> {
    const marketId = this.getMarketId(symbol).toLowerCase();
    this.addWsCallback(`orderbook:${symbol}`, callback);
    await this.wsSubscribe([`${marketId}@depth@100ms`]);
  }

  async subscribeToTrades(symbol: string, callback: WebSocketCallback): Promise<void> {
    const marketId = this.getMarketId(symbol).toLowerCase();
    this.addWsCallback(`trades:${symbol}`, callback);
    await this.wsSubscribe([`${marketId}@trade`]);
  }

  async subscribeToOHLCV(symbol: string, timeframe: string, callback: WebSocketCallback): Promise<void> {
    const marketId = this.getMarketId(symbol).toLowerCase();
    const interval = this.convertTimeframe(timeframe);
    this.addWsCallback(`ohlcv:${symbol}:${timeframe}`, callback);
    await this.wsSubscribe([`${marketId}@kline_${interval}`]);
  }

  private async wsSubscribe(streams: string[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now(),
    };

    this.ws.send(JSON.stringify(message));
  }

  // Helper methods
  private getMarketId(symbol: string): string {
    return symbol.replace('/', '');
  }

  private getSymbolFromMarketId(marketId: string): string {
    // Find in markets
    for (const [symbol, market] of this.markets) {
      if (market.id === marketId) return symbol;
    }
    // Fallback: assume USDT quote
    if (marketId.endsWith('USDT')) {
      return `${marketId.slice(0, -4)}/USDT`;
    }
    return marketId;
  }

  private convertTimeframe(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
      '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
      '1d': '1d', '3d': '3d', '1w': '1w', '1M': '1M',
    };
    return map[timeframe] || timeframe;
  }

  private parseOrder(data: any, symbol: string): Order {
    const statusMap: Record<string, Order['status']> = {
      'NEW': 'open',
      'PARTIALLY_FILLED': 'open',
      'FILLED': 'closed',
      'CANCELED': 'canceled',
      'EXPIRED': 'expired',
      'REJECTED': 'rejected',
    };

    return {
      id: data.orderId.toString(),
      clientOrderId: data.clientOrderId,
      symbol,
      type: data.type.toLowerCase().replace('_', '') as Order['type'],
      side: data.side.toLowerCase() as Order['side'],
      amount: parseFloat(data.origQty),
      price: data.price ? parseFloat(data.price) : undefined,
      stopPrice: data.stopPrice ? parseFloat(data.stopPrice) : undefined,
      status: statusMap[data.status] || 'open',
      filled: parseFloat(data.executedQty),
      remaining: parseFloat(data.origQty) - parseFloat(data.executedQty),
      timestamp: new Date(data.time || data.updateTime),
    };
  }

  private parseWsTicker(data: any): MarketData {
    return {
      symbol: this.getSymbolFromMarketId(data.s),
      exchange: this.name,
      price: parseFloat(data.c),
      bid: parseFloat(data.b),
      ask: parseFloat(data.a),
      spread: parseFloat(data.a) - parseFloat(data.b),
      volume: parseFloat(data.v),
      high24h: parseFloat(data.h),
      low24h: parseFloat(data.l),
      change24h: parseFloat(data.P),
      timestamp: new Date(data.E),
    };
  }

  private parseWsOrderBook(data: any): OrderBook {
    return {
      bids: data.b.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: data.a.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: new Date(data.E),
      exchange: this.name,
      symbol: this.getSymbolFromMarketId(data.s),
    };
  }

  private parseWsTrade(data: any): Trade {
    return {
      id: data.t.toString(),
      symbol: this.getSymbolFromMarketId(data.s),
      side: data.m ? 'sell' : 'buy',
      amount: parseFloat(data.q),
      price: parseFloat(data.p),
      cost: parseFloat(data.q) * parseFloat(data.p),
      fee: 0,
      timestamp: new Date(data.T),
    };
  }

  private parseWsOHLCV(data: any): OHLCV {
    const k = data.k;
    return {
      timestamp: new Date(k.t),
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
    };
  }
}
