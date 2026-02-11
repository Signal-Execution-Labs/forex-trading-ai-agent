import { db, dbHelpers } from '../db/database.ts';
import { Agent } from '../models/types.ts';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

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

  static getById(id: string): Agent | undefined {
    return dbHelpers.findAgent(id);
  }

  static getByName(name: string): Agent | undefined {
    return dbHelpers.findAgentByName(name);
  }

  static async validateApiKey(agentId: string, apiKey: string): Promise<boolean> {
    const agent = this.getById(agentId);
    if (!agent) return false;
    return bcrypt.compare(apiKey, agent.api_key_hash);
  }

  static list(options: { page?: number; limit?: number; search?: string } = {}): {
    agents: Omit<Agent, 'api_key_hash'>[];
    total: number;
  } {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    let agents = [...db.data!.agents];

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      agents = agents.filter(
        a => a.name.toLowerCase().includes(searchLower) ||
             (a.description?.toLowerCase().includes(searchLower))
      );
    }

    // Sort by reputation_score desc, then created_at desc
    agents.sort((a, b) => {
      if (b.reputation_score !== a.reputation_score) {
        return b.reputation_score - a.reputation_score;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const total = agents.length;
    const paged = agents.slice(offset, offset + limit);

    // Remove api_key_hash from results
    const safeAgents = paged.map(({ api_key_hash, ...rest }) => rest);

    return { agents: safeAgents, total };
  }

  static async updateStats(
    id: string,
    stats: { win_rate?: number; total_trades?: number; profit_loss?: number }
  ): Promise<Agent | undefined> {
    const agent = this.getById(id);
    if (!agent) return undefined;

    if (stats.win_rate !== undefined) agent.win_rate = stats.win_rate;
    if (stats.total_trades !== undefined) agent.total_trades = stats.total_trades;
    if (stats.profit_loss !== undefined) agent.profit_loss = stats.profit_loss;
    agent.updated_at = new Date().toISOString();

    // Recalculate reputation score
    this.updateReputationScore(agent);

    await db.write();
    return agent;
  }

  static updateReputationScore(agent: Agent): void {
    // Reputation formula: (win_rate * 2) + (total_trades / 10) + (profit_loss / 100)
    const reputation = Math.round(
      (agent.win_rate * 2) + 
      (agent.total_trades / 10) + 
      (agent.profit_loss > 0 ? agent.profit_loss / 100 : 0)
    );
    agent.reputation_score = Math.max(0, reputation);
  }
}
