/**
 * K.I.T. Backtester Tool
 * 
 * Issue #8: Implement Backtester Tool Integration
 * 
 * Test trading strategies against historical data:
 * - Load OHLCV data from exchanges
 * - Simulate trades with strategy rules
 * - Calculate performance metrics (Sharpe, Drawdown, Win Rate)
 * - Generate detailed reports
 */

import ccxt, { Exchange } from 'ccxt';
import { EventEmitter } from 'events';
import { RSI, MACD, SMA, EMA, BollingerBands, ATR } from 'technicalindicators';
import {
  OHLCV,
  ExchangeConfig,
  BacktestResult,
  BacktestTrade,
  OrderSide,
} from './types';

const toNum = (val: number | string | undefined, def: number = 0): number => {
  if (val === undefined || val === null) return def;
  return typeof val === 'string' ? parseFloat(val) : val;
};

export interface BacktestParams {
  symbol: string;
  strategy: string | StrategyFunction;
  startDate?: string;
  endDate?: string;
  timeframe?: string;
  initialCapital?: number;
  commission?: number;
  slippage?: number;
}

export interface StrategySignal {
  action: 'buy' | 'sell' | 'hold';
  size?: number;
  stopLoss?: number;
  takeProfit?: number;
  reason?: string;
}

export type StrategyFunction = (
  data: BacktestData,
  index: number,
  position: Position | null
) => StrategySignal;

export interface BacktestData {
  ohlcv: OHLCV[];
  indicators: Record<string, number[]>;
}

export interface Position {
  side: 'long' | 'short';
  entryPrice: number;
  entryIndex: number;
  size: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface BacktesterConfig {
  exchange?: ExchangeConfig;
}

// Built-in strategies
const STRATEGIES: Record<string, StrategyFunction> = {
  rsi_reversal: (data, i, position) => {
    const rsi = data.indicators.rsi?.[i];
    if (rsi === undefined) return { action: 'hold' };
    
    if (!position && rsi < 30) {
      return { action: 'buy', reason: `RSI oversold (${rsi.toFixed(1)})` };
    }
    if (position && rsi > 70) {
      return { action: 'sell', reason: `RSI overbought (${rsi.toFixed(1)})` };
    }
    return { action: 'hold' };
  },

  ma_crossover: (data, i, position) => {
    const ema12 = data.indicators.ema12?.[i];
    const ema26 = data.indicators.ema26?.[i];
    const prevEma12 = data.indicators.ema12?.[i - 1];
    const prevEma26 = data.indicators.ema26?.[i - 1];
    
    if (!ema12 || !ema26 || !prevEma12 || !prevEma26) return { action: 'hold' };
    
    // Golden cross
    if (!position && prevEma12 <= prevEma26 && ema12 > ema26) {
      return { action: 'buy', reason: 'Golden cross (EMA12 > EMA26)' };
    }
    // Death cross
    if (position && prevEma12 >= prevEma26 && ema12 < ema26) {
      return { action: 'sell', reason: 'Death cross (EMA12 < EMA26)' };
    }
    return { action: 'hold' };
  },

  bollinger_bounce: (data, i, position) => {
    const price = data.ohlcv[i].close;
    const lower = data.indicators.bbLower?.[i];
    const upper = data.indicators.bbUpper?.[i];
    
    if (!lower || !upper) return { action: 'hold' };
    
    if (!position && price <= lower) {
      return { action: 'buy', reason: `Price at lower BB ($${price.toFixed(2)})` };
    }
    if (position && price >= upper) {
      return { action: 'sell', reason: `Price at upper BB ($${price.toFixed(2)})` };
    }
    return { action: 'hold' };
  },

  trend_following: (data, i, position) => {
    const sma50 = data.indicators.sma50?.[i];
    const sma200 = data.indicators.sma200?.[i];
    const price = data.ohlcv[i].close;
    
    if (!sma50 || !sma200) return { action: 'hold' };
    
    const inUptrend = price > sma50 && sma50 > sma200;
    const inDowntrend = price < sma50 && sma50 < sma200;
    
    if (!position && inUptrend) {
      return { action: 'buy', reason: 'Uptrend confirmed (Price > SMA50 > SMA200)' };
    }
    if (position && inDowntrend) {
      return { action: 'sell', reason: 'Downtrend confirmed' };
    }
    return { action: 'hold' };
  },
};

export class Backtester extends EventEmitter {
  private exchange: Exchange | null = null;
  private config: BacktesterConfig;

