/**
 * K.I.T. Trading Tools
 * 
 * Tools available to the AI agent for trading operations
 * Supports: Crypto, Forex, Stocks via Alpha Vantage + Twelve Data + Binance
 */

import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';
import { signalCopierTools } from './signal-copier-tools';
import { getSkillToolDefinitions, getSkillToolHandlers } from './skill-tools';
import * as marketData from '../services/market-data';

// ============================================================================
// Tool Definitions (for LLM)
// ============================================================================

export const TRADING_TOOLS: ChatToolDef[] = [
  {
    name: 'get_portfolio',
    description: 'Get the current portfolio overview including total value, positions, and P&L',
    parameters: {
      type: 'object',
      properties: {
        exchange: {
          type: 'string',
          description: 'Specific exchange to query (optional, defaults to all)',
        },
      },
    },
  },
  {
    name: 'get_market_price',
    description: 'Get the current price for a trading pair',
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol (e.g., BTC/USDT, EURUSD)',
        },
        exchange: {
          type: 'string',
          description: 'Exchange to query (optional)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'analyze_market',
    description: 'Perform technical analysis on a trading pair. Returns trend, RSI, MACD, support/resistance levels, and a trading signal.',
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol (e.g., BTC/USDT)',
        },
        timeframe: {
          type: 'string',
          description: 'Timeframe for analysis (1m, 5m, 15m, 1h, 4h, 1d)',
          default: '1h',
        },
        indicators: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific indicators to include (rsi, macd, bollinger, ma, volume)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_open_positions',
    description: 'Get all currently open trading positions',
    parameters: {
      type: 'object',
      properties: {
        exchange: {
          type: 'string',
          description: 'Filter by exchange (optional)',
        },
        symbol: {
          type: 'string',
          description: 'Filter by symbol (optional)',
        },
      },
    },
  },
  {
    name: 'place_order',
    description: 'Place a new trading order. REQUIRES USER CONFIRMATION in manual mode.',
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        side: {
          type: 'string',
          enum: ['buy', 'sell'],
          description: 'Order side',
        },
        type: {
          type: 'string',
          enum: ['market', 'limit', 'stop', 'stop_limit'],
          description: 'Order type',
        },
        amount: {
          type: 'number',
          description: 'Order amount in base currency or quote currency (for market orders)',
        },
        price: {
          type: 'number',
          description: 'Limit price (required for limit orders)',
        },
        stopPrice: {
          type: 'number',
          description: 'Stop trigger price (for stop orders)',
        },
        stopLoss: {
          type: 'number',
          description: 'Stop loss price',
        },
        takeProfit: {
          type: 'number',
          description: 'Take profit price',
        },
        exchange: {
          type: 'string',
          description: 'Exchange to use',
        },
      },
      required: ['symbol', 'side', 'type', 'amount'],
    },
  },
  {
    name: 'close_position',
    description: 'Close an existing trading position',
    parameters: {
      type: 'object',
      properties: {
        positionId: {
          type: 'string',
          description: 'Position ID to close',
        },
        symbol: {
          type: 'string',
          description: 'Symbol to close position for',
        },
        percentage: {
          type: 'number',
          description: 'Percentage of position to close (1-100)',
          default: 100,
        },
      },
    },
  },
  {
    name: 'set_alert',
    description: 'Set a price or indicator alert',
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        type: {
          type: 'string',
          enum: ['price_above', 'price_below', 'rsi_above', 'rsi_below', 'macd_cross'],
          description: 'Alert type',
        },
        value: {
          type: 'number',
          description: 'Trigger value',
        },
        message: {
          type: 'string',
          description: 'Custom alert message',
        },
      },
      required: ['symbol', 'type', 'value'],
    },
  },
  {
    name: 'get_trade_history',
    description: 'Get historical trades',
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Filter by symbol (optional)',
        },
        since: {
          type: 'string',
          description: 'Start date (ISO string or relative like "24h", "7d")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of trades to return',
          default: 50,
        },
      },
    },
  },
  {
    name: 'backtest_strategy',
    description: 'Backtest a trading strategy on historical data',
    parameters: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          description: 'Strategy name (ma_cross, rsi_oversold, macd_signal, etc.)',
        },
        symbol: {
          type: 'string',
          description: 'Trading pair to backtest',
        },
        startDate: {
          type: 'string',
          description: 'Backtest start date',
        },
        endDate: {
          type: 'string',
          description: 'Backtest end date',
        },
        params: {
          type: 'object',
          description: 'Strategy-specific parameters',
        },
      },
      required: ['strategy', 'symbol'],
    },
  },
  {
    name: 'get_news',
    description: 'Get recent news and events for a symbol or general market',
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol to get news for (optional)',
        },
        category: {
          type: 'string',
          enum: ['crypto', 'forex', 'stocks', 'macro', 'all'],
          description: 'News category',
        },
        limit: {
          type: 'number',
          description: 'Number of news items',
          default: 10,
        },
      },
    },
  },
  {
    name: 'get_market_overview',
    description: 'Get overview of all markets: top crypto, forex pairs, and stocks with prices and changes',
    parameters: {
      type: 'object',
      properties: {
        markets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Markets to include: crypto, forex, stocks. Default: all',
        },
      },
    },
  },
  {
    name: 'configure_market_data',
    description: 'Configure API keys for market data. Alpha Vantage (stocks/forex) and Twelve Data (backup, 800 calls/day).',
    parameters: {
      type: 'object',
      properties: {
        alphaVantageKey: {
          type: 'string',
          description: 'Alpha Vantage API key (free at alphavantage.co)',
        },
        twelveDataKey: {
          type: 'string',
          description: 'Twelve Data API key (free at twelvedata.com)',
        },
      },
    },
  },
  
  // ========================================================================
  // Signal Copier Tools - Copy signals from Telegram/Discord channels
  // ========================================================================
  {
    name: 'signal_copier_add_channel',
    description: 'Add a Telegram channel or group to copy trading signals from. User just says the channel name, K.I.T. handles everything automatically.',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Telegram channel/group name or link (e.g., @CryptoSignals, t.me/ForexVIP)',
        },
        markets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Markets to copy: crypto, forex, binary, stocks. Default: all',
        },
        autoExecute: {
          type: 'boolean',
          description: 'Auto-execute signals without confirmation. Default: true',
        },
      },
      required: ['channel'],
    },
  },
  {
    name: 'signal_copier_remove_channel',
    description: 'Stop copying signals from a Telegram channel',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel name to remove',
        },
      },
      required: ['channel'],
    },
  },
  {
    name: 'signal_copier_list',
    description: 'List all Telegram channels being monitored for trading signals',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'signal_copier_pause',
    description: 'Pause signal copying for a channel or all channels',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel to pause, or "all" for all channels',
        },
      },
      required: ['channel'],
    },
  },
  {
    name: 'signal_copier_resume',
    description: 'Resume signal copying for a channel or all channels',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel to resume, or "all" for all channels',
        },
      },
      required: ['channel'],
    },
  },
  {
    name: 'signal_copier_settings',
    description: 'Update signal copier settings like risk per trade, max trades, confirmation mode',
    parameters: {
      type: 'object',
      properties: {
        maxRiskPerTrade: {
          type: 'number',
          description: 'Max risk per trade in % (e.g., 2 for 2%)',
        },
        maxTradesPerDay: {
          type: 'number',
          description: 'Max trades per day',
        },
        requireConfirmation: {
          type: 'boolean',
          description: 'Require confirmation before executing signals',
        },
        cryptoExchange: {
          type: 'string',
          description: 'Exchange for crypto trades (binance, kraken, etc.)',
        },
        forexPlatform: {
          type: 'string',
          description: 'Platform for forex trades (mt5, mt4)',
        },
        binaryPlatform: {
          type: 'string',
          description: 'Platform for binary options (binaryfaster, etc.)',
        },
      },
    },
  },
  {
    name: 'signal_copier_stats',
    description: 'Get signal copier statistics - signals received, executed, win rate',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel to get stats for, or omit for all channels',
        },
      },
    },
  },
];

