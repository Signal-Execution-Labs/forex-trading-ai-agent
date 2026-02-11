import { db, dbHelpers } from '../db/database.ts';
import { LeaderboardEntry } from '../models/types.ts';

export class LeaderboardService {
  static getLeaderboard(options: {
    limit?: number;
    sort_by?: 'reputation' | 'win_rate' | 'profit_loss' | 'trades';
    timeframe?: 'all' | 'month' | 'week';
  } = {}): LeaderboardEntry[] {
    const limit = Math.min(options.limit || 50, 100);
    const sortBy = options.sort_by || 'reputation';

    let agents = db.data!.agents.filter(a => a.total_trades > 0);

    // Sort based on criteria
    switch (sortBy) {
      case 'win_rate':
        agents.sort((a, b) => b.win_rate - a.win_rate || b.total_trades - a.total_trades);
        break;
      case 'profit_loss':
        agents.sort((a, b) => b.profit_loss - a.profit_loss || b.win_rate - a.win_rate);
        break;
      case 'trades':
        agents.sort((a, b) => b.total_trades - a.total_trades || b.win_rate - a.win_rate);
        break;
      default:
        agents.sort((a, b) => b.reputation_score - a.reputation_score || b.win_rate - a.win_rate);
    }

    return agents.slice(0, limit).map((agent, index) => ({
      rank: index + 1,
      agent_id: agent.id,
      agent_name: agent.name,
      avatar_url: agent.avatar_url,
      win_rate: agent.win_rate,
      total_trades: agent.total_trades,
      profit_loss: agent.profit_loss,
      reputation_score: agent.reputation_score,
      is_verified: agent.is_verified === 1,
    }));
  }

  static getAgentRank(agentId: string): {
    rank: number;
    total_agents: number;
    percentile: number;
  } | null {
    const agents = db.data!.agents.filter(a => a.total_trades > 0);
    const total_agents = agents.length;

    if (total_agents === 0) return null;

    // Sort by reputation
    agents.sort((a, b) => b.reputation_score - a.reputation_score);

    const agentIndex = agents.findIndex(a => a.id === agentId);
    if (agentIndex === -1) return null;

    const rank = agentIndex + 1;
    const percentile = Math.round(((total_agents - rank + 1) / total_agents) * 100);

    return {
      rank,
      total_agents,
      percentile,
    };
  }

  static getTopPerformers(options: {
    category: 'daily' | 'weekly' | 'monthly' | 'all_time';
    metric: 'signals' | 'accuracy' | 'profit';
    limit?: number;
  }): Array<{
    agent_id: string;
    agent_name: string;
    avatar_url?: string;
    value: number;
    label: string;
  }> {
    const limit = options.limit || 10;
    
    let dateFilter: Date | null = null;
    switch (options.category) {
      case 'daily':
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 1);
        break;
      case 'weekly':
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case 'monthly':
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 30);
        break;
    }

    let results: Array<{
      agent_id: string;
      agent_name: string;
      avatar_url?: string;
      value: number;
      label: string;
    }> = [];

    switch (options.metric) {
      case 'signals': {
        // Count signals per agent
        const signalCounts: Record<string, number> = {};
        db.data!.signals
          .filter(s => !dateFilter || new Date(s.created_at) > dateFilter)
          .forEach(s => {
            signalCounts[s.agent_id] = (signalCounts[s.agent_id] || 0) + 1;
          });

        results = Object.entries(signalCounts)
          .map(([agent_id, count]) => {
            const agent = dbHelpers.findAgent(agent_id);
            return {
              agent_id,
              agent_name: agent?.name || 'Unknown',
              avatar_url: agent?.avatar_url,
              value: count,
              label: 'signals',
            };
          })
          .sort((a, b) => b.value - a.value)
          .slice(0, limit);
        break;
      }

      case 'accuracy': {
        // Calculate win rate per agent from signals
        const agentStats: Record<string, { wins: number; total: number }> = {};
        db.data!.signals
          .filter(s => s.result && (!dateFilter || new Date(s.created_at) > dateFilter))
          .forEach(s => {
            if (!agentStats[s.agent_id]) {
              agentStats[s.agent_id] = { wins: 0, total: 0 };
            }
            agentStats[s.agent_id].total += 1;
            if (s.result === 'WIN') {
              agentStats[s.agent_id].wins += 1;
            }
          });

        results = Object.entries(agentStats)
          .filter(([_, stats]) => stats.total >= 5) // Minimum 5 closed signals
          .map(([agent_id, stats]) => {
            const agent = dbHelpers.findAgent(agent_id);
            return {
              agent_id,
              agent_name: agent?.name || 'Unknown',
              avatar_url: agent?.avatar_url,
              value: Math.round((stats.wins / stats.total) * 10000) / 100,
              label: '% accuracy',
            };
          })
          .sort((a, b) => b.value - a.value)
          .slice(0, limit);
        break;
      }

      case 'profit': {
        results = db.data!.agents
          .filter(a => a.total_trades > 0)
          .map(a => ({
            agent_id: a.id,
            agent_name: a.name,
            avatar_url: a.avatar_url,
            value: a.profit_loss,
            label: 'profit',
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, limit);
        break;
      }
    }

    return results;
  }

  static getGlobalStats(): {
    total_agents: number;
    total_signals: number;
    total_strategies: number;
    total_posts: number;
    avg_win_rate: number;
    signals_today: number;
  } {
    const total_agents = db.data!.agents.length;
    const total_signals = db.data!.signals.length;
    const total_strategies = db.data!.strategies.length;
    const total_posts = db.data!.posts.length;

    const agentsWithTrades = db.data!.agents.filter(a => a.total_trades > 0);
    const avg_win_rate = agentsWithTrades.length > 0
      ? Math.round(agentsWithTrades.reduce((sum, a) => sum + a.win_rate, 0) / agentsWithTrades.length * 100) / 100
      : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const signals_today = db.data!.signals.filter(s => new Date(s.created_at) >= today).length;

    return {
      total_agents,
      total_signals,
      total_strategies,
      total_posts,
      avg_win_rate,
      signals_today,
    };
  }
}
