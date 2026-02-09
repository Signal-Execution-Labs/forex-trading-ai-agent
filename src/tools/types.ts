/**
 * K.I.T. Tool Types
 * 
 * Common type definitions for all trading tools.
 */

// Exchange Types
export interface ExchangeConfig {
  id: string;
  apiKey?: string;
  secret?: string;
  sandbox?: boolean;
  testnet?: boolean;
}

// Market Data Types
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  percentage: number;
  timestamp: number;
}

// Order Types
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop-limit' | 'stop-market';
export type OrderStatus = 'open' | 'closed' | 'canceled' | 'expired' | 'rejected';

export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  amount: number;
  price?: number;
  stopPrice?: number;
  status: OrderStatus;
  filled: number;
  remaining: number;
  cost: number;
  fee?: {
    cost: number;
    currency: string;
  };
  timestamp: number;
}

// Trade Types
export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  amount: number;
  price: number;
  cost: number;
  fee?: {
    cost: number;
    currency: string;
  };
  timestamp: number;
}

// Position Types
export interface Position {
  symbol: string;
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  leverage?: number;
  liquidationPrice?: number;
  timestamp: number;
}

// Balance Types
export interface Balance {
  currency: string;
  free: number;
  used: number;
  total: number;
}

export interface AccountBalance {
  balances: Balance[];
  totalUsd: number;
  timestamp: number;
}

// Alert Types
export type AlertType = 'price' | 'rsi' | 'macd' | 'volume' | 'portfolio' | 'custom';
export type AlertCondition = 'above' | 'below' | 'cross_above' | 'cross_below' | 'change_pct';
export type AlertStatus = 'active' | 'triggered' | 'paused' | 'expired' | 'deleted';

export interface Alert {
  id: string;
  type: AlertType;
  symbol?: string;
  condition: AlertCondition;
  value: number;
  currentValue?: number;
  status: AlertStatus;
  message?: string;
  createdAt: number;
  triggeredAt?: number;
  expiresAt?: number;
}

// Analysis Types
export interface TechnicalIndicators {
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  sma?: Record<number, number>;
  ema?: Record<number, number>;
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
  };
  atr?: number;
  adx?: number;
  obv?: number;
  volume?: number;
  volumeSma?: number;
}

export interface MarketAnalysis {
  symbol: string;
  timeframe: string;
  price: number;
  change24h: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  indicators: TechnicalIndicators;
  support: number[];
  resistance: number[];
  timestamp: number;
}

// Strategy Types
export interface StrategyConfig {
  name: string;
  description?: string;
  symbols: string[];
  timeframe: string;
  indicators: string[];
  entryRules: string[];
  exitRules: string[];
  riskManagement: RiskConfig;
}

export interface RiskConfig {
  maxPositionPct: number;
  maxDailyLossPct: number;
  defaultStopLossPct: number;
  defaultTakeProfitPct: number;
  maxOpenTrades: number;
  trailingStopPct?: number;
}

// Portfolio Types
export interface PortfolioHolding {
  symbol: string;
  amount: number;
  avgCost: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  allocation: number;
}

export interface PortfolioSnapshot {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  holdings: PortfolioHolding[];
  cash: number;
  timestamp: number;
}

// Backtest Types
export interface BacktestResult {
  strategy: string;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  trades: BacktestTrade[];
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  amount: number;
  pnl: number;
  pnlPct: number;
  reason: string;
}
