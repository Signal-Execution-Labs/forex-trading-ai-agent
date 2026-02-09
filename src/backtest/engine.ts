/**
 * K.I.T. Backtest Simulation Engine
 * Simulates strategy execution on historical data
 */

import { EventEmitter } from 'events';
import { Logger } from '../core/logger';
import { OHLCV } from '../exchanges/manager';
import { Strategy, Signal } from '../strategies/manager';
import { HistoricalData } from './data-loader';
import { BacktestTrade, EquityPoint, PerformanceMetrics, MetricsCalculator } from './metrics';

export interface BacktestConfig {
  initialCapital: number;
  feeRate: number;           // Trading fee (e.g., 0.001 for 0.1%)
  slippage: number;          // Slippage rate (e.g., 0.0005 for 0.05%)
  maxPositions: number;      // Max concurrent positions
  positionSizing: 'fixed' | 'percent' | 'kelly';
  positionSize: number;      // Fixed amount or percent of capital
  useStopLoss: boolean;
  stopLossPercent: number;
  useTakeProfit: boolean;
  takeProfitPercent: number;
  allowShorts: boolean;
  marginEnabled: boolean;
  leverage: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  amount: number;
  entryTime: Date;
  strategy: string;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnL: number;
  margin: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  data: {
    symbol: string;
    exchange: string;
    timeframe: string;
    startDate: Date;
    endDate: Date;
    totalCandles: number;
  };
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  strategyMetrics: Map<string, PerformanceMetrics>;
  signals: Signal[];
  executionTime: number;
}

export class BacktestEngine extends EventEmitter {
  private logger: Logger;
  private config: BacktestConfig;
  private strategies: Strategy[] = [];
  
  // State
  private capital: number = 0;
  private positions: Map<string, Position> = new Map();
  private trades: BacktestTrade[] = [];
  private equityCurve: EquityPoint[] = [];
  private signals: Signal[] = [];
  
  // For strategy analysis
  private lookbackData: OHLCV[] = [];
  private currentCandle: OHLCV | null = null;

  constructor(config?: Partial<BacktestConfig>) {
    super();
    this.logger = new Logger('BacktestEngine');
    this.config = this.mergeConfig(config);
  }

  private mergeConfig(config?: Partial<BacktestConfig>): BacktestConfig {
    return {
      initialCapital: config?.initialCapital ?? 10000,
      feeRate: config?.feeRate ?? 0.001,         // 0.1% default
      slippage: config?.slippage ?? 0.0005,      // 0.05% default
      maxPositions: config?.maxPositions ?? 5,
      positionSizing: config?.positionSizing ?? 'percent',
      positionSize: config?.positionSize ?? 2,    // 2% per trade default
      useStopLoss: config?.useStopLoss ?? true,
      stopLossPercent: config?.stopLossPercent ?? 2,
      useTakeProfit: config?.useTakeProfit ?? true,
      takeProfitPercent: config?.takeProfitPercent ?? 4,
      allowShorts: config?.allowShorts ?? true,
      marginEnabled: config?.marginEnabled ?? false,
      leverage: config?.leverage ?? 1
    };
  }

  /**
   * Register a strategy for backtesting
   */
  addStrategy(strategy: Strategy): void {
    this.strategies.push(strategy);
    this.logger.info(`Added strategy: ${strategy.name}`);
  }

  /**
   * Clear all strategies
   */
  clearStrategies(): void {
    this.strategies = [];
  }

