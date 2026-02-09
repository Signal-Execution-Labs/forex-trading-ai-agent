/**
 * K.I.T. Backtester - Strategy Testing Engine
 * Issue #8: Backtest trading strategies with historical data
 */

import * as ccxt from 'ccxt';
import { RSI, MACD, BollingerBands, EMA, SMA } from 'technicalindicators';
import { OHLCV } from './types';

// ============================================================
// TYPES
// ============================================================

export type StrategySignal = 'buy' | 'sell' | 'hold';

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  startDate?: Date;
  endDate?: Date;
  initialCapital: number;
  positionSizePct: number;  // % of capital per trade
  commission: number;       // Per trade, e.g., 0.001 = 0.1%
  slippage: number;         // Assumed slippage, e.g., 0.0005 = 0.05%
}

export interface StrategyConfig {
  name: string;
  description?: string;
  warmupPeriod: number;  // Candles needed before first signal
  params: Record<string, number | string | boolean>;
}

export interface BacktestTrade {
  id: number;
  type: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  amount: number;
  entryTime: Date;
  exitTime?: Date;
  pnl?: number;
  pnlPercent?: number;
  commission: number;
  slippage: number;
}

export interface BacktestResult {
  strategy: string;
  config: BacktestConfig;
  
  // Returns
  totalReturn: number;
  totalReturnPct: number;
  buyHoldReturn: number;
  buyHoldReturnPct: number;
  alpha: number;  // Strategy return - buy & hold
  
  // Risk metrics
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  volatility: number;
  
  // Trade stats
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  avgHoldingPeriod: number;  // In candles
  
  // Capital
  initialCapital: number;
  finalCapital: number;
  peakCapital: number;
  
  // Time
  startDate: Date;
  endDate: Date;
  totalCandles: number;
  
  // Details
  trades: BacktestTrade[];
  equityCurve: number[];
  drawdownCurve: number[];
}

export type StrategyFunction = (
  data: OHLCV[],
  index: number,
  params: Record<string, unknown>
) => StrategySignal;

// ============================================================
// BUILT-IN STRATEGIES
// ============================================================

