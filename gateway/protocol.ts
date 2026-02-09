/**
 * K.I.T. Gateway Protocol
 * 
 * Message types and protocol definitions for Gateway communication.
 * Inspired by OpenClaw's Gateway protocol.
 */

// Base message types
export type MessageType = 'req' | 'res' | 'event';

export interface BaseMessage {
  type: MessageType;
}

// Request message
export interface Request extends BaseMessage {
  type: 'req';
  id: string;
  method: string;
  params?: any;
}

// Response message
export interface Response extends BaseMessage {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
    retryable?: boolean;
    retryAfterMs?: number;
  };
}

// Event message
export interface Event extends BaseMessage {
  type: 'event';
  event: string;
  payload?: any;
  seq?: number;
  stateVersion?: number;
}

// Connect request params
export interface ConnectParams {
  minProtocol?: number;
  maxProtocol?: number;
  client: {
    id: string;
    displayName?: string;
    version: string;
    platform?: string;
    mode?: string;
  };
  auth?: {
    token?: string;
    password?: string;
  };
}

// Connect response (hello-ok)
export interface HelloOk {
  type: 'hello-ok';
  clientId: string;
  version: string;
  skills: SkillInfo[];
  tools: ToolInfo[];
  snapshot?: {
    health: any;
    exchanges: any;
  };
}

// Skill info
export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'loaded' | 'error' | 'disabled';
}

// Tool info
export interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, ParameterSchema>;
}

export interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  optional?: boolean;
  default?: any;
  enum?: any[];
}

// Trading-specific protocol messages

// Trade request
export interface TradeRequest {
  action: 'buy' | 'sell';
  pair: string;
  amount: number;
  type: 'market' | 'limit' | 'stop-limit';
  price?: number;
  stopPrice?: number;
  exchange?: string;
  // Risk management
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
}

// Trade response
export interface TradeResponse {
  orderId: string;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  pair: string;
  side: 'buy' | 'sell';
  type: string;
  amount: number;
  filledAmount: number;
  price: number;
  avgPrice?: number;
  fee?: number;
  timestamp: string;
}

// Market data request
export interface MarketDataRequest {
  action: 'price' | 'ohlcv' | 'orderbook' | 'ticker' | 'trades' | 'analyze';
  pair: string;
  exchange?: string;
  timeframe?: string;
  limit?: number;
}

// Portfolio request
export interface PortfolioRequest {
  action: 'snapshot' | 'balance' | 'positions' | 'pnl' | 'history';
  exchange?: string;
  asset?: string;
  period?: string;
}

// Portfolio snapshot response
export interface PortfolioSnapshot {
  timestamp: string;
  totalValueUsd: number;
  totalValueBtc: number;
  assets: AssetBalance[];
  positions: Position[];
  change24h: number;
  change7d: number;
}

export interface AssetBalance {
  symbol: string;
  free: number;
  locked: number;
  total: number;
  valueUsd: number;
  allocation: number;
  exchange: string;
}

export interface Position {
  id: string;
  pair: string;
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  exchange: string;
  openedAt: string;
}

// Backtest request
export interface BacktestRequest {
  strategy: string;
  pair: string;
  timeframe: string;
  start: string;
  end: string;
  initialCapital?: number;
  fees?: {
    maker: number;
    taker: number;
  };
  slippage?: number;
}

// Backtest result
export interface BacktestResult {
  strategy: string;
  pair: string;
  period: {
    start: string;
    end: string;
  };
  metrics: {
    totalReturn: number;
    totalReturnPercent: number;
    buyAndHold: number;
    alpha: number;
    maxDrawdown: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
  };
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
}

export interface BacktestTrade {
  id: number;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  timestamp: string;
  pnl?: number;
  pnlPercent?: number;
  signal?: string;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  drawdown: number;
}

// Alert types
export interface Alert {
  id: string;
  type: 'price' | 'indicator' | 'portfolio' | 'news';
  asset?: string;
  condition: string;
  value: number;
  triggered: boolean;
  createdAt: string;
  triggeredAt?: string;
}

// Event types
export type GatewayEvent =
  | 'trade:executed'
  | 'trade:cancelled'
  | 'position:opened'
  | 'position:closed'
  | 'alert:triggered'
  | 'market:price'
  | 'market:candle'
  | 'backtest:progress'
  | 'backtest:complete'
  | 'exchange:connected'
  | 'exchange:disconnected'
  | 'shutdown';

// Protocol constants
export const Protocol = {
  VERSION: 1,
  MIN_VERSION: 1,
  MAX_VERSION: 1,
  
  // Error codes
  ERROR_CODES: {
    INVALID_REQUEST: 'INVALID_REQUEST',
    AUTH_FAILED: 'AUTH_FAILED',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMITED: 'RATE_LIMITED',
    EXCHANGE_ERROR: 'EXCHANGE_ERROR',
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    INVALID_ORDER: 'INVALID_ORDER',
    RISK_LIMIT_EXCEEDED: 'RISK_LIMIT_EXCEEDED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  
  // Default ports
  DEFAULT_PORT: 18800,
  
  // Timeouts
  CONNECT_TIMEOUT_MS: 10000,
  REQUEST_TIMEOUT_MS: 30000,
  HEARTBEAT_INTERVAL_MS: 30000,
};
