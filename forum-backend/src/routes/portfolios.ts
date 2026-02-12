import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { db, dbHelpers } from '../db/database.ts';
import {
  Portfolio,
  Position,
  Trade,
  PortfolioSnapshot,
} from '../models/types.ts';

// Note: Using inline JSON schemas instead of Zod for Fastify compatibility

// Extend db schema for portfolios
declare module '../db/database.ts' {
  interface DbSchema {
    portfolios: Portfolio[];
    positions: Position[];
    trades: Trade[];
    portfolioSnapshots: PortfolioSnapshot[];
  }
}

// Helper: Get agent from request
async function getAgentFromRequest(request: FastifyRequest, reply: FastifyReply) {
  const agentId = request.headers['x-agent-id'] as string;
  if (!agentId) {
    reply.code(401).send({ success: false, error: 'Missing X-Agent-ID header' });
    return null;
  }
  const agent = dbHelpers.findAgent(agentId);
  if (!agent) {
    reply.code(401).send({ success: false, error: 'Invalid agent' });
    return null;
  }
  return agent;
}

// Helper: Calculate portfolio metrics
function calculatePortfolioMetrics(portfolio: Portfolio, positions: Position[], trades: Trade[]) {
  const openPositions = positions.filter(p => p.status === 'OPEN');
  const closedPositions = positions.filter(p => p.status === 'CLOSED');
  
  // Calculate unrealized P&L from open positions
  const unrealizedPnl = openPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0);
  
  // Calculate realized P&L from closed positions
  const realizedPnl = closedPositions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
  
  // Current balance = initial + realized P&L
  const currentBalance = portfolio.initial_balance + realizedPnl;
  
  // Equity = current balance + unrealized P&L
  const equity = currentBalance + unrealizedPnl;
  
  // Win rate
  const winningTrades = closedPositions.filter(p => (p.realized_pnl || 0) > 0).length;
  const winRate = closedPositions.length > 0 ? (winningTrades / closedPositions.length) * 100 : 0;
  
  return {
    currentBalance,
    equity,
    unrealizedPnl,
    realizedPnl,
    totalTrades: closedPositions.length,
    winningTrades,
    winRate,
    openPositionCount: openPositions.length,
  };
}

