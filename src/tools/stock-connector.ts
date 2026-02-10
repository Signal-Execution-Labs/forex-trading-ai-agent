/**
 * K.I.T. Stock Connector - Alpaca & Interactive Brokers Integration
 * Issue #11: Stock trading support for US and global markets
 */

// ============================================================
// TYPES
// ============================================================

export type StockBroker = 'alpaca' | 'ibkr' | 'tradier' | 'robinhood';

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
export type OrderSide = 'buy' | 'sell';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok' | 'opg' | 'cls';
export type AssetClass = 'us_equity' | 'crypto' | 'option' | 'forex';

export interface StockQuote {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  eps?: number;
  dividend?: number;
  dividendYield?: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  timestamp: Date;
}

export interface StockPosition {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  side: 'long' | 'short';
  assetClass: AssetClass;
}

export interface StockOrder {
  id: string;
  clientOrderId: string;
  symbol: string;
  qty: number;
  filledQty: number;
  side: OrderSide;
  type: OrderType;
  timeInForce: TimeInForce;
  limitPrice?: number;
  stopPrice?: number;
  trailPercent?: number;
  status: 'new' | 'partially_filled' | 'filled' | 'canceled' | 'expired' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  filledAvgPrice?: number;
}

export interface AccountInfo {
  id: string;
  status: 'active' | 'inactive' | 'suspended';
  currency: string;
  cash: number;
  portfolioValue: number;
  buyingPower: number;
  daytradeCount: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
  transfersBlocked: boolean;
  accountBlocked: boolean;
}

export interface StockConnectorConfig {
  broker: StockBroker;
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
  paper?: boolean;  // Paper trading (simulation)
}

// ============================================================
// ALPACA CLIENT
// ============================================================

export class AlpacaClient {
  private config: StockConnectorConfig;
  private baseUrl: string;

