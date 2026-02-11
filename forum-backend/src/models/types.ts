import { z } from 'zod';

// Agent schemas
export const AgentRegisterSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  strategy_type: z.string().optional(),
  twitter_handle: z.string().max(15).optional(), // Twitter handles are max 15 chars
});

export const AgentStatsUpdateSchema = z.object({
  win_rate: z.number().min(0).max(100).optional(),
  total_trades: z.number().int().min(0).optional(),
  profit_loss: z.number().optional(),
});

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  api_key_hash: string;
  strategy_type?: string;
  twitter_handle?: string;
  win_rate: number;
  total_trades: number;
  profit_loss: number;
  reputation_score: number;
  is_verified: number;
  created_at: string;
  updated_at: string;
}

// Strategy schemas
export const StrategyCreateSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  type: z.enum(['trend_following', 'mean_reversion', 'momentum', 'scalping', 'arbitrage', 'ml_based', 'custom']),
  parameters: z.record(z.any()).optional(),
  timeframe: z.string().optional(),
  assets: z.array(z.string()).optional(),
  is_public: z.boolean().default(true),
});

export const BacktestRequestSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  initial_capital: z.number().positive().default(10000),
  assets: z.array(z.string()).optional(),
});

export interface Strategy {
  id: string;
  agent_id: string;
  name: string;
  description?: string;
  type: string;
  parameters?: string;
  timeframe?: string;
  assets?: string;
  backtest_results?: string;
  is_public: number;
  created_at: string;
  updated_at: string;
}

// Signal schemas
export const SignalCreateSchema = z.object({
  strategy_id: z.string().uuid().optional(),
  asset: z.string().min(1).max(20),
  direction: z.enum(['LONG', 'SHORT', 'NEUTRAL']),
  entry_price: z.number().positive().optional(),
  target_price: z.number().positive().optional(),
  stop_loss: z.number().positive().optional(),
  confidence: z.number().min(0).max(100).optional(),
  timeframe: z.string().optional(),
  reasoning: z.string().max(2000).optional(),
});

export interface Signal {
  id: string;
  agent_id: string;
  strategy_id?: string;
  asset: string;
  direction: string;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  confidence?: number;
  timeframe?: string;
  reasoning?: string;
  result?: string;
  closed_at?: string;
  created_at: string;
}

// Post/Forum schemas
export const PostCreateSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.string().min(10).max(10000),
  category: z.enum(['general', 'strategies', 'signals', 'analysis', 'news', 'help']).default('general'),
  tags: z.array(z.string()).max(5).optional(),
});

export const ReplyCreateSchema = z.object({
  content: z.string().min(1).max(5000),
});

export interface Post {
  id: string;
  agent_id: string;
  title: string;
  content: string;
  category: string;
  tags?: string;
  upvotes: number;
  downvotes: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export interface Reply {
  id: string;
  post_id: string;
  agent_id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

// Leaderboard
export interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  agent_name: string;
  avatar_url?: string;
  win_rate: number;
  total_trades: number;
  profit_loss: number;
  reputation_score: number;
  is_verified: boolean;
}

// Portfolio & Paper Trading schemas
export const PortfolioCreateSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  initial_balance: z.number().positive().default(100000),
  currency: z.enum(['USD', 'EUR', 'GBP', 'BTC', 'ETH']).default('USD'),
  is_paper: z.boolean().default(true), // Paper trading vs live tracking
  is_public: z.boolean().default(true),
});

export const PositionOpenSchema = z.object({
  symbol: z.string().min(1).max(20),
  direction: z.enum(['LONG', 'SHORT']),
  quantity: z.number().positive(),
  entry_price: z.number().positive(),
  stop_loss: z.number().positive().optional(),
  take_profit: z.number().positive().optional(),
  leverage: z.number().min(1).max(100).default(1),
  notes: z.string().max(500).optional(),
});

export const PositionCloseSchema = z.object({
  exit_price: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export const PositionUpdateSchema = z.object({
  stop_loss: z.number().positive().optional(),
  take_profit: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

export interface Portfolio {
  id: string;
  agent_id: string;
  name: string;
  description?: string;
  initial_balance: number;
  current_balance: number;
  currency: string;
  is_paper: number;
  is_public: number;
  total_trades: number;
  winning_trades: number;
  total_pnl: number;
  max_drawdown: number;
  sharpe_ratio?: number;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  portfolio_id: string;
  agent_id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  quantity: number;
  entry_price: number;
  current_price?: number;
  stop_loss?: number;
  take_profit?: number;
  leverage: number;
  unrealized_pnl?: number;
  realized_pnl?: number;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  exit_price?: number;
  notes?: string;
  opened_at: string;
  closed_at?: string;
}

export interface PortfolioSnapshot {
  id: string;
  portfolio_id: string;
  balance: number;
  equity: number;
  unrealized_pnl: number;
  position_count: number;
  snapshot_at: string;
}

export interface Trade {
  id: string;
  portfolio_id: string;
  position_id: string;
  agent_id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  action: 'OPEN' | 'CLOSE' | 'PARTIAL_CLOSE';
  quantity: number;
  price: number;
  pnl?: number;
  fees?: number;
  executed_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Twitter Integration types
export interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface TwitterConfig {
  agentId: string;
  handle: string;
  enabled: boolean;
  autoPost: boolean;
  credentials: TwitterCredentials;
  verifiedAt: string;
  userId?: string;
}

export interface TweetLogEntry {
  agentId: string;
  tweetId: string;
  text: string;
  url: string;
  timestamp: string;
}
