/**
 * User Journal Routes (authenticated via JWT)
 * /api/user/journal/* endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { JournalService } from '../services/journal.service.ts';
import { UserService } from '../services/user.service.ts';
import { fetchBinanceTrades } from '../services/binance.service.ts';
import { fetchBybitTrades } from '../services/bybit.service.ts';

// Helper to extract user from JWT
async function getUserId(request: FastifyRequest): Promise<string | null> {
  try {
    await request.jwtVerify();
    const user = request.user as { userId?: string };
    return user.userId || null;
  } catch {
    return null;
  }
}

export async function userJournalRoutes(fastify: FastifyInstance) {
  // ========================================
  // ACCOUNTS
  // ========================================

  /**
   * GET /api/user/journal/accounts
   * Get all accounts for authenticated user
   */
  fastify.get('/accounts', async (request, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const accounts = await JournalService.getAccounts(userId);
    return { success: true, accounts };
  });

  /**
   * POST /api/user/journal/accounts
   * Create a new account
   */
  fastify.post('/accounts', async (request: FastifyRequest<{
    Body: {
      name: string;
      broker?: string;
      platform?: string;
      account_type?: string;
      initial_balance?: number;
      currency?: string;
      connection_id?: string;
    }
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const account = await JournalService.createAccount(userId, request.body);
    if (!account) {
      return reply.status(500).send({ error: 'Failed to create account' });
    }

    return reply.status(201).send({ success: true, account });
  });

  /**
   * DELETE /api/user/journal/accounts/:id
   * Delete an account and all its entries
   */
  fastify.delete('/accounts/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const success = await JournalService.deleteAccount(request.params.id, userId);
    if (!success) {
      return reply.status(404).send({ error: 'Account not found' });
    }

    return { success: true };
  });

  // ========================================
  // ENTRIES (TRADES)
  // ========================================

  /**
   * GET /api/user/journal/entries
   * Get all entries for authenticated user
   */
  fastify.get('/entries', async (request: FastifyRequest<{
    Querystring: {
      accountId?: string;
      symbol?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      limit?: string;
      offset?: string;
    }
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { accountId, symbol, status, startDate, endDate, limit, offset } = request.query;
    
    const result = await JournalService.getEntries(userId, {
      accountId,
      symbol,
      status,
      from: startDate,
      to: endDate,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return { success: true, ...result };
  });

  /**
   * POST /api/user/journal/entries
   * Create a new entry
   */
  fastify.post('/entries', async (request: FastifyRequest<{
    Body: {
      account_id?: string;
      symbol: string;
      direction: 'long' | 'short';
      entry_date: string;
      entry_price: number;
      quantity: number;
      exit_date?: string;
      exit_price?: number;
      stop_loss?: number;
      take_profit?: number;
      fees?: number;
      pnl?: number;
      status?: string;
      notes?: string;
      tags?: string[];
    }
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    // Map request fields to entry fields
    const { entry_date, exit_date, fees, ...rest } = request.body as any;
    const entry = await JournalService.createEntry(userId, {
      ...rest,
      entry_time: entry_date,
      exit_time: exit_date,
      source: 'manual',
      status: rest.status || 'open',
      // fees not stored directly, but could be subtracted from pnl if needed
    });

    if (!entry) {
      return reply.status(500).send({ error: 'Failed to create entry' });
    }

    return reply.status(201).send({ success: true, entry });
  });

  /**
   * PUT /api/user/journal/entries/:id
   * Update an entry
   */
  fastify.put('/entries/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: Partial<{
      symbol: string;
      direction: string;
      entry_date: string;
      exit_date: string;
      entry_price: number;
      exit_price: number;
      quantity: number;
      stop_loss: number;
      take_profit: number;
      fees: number;
      pnl: number;
      status: string;
      notes: string;
      tags: string[];
    }>;
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const entry = await JournalService.updateEntry(request.params.id, userId, request.body);
    if (!entry) {
      return reply.status(404).send({ error: 'Entry not found' });
    }

    return { success: true, entry };
  });

  /**
   * DELETE /api/user/journal/entries/:id
   * Delete an entry
   */
  fastify.delete('/entries/:id', async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const success = await JournalService.deleteEntry(request.params.id, userId);
    if (!success) {
      return reply.status(404).send({ error: 'Entry not found' });
    }

    return { success: true };
  });

  // ========================================
  // SYNC FROM CONNECTIONS
  // ========================================

  /**
   * POST /api/user/journal/sync/:connectionId
   * Sync trades from a platform connection into journal
   */
  fastify.post('/sync/:connectionId', async (request: FastifyRequest<{
    Params: { connectionId: string };
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    // Get the connection
    const connection = await UserService.getConnectionWithCredentials(
      request.params.connectionId,
      userId
    );

    if (!connection) {
      return reply.status(404).send({ error: 'Connection not found' });
    }

    let trades: any[] = [];
    let source = connection.platform;

    // Fetch trades based on platform
    switch (connection.platform) {
      case 'binance': {
        const creds = connection.credentials as { apiKey: string; apiSecret: string };
        const testnet = connection.account_type === 'demo';
        const result = await fetchBinanceTrades(creds.apiKey, creds.apiSecret, testnet);
        if (!result.success) {
          return reply.status(400).send({ error: result.error });
        }
        trades = (result.trades || []).map(t => ({
          ...t,
          external_id: `binance_${t.notes?.match(/Trade #(\d+)/)?.[1] || Date.now()}`,
        }));
        break;
      }

      case 'bybit': {
        const creds = connection.credentials as { apiKey: string; apiSecret: string };
        const testnet = connection.account_type === 'demo';
        const result = await fetchBybitTrades(creds.apiKey, creds.apiSecret, testnet);
        if (!result.success) {
          return reply.status(400).send({ error: result.error });
        }
        trades = (result.trades || []).map(t => ({
          ...t,
          external_id: `bybit_${t.notes?.match(/Order #(\d+)/)?.[1] || Date.now()}`,
        }));
        break;
      }

      default:
        return reply.status(400).send({ 
          error: `Platform ${connection.platform} sync not yet supported` 
        });
    }

    // Import trades
    const importResult = await JournalService.importEntries(userId, trades, source);

    // Update last sync time
    await UserService.updateLastSync(connection.id);

    return {
      success: true,
      platform: connection.platform,
      ...importResult,
    };
  });

  // ========================================
  // METRICS & ANALYTICS
  // ========================================

  /**
   * GET /api/user/journal/metrics
   * Get performance metrics for authenticated user
   */
  fastify.get('/metrics', async (request: FastifyRequest<{
    Querystring: { accountId?: string };
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const metrics = await JournalService.getMetrics(userId, request.query.accountId);
    return { success: true, metrics };
  });

  /**
   * GET /api/user/journal/calendar
   * Get daily P&L for calendar heatmap
   */
  fastify.get('/calendar', async (request: FastifyRequest<{
    Querystring: { year?: string; month?: string };
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const year = request.query.year ? parseInt(request.query.year) : new Date().getFullYear();
    const month = request.query.month ? parseInt(request.query.month) : undefined;

    const dailyPnL = await JournalService.getDailyPnL(userId, year, month);
    return { success: true, dailyPnL };
  });

  /**
   * GET /api/user/journal/equity
   * Get equity curve for charting
   */
  fastify.get('/equity', async (request: FastifyRequest<{
    Querystring: { accountId?: string };
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const curve = await JournalService.getEquityCurve(userId, request.query.accountId);
    return { success: true, curve };
  });

  // ========================================
  // ADVANCED STATISTICS
  // ========================================

  /**
   * GET /api/user/journal/advanced-stats
   * Get advanced statistics (Sharpe, Sortino, Drawdown, etc.)
   */
  fastify.get('/advanced-stats', async (request: FastifyRequest<{
    Querystring: { accountId?: string; from?: string; to?: string };
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const stats = await JournalService.getAdvancedStatistics(userId, {
      accountId: request.query.accountId,
      from: request.query.from,
      to: request.query.to,
    });
    return { success: true, stats };
  });

  // ========================================
  // EXPORT
  // ========================================

  /**
   * GET /api/user/journal/export/csv
   * Export trades to CSV
   */
  fastify.get('/export/csv', async (request: FastifyRequest<{
    Querystring: { accountId?: string };
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const csv = await JournalService.exportToCSV(userId, request.query.accountId);
    
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="trades_${new Date().toISOString().split('T')[0]}.csv"`);
    return csv;
  });

  // ========================================
  // REPORTS
  // ========================================

  /**
   * GET /api/user/journal/report/weekly
   * Get weekly performance report
   */
  fastify.get('/report/weekly', async (request: FastifyRequest<{
    Querystring: { accountId?: string };
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const report = await JournalService.getReportData(userId, 'weekly', request.query.accountId);
    return { success: true, report };
  });

  /**
   * GET /api/user/journal/report/monthly
   * Get monthly performance report
   */
  fastify.get('/report/monthly', async (request: FastifyRequest<{
    Querystring: { accountId?: string };
  }>, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const report = await JournalService.getReportData(userId, 'monthly', request.query.accountId);
    return { success: true, report };
  });

  // ========================================
  // CONNECTIONS (convenience endpoints)
  // ========================================

  /**
   * GET /api/user/journal/connections
   * Get all platform connections for authenticated user
   */
  fastify.get('/connections', async (request, reply) => {
    const userId = await getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const connections = await UserService.getConnections(userId);
    return { success: true, connections };
  });
}
