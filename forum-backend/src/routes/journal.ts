/**
 * K.I.T. Trading Journal API Routes (Fastify)
 * Full CRUD + Analytics + Import/Export
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.ts';
import {
  TradingAccount,
  JournalEntry,
  TradingRule,
  DailyNote,
  AIInsight,
  PerformanceMetrics,
} from '../models/journal-types.ts';

// ============================================================================
// HELPER: Ensure journal collections exist
// ============================================================================

function ensureJournalCollections() {
  const data = db.data as any;
  if (!data.tradingAccounts) data.tradingAccounts = [];
  if (!data.journalEntries) data.journalEntries = [];
  if (!data.tradingRules) data.tradingRules = [];
  if (!data.dailyNotes) data.dailyNotes = [];
  if (!data.aiInsights) data.aiInsights = [];
}

// ============================================================================
// ANALYTICS HELPER FUNCTIONS
// ============================================================================

function calculatePerformanceMetrics(trades: JournalEntry[]): PerformanceMetrics {
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin && t.pnl !== 0);
  
  const grossProfit = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));
  
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
  const expectancy = totalTrades > 0 ? (winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss) : 0;
  
  // Calculate streaks
  let longestWinStreak = 0, longestLoseStreak = 0;
  let tempWinStreak = 0, tempLoseStreak = 0;
  let currentStreak = 0;
  let currentStreakType: 'win' | 'lose' | 'none' = 'none';
  
  for (const trade of trades.sort((a, b) => new Date(a.exitTime || a.entryTime).getTime() - new Date(b.exitTime || b.entryTime).getTime())) {
    if (trade.isWin) {
      tempWinStreak++;
      tempLoseStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
    } else {
      tempLoseStreak++;
      tempWinStreak = 0;
      longestLoseStreak = Math.max(longestLoseStreak, tempLoseStreak);
    }
  }
  
  if (trades.length > 0) {
    const lastTrade = trades[trades.length - 1];
    currentStreak = lastTrade.isWin ? tempWinStreak : tempLoseStreak;
    currentStreakType = lastTrade.isWin ? 'win' : 'lose';
  }
  
  // By category
  const bySymbol: Record<string, any> = {};
  const bySetup: Record<string, any> = {};
  const byDayOfWeek: Record<string, any> = {};
  const byHourOfDay: Record<string, any> = {};
  const byEmotion: Record<string, any> = {};
  
  for (const trade of trades) {
    // By Symbol
    if (!bySymbol[trade.symbol]) bySymbol[trade.symbol] = { trades: 0, pnl: 0, wins: 0 };
    bySymbol[trade.symbol].trades++;
    bySymbol[trade.symbol].pnl += trade.pnl || 0;
    if (trade.isWin) bySymbol[trade.symbol].wins++;
    bySymbol[trade.symbol].winRate = (bySymbol[trade.symbol].wins / bySymbol[trade.symbol].trades) * 100;
    
    // By Setup
    if (trade.setup) {
      if (!bySetup[trade.setup]) bySetup[trade.setup] = { trades: 0, pnl: 0, wins: 0 };
      bySetup[trade.setup].trades++;
      bySetup[trade.setup].pnl += trade.pnl || 0;
      if (trade.isWin) bySetup[trade.setup].wins++;
      bySetup[trade.setup].winRate = (bySetup[trade.setup].wins / bySetup[trade.setup].trades) * 100;
    }
    
    // By Day of Week
    const day = new Date(trade.entryTime).toLocaleDateString('en-US', { weekday: 'long' });
    if (!byDayOfWeek[day]) byDayOfWeek[day] = { trades: 0, pnl: 0, wins: 0 };
    byDayOfWeek[day].trades++;
    byDayOfWeek[day].pnl += trade.pnl || 0;
    if (trade.isWin) byDayOfWeek[day].wins++;
    byDayOfWeek[day].winRate = (byDayOfWeek[day].wins / byDayOfWeek[day].trades) * 100;
    
    // By Hour
    const hour = new Date(trade.entryTime).getHours().toString().padStart(2, '0') + ':00';
    if (!byHourOfDay[hour]) byHourOfDay[hour] = { trades: 0, pnl: 0, wins: 0 };
    byHourOfDay[hour].trades++;
    byHourOfDay[hour].pnl += trade.pnl || 0;
    if (trade.isWin) byHourOfDay[hour].wins++;
    byHourOfDay[hour].winRate = (byHourOfDay[hour].wins / byHourOfDay[hour].trades) * 100;
    
    // By Emotion
    if (trade.emotion) {
      if (!byEmotion[trade.emotion]) byEmotion[trade.emotion] = { trades: 0, pnl: 0, wins: 0 };
      byEmotion[trade.emotion].trades++;
      byEmotion[trade.emotion].pnl += trade.pnl || 0;
      if (trade.isWin) byEmotion[trade.emotion].wins++;
      byEmotion[trade.emotion].winRate = (byEmotion[trade.emotion].wins / byEmotion[trade.emotion].trades) * 100;
    }
  }
  
  return {
    totalTrades,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakEvenTrades: trades.filter(t => t.pnl === 0).length,
    winRate,
    totalPnL: grossProfit - grossLoss,
    grossProfit,
    grossLoss,
    averageWin: avgWin,
    averageLoss: avgLoss,
    largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.pnl || 0)) : 0,
    largestLoss: losses.length > 0 ? Math.max(...losses.map(t => Math.abs(t.pnl || 0))) : 0,
    profitFactor,
    expectancy,
    sharpeRatio: 0,
    sortinoRatio: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    averageRMultiple: trades.filter(t => t.rMultiple).reduce((sum, t) => sum + (t.rMultiple || 0), 0) / (trades.filter(t => t.rMultiple).length || 1),
    averageHoldTime: trades.filter(t => t.duration).reduce((sum, t) => sum + (t.duration || 0), 0) / (trades.filter(t => t.duration).length || 1),
    longestWinStreak,
    longestLoseStreak,
    currentStreak,
    currentStreakType,
    bySymbol,
    bySetup,
    byDayOfWeek,
    byHourOfDay,
    byEmotion,
  };
}

function calculateEquityCurve(trades: JournalEntry[], initialBalance: number) {
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.exitTime || a.entryTime).getTime() - new Date(b.exitTime || b.entryTime).getTime()
  );
  
  const curve: any[] = [];
  let balance = initialBalance;
  let maxBalance = initialBalance;
  
  const byDate: Record<string, JournalEntry[]> = {};
  for (const trade of sortedTrades) {
    const date = (trade.exitTime || trade.entryTime).split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(trade);
  }
  
  curve.push({ date: Object.keys(byDate)[0] || new Date().toISOString().split('T')[0], balance: initialBalance, pnl: 0, drawdown: 0, tradesCount: 0 });
  
  for (const date of Object.keys(byDate).sort()) {
    const dayTrades = byDate[date];
    const dayPnL = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    balance += dayPnL;
    maxBalance = Math.max(maxBalance, balance);
    const drawdown = ((maxBalance - balance) / maxBalance) * 100;
    curve.push({ date, balance, pnl: dayPnL, drawdown, tradesCount: dayTrades.length });
  }
  
  return curve;
}

function calculateCalendarData(trades: JournalEntry[]) {
  const byDate: Record<string, JournalEntry[]> = {};
  for (const trade of trades) {
    const date = (trade.exitTime || trade.entryTime).split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(trade);
  }
  
  const maxPnL = Math.max(...Object.values(byDate).map(dayTrades => 
    Math.abs(dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0))
  ), 1);
  
  return Object.entries(byDate).map(([date, dayTrades]) => {
    const pnl = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const wins = dayTrades.filter(t => t.isWin).length;
    const winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;
    return {
      date,
      pnl,
      tradesCount: dayTrades.length,
      winRate,
      color: pnl > 0 ? 'green' : pnl < 0 ? 'red' : 'gray',
      intensity: Math.min(Math.abs(pnl) / maxPnL, 1),
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

async function updateAccountStats(accountId: string) {
  ensureJournalCollections();
  const data = db.data as any;
  
  const accountIndex = data.tradingAccounts.findIndex((a: TradingAccount) => a.id === accountId);
  if (accountIndex === -1) return;
  
  const trades = data.journalEntries.filter((t: JournalEntry) => t.accountId === accountId && t.status === 'closed');
  const totalTrades = trades.length;
  const winningTrades = trades.filter((t: JournalEntry) => t.isWin).length;
  const losingTrades = trades.filter((t: JournalEntry) => !t.isWin).length;
  const totalPnL = trades.reduce((sum: number, t: JournalEntry) => sum + (t.pnl || 0), 0);
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  
  const grossProfit = trades.filter((t: JournalEntry) => (t.pnl || 0) > 0).reduce((sum: number, t: JournalEntry) => sum + (t.pnl || 0), 0);
  const grossLoss = Math.abs(trades.filter((t: JournalEntry) => (t.pnl || 0) < 0).reduce((sum: number, t: JournalEntry) => sum + (t.pnl || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  
  const account = data.tradingAccounts[accountIndex];
  
  data.tradingAccounts[accountIndex] = {
    ...account,
    currentBalance: account.initialBalance + totalPnL,
    totalTrades,
    winningTrades,
    losingTrades,
    totalPnL,
    winRate,
    profitFactor,
    profitTargetProgress: account.profitTarget ? (totalPnL / account.profitTarget) * 100 : 0,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// FASTIFY PLUGIN
// ============================================================================

export async function journalRoutes(fastify: FastifyInstance) {
  
  // -------------------------------------------------------------------------
  // TRADING ACCOUNTS
  // -------------------------------------------------------------------------
  
  // List accounts
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    ensureJournalCollections();
    const userId = request.headers['x-user-id'] as string || 'default';
    const data = db.data as any;
    const accounts = data.tradingAccounts.filter((a: TradingAccount) => a.userId === userId);
    return { success: true, accounts, total: accounts.length };
  });
  
  // Create account
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    ensureJournalCollections();
    const userId = request.headers['x-user-id'] as string || 'default';
    const body = request.body as any;
    
    const account: TradingAccount = {
      id: uuidv4(),
      userId,
      name: body.name,
      broker: body.broker,
      accountType: body.accountType || 'demo',
      platform: body.platform || 'mt5',
      currency: body.currency || 'USD',
      initialBalance: body.initialBalance || 10000,
      currentBalance: body.initialBalance || 10000,
      propFirmName: body.propFirmName,
      profitTarget: body.profitTarget,
      profitTargetProgress: 0,
      maxDailyLoss: body.maxDailyLoss,
      currentDailyLoss: 0,
      maxTotalDrawdown: body.maxTotalDrawdown,
      currentDrawdown: 0,
      challengePhase: body.challengePhase,
      connectionType: body.connectionType || 'manual',
      isConnected: false,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnL: 0,
      winRate: 0,
      profitFactor: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    (db.data as any).tradingAccounts.push(account);
    await db.write();
    
    return reply.code(201).send({ success: true, account });
  });
  
  // Get single account
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const { id } = request.params;
    const data = db.data as any;
    const account = data.tradingAccounts.find((a: TradingAccount) => a.id === id);
    if (!account) return reply.code(404).send({ success: false, error: 'Account not found' });
    return { success: true, account };
  });
  
  // Update account
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const { id } = request.params;
    const body = request.body as any;
    const data = db.data as any;
    
    const index = data.tradingAccounts.findIndex((a: TradingAccount) => a.id === id);
    if (index === -1) return reply.code(404).send({ success: false, error: 'Account not found' });
    
    data.tradingAccounts[index] = { ...data.tradingAccounts[index], ...body, updatedAt: new Date().toISOString() };
    await db.write();
    return { success: true, account: data.tradingAccounts[index] };
  });
  
  // Delete account
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const { id } = request.params;
    const data = db.data as any;
    
    const index = data.tradingAccounts.findIndex((a: TradingAccount) => a.id === id);
    if (index === -1) return reply.code(404).send({ success: false, error: 'Account not found' });
    
    data.tradingAccounts.splice(index, 1);
    await db.write();
    return { success: true, message: 'Account deleted' };
  });
  
  // -------------------------------------------------------------------------
  // TRADES
  // -------------------------------------------------------------------------
  
  // List trades
  fastify.get('/trades', async (request: FastifyRequest, reply: FastifyReply) => {
    ensureJournalCollections();
    const userId = request.headers['x-user-id'] as string || 'default';
    const query = request.query as any;
    const data = db.data as any;
    
    let trades = data.journalEntries.filter((t: JournalEntry) => t.userId === userId);
    
    if (query.accountId) trades = trades.filter((t: JournalEntry) => t.accountId === query.accountId);
    if (query.symbol) trades = trades.filter((t: JournalEntry) => t.symbol.toLowerCase().includes(query.symbol.toLowerCase()));
    if (query.setup) trades = trades.filter((t: JournalEntry) => t.setup === query.setup);
    if (query.status) trades = trades.filter((t: JournalEntry) => t.status === query.status);
    if (query.from) trades = trades.filter((t: JournalEntry) => t.entryTime >= query.from);
    if (query.to) trades = trades.filter((t: JournalEntry) => t.entryTime <= query.to);
    
    trades.sort((a: JournalEntry, b: JournalEntry) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
    
    const total = trades.length;
    const limit = parseInt(query.limit || '50');
    const offset = parseInt(query.offset || '0');
    trades = trades.slice(offset, offset + limit);
    
    return { success: true, trades, total, limit, offset };
  });
  
  // Create trade
  fastify.post('/trades', async (request: FastifyRequest, reply: FastifyReply) => {
    ensureJournalCollections();
    const userId = request.headers['x-user-id'] as string || 'default';
    const body = request.body as any;
    
    let pnl, pnlPercent, isWin, duration;
    if (body.exitPrice) {
      const direction = body.direction === 'LONG' ? 1 : -1;
      pnl = (body.exitPrice - body.entryPrice) * body.quantity * direction;
      pnlPercent = ((body.exitPrice - body.entryPrice) / body.entryPrice) * 100 * direction;
      isWin = pnl > 0;
    }
    if (body.exitTime) {
      duration = Math.round((new Date(body.exitTime).getTime() - new Date(body.entryTime).getTime()) / 60000);
    }
    
    const trade: JournalEntry = {
      id: uuidv4(),
      userId,
      accountId: body.accountId,
      symbol: body.symbol,
      direction: body.direction,
      entryPrice: body.entryPrice,
      exitPrice: body.exitPrice,
      quantity: body.quantity,
      stopLoss: body.stopLoss,
      takeProfit: body.takeProfit,
      riskAmount: body.riskAmount,
      rMultiple: body.riskAmount && pnl ? pnl / body.riskAmount : undefined,
      setup: body.setup,
      strategy: body.strategy,
      timeframe: body.timeframe,
      tags: body.tags ? JSON.stringify(body.tags) : undefined,
      emotion: body.emotion,
      emotionNotes: body.emotionNotes,
      entryReason: body.entryReason,
      exitReason: body.exitReason,
      lessonLearned: body.lessonLearned,
      mistake: body.mistake,
      screenshotEntry: body.screenshotEntry,
      screenshotExit: body.screenshotExit,
      entryTime: body.entryTime,
      exitTime: body.exitTime,
      notes: body.notes,
      rating: body.rating,
      pnl,
      pnlPercent,
      isWin,
      duration,
      status: body.exitPrice ? 'closed' : 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    (db.data as any).journalEntries.push(trade);
    await updateAccountStats(body.accountId);
    await db.write();
    
    return reply.code(201).send({ success: true, trade });
  });
  
  // Get single trade
  fastify.get('/trades/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const { id } = request.params;
    const data = db.data as any;
    const trade = data.journalEntries.find((t: JournalEntry) => t.id === id);
    if (!trade) return reply.code(404).send({ success: false, error: 'Trade not found' });
    return { success: true, trade };
  });
  
  // Update trade
  fastify.put('/trades/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const { id } = request.params;
    const body = request.body as any;
    const data = db.data as any;
    
    const index = data.journalEntries.findIndex((t: JournalEntry) => t.id === id);
    if (index === -1) return reply.code(404).send({ success: false, error: 'Trade not found' });
    
    const existing = data.journalEntries[index];
    const exitPrice = body.exitPrice ?? existing.exitPrice;
    const entryPrice = body.entryPrice ?? existing.entryPrice;
    const quantity = body.quantity ?? existing.quantity;
    const direction = body.direction ?? existing.direction;
    
    let pnl = existing.pnl, pnlPercent = existing.pnlPercent, isWin = existing.isWin;
    if (exitPrice) {
      const dir = direction === 'LONG' ? 1 : -1;
      pnl = (exitPrice - entryPrice) * quantity * dir;
      pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100 * dir;
      isWin = pnl > 0;
    }
    
    data.journalEntries[index] = {
      ...existing,
      ...body,
      pnl, pnlPercent, isWin,
      tags: body.tags ? JSON.stringify(body.tags) : existing.tags,
      status: exitPrice ? 'closed' : 'open',
      updatedAt: new Date().toISOString(),
    };
    
    await updateAccountStats(existing.accountId);
    await db.write();
    return { success: true, trade: data.journalEntries[index] };
  });
  
  // Close trade
  fastify.post('/trades/:id/close', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const { id } = request.params;
    const body = request.body as any;
    const data = db.data as any;
    
    const index = data.journalEntries.findIndex((t: JournalEntry) => t.id === id);
    if (index === -1) return reply.code(404).send({ success: false, error: 'Trade not found' });
    
    const trade = data.journalEntries[index];
    const dir = trade.direction === 'LONG' ? 1 : -1;
    const pnl = (body.exitPrice - trade.entryPrice) * trade.quantity * dir;
    const pnlPercent = ((body.exitPrice - trade.entryPrice) / trade.entryPrice) * 100 * dir;
    const duration = Math.round((new Date(body.exitTime || new Date()).getTime() - new Date(trade.entryTime).getTime()) / 60000);
    
    data.journalEntries[index] = {
      ...trade,
      exitPrice: body.exitPrice,
      exitTime: body.exitTime || new Date().toISOString(),
      exitReason: body.exitReason,
      notes: body.notes || trade.notes,
      pnl, pnlPercent,
      isWin: pnl > 0,
      duration,
      status: 'closed',
      updatedAt: new Date().toISOString(),
    };
    
    await updateAccountStats(trade.accountId);
    await db.write();
    return { success: true, trade: data.journalEntries[index] };
  });
  
  // Delete trade
  fastify.delete('/trades/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const { id } = request.params;
    const data = db.data as any;
    
    const index = data.journalEntries.findIndex((t: JournalEntry) => t.id === id);
    if (index === -1) return reply.code(404).send({ success: false, error: 'Trade not found' });
    
    const accountId = data.journalEntries[index].accountId;
    data.journalEntries.splice(index, 1);
    await updateAccountStats(accountId);
    await db.write();
    return { success: true, message: 'Trade deleted' };
  });
  
  // -------------------------------------------------------------------------
  // ANALYTICS
  // -------------------------------------------------------------------------
  
  // Performance metrics
  fastify.get('/analytics/performance', async (request: FastifyRequest, reply: FastifyReply) => {
    ensureJournalCollections();
    const userId = request.headers['x-user-id'] as string || 'default';
    const query = request.query as any;
    const data = db.data as any;
    
    let trades = data.journalEntries.filter((t: JournalEntry) => t.userId === userId && t.status === 'closed');
    if (query.accountId) trades = trades.filter((t: JournalEntry) => t.accountId === query.accountId);
    if (query.from) trades = trades.filter((t: JournalEntry) => t.entryTime >= query.from);
    if (query.to) trades = trades.filter((t: JournalEntry) => t.entryTime <= query.to);
    
    const metrics = calculatePerformanceMetrics(trades);
    return { success: true, metrics };
  });
  
  // Equity curve
  fastify.get('/analytics/equity', async (request: FastifyRequest, reply: FastifyReply) => {
    ensureJournalCollections();
    const userId = request.headers['x-user-id'] as string || 'default';
    const query = request.query as any;
    const data = db.data as any;
    
    let trades = data.journalEntries.filter((t: JournalEntry) => t.userId === userId && t.status === 'closed');
    if (query.accountId) trades = trades.filter((t: JournalEntry) => t.accountId === query.accountId);
    
    let initialBalance = 10000;
    if (query.accountId) {
      const account = data.tradingAccounts.find((a: TradingAccount) => a.id === query.accountId);
      if (account) initialBalance = account.initialBalance;
    }
    
    const equityCurve = calculateEquityCurve(trades, initialBalance);
    return { success: true, equityCurve };
  });
  
  // Calendar heatmap
  fastify.get('/analytics/calendar', async (request: FastifyRequest, reply: FastifyReply) => {
    ensureJournalCollections();
    const userId = request.headers['x-user-id'] as string || 'default';
    const query = request.query as any;
    const data = db.data as any;
    
    let trades = data.journalEntries.filter((t: JournalEntry) => t.userId === userId && t.status === 'closed');
    if (query.accountId) trades = trades.filter((t: JournalEntry) => t.accountId === query.accountId);
    if (query.year) trades = trades.filter((t: JournalEntry) => t.exitTime && t.exitTime.startsWith(query.year));
    
    const calendar = calculateCalendarData(trades);
    return { success: true, calendar };
  });
  
  // Distribution by category
  fastify.get('/analytics/distribution/:category', async (request: FastifyRequest<{ Params: { category: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const userId = request.headers['x-user-id'] as string || 'default';
    const { category } = request.params;
    const query = request.query as any;
    const data = db.data as any;
    
    let trades = data.journalEntries.filter((t: JournalEntry) => t.userId === userId && t.status === 'closed');
    if (query.accountId) trades = trades.filter((t: JournalEntry) => t.accountId === query.accountId);
    
    const result: Record<string, any> = {};
    for (const trade of trades) {
      let key: string;
      switch (category) {
        case 'symbol': key = trade.symbol; break;
        case 'setup': key = trade.setup || 'Unknown'; break;
        case 'dayOfWeek': key = new Date(trade.entryTime).toLocaleDateString('en-US', { weekday: 'long' }); break;
        case 'hour': key = new Date(trade.entryTime).getHours().toString().padStart(2, '0') + ':00'; break;
        case 'direction': key = trade.direction; break;
        case 'emotion': key = trade.emotion || 'Unknown'; break;
        default: key = 'Unknown';
      }
      if (!result[key]) result[key] = { trades: 0, pnl: 0, wins: 0 };
      result[key].trades++;
      result[key].pnl += trade.pnl || 0;
      if (trade.isWin) result[key].wins++;
      result[key].winRate = (result[key].wins / result[key].trades) * 100;
    }
    
    return { success: true, distribution: result };
  });
  
  // -------------------------------------------------------------------------
  // IMPORT
  // -------------------------------------------------------------------------
  
  fastify.post('/import/csv', async (request: FastifyRequest, reply: FastifyReply) => {
    ensureJournalCollections();
    const userId = request.headers['x-user-id'] as string || 'default';
    const body = request.body as any;
    
    try {
      const { accountId, data: csvData, mapping } = body;
      const lines = csvData.split('\n');
      const headers = lines[0].split(',').map((h: string) => h.trim());
      const trades: JournalEntry[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v: string) => v.trim());
        if (values.length < 2) continue;
        
        const getValue = (field: string) => {
          const idx = headers.indexOf(mapping[field]);
          return idx >= 0 ? values[idx] : undefined;
        };
        
        const symbol = getValue('symbol');
        const direction = getValue('direction')?.toUpperCase();
        const entryPrice = parseFloat(getValue('entryPrice') || '0');
        const exitPrice = parseFloat(getValue('exitPrice') || '0');
        const quantity = parseFloat(getValue('quantity') || '0');
        const entryTime = getValue('entryTime');
        const exitTime = getValue('exitTime');
        
        if (!symbol || !entryPrice || !entryTime) continue;
        
        const dir = direction === 'LONG' || direction === 'BUY' ? 'LONG' : 'SHORT';
        const pnl = exitPrice ? (exitPrice - entryPrice) * quantity * (dir === 'LONG' ? 1 : -1) : 0;
        
        trades.push({
          id: uuidv4(),
          userId,
          accountId,
          symbol,
          direction: dir as 'LONG' | 'SHORT',
          entryPrice,
          exitPrice: exitPrice || undefined,
          quantity,
          entryTime,
          exitTime,
          pnl,
          pnlPercent: exitPrice ? ((exitPrice - entryPrice) / entryPrice) * 100 * (dir === 'LONG' ? 1 : -1) : 0,
          isWin: pnl > 0,
          status: exitPrice ? 'closed' : 'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      
      (db.data as any).journalEntries.push(...trades);
      await updateAccountStats(accountId);
      await db.write();
      
      return { success: true, imported: trades.length, message: `Imported ${trades.length} trades` };
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });
  
  // -------------------------------------------------------------------------
  // MT5 / BROKER SYNC (Auto-import from K.I.T.)
  // -------------------------------------------------------------------------
  
  // Sync trades from MT5 (called by K.I.T. bot)
  fastify.post('/sync/mt5', async (request: FastifyRequest, reply: FastifyReply) => {
    ensureJournalCollections();
    const body = request.body as any;
    const { accountId, trades: incomingTrades, syncKey } = body;
    
    if (!accountId || !incomingTrades) {
      return reply.code(400).send({ success: false, error: 'Missing accountId or trades' });
    }
    
    const data = db.data as any;
    const account = data.tradingAccounts.find((a: TradingAccount) => a.id === accountId);
    
    if (!account) {
      return reply.code(404).send({ success: false, error: 'Account not found' });
    }
    
    // Verify sync key if set
    if (account.syncKey && account.syncKey !== syncKey) {
      return reply.code(401).send({ success: false, error: 'Invalid sync key' });
    }
    
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const trade of incomingTrades) {
      // Check if trade already exists by MT5 ticket/order ID
      const existingIndex = data.journalEntries.findIndex((t: JournalEntry) => 
        t.accountId === accountId && t.externalId === trade.ticket?.toString()
      );
      
      const direction = trade.type === 0 || trade.type === 'BUY' ? 'LONG' : 'SHORT';
      const entryPrice = trade.price_open || trade.entryPrice;
      const exitPrice = trade.price_current || trade.exitPrice;
      const quantity = trade.volume || trade.quantity || trade.lots;
      const pnl = trade.profit || trade.pnl || 0;
      const commission = trade.commission || 0;
      const swap = trade.swap || 0;
      const netPnl = pnl + commission + swap;
      
      if (existingIndex >= 0) {
        // Update existing trade
        const existing = data.journalEntries[existingIndex];
        data.journalEntries[existingIndex] = {
          ...existing,
          exitPrice: exitPrice || existing.exitPrice,
          exitTime: trade.time_close || trade.exitTime || existing.exitTime,
          pnl: netPnl,
          pnlPercent: entryPrice ? ((exitPrice - entryPrice) / entryPrice) * 100 * (direction === 'LONG' ? 1 : -1) : 0,
          isWin: netPnl > 0,
          commission,
          swap,
          status: trade.time_close || trade.exitTime ? 'closed' : 'open',
          updatedAt: new Date().toISOString(),
        };
        updated++;
      } else if (trade.ticket || trade.order) {
        // Insert new trade
        const newTrade: JournalEntry = {
          id: uuidv4(),
          userId: account.userId,
          accountId,
          externalId: (trade.ticket || trade.order)?.toString(),
          symbol: trade.symbol,
          direction: direction as 'LONG' | 'SHORT',
          entryPrice,
          exitPrice: exitPrice || undefined,
          quantity,
          stopLoss: trade.sl,
          takeProfit: trade.tp,
          entryTime: trade.time_setup || trade.time_open || trade.entryTime || new Date().toISOString(),
          exitTime: trade.time_close || trade.exitTime,
          pnl: netPnl,
          pnlPercent: entryPrice && exitPrice ? ((exitPrice - entryPrice) / entryPrice) * 100 * (direction === 'LONG' ? 1 : -1) : 0,
          isWin: netPnl > 0,
          commission,
          swap,
          magic: trade.magic,
          comment: trade.comment,
          status: trade.time_close || trade.exitTime ? 'closed' : 'open',
          source: 'mt5',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        data.journalEntries.push(newTrade);
        imported++;
      } else {
        skipped++;
      }
    }
    
    // Update account connection status
    const accountIndex = data.tradingAccounts.findIndex((a: TradingAccount) => a.id === accountId);
    if (accountIndex >= 0) {
      data.tradingAccounts[accountIndex].isConnected = true;
      data.tradingAccounts[accountIndex].lastSyncAt = new Date().toISOString();
    }
    
    await updateAccountStats(accountId);
    await db.write();
    
    return { 
      success: true, 
      imported, 
      updated, 
      skipped,
      total: imported + updated,
      message: `Synced ${imported + updated} trades (${imported} new, ${updated} updated, ${skipped} skipped)` 
    };
  });
  
  // Connect MT5 account (store credentials for K.I.T. to use)
  fastify.post('/:id/connect/mt5', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const { id } = request.params;
    const body = request.body as any;
    const data = db.data as any;
    
    const index = data.tradingAccounts.findIndex((a: TradingAccount) => a.id === id);
    if (index === -1) return reply.code(404).send({ success: false, error: 'Account not found' });
    
    // Generate sync key for secure syncing
    const syncKey = uuidv4();
    
    data.tradingAccounts[index] = {
      ...data.tradingAccounts[index],
      connectionType: 'mt5',
      mt5Server: body.server,
      mt5Login: body.login,
      // Note: Password should be stored encrypted in production!
      mt5Password: body.password,
      broker: body.broker || 'RoboForex',
      syncKey,
      updatedAt: new Date().toISOString(),
    };
    
    await db.write();
    
    return { 
      success: true, 
      message: 'MT5 credentials saved. Use K.I.T. to sync trades.',
      syncKey,
      account: {
        ...data.tradingAccounts[index],
        mt5Password: '***hidden***',
      },
    };
  });
  
  // Disconnect MT5
  fastify.delete('/:id/connect/mt5', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const { id } = request.params;
    const data = db.data as any;
    
    const index = data.tradingAccounts.findIndex((a: TradingAccount) => a.id === id);
    if (index === -1) return reply.code(404).send({ success: false, error: 'Account not found' });
    
    data.tradingAccounts[index] = {
      ...data.tradingAccounts[index],
      connectionType: 'manual',
      mt5Server: undefined,
      mt5Login: undefined,
      mt5Password: undefined,
      syncKey: undefined,
      isConnected: false,
      updatedAt: new Date().toISOString(),
    };
    
    await db.write();
    return { success: true, message: 'MT5 disconnected' };
  });
  
  // Get sync status
  fastify.get('/:id/sync/status', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    ensureJournalCollections();
    const { id } = request.params;
    const data = db.data as any;
    
    const account = data.tradingAccounts.find((a: TradingAccount) => a.id === id);
    if (!account) return reply.code(404).send({ success: false, error: 'Account not found' });
    
    const trades = data.journalEntries.filter((t: JournalEntry) => t.accountId === id);
    const mt5Trades = trades.filter((t: JournalEntry) => t.source === 'mt5');
    
    return { 
      success: true, 
      status: {
        connectionType: account.connectionType,
        isConnected: account.isConnected,
        broker: account.broker,
        mt5Server: account.mt5Server,
        mt5Login: account.mt5Login,
        lastSyncAt: account.lastSyncAt,
        totalTrades: trades.length,
        mt5Trades: mt5Trades.length,
        manualTrades: trades.length - mt5Trades.length,
      },
    };
  });
}

export default journalRoutes;