export const STRATEGIES: Record<string, { fn: StrategyFunction; config: StrategyConfig }> = {
  
  // RSI Mean Reversion
  rsi: {
    config: {
      name: 'RSI Mean Reversion',
      description: 'Buy when RSI oversold, sell when overbought',
      warmupPeriod: 14,
      params: { period: 14, oversold: 30, overbought: 70 }
    },
    fn: (data, index, params) => {
      if (index < 14) return 'hold';
      
      const closes = data.slice(Math.max(0, index - 14), index + 1).map(d => d.close);
      const rsiResult = RSI.calculate({ period: params.period as number || 14, values: closes });
      const rsi = rsiResult[rsiResult.length - 1];
      
      if (rsi === undefined) return 'hold';
      if (rsi < (params.oversold as number || 30)) return 'buy';
      if (rsi > (params.overbought as number || 70)) return 'sell';
      return 'hold';
    }
  },
  
  // EMA Crossover
  emaCrossover: {
    config: {
      name: 'EMA Crossover',
      description: 'Buy when fast EMA crosses above slow EMA',
      warmupPeriod: 26,
      params: { fastPeriod: 12, slowPeriod: 26 }
    },
    fn: (data, index, params) => {
      const fast = params.fastPeriod as number || 12;
      const slow = params.slowPeriod as number || 26;
      
      if (index < slow + 1) return 'hold';
      
      const closes = data.slice(0, index + 1).map(d => d.close);
      const fastEma = EMA.calculate({ period: fast, values: closes });
      const slowEma = EMA.calculate({ period: slow, values: closes });
      
      const currFast = fastEma[fastEma.length - 1];
      const prevFast = fastEma[fastEma.length - 2];
      const currSlow = slowEma[slowEma.length - 1];
      const prevSlow = slowEma[slowEma.length - 2];
      
      if (currFast === undefined || currSlow === undefined) return 'hold';
      
      // Crossover
      if (prevFast <= prevSlow && currFast > currSlow) return 'buy';
      if (prevFast >= prevSlow && currFast < currSlow) return 'sell';
      
      return 'hold';
    }
  },
  
  // Bollinger Bands
  bollingerBands: {
    config: {
      name: 'Bollinger Bands',
      description: 'Buy at lower band, sell at upper band',
      warmupPeriod: 20,
      params: { period: 20, stdDev: 2 }
    },
    fn: (data, index, params) => {
      const period = params.period as number || 20;
      
      if (index < period) return 'hold';
      
      const closes = data.slice(0, index + 1).map(d => d.close);
      const bb = BollingerBands.calculate({
        period,
        stdDev: params.stdDev as number || 2,
        values: closes
      });
      
      const current = bb[bb.length - 1];
      const price = data[index].close;
      
      if (!current) return 'hold';
      
      if (price <= current.lower) return 'buy';
      if (price >= current.upper) return 'sell';
      
      return 'hold';
    }
  },
  
  // MACD
  macd: {
    config: {
      name: 'MACD',
      description: 'Buy on bullish MACD crossover, sell on bearish',
      warmupPeriod: 35,
      params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
    },
    fn: (data, index, params) => {
      if (index < 35) return 'hold';
      
      const closes = data.slice(0, index + 1).map(d => d.close);
      const macdResult = MACD.calculate({
        fastPeriod: params.fastPeriod as number || 12,
        slowPeriod: params.slowPeriod as number || 26,
        signalPeriod: params.signalPeriod as number || 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
        values: closes
      });
      
      if (macdResult.length < 2) return 'hold';
      
      const curr = macdResult[macdResult.length - 1];
      const prev = macdResult[macdResult.length - 2];
      
      if (!curr.MACD || !curr.signal || !prev.MACD || !prev.signal) return 'hold';
      
      // Crossover
      if (prev.MACD <= prev.signal && curr.MACD > curr.signal) return 'buy';
      if (prev.MACD >= prev.signal && curr.MACD < curr.signal) return 'sell';
      
      return 'hold';
    }
  },
  
  // SMA Trend Following
  smaTrend: {
    config: {
      name: 'SMA Trend Following',
      description: 'Long when price above SMA, exit when below',
      warmupPeriod: 50,
      params: { period: 50 }
    },
    fn: (data, index, params) => {
      const period = params.period as number || 50;
      
      if (index < period) return 'hold';
      
      const closes = data.slice(0, index + 1).map(d => d.close);
      const sma = SMA.calculate({ period, values: closes });
      
      const currentSma = sma[sma.length - 1];
      const prevSma = sma[sma.length - 2];
      const price = data[index].close;
      const prevPrice = data[index - 1].close;
      
      if (currentSma === undefined) return 'hold';
      
      // Cross above/below SMA
      if (prevPrice <= prevSma && price > currentSma) return 'buy';
      if (prevPrice >= prevSma && price < currentSma) return 'sell';
      
      return 'hold';
    }
  },
  
  // Combined: RSI + EMA
  rsiEma: {
    config: {
      name: 'RSI + EMA Combo',
      description: 'RSI oversold + price above EMA = buy',
      warmupPeriod: 26,
      params: { rsiPeriod: 14, emaPeriod: 20, oversold: 35, overbought: 65 }
    },
    fn: (data, index, params) => {
      if (index < 26) return 'hold';
      
      const closes = data.slice(0, index + 1).map(d => d.close);
      const price = data[index].close;
      
      // Calculate RSI
      const rsiResult = RSI.calculate({ period: params.rsiPeriod as number || 14, values: closes });
      const rsi = rsiResult[rsiResult.length - 1];
      
      // Calculate EMA
      const emaResult = EMA.calculate({ period: params.emaPeriod as number || 20, values: closes });
      const ema = emaResult[emaResult.length - 1];
      
      if (rsi === undefined || ema === undefined) return 'hold';
      
      // Buy: RSI oversold AND price above EMA (uptrend)
      if (rsi < (params.oversold as number || 35) && price > ema) return 'buy';
      
      // Sell: RSI overbought OR price below EMA
      if (rsi > (params.overbought as number || 65) || price < ema * 0.98) return 'sell';
      
      return 'hold';
    }
  }
};

