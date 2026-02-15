/**
 * Alpaca Broker Integration Skill
 * 
 * Commission-free stock, ETF, and crypto trading via Alpaca API
 * Features: Fractional shares, paper trading, real-time data, bracket orders
 * 
 * @see https://alpaca.markets/docs
 */

import { Skill, SkillContext, SkillResult } from '../types/skill.js';

interface AlpacaConfig {
  apiKey: string;
  secretKey: string;
  paperTrading: boolean;
  dataFeed: 'iex' | 'sip';
}

interface AlpacaAccount {
  id: string;
  accountNumber: string;
  status: 'ACTIVE' | 'ONBOARDING' | 'SUBMISSION_FAILED';
  currency: string;
  cash: number;
  portfolioValue: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
  transfersBlocked: boolean;
  accountBlocked: boolean;
  buyingPower: number;
  daytradeCount: number;
  daytradesRemaining: number;
  lastEquity: number;
  multiplier: number;
  shorting: boolean;
  longMarketValue: number;
  shortMarketValue: number;
  initialMargin: number;
  maintenanceMargin: number;
  lastMaintenanceMargin: number;
  sma: number;
  daytradeLimit: number;
}

interface AlpacaPosition {
  assetId: string;
  symbol: string;
  exchange: string;
  assetClass: 'us_equity' | 'crypto';
  qty: number;
  qtyAvailable: number;
  avgEntryPrice: number;
  side: 'long' | 'short';
  marketValue: number;
  costBasis: number;
  unrealizedPl: number;
  unrealizedPlpc: number;
  unrealizedIntradayPl: number;
  unrealizedIntradayPlpc: number;
  currentPrice: number;
  lastdayPrice: number;
  changeToday: number;
}

interface AlpacaOrder {
  id: string;
  clientOrderId: string;
  symbol: string;
  assetClass: 'us_equity' | 'crypto';
  qty?: number;
  notional?: number;
  filledQty: number;
  filledAvgPrice: number | null;
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
  side: 'buy' | 'sell';
  timeInForce: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
  limitPrice?: number;
  stopPrice?: number;
  trailPrice?: number;
  trailPercent?: number;
  status: 'new' | 'accepted' | 'pending_new' | 'accepted_for_bidding' | 
          'stopped' | 'rejected' | 'suspended' | 'calculated' | 
          'partially_filled' | 'filled' | 'done_for_day' | 
          'canceled' | 'expired' | 'replaced' | 'pending_cancel' | 
          'pending_replace';
  extendedHours: boolean;
  legs?: AlpacaOrder[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
  filledAt: string | null;
  expiredAt: string | null;
  canceledAt: string | null;
  failedAt: string | null;
  replacedAt: string | null;
}

interface BracketOrderParams {
  symbol: string;
  qty?: number;
  notional?: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  limitPrice?: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  stopLossLimitPrice?: number;
  timeInForce?: 'day' | 'gtc';
}

interface TrailingStopParams {
  symbol: string;
  qty?: number;
  notional?: number;
  side: 'buy' | 'sell';
  trailPrice?: number;
  trailPercent?: number;
  timeInForce?: 'day' | 'gtc';
}

interface FractionalOrderParams {
  symbol: string;
  notional: number;
  side: 'buy' | 'sell';
}

interface MarketDataBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount: number;
  vwap: number;
}

interface MarketDataQuote {
  timestamp: string;
  askPrice: number;
  askSize: number;
  askExchange: string;
  bidPrice: number;
  bidSize: number;
  bidExchange: string;
  conditions: string[];
  tape: string;
}

interface MarketDataTrade {
  timestamp: string;
  price: number;
  size: number;
  exchange: string;
  conditions: string[];
  tape: string;
}

interface NewsArticle {
  id: number;
  headline: string;
  author: string;
  source: string;
  summary: string;
  content: string;
  url: string;
  symbols: string[];
  createdAt: string;
  updatedAt: string;
}

interface WatchlistItem {
  symbol: string;
  assetId: string;
  assetClass: string;
}

interface Watchlist {
  id: string;
  accountId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assets: WatchlistItem[];
}

