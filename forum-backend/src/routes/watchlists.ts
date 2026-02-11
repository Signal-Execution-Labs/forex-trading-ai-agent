import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WatchlistService, Watchlist, WatchlistItem } from '../services/watchlist.service.ts';
import { authenticateAgent, optionalAuth } from '../middleware/auth.ts';

export async function watchlistRoutes(fastify: FastifyInstance) {
  // List public watchlists (no auth needed)
  fastify.get('/public', {
    schema: {
      description: 'Browse public watchlists',
      tags: ['Watchlists'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { search?: string; limit?: number; offset?: number } }>) => {
    const { watchlists, total } = WatchlistService.listPublic(request.query);
    return {
      success: true,
      data: watchlists,
      meta: { total, limit: request.query.limit || 20, offset: request.query.offset || 0 },
    };
  });

  // Create watchlist
  fastify.post('/', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Create a new watchlist',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
          icon: { type: 'string', maxLength: 10 },
          is_public: { type: 'boolean', default: false },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { name: string; description?: string; color?: string; icon?: string; is_public?: boolean } }>, reply: FastifyReply) => {
    const watchlist = WatchlistService.create({
      ...request.body,
      agent_id: request.agent!.id,
    });
    
    return reply.code(201).send({ success: true, data: watchlist });
  });

  // List my watchlists
  fastify.get('/', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'List your watchlists',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest) => {
    const watchlists = WatchlistService.listByAgent(request.agent!.id);
    return { success: true, data: watchlists, meta: { total: watchlists.length } };
  });

  // Get watchlist with items
  fastify.get('/:id', {
    preHandler: [optionalAuth],
    schema: {
      description: 'Get watchlist details with symbols',
      tags: ['Watchlists'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const watchlist = WatchlistService.getById(request.params.id);
    
    if (!watchlist) {
      return reply.code(404).send({ success: false, error: 'Watchlist not found' });
    }
    
    // Check access
    const isOwner = request.agent?.id === watchlist.agent_id;
    if (!watchlist.is_public && !isOwner) {
      return reply.code(403).send({ success: false, error: 'This watchlist is private' });
    }
    
    // Increment view if not owner
    if (!isOwner) {
      WatchlistService.incrementView(watchlist.id);
    }
    
    const items = WatchlistService.getItems(watchlist.id);
    
    return { success: true, data: { ...watchlist, items } };
  });

  // Update watchlist
  fastify.put('/:id', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Update a watchlist',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          color: { type: 'string' },
          icon: { type: 'string' },
          is_public: { type: 'boolean' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<Watchlist> }>, reply: FastifyReply) => {
    const watchlist = WatchlistService.update(request.params.id, request.agent!.id, request.body);
    
    if (!watchlist) {
      return reply.code(404).send({ success: false, error: 'Watchlist not found' });
    }
    
    return { success: true, data: watchlist };
  });

  // Delete watchlist
  fastify.delete('/:id', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Delete a watchlist',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const deleted = WatchlistService.delete(request.params.id, request.agent!.id);
    
    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Watchlist not found' });
    }
    
    return { success: true, message: 'Watchlist deleted' };
  });

  // ========== ITEMS ==========

  // Add symbol to watchlist
  fastify.post('/:id/symbols', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Add a symbol to watchlist',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string', description: 'Trading symbol (e.g., BTC/USD, AAPL)' },
          exchange: { type: 'string' },
          asset_type: { type: 'string', enum: ['crypto', 'forex', 'stock', 'index', 'commodity'] },
          notes: { type: 'string', maxLength: 1000 },
          target_price: { type: 'number' },
          stop_loss: { type: 'number' },
          color: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { symbol: string; exchange?: string; asset_type?: string; notes?: string; target_price?: number; stop_loss?: number; color?: string } }>, reply: FastifyReply) => {
    const item = WatchlistService.addSymbol(request.params.id, request.agent!.id, request.body);
    
    if (!item) {
      return reply.code(404).send({ success: false, error: 'Watchlist not found or not owned by you' });
    }
    
    return reply.code(201).send({ success: true, data: item });
  });

  // Update symbol in watchlist
  fastify.put('/:id/symbols/:itemId', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Update a symbol in watchlist',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'itemId'],
        properties: {
          id: { type: 'string' },
          itemId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          notes: { type: 'string', maxLength: 1000 },
          target_price: { type: 'number' },
          stop_loss: { type: 'number' },
          color: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string; itemId: string }; Body: Partial<WatchlistItem> }>, reply: FastifyReply) => {
    const item = WatchlistService.updateItem(request.params.itemId, request.params.id, request.agent!.id, request.body);
    
    if (!item) {
      return reply.code(404).send({ success: false, error: 'Symbol not found' });
    }
    
    return { success: true, data: item };
  });

  // Remove symbol from watchlist
  fastify.delete('/:id/symbols/:itemId', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Remove a symbol from watchlist',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'itemId'],
        properties: {
          id: { type: 'string' },
          itemId: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string; itemId: string } }>, reply: FastifyReply) => {
    const removed = WatchlistService.removeSymbol(request.params.itemId, request.params.id, request.agent!.id);
    
    if (!removed) {
      return reply.code(404).send({ success: false, error: 'Symbol not found' });
    }
    
    return { success: true, message: 'Symbol removed' };
  });

  // Reorder symbols
  fastify.post('/:id/reorder', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Reorder symbols in watchlist',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['order'],
        properties: {
          order: { type: 'array', items: { type: 'string' }, description: 'Array of item IDs in desired order' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { order: string[] } }>, reply: FastifyReply) => {
    const success = WatchlistService.reorderItems(request.params.id, request.agent!.id, request.body.order);
    
    if (!success) {
      return reply.code(404).send({ success: false, error: 'Watchlist not found' });
    }
    
    return { success: true, message: 'Order updated' };
  });

  // ========== FOLLOW/FORK ==========

  // Follow a public watchlist
  fastify.post('/:id/follow', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Follow a public watchlist',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const success = WatchlistService.follow(request.agent!.id, request.params.id);
    
    if (!success) {
      return reply.code(404).send({ success: false, error: 'Watchlist not found or not public' });
    }
    
    return { success: true, message: 'Following watchlist' };
  });

  // Unfollow a watchlist
  fastify.delete('/:id/follow', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Unfollow a watchlist',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const success = WatchlistService.unfollow(request.agent!.id, request.params.id);
    
    if (!success) {
      return reply.code(404).send({ success: false, error: 'Not following this watchlist' });
    }
    
    return { success: true, message: 'Unfollowed watchlist' };
  });

  // Get followed watchlists
  fastify.get('/following', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Get watchlists you follow',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest) => {
    const watchlists = WatchlistService.getFollowing(request.agent!.id);
    return { success: true, data: watchlists };
  });

  // Fork a public watchlist
  fastify.post('/:id/fork', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Fork (copy) a public watchlist to your collection',
      tags: ['Watchlists'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const forked = WatchlistService.fork(request.params.id, request.agent!.id);
    
    if (!forked) {
      return reply.code(404).send({ success: false, error: 'Watchlist not found or not public' });
    }
    
    return reply.code(201).send({ success: true, data: forked });
  });
}
