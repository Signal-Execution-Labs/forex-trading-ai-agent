import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StrategyService } from '../services/strategy.service.ts';
import { StrategyCreateSchema, BacktestRequestSchema } from '../models/types.ts';
import { authenticateAgent } from '../middleware/auth.ts';

export async function strategyRoutes(fastify: FastifyInstance) {
  // Create a new strategy
  fastify.post('/', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Create a new trading strategy',
      tags: ['Strategies'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 100 },
          description: { type: 'string', maxLength: 2000 },
          type: { 
            type: 'string', 
            enum: ['trend_following', 'mean_reversion', 'momentum', 'scalping', 'arbitrage', 'ml_based', 'custom'] 
          },
          parameters: { type: 'object' },
          timeframe: { type: 'string' },
          assets: { type: 'array', items: { type: 'string' } },
          is_public: { type: 'boolean', default: true },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const parsed = StrategyCreateSchema.parse(request.body);
      const strategy = await StrategyService.create(request.agent!.id, parsed);

      return reply.code(201).send({
        success: true,
        data: strategy,
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

  // List strategies
  fastify.get('/', {
    schema: {
      description: 'List trading strategies',
      tags: ['Strategies'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          agent_id: { type: 'string' },
          type: { type: 'string' },
          is_public: { type: 'boolean' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { page?: number; limit?: number; agent_id?: string; type?: string; is_public?: boolean } }>, reply: FastifyReply) => {
    const { page, limit, agent_id, type, is_public } = request.query;
    const { strategies, total } = StrategyService.list({ 
      page, 
      limit, 
      agent_id, 
      type, 
      is_public: is_public ?? true
    });
    
    return {
      success: true,
      data: strategies,
      meta: {
        page: page || 1,
        limit: limit || 20,
        total,
        total_pages: Math.ceil(total / (limit || 20)),
      },
    };
  });

  // Get strategy by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get strategy details by ID',
      tags: ['Strategies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const strategy = StrategyService.getById(request.params.id);
    
    if (!strategy) {
      return reply.code(404).send({
        success: false,
        error: 'Strategy not found',
      });
    }

    // Parse JSON fields
    const result = {
      ...strategy,
      parameters: strategy.parameters ? JSON.parse(strategy.parameters) : null,
      assets: strategy.assets ? JSON.parse(strategy.assets) : null,
      backtest_results: strategy.backtest_results ? JSON.parse(strategy.backtest_results) : null,
    };
    
    return {
      success: true,
      data: result,
    };
  });

  // Run backtest on strategy
  fastify.post('/:id/backtest', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Run a backtest on a strategy',
      tags: ['Strategies'],
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
        required: ['start_date', 'end_date'],
        properties: {
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          initial_capital: { type: 'number', minimum: 0, default: 10000 },
          assets: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const strategy = StrategyService.getById(request.params.id);
    
    if (!strategy) {
      return reply.code(404).send({
        success: false,
        error: 'Strategy not found',
      });
    }

    // Only owner can backtest private strategies
    if (strategy.is_public === 0 && strategy.agent_id !== request.agent!.id) {
      return reply.code(403).send({
        success: false,
        error: 'Cannot backtest private strategy',
      });
    }

    try {
      const parsed = BacktestRequestSchema.parse(request.body);
      const results = await StrategyService.runBacktest(request.params.id, parsed);

      return {
        success: true,
        data: results,
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
}
