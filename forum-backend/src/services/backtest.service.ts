import { db, Backtest } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export type { Backtest };

export class BacktestService {
  static create(agentId: string, data: {
    strategy_id: string;
    symbol: string;
    timeframe: string;
    start_date: string;
    end_date: string;
    initial_capital?: number;
    parameters?: Record<string, any>;
  }): Backtest {
    const backtest: Backtest = {
      id: uuidv4(),
      agent_id: agentId,
      strategy_id: data.strategy_id,
      symbol: data.symbol,
      timeframe: data.timeframe,
      start_date: data.start_date,
      end_date: data.end_date,
      initial_capital: data.initial_capital || 10000,
      parameters: data.parameters ? JSON.stringify(data.parameters) : undefined,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    db.data!.backtests.push(backtest);
    db.write();

    return backtest;
  }

  static getById(id: string): Backtest | undefined {
    return db.data!.backtests.find(b => b.id === id);
  }

  static list(options: {
    agentId?: string;
    strategyId?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): { backtests: Backtest[]; total: number } {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 50);
    const offset = (page - 1) * limit;

    let backtests = [...db.data!.backtests];

    if (options.agentId) {
      backtests = backtests.filter(b => b.agent_id === options.agentId);
    }
    if (options.strategyId) {
      backtests = backtests.filter(b => b.strategy_id === options.strategyId);
    }
    if (options.status) {
      backtests = backtests.filter(b => b.status === options.status);
    }

    // Sort by created_at desc
    backtests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = backtests.length;
    const paged = backtests.slice(offset, offset + limit);

    return { backtests: paged, total };
  }

  static startBacktest(id: string): void {
    const idx = db.data!.backtests.findIndex(b => b.id === id);
    if (idx !== -1) {
      db.data!.backtests[idx].status = 'running';
      db.data!.backtests[idx].started_at = new Date().toISOString();
      db.write();
    }
  }

  static completeBacktest(id: string, results: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    net_profit: number;
    net_profit_pct: number;
    max_drawdown: number;
    sharpe_ratio: number;
    profit_factor: number;
    win_rate: number;
    equity_curve?: number[];
    trades?: any[];
  }): Backtest | undefined {
    const idx = db.data!.backtests.findIndex(b => b.id === id);
    if (idx === -1) return undefined;

    db.data!.backtests[idx] = {
      ...db.data!.backtests[idx],
      status: 'completed',
      total_trades: results.total_trades,
      winning_trades: results.winning_trades,
      losing_trades: results.losing_trades,
      net_profit: results.net_profit,
      net_profit_pct: results.net_profit_pct,
      max_drawdown: results.max_drawdown,
      sharpe_ratio: results.sharpe_ratio,
      profit_factor: results.profit_factor,
      win_rate: results.win_rate,
      equity_curve: results.equity_curve ? JSON.stringify(results.equity_curve) : undefined,
      trades: results.trades ? JSON.stringify(results.trades) : undefined,
      completed_at: new Date().toISOString(),
    };

    db.write();
    return db.data!.backtests[idx];
  }

  static failBacktest(id: string, errorMessage: string): Backtest | undefined {
    const idx = db.data!.backtests.findIndex(b => b.id === id);
    if (idx === -1) return undefined;

    db.data!.backtests[idx].status = 'failed';
    db.data!.backtests[idx].error_message = errorMessage;
    db.data!.backtests[idx].completed_at = new Date().toISOString();

    db.write();
    return db.data!.backtests[idx];
  }

  static getStrategyStats(strategyId: string): {
    total_backtests: number;
    avg_return: number | null;
    avg_sharpe: number | null;
    best_return: number | null;
    worst_drawdown: number | null;
  } {
    const completed = db.data!.backtests.filter(
      b => b.strategy_id === strategyId && b.status === 'completed'
    );

    if (completed.length === 0) {
      return {
        total_backtests: 0,
        avg_return: null,
        avg_sharpe: null,
        best_return: null,
        worst_drawdown: null,
      };
    }

    const returns = completed.map(b => b.net_profit_pct || 0);
    const sharpes = completed.map(b => b.sharpe_ratio || 0);
    const drawdowns = completed.map(b => b.max_drawdown || 0);

    return {
      total_backtests: completed.length,
      avg_return: returns.reduce((a, b) => a + b, 0) / returns.length,
      avg_sharpe: sharpes.reduce((a, b) => a + b, 0) / sharpes.length,
      best_return: Math.max(...returns),
      worst_drawdown: Math.max(...drawdowns),
    };
  }

  // Simple backtest simulation (placeholder - replace with real engine)
  static async runBacktest(backtest: Backtest): Promise<void> {
    BacktestService.startBacktest(backtest.id);

    try {
      // Simulate backtest execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate mock results (replace with real backtest engine)
      const totalTrades = Math.floor(Math.random() * 100) + 20;
      const winRate = 0.4 + Math.random() * 0.3;
      const winningTrades = Math.floor(totalTrades * winRate);
      const losingTrades = totalTrades - winningTrades;
      
      const avgWin = 1.5 + Math.random();
      const avgLoss = 1;
      const profitFactor = (winningTrades * avgWin) / (losingTrades * avgLoss);
      
      const netProfitPct = ((winningTrades * avgWin) - (losingTrades * avgLoss)) / 100 * 100;
      const netProfit = backtest.initial_capital * (netProfitPct / 100);

      BacktestService.completeBacktest(backtest.id, {
        total_trades: totalTrades,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        net_profit: netProfit,
        net_profit_pct: netProfitPct,
        max_drawdown: 5 + Math.random() * 15,
        sharpe_ratio: 0.5 + Math.random() * 2,
        profit_factor: profitFactor,
        win_rate: winRate * 100,
        equity_curve: Array.from({ length: 100 }, (_, i) => 
          backtest.initial_capital * (1 + (netProfitPct / 100) * (i / 100) + (Math.random() - 0.5) * 0.02)
        ),
      });
    } catch (error: any) {
      BacktestService.failBacktest(backtest.id, error.message);
    }
  }
}