// ============================================================================
// Tool Result Types
// ============================================================================

export interface PortfolioResult {
  totalValue: number;
  currency: string;
  positions: PositionInfo[];
  pnl: {
    daily: number;
    dailyPercent: number;
    total: number;
    totalPercent: number;
  };
  allocation: Array<{
    symbol: string;
    value: number;
    percent: number;
  }>;
}

export interface PositionInfo {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  exchange: string;
}

export interface MarketAnalysis {
  symbol: string;
  timeframe: string;
  price: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  indicators: {
    rsi?: { value: number; signal: string };
    macd?: { macd: number; signal: number; histogram: number; crossover: string };
    bollinger?: { upper: number; middle: number; lower: number; position: string };
    ma?: { sma20: number; sma50: number; ema12: number; ema26: number };
    volume?: { current: number; avg: number; trend: string };
  };
  support: number[];
  resistance: number[];
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  confidence: number; // 0-100
  analysis: string; // Natural language summary
}

export interface OrderResult {
  orderId: string;
  status: 'pending' | 'filled' | 'partial' | 'rejected' | 'cancelled';
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  amount: number;
  price?: number;
  filled: number;
  remaining: number;
  avgFillPrice?: number;
  fee?: number;
  timestamp: Date;
}

export interface BacktestResult {
  strategy: string;
  symbol: string;
  period: { start: Date; end: Date };
  performance: {
    totalReturn: number;
    totalReturnPercent: number;
    buyAndHold: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    profitFactor: number;
  };
  trades: {
    total: number;
    won: number;
    lost: number;
    avgWin: number;
    avgLoss: number;
  };
  equity: Array<{ date: Date; value: number }>;
}

