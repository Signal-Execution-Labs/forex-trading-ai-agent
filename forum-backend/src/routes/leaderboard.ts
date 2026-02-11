import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LeaderboardService } from '../services/leaderboard.service.ts';

export async function leaderboardRoutes(fastify: FastifyInstance) {
  // Get main leaderboard
  fastify.get('/', {
    schema: {
      description: 'Get agent leaderboard',
      tags: ['Leaderboard'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          sort_by: { 
            type: 'string', 
            enum: ['reputation', 'win_rate', 'profit_loss', 'trades'],
            default: 'reputation'
          },
          timeframe: {
            type: 'string',
            enum: ['all', 'month', 'week'],
            default: 'all'
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { limit?: number; sort_by?: 'reputation' | 'win_rate' | 'profit_loss' | 'trades'; timeframe?: 'all' | 'month' | 'week' } }>, reply: FastifyReply) => {
    const { limit, sort_by, timeframe } = request.query;
    const leaderboard = LeaderboardService.getLeaderboard({ 
      limit, 
      sort_by, 
      timeframe 
    });
    
    return {
      success: true,
      data: leaderboard,
      meta: {
        sort_by: sort_by || 'reputation',
        timeframe: timeframe || 'all',
        total: leaderboard.length,
      },
    };
  });

  // Get agent's rank
  fastify.get('/rank/:agent_id', {
    schema: {
      description: 'Get specific agent rank information',
      tags: ['Leaderboard'],
      params: {
        type: 'object',
        required: ['agent_id'],
        properties: {
          agent_id: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { agent_id: string } }>, reply: FastifyReply) => {
    const rank = LeaderboardService.getAgentRank(request.params.agent_id);
    
    if (!rank) {
      return reply.code(404).send({
        success: false,
        error: 'Agent not found or has no trades',
      });
    }
    
    return {
      success: true,
      data: rank,
    };
  });

  // Get top performers by category
  fastify.get('/top/:category', {
    schema: {
      description: 'Get top performers by category and metric',
      tags: ['Leaderboard'],
      params: {
        type: 'object',
        required: ['category'],
        properties: {
          category: { 
            type: 'string', 
            enum: ['daily', 'weekly', 'monthly', 'all_time'] 
          },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          metric: { 
            type: 'string', 
            enum: ['signals', 'accuracy', 'profit'],
            default: 'signals'
          },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { category: 'daily' | 'weekly' | 'monthly' | 'all_time' }; Querystring: { metric?: 'signals' | 'accuracy' | 'profit'; limit?: number } }>, reply: FastifyReply) => {
    const { category } = request.params;
    const { metric, limit } = request.query;
    
    const topPerformers = LeaderboardService.getTopPerformers({
      category,
      metric: metric || 'signals',
      limit,
    });
    
    return {
      success: true,
      data: topPerformers,
      meta: {
        category,
        metric: metric || 'signals',
      },
    };
  });

  // Get global platform statistics
  fastify.get('/stats', {
    schema: {
      description: 'Get global platform statistics',
      tags: ['Leaderboard'],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = LeaderboardService.getGlobalStats();
    
    return {
      success: true,
      data: stats,
    };
  });
}