  constructor(config?: BacktesterConfig) {
    super();
    this.config = config || {};
  }

  async connect(exchangeConfig?: ExchangeConfig): Promise<boolean> {
    try {
      const cfg = exchangeConfig || this.config.exchange || { id: 'binance' };
      const exchangeId = cfg.id.toLowerCase();
      
      if (!(exchangeId in ccxt)) {
        throw new Error(`Exchange ${cfg.id} not supported`);
      }

      const ExchangeClass = (ccxt as any)[exchangeId];
      this.exchange = new ExchangeClass({
        enableRateLimit: true,
      }) as Exchange;

      await this.exchange.loadMarkets();
      return true;
    } catch (error: any) {
      console.error('Failed to connect:', error.message);
      return false;
    }
  }

  async run(params: BacktestParams): Promise<BacktestResult> {
    await this.ensureConnected();

    const timeframe = params.timeframe || '1d';
    const initialCapital = params.initialCapital || 10000;
    const commission = params.commission || 0.001; // 0.1%
    const slippage = params.slippage || 0.0005; // 0.05%

    // Fetch historical data
    const ohlcv = await this.fetchHistoricalData(
      params.symbol,
      timeframe,
      params.startDate,
      params.endDate
    );

    if (ohlcv.length < 50) {
      throw new Error('Insufficient data for backtesting (need at least 50 candles)');
    }

    // Calculate indicators
    const data = this.prepareData(ohlcv);

    // Get strategy function
    const strategy = typeof params.strategy === 'string'
      ? STRATEGIES[params.strategy]
      : params.strategy;

    if (!strategy) {
      throw new Error(`Unknown strategy: ${params.strategy}`);
    }

    // Run simulation
    const result = this.simulate(
      data,
      strategy,
      initialCapital,
      commission,
      slippage
    );

    // Build result
    const startDate = new Date(ohlcv[0].timestamp).toISOString().split('T')[0];
    const endDate = new Date(ohlcv[ohlcv.length - 1].timestamp).toISOString().split('T')[0];

    return {
      strategy: typeof params.strategy === 'string' ? params.strategy : 'custom',
      symbol: params.symbol,
      timeframe,
      startDate,
      endDate,
      initialCapital,
      finalCapital: result.finalCapital,
      totalReturn: result.finalCapital - initialCapital,
      totalReturnPct: ((result.finalCapital - initialCapital) / initialCapital) * 100,
      maxDrawdown: result.maxDrawdown,
      maxDrawdownPct: result.maxDrawdownPct,
      sharpeRatio: result.sharpeRatio,
      sortinoRatio: result.sortinoRatio,
      winRate: result.winRate,
      totalTrades: result.trades.length,
      profitFactor: result.profitFactor,
      avgWin: result.avgWin,
      avgLoss: result.avgLoss,
      trades: result.trades,
    };
  }

  getAvailableStrategies(): string[] {
    return Object.keys(STRATEGIES);
  }

