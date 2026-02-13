/**
 * Journal Service - Manages trading accounts and entries in Supabase
 * Connects authenticated users' journal data
 */

import { getSupabase } from '../db/supabase.ts';

// Types matching Supabase schema
export interface JournalAccount {
  id: string;
  user_id: string;
  name: string;
  broker: string | null;
  account_type: 'live' | 'demo' | 'prop_firm';
  platform: string;
  currency: string;
  initial_balance: number;
  current_balance: number;
  prop_firm_name: string | null;
  profit_target: number | null;
  profit_target_progress: number;
  max_daily_loss: number | null;
  current_daily_loss: number;
  max_total_drawdown: number | null;
  current_drawdown: number;
  challenge_phase: string | null;
  connection_id: string | null;
  is_connected: boolean;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  win_rate: number;
  profit_factor: number;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  account_id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  stop_loss: number | null;
  take_profit: number | null;
  risk_amount: number | null;
  r_multiple: number | null;
  setup: string | null;
  strategy: string | null;
  timeframe: string | null;
  tags: string[] | null;
  emotion: string | null;
  emotion_notes: string | null;
  entry_reason: string | null;
  exit_reason: string | null;
  lesson_learned: string | null;
  mistake: string | null;
  screenshot_entry: string | null;
  screenshot_exit: string | null;
  entry_time: string;
  exit_time: string | null;
  notes: string | null;
  rating: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  is_win: boolean | null;
  duration: number | null;
  status: 'open' | 'closed';
  source: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number;
  totalPnL: number;
  grossProfit: number;
  grossLoss: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  expectancy: number;
  averageRMultiple: number;
  averageHoldTime: number;
  longestWinStreak: number;
  longestLoseStreak: number;
  currentStreak: number;
  currentStreakType: 'win' | 'lose' | 'none';
  bySymbol: Record<string, { trades: number; pnl: number; wins: number; winRate: number }>;
  bySetup: Record<string, { trades: number; pnl: number; wins: number; winRate: number }>;
  byDayOfWeek: Record<string, { trades: number; pnl: number; wins: number; winRate: number }>;
  byHourOfDay: Record<string, { trades: number; pnl: number; wins: number; winRate: number }>;
  byEmotion: Record<string, { trades: number; pnl: number; wins: number; winRate: number }>;
  byMistake: Record<string, { trades: number; pnl: number; wins: number; winRate: number }>;
}

// Advanced Statistics (Myfxbook/Edgewonk style)
export interface AdvancedStatistics {
  // Risk-Adjusted Returns
  sharpeRatio: number;        // (Return - RiskFreeRate) / StdDev
  sortinoRatio: number;       // (Return - RiskFreeRate) / DownsideStdDev
  calmarRatio: number;        // CAGR / MaxDrawdown
  
  // Drawdown Analysis
  maxDrawdown: number;        // Largest peak-to-trough decline %
  maxDrawdownAmount: number;  // Largest peak-to-trough in $
  averageDrawdown: number;    // Average drawdown %
  recoveryFactor: number;     // Net Profit / Max Drawdown
  ulcerIndex: number;         // Measure of drawdown severity
  
  // Statistical Edge
  zScore: number;             // Measures dependency between trades
  expectancyPerR: number;     // Expectancy per unit of risk
  systemQualityNumber: number; // Van Tharp's SQN
  
  // Return Metrics
  ahpr: number;               // Average Holding Period Return %
  ghpr: number;               // Geometric Holding Period Return %
  standardDeviation: number;  // Volatility of returns
  downsideDeviation: number;  // Volatility of negative returns
  
  // Trading Patterns
  avgWinningStreak: number;
  avgLosingStreak: number;
  payoffRatio: number;        // Average Win / Average Loss
  kellyPercentage: number;    // Optimal position sizing %
  
  // Time-based
  avgHoldingTimeWins: number;   // Minutes
  avgHoldingTimeLosses: number; // Minutes
  bestTradingHour: string;
  worstTradingHour: string;
  bestTradingDay: string;
  worstTradingDay: string;
  
  // Recent Performance
  last7DaysPnL: number;
  last30DaysPnL: number;
  last7DaysWinRate: number;
  last30DaysWinRate: number;
}

export class JournalService {
  // ============================================
  // ACCOUNTS
  // ============================================

