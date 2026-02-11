import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// MARKET REPLAY - Historical market replay for practice and learning
// ============================================================================

interface ReplaySession {
  id: string;
  agentId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  currentDate: string;
  speed: number;
  status: 'paused' | 'playing' | 'ended';
  mode: 'practice' | 'backtest' | 'learning';
  trades: ReplayTrade[];
  balance: number;
  initialBalance: number;
  equity: number;
  createdAt: string;
  settings: { showFuture: boolean; allowPeeking: boolean; recordDecisions: boolean };
}

interface ReplayTrade {
  id: string;
  type: 'long' | 'short';
  symbol: string;
  entryPrice: number;
  entryTime: string;
  exitPrice?: number;
  exitTime?: string;
  size: number;
  pnl?: number;
  status: 'open' | 'closed' | 'stopped';
  stopLoss?: number;
  takeProfit?: number;
  notes?: string;
}

interface HistoricalCandle { time: number; open: number; high: number; low: number; close: number; volume: number; }

const replaySessions: Map<string, ReplaySession> = new Map();

function generateHistoricalData(symbol: string, startDate: Date, endDate: Date): HistoricalCandle[] {
  const candles: HistoricalCandle[] = [];
  const basePrices: Record<string, number> = { 'BTC/USD': 45000, 'ETH/USD': 2800, 'EUR/USD': 1.0850, 'GBP/USD': 1.2650, 'XAU/USD': 2050, 'SPY': 485, 'QQQ': 420, 'NVDA': 750 };
  let price = basePrices[symbol.toUpperCase()] || 100;
  let current = startDate.getTime();
  const end = endDate.getTime();
  const step = 3600000; // 1h
  
  while (current <= end) {
    const volatility = symbol.includes('BTC') ? 0.02 : symbol.includes('EUR') ? 0.002 : 0.01;
    const change = (Math.random() - 0.5 + 0.0001) * volatility;
    const open = price;
    price = price * (1 + change);
    const high = Math.max(open, price) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, price) * (1 - Math.random() * volatility * 0.5);
    candles.push({ time: current, open: Math.round(open * 10000) / 10000, high: Math.round(high * 10000) / 10000, low: Math.round(low * 10000) / 10000, close: Math.round(price * 10000) / 10000, volume: Math.floor(10000 + Math.random() * 90000) });
    current += step;
  }
  return candles;
}

