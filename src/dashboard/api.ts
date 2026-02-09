/**
 * K.I.T. Dashboard REST API
 * Endpoints for portfolio, positions, trades, and metrics
 */

import { Express, Request, Response, Router } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('DashboardAPI');

// Type definitions
interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  openedAt: Date;
  strategy: string;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  fee: number;
  pnl?: number;
  strategy: string;
  executedAt: Date;
}

interface PortfolioSummary {
  totalEquity: number;
  availableBalance: number;
  unrealizedPnl: number;
  realizedPnlToday: number;
  totalPositions: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

interface StrategyPerformance {
  name: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  maxWin: number;
  maxLoss: number;
  sharpeRatio: number;
  isActive: boolean;
}

interface RiskMetrics {
  portfolioVaR: number;
  dailyVaR: number;
  maxPositionSize: number;
  currentExposure: number;
  marginUsed: number;
  marginAvailable: number;
  leverageUsed: number;
  riskScore: number;
}

// Mock data store (replace with actual data sources)
const mockStore = {
  getPortfolio(): PortfolioSummary {
    return {
      totalEquity: 125847.32,
      availableBalance: 98234.18,
      unrealizedPnl: 2847.14,
      realizedPnlToday: 1523.67,
      totalPositions: 5,
      winRate: 0.68,
      sharpeRatio: 1.87,
      maxDrawdown: 0.082,
    };
  },

  getPositions(): Position[] {
    return [
      {
        id: 'pos-1',
        symbol: 'BTC/USDT',
        side: 'long',
        size: 0.5,
        entryPrice: 42150.0,
        currentPrice: 43280.0,
        pnl: 565.0,
        pnlPercent: 2.68,
        openedAt: new Date(Date.now() - 3600000 * 4),
        strategy: 'TrendFollower',
      },
      {
        id: 'pos-2',
        symbol: 'ETH/USDT',
        side: 'long',
        size: 5.0,
        entryPrice: 2280.0,
        currentPrice: 2345.0,
        pnl: 325.0,
        pnlPercent: 2.85,
        openedAt: new Date(Date.now() - 3600000 * 8),
        strategy: 'Momentum',
      },
      {
        id: 'pos-3',
        symbol: 'SOL/USDT',
        side: 'short',
        size: 50.0,
        entryPrice: 98.5,
        currentPrice: 96.2,
        pnl: 115.0,
        pnlPercent: 2.34,
        openedAt: new Date(Date.now() - 3600000 * 2),
        strategy: 'MeanReversion',
      },
    ];
  },

  getTrades(limit: number = 50): Trade[] {
    const trades: Trade[] = [];
    const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'DOT/USDT'];
    const strategies = ['TrendFollower', 'Momentum', 'MeanReversion', 'RSI', 'MACD'];

    for (let i = 0; i < limit; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const pnl = (Math.random() - 0.4) * 500;

      trades.push({
        id: `trade-${i}`,
        symbol,
        side,
        size: Math.random() * 10,
        price: 1000 + Math.random() * 50000,
        fee: Math.random() * 5,
        pnl: side === 'sell' ? pnl : undefined,
        strategy: strategies[Math.floor(Math.random() * strategies.length)],
        executedAt: new Date(Date.now() - i * 3600000),
      });
    }

    return trades;
  },

  getStrategies(): StrategyPerformance[] {
    return [
      {
        name: 'TrendFollower',
        totalTrades: 156,
        winningTrades: 102,
        losingTrades: 54,
        winRate: 0.654,
        totalPnl: 8432.50,
        avgPnl: 54.05,
        maxWin: 1250.0,
        maxLoss: -380.0,
        sharpeRatio: 2.1,
        isActive: true,
      },
      {
        name: 'Momentum',
        totalTrades: 203,
        winningTrades: 142,
        losingTrades: 61,
        winRate: 0.699,
        totalPnl: 12847.30,
        avgPnl: 63.29,
        maxWin: 2100.0,
        maxLoss: -520.0,
        sharpeRatio: 2.4,
        isActive: true,
      },
      {
        name: 'MeanReversion',
        totalTrades: 89,
        winningTrades: 58,
        losingTrades: 31,
        winRate: 0.652,
        totalPnl: 4521.80,
        avgPnl: 50.81,
        maxWin: 890.0,
        maxLoss: -290.0,
        sharpeRatio: 1.8,
        isActive: true,
      },
      {
        name: 'RSI',
        totalTrades: 124,
        winningTrades: 78,
        losingTrades: 46,
        winRate: 0.629,
        totalPnl: 3892.40,
        avgPnl: 31.39,
        maxWin: 650.0,
        maxLoss: -210.0,
        sharpeRatio: 1.5,
        isActive: false,
      },
      {
        name: 'MACD',
        totalTrades: 178,
        winningTrades: 115,
        losingTrades: 63,
        winRate: 0.646,
        totalPnl: 6234.70,
        avgPnl: 35.03,
        maxWin: 980.0,
        maxLoss: -340.0,
        sharpeRatio: 1.9,
        isActive: true,
      },
    ];
  },

