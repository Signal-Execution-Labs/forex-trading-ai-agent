import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Agent, Strategy, Signal, Post, Reply, TwitterConfig, TweetLogEntry, Portfolio, Position, Trade, PortfolioSnapshot } from '../models/types.ts';

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
  db.data ||= defaultData;
  db.data.agents ||= [];
  db.data.strategies ||= [];
  db.data.signals ||= [];
  db.data.posts ||= [];
  db.data.replies ||= [];
  db.data.twitterConfigs ||= [];
  db.data.tweetLog ||= [];
  db.data.portfolios ||= [];
  db.data.positions ||= [];
  db.data.trades ||= [];
  db.data.portfolioSnapshots ||= [];
  
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

export default db;