interface CalendarDay {
  date: string;
  open: string;
  close: string;
  session_open: string;
  session_close: string;
}

interface Clock {
  timestamp: string;
  isOpen: boolean;
  nextOpen: string;
  nextClose: string;
}

export class AlpacaBrokerSkill implements Skill {
  name = 'alpaca-broker';
  description = 'Commission-free stock, ETF & crypto trading via Alpaca API';
  version = '1.0.0';
  
  private _config: AlpacaConfig | null = null;
  private baseUrl: string = '';
  private dataUrl = 'https://data.alpaca.markets';
  
  async initialize(context: SkillContext): Promise<void> {
    this._config = context.config as AlpacaConfig;
    this.baseUrl = this._config.paperTrading 
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';
  }
  
  private getHeaders(): Record<string, string> {
    if (!this._config) throw new Error('Skill not initialized');
    return {
      'APCA-API-KEY-ID': this._config.apiKey,
      'APCA-API-SECRET-KEY': this._config.secretKey,
      'Content-Type': 'application/json',
    };
  }
  
  // ===== ACCOUNT =====
  
  async getAccount(): Promise<AlpacaAccount> {
    const response = await fetch(`${this.baseUrl}/v2/account`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  async getAccountConfigurations(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v2/account/configurations`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  async updateAccountConfigurations(config: {
    dtbpCheck?: 'entry' | 'exit' | 'both';
    noShorting?: boolean;
    suspendTrade?: boolean;
    tradeConfirmEmail?: 'all' | 'none';
    fractionalTrading?: boolean;
    maxMarginMultiplier?: number;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v2/account/configurations`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(config),
    });
    return response.json();
  }
  
  // ===== POSITIONS =====
  