export async function replayRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {

  // GET /api/replay/scenarios
  fastify.get('/scenarios', {
    schema: { description: 'Get available replay scenarios', tags: ['Replay'] },
  }, async () => ({
    scenarios: [
      { id: 'btc-2024-rally', name: 'Bitcoin 2024 Rally', symbol: 'BTC/USD', startDate: '2024-01-01', endDate: '2024-03-15', description: 'Practice trading during the Bitcoin ETF approval rally', difficulty: 'intermediate', keyEvents: ['ETF Approval', 'New ATH', 'Correction'] },
      { id: 'nvda-earnings-q4', name: 'NVIDIA Q4 Earnings', symbol: 'NVDA', startDate: '2024-02-15', endDate: '2024-02-28', description: 'Trade around NVIDIA earnings announcement', difficulty: 'advanced', keyEvents: ['Pre-earnings', 'Earnings Beat', 'Gap Up'] },
      { id: 'eurusd-ecb-2024', name: 'EUR/USD ECB Decision', symbol: 'EUR/USD', startDate: '2024-03-01', endDate: '2024-03-15', description: 'Trade the Euro around ECB rate decision', difficulty: 'intermediate', keyEvents: ['Rate Decision', 'Press Conference'] },
      { id: 'gold-geopolitical', name: 'Gold Safe Haven Move', symbol: 'XAU/USD', startDate: '2024-01-15', endDate: '2024-02-15', description: 'Trade gold during geopolitical tension', difficulty: 'beginner', keyEvents: ['Risk-Off', 'Rally', 'Consolidation'] },
      { id: 'spy-correction', name: 'S&P 500 Correction', symbol: 'SPY', startDate: '2024-03-15', endDate: '2024-04-15', description: 'Practice managing drawdown during correction', difficulty: 'advanced', keyEvents: ['Top Formation', 'Sell-Off', 'Recovery'] },
    ]
  }));

  // POST /api/replay/start
  fastify.post<{ Body: { agentId: string; symbol: string; startDate: string; endDate: string; initialBalance?: number; speed?: number; mode?: string; settings?: any } }>('/start', {
    schema: { description: 'Start a new replay session', tags: ['Replay'] },
  }, async (request, reply) => {
    const { agentId, symbol, startDate, endDate, initialBalance = 10000, speed = 1, mode = 'practice', settings = {} } = request.body;
    if (!agentId || !symbol || !startDate || !endDate) return reply.code(400).send({ error: 'Required: agentId, symbol, startDate, endDate' });
    
    const session: ReplaySession = { id: uuidv4(), agentId, symbol: symbol.toUpperCase(), startDate, endDate, currentDate: startDate, speed, status: 'paused', mode: mode as any, trades: [], balance: initialBalance, initialBalance, equity: initialBalance, createdAt: new Date().toISOString(), settings: { showFuture: settings.showFuture ?? false, allowPeeking: settings.allowPeeking ?? false, recordDecisions: settings.recordDecisions ?? true } };
    replaySessions.set(session.id, session);
    const candles = generateHistoricalData(symbol, new Date(startDate), new Date(startDate));
    return { session, initialCandles: candles };
  });

  // GET /api/replay/leaderboard
  fastify.get<{ Querystring: { symbol?: string; period?: string } }>('/leaderboard', {
    schema: { description: 'Get replay practice leaderboard', tags: ['Replay'] },
  }, async (request) => ({
    leaderboard: [
      { agentId: 'agent_12', sessions: 15, avgReturn: 8.5, bestReturn: 24.3, totalTrades: 156 },
      { agentId: 'agent_45', sessions: 23, avgReturn: 6.2, bestReturn: 18.7, totalTrades: 234 },
      { agentId: 'agent_7', sessions: 8, avgReturn: 5.8, bestReturn: 15.2, totalTrades: 98 },
      { agentId: 'agent_89', sessions: 31, avgReturn: 4.1, bestReturn: 22.1, totalTrades: 312 },
      { agentId: 'agent_23', sessions: 19, avgReturn: 3.9, bestReturn: 12.8, totalTrades: 187 },
    ],
    period: request.query.period || '7d',
    symbol: request.query.symbol || 'all',
  }));

  // GET /api/replay/agent/:agentId
  fastify.get<{ Params: { agentId: string } }>('/agent/:agentId', {
    schema: { description: 'Get agent replay sessions', tags: ['Replay'] },
  }, async (request) => ({
    sessions: Array.from(replaySessions.values()).filter(s => s.agentId === request.params.agentId).map(s => ({ id: s.id, symbol: s.symbol, status: s.status, mode: s.mode, equity: s.equity, returnPct: ((s.equity - s.initialBalance) / s.initialBalance) * 100, createdAt: s.createdAt }))
  }));

  // GET /api/replay/:sessionId
  fastify.get<{ Params: { sessionId: string } }>('/:sessionId', {
    schema: { description: 'Get session state', tags: ['Replay'] },
  }, async (request, reply) => {
    const session = replaySessions.get(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    return { session };
  });

  // POST /api/replay/:sessionId/play
  fastify.post<{ Params: { sessionId: string } }>('/:sessionId/play', {
    schema: { description: 'Start/resume playback', tags: ['Replay'] },
  }, async (request, reply) => {
    const session = replaySessions.get(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    session.status = 'playing';
    return { session };
  });

  // POST /api/replay/:sessionId/pause
  fastify.post<{ Params: { sessionId: string } }>('/:sessionId/pause', {
    schema: { description: 'Pause playback', tags: ['Replay'] },
  }, async (request, reply) => {
    const session = replaySessions.get(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    session.status = 'paused';
    return { session };
  });

  // POST /api/replay/:sessionId/speed
  fastify.post<{ Params: { sessionId: string }; Body: { speed: number } }>('/:sessionId/speed', {
    schema: { description: 'Change playback speed', tags: ['Replay'] },
  }, async (request, reply) => {
    const { speed } = request.body;
    const session = replaySessions.get(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    if (![1, 2, 5, 10, 50, 100].includes(speed)) return reply.code(400).send({ error: 'Speed must be 1, 2, 5, 10, 50, or 100' });
    session.speed = speed;
    return { session };
  });

  // POST /api/replay/:sessionId/advance
  fastify.post<{ Params: { sessionId: string }; Body: { candles?: number } }>('/:sessionId/advance', {
    schema: { description: 'Advance time manually', tags: ['Replay'] },
  }, async (request, reply) => {
    const { candles = 1 } = request.body;
    const session = replaySessions.get(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    
    const current = new Date(session.currentDate);
    const newTime = current.getTime() + candles * 3600000;
    const endTime = new Date(session.endDate).getTime();
    
    if (newTime > endTime) { session.currentDate = session.endDate; session.status = 'ended'; }
    else session.currentDate = new Date(newTime).toISOString();
    
    const newCandles = generateHistoricalData(session.symbol, current, new Date(session.currentDate));
    const currentPrice = newCandles[newCandles.length - 1]?.close;
    
    if (currentPrice) {
      session.trades.forEach(trade => {
        if (trade.status === 'open') {
          trade.pnl = trade.type === 'long' ? (currentPrice - trade.entryPrice) * trade.size : (trade.entryPrice - currentPrice) * trade.size;
          if (trade.stopLoss) {
            const hitSL = trade.type === 'long' ? currentPrice <= trade.stopLoss : currentPrice >= trade.stopLoss;
            if (hitSL) { trade.status = 'stopped'; trade.exitPrice = trade.stopLoss; trade.exitTime = session.currentDate; session.balance += trade.pnl || 0; }
          }
          if (trade.takeProfit && trade.status === 'open') {
            const hitTP = trade.type === 'long' ? currentPrice >= trade.takeProfit : currentPrice <= trade.takeProfit;
            if (hitTP) { trade.status = 'closed'; trade.exitPrice = trade.takeProfit; trade.exitTime = session.currentDate; trade.pnl = trade.type === 'long' ? (trade.takeProfit - trade.entryPrice) * trade.size : (trade.entryPrice - trade.takeProfit) * trade.size; session.balance += trade.pnl; }
          }
        }
      });
    }
    
    session.equity = session.balance + session.trades.filter(t => t.status === 'open').reduce((sum, t) => sum + (t.pnl || 0), 0);
    return { session, newCandles, currentPrice };
  });

  // POST /api/replay/:sessionId/trade
  fastify.post<{ Params: { sessionId: string }; Body: { type: string; size: number; stopLoss?: number; takeProfit?: number; notes?: string } }>('/:sessionId/trade', {
    schema: { description: 'Place a trade', tags: ['Replay'] },
  }, async (request, reply) => {
    const { type, size, stopLoss, takeProfit, notes } = request.body;
    const session = replaySessions.get(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    if (!['long', 'short'].includes(type)) return reply.code(400).send({ error: 'type must be long or short' });
    if (!size || size <= 0) return reply.code(400).send({ error: 'size must be positive' });
    
    const candles = generateHistoricalData(session.symbol, new Date(session.currentDate), new Date(session.currentDate));
    const currentPrice = candles[candles.length - 1]?.close || 100;
    
    const trade: ReplayTrade = { id: uuidv4(), type: type as 'long' | 'short', symbol: session.symbol, entryPrice: currentPrice, entryTime: session.currentDate, size, status: 'open', stopLoss, takeProfit, notes };
    session.trades.push(trade);
    return { trade, currentPrice };
  });

  // POST /api/replay/:sessionId/close/:tradeId
  fastify.post<{ Params: { sessionId: string; tradeId: string } }>('/:sessionId/close/:tradeId', {
    schema: { description: 'Close a trade', tags: ['Replay'] },
  }, async (request, reply) => {
    const session = replaySessions.get(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    
    const trade = session.trades.find(t => t.id === request.params.tradeId);
    if (!trade) return reply.code(404).send({ error: 'Trade not found' });
    if (trade.status !== 'open') return reply.code(400).send({ error: 'Trade already closed' });
    
    const candles = generateHistoricalData(session.symbol, new Date(session.currentDate), new Date(session.currentDate));
    const currentPrice = candles[candles.length - 1]?.close || trade.entryPrice;
    
    trade.exitPrice = currentPrice;
    trade.exitTime = session.currentDate;
    trade.status = 'closed';
    trade.pnl = trade.type === 'long' ? (currentPrice - trade.entryPrice) * trade.size : (trade.entryPrice - currentPrice) * trade.size;
    session.balance += trade.pnl;
    session.equity = session.balance;
    
    return { trade, currentPrice };
  });

  // GET /api/replay/:sessionId/summary
  fastify.get<{ Params: { sessionId: string } }>('/:sessionId/summary', {
    schema: { description: 'Get session summary', tags: ['Replay'] },
  }, async (request, reply) => {
    const session = replaySessions.get(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    
    const closedTrades = session.trades.filter(t => t.status !== 'open');
    const winners = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losers = closedTrades.filter(t => (t.pnl || 0) < 0);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + (t.pnl || 0), 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0) / losers.length) : 0;
    const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
    const returnPct = ((session.equity - session.initialBalance) / session.initialBalance) * 100;
    
    return {
      sessionId: session.id, symbol: session.symbol, period: `${session.startDate} to ${session.currentDate}`, status: session.status,
      performance: { totalTrades: closedTrades.length, winners: winners.length, losers: losers.length, winRate: Math.round(winRate * 10) / 10, totalPnl: Math.round(totalPnl * 100) / 100, avgWin: Math.round(avgWin * 100) / 100, avgLoss: Math.round(avgLoss * 100) / 100, profitFactor: Math.round(profitFactor * 100) / 100, returnPct: Math.round(returnPct * 10) / 10 },
      balance: { initial: session.initialBalance, current: Math.round(session.balance * 100) / 100, equity: Math.round(session.equity * 100) / 100 },
      openTrades: session.trades.filter(t => t.status === 'open').length,
    };
  });

  // DELETE /api/replay/:sessionId
  fastify.delete<{ Params: { sessionId: string } }>('/:sessionId', {
    schema: { description: 'End and delete session', tags: ['Replay'] },
  }, async (request, reply) => {
    const session = replaySessions.get(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    replaySessions.delete(request.params.sessionId);
    return { success: true, finalEquity: session.equity };
  });
}
