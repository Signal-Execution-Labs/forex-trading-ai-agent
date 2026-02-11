/**
 * Competitions API Routes (Fastify Plugin)
 * Trading tournaments for AI agents
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { competitionService } from '../services/competition.service.ts';

export async function competitionRoutes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Get featured competitions
  fastify.get('/featured', {
    schema: {
      description: 'Get featured competitions',
      tags: ['Competitions'],
      response: {
        200: {
          type: 'object',
          properties: {
            competitions: { type: 'array' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const competitions = await competitionService.getFeatured();
    return { competitions };
  });

  // List competitions
  fastify.get('/', {
    schema: {
      description: 'List competitions with filters',
      tags: ['Competitions'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['upcoming', 'active', 'ended'] },
          type: { type: 'string', enum: ['paper', 'signal', 'strategy'] },
          limit: { type: 'number', default: 20 },
          offset: { type: 'number', default: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const { status, type, limit, offset } = request.query as any;
    return await competitionService.listCompetitions({ status, type, limit, offset });
  });

  // Get competition by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get competition details',
      tags: ['Competitions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const competition = await competitionService.getCompetition(id);
    if (!competition) {
      return reply.code(404).send({ error: 'Competition not found' });
    }
    return competition;
  });

  // Create competition
  fastify.post('/', {
    schema: {
      description: 'Create a new competition',
      tags: ['Competitions'],
      body: {
        type: 'object',
        required: ['name', 'description', 'type', 'startDate', 'endDate', 'rules'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['paper', 'signal', 'strategy'] },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          entryFee: { type: 'number', default: 0 },
          prizePool: { type: 'number', default: 0 },
          prizes: { type: 'array' },
          rules: { type: 'object' },
          assets: { type: 'array', items: { type: 'string' } },
          maxParticipants: { type: 'number', default: 100 }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const competition = await competitionService.createCompetition({
      ...(request.body as any),
      createdBy: agentId
    });
    return reply.code(201).send(competition);
  });

  // Join competition
  fastify.post('/:id/join', {
    schema: {
      description: 'Join a competition',
      tags: ['Competitions'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { id } = request.params as any;
    const result = await competitionService.joinCompetition(id, agentId);
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    return { success: true };
  });

  // Leave competition
  fastify.post('/:id/leave', {
    schema: {
      description: 'Leave/withdraw from a competition',
      tags: ['Competitions']
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { id } = request.params as any;
    const result = await competitionService.leaveCompetition(id, agentId);
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    return { success: true };
  });

  // Get leaderboard
  fastify.get('/:id/leaderboard', {
    schema: {
      description: 'Get competition leaderboard',
      tags: ['Competitions']
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const leaderboard = await competitionService.getLeaderboard(id);
    return { leaderboard };
  });

  // Submit trade in competition
  fastify.post('/:id/trades', {
    schema: {
      description: 'Submit a trade in a competition',
      tags: ['Competitions'],
      body: {
        type: 'object',
        required: ['asset', 'direction', 'entryPrice', 'quantity'],
        properties: {
          asset: { type: 'string' },
          direction: { type: 'string', enum: ['long', 'short'] },
          entryPrice: { type: 'number' },
          quantity: { type: 'number' },
          leverage: { type: 'number', default: 1 },
          stopLoss: { type: 'number' },
          takeProfit: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { id } = request.params as any;
    const result = await competitionService.submitTrade({
      ...(request.body as any),
      competitionId: id,
      agentId
    });
    
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    return reply.code(201).send(result.trade);
  });

  // Close trade
  fastify.post('/:id/trades/:tradeId/close', {
    schema: {
      description: 'Close a trade in a competition',
      tags: ['Competitions'],
      body: {
        type: 'object',
        required: ['exitPrice'],
        properties: {
          exitPrice: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { tradeId } = request.params as any;
    const { exitPrice } = request.body as any;
    
    const result = await competitionService.closeTrade(tradeId, agentId, exitPrice);
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    return result.trade;
  });

  // Get my trades in competition
  fastify.get('/:id/my-trades', {
    schema: {
      description: 'Get my trades in a competition',
      tags: ['Competitions']
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { id } = request.params as any;
    const trades = await competitionService.getAgentTrades(id, agentId);
    return { trades };
  });

  // End competition (admin only)
  fastify.post('/:id/end', {
    schema: {
      description: 'End a competition and distribute prizes',
      tags: ['Competitions']
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { id } = request.params as any;
    const competition = await competitionService.getCompetition(id);
    if (!competition) {
      return reply.code(404).send({ error: 'Competition not found' });
    }
    if (competition.createdBy !== agentId) {
      return reply.code(403).send({ error: 'Only creator can end competition' });
    }
    
    const result = await competitionService.endCompetition(id);
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    return { success: true, winners: result.winners };
  });
}
