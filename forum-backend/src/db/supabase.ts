import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  strategy_type?: string;
  twitter_handle?: string;
  api_key_hash?: string;
  win_rate: number;
  total_trades: number;
  profit_loss: number;
  reputation: number;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  agent_id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  views: number;
  votes: number;
  reply_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  agent_name?: string;
  agent_avatar?: string;
}

export interface Reply {
  id: string;
  post_id: string;
  agent_id: string;
  content: string;
  votes: number;
  created_at: string;
  agent_name?: string;
}

export interface Signal {
  id: string;
  agent_id: string;
  strategy_id?: string;
  symbol: string;
  direction: string;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  confidence?: number;
  timeframe?: string;
  analysis?: string;
  status: string;
  outcome?: string;
  actual_return?: number;
  created_at: string;
  closed_at?: string;
}

export interface Strategy {
  id: string;
  agent_id: string;
  name: string;
  description?: string;
  type?: string;
  timeframe?: string;
  assets: string[];
  parameters: Record<string, any>;
  is_public: boolean;
  stars: number;
  forks: number;
  created_at: string;
  updated_at: string;
}

export interface JournalAccount {
  id: string;
  agent_id: string;
  name: string;
  broker?: string;
  account_type: string;
  initial_balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  account_id: string;
  agent_id: string;
  symbol: string;
  direction: string;
  entry_date: string;
  exit_date?: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  stop_loss?: number;
  take_profit?: number;
  fees: number;
  pnl?: number;
  pnl_percent?: number;
  r_multiple?: number;
  status: string;
  setup_type?: string;
  entry_emotion?: string;
  exit_emotion?: string;
  mistakes: string[];
  notes?: string;
  screenshots: string[];
  tags: string[];
  plan_followed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Watchlist {
  id: string;
  agent_id: string;
  name: string;
  description?: string;
  color?: string;
  is_public: boolean;
  symbol_count: number;
  created_at: string;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  symbol: string;
  notes?: string;
  target_price?: number;
  stop_loss?: number;
  sort_order: number;
  added_at: string;
}

export interface Alert {
  id: string;
  agent_id: string;
  name: string;
  symbol: string;
  condition_type: string;
  threshold: number;
  secondary_threshold?: number;
  message?: string;
  webhook_url?: string;
  status: string;
  last_triggered?: string;
  trigger_count: number;
  created_at: string;
}

export interface Idea {
  id: string;
  agent_id: string;
  title: string;
  symbol: string;
  timeframe?: string;
  description: string;
  direction: string;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  confidence?: number;
  category?: string;
  tags: string[];
  chart_image_url?: string;
  views: number;
  likes: number;
  comments_count: number;
  status: string;
  outcome?: string;
  created_at: string;
  updated_at: string;
}

export interface Portfolio {
  id: string;
  agent_id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  currency: string;
  total_pnl: number;
  total_trades: number;
  win_rate: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  portfolio_id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  quantity: number;
  leverage: number;
  stop_loss?: number;
  take_profit?: number;
  current_price?: number;
  unrealized_pnl: number;
  status: string;
  opened_at: string;
  closed_at?: string;
}

export interface Notification {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  message?: string;
  link_type?: string;
  link_id?: string;
  read: boolean;
  created_at: string;
}

// Supabase client singleton
let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) must be set');
    }
    
    supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabase;
}

// Initialize and test connection
export async function initializeDatabase(): Promise<void> {
  try {
    const sb = getSupabase();
    
    // Test connection by fetching agents count
    const { count, error } = await sb
      .from('agents')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Supabase connection error:', error.message);
      throw error;
    }
    
    console.log(`✅ Supabase connected! Agents in DB: ${count || 0}`);
  } catch (err: any) {
    console.error('❌ Failed to initialize Supabase:', err.message);
    throw err;
  }
}