  /**
   * Run backtest on historical data
   */
  async run(data: HistoricalData, lookback: number = 50): Promise<BacktestResult> {
    const startTime = Date.now();
    
    this.logger.info('═══════════════════════════════════════════════════════════');
    this.logger.info('  K.I.T. BACKTEST ENGINE - Starting Simulation');
    this.logger.info('═══════════════════════════════════════════════════════════');
    this.logger.info(`Symbol: ${data.symbol} | Exchange: ${data.exchange}`);
    this.logger.info(`Period: ${data.startDate.toISOString()} to ${data.endDate.toISOString()}`);
    this.logger.info(`Candles: ${data.candles.length} | Timeframe: ${data.timeframe}`);
    this.logger.info(`Initial Capital: $${this.config.initialCapital.toLocaleString()}`);
    this.logger.info(`Strategies: ${this.strategies.map(s => s.name).join(', ')}`);
    this.logger.info('───────────────────────────────────────────────────────────');

    // Reset state
    this.reset();

    // Main simulation loop
    const candles = data.candles;
    let processedCandles = 0;

    for (let i = lookback; i < candles.length; i++) {
      this.currentCandle = candles[i];
      this.lookbackData = candles.slice(Math.max(0, i - lookback), i + 1);

      // 1. Check stop loss / take profit for open positions
      this.checkExits(this.currentCandle);

      // 2. Get market data format for strategies
      const marketData = this.candleToMarketData(this.currentCandle, data);

      // 3. Run all strategies
      for (const strategy of this.strategies) {
        try {
          const signals = await strategy.analyze([marketData]);
          
          for (const signal of signals) {
            // Store signal for analysis
            this.signals.push(signal);
            
            // Validate and execute signal
            if (this.validateSignal(signal)) {
              this.executeSignal(signal, this.currentCandle);
            }
          }
        } catch (error) {
          this.logger.error(`Strategy ${strategy.name} error:`, error);
        }
      }

      // 4. Update equity curve
      this.updateEquityCurve(this.currentCandle);

      // 5. Emit progress
      processedCandles++;
      if (processedCandles % 1000 === 0) {
        const progress = ((i / candles.length) * 100).toFixed(1);
        this.emit('progress', { percent: progress, candle: i, total: candles.length });
      }
    }

    // Close all remaining positions at market
    this.closeAllPositions(candles[candles.length - 1]);

    // Calculate metrics
    const metricsCalc = new MetricsCalculator();
    const metrics = metricsCalc.calculateMetrics(
      this.trades,
      this.equityCurve,
      this.config.initialCapital
    );

    const strategyMetrics = metricsCalc.calculateStrategyMetrics(
      this.trades,
      this.equityCurve,
      this.config.initialCapital
    );

    const executionTime = Date.now() - startTime;

    this.logger.info('───────────────────────────────────────────────────────────');
    this.logger.info('  BACKTEST COMPLETE');
    this.logger.info('───────────────────────────────────────────────────────────');
    this.logger.info(`Total Trades: ${this.trades.length}`);
    this.logger.info(`Win Rate: ${(metrics.winRate * 100).toFixed(2)}%`);
    this.logger.info(`Total P&L: $${metrics.totalPnL.toFixed(2)} (${metrics.totalPnLPercent.toFixed(2)}%)`);
    this.logger.info(`Max Drawdown: ${metrics.maxDrawdownPercent.toFixed(2)}%`);
    this.logger.info(`Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
    this.logger.info(`Execution Time: ${executionTime}ms`);
    this.logger.info('═══════════════════════════════════════════════════════════');

    const result: BacktestResult = {
      config: this.config,
      data: {
        symbol: data.symbol,
        exchange: data.exchange,
        timeframe: data.timeframe,
        startDate: data.startDate,
        endDate: data.endDate,
        totalCandles: data.candles.length
      },
      trades: this.trades,
      equityCurve: this.equityCurve,
      metrics,
      strategyMetrics,
      signals: this.signals,
      executionTime
    };

    this.emit('complete', result);
    return result;
  }

  /**
   * Reset engine state
   */
  private reset(): void {
    this.capital = this.config.initialCapital;
    this.positions.clear();
    this.trades = [];
    this.equityCurve = [];
    this.signals = [];
    this.lookbackData = [];
    this.currentCandle = null;
  }

  /**
   * Convert OHLCV to MarketData format
   */
  private candleToMarketData(candle: OHLCV, data: HistoricalData): any {
    return {
      symbol: data.symbol,
      exchange: data.exchange,
      price: candle.close,
      volume: candle.volume,
      high24h: Math.max(...this.lookbackData.slice(-24).map(c => c.high)),
      low24h: Math.min(...this.lookbackData.slice(-24).map(c => c.low)),
      timestamp: candle.timestamp,
      ohlcv: this.lookbackData
    };
  }

  /**
   * Validate if signal can be executed
   */
  private validateSignal(signal: Signal): boolean {
    // Check confidence threshold
    if (signal.confidence < 0.5) return false;

    // Check max positions
    if (this.positions.size >= this.config.maxPositions) return false;

    // Check if we have enough capital
    const cost = this.calculatePositionCost(signal);
    if (cost > this.capital) return false;

    // Check for duplicate position
    const positionKey = `${signal.symbol}-${signal.side}`;
    if (this.positions.has(positionKey)) return false;

    // Check shorts allowed
    if (signal.side === 'sell' && !this.config.allowShorts) return false;

    return true;
  }

  /**
   * Execute a trading signal
   */
  private executeSignal(signal: Signal, candle: OHLCV): void {
    const side: 'long' | 'short' = signal.side === 'buy' ? 'long' : 'short';
    
    // Apply slippage
    const slippageMultiplier = side === 'long' 
      ? (1 + this.config.slippage) 
      : (1 - this.config.slippage);
    const entryPrice = candle.close * slippageMultiplier;

    // Calculate position size
    const amount = this.calculatePositionAmount(signal, entryPrice);
    
    // Calculate fees
    const entryCost = amount * entryPrice;
    const entryFee = entryCost * this.config.feeRate;
    
    // Deduct from capital
    const margin = this.config.marginEnabled 
      ? entryCost / this.config.leverage 
      : entryCost;
    
    this.capital -= (margin + entryFee);

    // Calculate stop loss and take profit
    const stopLoss = this.config.useStopLoss
      ? side === 'long'
        ? entryPrice * (1 - this.config.stopLossPercent / 100)
        : entryPrice * (1 + this.config.stopLossPercent / 100)
      : undefined;

    const takeProfit = this.config.useTakeProfit
      ? side === 'long'
        ? entryPrice * (1 + this.config.takeProfitPercent / 100)
        : entryPrice * (1 - this.config.takeProfitPercent / 100)
      : undefined;

    // Create position
    const position: Position = {
      id: this.generateId(),
      symbol: signal.symbol,
      side,
      entryPrice,
      amount,
      entryTime: candle.timestamp,
      strategy: signal.strategy,
      stopLoss,
      takeProfit,
      unrealizedPnL: 0,
      margin
    };

    this.positions.set(position.id, position);
    
    this.logger.debug(
      `📈 OPEN ${side.toUpperCase()} | ${signal.symbol} | ` +
      `Price: $${entryPrice.toFixed(2)} | Amount: ${amount.toFixed(4)} | ` +
      `SL: ${stopLoss?.toFixed(2) || 'N/A'} | TP: ${takeProfit?.toFixed(2) || 'N/A'}`
    );
  }

  /**
   * Check and execute stop loss / take profit
   */
  private checkExits(candle: OHLCV): void {
    for (const [id, position] of this.positions) {
      let exitPrice: number | null = null;
      let exitReason: 'stop_loss' | 'take_profit' | 'manual' = 'manual';

      if (position.side === 'long') {
        // Long position
        if (position.stopLoss && candle.low <= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = 'stop_loss';
        } else if (position.takeProfit && candle.high >= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = 'take_profit';
        }
      } else {
        // Short position
        if (position.stopLoss && candle.high >= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = 'stop_loss';
        } else if (position.takeProfit && candle.low <= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = 'take_profit';
        }
      }

      if (exitPrice !== null) {
        this.closePosition(id, exitPrice, candle.timestamp, exitReason);
      }
    }
  }

  /**
   * Close a specific position
   */
  private closePosition(
    positionId: string, 
    exitPrice: number, 
    exitTime: Date,
    reason: string = 'manual'
  ): void {
    const position = this.positions.get(positionId);
    if (!position) return;

    // Apply slippage
    const slippageMultiplier = position.side === 'long'
      ? (1 - this.config.slippage)
      : (1 + this.config.slippage);
    const actualExitPrice = exitPrice * slippageMultiplier;

    // Calculate P&L
    let pnl: number;
    if (position.side === 'long') {
      pnl = (actualExitPrice - position.entryPrice) * position.amount;
    } else {
      pnl = (position.entryPrice - actualExitPrice) * position.amount;
    }

    // Apply leverage
    if (this.config.marginEnabled) {
      pnl *= this.config.leverage;
    }

    // Calculate fees
    const exitValue = position.amount * actualExitPrice;
    const exitFee = exitValue * this.config.feeRate;
    const totalFees = (position.amount * position.entryPrice * this.config.feeRate) + exitFee;

    // Net P&L after fees
    const netPnL = pnl - exitFee;

    // Return capital + profit/loss
    this.capital += position.margin + netPnL;

    // Create trade record
    const trade: BacktestTrade = {
      id: position.id,
      symbol: position.symbol,
      side: position.side === 'long' ? 'buy' : 'sell',
      entryPrice: position.entryPrice,
      exitPrice: actualExitPrice,
      amount: position.amount,
      entryTime: position.entryTime,
      exitTime,
      strategy: position.strategy,
      pnl: netPnL,
      pnlPercent: (netPnL / position.margin) * 100,
      fees: totalFees
    };

    this.trades.push(trade);
    this.positions.delete(positionId);

    const pnlStr = netPnL >= 0 ? `+$${netPnL.toFixed(2)}` : `-$${Math.abs(netPnL).toFixed(2)}`;
    this.logger.debug(
      `📉 CLOSE ${position.side.toUpperCase()} | ${position.symbol} | ` +
      `Exit: $${actualExitPrice.toFixed(2)} | P&L: ${pnlStr} | Reason: ${reason}`
    );
  }

  /**
   * Close all open positions
   */
  private closeAllPositions(lastCandle: OHLCV): void {
    for (const [id, position] of this.positions) {
      this.closePosition(id, lastCandle.close, lastCandle.timestamp, 'end_of_backtest');
    }
  }

  /**
   * Update equity curve
   */
  private updateEquityCurve(candle: OHLCV): void {
    // Calculate unrealized P&L
    let unrealizedPnL = 0;
    for (const position of this.positions.values()) {
      if (position.side === 'long') {
        unrealizedPnL += (candle.close - position.entryPrice) * position.amount;
      } else {
        unrealizedPnL += (position.entryPrice - candle.close) * position.amount;
      }
      
      if (this.config.marginEnabled) {
        unrealizedPnL *= this.config.leverage;
      }
    }

    // Total equity
    const totalMargin = Array.from(this.positions.values()).reduce((sum, p) => sum + p.margin, 0);
    const equity = this.capital + totalMargin + unrealizedPnL;

    // Calculate drawdown
    const peak = this.equityCurve.length > 0
      ? Math.max(...this.equityCurve.map(p => p.equity), equity)
      : equity;
    const drawdown = peak - equity;

    this.equityCurve.push({
      timestamp: candle.timestamp,
      equity,
      drawdown,
      drawdownPercent: (drawdown / peak) * 100
    });
  }

  /**
   * Calculate position amount based on sizing method
   */
  private calculatePositionAmount(signal: Signal, price: number): number {
    switch (this.config.positionSizing) {
      case 'fixed':
        return this.config.positionSize / price;
        
      case 'percent':
        const riskCapital = this.capital * (this.config.positionSize / 100);
        return riskCapital / price;
        
      case 'kelly':
        // Simplified Kelly criterion
        const kellyFraction = this.calculateKellyFraction();
        const kellyCapital = this.capital * kellyFraction;
        return kellyCapital / price;
        
      default:
        return signal.amount;
    }
  }

  /**
   * Calculate position cost for validation
   */
  private calculatePositionCost(signal: Signal): number {
    const price = signal.price;
    
    switch (this.config.positionSizing) {
      case 'fixed':
        return this.config.positionSize;
      case 'percent':
        return this.capital * (this.config.positionSize / 100);
      case 'kelly':
        return this.capital * this.calculateKellyFraction();
      default:
        return signal.amount * price;
    }
  }

  /**
   * Calculate Kelly fraction from recent trades
   */
  private calculateKellyFraction(): number {
    if (this.trades.length < 10) return 0.02; // Default 2%

    const recentTrades = this.trades.slice(-50);
    const wins = recentTrades.filter(t => t.pnl > 0);
    const losses = recentTrades.filter(t => t.pnl < 0);

    if (wins.length === 0 || losses.length === 0) return 0.02;

    const winRate = wins.length / recentTrades.length;
    const avgWin = wins.reduce((s, t) => s + t.pnlPercent, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPercent, 0) / losses.length);

    if (avgLoss === 0) return 0.02;

    const kelly = winRate - ((1 - winRate) / (avgWin / avgLoss));
    
    // Use half-Kelly for safety
    return Math.max(0.01, Math.min(0.25, kelly * 0.5));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `BT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get lookback data for indicators
   */
  getLookbackData(): OHLCV[] {
    return [...this.lookbackData];
  }

  /**
   * Get current equity
   */
  getCurrentEquity(): number {
    return this.equityCurve.length > 0
      ? this.equityCurve[this.equityCurve.length - 1].equity
      : this.config.initialCapital;
  }

  /**
   * Get open positions
   */
  getOpenPositions(): Position[] {
    return Array.from(this.positions.values());
  }
}