  static async getAccounts(userId: string): Promise<JournalAccount[]> {
    const { data, error } = await getSupabase()
      .from('journal_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
    return data || [];
  }

  static async getAccountById(accountId: string, userId: string): Promise<JournalAccount | null> {
    const { data, error } = await getSupabase()
      .from('journal_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return data;
  }

  static async createAccount(userId: string, account: Partial<JournalAccount>): Promise<JournalAccount | null> {
    const { data, error } = await getSupabase()
      .from('journal_accounts')
      .insert({
        user_id: userId,
        name: account.name,
        broker: account.broker || null,
        account_type: account.account_type || 'demo',
        platform: account.platform || 'mt5',
        currency: account.currency || 'USD',
        initial_balance: account.initial_balance || 10000,
        current_balance: account.initial_balance || 10000,
        prop_firm_name: account.prop_firm_name || null,
        profit_target: account.profit_target || null,
        max_daily_loss: account.max_daily_loss || null,
        max_total_drawdown: account.max_total_drawdown || null,
        challenge_phase: account.challenge_phase || null,
        connection_id: account.connection_id || null,
        is_connected: account.is_connected || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating account:', error);
      return null;
    }
    return data;
  }

  static async updateAccount(accountId: string, userId: string, updates: Partial<JournalAccount>): Promise<JournalAccount | null> {
    const { data, error } = await getSupabase()
      .from('journal_accounts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating account:', error);
      return null;
    }
    return data;
  }

  static async deleteAccount(accountId: string, userId: string): Promise<boolean> {
    const { error } = await getSupabase()
      .from('journal_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId);

    return !error;
  }

  static async updateAccountBalance(accountId: string, balance: number): Promise<boolean> {
    const { error } = await getSupabase()
      .from('journal_accounts')
      .update({ current_balance: balance })
      .eq('id', accountId);

    return !error;
  }

  static async updateAccountBroker(accountId: string, broker: string): Promise<boolean> {
    const { error } = await getSupabase()
      .from('journal_accounts')
      .update({ broker })
      .eq('id', accountId);

    return !error;
  }

  static async linkAccountToConnection(accountId: string, connectionId: string): Promise<boolean> {
    const { error } = await getSupabase()
      .from('journal_accounts')
      .update({ connection_id: connectionId, is_connected: true })
      .eq('id', accountId);

    return !error;
  }

  // ============================================
  // ENTRIES (TRADES)
  // ============================================

  static async getEntries(
    userId: string,
    options: {
      accountId?: string;
      symbol?: string;
      setup?: string;
      status?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ entries: JournalEntry[]; total: number }> {
    const { limit = 50, offset = 0 } = options;

    let query = getSupabase()
      .from('journal_entries')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('entry_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options.accountId) query = query.eq('account_id', options.accountId);
    if (options.symbol) query = query.ilike('symbol', `%${options.symbol}%`);
    if (options.setup) query = query.eq('setup', options.setup);
    if (options.status) query = query.eq('status', options.status);
    if (options.from) query = query.gte('entry_time', options.from);
    if (options.to) query = query.lte('entry_time', options.to);

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching entries:', error);
      return { entries: [], total: 0 };
    }

    return { entries: data || [], total: count || 0 };
  }

  static async getEntryById(entryId: string, userId: string): Promise<JournalEntry | null> {
    const { data, error } = await getSupabase()
      .from('journal_entries')
      .select('*')
      .eq('id', entryId)
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return data;
  }

  static async createEntry(userId: string, entry: Partial<JournalEntry>): Promise<JournalEntry | null> {
    // Normalize direction to uppercase
    const normalizedDirection = (entry.direction || 'LONG').toUpperCase() as 'LONG' | 'SHORT';
    
    // Use provided P&L or calculate from prices
    let pnl: number | null = entry.pnl ?? null;
    let pnlPercent: number | null = null;
    let isWin: boolean | null = null;
    let duration: number | null = null;

    // Calculate P&L from prices only if not already provided
    if (pnl === null && entry.exit_price && entry.entry_price && entry.quantity) {
      const direction = normalizedDirection === 'LONG' ? 1 : -1;
      pnl = (entry.exit_price - entry.entry_price) * entry.quantity * direction;
      pnlPercent = ((entry.exit_price - entry.entry_price) / entry.entry_price) * 100 * direction;
    }
    
    // Determine win/loss from P&L
    if (pnl !== null) {
      isWin = pnl > 0;
    }

    if (entry.exit_time && entry.entry_time) {
      duration = Math.round(
        (new Date(entry.exit_time).getTime() - new Date(entry.entry_time).getTime()) / 60000
      );
    }

    console.log('[JournalService] Creating entry:', { 
      userId, 
      account_id: entry.account_id, 
      symbol: entry.symbol, 
      direction: normalizedDirection,
      pnl,
      entry_time: entry.entry_time
    });
    
    const { data, error } = await getSupabase()
      .from('journal_entries')
      .insert({
        user_id: userId,
        account_id: entry.account_id,
        symbol: entry.symbol,
        direction: normalizedDirection,
        entry_price: entry.entry_price,
        exit_price: entry.exit_price || null,
        quantity: entry.quantity,
        stop_loss: entry.stop_loss || null,
        take_profit: entry.take_profit || null,
        risk_amount: entry.risk_amount || null,
        r_multiple: entry.risk_amount && pnl ? pnl / entry.risk_amount : null,
        setup: entry.setup || null,
        strategy: entry.strategy || null,
        timeframe: entry.timeframe || null,
        tags: entry.tags || null,
        emotion: entry.emotion || null,
        emotion_notes: entry.emotion_notes || null,
        entry_reason: entry.entry_reason || null,
        exit_reason: entry.exit_reason || null,
        lesson_learned: entry.lesson_learned || null,
        mistake: entry.mistake || null,
        screenshot_entry: entry.screenshot_entry || null,
        screenshot_exit: entry.screenshot_exit || null,
        entry_time: entry.entry_time,
        exit_time: entry.exit_time || null,
        notes: entry.notes || null,
        rating: entry.rating || null,
        pnl,
        pnl_percent: pnlPercent,
        is_win: isWin,
        duration,
        status: entry.exit_price ? 'closed' : 'open',
        source: entry.source || 'manual',
        external_id: entry.external_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[JournalService] Error creating entry:', error.message, error.details, error.hint);
      // Throw error so caller can see what went wrong
      throw new Error(`DB insert failed: ${error.message} (${error.code})`);
    }

    // Update account stats
    if (entry.account_id) {
      await this.updateAccountStats(entry.account_id, userId);
    }

    return data;
  }

  static async updateEntry(entryId: string, userId: string, updates: Partial<JournalEntry>): Promise<JournalEntry | null> {
    // Fetch existing entry to get full data for calculations
    const existing = await this.getEntryById(entryId, userId);
    if (!existing) return null;

    // Merge with updates
    const merged = { ...existing, ...updates };

    // Recalculate P&L
    let pnl = existing.pnl;
    let pnlPercent = existing.pnl_percent;
    let isWin = existing.is_win;

    if (merged.exit_price && merged.entry_price && merged.quantity) {
      const direction = merged.direction === 'LONG' ? 1 : -1;
      pnl = (merged.exit_price - merged.entry_price) * merged.quantity * direction;
      pnlPercent = ((merged.exit_price - merged.entry_price) / merged.entry_price) * 100 * direction;
      isWin = pnl > 0;
    }

    const { data, error } = await getSupabase()
      .from('journal_entries')
      .update({
        ...updates,
        pnl,
        pnl_percent: pnlPercent,
        is_win: isWin,
        status: merged.exit_price ? 'closed' : 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating entry:', error);
      return null;
    }

    // Update account stats
    await this.updateAccountStats(existing.account_id, userId);

    return data;
  }

  static async closeTrade(entryId: string, userId: string, closeData: {
    exit_price: number;
    exit_time?: string;
    exit_reason?: string;
    notes?: string;
  }): Promise<JournalEntry | null> {
    const existing = await this.getEntryById(entryId, userId);
    if (!existing) return null;

    const direction = existing.direction === 'LONG' ? 1 : -1;
    const pnl = (closeData.exit_price - existing.entry_price) * existing.quantity * direction;
    const pnlPercent = ((closeData.exit_price - existing.entry_price) / existing.entry_price) * 100 * direction;
    const exitTime = closeData.exit_time || new Date().toISOString();
    const duration = Math.round(
      (new Date(exitTime).getTime() - new Date(existing.entry_time).getTime()) / 60000
    );

    const { data, error } = await getSupabase()
      .from('journal_entries')
      .update({
        exit_price: closeData.exit_price,
        exit_time: exitTime,
        exit_reason: closeData.exit_reason || null,
        notes: closeData.notes || existing.notes,
        pnl,
        pnl_percent: pnlPercent,
        is_win: pnl > 0,
        duration,
        status: 'closed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error closing trade:', error);
      return null;
    }

    await this.updateAccountStats(existing.account_id, userId);
    return data;
  }

  static async deleteEntry(entryId: string, userId: string): Promise<boolean> {
    const existing = await this.getEntryById(entryId, userId);
    if (!existing) return false;

    const { error } = await getSupabase()
      .from('journal_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) return false;

    await this.updateAccountStats(existing.account_id, userId);
    return true;
  }

  // ============================================
  // IMPORT TRADES FROM SYNC
  // ============================================

  static async importTrades(
    userId: string,
    accountId: string,
    trades: Array<{
      symbol: string;
      direction: 'LONG' | 'SHORT' | 'long' | 'short';
      entry_price: number;
      exit_price?: number;
      quantity: number;
      entry_time: string;
      exit_time?: string;
      fees?: number;
      notes?: string;
      external_id?: string;
      source: string;
    }>
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const trade of trades) {
      try {
        // Check if trade already exists by external_id
        if (trade.external_id) {
          const { data: existing } = await getSupabase()
            .from('journal_entries')
            .select('id')
            .eq('user_id', userId)
            .eq('external_id', trade.external_id)
            .single();

          if (existing) {
            result.skipped++;
            continue;
          }
        }

        // Normalize direction
        const direction = trade.direction.toUpperCase() as 'LONG' | 'SHORT';

        // Calculate P&L
        let pnl: number | null = null;
        let pnlPercent: number | null = null;
        let isWin: boolean | null = null;

        if (trade.exit_price) {
          const dir = direction === 'LONG' ? 1 : -1;
          pnl = (trade.exit_price - trade.entry_price) * trade.quantity * dir;
          if (trade.fees) pnl -= trade.fees;
          pnlPercent = ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100 * dir;
          isWin = pnl > 0;
        }

        const { error } = await getSupabase()
          .from('journal_entries')
          .insert({
            user_id: userId,
            account_id: accountId,
            symbol: trade.symbol,
            direction,
            entry_price: trade.entry_price,
            exit_price: trade.exit_price || null,
            quantity: trade.quantity,
            entry_time: trade.entry_time,
            exit_time: trade.exit_time || null,
            notes: trade.notes || null,
            pnl,
            pnl_percent: pnlPercent,
            is_win: isWin,
            status: trade.exit_price ? 'closed' : 'open',
            source: trade.source,
            external_id: trade.external_id || null,
          });

        if (error) {
          result.errors.push(`Trade ${trade.symbol}: ${error.message}`);
        } else {
          result.imported++;
        }
      } catch (err: any) {
        result.errors.push(`Trade ${trade.symbol}: ${err.message}`);
      }
    }

    // Update account stats after import
    await this.updateAccountStats(accountId, userId);

    return result;
  }

  // ============================================
  // ACCOUNT STATS UPDATE
  // ============================================

  static async updateAccountStats(accountId: string, userId: string): Promise<void> {
    // Get all closed trades for this account
    const { data: trades } = await getSupabase()
      .from('journal_entries')
      .select('pnl, is_win')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .eq('status', 'closed');

    if (!trades) return;

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.is_win === true).length;
    const losingTrades = trades.filter(t => t.is_win === false).length;
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const grossProfit = trades.filter(t => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(trades.filter(t => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    // Get initial balance to calculate current balance
    const { data: account } = await getSupabase()
      .from('journal_accounts')
      .select('initial_balance, profit_target')
      .eq('id', accountId)
      .single();

    if (!account) return;

    await getSupabase()
      .from('journal_accounts')
      .update({
        current_balance: account.initial_balance + totalPnL,
        total_trades: totalTrades,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        total_pnl: totalPnL,
        win_rate: winRate,
        profit_factor: profitFactor,
        profit_target_progress: account.profit_target
          ? (totalPnL / account.profit_target) * 100
          : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);
  }

  // ============================================
  // ANALYTICS
  // ============================================

  static async getPerformanceMetrics(
    userId: string,
    options: { accountId?: string; from?: string; to?: string } = {}
  ): Promise<PerformanceMetrics> {
    let query = getSupabase()
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .order('entry_time', { ascending: true });

    if (options.accountId) query = query.eq('account_id', options.accountId);
    if (options.from) query = query.gte('entry_time', options.from);
    if (options.to) query = query.lte('entry_time', options.to);

    const { data: trades } = await query;

    if (!trades || trades.length === 0) {
      return this.emptyMetrics();
    }

    return this.calculateMetrics(trades);
  }

  static async getEquityCurve(
    userId: string,
    accountId?: string
  ): Promise<Array<{ date: string; balance: number; pnl: number; drawdown: number; tradesCount: number }>> {
    let query = getSupabase()
      .from('journal_entries')
      .select('exit_time, entry_time, pnl')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .order('exit_time', { ascending: true });

    if (accountId) query = query.eq('account_id', accountId);

    const { data: trades } = await query;

    if (!trades || trades.length === 0) return [];

    // Get initial balance
    let initialBalance = 10000;
    if (accountId) {
      const { data: account } = await getSupabase()
        .from('journal_accounts')
        .select('initial_balance')
        .eq('id', accountId)
        .single();
      if (account) initialBalance = account.initial_balance;
    }

    // Group by date
    const byDate: Record<string, number[]> = {};
    for (const trade of trades) {
      const date = (trade.exit_time || trade.entry_time).split('T')[0];
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(trade.pnl || 0);
    }

    const curve: Array<{ date: string; balance: number; pnl: number; drawdown: number; tradesCount: number }> = [];
    let balance = initialBalance;
    let maxBalance = initialBalance;

    for (const date of Object.keys(byDate).sort()) {
      const dayPnL = byDate[date].reduce((sum, p) => sum + p, 0);
      balance += dayPnL;
      maxBalance = Math.max(maxBalance, balance);
      const drawdown = ((maxBalance - balance) / maxBalance) * 100;

      curve.push({
        date,
        balance,
        pnl: dayPnL,
        drawdown,
        tradesCount: byDate[date].length,
      });
    }

    return curve;
  }

  static async getCalendarData(
    userId: string,
    options: { accountId?: string; year?: string } = {}
  ): Promise<Array<{ date: string; pnl: number; tradesCount: number; winRate: number; color: string; intensity: number }>> {
    let query = getSupabase()
      .from('journal_entries')
      .select('exit_time, entry_time, pnl, is_win')
      .eq('user_id', userId)
      .eq('status', 'closed');

    if (options.accountId) query = query.eq('account_id', options.accountId);
    if (options.year) query = query.like('exit_time', `${options.year}%`);

    const { data: trades } = await query;

    if (!trades || trades.length === 0) return [];

    // Group by date
    const byDate: Record<string, Array<{ pnl: number; is_win: boolean }>> = {};
    for (const trade of trades) {
      const date = (trade.exit_time || trade.entry_time).split('T')[0];
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({ pnl: trade.pnl || 0, is_win: trade.is_win });
    }

    // Calculate max P&L for intensity scaling
    const maxPnL = Math.max(
      ...Object.values(byDate).map(dayTrades =>
        Math.abs(dayTrades.reduce((sum, t) => sum + t.pnl, 0))
      ),
      1
    );

    return Object.entries(byDate)
      .map(([date, dayTrades]) => {
        const pnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
        const wins = dayTrades.filter(t => t.is_win).length;
        const winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;

        return {
          date,
          pnl,
          tradesCount: dayTrades.length,
          winRate,
          color: pnl > 0 ? 'green' : pnl < 0 ? 'red' : 'gray',
          intensity: Math.min(Math.abs(pnl) / maxPnL, 1),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ============================================
  // HELPERS
  // ============================================

  private static emptyMetrics(): PerformanceMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      winRate: 0,
      totalPnL: 0,
      grossProfit: 0,
      grossLoss: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      averageRMultiple: 0,
      averageHoldTime: 0,
      longestWinStreak: 0,
      longestLoseStreak: 0,
      currentStreak: 0,
      currentStreakType: 'none',
      bySymbol: {},
      bySetup: {},
      byDayOfWeek: {},
      byHourOfDay: {},
      byEmotion: {},
      byMistake: {},
    };
  }

  private static emptyAdvancedStats(): AdvancedStatistics {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      maxDrawdownAmount: 0,
      averageDrawdown: 0,
      recoveryFactor: 0,
      ulcerIndex: 0,
      zScore: 0,
      expectancyPerR: 0,
      systemQualityNumber: 0,
      ahpr: 0,
      ghpr: 0,
      standardDeviation: 0,
      downsideDeviation: 0,
      avgWinningStreak: 0,
      avgLosingStreak: 0,
      payoffRatio: 0,
      kellyPercentage: 0,
      avgHoldingTimeWins: 0,
      avgHoldingTimeLosses: 0,
      bestTradingHour: '',
      worstTradingHour: '',
      bestTradingDay: '',
      worstTradingDay: '',
      last7DaysPnL: 0,
      last30DaysPnL: 0,
      last7DaysWinRate: 0,
      last30DaysWinRate: 0,
    };
  }

  private static calculateMetrics(trades: any[]): PerformanceMetrics {
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.is_win === true);
    const losses = trades.filter(t => t.is_win === false && t.pnl !== 0);
    const breakEven = trades.filter(t => t.pnl === 0);

    const grossProfit = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));

    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    const expectancy = totalTrades > 0 ? (winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss) : 0;

    // Streaks
    let longestWinStreak = 0, longestLoseStreak = 0;
    let tempWinStreak = 0, tempLoseStreak = 0;
    let currentStreak = 0;
    let currentStreakType: 'win' | 'lose' | 'none' = 'none';

    for (const trade of trades) {
      if (trade.is_win) {
        tempWinStreak++;
        tempLoseStreak = 0;
        longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
      } else if (trade.pnl < 0) {
        tempLoseStreak++;
        tempWinStreak = 0;
        longestLoseStreak = Math.max(longestLoseStreak, tempLoseStreak);
      }
    }

    if (trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      currentStreak = lastTrade.is_win ? tempWinStreak : tempLoseStreak;
      currentStreakType = lastTrade.is_win ? 'win' : 'lose';
    }

    // By category
    const bySymbol: Record<string, any> = {};
    const bySetup: Record<string, any> = {};
    const byDayOfWeek: Record<string, any> = {};
    const byHourOfDay: Record<string, any> = {};
    const byEmotion: Record<string, any> = {};
    const byMistake: Record<string, any> = {};

    for (const trade of trades) {
      // By Symbol
      const symbol = trade.symbol;
      if (!bySymbol[symbol]) bySymbol[symbol] = { trades: 0, pnl: 0, wins: 0 };
      bySymbol[symbol].trades++;
      bySymbol[symbol].pnl += trade.pnl || 0;
      if (trade.is_win) bySymbol[symbol].wins++;
      bySymbol[symbol].winRate = (bySymbol[symbol].wins / bySymbol[symbol].trades) * 100;

      // By Setup
      if (trade.setup) {
        if (!bySetup[trade.setup]) bySetup[trade.setup] = { trades: 0, pnl: 0, wins: 0 };
        bySetup[trade.setup].trades++;
        bySetup[trade.setup].pnl += trade.pnl || 0;
        if (trade.is_win) bySetup[trade.setup].wins++;
        bySetup[trade.setup].winRate = (bySetup[trade.setup].wins / bySetup[trade.setup].trades) * 100;
      }

      // By Day of Week
      const day = new Date(trade.entry_time).toLocaleDateString('en-US', { weekday: 'long' });
      if (!byDayOfWeek[day]) byDayOfWeek[day] = { trades: 0, pnl: 0, wins: 0 };
      byDayOfWeek[day].trades++;
      byDayOfWeek[day].pnl += trade.pnl || 0;
      if (trade.is_win) byDayOfWeek[day].wins++;
      byDayOfWeek[day].winRate = (byDayOfWeek[day].wins / byDayOfWeek[day].trades) * 100;

      // By Hour
      const hour = new Date(trade.entry_time).getHours().toString().padStart(2, '0') + ':00';
      if (!byHourOfDay[hour]) byHourOfDay[hour] = { trades: 0, pnl: 0, wins: 0 };
      byHourOfDay[hour].trades++;
      byHourOfDay[hour].pnl += trade.pnl || 0;
      if (trade.is_win) byHourOfDay[hour].wins++;
      byHourOfDay[hour].winRate = (byHourOfDay[hour].wins / byHourOfDay[hour].trades) * 100;

      // By Emotion
      if (trade.emotion) {
        if (!byEmotion[trade.emotion]) byEmotion[trade.emotion] = { trades: 0, pnl: 0, wins: 0 };
        byEmotion[trade.emotion].trades++;
        byEmotion[trade.emotion].pnl += trade.pnl || 0;
        if (trade.is_win) byEmotion[trade.emotion].wins++;
        byEmotion[trade.emotion].winRate = (byEmotion[trade.emotion].wins / byEmotion[trade.emotion].trades) * 100;
      }

      // By Mistake
      const mistakeKey = trade.mistake || 'none';
      if (!byMistake[mistakeKey]) byMistake[mistakeKey] = { trades: 0, pnl: 0, wins: 0 };
      byMistake[mistakeKey].trades++;
      byMistake[mistakeKey].pnl += trade.pnl || 0;
      if (trade.is_win) byMistake[mistakeKey].wins++;
      byMistake[mistakeKey].winRate = (byMistake[mistakeKey].wins / byMistake[mistakeKey].trades) * 100;
    }

    return {
      totalTrades,
      winningTrades: wins.length,
      losingTrades: losses.length,
      breakEvenTrades: breakEven.length,
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
      averageRMultiple: trades.filter(t => t.r_multiple).reduce((sum, t) => sum + (t.r_multiple || 0), 0) /
        (trades.filter(t => t.r_multiple).length || 1),
      averageHoldTime: trades.filter(t => t.duration).reduce((sum, t) => sum + (t.duration || 0), 0) /
        (trades.filter(t => t.duration).length || 1),
      longestWinStreak,
      longestLoseStreak,
      currentStreak,
      currentStreakType,
      bySymbol,
      bySetup,
      byDayOfWeek,
      byHourOfDay,
      byEmotion,
      byMistake,
    };
  }

  // ============================================
  // ADVANCED STATISTICS (Sharpe, Sortino, etc.)
  // ============================================

  static async getAdvancedStatistics(
    userId: string,
    options: { accountId?: string; from?: string; to?: string } = {}
  ): Promise<AdvancedStatistics> {
    let query = getSupabase()
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .order('entry_time', { ascending: true });

    if (options.accountId) query = query.eq('account_id', options.accountId);
    if (options.from) query = query.gte('entry_time', options.from);
    if (options.to) query = query.lte('entry_time', options.to);

    const { data: trades } = await query;

    if (!trades || trades.length < 2) {
      return this.emptyAdvancedStats();
    }

    // Get initial balance
    let initialBalance = 10000;
    if (options.accountId) {
      const { data: account } = await getSupabase()
        .from('journal_accounts')
        .select('initial_balance')
        .eq('id', options.accountId)
        .single();
      if (account) initialBalance = account.initial_balance;
    }

    return this.calculateAdvancedStats(trades, initialBalance);
  }

  private static calculateAdvancedStats(trades: any[], initialBalance: number): AdvancedStatistics {
    const n = trades.length;
    const pnls = trades.map(t => t.pnl || 0);
    const returns = trades.map(t => ((t.pnl || 0) / initialBalance) * 100);
    
    // Basic calculations
    const totalPnL = pnls.reduce((a, b) => a + b, 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / n;
    const wins = trades.filter(t => t.is_win === true);
    const losses = trades.filter(t => t.is_win === false && t.pnl < 0);
    const winRate = wins.length / n;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0)) / losses.length : 0;
    
    // Standard Deviation
    const squaredDiffs = returns.map(r => Math.pow(r - avgReturn, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(variance);
    
    // Downside Deviation (only negative returns)
    const negativeReturns = returns.filter(r => r < 0);
    const downsideVariance = negativeReturns.length > 0 
      ? negativeReturns.map(r => Math.pow(r, 2)).reduce((a, b) => a + b, 0) / negativeReturns.length
      : 0;
    const downsideDev = Math.sqrt(downsideVariance);
    
    // Sharpe Ratio (assuming 0% risk-free rate for simplicity)
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
    
    // Sortino Ratio
    const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0;
    
    // Equity curve for drawdown calculations
    let balance = initialBalance;
    let peak = initialBalance;
    let maxDD = 0;
    let maxDDAmount = 0;
    const drawdowns: number[] = [];
    const equityCurve: number[] = [initialBalance];
    
    for (const trade of trades) {
      balance += trade.pnl || 0;
      equityCurve.push(balance);
      peak = Math.max(peak, balance);
      const dd = ((peak - balance) / peak) * 100;
      drawdowns.push(dd);
      if (dd > maxDD) {
        maxDD = dd;
        maxDDAmount = peak - balance;
      }
    }
    
    const avgDrawdown = drawdowns.length > 0 ? drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length : 0;
    
    // Recovery Factor
    const recoveryFactor = maxDDAmount > 0 ? totalPnL / maxDDAmount : 0;
    
    // Calmar Ratio (using max drawdown)
    const calmarRatio = maxDD > 0 ? (avgReturn * 252) / maxDD : 0;
    
    // Ulcer Index (RMS of drawdowns)
    const ulcerIndex = drawdowns.length > 0 
      ? Math.sqrt(drawdowns.map(d => d * d).reduce((a, b) => a + b, 0) / drawdowns.length) 
      : 0;
    
    // Z-Score (measures dependency between trades)
    // Positive Z = wins follow losses, Negative Z = streaks persist
    let runs = 1;
    for (let i = 1; i < trades.length; i++) {
      if (trades[i].is_win !== trades[i-1].is_win) runs++;
    }
    const W = wins.length;
    const L = losses.length;
    const expectedRuns = (2 * W * L) / (W + L) + 1;
    const runsStdDev = Math.sqrt((2 * W * L * (2 * W * L - W - L)) / ((W + L) * (W + L) * (W + L - 1)));
    const zScore = runsStdDev > 0 ? (runs - expectedRuns) / runsStdDev : 0;
    
    // AHPR (Average Holding Period Return) & GHPR
    const ahpr = avgReturn;
    const ghpr = n > 0 ? (Math.pow(balance / initialBalance, 1 / n) - 1) * 100 : 0;
    
    // Payoff Ratio
    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 0;
    
    // Kelly Percentage
    const kellyPercentage = payoffRatio > 0 
      ? ((winRate * payoffRatio - (1 - winRate)) / payoffRatio) * 100 
      : 0;
    
    // System Quality Number (SQN) - Van Tharp
    const rMultiples = trades.filter(t => t.r_multiple).map(t => t.r_multiple);
    let sqn = 0;
    if (rMultiples.length > 0) {
      const avgR = rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length;
      const rVariance = rMultiples.map(r => Math.pow(r - avgR, 2)).reduce((a, b) => a + b, 0) / rMultiples.length;
      const rStdDev = Math.sqrt(rVariance);
      sqn = rStdDev > 0 ? (avgR / rStdDev) * Math.sqrt(rMultiples.length) : 0;
    }
    
    // Expectancy per R
    const expectancyPerR = rMultiples.length > 0 
      ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length 
      : 0;
    
    // Streak Analysis
    const winStreaks: number[] = [];
    const loseStreaks: number[] = [];
    let currentWinStreak = 0;
    let currentLoseStreak = 0;
    
    for (const trade of trades) {
      if (trade.is_win) {
        currentWinStreak++;
        if (currentLoseStreak > 0) {
          loseStreaks.push(currentLoseStreak);
          currentLoseStreak = 0;
        }
      } else if (trade.pnl < 0) {
        currentLoseStreak++;
        if (currentWinStreak > 0) {
          winStreaks.push(currentWinStreak);
          currentWinStreak = 0;
        }
      }
    }
    if (currentWinStreak > 0) winStreaks.push(currentWinStreak);
    if (currentLoseStreak > 0) loseStreaks.push(currentLoseStreak);
    
    const avgWinningStreak = winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length : 0;
    const avgLosingStreak = loseStreaks.length > 0 ? loseStreaks.reduce((a, b) => a + b, 0) / loseStreaks.length : 0;
    
    // Holding Time Analysis
    const winsWithDuration = wins.filter(t => t.duration);
    const lossesWithDuration = losses.filter(t => t.duration);
    const avgHoldingTimeWins = winsWithDuration.length > 0 
      ? winsWithDuration.reduce((s, t) => s + t.duration, 0) / winsWithDuration.length 
      : 0;
    const avgHoldingTimeLosses = lossesWithDuration.length > 0 
      ? lossesWithDuration.reduce((s, t) => s + t.duration, 0) / lossesWithDuration.length 
      : 0;
    
    // Best/Worst Trading Hour
    const byHour: Record<string, { pnl: number; trades: number }> = {};
    for (const trade of trades) {
      const hour = new Date(trade.entry_time).getHours().toString().padStart(2, '0') + ':00';
      if (!byHour[hour]) byHour[hour] = { pnl: 0, trades: 0 };
      byHour[hour].pnl += trade.pnl || 0;
      byHour[hour].trades++;
    }
    const hourEntries = Object.entries(byHour).filter(([, v]) => v.trades >= 3);
    const bestTradingHour = hourEntries.length > 0 
      ? hourEntries.sort((a, b) => b[1].pnl - a[1].pnl)[0][0] 
      : '';
    const worstTradingHour = hourEntries.length > 0 
      ? hourEntries.sort((a, b) => a[1].pnl - b[1].pnl)[0][0] 
      : '';
    
    // Best/Worst Trading Day
    const byDay: Record<string, { pnl: number; trades: number }> = {};
    for (const trade of trades) {
      const day = new Date(trade.entry_time).toLocaleDateString('en-US', { weekday: 'long' });
      if (!byDay[day]) byDay[day] = { pnl: 0, trades: 0 };
      byDay[day].pnl += trade.pnl || 0;
      byDay[day].trades++;
    }
    const dayEntries = Object.entries(byDay).filter(([, v]) => v.trades >= 3);
    const bestTradingDay = dayEntries.length > 0 
      ? dayEntries.sort((a, b) => b[1].pnl - a[1].pnl)[0][0] 
      : '';
    const worstTradingDay = dayEntries.length > 0 
      ? dayEntries.sort((a, b) => a[1].pnl - b[1].pnl)[0][0] 
      : '';
    
    // Recent Performance
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const tradesLast7 = trades.filter(t => new Date(t.entry_time) >= last7Days);
    const tradesLast30 = trades.filter(t => new Date(t.entry_time) >= last30Days);
    
    const last7DaysPnL = tradesLast7.reduce((s, t) => s + (t.pnl || 0), 0);
    const last30DaysPnL = tradesLast30.reduce((s, t) => s + (t.pnl || 0), 0);
    const last7DaysWinRate = tradesLast7.length > 0 
      ? (tradesLast7.filter(t => t.is_win).length / tradesLast7.length) * 100 
      : 0;
    const last30DaysWinRate = tradesLast30.length > 0 
      ? (tradesLast30.filter(t => t.is_win).length / tradesLast30.length) * 100 
      : 0;
    
    return {
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      calmarRatio: Math.round(calmarRatio * 100) / 100,
      maxDrawdown: Math.round(maxDD * 100) / 100,
      maxDrawdownAmount: Math.round(maxDDAmount * 100) / 100,
      averageDrawdown: Math.round(avgDrawdown * 100) / 100,
      recoveryFactor: Math.round(recoveryFactor * 100) / 100,
      ulcerIndex: Math.round(ulcerIndex * 100) / 100,
      zScore: Math.round(zScore * 100) / 100,
      expectancyPerR: Math.round(expectancyPerR * 100) / 100,
      systemQualityNumber: Math.round(sqn * 100) / 100,
      ahpr: Math.round(ahpr * 100) / 100,
      ghpr: Math.round(ghpr * 100) / 100,
      standardDeviation: Math.round(stdDev * 100) / 100,
      downsideDeviation: Math.round(downsideDev * 100) / 100,
      avgWinningStreak: Math.round(avgWinningStreak * 10) / 10,
      avgLosingStreak: Math.round(avgLosingStreak * 10) / 10,
      payoffRatio: Math.round(payoffRatio * 100) / 100,
      kellyPercentage: Math.round(kellyPercentage * 100) / 100,
      avgHoldingTimeWins: Math.round(avgHoldingTimeWins),
      avgHoldingTimeLosses: Math.round(avgHoldingTimeLosses),
      bestTradingHour,
      worstTradingHour,
      bestTradingDay,
      worstTradingDay,
      last7DaysPnL: Math.round(last7DaysPnL * 100) / 100,
      last30DaysPnL: Math.round(last30DaysPnL * 100) / 100,
      last7DaysWinRate: Math.round(last7DaysWinRate * 10) / 10,
      last30DaysWinRate: Math.round(last30DaysWinRate * 10) / 10,
    };
  }

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================

  static async exportToCSV(userId: string, accountId?: string): Promise<string> {
    const { entries } = await this.getEntries(userId, { accountId, limit: 10000 });
    
    const headers = [
      'Date', 'Symbol', 'Direction', 'Entry Price', 'Exit Price', 'Quantity',
      'Stop Loss', 'Take Profit', 'P&L', 'P&L %', 'R-Multiple', 'Duration (min)',
      'Setup', 'Emotion', 'Mistake', 'Tags', 'Notes'
    ];
    
    const rows = entries.map(e => [
      e.entry_time?.split('T')[0] || '',
      e.symbol,
      e.direction,
      e.entry_price,
      e.exit_price || '',
      e.quantity,
      e.stop_loss || '',
      e.take_profit || '',
      e.pnl || '',
      e.pnl_percent?.toFixed(2) || '',
      e.r_multiple?.toFixed(2) || '',
      e.duration || '',
      e.setup || '',
      e.emotion || '',
      e.mistake || '',
      Array.isArray(e.tags) ? e.tags.join(';') : e.tags || '',
      (e.notes || '').replace(/"/g, '""'),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }

  static async getReportData(
    userId: string,
    period: 'weekly' | 'monthly',
    accountId?: string
  ): Promise<{
    period: string;
    startDate: string;
    endDate: string;
    metrics: PerformanceMetrics;
    advancedStats: AdvancedStatistics;
    dailyPnL: Array<{ date: string; pnl: number; tradesCount: number }>;
    topSymbols: Array<{ symbol: string; pnl: number; trades: number; winRate: number }>;
    comparison: {
      pnlChange: number;
      winRateChange: number;
      tradesChange: number;
    };
  }> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;
    
    if (period === 'weekly') {
      // Current week (Monday to Sunday)
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);
      startDate = monday;
      endDate = now;
      
      // Previous week
      prevEndDate = new Date(monday);
      prevEndDate.setDate(monday.getDate() - 1);
      prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevEndDate.getDate() - 6);
    } else {
      // Current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
      
      // Previous month
      prevEndDate = new Date(startDate);
      prevEndDate.setDate(0);
      prevStartDate = new Date(prevEndDate.getFullYear(), prevEndDate.getMonth(), 1);
    }
    
    const fromStr = startDate.toISOString().split('T')[0];
    const toStr = endDate.toISOString().split('T')[0];
    const prevFromStr = prevStartDate.toISOString().split('T')[0];
    const prevToStr = prevEndDate.toISOString().split('T')[0];
    
    // Get current period metrics
    const metrics = await this.getPerformanceMetrics(userId, { accountId, from: fromStr, to: toStr });
    const advancedStats = await this.getAdvancedStatistics(userId, { accountId, from: fromStr, to: toStr });
    
    // Get previous period metrics for comparison
    const prevMetrics = await this.getPerformanceMetrics(userId, { accountId, from: prevFromStr, to: prevToStr });
    
    // Get daily P&L
    const calendar = await this.getCalendarData(userId, { accountId });
    const dailyPnL = calendar
      .filter(d => d.date >= fromStr && d.date <= toStr)
      .map(d => ({ date: d.date, pnl: d.pnl, tradesCount: d.tradesCount }));
    
    // Top symbols
    const topSymbols = Object.entries(metrics.bySymbol)
      .map(([symbol, data]: [string, any]) => ({
        symbol,
        pnl: data.pnl,
        trades: data.trades,
        winRate: data.winRate,
      }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);
    
    // Comparison
    const comparison = {
      pnlChange: prevMetrics.totalPnL !== 0 
        ? ((metrics.totalPnL - prevMetrics.totalPnL) / Math.abs(prevMetrics.totalPnL)) * 100 
        : metrics.totalPnL > 0 ? 100 : 0,
      winRateChange: metrics.winRate - prevMetrics.winRate,
      tradesChange: metrics.totalTrades - prevMetrics.totalTrades,
    };
    
    return {
      period,
      startDate: fromStr,
      endDate: toStr,
      metrics,
      advancedStats,
      dailyPnL,
      topSymbols,
      comparison,
    };
  }

  // ============================================
  // ALIASES (for route compatibility)
  // ============================================

  // Alias for getPerformanceMetrics
  static async getMetrics(userId: string, accountId?: string) {
    return this.getPerformanceMetrics(userId, { accountId });
  }

  // Alias for getCalendarData - returns daily P&L as an object
  static async getDailyPnL(userId: string, year?: number, month?: number) {
    const yearStr = year?.toString() || new Date().getFullYear().toString();
    const calendarData = await this.getCalendarData(userId, { year: yearStr });
    
    // Convert array to object { date: pnl }
    const dailyPnL: Record<string, number> = {};
    for (const day of calendarData) {
      dailyPnL[day.date] = day.pnl;
    }
    return dailyPnL;
  }

  // Alias for importTrades - generic entry import
  static async importEntries(
    userId: string,
    entries: Array<{
      symbol: string;
      direction: string;
      entry_date: string;
      entry_price: number;
      exit_price?: number;
      quantity: number;
      fees?: number;
      pnl?: number;
      status?: string;
      notes?: string;
      external_id?: string;
    }>,
    source: string
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    // Get or create a default account for imports
    const accounts = await this.getAccounts(userId);
    let accountId = accounts[0]?.id;

    if (!accountId) {
      const newAccount = await this.createAccount(userId, {
        name: `${source} Import`,
        platform: source.toLowerCase(),
        account_type: 'live',
        initial_balance: 10000,
      });
      accountId = newAccount?.id;
    }

    if (!accountId) {
      return { imported: 0, skipped: 0, errors: ['Could not create import account'] };
    }

    for (const entry of entries) {
      try {
        // Check for duplicates by external_id
        if (entry.external_id) {
          const { data: existing } = await getSupabase()
            .from('journal_entries')
            .select('id')
            .eq('user_id', userId)
            .eq('external_id', entry.external_id)
            .single();

          if (existing) {
            result.skipped++;
            continue;
          }
        }

        // Normalize direction
        const direction = (entry.direction?.toUpperCase() === 'LONG' || entry.direction?.toLowerCase() === 'long') 
          ? 'LONG' : 'SHORT';

        // Calculate P&L if not provided
        let pnl = entry.pnl;
        let pnlPercent: number | null = null;
        let isWin: boolean | null = null;

        if (pnl === undefined && entry.exit_price && entry.entry_price && entry.quantity) {
          const dir = direction === 'LONG' ? 1 : -1;
          pnl = (entry.exit_price - entry.entry_price) * entry.quantity * dir;
          if (entry.fees) pnl -= entry.fees;
        }

        if (pnl !== undefined && pnl !== null) {
          isWin = pnl > 0;
          if (entry.entry_price) {
            pnlPercent = (pnl / (entry.entry_price * entry.quantity)) * 100;
          }
        }

        const { error } = await getSupabase()
          .from('journal_entries')
          .insert({
            user_id: userId,
            account_id: accountId,
            symbol: entry.symbol,
            direction,
            entry_price: entry.entry_price,
            exit_price: entry.exit_price || null,
            quantity: entry.quantity || 1,
            entry_time: entry.entry_date,
            exit_time: entry.exit_price ? entry.entry_date : null,
            notes: entry.notes || null,
            pnl,
            pnl_percent: pnlPercent,
            is_win: isWin,
            status: entry.status === 'open' ? 'open' : 'closed',
            source,
            external_id: entry.external_id || null,
          });

        if (error) {
          result.errors.push(`${entry.symbol}: ${error.message}`);
        } else {
          result.imported++;
        }
      } catch (err: any) {
        result.errors.push(`${entry.symbol}: ${err.message}`);
      }
    }

    // Update account stats
    await this.updateAccountStats(accountId, userId);

    return result;
  }

}