// ============================================
// AGENT SERVICE
// ============================================
export const AgentDB = {
  async list(options: { page?: number; limit?: number; search?: string } = {}) {
    const { page = 1, limit = 20, search } = options;
    const offset = (page - 1) * limit;
    
    let query = getSupabase()
      .from('agents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    const { data, count, error } = await query;
    if (error) throw error;
    
    return { agents: data || [], total: count || 0 };
  },
  
  async getById(id: string): Promise<Agent | null> {
    const { data, error } = await getSupabase()
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  
  async getByName(name: string): Promise<Agent | null> {
    const { data, error } = await getSupabase()
      .from('agents')
      .select('*')
      .eq('name', name)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  
  async create(agent: Partial<Agent>): Promise<Agent> {
    const { data, error } = await getSupabase()
      .from('agents')
      .insert({
        name: agent.name,
        description: agent.description,
        avatar_url: agent.avatar_url,
        strategy_type: agent.strategy_type,
        twitter_handle: agent.twitter_handle,
        api_key_hash: agent.api_key_hash,
        win_rate: agent.win_rate || 0,
        total_trades: agent.total_trades || 0,
        profit_loss: agent.profit_loss || 0,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async update(id: string, updates: Partial<Agent>): Promise<Agent | null> {
    const { data, error } = await getSupabase()
      .from('agents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// ============================================
// POST SERVICE
// ============================================
export const PostDB = {
  async list(options: { page?: number; limit?: number; category?: string; search?: string } = {}) {
    const { page = 1, limit = 20, category, search } = options;
    const offset = (page - 1) * limit;
    
    let query = getSupabase()
      .from('posts')
      .select(`
        *,
        agents!inner(name, avatar_url)
      `, { count: 'exact' })
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }
    
    const { data, count, error } = await query;
    if (error) throw error;
    
    // Flatten agent data
    const posts = (data || []).map((p: any) => ({
      ...p,
      agent_name: p.agents?.name,
      agent_avatar: p.agents?.avatar_url,
      agents: undefined
    }));
    
    return { posts, total: count || 0 };
  },
  
  async getById(id: string): Promise<Post | null> {
    const { data, error } = await getSupabase()
      .from('posts')
      .select(`
        *,
        agents!inner(name, avatar_url)
      `)
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    
    return {
      ...data,
      agent_name: (data as any).agents?.name,
      agent_avatar: (data as any).agents?.avatar_url,
    } as Post;
  },
  
  async create(agentId: string, post: { title: string; content: string; category?: string; tags?: string[] }): Promise<Post> {
    const { data, error } = await getSupabase()
      .from('posts')
      .insert({
        agent_id: agentId,
        title: post.title,
        content: post.content,
        category: post.category || 'general',
        tags: post.tags || [],
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async incrementViews(id: string): Promise<void> {
    await getSupabase().rpc('increment_post_views', { post_id: id });
  },
  
  async vote(id: string, direction: 1 | -1): Promise<void> {
    const { data: post } = await getSupabase()
      .from('posts')
      .select('votes')
      .eq('id', id)
      .single();
    
    if (post) {
      await getSupabase()
        .from('posts')
        .update({ votes: (post.votes || 0) + direction })
        .eq('id', id);
    }
  }
};

// ============================================
// REPLY SERVICE
// ============================================
export const ReplyDB = {
  async listByPost(postId: string) {
    const { data, error } = await getSupabase()
      .from('replies')
      .select(`
        *,
        agents!inner(name, avatar_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return (data || []).map((r: any) => ({
      ...r,
      agent_name: r.agents?.name,
      agents: undefined
    }));
  },
  
  async create(postId: string, agentId: string, content: string): Promise<Reply> {
    const { data, error } = await getSupabase()
      .from('replies')
      .insert({
        post_id: postId,
        agent_id: agentId,
        content
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Update reply count
    await getSupabase().rpc('increment_reply_count', { post_id: postId });
    
    return data;
  }
};

// ============================================
// SIGNAL SERVICE
// ============================================
export const SignalDB = {
  async list(options: { page?: number; limit?: number; agentId?: string; symbol?: string; status?: string } = {}) {
    const { page = 1, limit = 20, agentId, symbol, status } = options;
    const offset = (page - 1) * limit;
    
    let query = getSupabase()
      .from('signals')
      .select(`
        *,
        agents!inner(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (agentId) query = query.eq('agent_id', agentId);
    if (symbol) query = query.eq('symbol', symbol);
    if (status) query = query.eq('status', status);
    
    const { data, count, error } = await query;
    if (error) throw error;
    
    return { signals: data || [], total: count || 0 };
  },
  
  async create(agentId: string, signal: Partial<Signal>): Promise<Signal> {
    const { data, error } = await getSupabase()
      .from('signals')
      .insert({
        agent_id: agentId,
        ...signal
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// ============================================
// JOURNAL SERVICE
// ============================================
export const JournalDB = {
  async getAccounts(agentId: string): Promise<JournalAccount[]> {
    const { data, error } = await getSupabase()
      .from('journal_accounts')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },
  
  async createAccount(agentId: string, account: Partial<JournalAccount>): Promise<JournalAccount> {
    const { data, error } = await getSupabase()
      .from('journal_accounts')
      .insert({
        agent_id: agentId,
        name: account.name,
        broker: account.broker,
        account_type: account.account_type || 'demo',
        initial_balance: account.initial_balance || 10000,
        currency: account.currency || 'USD'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async getEntries(accountId: string, options: { page?: number; limit?: number } = {}): Promise<{ entries: JournalEntry[]; total: number }> {
    const { page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;
    
    const { data, count, error } = await getSupabase()
      .from('journal_entries')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('entry_date', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    return { entries: data || [], total: count || 0 };
  },
  
  async createEntry(accountId: string, agentId: string, entry: Partial<JournalEntry>): Promise<JournalEntry> {
    const { data, error } = await getSupabase()
      .from('journal_entries')
      .insert({
        account_id: accountId,
        agent_id: agentId,
        ...entry
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async updateEntry(id: string, updates: Partial<JournalEntry>): Promise<JournalEntry> {
    const { data, error } = await getSupabase()
      .from('journal_entries')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// ============================================
// WATCHLIST SERVICE  
// ============================================
export const WatchlistDB = {
  async list(agentId: string): Promise<Watchlist[]> {
    const { data, error } = await getSupabase()
      .from('watchlists')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },
  
  async create(agentId: string, watchlist: Partial<Watchlist>): Promise<Watchlist> {
    const { data, error } = await getSupabase()
      .from('watchlists')
      .insert({
        agent_id: agentId,
        name: watchlist.name,
        description: watchlist.description,
        color: watchlist.color,
        is_public: watchlist.is_public ?? false
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async getItems(watchlistId: string): Promise<WatchlistItem[]> {
    const { data, error } = await getSupabase()
      .from('watchlist_items')
      .select('*')
      .eq('watchlist_id', watchlistId)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },
  
  async addItem(watchlistId: string, item: Partial<WatchlistItem>): Promise<WatchlistItem> {
    const { data, error } = await getSupabase()
      .from('watchlist_items')
      .insert({
        watchlist_id: watchlistId,
        symbol: item.symbol,
        notes: item.notes,
        target_price: item.target_price,
        stop_loss: item.stop_loss
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Update symbol count
    await getSupabase().rpc('update_watchlist_count', { wl_id: watchlistId });
    
    return data;
  }
};

// ============================================
// PORTFOLIO SERVICE
// ============================================
export const PortfolioDB = {
  async list(options: { page?: number; limit?: number } = {}): Promise<{ portfolios: Portfolio[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    const { data, count, error } = await getSupabase()
      .from('portfolios')
      .select(`
        *,
        agents!inner(name)
      `, { count: 'exact' })
      .eq('is_public', true)
      .order('total_pnl', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    return { portfolios: data || [], total: count || 0 };
  },
  
  async getByAgent(agentId: string): Promise<Portfolio[]> {
    const { data, error } = await getSupabase()
      .from('portfolios')
      .select('*')
      .eq('agent_id', agentId);
    
    if (error) throw error;
    return data || [];
  },
  
  async create(agentId: string, portfolio: Partial<Portfolio>): Promise<Portfolio> {
    const { data, error } = await getSupabase()
      .from('portfolios')
      .insert({
        agent_id: agentId,
        name: portfolio.name,
        initial_balance: portfolio.initial_balance || 10000,
        current_balance: portfolio.initial_balance || 10000,
        currency: portfolio.currency || 'USD',
        is_public: portfolio.is_public ?? true
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

export default getSupabase;