  constructor(config: StockConnectorConfig) {
    this.config = config;
    this.baseUrl = config.paper
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH' = 'GET',
    body?: object
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'APCA-API-KEY-ID': this.config.apiKey,
      'APCA-API-SECRET-KEY': this.config.apiSecret,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Alpaca API Error: ${response.status} - ${JSON.stringify(error)}`);
    }

    return response.json() as Promise<T>;
  }

  // --------------------------------------------------------
  // Account
  // --------------------------------------------------------

  async getAccount(): Promise<AccountInfo> {
    const data = await this.request<any>('/v2/account');
    return {
      id: data.id,
      status: data.status,
      currency: data.currency,
      cash: parseFloat(data.cash),
      portfolioValue: parseFloat(data.portfolio_value),
      buyingPower: parseFloat(data.buying_power),
      daytradeCount: data.daytrade_count,
      patternDayTrader: data.pattern_day_trader,
      tradingBlocked: data.trading_blocked,
      transfersBlocked: data.transfers_blocked,
      accountBlocked: data.account_blocked,
    };
  }

  // --------------------------------------------------------
  // Positions
  // --------------------------------------------------------

  async getPositions(): Promise<StockPosition[]> {
    const data = await this.request<any[]>('/v2/positions');
    return data.map(p => ({
      symbol: p.symbol,
      qty: parseFloat(p.qty),
      avgEntryPrice: parseFloat(p.avg_entry_price),
      currentPrice: parseFloat(p.current_price),
      marketValue: parseFloat(p.market_value),
      costBasis: parseFloat(p.cost_basis),
      unrealizedPL: parseFloat(p.unrealized_pl),
      unrealizedPLPercent: parseFloat(p.unrealized_plpc) * 100,
      side: parseFloat(p.qty) >= 0 ? 'long' : 'short',
      assetClass: p.asset_class,
    }));
  }

  async getPosition(symbol: string): Promise<StockPosition | null> {
    try {
      const data = await this.request<any>(`/v2/positions/${symbol}`);
      return {
        symbol: data.symbol,
        qty: parseFloat(data.qty),
        avgEntryPrice: parseFloat(data.avg_entry_price),
        currentPrice: parseFloat(data.current_price),
        marketValue: parseFloat(data.market_value),
        costBasis: parseFloat(data.cost_basis),
        unrealizedPL: parseFloat(data.unrealized_pl),
        unrealizedPLPercent: parseFloat(data.unrealized_plpc) * 100,
        side: parseFloat(data.qty) >= 0 ? 'long' : 'short',
        assetClass: data.asset_class,
      };
    } catch {
      return null;
    }
  }

  async closePosition(symbol: string, qty?: number, percentageClose?: number): Promise<StockOrder> {
    let endpoint = `/v2/positions/${symbol}`;
    const params: string[] = [];
    
    if (qty) params.push(`qty=${qty}`);
    if (percentageClose) params.push(`percentage=${percentageClose / 100}`);
    
    if (params.length > 0) {
      endpoint += `?${params.join('&')}`;
    }
    
    return this.request<StockOrder>(endpoint, 'DELETE');
  }

  async closeAllPositions(cancelOrders: boolean = true): Promise<void> {
    await this.request(`/v2/positions?cancel_orders=${cancelOrders}`, 'DELETE');
  }

  // --------------------------------------------------------
  // Orders
  // --------------------------------------------------------

  async getOrders(status: 'open' | 'closed' | 'all' = 'open', limit: number = 50): Promise<StockOrder[]> {
    const data = await this.request<any[]>(`/v2/orders?status=${status}&limit=${limit}`);
    return data.map(o => this.mapOrder(o));
  }

  async getOrder(orderId: string): Promise<StockOrder> {
    const data = await this.request<any>(`/v2/orders/${orderId}`);
    return this.mapOrder(data);
  }

  async submitOrder(params: {
    symbol: string;
    qty: number;
    side: OrderSide;
    type: OrderType;
    timeInForce?: TimeInForce;
    limitPrice?: number;
    stopPrice?: number;
    trailPercent?: number;
    extendedHours?: boolean;
    clientOrderId?: string;
  }): Promise<StockOrder> {
    const body: any = {
      symbol: params.symbol,
      qty: params.qty.toString(),
      side: params.side,
      type: params.type,
      time_in_force: params.timeInForce || 'day',
    };

    if (params.limitPrice) body.limit_price = params.limitPrice.toString();
    if (params.stopPrice) body.stop_price = params.stopPrice.toString();
    if (params.trailPercent) body.trail_percent = params.trailPercent.toString();
    if (params.extendedHours) body.extended_hours = true;
    if (params.clientOrderId) body.client_order_id = params.clientOrderId;

    const data = await this.request<any>('/v2/orders', 'POST', body);
    return this.mapOrder(data);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request(`/v2/orders/${orderId}`, 'DELETE');
  }

  async cancelAllOrders(): Promise<void> {
    await this.request('/v2/orders', 'DELETE');
  }

  // --------------------------------------------------------
  // Market Data
  // --------------------------------------------------------

  async getLatestQuote(symbol: string): Promise<StockQuote> {
    const data = await this.request<any>(`/v2/stocks/${symbol}/quotes/latest`);
    const quote = data.quote;
    
    // Get additional trade data
    const tradeData = await this.request<any>(`/v2/stocks/${symbol}/trades/latest`);
    const trade = tradeData.trade;
    
    return {
      symbol,
      name: symbol,  // Alpaca doesn't provide name in quote
      exchange: quote.ax,
      price: trade.p,
      change: 0,  // Need historical data to calculate
      changePercent: 0,
      open: 0,
      high: 0,
      low: 0,
      close: trade.p,
      volume: 0,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
      timestamp: new Date(trade.t),
    };
  }

  async getBars(
    symbol: string,
    timeframe: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day' = '1Day',
    start?: Date,
    end?: Date,
    limit: number = 100
  ): Promise<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }[]> {
    let endpoint = `/v2/stocks/${symbol}/bars?timeframe=${timeframe}&limit=${limit}`;
    if (start) endpoint += `&start=${start.toISOString()}`;
    if (end) endpoint += `&end=${end.toISOString()}`;

    const data = await this.request<any>(endpoint);
    return data.bars.map((bar: any) => ({
      timestamp: new Date(bar.t),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    }));
  }

  // --------------------------------------------------------
  // Assets
  // --------------------------------------------------------

  async getAssets(status: 'active' | 'inactive' = 'active', assetClass: AssetClass = 'us_equity'): Promise<{
    symbol: string;
    name: string;
    exchange: string;
    tradable: boolean;
    fractionable: boolean;
    marginable: boolean;
    shortable: boolean;
  }[]> {
    const data = await this.request<any[]>(`/v2/assets?status=${status}&asset_class=${assetClass}`);
    return data.map(a => ({
      symbol: a.symbol,
      name: a.name,
      exchange: a.exchange,
      tradable: a.tradable,
      fractionable: a.fractionable,
      marginable: a.marginable,
      shortable: a.shortable,
    }));
  }

  async isMarketOpen(): Promise<{ isOpen: boolean; nextOpen: Date; nextClose: Date }> {
    const data = await this.request<any>('/v2/clock');
    return {
      isOpen: data.is_open,
      nextOpen: new Date(data.next_open),
      nextClose: new Date(data.next_close),
    };
  }

  // --------------------------------------------------------
  // Helpers
  // --------------------------------------------------------

  private mapOrder(data: any): StockOrder {
    return {
      id: data.id,
      clientOrderId: data.client_order_id,
      symbol: data.symbol,
      qty: parseFloat(data.qty),
      filledQty: parseFloat(data.filled_qty),
      side: data.side,
      type: data.type,
      timeInForce: data.time_in_force,
      limitPrice: data.limit_price ? parseFloat(data.limit_price) : undefined,
      stopPrice: data.stop_price ? parseFloat(data.stop_price) : undefined,
      trailPercent: data.trail_percent ? parseFloat(data.trail_percent) : undefined,
      status: data.status,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      filledAt: data.filled_at ? new Date(data.filled_at) : undefined,
      filledAvgPrice: data.filled_avg_price ? parseFloat(data.filled_avg_price) : undefined,
    };
  }
}

// ============================================================
// STOCK CONNECTOR (High-level interface)
// ============================================================

export class StockConnector {
  private client: AlpacaClient | null = null;
  private config: StockConnectorConfig | null = null;

  async connect(config: StockConnectorConfig): Promise<void> {
    this.config = config;
    
    switch (config.broker) {
      case 'alpaca':
        this.client = new AlpacaClient(config);
        break;
      case 'ibkr':
        throw new Error('Interactive Brokers integration coming soon!');
      default:
        throw new Error(`Unsupported broker: ${config.broker}`);
    }

    // Verify connection
    const account = await this.getAccount();
    console.log(`✅ Connected to ${config.broker} (${config.paper ? 'Paper' : 'Live'})`);
    console.log(`   Account: ${account.id}`);
    console.log(`   Portfolio Value: $${account.portfolioValue.toLocaleString()}`);
  }

  private ensureConnected(): void {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }
  }

  // --------------------------------------------------------
  // Account & Portfolio
  // --------------------------------------------------------

  async getAccount(): Promise<AccountInfo> {
    this.ensureConnected();
    return this.client!.getAccount();
  }

  async getPortfolio(): Promise<{
    account: AccountInfo;
    positions: StockPosition[];
    totalPL: number;
    totalPLPercent: number;
  }> {
    this.ensureConnected();
    
    const [account, positions] = await Promise.all([
      this.client!.getAccount(),
      this.client!.getPositions(),
    ]);

    const totalPL = positions.reduce((sum, p) => sum + p.unrealizedPL, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.costBasis, 0);
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

    return {
      account,
      positions,
      totalPL,
      totalPLPercent,
    };
  }

  async getPositions(): Promise<StockPosition[]> {
    this.ensureConnected();
    return this.client!.getPositions();
  }

  // --------------------------------------------------------
  // Trading
  // --------------------------------------------------------

  async buy(
    symbol: string,
    qty: number,
    options?: { type?: OrderType; limitPrice?: number; stopLoss?: number; takeProfit?: number }
  ): Promise<StockOrder> {
    this.ensureConnected();
    
    const order = await this.client!.submitOrder({
      symbol,
      qty,
      side: 'buy',
      type: options?.type || 'market',
      limitPrice: options?.limitPrice,
    });

    console.log(`📈 BUY ${qty} ${symbol} @ ${options?.type || 'market'}`);
    
    // TODO: Implement bracket orders for SL/TP
    
    return order;
  }

  async sell(
    symbol: string,
    qty: number,
    options?: { type?: OrderType; limitPrice?: number }
  ): Promise<StockOrder> {
    this.ensureConnected();
    
    const order = await this.client!.submitOrder({
      symbol,
      qty,
      side: 'sell',
      type: options?.type || 'market',
      limitPrice: options?.limitPrice,
    });

    console.log(`📉 SELL ${qty} ${symbol} @ ${options?.type || 'market'}`);
    
    return order;
  }

  async closePosition(symbol: string, qty?: number): Promise<StockOrder> {
    this.ensureConnected();
    return this.client!.closePosition(symbol, qty);
  }

  async closeAllPositions(): Promise<void> {
    this.ensureConnected();
    await this.client!.closeAllPositions();
    console.log('🔴 All positions closed');
  }

  async getOrders(status: 'open' | 'closed' | 'all' = 'open'): Promise<StockOrder[]> {
    this.ensureConnected();
    return this.client!.getOrders(status);
  }

  async cancelOrder(orderId: string): Promise<void> {
    this.ensureConnected();
    await this.client!.cancelOrder(orderId);
    console.log(`❌ Order ${orderId} cancelled`);
  }

  async cancelAllOrders(): Promise<void> {
    this.ensureConnected();
    await this.client!.cancelAllOrders();
    console.log('❌ All orders cancelled');
  }

  // --------------------------------------------------------
  // Market Data
  // --------------------------------------------------------

  async getQuote(symbol: string): Promise<StockQuote> {
    this.ensureConnected();
    return this.client!.getLatestQuote(symbol);
  }

  async isMarketOpen(): Promise<boolean> {
    this.ensureConnected();
    const clock = await this.client!.isMarketOpen();
    return clock.isOpen;
  }

  // --------------------------------------------------------
  // Analysis
  // --------------------------------------------------------

  async analyzePivotPoints(symbol: string): Promise<{
    pivot: number;
    r1: number;
    r2: number;
    r3: number;
    s1: number;
    s2: number;
    s3: number;
  }> {
    this.ensureConnected();
    
    const bars = await this.client!.getBars(symbol, '1Day', undefined, undefined, 1);
    if (bars.length === 0) throw new Error('No data available');
    
    const { high, low, close } = bars[0];
    const pivot = (high + low + close) / 3;
    
    return {
      pivot,
      r1: 2 * pivot - low,
      r2: pivot + (high - low),
      r3: high + 2 * (pivot - low),
      s1: 2 * pivot - high,
      s2: pivot - (high - low),
      s3: low - 2 * (high - pivot),
    };
  }

  // --------------------------------------------------------
  // Reports
  // --------------------------------------------------------

  async generateReport(): Promise<string> {
    const portfolio = await this.getPortfolio();
    const marketOpen = await this.isMarketOpen();
    
    let report = `
📊 STOCK PORTFOLIO REPORT
${'='.repeat(60)}

ACCOUNT
${'-'.repeat(60)}
Cash:           $${portfolio.account.cash.toLocaleString()}
Portfolio:      $${portfolio.account.portfolioValue.toLocaleString()}
Buying Power:   $${portfolio.account.buyingPower.toLocaleString()}
Day Trades:     ${portfolio.account.daytradeCount}/3
Market:         ${marketOpen ? '🟢 OPEN' : '🔴 CLOSED'}

POSITIONS (${portfolio.positions.length})
${'-'.repeat(60)}
`;

    for (const pos of portfolio.positions) {
      const plColor = pos.unrealizedPL >= 0 ? '📈' : '📉';
      report += `${pos.symbol.padEnd(8)} ${pos.qty} shares @ $${pos.avgEntryPrice.toFixed(2)}`;
      report += ` | $${pos.marketValue.toLocaleString()} ${plColor} ${pos.unrealizedPLPercent >= 0 ? '+' : ''}${pos.unrealizedPLPercent.toFixed(2)}%\n`;
    }

    report += `
TOTALS
${'-'.repeat(60)}
Unrealized P&L: $${portfolio.totalPL.toFixed(2)} (${portfolio.totalPLPercent >= 0 ? '+' : ''}${portfolio.totalPLPercent.toFixed(2)}%)
`;

    return report;
  }
}

// ============================================================
// FACTORY & EXPORTS
// ============================================================

let stockConnectorInstance: StockConnector | null = null;

export function createStockConnector(): StockConnector {
  if (!stockConnectorInstance) {
    stockConnectorInstance = new StockConnector();
  }
  return stockConnectorInstance;
}

export function getStockConnector(): StockConnector {
  if (!stockConnectorInstance) {
    stockConnectorInstance = new StockConnector();
  }
  return stockConnectorInstance;
}

export default StockConnector;
