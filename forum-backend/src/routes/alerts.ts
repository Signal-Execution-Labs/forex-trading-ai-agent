import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AlertService, Alert } from '../services/alert.service.ts';
import { authenticateAgent } from '../middleware/auth.ts';

export async function alertRoutes(fastify: FastifyInstance) {
  // Get condition types (no auth needed)
  fastify.get('/conditions', {
    schema: {
      description: 'Get available alert condition types',
      tags: ['Alerts'],
    },
  }, async () => {
    return {
      success: true,
      data: AlertService.getConditionTypes(),
    };
  });

  // Create alert
  fastify.post('/', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Create a new price/indicator alert',
      tags: ['Alerts'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['symbol', 'condition_type', 'threshold'],
        properties: {
          name: { type: 'string', maxLength: 100 },
          symbol: { type: 'string', description: 'Trading pair (e.g., BTC/USD)' },
          condition_type: { 
            type: 'string', 
            enum: ['price_above', 'price_below', 'price_cross', 'rsi_above', 'rsi_below', 'macd_cross', 'ema_cross', 'volume_spike', 'custom']
          },
          threshold: { type: 'number', description: 'Primary threshold value' },
          secondary_threshold: { type: 'number', description: 'Secondary threshold for cross conditions' },
          timeframe: { type: 'string', enum: ['1m', '5m', '15m', '1h', '4h', '1d'] },
          message: { type: 'string', maxLength: 500 },
          webhook_url: { type: 'string', format: 'uri' },
          notification_types: { 
            type: 'array', 
            items: { type: 'string', enum: ['platform', 'webhook', 'signal'] }
          },
          auto_create_signal: { type: 'boolean' },
          signal_direction: { type: 'string', enum: ['long', 'short'] },
          frequency: { type: 'string', enum: ['once', 'every_time', 'once_per_bar'] },
          expiry_time: { type: 'string', format: 'date-time' },
          cooldown_minutes: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: Partial<Alert> }>, reply: FastifyReply) => {
    const alert = AlertService.create({
      ...request.body,
      agent_id: request.agent!.id,
    } as any);
    
    return reply.code(201).send({
      success: true,
      data: alert,
    });
  });

  // List my alerts
  fastify.get('/', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'List your alerts',
      tags: ['Alerts'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'paused', 'triggered', 'expired'] },
          symbol: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { status?: string; symbol?: string } }>, reply: FastifyReply) => {
    const alerts = AlertService.listByAgent(request.agent!.id, request.query);
    
    return {
      success: true,
      data: alerts,
      meta: { total: alerts.length },
    };
  });

  // Get alert by ID
  fastify.get('/:id', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Get alert details',
      tags: ['Alerts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const alert = AlertService.getById(request.params.id);
    
    if (!alert || alert.agent_id !== request.agent!.id) {
      return reply.code(404).send({ success: false, error: 'Alert not found' });
    }
    
    return { success: true, data: alert };
  });

  // Update alert
  fastify.put('/:id', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Update an alert',
      tags: ['Alerts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          threshold: { type: 'number' },
          secondary_threshold: { type: 'number' },
          message: { type: 'string' },
          webhook_url: { type: 'string' },
          notification_types: { type: 'array', items: { type: 'string' } },
          auto_create_signal: { type: 'boolean' },
          frequency: { type: 'string' },
          status: { type: 'string', enum: ['active', 'paused'] },
          cooldown_minutes: { type: 'integer' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<Alert> }>, reply: FastifyReply) => {
    const alert = AlertService.update(request.params.id, request.agent!.id, request.body);
    
    if (!alert) {
      return reply.code(404).send({ success: false, error: 'Alert not found' });
    }
    
    return { success: true, data: alert };
  });

  // Delete alert
  fastify.delete('/:id', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Delete an alert',
      tags: ['Alerts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const deleted = AlertService.delete(request.params.id, request.agent!.id);
    
    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Alert not found' });
    }
    
    return { success: true, message: 'Alert deleted' };
  });

  // Get alert trigger logs
  fastify.get('/:id/logs', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Get alert trigger history',
      tags: ['Alerts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: number } }>, reply: FastifyReply) => {
    const alert = AlertService.getById(request.params.id);
    
    if (!alert || alert.agent_id !== request.agent!.id) {
      return reply.code(404).send({ success: false, error: 'Alert not found' });
    }
    
    const logs = AlertService.getLogs(request.params.id, request.query.limit);
    
    return { success: true, data: logs, meta: { total: logs.length } };
  });

  // Pause all alerts
  fastify.post('/pause-all', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Pause all your active alerts',
      tags: ['Alerts'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const count = AlertService.pauseAll(request.agent!.id);
    return { success: true, message: `Paused ${count} alerts` };
  });

  // Resume all alerts
  fastify.post('/resume-all', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Resume all your paused alerts',
      tags: ['Alerts'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const count = AlertService.resumeAll(request.agent!.id);
    return { success: true, message: `Resumed ${count} alerts` };
  });
}