  async getPositions(): Promise<AlpacaPosition[]> {
    const response = await fetch(`${this.baseUrl}/v2/positions`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  async getPosition(symbol: string): Promise<AlpacaPosition> {
    const response = await fetch(`${this.baseUrl}/v2/positions/${symbol}`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  async closePosition(symbol: string, qty?: number, percentage?: number): Promise<AlpacaOrder> {
    const params = new URLSearchParams();
    if (qty) params.append('qty', qty.toString());
    if (percentage) params.append('percentage', percentage.toString());
    
    const response = await fetch(
      `${this.baseUrl}/v2/positions/${symbol}?${params.toString()}`,
      { method: 'DELETE', headers: this.getHeaders() }
    );
    return response.json();
  }
  
  async closeAllPositions(cancelOrders = true): Promise<AlpacaOrder[]> {
    const response = await fetch(
      `${this.baseUrl}/v2/positions?cancel_orders=${cancelOrders}`,
      { method: 'DELETE', headers: this.getHeaders() }
    );
    return response.json();
  }
  
  // ===== ORDERS =====
  
  async submitOrder(params: {
    symbol: string;
    qty?: number;
    notional?: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
    timeInForce: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
    limitPrice?: number;
    stopPrice?: number;
    trailPrice?: number;
    trailPercent?: number;
    extendedHours?: boolean;
    clientOrderId?: string;
    orderClass?: 'simple' | 'bracket' | 'oco' | 'oto';
    takeProfit?: { limitPrice: number };
    stopLoss?: { stopPrice: number; limitPrice?: number };
  }): Promise<AlpacaOrder> {
    const response = await fetch(`${this.baseUrl}/v2/orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...params,
        limit_price: params.limitPrice,
        stop_price: params.stopPrice,
        trail_price: params.trailPrice,
        trail_percent: params.trailPercent,
        extended_hours: params.extendedHours,
        client_order_id: params.clientOrderId,
        order_class: params.orderClass,
        take_profit: params.takeProfit,
        stop_loss: params.stopLoss,
      }),
    });
    return response.json();
  }
  
  async submitBracketOrder(params: BracketOrderParams): Promise<AlpacaOrder> {
    return this.submitOrder({
      symbol: params.symbol,
      qty: params.qty,
      notional: params.notional,
      side: params.side,
      type: params.type,
      timeInForce: params.timeInForce || 'day',
      limitPrice: params.limitPrice,
      orderClass: 'bracket',
      takeProfit: { limitPrice: params.takeProfitPrice },
      stopLoss: {
        stopPrice: params.stopLossPrice,
        limitPrice: params.stopLossLimitPrice,
      },
    });
  }
  
  async submitTrailingStop(params: TrailingStopParams): Promise<AlpacaOrder> {
    return this.submitOrder({
      symbol: params.symbol,
      qty: params.qty,
      notional: params.notional,
      side: params.side,
      type: 'trailing_stop',
      timeInForce: params.timeInForce || 'gtc',
      trailPrice: params.trailPrice,
      trailPercent: params.trailPercent,
    });
  }
  
  async submitFractionalOrder(params: FractionalOrderParams): Promise<AlpacaOrder> {
    return this.submitOrder({
      symbol: params.symbol,
      notional: params.notional,
      side: params.side,
      type: 'market',
      timeInForce: 'day',
    });
  }
  
  async getOrders(params?: {
    status?: 'open' | 'closed' | 'all';
    limit?: number;
    after?: string;
    until?: string;
    direction?: 'asc' | 'desc';
    nested?: boolean;
    symbols?: string[];
  }): Promise<AlpacaOrder[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.after) searchParams.append('after', params.after);
    if (params?.until) searchParams.append('until', params.until);
    if (params?.direction) searchParams.append('direction', params.direction);
    if (params?.nested) searchParams.append('nested', 'true');
    if (params?.symbols) searchParams.append('symbols', params.symbols.join(','));
    
    const response = await fetch(
      `${this.baseUrl}/v2/orders?${searchParams.toString()}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }
  
  async getOrder(orderId: string): Promise<AlpacaOrder> {
    const response = await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  async cancelOrder(orderId: string): Promise<void> {
    await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }
  
  async cancelAllOrders(): Promise<{ id: string; status: number; body: any }[]> {
    const response = await fetch(`${this.baseUrl}/v2/orders`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  async replaceOrder(orderId: string, params: {
    qty?: number;
    timeInForce?: string;
    limitPrice?: number;
    stopPrice?: number;
    trailPrice?: number;
    trailPercent?: number;
    clientOrderId?: string;
  }): Promise<AlpacaOrder> {
    const response = await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({
        qty: params.qty,
        time_in_force: params.timeInForce,
        limit_price: params.limitPrice,
        stop_price: params.stopPrice,
        trail: params.trailPrice,
        trail_percent: params.trailPercent,
        client_order_id: params.clientOrderId,
      }),
    });
    return response.json();
  }
  
  // ===== MARKET DATA =====
  
  async getBars(params: {
    symbols: string[];
    timeframe: '1Min' | '5Min' | '15Min' | '30Min' | '1Hour' | '4Hour' | '1Day' | '1Week' | '1Month';
    start?: string;
    end?: string;
    limit?: number;
    adjustment?: 'raw' | 'split' | 'dividend' | 'all';
    feed?: 'iex' | 'sip';
  }): Promise<Record<string, MarketDataBar[]>> {
    const searchParams = new URLSearchParams();
    searchParams.append('symbols', params.symbols.join(','));
    searchParams.append('timeframe', params.timeframe);
    if (params.start) searchParams.append('start', params.start);
    if (params.end) searchParams.append('end', params.end);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.adjustment) searchParams.append('adjustment', params.adjustment);
    if (params.feed) searchParams.append('feed', params.feed);
    
    const response = await fetch(
      `${this.dataUrl}/v2/stocks/bars?${searchParams.toString()}`,
      { headers: this.getHeaders() }
    );
    const data = await response.json();
    return data.bars;
  }
  
  async getLatestBars(symbols: string[]): Promise<Record<string, MarketDataBar>> {
    const response = await fetch(
      `${this.dataUrl}/v2/stocks/bars/latest?symbols=${symbols.join(',')}`,
      { headers: this.getHeaders() }
    );
    const data = await response.json();
    return data.bars;
  }
  
  async getQuotes(params: {
    symbols: string[];
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<Record<string, MarketDataQuote[]>> {
    const searchParams = new URLSearchParams();
    searchParams.append('symbols', params.symbols.join(','));
    if (params.start) searchParams.append('start', params.start);
    if (params.end) searchParams.append('end', params.end);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    
    const response = await fetch(
      `${this.dataUrl}/v2/stocks/quotes?${searchParams.toString()}`,
      { headers: this.getHeaders() }
    );
    const data = await response.json();
    return data.quotes;
  }
  
  async getLatestQuotes(symbols: string[]): Promise<Record<string, MarketDataQuote>> {
    const response = await fetch(
      `${this.dataUrl}/v2/stocks/quotes/latest?symbols=${symbols.join(',')}`,
      { headers: this.getHeaders() }
    );
    const data = await response.json();
    return data.quotes;
  }
  
  async getTrades(params: {
    symbols: string[];
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<Record<string, MarketDataTrade[]>> {
    const searchParams = new URLSearchParams();
    searchParams.append('symbols', params.symbols.join(','));
    if (params.start) searchParams.append('start', params.start);
    if (params.end) searchParams.append('end', params.end);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    
    const response = await fetch(
      `${this.dataUrl}/v2/stocks/trades?${searchParams.toString()}`,
      { headers: this.getHeaders() }
    );
    const data = await response.json();
    return data.trades;
  }
  
  async getLatestTrades(symbols: string[]): Promise<Record<string, MarketDataTrade>> {
    const response = await fetch(
      `${this.dataUrl}/v2/stocks/trades/latest?symbols=${symbols.join(',')}`,
      { headers: this.getHeaders() }
    );
    const data = await response.json();
    return data.trades;
  }
  
  async getSnapshots(symbols: string[]): Promise<Record<string, {
    latestTrade: MarketDataTrade;
    latestQuote: MarketDataQuote;
    minuteBar: MarketDataBar;
    dailyBar: MarketDataBar;
    prevDailyBar: MarketDataBar;
  }>> {
    const response = await fetch(
      `${this.dataUrl}/v2/stocks/snapshots?symbols=${symbols.join(',')}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }
  
  // ===== NEWS =====
  
  async getNews(params?: {
    symbols?: string[];
    start?: string;
    end?: string;
    limit?: number;
    sort?: 'asc' | 'desc';
    includeContent?: boolean;
    excludeContentless?: boolean;
  }): Promise<NewsArticle[]> {
    const searchParams = new URLSearchParams();
    if (params?.symbols) searchParams.append('symbols', params.symbols.join(','));
    if (params?.start) searchParams.append('start', params.start);
    if (params?.end) searchParams.append('end', params.end);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.sort) searchParams.append('sort', params.sort);
    if (params?.includeContent) searchParams.append('include_content', 'true');
    if (params?.excludeContentless) searchParams.append('exclude_contentless', 'true');
    
    const response = await fetch(
      `${this.dataUrl}/v1beta1/news?${searchParams.toString()}`,
      { headers: this.getHeaders() }
    );
    const data = await response.json();
    return data.news;
  }
  
  // ===== WATCHLISTS =====
  
  async getWatchlists(): Promise<Watchlist[]> {
    const response = await fetch(`${this.baseUrl}/v2/watchlists`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  async createWatchlist(name: string, symbols?: string[]): Promise<Watchlist> {
    const response = await fetch(`${this.baseUrl}/v2/watchlists`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, symbols }),
    });
    return response.json();
  }
  
  async getWatchlist(watchlistId: string): Promise<Watchlist> {
    const response = await fetch(`${this.baseUrl}/v2/watchlists/${watchlistId}`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  async updateWatchlist(watchlistId: string, name?: string, symbols?: string[]): Promise<Watchlist> {
    const response = await fetch(`${this.baseUrl}/v2/watchlists/${watchlistId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, symbols }),
    });
    return response.json();
  }
  
  async addToWatchlist(watchlistId: string, symbol: string): Promise<Watchlist> {
    const response = await fetch(`${this.baseUrl}/v2/watchlists/${watchlistId}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ symbol }),
    });
    return response.json();
  }
  
  async deleteWatchlist(watchlistId: string): Promise<void> {
    await fetch(`${this.baseUrl}/v2/watchlists/${watchlistId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }
  
  async removeFromWatchlist(watchlistId: string, symbol: string): Promise<Watchlist> {
    const response = await fetch(`${this.baseUrl}/v2/watchlists/${watchlistId}/${symbol}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  // ===== CALENDAR & CLOCK =====
  
  async getClock(): Promise<Clock> {
    const response = await fetch(`${this.baseUrl}/v2/clock`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  async getCalendar(start?: string, end?: string): Promise<CalendarDay[]> {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    
    const response = await fetch(
      `${this.baseUrl}/v2/calendar?${params.toString()}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }
  
  // ===== ASSETS =====
  
  async getAssets(params?: {
    status?: 'active' | 'inactive';
    assetClass?: 'us_equity' | 'crypto';
    exchange?: string;
  }): Promise<any[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.assetClass) searchParams.append('asset_class', params.assetClass);
    if (params?.exchange) searchParams.append('exchange', params.exchange);
    
    const response = await fetch(
      `${this.baseUrl}/v2/assets?${searchParams.toString()}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }
  
  async getAsset(symbolOrId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v2/assets/${symbolOrId}`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }
  
  // ===== PORTFOLIO HISTORY =====
  
  async getPortfolioHistory(params?: {
    period?: '1D' | '1W' | '1M' | '3M' | '6M' | '1A' | 'all';
    timeframe?: '1Min' | '5Min' | '15Min' | '1H' | '1D';
    dateEnd?: string;
    extendedHours?: boolean;
  }): Promise<{
    timestamp: number[];
    equity: number[];
    profitLoss: number[];
    profitLossPct: number[];
    baseValue: number;
    timeframe: string;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.append('period', params.period);
    if (params?.timeframe) searchParams.append('timeframe', params.timeframe);
    if (params?.dateEnd) searchParams.append('date_end', params.dateEnd);
    if (params?.extendedHours) searchParams.append('extended_hours', 'true');
    
    const response = await fetch(
      `${this.baseUrl}/v2/account/portfolio/history?${searchParams.toString()}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }
  
  // ===== ACTIVITIES =====
  
  async getActivities(params?: {
    activityTypes?: string[];
    date?: string;
    until?: string;
    after?: string;
    direction?: 'asc' | 'desc';
    pageSize?: number;
    pageToken?: string;
  }): Promise<any[]> {
    const searchParams = new URLSearchParams();
    if (params?.activityTypes) searchParams.append('activity_types', params.activityTypes.join(','));
    if (params?.date) searchParams.append('date', params.date);
    if (params?.until) searchParams.append('until', params.until);
    if (params?.after) searchParams.append('after', params.after);
    if (params?.direction) searchParams.append('direction', params.direction);
    if (params?.pageSize) searchParams.append('page_size', params.pageSize.toString());
    if (params?.pageToken) searchParams.append('page_token', params.pageToken);
    
    const response = await fetch(
      `${this.baseUrl}/v2/account/activities?${searchParams.toString()}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }
  
  // ===== CRYPTO =====
  
  async getCryptoBars(params: {
    symbols: string[];
    timeframe: '1Min' | '5Min' | '15Min' | '30Min' | '1Hour' | '4Hour' | '1Day' | '1Week' | '1Month';
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<Record<string, MarketDataBar[]>> {
    const searchParams = new URLSearchParams();
    searchParams.append('symbols', params.symbols.join(','));
    searchParams.append('timeframe', params.timeframe);
    if (params.start) searchParams.append('start', params.start);
    if (params.end) searchParams.append('end', params.end);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    
    const response = await fetch(
      `${this.dataUrl}/v1beta3/crypto/us/bars?${searchParams.toString()}`,
      { headers: this.getHeaders() }
    );
    const data = await response.json();
    return data.bars;
  }
  
  async getCryptoLatestBars(symbols: string[]): Promise<Record<string, MarketDataBar>> {
    const response = await fetch(
      `${this.dataUrl}/v1beta3/crypto/us/latest/bars?symbols=${symbols.join(',')}`,
      { headers: this.getHeaders() }
    );
    const data = await response.json();
    return data.bars;
  }
  
  async getCryptoSnapshots(symbols: string[]): Promise<any> {
    const response = await fetch(
      `${this.dataUrl}/v1beta3/crypto/us/snapshots?symbols=${symbols.join(',')}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }
  
  // ===== SKILL INTERFACE =====
  
  async execute(context: SkillContext): Promise<SkillResult> {
    if (!context.input) {
      return { success: false, error: 'No input provided' };
    }
    const { action, params } = context.input;
    
    try {
      let result: any;
      
      switch (action) {
        // Account
        case 'getAccount':
          result = await this.getAccount();
          break;
        case 'getAccountConfig':
          result = await this.getAccountConfigurations();
          break;
        case 'updateAccountConfig':
          result = await this.updateAccountConfigurations(params);
          break;
          
        // Positions
        case 'getPositions':
          result = await this.getPositions();
          break;
        case 'getPosition':
          result = await this.getPosition(params.symbol);
          break;
        case 'closePosition':
          result = await this.closePosition(params.symbol, params.qty, params.percentage);
          break;
        case 'closeAllPositions':
          result = await this.closeAllPositions(params?.cancelOrders);
          break;
          
        // Orders
        case 'submitOrder':
          result = await this.submitOrder(params);
          break;
        case 'submitBracketOrder':
          result = await this.submitBracketOrder(params);
          break;
        case 'submitTrailingStop':
          result = await this.submitTrailingStop(params);
          break;
        case 'submitFractionalOrder':
          result = await this.submitFractionalOrder(params);
          break;
        case 'getOrders':
          result = await this.getOrders(params);
          break;
        case 'getOrder':
          result = await this.getOrder(params.orderId);
          break;
        case 'cancelOrder':
          await this.cancelOrder(params.orderId);
          result = { success: true };
          break;
        case 'cancelAllOrders':
          result = await this.cancelAllOrders();
          break;
        case 'replaceOrder':
          result = await this.replaceOrder(params.orderId, params);
          break;
          
        // Market Data
        case 'getBars':
          result = await this.getBars(params);
          break;
        case 'getLatestBars':
          result = await this.getLatestBars(params.symbols);
          break;
        case 'getQuotes':
          result = await this.getQuotes(params);
          break;
        case 'getLatestQuotes':
          result = await this.getLatestQuotes(params.symbols);
          break;
        case 'getTrades':
          result = await this.getTrades(params);
          break;
        case 'getLatestTrades':
          result = await this.getLatestTrades(params.symbols);
          break;
        case 'getSnapshots':
          result = await this.getSnapshots(params.symbols);
          break;
          
        // News
        case 'getNews':
          result = await this.getNews(params);
          break;
          
        // Watchlists
        case 'getWatchlists':
          result = await this.getWatchlists();
          break;
        case 'createWatchlist':
          result = await this.createWatchlist(params.name, params.symbols);
          break;
        case 'getWatchlist':
          result = await this.getWatchlist(params.watchlistId);
          break;
        case 'updateWatchlist':
          result = await this.updateWatchlist(params.watchlistId, params.name, params.symbols);
          break;
        case 'addToWatchlist':
          result = await this.addToWatchlist(params.watchlistId, params.symbol);
          break;
        case 'deleteWatchlist':
          await this.deleteWatchlist(params.watchlistId);
          result = { success: true };
          break;
          
        // Calendar & Clock
        case 'getClock':
          result = await this.getClock();
          break;
        case 'getCalendar':
          result = await this.getCalendar(params?.start, params?.end);
          break;
          
        // Assets
        case 'getAssets':
          result = await this.getAssets(params);
          break;
        case 'getAsset':
          result = await this.getAsset(params.symbol);
          break;
          
        // Portfolio
        case 'getPortfolioHistory':
          result = await this.getPortfolioHistory(params);
          break;
          
        // Activities
        case 'getActivities':
          result = await this.getActivities(params);
          break;
          
        // Crypto
        case 'getCryptoBars':
          result = await this.getCryptoBars(params);
          break;
        case 'getCryptoLatestBars':
          result = await this.getCryptoLatestBars(params.symbols);
          break;
        case 'getCryptoSnapshots':
          result = await this.getCryptoSnapshots(params.symbols);
          break;
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new AlpacaBrokerSkill();