// ============================================================
// BACKTESTER CLASS
// ============================================================

export class Backtester {
  private exchange: ccxt.Exchange;
  
  constructor(exchangeId: string = 'binance') {
    const ExchangeClass = (ccxt as unknown as Record<string, new () => ccxt.Exchange>)[exchangeId];
    this.exchange = new ExchangeClass();
  }
  
  // --------------------------------------------------------
  // Data Loading
  // --------------------------------------------------------
  
  async fetchHistoricalData(
    symbol: string,
    timeframe: string,
    since?: number,
    limit: number = 1000
  ): Promise<OHLCV[]> {
    const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, since, limit);
    
    return ohlcv.map(candle => ({
      timestamp: candle[0] as number,
      open: candle[1] as number,
      high: candle[2] as number,
      low: candle[3] as number,
      close: candle[4] as number,
      volume: candle[5] as number
    }));
  }
  
  // --------------------------------------------------------
  // Backtest Engine
  // --------------------------------------------------------
  
  async runBacktest(
    strategyName: string,
    config: BacktestConfig,
    customStrategy?: StrategyFunction,
    customParams?: Record<string, unknown>
  ): Promise<BacktestResult> {
    // Get strategy
    const strategy = STRATEGIES[strategyName];
    const strategyFn = customStrategy || strategy?.fn;
    const strategyConfig = strategy?.config || {
      name: 'Custom',
      warmupPeriod: 50,
      params: customParams || {}
    };
    
    if (!strategyFn) {
      throw new Error(`Strategy '${strategyName}' not found`);
    }
    
    // Load data
    const since = config.startDate ? config.startDate.getTime() : undefined;
    const data = await this.fetchHistoricalData(config.symbol, config.timeframe, since, 1000);
    
    if (data.length < strategyConfig.warmupPeriod + 10) {
      throw new Error(`Not enough data for backtest. Need at least ${strategyConfig.warmupPeriod + 10} candles`);
    }
    
    // Initialize
    let capital = config.initialCapital;
    let position = 0;
    let entryPrice = 0;
    let entryTime: Date | null = null;
    const trades: BacktestTrade[] = [];
    const equityCurve: number[] = [capital];
    let peakCapital = capital;
    let tradeId = 0;
    
    const params = customParams || strategyConfig.params;
    
    // Run backtest
    for (let i = strategyConfig.warmupPeriod; i < data.length; i++) {
      const candle = data[i];
      const signal = strategyFn(data, i, params);
      
      // Calculate commission and slippage
      const commission = config.commission || 0.001;
      const slippage = config.slippage || 0.0005;
      
      if (signal === 'buy' && position === 0) {
        // Enter long position
        const adjustedPrice = candle.close * (1 + slippage);
        const positionSize = capital * (config.positionSizePct / 100);
        const commissionCost = positionSize * commission;
        
        position = (positionSize - commissionCost) / adjustedPrice;
        entryPrice = adjustedPrice;
        entryTime = new Date(candle.timestamp);
        capital -= positionSize;
        
        trades.push({
          id: ++tradeId,
          type: 'buy',
          entryPrice: adjustedPrice,
          amount: position,
          entryTime: entryTime,
          commission: commissionCost,
          slippage: candle.close * slippage * position
        });
        
      } else if (signal === 'sell' && position > 0) {
        // Exit position
        const adjustedPrice = candle.close * (1 - slippage);
        const proceeds = position * adjustedPrice;
        const commissionCost = proceeds * commission;
        
        const pnl = proceeds - commissionCost - (position * entryPrice);
        const pnlPercent = (pnl / (position * entryPrice)) * 100;
        
        capital += proceeds - commissionCost;
        
        // Update last trade with exit info
        const lastTrade = trades[trades.length - 1];
        lastTrade.exitPrice = adjustedPrice;
        lastTrade.exitTime = new Date(candle.timestamp);
        lastTrade.pnl = pnl;
        lastTrade.pnlPercent = pnlPercent;
        lastTrade.commission += commissionCost;
        
        position = 0;
        entryPrice = 0;
        entryTime = null;
      }
      
      // Track equity
      const equity = capital + (position * candle.close);
      equityCurve.push(equity);
      peakCapital = Math.max(peakCapital, equity);
    }
    
    // Close any open position at end
    if (position > 0) {
      const lastCandle = data[data.length - 1];
      const proceeds = position * lastCandle.close * (1 - config.slippage);
      capital += proceeds * (1 - config.commission);
      
      const lastTrade = trades[trades.length - 1];
      if (lastTrade && !lastTrade.exitPrice) {
        lastTrade.exitPrice = lastCandle.close;
        lastTrade.exitTime = new Date(lastCandle.timestamp);
        lastTrade.pnl = proceeds - (position * entryPrice);
        lastTrade.pnlPercent = (lastTrade.pnl / (position * entryPrice)) * 100;
      }
    }
    
    // Calculate metrics
    return this.calculateMetrics(
      strategyConfig.name,
      config,
      data,
      trades,
      equityCurve,
      peakCapital
    );
  }
  
  // --------------------------------------------------------
  // Metrics Calculation
  // --------------------------------------------------------
  
  private calculateMetrics(
    strategyName: string,
    config: BacktestConfig,
    data: OHLCV[],
    trades: BacktestTrade[],
    equityCurve: number[],
    peakCapital: number
  ): BacktestResult {
    const finalCapital = equityCurve[equityCurve.length - 1];
    const totalReturn = finalCapital - config.initialCapital;
    const totalReturnPct = (totalReturn / config.initialCapital) * 100;
    
    // Buy & Hold comparison
    const firstPrice = data[0].close;
    const lastPrice = data[data.length - 1].close;
    const buyHoldReturn = ((lastPrice / firstPrice) - 1) * config.initialCapital;
    const buyHoldReturnPct = ((lastPrice / firstPrice) - 1) * 100;
    
    // Trade statistics
    const completedTrades = trades.filter(t => t.exitPrice !== undefined);
    const winningTrades = completedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = completedTrades.filter(t => (t.pnl || 0) <= 0);
    
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / losingTrades.length
      : 0;
    
    const avgWinPct = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / winningTrades.length
      : 0;
    const avgLossPct = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnlPercent || 0), 0) / losingTrades.length
      : 0;
    
    // Calculate returns for Sharpe/Sortino
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    
    // Downside deviation for Sortino
    const negativeReturns = returns.filter(r => r < 0);
    const downsideDev = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / (negativeReturns.length || 1)
    );
    
    // Annualization factor (assuming daily timeframe)
    const annualizationFactor = Math.sqrt(252);
    
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * annualizationFactor : 0;
    const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * annualizationFactor : 0;
    
    // Drawdown
    const drawdownCurve: number[] = [];
    let runningMax = equityCurve[0];
    let maxDrawdown = 0;
    
    for (const equity of equityCurve) {
      runningMax = Math.max(runningMax, equity);
      const drawdown = runningMax - equity;
      drawdownCurve.push(drawdown);
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    const maxDrawdownPct = (maxDrawdown / peakCapital) * 100;
    
    // Profit factor
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    
    // Average holding period
    const avgHoldingPeriod = completedTrades.length > 0
      ? completedTrades.reduce((sum, t) => {
          if (t.exitTime && t.entryTime) {
            return sum + (t.exitTime.getTime() - t.entryTime.getTime());
          }
          return sum;
        }, 0) / completedTrades.length / (1000 * 60 * 60)  // Convert to hours
      : 0;
    
    return {
      strategy: strategyName,
      config,
      
      totalReturn,
      totalReturnPct,
      buyHoldReturn,
      buyHoldReturnPct,
      alpha: totalReturnPct - buyHoldReturnPct,
      
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      maxDrawdownPct,
      volatility: stdDev * annualizationFactor * 100,
      
      totalTrades: completedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0,
      avgWin,
      avgLoss,
      avgWinPct,
      avgLossPct,
      profitFactor,
      avgHoldingPeriod,
      
      initialCapital: config.initialCapital,
      finalCapital,
      peakCapital,
      
      startDate: new Date(data[0].timestamp),
      endDate: new Date(data[data.length - 1].timestamp),
      totalCandles: data.length,
      
      trades,
      equityCurve,
      drawdownCurve
    };
  }
  
  // --------------------------------------------------------
  // Report Generation
  // --------------------------------------------------------
  
  generateReport(result: BacktestResult): string {
    const r = result;
    
    return `
📊 BACKTEST REPORT: ${r.strategy}
${'='.repeat(60)}
Symbol: ${r.config.symbol}
Timeframe: ${r.config.timeframe}
Period: ${r.startDate.toISOString().split('T')[0]} to ${r.endDate.toISOString().split('T')[0]}
Candles: ${r.totalCandles}

PERFORMANCE
${'-'.repeat(60)}
Initial Capital:    $${r.initialCapital.toLocaleString()}
Final Capital:      $${r.finalCapital.toLocaleString()}
Total Return:       ${r.totalReturnPct >= 0 ? '+' : ''}${r.totalReturnPct.toFixed(2)}%
Buy & Hold:         ${r.buyHoldReturnPct >= 0 ? '+' : ''}${r.buyHoldReturnPct.toFixed(2)}%
Alpha:              ${r.alpha >= 0 ? '+' : ''}${r.alpha.toFixed(2)}%

RISK METRICS
${'-'.repeat(60)}
Sharpe Ratio:       ${r.sharpeRatio.toFixed(2)}
Sortino Ratio:      ${r.sortinoRatio.toFixed(2)}
Max Drawdown:       ${r.maxDrawdownPct.toFixed(2)}%
Volatility:         ${r.volatility.toFixed(2)}%

TRADE STATISTICS
${'-'.repeat(60)}
Total Trades:       ${r.totalTrades}
Winning Trades:     ${r.winningTrades} (${r.winRate.toFixed(1)}%)
Losing Trades:      ${r.losingTrades}
Avg Win:            $${r.avgWin.toFixed(2)} (${r.avgWinPct.toFixed(2)}%)
Avg Loss:           $${r.avgLoss.toFixed(2)} (${r.avgLossPct.toFixed(2)}%)
Profit Factor:      ${r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2)}
Avg Hold Time:      ${r.avgHoldingPeriod.toFixed(1)} hours

RATING
${'-'.repeat(60)}
${this.getRating(r)}
`;
  }
  
  private getRating(r: BacktestResult): string {
    let score = 0;
    const notes: string[] = [];
    
    // Alpha
    if (r.alpha > 20) { score += 3; notes.push('🌟 Excellent alpha'); }
    else if (r.alpha > 10) { score += 2; notes.push('✅ Good alpha'); }
    else if (r.alpha > 0) { score += 1; notes.push('👍 Positive alpha'); }
    else { notes.push('⚠️ Negative alpha'); }
    
    // Sharpe
    if (r.sharpeRatio > 2) { score += 3; notes.push('🌟 Excellent Sharpe'); }
    else if (r.sharpeRatio > 1) { score += 2; notes.push('✅ Good Sharpe'); }
    else if (r.sharpeRatio > 0.5) { score += 1; notes.push('👍 Acceptable Sharpe'); }
    else { notes.push('⚠️ Low Sharpe'); }
    
    // Drawdown
    if (r.maxDrawdownPct < 10) { score += 2; notes.push('🛡️ Low drawdown'); }
    else if (r.maxDrawdownPct < 20) { score += 1; notes.push('✅ Moderate drawdown'); }
    else { notes.push('⚠️ High drawdown'); }
    
    // Win rate
    if (r.winRate > 60) { score += 2; notes.push('🎯 High win rate'); }
    else if (r.winRate > 50) { score += 1; notes.push('✅ Positive win rate'); }
    else { notes.push('⚠️ Low win rate'); }
    
    // Profit factor
    if (r.profitFactor > 2) { score += 2; notes.push('💰 Excellent profit factor'); }
    else if (r.profitFactor > 1.5) { score += 1; notes.push('✅ Good profit factor'); }
    else { notes.push('⚠️ Low profit factor'); }
    
    const rating = score >= 10 ? '⭐⭐⭐⭐⭐ EXCELLENT' :
                   score >= 8 ? '⭐⭐⭐⭐ VERY GOOD' :
                   score >= 6 ? '⭐⭐⭐ GOOD' :
                   score >= 4 ? '⭐⭐ FAIR' :
                   '⭐ NEEDS IMPROVEMENT';
    
    return `${rating}\n${notes.join('\n')}`;
  }
  
  // --------------------------------------------------------
  // Strategy Comparison
  // --------------------------------------------------------
  
  async compareStrategies(
    config: BacktestConfig,
    strategyNames: string[] = Object.keys(STRATEGIES)
  ): Promise<BacktestResult[]> {
    const results: BacktestResult[] = [];
    
    for (const name of strategyNames) {
      try {
        const result = await this.runBacktest(name, config);
        results.push(result);
      } catch (error) {
        console.error(`Failed to backtest ${name}:`, error);
      }
    }
    
    // Sort by alpha
    return results.sort((a, b) => b.alpha - a.alpha);
  }
  
  generateComparisonReport(results: BacktestResult[]): string {
    let report = `
📊 STRATEGY COMPARISON
${'='.repeat(70)}
Symbol: ${results[0]?.config.symbol || 'N/A'}
Period: ${results[0]?.totalCandles || 0} candles

${'Strategy'.padEnd(20)} ${'Return'.padStart(10)} ${'B&H Δ'.padStart(10)} ${'Sharpe'.padStart(8)} ${'Win%'.padStart(8)} ${'MaxDD'.padStart(8)}
${'-'.repeat(70)}
`;

    for (const r of results) {
      const name = r.strategy.substring(0, 19).padEnd(20);
      const ret = `${r.totalReturnPct >= 0 ? '+' : ''}${r.totalReturnPct.toFixed(1)}%`.padStart(10);
      const alpha = `${r.alpha >= 0 ? '+' : ''}${r.alpha.toFixed(1)}%`.padStart(10);
      const sharpe = r.sharpeRatio.toFixed(2).padStart(8);
      const winRate = `${r.winRate.toFixed(0)}%`.padStart(8);
      const maxDD = `${r.maxDrawdownPct.toFixed(1)}%`.padStart(8);
      
      report += `${name} ${ret} ${alpha} ${sharpe} ${winRate} ${maxDD}\n`;
    }
    
    if (results.length > 0) {
      const best = results[0];
      report += `\n🏆 Best Strategy: ${best.strategy} (Alpha: ${best.alpha >= 0 ? '+' : ''}${best.alpha.toFixed(2)}%)`;
    }
    
    return report;
  }
  
  // --------------------------------------------------------
  // Available Strategies
  // --------------------------------------------------------
  
  listStrategies(): { name: string; description: string; params: Record<string, unknown> }[] {
    return Object.entries(STRATEGIES).map(([key, value]) => ({
      name: key,
      description: value.config.description || value.config.name,
      params: value.config.params
    }));
  }
}

// ============================================================
// FACTORY & EXPORT
// ============================================================

export function createBacktester(exchangeId: string = 'binance'): Backtester {
  return new Backtester(exchangeId);
}

export default Backtester;
