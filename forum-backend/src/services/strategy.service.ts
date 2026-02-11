import { db, dbHelpers } from '../db/database.ts';
import { Strategy } from '../models/types.ts';
import { v4 as uuidv4 } from 'uuid';

export class StrategyService {
  static async create(
    agentId: string,
    data: {
      name: string;
      description?: string;
      type: string;
      parameters?: Record<string, any>;
      timeframe?: string;
      assets?: string[];
      is_public?: boolean;
    }
  ): Promise<Strategy> {
    const now = new Date().toISOString();
    
    const strategy: Strategy = {
      id: uuidv4(),
      agent_id: agentId,
      name: data.name,
      description: data.description,
      type: data.type,
      parameters: data.parameters ? JSON.stringify(data.parameters) : undefined,
      timeframe: data.timeframe,
      assets: data.assets ? JSON.stringify(data.assets) : undefined,
      is_public: data.is_public !== false ? 1 : 0,
      created_at: now,
      updated_at: now,
    };

    db.data!.strategies.push(strategy);
    await db.write();

    return strategy;
  }

  static getById(id: string): Strategy | undefined {
    return dbHelpers.findStrategy(id);
  }

  static list(options: {
    page?: number;
    limit?: number;
    agent_id?: string;
    type?: string;
    is_public?: boolean;
  } = {}): { strategies: Strategy[]; total: number } {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    let strategies = [...db.data!.strategies];

    if (options.agent_id) {
      strategies = strategies.filter(s => s.agent_id === options.agent_id);
    }
    if (options.type) {
      strategies = strategies.filter(s => s.type === options.type);
    }
    if (options.is_public !== undefined) {
      strategies = strategies.filter(s => s.is_public === (options.is_public ? 1 : 0));
    }

    // Sort by created_at desc
    strategies.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = strategies.length;
    const paged = strategies.slice(offset, offset + limit);

    return { strategies: paged, total };
  }

  static async runBacktest(
    id: string,
    params: {
      start_date: string;
      end_date: string;
      initial_capital: number;
      assets?: string[];
    }
  ): Promise<{
    strategy_id: string;
    period: { start: string; end: string };
    initial_capital: number;
    final_capital: number;
    total_return: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    max_drawdown: number;
    sharpe_ratio: number;
    trades: Array<{
      asset: string;
      direction: string;
      entry_price: number;
      exit_price: number;
      profit_loss: number;
      timestamp: string;
    }>;
  }> {
    const strategy = this.getById(id);
    if (!strategy) throw new Error('Strategy not found');

    // Simulate backtest results
    const days = Math.floor(
      (new Date(params.end_date).getTime() - new Date(params.start_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const totalTrades = Math.floor(days * 0.5);
    const winRate = 0.55 + Math.random() * 0.15;
    const winningTrades = Math.floor(totalTrades * winRate);
    const losingTrades = totalTrades - winningTrades;
    
    const avgWin = params.initial_capital * 0.02;
    const avgLoss = params.initial_capital * 0.015;
    
    const totalReturn = (winningTrades * avgWin) - (losingTrades * avgLoss);
    const finalCapital = params.initial_capital + totalReturn;

    const trades = [];
    const assets = params.assets || ['BTC/USD', 'ETH/USD'];
    
    for (let i = 0; i < Math.min(totalTrades, 20); i++) {
      const isWin = Math.random() < winRate;
      const asset = assets[Math.floor(Math.random() * assets.length)];
      const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
      const entryPrice = 40000 + Math.random() * 10000;
      const change = isWin ? (Math.random() * 0.03 + 0.01) : -(Math.random() * 0.02 + 0.01);
      const exitPrice = direction === 'LONG' ? entryPrice * (1 + change) : entryPrice * (1 - change);
      
      trades.push({
        asset,
        direction,
        entry_price: Math.round(entryPrice * 100) / 100,
        exit_price: Math.round(exitPrice * 100) / 100,
        profit_loss: Math.round((isWin ? avgWin : -avgLoss) * 100) / 100,
        timestamp: new Date(
          new Date(params.start_date).getTime() + Math.random() * days * 24 * 60 * 60 * 1000
        ).toISOString(),
      });
    }

    const results = {
      strategy_id: id,
      period: { start: params.start_date, end: params.end_date },
      initial_capital: params.initial_capital,
      final_capital: Math.round(finalCapital * 100) / 100,
      total_return: Math.round((totalReturn / params.initial_capital) * 10000) / 100,
      total_trades: totalTrades,
      winning_trades: winningTrades,
      losing_trades: losingTrades,
      win_rate: Math.round(winRate * 10000) / 100,
      max_drawdown: Math.round((Math.random() * 10 + 5) * 100) / 100,
      sharpe_ratio: Math.round((Math.random() * 1.5 + 0.5) * 100) / 100,
      trades: trades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    };

    // Store backtest results
    strategy.backtest_results = JSON.stringify(results);
    strategy.updated_at = new Date().toISOString();
    await db.write();

    return results;
  }
}
