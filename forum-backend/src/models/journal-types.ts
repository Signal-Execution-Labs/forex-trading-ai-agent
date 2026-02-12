/**
 * K.I.T. Trading Journal Types
 * Professional Trading Journal with MMplatinum-level features
 */

import { z } from 'zod';

// ============================================================================
// TRADING ACCOUNTS (Multi-Account + Prop Firm Support)
// ============================================================================

export const TradingAccountCreateSchema = z.object({
  name: z.string().min(1).max(100),
  broker: z.string().min(1).max(100),
  accountType: z.enum(['live', 'demo', 'prop_firm', 'funded']),
  platform: z.enum(['mt4', 'mt5', 'binance', 'bybit', 'other']),
  currency: z.string().default('USD'),
  initialBalance: z.number().positive(),
  // Prop firm specific
  propFirmName: z.string().optional(),
  profitTarget: z.number().optional(),
  maxDailyLoss: z.number().optional(),
  maxTotalDrawdown: z.number().optional(),
  challengePhase: z.enum(['evaluation', 'verification', 'funded']).optional(),
  // Connection
  connectionType: z.enum(['manual', 'mt5_investor', 'mt5_ea', 'api']).optional(),
  connectionConfig: z.record(z.any()).optional(),
});

export interface TradingAccount {
  id: string;
  userId: string;
  name: string;
  broker: string;
  accountType: 'live' | 'demo' | 'prop_firm' | 'funded';
  platform: 'mt4' | 'mt5' | 'binance' | 'bybit' | 'other';
  currency: string;
  initialBalance: number;
  currentBalance: number;
  // Prop firm specific
  propFirmName?: string;
  profitTarget?: number;
  profitTargetProgress?: number;
  maxDailyLoss?: number;
  currentDailyLoss?: number;
  maxTotalDrawdown?: number;
  currentDrawdown?: number;
  challengePhase?: 'evaluation' | 'verification' | 'funded';
  // Connection
  connectionType?: 'manual' | 'mt5' | 'mt5_investor' | 'mt5_ea' | 'api';
  connectionConfig?: string; // JSON
  isConnected: boolean;
  lastSyncAt?: string;
  // MT5 Connection (for auto-sync)
  mt5Server?: string;
  mt5Login?: string;
  mt5Password?: string; // Should be encrypted!
  syncKey?: string; // For secure syncing
  // Stats
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
  profitFactor: number;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// JOURNAL ENTRIES (Extended Trade Data)
// ============================================================================

export const JournalEntryCreateSchema = z.object({
  accountId: z.string(),
  // Trade basics
  symbol: z.string().min(1).max(20),
  direction: z.enum(['LONG', 'SHORT']),
  entryPrice: z.number().positive(),
  exitPrice: z.number().positive().optional(),
  quantity: z.number().positive(),
  // Risk management
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  riskAmount: z.number().optional(),
  rMultiple: z.number().optional(),
  // Categorization
  setup: z.string().optional(), // e.g., "Breakout", "Reversal", "Trend Following"
  strategy: z.string().optional(),
  timeframe: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Psychology
  emotion: z.enum(['confident', 'fearful', 'greedy', 'neutral', 'fomo', 'revenge']).optional(),
  emotionNotes: z.string().optional(),
  // Analysis
  entryReason: z.string().optional(),
  exitReason: z.string().optional(),
  lessonLearned: z.string().optional(),
  mistake: z.string().optional(),
  // Attachments
  screenshotEntry: z.string().optional(), // URL or base64
  screenshotExit: z.string().optional(),
  // Execution
  entryTime: z.string(),
  exitTime: z.string().optional(),
  // Meta
  notes: z.string().optional(),
  rating: z.number().min(1).max(5).optional(), // Self-rating 1-5
});

export interface JournalEntry {
  id: string;
  accountId: string;
  userId: string;
  externalId?: string; // MT5 ticket/order number
  // Trade basics
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  fees?: number;
  commission?: number;
  swap?: number;
  // MT5 specific
  magic?: number;
  comment?: string;
  source?: 'manual' | 'mt5' | 'api';
  // Calculated
  pnl?: number;
  pnlPercent?: number;
  isWin?: boolean;
  // Risk management
  stopLoss?: number;
  takeProfit?: number;
  riskAmount?: number;
  rMultiple?: number;
  mfe?: number; // Maximum Favorable Excursion
  mae?: number; // Maximum Adverse Excursion
  // Categorization
  setup?: string;
  strategy?: string;
  timeframe?: string;
  tags?: string; // JSON array
  // Psychology
  emotion?: 'confident' | 'fearful' | 'greedy' | 'neutral' | 'fomo' | 'revenge';
  emotionNotes?: string;
  // Analysis
  entryReason?: string;
  exitReason?: string;
  lessonLearned?: string;
  mistake?: string;
  // Attachments
  screenshotEntry?: string;
  screenshotExit?: string;
  // Execution
  entryTime: string;
  exitTime?: string;
  duration?: number; // in minutes
  // Meta
  notes?: string;
  rating?: number;
  status: 'open' | 'closed' | 'cancelled';
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// TRADING RULES
// ============================================================================

export const TradingRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.enum(['entry', 'exit', 'risk', 'psychology', 'other']),
  isActive: z.boolean().default(true),
});

