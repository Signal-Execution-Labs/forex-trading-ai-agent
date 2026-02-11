import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Agent, Strategy, Signal, Post, Reply, TwitterConfig, TweetLogEntry, Portfolio, Position, Trade, PortfolioSnapshot } from '../models/types.ts';

// Extended types for all services
export interface Alert {
  id: string;
  agent_id: string;
  name: string;
  symbol: string;
  condition_type: string;
  threshold: number;
  secondary_threshold?: number;
  timeframe?: string;
  message?: string;
  webhook_url?: string;
  notification_types: string[];
  auto_create_signal?: boolean;
  signal_direction?: string;
  frequency: string;
  expiry_time?: string;
  cooldown_minutes?: number;
  status: string;
  last_triggered?: string;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface AlertLog {
  id: string;
  alert_id: string;
  agent_id: string;
  triggered_at: string;
  trigger_price: number;
  trigger_value?: number;
  signal_created?: string;
  webhook_response?: string;
  notification_sent: boolean;
}

export interface Notification {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  message: string;
  icon?: string;
  link_type?: string;
  link_id?: string;
  from_agent_id?: string;
  from_agent_name?: string;
  read: boolean;
  archived: boolean;
  created_at: string;
  read_at?: string;
}

export interface NotificationPreferences {
  agent_id: string;
  signal_new: boolean;
  signal_outcome: boolean;
  strategy_star: boolean;
  strategy_fork: boolean;
  follower_new: boolean;
  mention: boolean;
  reply: boolean;
  alert_triggered: boolean;
  backtest_complete: boolean;
  leaderboard: boolean;
  system: boolean;
  webhook_url?: string;
  batch_interval_minutes?: number;
}

export interface Watchlist {
  id: string;
  agent_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_public: boolean;
  symbol_count: number;
  followers: number;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  symbol: string;
  exchange?: string;
  asset_type?: string;
  notes?: string;
  target_price?: number;
  stop_loss?: number;
  alert_id?: string;
  color?: string;
  sort_order: number;
  added_at: string;
  updated_at: string;
}

export interface WatchlistFollow {
  agent_id: string;
  watchlist_id: string;
  created_at: string;
}

export interface Idea {
  id: string;
  agent_id: string;
  agent_name?: string;
  title: string;
  symbol: string;
  timeframe?: string;
  description: string;
  tldr?: string;
  direction: string;
  entry_price?: number;
  target_price?: number;
  target_price_2?: number;
  target_price_3?: number;
  stop_loss?: number;
  risk_reward?: number;
  confidence: number;
  category: string;
  tags: string[];
  chart_image_url?: string;
  indicators?: string[];
  views: number;
  likes: number;
  comments_count: number;
  bookmarks: number;
  status: string;
  outcome?: string;
  actual_return?: number;
  closed_at?: string;
  close_notes?: string;
  is_featured: boolean;
  featured_at?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface IdeaComment {
  id: string;
  idea_id: string;
  agent_id: string;
  agent_name?: string;
  parent_id?: string;
  content: string;
  likes: number;
  created_at: string;
  updated_at?: string;
}

export interface IdeaLike {
  agent_id: string;
  idea_id: string;
  created_at: string;
}

export interface IdeaBookmark {
  agent_id: string;
  idea_id: string;
  created_at: string;
  notes?: string;
}

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
  status: string;
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

export interface Competition {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  entryFee: number;
  prizePool: number;
  prizes: any[];
  rules: any;
  assets: string[];
  maxParticipants: number;
  participants: any[];
  leaderboard: any[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionTrade {
  id: string;
  competitionId: string;
  agentId: string;
  asset: string;
  direction: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  status: string;
  pnl?: number;
  openedAt: string;
  closedAt?: string;
}

export interface AgentFollow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

// Database schema
export interface DbSchema {
  agents: Agent[];
  strategies: Strategy[];
  signals: Signal[];
  posts: Post[];
  replies: Reply[];
  twitterConfigs: TwitterConfig[];
  tweetLog: TweetLogEntry[];
  portfolios: Portfolio[];
  positions: Position[];
  trades: Trade[];
  portfolioSnapshots: PortfolioSnapshot[];
  // New collections
  alerts: Alert[];
  alert_logs: AlertLog[];
  notifications: Notification[];
  notification_preferences: NotificationPreferences[];
  watchlists: Watchlist[];
  watchlist_items: WatchlistItem[];
  watchlist_follows: WatchlistFollow[];
  ideas: Idea[];
  idea_comments: IdeaComment[];
  idea_likes: IdeaLike[];
  idea_bookmarks: IdeaBookmark[];
  backtests: Backtest[];
  competitions: Competition[];
  competition_trades: CompetitionTrade[];
  agent_follows: AgentFollow[];
}

// Default data
const defaultData: DbSchema = {
  agents: [],
  strategies: [],
  signals: [],
  posts: [],
  replies: [],
  twitterConfigs: [],
  tweetLog: [],
  portfolios: [],
  positions: [],
  trades: [],
  portfolioSnapshots: [],
  alerts: [],
  alert_logs: [],
  notifications: [],
  notification_preferences: [],
  watchlists: [],
  watchlist_items: [],
  watchlist_follows: [],
  ideas: [],
  idea_comments: [],
  idea_likes: [],
  idea_bookmarks: [],
  backtests: [],
  competitions: [],
  competition_trades: [],
  agent_follows: [],
};

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Initialize lowdb
const dbPath = join(dataDir, 'kitbot.json');
const adapter = new JSONFile<DbSchema>(dbPath);
export const db = new Low<DbSchema>(adapter, defaultData);

// Initialize database
export async function initializeDatabase() {
  await db.read();
  
  // Ensure all collections exist
  db.data ||= { ...defaultData };
  for (const key of Object.keys(defaultData) as (keyof DbSchema)[]) {
    if (!db.data[key]) {
      (db.data as any)[key] = [];
    }
  }
  
  await db.write();
  console.log('✅ Database initialized');
}

// Helper functions for CRUD operations
export const dbHelpers = {
  // Agents
  findAgent: (id: string) => db.data!.agents.find(a => a.id === id),
  findAgentByName: (name: string) => db.data!.agents.find(a => a.name === name),
  
  // Strategies
  findStrategy: (id: string) => db.data!.strategies.find(s => s.id === id),
  
  // Signals
  findSignal: (id: string) => db.data!.signals.find(s => s.id === id),
  
  // Posts
  findPost: (id: string) => db.data!.posts.find(p => p.id === id),
  
  // Replies
  findReply: (id: string) => db.data!.replies.find(r => r.id === id),
  findRepliesByPost: (postId: string) => db.data!.replies.filter(r => r.post_id === postId),
  
  // Twitter
  getTwitterConfig: (agentId: string) => db.data!.twitterConfigs?.find(c => c.agentId === agentId),
};

/**
 * Wrapper for services that expect getDatabase() with .get()/.set() interface
 */
export function getDatabase() {
  return {
    get<K extends keyof DbSchema>(key: K): DbSchema[K] {
      return db.data![key] || ([] as any);
    },
    set<K extends keyof DbSchema>(key: K, value: DbSchema[K]): void {
      db.data![key] = value;
    },
    write(): void {
      db.write(); // Note: This is async but many services call it sync
    },
    async writeAsync(): Promise<void> {
      await db.write();
    }
  };
}

export default db;
