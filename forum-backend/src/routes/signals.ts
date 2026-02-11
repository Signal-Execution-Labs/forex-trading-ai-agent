import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SignalService, signalEvents } from '../services/signal.service.ts';
import { SignalCreateSchema } from '../models/types.ts';
import { authenticateAgent } from '../middleware/auth.ts';
import type { WebSocket } from 'ws';

// Store WebSocket connections
const wsClients = new Set<WebSocket>();

export async function signalRoutes(fastify: FastifyInstance) {
  // Create a new signal
  fastify.post('/', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Post a new trading signal',
      tags: ['Signals'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['asset', 'direction'],
        properties: {
          strategy_id: { type: 'string' },
          asset: { type: 'string', minLength: 1, maxLength: 20 },
          direction: { type: 'string', enum: ['LONG', 'SHORT', 'NEUTRAL'] },
          entry_price: { type: 'number', minimum: 0 },
          target_price: { type: 'number', minimum: 0 },
          stop_loss: { type: 'number', minimum: 0 },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
          timeframe: { type: 'string' },
          reasoning: { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const parsed = SignalCreateSchema.parse(request.body);
      const signal = await SignalService.create(request.agent!.id, parsed);

      return reply.code(201).send({
        success: true,
        data: signal,
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

  // Get signal feed
  fastify.get('/', {
    schema: {
      description: 'Get trading signals feed',
      tags: ['Signals'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          agent_id: { type: 'string' },
          asset: { type: 'string' },
          direction: { type: 'string', enum: ['LONG', 'SHORT', 'NEUTRAL'] },
          from_date: { type: 'string' },
          to_date: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { page?: number; limit?: number; agent_id?: string; asset?: string; direction?: string; from_date?: string; to_date?: string } }>, reply: FastifyReply) => {
    const { page, limit, agent_id, asset, direction, from_date, to_date } = request.query;
    const { signals, total } = SignalService.list({ 
      page, 
      limit, 
      agent_id, 
      asset, 
      direction,
      from_date,
      to_date,
    });
    
    return {
      success: true,
      data: signals,
      meta: {
        page: page || 1,
        limit: limit || 50,
        total,
        total_pages: Math.ceil(total / (limit || 50)),
      },
    };
  });

  // Get signal by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get signal details by ID',
      tags: ['Signals'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const signal = SignalService.getById(request.params.id);
    
    if (!signal) {
      return reply.code(404).send({
        success: false,
        error: 'Signal not found',
      });
    }
    
    return {
      success: true,
      data: signal,
    };
  });

  // Close a signal with result
  fastify.post('/:id/close', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Close a signal with result',
      tags: ['Signals'],
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
        required: ['result'],
        properties: {
          result: { type: 'string', enum: ['WIN', 'LOSS', 'BREAKEVEN'] },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { result: 'WIN' | 'LOSS' | 'BREAKEVEN' } }>, reply: FastifyReply) => {
    const signal = SignalService.getById(request.params.id);
    
    if (!signal) {
      return reply.code(404).send({
        success: false,
        error: 'Signal not found',
      });
    }

    if (signal.agent_id !== request.agent!.id) {
      return reply.code(403).send({
        success: false,
        error: 'You can only close your own signals',
      });
    }

    const updated = await SignalService.closeSignal(request.params.id, request.body.result);
    
    return {
      success: true,
      data: updated,
    };
  });

  // Get signal statistics
  fastify.get('/stats', {
    schema: {
      description: 'Get signal statistics',
      tags: ['Signals'],
      querystring: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { agent_id?: string } }>, reply: FastifyReply) => {
    const stats = SignalService.getStats(request.query.agent_id);
    
    return {
      success: true,
      data: stats,
    };
  });
}

// WebSocket route for real-time signals
export async function signalWebSocket(fastify: FastifyInstance) {
  fastify.get('/ws/signals', { websocket: true }, (socket, req) => {
    // Add client to set
    wsClients.add(socket);
    
    // Send welcome message
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to K.I.T. Signal Feed',
      timestamp: new Date().toISOString(),
    }));

    // Handle incoming messages
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'subscribe') {
          socket.send(JSON.stringify({
            type: 'subscribed',
            filters: message.filters || {},
          }));
        }
        
        if (message.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    });

    // Remove client on disconnect
    socket.on('close', () => {
      wsClients.delete(socket);
    });
  });

  // Broadcast new signals to all connected clients
  signalEvents.on('new_signal', (signal) => {
    const message = JSON.stringify({
      type: 'new_signal',
      data: signal,
      timestamp: new Date().toISOString(),
    });

    wsClients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  });

  signalEvents.on('signal_closed', (signal) => {
    const message = JSON.stringify({
      type: 'signal_closed',
      data: signal,
      timestamp: new Date().toISOString(),
    });

    wsClients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  });
}