// ============================================================================
// Mock Tool Handlers (replace with real implementations)
// ============================================================================

export const MOCK_TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  get_portfolio: async () => ({
    totalValue: 45231.50,
    currency: 'USD',
    positions: [
      { id: 'pos_1', symbol: 'BTC/USDT', side: 'long', amount: 0.5, entryPrice: 65000, currentPrice: 67500, pnl: 1250, pnlPercent: 3.85, exchange: 'binance' },
      { id: 'pos_2', symbol: 'ETH/USDT', side: 'long', amount: 2.5, entryPrice: 3400, currentPrice: 3500, pnl: 250, pnlPercent: 2.94, exchange: 'binance' },
    ],
    pnl: { daily: 856.32, dailyPercent: 1.93, total: 5231.50, totalPercent: 13.08 },
    allocation: [
      { symbol: 'BTC', value: 33750, percent: 74.6 },
      { symbol: 'ETH', value: 8750, percent: 19.3 },
      { symbol: 'USDT', value: 2731.50, percent: 6.1 },
    ],
  }),

  get_market_price: async (args) => {
    // Use Multi-Asset Market Data Service (supports Crypto, Forex, Stocks)
    const symbol = String(args.symbol || 'BTC/USDT');
    const quote = await marketData.getQuote(symbol);
    
    return {
      symbol: quote.symbol,
      assetClass: quote.assetClass,
      price: quote.price,
      change24h: quote.changePercent,
      high24h: quote.high,
      low24h: quote.low,
      open: quote.open,
      previousClose: quote.previousClose,
      volume24h: quote.volume,
      timestamp: quote.timestamp,
      source: quote.source,
    };
  },

  analyze_market: async (args) => {
    // Use Multi-Asset Market Data Service (supports Crypto, Forex, Stocks)
    const symbol = String(args.symbol || 'BTC/USDT');
    const timeframe = String(args.timeframe || '1h');
    
    const analysis = await marketData.analyzeMarket(symbol, timeframe);
    
    return {
      symbol: analysis.quote.symbol,
      assetClass: analysis.quote.assetClass,
      timeframe,
      price: analysis.quote.price,
      change24h: analysis.quote.changePercent,
      trend: analysis.trend,
      strength: analysis.strength,
      indicators: {
        rsi: { value: analysis.indicators.rsi, signal: analysis.indicators.rsiSignal },
        macd: { 
          value: analysis.indicators.macd.value,
          signal: analysis.indicators.macd.signal,
          histogram: analysis.indicators.macd.histogram, 
          crossover: analysis.indicators.macdCrossover 
        },
        bollinger: { 
          upper: analysis.indicators.bollingerUpper, 
          middle: analysis.indicators.bollingerMiddle, 
          lower: analysis.indicators.bollingerLower 
        },
        ma: { 
          sma20: analysis.indicators.sma20, 
          sma50: analysis.indicators.sma50, 
          ema12: analysis.indicators.ema12, 
          ema26: analysis.indicators.ema26 
        },
        atr: analysis.indicators.atr,
        adx: analysis.indicators.adx,
      },
      support: analysis.support,
      resistance: analysis.resistance,
      signal: analysis.signal,
      confidence: analysis.confidence,
      analysis: analysis.analysis,
      source: analysis.quote.source,
    };
  },

  get_open_positions: async () => ([
    { id: 'pos_1', symbol: 'BTC/USDT', side: 'long', amount: 0.5, entryPrice: 65000, currentPrice: 67500, pnl: 1250, pnlPercent: 3.85, exchange: 'binance' },
    { id: 'pos_2', symbol: 'ETH/USDT', side: 'long', amount: 2.5, entryPrice: 3400, currentPrice: 3500, pnl: 250, pnlPercent: 2.94, exchange: 'binance' },
  ]),

  place_order: async (args) => ({
    orderId: `ord_${Date.now()}`,
    status: 'pending',
    symbol: args.symbol,
    side: args.side,
    type: args.type,
    amount: args.amount,
    price: args.price,
    filled: 0,
    remaining: args.amount,
    timestamp: new Date(),
    message: '⚠️ DEMO MODE: Order would be placed in live trading',
  }),

  close_position: async (args) => ({
    success: true,
    positionId: args.positionId,
    closedAmount: args.percentage ? `${args.percentage}%` : '100%',
    realizedPnl: 1250,
    message: '⚠️ DEMO MODE: Position would be closed in live trading',
  }),

  set_alert: async (args) => ({
    alertId: `alert_${Date.now()}`,
    symbol: args.symbol,
    type: args.type,
    value: args.value,
    status: 'active',
    created: new Date().toISOString(),
  }),

  get_trade_history: async () => ([
    { id: 'trade_1', symbol: 'BTC/USDT', side: 'buy', amount: 0.5, price: 65000, total: 32500, fee: 32.50, timestamp: '2025-02-08T14:30:00Z' },
    { id: 'trade_2', symbol: 'ETH/USDT', side: 'buy', amount: 2.5, price: 3400, total: 8500, fee: 8.50, timestamp: '2025-02-07T09:15:00Z' },
  ]),

  backtest_strategy: async (args) => ({
    strategy: args.strategy,
    symbol: args.symbol,
    period: { start: '2025-01-01', end: '2025-02-09' },
    performance: {
      totalReturn: 2856.32,
      totalReturnPercent: 28.5,
      buyAndHold: 45.2,
      maxDrawdown: -12.3,
      sharpeRatio: 1.85,
      winRate: 62,
      profitFactor: 1.8,
    },
    trades: { total: 48, won: 30, lost: 18, avgWin: 156, avgLoss: 89 },
    summary: `Strategy '${args.strategy}' on ${args.symbol} achieved 28.5% return vs 45.2% buy & hold. Win rate of 62% with 1.85 Sharpe ratio.`,
  }),

  get_news: async (args) => ([
    { title: 'Bitcoin Breaks $95,000 - New ATH In Sight', source: 'CoinDesk', sentiment: 'bullish', timestamp: new Date().toISOString() },
    { title: 'Fed Maintains Interest Rates', source: 'Reuters', sentiment: 'neutral', timestamp: new Date().toISOString() },
    { title: `${args.symbol || 'Markets'} Show Strong Momentum`, source: 'Bloomberg', sentiment: 'bullish', timestamp: new Date().toISOString() },
  ]),

  get_market_overview: async (args) => {
    // Use Multi-Asset Market Data Service
    const overview = await marketData.getMarketOverview();
    
    const formatQuote = (q: marketData.MarketQuote) => ({
      symbol: q.symbol,
      price: q.price,
      change: q.changePercent,
      changeFormatted: `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`,
      source: q.source,
    });
    
    const markets = (args.markets as string[]) || ['crypto', 'forex', 'stocks'];
    
    return {
      timestamp: overview.timestamp,
      markets: {
        crypto: markets.includes('crypto') ? overview.crypto.map(formatQuote) : [],
        forex: markets.includes('forex') ? overview.forex.map(formatQuote) : [],
        stocks: markets.includes('stocks') ? overview.stocks.map(formatQuote) : [],
      },
      summary: `Marktübersicht: ${overview.crypto.length} Crypto, ${overview.forex.length} Forex, ${overview.stocks.length} Aktien`,
    };
  },

  configure_market_data: async (args) => {
    const keys: { alphaVantage?: string; twelveData?: string } = {};
    
    if (args.alphaVantageKey) {
      keys.alphaVantage = String(args.alphaVantageKey);
    }
    if (args.twelveDataKey) {
      keys.twelveData = String(args.twelveDataKey);
    }
    
    marketData.setApiKeys(keys);
    
    const currentKeys = marketData.getApiKeys();
    
    return {
      success: true,
      configured: {
        alphaVantage: currentKeys.alphaVantage ? '✅ Configured' : '❌ Not set',
        twelveData: currentKeys.twelveData ? '✅ Configured' : '❌ Not set',
        binance: '✅ Always available (no key needed)',
      },
      message: 'Market data API keys updated. Stocks & Forex now supported!',
    };
  },
  
  // Signal Copier Handlers (connected to real implementation)
  ...Object.fromEntries(
    signalCopierTools.map(tool => [tool.name, tool.handler])
  ),
};

// ============================================================================
// Export
// ============================================================================

export function getTradingTools(): ChatToolDef[] {
  // Combine base trading tools + all skill tools
  return [...TRADING_TOOLS, ...getSkillToolDefinitions()];
}

export function getMockHandlers(): Record<string, (args: Record<string, unknown>) => Promise<unknown>> {
  // Combine mock handlers + real skill handlers
  return { ...MOCK_TOOL_HANDLERS, ...getSkillToolHandlers() };
}
