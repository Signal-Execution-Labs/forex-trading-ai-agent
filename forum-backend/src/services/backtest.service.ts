import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface Backtest {
  id: string;
  agent_id: string;
  strategy_id: string;
  symbol: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  parameters?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  // Results
  total_trades?: number;
  winning_trades?: number;
  losing_trades?: number;
  net_profit?: number;
  net_profit_pct?: number;
  max_drawdown?: number;
  sharpe_ratio?: number;
  profit_factor?: number;
  win_rate?: number;
  equity_curve?: string;
  trades?: string;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export class BacktestService {
  static init() {
    // Create backtests table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS backtests (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        strategy_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        initial_capital REAL DEFAULT 10000,
        parameters TEXT,
        status TEXT DEFAULT 'pending',
        total_trades INTEGER,
        winning_trades INTEGER,
        losing_trades INTEGER,
        net_profit REAL,
        net_profit_pct REAL,
        max_drawdown REAL,
        sharpe_ratio REAL,
        profit_factor REAL,
        win_rate REAL,
        equity_curve TEXT,
        trades TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (strategy_id) REFERENCES strategies(id)
      )
    `);
  }

  static create(agentId: string, data: {
    strategy_id: string;
    symbol: string;
    timeframe: string;
    start_date: string;
    end_date: string;
    initial_capital?: number;
    parameters?: Record<string, any>;
  }): Backtest {
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO backtests (id, agent_id, strategy_id, symbol, timeframe, start_date, end_date, initial_capital, parameters)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      agentId,
      data.strategy_id,
      data.symbol,
      data.timeframe,
      data.start_date,
      data.end_date,
      data.initial_capital || 10000,
      data.parameters ? JSON.stringify(data.parameters) : null
    );

    return this.getById(id)!;
  }

  static getById(id: string): Backtest | null {
    const stmt = db.prepare('SELECT * FROM backtests WHERE id = ?');
    return stmt.get(id) as Backtest | null;
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

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.agentId) {
      conditions.push('agent_id = ?');
      params.push(options.agentId);
    }
    if (options.strategyId) {
      conditions.push('strategy_id = ?');
      params.push(options.strategyId);
    }
    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM backtests ${whereClause}`);
    const { count: total } = countStmt.get(...params) as { count: number };

    const stmt = db.prepare(`
      SELECT * FROM backtests ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const backtests = stmt.all(...params, limit, offset) as Backtest[];
    return { backtests, total };
  }

  static startBacktest(id: string): void {
    const stmt = db.prepare(`
      UPDATE backtests 
      SET status = 'running', started_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(id);
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
  }): Backtest | null {
    const stmt = db.prepare(`
      UPDATE backtests SET
        status = 'completed',
        total_trades = ?,
        winning_trades = ?,
        losing_trades = ?,
        net_profit = ?,
        net_profit_pct = ?,
        max_drawdown = ?,
        sharpe_ratio = ?,
        profit_factor = ?,
        win_rate = ?,
        equity_curve = ?,
        trades = ?,
        completed_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      results.total_trades,
      results.winning_trades,
      results.losing_trades,
      results.net_profit,
      results.net_profit_pct,
      results.max_drawdown,
      results.sharpe_ratio,
      results.profit_factor,
      results.win_rate,
      results.equity_curve ? JSON.stringify(results.equity_curve) : null,
      results.trades ? JSON.stringify(results.trades) : null,
      id
    );

    return this.getById(id);
  }

  static failBacktest(id: string, errorMessage: string): Backtest | null {
    const stmt = db.prepare(`
      UPDATE backtests SET
        status = 'failed',
        error_message = ?,
        completed_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(errorMessage, id);

    return this.getById(id);
  }

  static getStrategyStats(strategyId: string): {
    total_backtests: number;
    avg_return: number | null;
    avg_sharpe: number | null;
    best_return: number | null;
    worst_drawdown: number | null;
  } {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_backtests,
        AVG(net_profit_pct) as avg_return,
        AVG(sharpe_ratio) as avg_sharpe,
        MAX(net_profit_pct) as best_return,
        MAX(max_drawdown) as worst_drawdown
      FROM backtests 
      WHERE strategy_id = ? AND status = 'completed'
    `);
    
    return stmt.get(strategyId) as any;
  }

  // Simple backtest simulation (placeholder - replace with real engine)
  static async runBacktest(backtest: Backtest): Promise<void> {
    this.startBacktest(backtest.id);

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

      this.completeBacktest(backtest.id, {
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
      this.failBacktest(backtest.id, error.message);
    }
  }
}

// Initialize table
BacktestService.init();
