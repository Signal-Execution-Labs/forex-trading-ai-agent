import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AgentService } from '../services/agent.service.ts';
import { AgentRegisterSchema, AgentStatsUpdateSchema } from '../models/types.ts';
import { authenticateAgent } from '../middleware/auth.ts';

export async function agentRoutes(fastify: FastifyInstance) {
  // Register a new agent
  fastify.post('/register', {
    schema: {
      description: 'Register a new AI agent',
      tags: ['Agents'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 50 },
          description: { type: 'string', maxLength: 500 },
          avatar_url: { type: 'string', format: 'uri' },
          strategy_type: { type: 'string' },
          twitter_handle: { type: 'string', maxLength: 15, description: 'Twitter/X handle (without @)' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { name: string; description?: string; avatar_url?: string; strategy_type?: string; twitter_handle?: string } }>, reply: FastifyReply) => {
    try {
      const parsed = AgentRegisterSchema.parse(request.body);
      
      // Check if name already exists
      const existing = AgentService.getByName(parsed.name);
      if (existing) {
        return reply.code(409).send({
          success: false,
          error: 'Agent with this name already exists',
        });
      }

      const { agent, api_key } = await AgentService.register(parsed);
      
      // Generate JWT token for the agent
      const jwt_token = fastify.jwt.sign(
        { id: agent.id, name: agent.name },
        { expiresIn: '30d' }
      );

      return reply.code(201).send({
        success: true,
        data: {
          agent,
          api_key,
          jwt_token,
          message: 'Save your API key securely - it cannot be retrieved later!',
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  // List all agents
  fastify.get('/', {
    schema: {
      description: 'List all registered agents',
      tags: ['Agents'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { page?: number; limit?: number; search?: string } }>, reply: FastifyReply) => {
    const { page, limit, search } = request.query;
    const { agents, total } = AgentService.list({ page, limit, search });
    
    return {
      success: true,
      data: agents,
      meta: {
        page: page || 1,
        limit: limit || 20,
        total,
        total_pages: Math.ceil(total / (limit || 20)),
      },
    };
  });

  // Get agent by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get agent profile by ID',
      tags: ['Agents'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const agent = AgentService.getById(request.params.id);
    
    if (!agent) {
      return reply.code(404).send({
        success: false,
        error: 'Agent not found',
      });
    }

    // Remove sensitive data
    const { api_key_hash, ...safeAgent } = agent;
    
    return {
      success: true,
      data: safeAgent,
    };
  });

  // Update agent stats (requires authentication)
  fastify.put('/:id/stats', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Update agent performance stats',
      tags: ['Agents'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          win_rate: { type: 'number', minimum: 0, maximum: 100 },
          total_trades: { type: 'integer', minimum: 0 },
          profit_loss: { type: 'number' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { win_rate?: number; total_trades?: number; profit_loss?: number } }>, reply: FastifyReply) => {
    // Verify the agent is updating their own stats
    if (request.agent?.id !== request.params.id) {
      return reply.code(403).send({
        success: false,
        error: 'You can only update your own stats',
      });
    }

    try {
      const parsed = AgentStatsUpdateSchema.parse(request.body);
      const updated = await AgentService.updateStats(request.params.id, parsed);
      
      if (!updated) {
        return reply.code(404).send({
          success: false,
          error: 'Agent not found',
        });
      }

      const { api_key_hash, ...safeAgent } = updated;
      
      return {
        success: true,
        data: safeAgent,
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  // Refresh JWT token
  fastify.post('/token/refresh', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Refresh JWT token',
      tags: ['Agents'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const jwt_token = fastify.jwt.sign(
      { id: request.agent!.id, name: request.agent!.name },
      { expiresIn: '30d' }
    );

    return {
      success: true,
      data: { jwt_token },
    };
  });
}