  getRiskMetrics(): RiskMetrics {
    return {
      portfolioVaR: 2500.0,
      dailyVaR: 1250.0,
      maxPositionSize: 10000.0,
      currentExposure: 27613.14,
      marginUsed: 5522.63,
      marginAvailable: 92724.69,
      leverageUsed: 2.5,
      riskScore: 35,
    };
  },

  getPriceHistory(symbol: string, timeframe: string = '1h', limit: number = 100) {
    const prices: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
    const now = Date.now();
    const intervals: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };

    const interval = intervals[timeframe] || intervals['1h'];
    let basePrice = symbol.includes('BTC') ? 43000 : symbol.includes('ETH') ? 2300 : 100;

    for (let i = limit - 1; i >= 0; i--) {
      const volatility = basePrice * 0.02;
      const change = (Math.random() - 0.5) * volatility;
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;

      prices.push({
        time: now - i * interval,
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000000,
      });

      basePrice = close;
    }

    return prices;
  },
};

export function setupApiRoutes(app: Express): void {
  const router = Router();

  // Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Portfolio summary
  router.get('/portfolio', (_req: Request, res: Response) => {
    try {
      const portfolio = mockStore.getPortfolio();
      res.json(portfolio);
    } catch (error) {
      logger.error('Error fetching portfolio:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
  });

  // Open positions
  router.get('/positions', (_req: Request, res: Response) => {
    try {
      const positions = mockStore.getPositions();
      res.json(positions);
    } catch (error) {
      logger.error('Error fetching positions:', error);
      res.status(500).json({ error: 'Failed to fetch positions' });
    }
  });

  // Trade history
  router.get('/trades', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = mockStore.getTrades(limit);
      res.json(trades);
    } catch (error) {
      logger.error('Error fetching trades:', error);
      res.status(500).json({ error: 'Failed to fetch trades' });
    }
  });

  // Strategy performance
  router.get('/strategies', (_req: Request, res: Response) => {
    try {
      const strategies = mockStore.getStrategies();
      res.json(strategies);
    } catch (error) {
      logger.error('Error fetching strategies:', error);
      res.status(500).json({ error: 'Failed to fetch strategies' });
    }
  });

  // Risk metrics
  router.get('/risk', (_req: Request, res: Response) => {
    try {
      const metrics = mockStore.getRiskMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error('Error fetching risk metrics:', error);
      res.status(500).json({ error: 'Failed to fetch risk metrics' });
    }
  });

  // Price data
  router.get('/prices/:symbol', (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const timeframe = (req.query.timeframe as string) || '1h';
      const limit = parseInt(req.query.limit as string) || 100;
      const prices = mockStore.getPriceHistory(symbol, timeframe, limit);
      res.json(prices);
    } catch (error) {
      logger.error('Error fetching prices:', error);
      res.status(500).json({ error: 'Failed to fetch prices' });
    }
  });

  // Dashboard stats (aggregated)
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const portfolio = mockStore.getPortfolio();
      const positions = mockStore.getPositions();
      const strategies = mockStore.getStrategies();
      const risk = mockStore.getRiskMetrics();

      res.json({
        portfolio,
        positionCount: positions.length,
        activeStrategies: strategies.filter((s) => s.isActive).length,
        totalStrategies: strategies.length,
        riskScore: risk.riskScore,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // Mount API routes
  app.use('/api', router);
  logger.info('API routes configured');
}