  private async fetchHistoricalData(
    symbol: string,
    timeframe: string,
    startDate?: string,
    endDate?: string
  ): Promise<OHLCV[]> {
    if (!this.exchange) throw new Error('Exchange not connected');

    const since = startDate
      ? this.exchange.parse8601(startDate + 'T00:00:00Z')
      : undefined;

    const allOhlcv: OHLCV[] = [];
    let fetchSince = since;
    const limit = 1000;

    // Fetch in batches
    while (true) {
      const batch = await this.exchange.fetchOHLCV(symbol, timeframe, fetchSince, limit);
      
      if (batch.length === 0) break;

      for (const candle of batch) {
        const ohlcv: OHLCV = {
          timestamp: candle[0] as number,
          open: toNum(candle[1]),
          high: toNum(candle[2]),
          low: toNum(candle[3]),
          close: toNum(candle[4]),
          volume: toNum(candle[5]),
        };

        if (endDate && ohlcv.timestamp > this.exchange.parse8601(endDate + 'T23:59:59Z')!) {
          return allOhlcv;
        }

        allOhlcv.push(ohlcv);
      }

      if (batch.length < limit) break;
      fetchSince = (batch[batch.length - 1][0] as number) + 1;
    }

    return allOhlcv;
  }

  private prepareData(ohlcv: OHLCV[]): BacktestData {
    const closes = ohlcv.map(c => c.close);
    const highs = ohlcv.map(c => c.high);
    const lows = ohlcv.map(c => c.low);

    const indicators: Record<string, number[]> = {};

    // RSI
    const rsiValues = RSI.calculate({ period: 14, values: closes });
    indicators.rsi = new Array(closes.length - rsiValues.length).fill(NaN).concat(rsiValues);

    // EMAs
    const ema12Values = EMA.calculate({ period: 12, values: closes });
    indicators.ema12 = new Array(closes.length - ema12Values.length).fill(NaN).concat(ema12Values);

    const ema26Values = EMA.calculate({ period: 26, values: closes });
    indicators.ema26 = new Array(closes.length - ema26Values.length).fill(NaN).concat(ema26Values);

    // SMAs
    const sma50Values = SMA.calculate({ period: 50, values: closes });
    indicators.sma50 = new Array(closes.length - sma50Values.length).fill(NaN).concat(sma50Values);

    const sma200Values = SMA.calculate({ period: 200, values: closes });
    indicators.sma200 = new Array(closes.length - sma200Values.length).fill(NaN).concat(sma200Values);

    // Bollinger Bands
    const bbValues = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
    const bbOffset = closes.length - bbValues.length;
    indicators.bbUpper = new Array(bbOffset).fill(NaN).concat(bbValues.map(b => b.upper));
    indicators.bbMiddle = new Array(bbOffset).fill(NaN).concat(bbValues.map(b => b.middle));
    indicators.bbLower = new Array(bbOffset).fill(NaN).concat(bbValues.map(b => b.lower));

    // ATR
    const atrValues = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
    indicators.atr = new Array(closes.length - atrValues.length).fill(NaN).concat(atrValues);

    return { ohlcv, indicators };
  }