export interface TradingRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: 'entry' | 'exit' | 'risk' | 'psychology' | 'other';
  isActive: boolean;
  followedCount: number;
  brokenCount: number;
  createdAt: string;
}

// ============================================================================
// DAILY NOTES / CALENDAR
// ============================================================================

export interface DailyNote {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  preMarketPlan: string;
  postMarketReview: string;
  mood: 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
  marketCondition: 'trending' | 'ranging' | 'volatile' | 'quiet';
  importantEvents: string;
  lessonsLearned: string;
  goalsForTomorrow: string;
  // Calculated from trades
  tradesCount: number;
  pnl: number;
  winRate: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// ANALYTICS / METRICS
// ============================================================================

export interface PerformanceMetrics {
  // Basic
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number;
  // P&L
  totalPnL: number;
  grossProfit: number;
  grossLoss: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  // Risk
  expectancy: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageRMultiple: number;
  // Time
  averageHoldTime: number; // minutes
  longestWinStreak: number;
  longestLoseStreak: number;
  currentStreak: number;
  currentStreakType: 'win' | 'lose' | 'none';
  // By category
  bySymbol: Record<string, { trades: number; pnl: number; winRate: number }>;
  bySetup: Record<string, { trades: number; pnl: number; winRate: number }>;
  byDayOfWeek: Record<string, { trades: number; pnl: number; winRate: number }>;
  byHourOfDay: Record<string, { trades: number; pnl: number; winRate: number }>;
  byEmotion: Record<string, { trades: number; pnl: number; winRate: number }>;
}

export interface EquityPoint {
  date: string;
  balance: number;
  pnl: number;
  drawdown: number;
  tradesCount: number;
}

export interface CalendarDay {
  date: string;
  pnl: number;
  tradesCount: number;
  winRate: number;
  color: 'green' | 'red' | 'gray'; // for heatmap
  intensity: number; // 0-1 for color intensity
}

// ============================================================================
// IMPORT SCHEMAS
// ============================================================================

export const MT5ImportSchema = z.object({
  accountId: z.string(),
  data: z.string(), // CSV or HTML content
  format: z.enum(['csv', 'html']),
});

export const CSVImportSchema = z.object({
  accountId: z.string(),
  data: z.string(),
  mapping: z.object({
    symbol: z.string(),
    direction: z.string(),
    entryPrice: z.string(),
    exitPrice: z.string(),
    quantity: z.string(),
    entryTime: z.string(),
    exitTime: z.string(),
    pnl: z.string().optional(),
  }),
});

// ============================================================================
// AI INSIGHTS
// ============================================================================

export interface AIInsight {
  id: string;
  userId: string;
  type: 'performance' | 'pattern' | 'risk' | 'suggestion';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  action?: string;
  data?: string; // JSON with supporting data
  createdAt: string;
  readAt?: string;
}

// ============================================================================
// DATABASE SCHEMA EXTENSION
// ============================================================================

export interface JournalDbSchema {
  tradingAccounts: TradingAccount[];
  journalEntries: JournalEntry[];
  tradingRules: TradingRule[];
  dailyNotes: DailyNote[];
  aiInsights: AIInsight[];
}