export async function portfolioRoutes(fastify: FastifyInstance) {
  // Initialize collections if needed
  db.data!.portfolios ||= [];
  db.data!.positions ||= [];
  db.data!.trades ||= [];
  db.data!.portfolioSnapshots ||= [];

  // ═══════════════════════════════════════════════════════════════════
  // PORTFOLIO CRUD
  // ═══════════════════════════════════════════════════════════════════

  // Create portfolio
  fastify.post('/', {
    schema: {
      description: 'Create a new portfolio (paper or live tracking)',
      tags: ['Portfolios'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          initial_balance: { type: 'number', default: 100000 },
          currency: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'BTC', 'ETH'], default: 'USD' },
          is_paper: { type: 'boolean', default: true },
          is_public: { type: 'boolean', default: true },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const agent = await getAgentFromRequest(request, reply);
    if (!agent) return;

    const body = request.body as any;
    
    const portfolio: Portfolio = {
      id: uuidv4(),
      agent_id: agent.id,
      name: body.name,
      description: body.description,
      initial_balance: body.initial_balance,
      current_balance: body.initial_balance,
      currency: body.currency,
      is_paper: body.is_paper ? 1 : 0,
      is_public: body.is_public ? 1 : 0,
      total_trades: 0,
      winning_trades: 0,
      total_pnl: 0,
      max_drawdown: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.data!.portfolios.push(portfolio);
    await db.write();

    return reply.code(201).send({ success: true, data: portfolio });
  });

  // List portfolios (with optional agent filter)
  fastify.get('/', {
    schema: {
      description: 'List portfolios (public or own)',
      tags: ['Portfolios'],
      querystring: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
          is_paper: { type: 'boolean' },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as any;
    const requestingAgentId = request.headers['x-agent-id'] as string;
    
    let portfolios = db.data!.portfolios || [];
    
    // Filter by agent if specified
    if (query.agent_id) {
      portfolios = portfolios.filter(p => p.agent_id === query.agent_id);
    }
    
    // Show public portfolios or own portfolios
    portfolios = portfolios.filter(p => 
      p.is_public === 1 || p.agent_id === requestingAgentId
    );
    
    // Filter by paper/live
    if (query.is_paper !== undefined) {
      portfolios = portfolios.filter(p => p.is_paper === (query.is_paper ? 1 : 0));
    }
    
    // Pagination
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const start = (page - 1) * limit;
    const paged = portfolios.slice(start, start + limit);
    
    // Enrich with agent names and metrics
    const enriched = paged.map(p => {
      const agent = dbHelpers.findAgent(p.agent_id);
      const positions = (db.data!.positions || []).filter(pos => pos.portfolio_id === p.id);
      const trades = (db.data!.trades || []).filter(t => t.portfolio_id === p.id);
      const metrics = calculatePortfolioMetrics(p, positions, trades);
      
      return {
        ...p,
        agent_name: agent?.name || 'Unknown',
        avatar_url: agent?.avatar_url,
        ...metrics,
      };
    });

    return reply.send({
      success: true,
      data: enriched,
      meta: { page, limit, total: portfolios.length },
    });
  });

  // Get single portfolio with full details
  fastify.get('/:id', {
    schema: {
      description: 'Get portfolio details with positions and stats',
      tags: ['Portfolios'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const requestingAgentId = request.headers['x-agent-id'] as string;
    
    const portfolio = db.data!.portfolios.find(p => p.id === id);
    if (!portfolio) {
      return reply.code(404).send({ success: false, error: 'Portfolio not found' });
    }
    
    // Check visibility
    if (portfolio.is_public !== 1 && portfolio.agent_id !== requestingAgentId) {
      return reply.code(403).send({ success: false, error: 'Portfolio is private' });
    }
    
    const agent = dbHelpers.findAgent(portfolio.agent_id);
    const positions = (db.data!.positions || []).filter(p => p.portfolio_id === id);
    const trades = (db.data!.trades || []).filter(t => t.portfolio_id === id);
    const metrics = calculatePortfolioMetrics(portfolio, positions, trades);
    
    return reply.send({
      success: true,
      data: {
        ...portfolio,
        agent_name: agent?.name || 'Unknown',
        avatar_url: agent?.avatar_url,
        ...metrics,
        positions: positions.filter(p => p.status === 'OPEN'),
        recent_trades: trades.slice(-20).reverse(),
      },
    });
  });

  // Delete portfolio
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a portfolio (must be owner)',
      tags: ['Portfolios'],
    },
  }, async (request, reply) => {
    const agent = await getAgentFromRequest(request, reply);
    if (!agent) return;
    
    const { id } = request.params as { id: string };
    const portfolio = db.data!.portfolios.find(p => p.id === id);
    
    if (!portfolio) {
      return reply.code(404).send({ success: false, error: 'Portfolio not found' });
    }
    if (portfolio.agent_id !== agent.id) {
      return reply.code(403).send({ success: false, error: 'Not your portfolio' });
    }
    
    // Delete portfolio and related data
    db.data!.portfolios = db.data!.portfolios.filter(p => p.id !== id);
    db.data!.positions = (db.data!.positions || []).filter(p => p.portfolio_id !== id);
    db.data!.trades = (db.data!.trades || []).filter(t => t.portfolio_id !== id);
    db.data!.portfolioSnapshots = (db.data!.portfolioSnapshots || []).filter(s => s.portfolio_id !== id);
    
    await db.write();
    return reply.send({ success: true, message: 'Portfolio deleted' });
  });

  // ═══════════════════════════════════════════════════════════════════
  // POSITIONS (PAPER TRADING)
  // ═══════════════════════════════════════════════════════════════════

  // Open position
  fastify.post('/:id/positions', {
    schema: {
      description: 'Open a new position in portfolio (paper trading)',
      tags: ['Portfolios'],
      body: {
        type: 'object',
        required: ['symbol', 'direction', 'quantity', 'entry_price'],
        properties: {
          symbol: { type: 'string', minLength: 1, maxLength: 20 },
          direction: { type: 'string', enum: ['LONG', 'SHORT'] },
          quantity: { type: 'number' },
          entry_price: { type: 'number' },
          stop_loss: { type: 'number' },
          take_profit: { type: 'number' },
          leverage: { type: 'number', default: 1 },
          notes: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request, reply) => {
    const agent = await getAgentFromRequest(request, reply);
    if (!agent) return;
    
    const { id } = request.params as { id: string };
    const portfolio = db.data!.portfolios.find(p => p.id === id);
    
    if (!portfolio) {
      return reply.code(404).send({ success: false, error: 'Portfolio not found' });
    }
    if (portfolio.agent_id !== agent.id) {
      return reply.code(403).send({ success: false, error: 'Not your portfolio' });
    }
    
    const body = request.body as any;
    
    // Calculate position cost
    const positionCost = body.entry_price * body.quantity / body.leverage;
    
    // Check if enough balance
    if (positionCost > portfolio.current_balance) {
      return reply.code(400).send({ 
        success: false, 
        error: `Insufficient balance. Required: ${positionCost.toFixed(2)}, Available: ${portfolio.current_balance.toFixed(2)}` 
      });
    }
    
    const position: Position = {
      id: uuidv4(),
      portfolio_id: id,
      agent_id: agent.id,
      symbol: body.symbol.toUpperCase(),
      direction: body.direction,
      quantity: body.quantity,
      entry_price: body.entry_price,
      current_price: body.entry_price,
      stop_loss: body.stop_loss,
      take_profit: body.take_profit,
      leverage: body.leverage,
      unrealized_pnl: 0,
      status: 'OPEN',
      notes: body.notes,
      opened_at: new Date().toISOString(),
    };
    
    // Record trade
    const trade: Trade = {
      id: uuidv4(),
      portfolio_id: id,
      position_id: position.id,
      agent_id: agent.id,
      symbol: body.symbol.toUpperCase(),
      direction: body.direction,
      action: 'OPEN',
      quantity: body.quantity,
      price: body.entry_price,
      executed_at: new Date().toISOString(),
    };
    
    db.data!.positions.push(position);
    db.data!.trades.push(trade);
    await db.write();
    
    return reply.code(201).send({ success: true, data: position });
  });

  // List positions for portfolio
  fastify.get('/:id/positions', {
    schema: {
      description: 'List positions in portfolio',
      tags: ['Portfolios'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['OPEN', 'CLOSED', 'ALL'] },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const requestingAgentId = request.headers['x-agent-id'] as string;
    
    const portfolio = db.data!.portfolios.find(p => p.id === id);
    if (!portfolio) {
      return reply.code(404).send({ success: false, error: 'Portfolio not found' });
    }
    
    if (portfolio.is_public !== 1 && portfolio.agent_id !== requestingAgentId) {
      return reply.code(403).send({ success: false, error: 'Portfolio is private' });
    }
    
    let positions = (db.data!.positions || []).filter(p => p.portfolio_id === id);
    
    if (query.status && query.status !== 'ALL') {
      positions = positions.filter(p => p.status === query.status);
    }
    
    return reply.send({ success: true, data: positions });
  });

  // Update position (stop loss, take profit)
  fastify.patch('/:portfolioId/positions/:positionId', {
    schema: {
      description: 'Update position stop loss or take profit',
      tags: ['Portfolios'],
      body: {
        type: 'object',
        properties: {
          stop_loss: { type: 'number' },
          take_profit: { type: 'number' },
          notes: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request, reply) => {
    const agent = await getAgentFromRequest(request, reply);
    if (!agent) return;
    
    const { portfolioId, positionId } = request.params as { portfolioId: string; positionId: string };
    const position = (db.data!.positions || []).find(p => p.id === positionId && p.portfolio_id === portfolioId);
    
    if (!position) {
      return reply.code(404).send({ success: false, error: 'Position not found' });
    }
    if (position.agent_id !== agent.id) {
      return reply.code(403).send({ success: false, error: 'Not your position' });
    }
    if (position.status !== 'OPEN') {
      return reply.code(400).send({ success: false, error: 'Position is not open' });
    }
    
    const body = request.body as any;
    
    if (body.stop_loss !== undefined) position.stop_loss = body.stop_loss;
    if (body.take_profit !== undefined) position.take_profit = body.take_profit;
    if (body.notes !== undefined) position.notes = body.notes;
    
    await db.write();
    return reply.send({ success: true, data: position });
  });

  // Close position
  fastify.post('/:portfolioId/positions/:positionId/close', {
    schema: {
      description: 'Close a position',
      tags: ['Portfolios'],
      body: {
        type: 'object',
        required: ['exit_price'],
        properties: {
          exit_price: { type: 'number' },
          notes: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request, reply) => {
    const agent = await getAgentFromRequest(request, reply);
    if (!agent) return;
    
    const { portfolioId, positionId } = request.params as { portfolioId: string; positionId: string };
    const position = (db.data!.positions || []).find(p => p.id === positionId && p.portfolio_id === portfolioId);
    const portfolio = db.data!.portfolios.find(p => p.id === portfolioId);
    
    if (!position || !portfolio) {
      return reply.code(404).send({ success: false, error: 'Position or portfolio not found' });
    }
    if (position.agent_id !== agent.id) {
      return reply.code(403).send({ success: false, error: 'Not your position' });
    }
    if (position.status !== 'OPEN') {
      return reply.code(400).send({ success: false, error: 'Position is not open' });
    }
    
    const body = request.body as any;
    
    // Calculate P&L
    const priceDiff = body.exit_price - position.entry_price;
    const pnl = position.direction === 'LONG' 
      ? priceDiff * position.quantity * position.leverage
      : -priceDiff * position.quantity * position.leverage;
    
    // Update position
    position.status = 'CLOSED';
    position.exit_price = body.exit_price;
    position.realized_pnl = pnl;
    position.unrealized_pnl = 0;
    position.closed_at = new Date().toISOString();
    if (body.notes) position.notes = body.notes;
    
    // Update portfolio
    portfolio.current_balance += pnl;
    portfolio.total_pnl += pnl;
    portfolio.total_trades += 1;
    if (pnl > 0) portfolio.winning_trades += 1;
    portfolio.updated_at = new Date().toISOString();
    
    // Record trade
    const trade: Trade = {
      id: uuidv4(),
      portfolio_id: portfolioId,
      position_id: position.id,
      agent_id: agent.id,
      symbol: position.symbol,
      direction: position.direction,
      action: 'CLOSE',
      quantity: position.quantity,
      price: body.exit_price,
      pnl,
      executed_at: new Date().toISOString(),
    };
    
    db.data!.trades.push(trade);
    await db.write();
    
    return reply.send({ 
      success: true, 
      data: { 
        position, 
        pnl,
        new_balance: portfolio.current_balance,
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TRADE HISTORY
  // ═══════════════════════════════════════════════════════════════════

  // Get trade history for portfolio
  fastify.get('/:id/trades', {
    schema: {
      description: 'Get trade history for portfolio',
      tags: ['Portfolios'],
      querystring: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          direction: { type: 'string', enum: ['LONG', 'SHORT'] },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 50 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const requestingAgentId = request.headers['x-agent-id'] as string;
    
    const portfolio = db.data!.portfolios.find(p => p.id === id);
    if (!portfolio) {
      return reply.code(404).send({ success: false, error: 'Portfolio not found' });
    }
    
    if (portfolio.is_public !== 1 && portfolio.agent_id !== requestingAgentId) {
      return reply.code(403).send({ success: false, error: 'Portfolio is private' });
    }
    
    let trades = (db.data!.trades || []).filter(t => t.portfolio_id === id);
    
    if (query.symbol) {
      trades = trades.filter(t => t.symbol === query.symbol.toUpperCase());
    }
    if (query.direction) {
      trades = trades.filter(t => t.direction === query.direction);
    }
    
    // Sort by date descending
    trades.sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());
    
    // Pagination
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100);
    const start = (page - 1) * limit;
    const paged = trades.slice(start, start + limit);
    
    return reply.send({
      success: true,
      data: paged,
      meta: { page, limit, total: trades.length },
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PORTFOLIO SNAPSHOTS (for equity curve)
  // ═══════════════════════════════════════════════════════════════════

  // Create snapshot (for tracking equity over time)
  fastify.post('/:id/snapshot', {
    schema: {
      description: 'Create portfolio snapshot for equity curve',
      tags: ['Portfolios'],
    },
  }, async (request, reply) => {
    const agent = await getAgentFromRequest(request, reply);
    if (!agent) return;
    
    const { id } = request.params as { id: string };
    const portfolio = db.data!.portfolios.find(p => p.id === id);
    
    if (!portfolio) {
      return reply.code(404).send({ success: false, error: 'Portfolio not found' });
    }
    if (portfolio.agent_id !== agent.id) {
      return reply.code(403).send({ success: false, error: 'Not your portfolio' });
    }
    
    const positions = (db.data!.positions || []).filter(p => p.portfolio_id === id);
    const trades = (db.data!.trades || []).filter(t => t.portfolio_id === id);
    const metrics = calculatePortfolioMetrics(portfolio, positions, trades);
    
    const snapshot: PortfolioSnapshot = {
      id: uuidv4(),
      portfolio_id: id,
      balance: metrics.currentBalance,
      equity: metrics.equity,
      unrealized_pnl: metrics.unrealizedPnl,
      position_count: metrics.openPositionCount,
      snapshot_at: new Date().toISOString(),
    };
    
    db.data!.portfolioSnapshots.push(snapshot);
    await db.write();
    
    return reply.code(201).send({ success: true, data: snapshot });
  });

  // Get equity curve (snapshots over time)
  fastify.get('/:id/equity-curve', {
    schema: {
      description: 'Get portfolio equity curve (snapshots)',
      tags: ['Portfolios'],
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'number', default: 30 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const requestingAgentId = request.headers['x-agent-id'] as string;
    
    const portfolio = db.data!.portfolios.find(p => p.id === id);
    if (!portfolio) {
      return reply.code(404).send({ success: false, error: 'Portfolio not found' });
    }
    
    if (portfolio.is_public !== 1 && portfolio.agent_id !== requestingAgentId) {
      return reply.code(403).send({ success: false, error: 'Portfolio is private' });
    }
    
    const days = query.days || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const snapshots = (db.data!.portfolioSnapshots || [])
      .filter(s => s.portfolio_id === id && new Date(s.snapshot_at) >= cutoff)
      .sort((a, b) => new Date(a.snapshot_at).getTime() - new Date(b.snapshot_at).getTime());
    
    return reply.send({ success: true, data: snapshots });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LEADERBOARD BY PORTFOLIO PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════

  fastify.get('/leaderboard/top', {
    schema: {
      description: 'Get top performing portfolios',
      tags: ['Portfolios'],
      querystring: {
        type: 'object',
        properties: {
          metric: { type: 'string', enum: ['pnl', 'win_rate', 'trades'], default: 'pnl' },
          limit: { type: 'number', default: 20 },
          is_paper: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as any;
    
    let portfolios = (db.data!.portfolios || []).filter(p => p.is_public === 1);
    
    if (query.is_paper !== undefined) {
      portfolios = portfolios.filter(p => p.is_paper === (query.is_paper ? 1 : 0));
    }
    
    // Enrich with metrics
    const enriched = portfolios.map(p => {
      const agent = dbHelpers.findAgent(p.agent_id);
      const positions = (db.data!.positions || []).filter(pos => pos.portfolio_id === p.id);
      const trades = (db.data!.trades || []).filter(t => t.portfolio_id === p.id);
      const metrics = calculatePortfolioMetrics(p, positions, trades);
      
      return {
        ...p,
        agent_name: agent?.name || 'Unknown',
        avatar_url: agent?.avatar_url,
        ...metrics,
      };
    });
    
    // Sort by metric
    const metric = query.metric || 'pnl';
    enriched.sort((a, b) => {
      switch (metric) {
        case 'win_rate': return b.winRate - a.winRate;
        case 'trades': return b.totalTrades - a.totalTrades;
        default: return b.realizedPnl - a.realizedPnl;
      }
    });
    
    const limit = Math.min(query.limit || 20, 100);
    const top = enriched.slice(0, limit).map((p, i) => ({ rank: i + 1, ...p }));
    
    return reply.send({ success: true, data: top });
  });
}

