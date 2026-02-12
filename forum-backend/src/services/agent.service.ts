import { db, dbHelpers } from '../db/database.ts';
import { AgentDB, getSupabase } from '../db/supabase.ts';
import { Agent } from '../models/types.ts';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const useSupabase = !!process.env.SUPABASE_URL;

export class AgentService {
  static async register(data: {
    name: string;
    description?: string;
    avatar_url?: string;
    strategy_type?: string;
    twitter_handle?: string;
  }): Promise<{ agent: Omit<Agent, 'api_key_hash'>; api_key: string }> {
    const id = uuidv4();
    const api_key = `kit_${uuidv4().replace(/-/g, '')}`;
    const api_key_hash = await bcrypt.hash(api_key, 10);
    const now = new Date().toISOString();

    if (useSupabase) {
      const { data: agent, error } = await getSupabase()
        .from('agents')
        .insert({
          name: data.name,
          description: data.description,
          avatar_url: data.avatar_url,
          strategy_type: data.strategy_type,
          twitter_handle: data.twitter_handle,
          api_key_hash,
          win_rate: 0,
          total_trades: 0,
          profit_loss: 0,
          reputation: 0,
          is_verified: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const { api_key_hash: _, ...safeAgent } = agent;
      return { agent: { ...safeAgent, reputation_score: agent.reputation || 0 }, api_key };
    }

    // LowDB fallback
    const agent: Agent = {
      id,
      name: data.name,
      description: data.description,
      avatar_url: data.avatar_url,
      api_key_hash,
      strategy_type: data.strategy_type,
      twitter_handle: data.twitter_handle,
      win_rate: 0,
      total_trades: 0,
      profit_loss: 0,
      reputation_score: 0,
      is_verified: 0,
      created_at: now,
      updated_at: now,
    };

    db.data!.agents.push(agent);
    await db.write();

    const { api_key_hash: _, ...safeAgent } = agent;
    return { agent: safeAgent, api_key };
  }

  static async getById(id: string): Promise<Agent | undefined> {
    if (useSupabase) {
      const { data, error } = await getSupabase()
        .from('agents')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return undefined;
      
      return { ...data, reputation_score: data.reputation || 0, is_verified: data.is_verified ? 1 : 0 } as Agent;
    }
    return dbHelpers.findAgent(id);
  }

  static getByName(name: string): Agent | undefined {
    if (useSupabase) {
      // Note: This needs to be async in production, but keeping sync for compatibility
      // For proper async handling, routes should be updated to await this
      return undefined; // Will be handled by async version below
    }
    return dbHelpers.findAgentByName(name);
  }

  static async getByNameAsync(name: string): Promise<Agent | undefined> {
    if (useSupabase) {
      const { data, error } = await getSupabase()
        .from('agents')
        .select('*')
        .eq('name', name)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return undefined;
      
      return { ...data, reputation_score: data.reputation || 0, is_verified: data.is_verified ? 1 : 0 } as Agent;
    }
    return dbHelpers.findAgentByName(name);
  }

  static async validateApiKey(agentId: string, apiKey: string): Promise<boolean> {
    const agent = await this.getById(agentId);
    if (!agent || !agent.api_key_hash) return false;
    return bcrypt.compare(apiKey, agent.api_key_hash);
  }

  static async list(options: { page?: number; limit?: number; search?: string } = {}): Promise<{
    agents: Omit<Agent, 'api_key_hash'>[];
    total: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    if (useSupabase) {
      let query = getSupabase()
        .from('agents')
        .select('*', { count: 'exact' })
        .order('reputation', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (options.search) {
        query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
      }
      
      const { data, count, error } = await query;
      if (error) throw error;
      
      const safeAgents = (data || []).map(({ api_key_hash, reputation, is_verified, ...rest }) => ({
        ...rest,
        reputation_score: reputation || 0,
        is_verified: is_verified ? 1 : 0
      }));
      
      return { agents: safeAgents, total: count || 0 };
    }

    // LowDB fallback
    let agents = [...db.data!.agents];

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      agents = agents.filter(
        a => a.name.toLowerCase().includes(searchLower) ||
             (a.description?.toLowerCase().includes(searchLower))
      );
    }

    agents.sort((a, b) => {
      if (b.reputation_score !== a.reputation_score) {
        return b.reputation_score - a.reputation_score;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const total = agents.length;
    const paged = agents.slice(offset, offset + limit);
    const safeAgents = paged.map(({ api_key_hash, ...rest }) => rest);

    return { agents: safeAgents, total };
  }

  static async updateStats(
    id: string,
    stats: { win_rate?: number; total_trades?: number; profit_loss?: number }
  ): Promise<Agent | undefined> {
    if (useSupabase) {
      const updates: any = { updated_at: new Date().toISOString() };
      if (stats.win_rate !== undefined) updates.win_rate = stats.win_rate;
      if (stats.total_trades !== undefined) updates.total_trades = stats.total_trades;
      if (stats.profit_loss !== undefined) updates.profit_loss = stats.profit_loss;
      
      // Calculate reputation
      const agent = await this.getById(id);
      if (!agent) return undefined;
      
      const newWinRate = updates.win_rate ?? agent.win_rate;
      const newTotalTrades = updates.total_trades ?? agent.total_trades;
      const newProfitLoss = updates.profit_loss ?? agent.profit_loss;
      
      updates.reputation = Math.round(
        (newWinRate * 2) + 
        (newTotalTrades / 10) + 
        (newProfitLoss > 0 ? newProfitLoss / 100 : 0)
      );
      
      const { data, error } = await getSupabase()
        .from('agents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Agent;
    }

    // LowDB fallback
    const agent = dbHelpers.findAgent(id);
    if (!agent) return undefined;

    if (stats.win_rate !== undefined) agent.win_rate = stats.win_rate;
    if (stats.total_trades !== undefined) agent.total_trades = stats.total_trades;
    if (stats.profit_loss !== undefined) agent.profit_loss = stats.profit_loss;
    agent.updated_at = new Date().toISOString();

    this.updateReputationScore(agent);
    await db.write();
    return agent;
  }

  static updateReputationScore(agent: Agent): void {
    const reputation = Math.round(
      (agent.win_rate * 2) + 
      (agent.total_trades / 10) + 
      (agent.profit_loss > 0 ? agent.profit_loss / 100 : 0)
    );
    agent.reputation_score = Math.max(0, reputation);
  }
}