  private simulate(
    data: BacktestData,
    strategy: StrategyFunction,
    initialCapital: number,
    commission: number,
    slippage: number
  ): {
    finalCapital: number;
    trades: BacktestTrade[];
    maxDrawdown: number;
    maxDrawdownPct: number;
    sharpeRatio: number;
    sortinoRatio: number;
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
  } {
    let capital = initialCapital;
    let position: Position | null = null;
    const trades: BacktestTrade[] = [];
    const equityCurve: number[] = [initialCapital];
    const returns: number[] = [];

    // Start after indicator warmup
    const startIndex = 50;

    for (let i = startIndex; i < data.ohlcv.length; i++) {
      const candle = data.ohlcv[i];
      const signal = strategy(data, i, position);

      // Check stop loss / take profit
      if (position) {
        const hitStopLoss = position.stopLoss && candle.low <= position.stopLoss;
        const hitTakeProfit = position.takeProfit && candle.high >= position.takeProfit;

        if (hitStopLoss || hitTakeProfit) {
          const exitPrice = hitStopLoss ? position.stopLoss! : position.takeProfit!;
          const pnl = (exitPrice - position.entryPrice) / position.entryPrice;
          const grossProfit = position.size * exitPrice;
          const fee = grossProfit * commission;
          
          capital += grossProfit - fee;
          
          trades.push({
            entryDate: new Date(data.ohlcv[position.entryIndex].timestamp).toISOString(),
            exitDate: new Date(candle.timestamp).toISOString(),
            side: 'buy',
            entryPrice: position.entryPrice,
            exitPrice,
            amount: position.size,
            pnl: grossProfit - (position.size * position.entryPrice) - fee,
            pnlPct: pnl * 100,
            reason: hitStopLoss ? 'Stop Loss' : 'Take Profit',
          });

          position = null;
        }
      }

      // Process signal
      if (signal.action === 'buy' && !position) {
        const entryPrice = candle.close * (1 + slippage);
        const size = (capital * 0.95) / entryPrice; // Use 95% of capital
        const fee = size * entryPrice * commission;
        
        capital -= (size * entryPrice + fee);
        
        position = {
          side: 'long',
          entryPrice,
          entryIndex: i,
          size,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
        };
      } else if (signal.action === 'sell' && position) {
        const exitPrice = candle.close * (1 - slippage);
        const grossProfit = position.size * exitPrice;
        const fee = grossProfit * commission;
        const pnl = (exitPrice - position.entryPrice) / position.entryPrice;
        
        capital += grossProfit - fee;
        
        trades.push({
          entryDate: new Date(data.ohlcv[position.entryIndex].timestamp).toISOString(),
          exitDate: new Date(candle.timestamp).toISOString(),
          side: 'buy',
          entryPrice: position.entryPrice,
          exitPrice,
          amount: position.size,
          pnl: grossProfit - (position.size * position.entryPrice) - fee,
          pnlPct: pnl * 100,
          reason: signal.reason || 'Signal',
        });

        position = null;
      }

      // Calculate equity
      const equity = capital + (position ? position.size * candle.close : 0);
      const dailyReturn = (equity - equityCurve[equityCurve.length - 1]) / equityCurve[equityCurve.length - 1];
      
      equityCurve.push(equity);
      returns.push(dailyReturn);
    }

    // Close final position at last price
    if (position) {
      const lastCandle = data.ohlcv[data.ohlcv.length - 1];
      capital += position.size * lastCandle.close;
    }

    // Calculate metrics
    const maxDrawdown = this.calculateMaxDrawdown(equityCurve);
    const sharpeRatio = this.calculateSharpeRatio(returns);
    const sortinoRatio = this.calculateSortinoRatio(returns);
    
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnlPct, 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + t.pnlPct, 0) / losingTrades.length
      : 0;
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    return {
      finalCapital: capital,
      trades,
      maxDrawdown: maxDrawdown.maxDrawdown,
      maxDrawdownPct: maxDrawdown.maxDrawdownPct,
      sharpeRatio,
      sortinoRatio,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
    };
  }

  private calculateMaxDrawdown(equity: number[]): { maxDrawdown: number; maxDrawdownPct: number } {
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    let peak = equity[0];

    for (const value of equity) {
      if (value > peak) peak = value;
      const drawdown = peak - value;
      const drawdownPct = (drawdown / peak) * 100;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPct = drawdownPct;
      }
    }

    return { maxDrawdown, maxDrawdownPct };
  }

  private calculateSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    
    if (stdDev === 0) return 0;
    
    // Annualize (assuming daily returns)
    const annualizedReturn = avgReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);
    
    return (annualizedReturn - riskFreeRate) / annualizedStdDev;
  }

  private calculateSortinoRatio(returns: number[], riskFreeRate: number = 0): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    
    if (negativeReturns.length === 0) return Infinity;
    
    const downside = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    );
    
    if (downside === 0) return 0;
    
    const annualizedReturn = avgReturn * 252;
    const annualizedDownside = downside * Math.sqrt(252);
    
    return (annualizedReturn - riskFreeRate) / annualizedDownside;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.exchange) await this.connect();
  }
}

export function createBacktester(config?: BacktesterConfig): Backtester {
  return new Backtester(config);
}

export default Backtester;
