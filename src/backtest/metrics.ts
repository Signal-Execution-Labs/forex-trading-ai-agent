/**
 * K.I.T. Backtest Metrics
 * Performance metrics calculation for backtesting
 */

export interface BacktestTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  amount: number;
  entryTime: Date;
  exitTime: Date;
  strategy: string;
  pnl: number;
  pnlPercent: number;
  fees: number;
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface PerformanceMetrics {
  // Basic Metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // Profit/Loss
  totalPnL: number;
  totalPnLPercent: number;
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  profitFactor: number;
  
  // Average Trade
  avgWin: number;
  avgLoss: number;
  avgTrade: number;
  avgWinPercent: number;
  avgLossPercent: number;
  avgTradePercent: number;
  
  // Risk Metrics
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownDuration: number; // in days
  recoveryFactor: number;
  
  // Risk-Adjusted Returns
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  
  // Trade Statistics
  avgHoldingPeriod: number; // in hours
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  largestWin: number;
  largestLoss: number;
  
  // Expectancy
  expectancy: number;
  expectancyPercent: number;
  
  // Time Analysis
  startDate: Date;
  endDate: Date;
  tradingDays: number;
  tradesPerDay: number;
  
  // Initial/Final
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  annualizedReturn: number;
  
  // Fees
  totalFees: number;
}

export interface StrategyMetrics extends PerformanceMetrics {
  strategyName: string;
}

export class MetricsCalculator {
  private riskFreeRate: number = 0.02; // 2% annual risk-free rate (adjustable)

  /**
   * Calculate all performance metrics from trades
   */
  calculateMetrics(
    trades: BacktestTrade[],
    equityCurve: EquityPoint[],
    initialCapital: number
  ): PerformanceMetrics {
    if (trades.length === 0) {
      return this.getEmptyMetrics(initialCapital);
    }

    // Sort trades by exit time
    const sortedTrades = [...trades].sort((a, b) => 
      a.exitTime.getTime() - b.exitTime.getTime()
    );

    // Basic counts
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    const breakEvenTrades = trades.filter(t => t.pnl === 0);

    // P&L calculations
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const totalPnL = grossProfit - grossLoss;
    const totalFees = trades.reduce((sum, t) => sum + t.fees, 0);
    const netProfit = totalPnL - totalFees;

    // Final capital
    const finalCapital = equityCurve.length > 0 
      ? equityCurve[equityCurve.length - 1].equity 
      : initialCapital + netProfit;

    // Drawdown analysis
    const { maxDrawdown, maxDrawdownPercent, maxDrawdownDuration } = 
      this.calculateDrawdownMetrics(equityCurve);

    // Date analysis
    const startDate = sortedTrades[0].entryTime;
    const endDate = sortedTrades[sortedTrades.length - 1].exitTime;
    const tradingDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Consecutive wins/losses
    const { maxConsecutiveWins, maxConsecutiveLosses } = 
      this.calculateConsecutiveMetrics(sortedTrades);

    // Holding period
    const holdingPeriods = trades.map(t => 
      (t.exitTime.getTime() - t.entryTime.getTime()) / (60 * 60 * 1000)
    );
    const avgHoldingPeriod = holdingPeriods.reduce((a, b) => a + b, 0) / holdingPeriods.length;

    // Daily returns for Sharpe/Sortino
    const dailyReturns = this.calculateDailyReturns(equityCurve);

    // Risk-adjusted metrics
    const sharpeRatio = this.calculateSharpeRatio(dailyReturns);
    const sortinoRatio = this.calculateSortinoRatio(dailyReturns);
    const totalReturn = (finalCapital - initialCapital) / initialCapital;
    const calmarRatio = maxDrawdownPercent > 0 
      ? (totalReturn / maxDrawdownPercent) 
      : 0;

    // Annualized return
    const years = tradingDays / 365;
    const annualizedReturn = years > 0 
      ? Math.pow(1 + totalReturn, 1 / years) - 1 
      : totalReturn;

    return {
      // Basic
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: winningTrades.length / trades.length,

      // P&L
      totalPnL,
      totalPnLPercent: (totalPnL / initialCapital) * 100,
      grossProfit,
      grossLoss,
      netProfit,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : Infinity,

      // Average Trade
      avgWin: winningTrades.length > 0 
        ? grossProfit / winningTrades.length 
        : 0,
      avgLoss: losingTrades.length > 0 
        ? grossLoss / losingTrades.length 
        : 0,
      avgTrade: totalPnL / trades.length,
      avgWinPercent: winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / winningTrades.length
        : 0,
      avgLossPercent: losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnlPercent), 0) / losingTrades.length
        : 0,
      avgTradePercent: trades.reduce((sum, t) => sum + t.pnlPercent, 0) / trades.length,

      // Risk
      maxDrawdown,
      maxDrawdownPercent,
      maxDrawdownDuration,
      recoveryFactor: maxDrawdown > 0 ? netProfit / maxDrawdown : Infinity,

      // Risk-Adjusted
      sharpeRatio,
      sortinoRatio,
      calmarRatio,

      // Trade Stats
      avgHoldingPeriod,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      largestWin: winningTrades.length > 0 
        ? Math.max(...winningTrades.map(t => t.pnl)) 
        : 0,
      largestLoss: losingTrades.length > 0 
        ? Math.max(...losingTrades.map(t => Math.abs(t.pnl))) 
        : 0,

      // Expectancy
      expectancy: this.calculateExpectancy(trades, initialCapital),
      expectancyPercent: this.calculateExpectancyPercent(trades),

      // Time
      startDate,
      endDate,
      tradingDays,
      tradesPerDay: tradingDays > 0 ? trades.length / tradingDays : 0,

      // Capital
      initialCapital,
      finalCapital,
      totalReturn: totalReturn * 100,
      annualizedReturn: annualizedReturn * 100,

      // Fees
      totalFees
    };
  }

  /**
   * Calculate metrics per strategy
   */
  calculateStrategyMetrics(
    trades: BacktestTrade[],
    equityCurve: EquityPoint[],
    initialCapital: number
  ): Map<string, StrategyMetrics> {
    const byStrategy = new Map<string, BacktestTrade[]>();
    
    for (const trade of trades) {
      const strategyTrades = byStrategy.get(trade.strategy) || [];
      strategyTrades.push(trade);
      byStrategy.set(trade.strategy, strategyTrades);
    }

    const result = new Map<string, StrategyMetrics>();
    
    for (const [strategy, strategyTrades] of byStrategy) {
      // Build equity curve for this strategy
      const strategyEquity = this.buildStrategyEquityCurve(
        strategyTrades, 
        initialCapital / byStrategy.size
      );
      
      const metrics = this.calculateMetrics(
        strategyTrades, 
        strategyEquity, 
        initialCapital / byStrategy.size
      );
      
      result.set(strategy, {
        ...metrics,
        strategyName: strategy
      });
    }

    return result;
  }

  /**
   * Calculate Sharpe Ratio
   */
  calculateSharpeRatio(dailyReturns: number[]): number {
    if (dailyReturns.length < 2) return 0;

    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const stdDev = this.standardDeviation(dailyReturns);
    
    if (stdDev === 0) return 0;

    // Annualized: multiply by sqrt(252) trading days
    const dailyRiskFree = this.riskFreeRate / 252;
    const excessReturn = avgReturn - dailyRiskFree;
    
    return (excessReturn / stdDev) * Math.sqrt(252);
  }

  /**
   * Calculate Sortino Ratio (only considers downside deviation)
   */
  calculateSortinoRatio(dailyReturns: number[]): number {
    if (dailyReturns.length < 2) return 0;

    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    
    // Downside deviation - only negative returns
    const negativeReturns = dailyReturns.filter(r => r < 0);
    if (negativeReturns.length === 0) return Infinity;
    
    const downsideDev = this.standardDeviation(negativeReturns);
    if (downsideDev === 0) return Infinity;

    const dailyRiskFree = this.riskFreeRate / 252;
    const excessReturn = avgReturn - dailyRiskFree;
    
    return (excessReturn / downsideDev) * Math.sqrt(252);
  }

  /**
   * Calculate Maximum Drawdown metrics
   */
  calculateDrawdownMetrics(equityCurve: EquityPoint[]): {
    maxDrawdown: number;
    maxDrawdownPercent: number;
    maxDrawdownDuration: number;
  } {
    if (equityCurve.length === 0) {
      return { maxDrawdown: 0, maxDrawdownPercent: 0, maxDrawdownDuration: 0 };
    }

    let peak = equityCurve[0].equity;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let drawdownStart: Date | null = null;
    let maxDrawdownDuration = 0;
    let currentDrawdownDuration = 0;

    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
        drawdownStart = null;
        currentDrawdownDuration = 0;
      } else {
        const drawdown = peak - point.equity;
        const drawdownPercent = drawdown / peak;

        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownPercent = drawdownPercent;
        }

        if (!drawdownStart) {
          drawdownStart = point.timestamp;
        }
        
        currentDrawdownDuration = (point.timestamp.getTime() - drawdownStart.getTime()) / (24 * 60 * 60 * 1000);
        if (currentDrawdownDuration > maxDrawdownDuration) {
          maxDrawdownDuration = currentDrawdownDuration;
        }
      }
    }

    return {
      maxDrawdown,
      maxDrawdownPercent: maxDrawdownPercent * 100,
      maxDrawdownDuration
    };
  }

  /**
   * Calculate expectancy (expected value per trade)
   */
  calculateExpectancy(trades: BacktestTrade[], initialCapital: number): number {
    if (trades.length === 0) return 0;

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    const winRate = winningTrades.length / trades.length;
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0)) / losingTrades.length
      : 0;

    return (winRate * avgWin) - ((1 - winRate) * avgLoss);
  }

  /**
   * Calculate expectancy in percent
   */
  calculateExpectancyPercent(trades: BacktestTrade[]): number {
    if (trades.length === 0) return 0;

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    const winRate = winningTrades.length / trades.length;
    const avgWinPercent = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / winningTrades.length
      : 0;
    const avgLossPercent = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnlPercent, 0)) / losingTrades.length
      : 0;

    return (winRate * avgWinPercent) - ((1 - winRate) * avgLossPercent);
  }

  /**
   * Set risk-free rate for Sharpe/Sortino calculations
   */
  setRiskFreeRate(rate: number): void {
    this.riskFreeRate = rate;
  }

  // ===== HELPER METHODS =====

  private calculateDailyReturns(equityCurve: EquityPoint[]): number[] {
    if (equityCurve.length < 2) return [];

    const returns: number[] = [];
    
    for (let i = 1; i < equityCurve.length; i++) {
      const prevEquity = equityCurve[i - 1].equity;
      const currentEquity = equityCurve[i].equity;
      
      if (prevEquity > 0) {
        returns.push((currentEquity - prevEquity) / prevEquity);
      }
    }

    return returns;
  }

  private calculateConsecutiveMetrics(trades: BacktestTrade[]): {
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
  } {
    let maxWins = 0;
    let maxLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const trade of trades) {
      if (trade.pnl > 0) {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
      } else if (trade.pnl < 0) {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
      }
    }

    return { maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses };
  }

  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.sqrt(avgSquaredDiff);
  }

  private buildStrategyEquityCurve(trades: BacktestTrade[], initialCapital: number): EquityPoint[] {
    const sorted = [...trades].sort((a, b) => a.exitTime.getTime() - b.exitTime.getTime());
    const curve: EquityPoint[] = [];
    let equity = initialCapital;
    let peak = initialCapital;

    curve.push({
      timestamp: sorted[0]?.entryTime || new Date(),
      equity: initialCapital,
      drawdown: 0,
      drawdownPercent: 0
    });

    for (const trade of sorted) {
      equity += trade.pnl - trade.fees;
      peak = Math.max(peak, equity);
      const drawdown = peak - equity;

      curve.push({
        timestamp: trade.exitTime,
        equity,
        drawdown,
        drawdownPercent: (drawdown / peak) * 100
      });
    }

    return curve;
  }

  private getEmptyMetrics(initialCapital: number): PerformanceMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      grossProfit: 0,
      grossLoss: 0,
      netProfit: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgTrade: 0,
      avgWinPercent: 0,
      avgLossPercent: 0,
      avgTradePercent: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      maxDrawdownDuration: 0,
      recoveryFactor: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      avgHoldingPeriod: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      largestWin: 0,
      largestLoss: 0,
      expectancy: 0,
      expectancyPercent: 0,
      startDate: new Date(),
      endDate: new Date(),
      tradingDays: 0,
      tradesPerDay: 0,
      initialCapital,
      finalCapital: initialCapital,
      totalReturn: 0,
      annualizedReturn: 0,
      totalFees: 0
    };
  }
}
