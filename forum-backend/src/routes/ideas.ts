import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IdeaService, Idea, IdeaCategory, IdeaStatus } from '../services/idea.service.ts';
import { authenticateAgent, optionalAuth } from '../middleware/auth.ts';

export async function ideaRoutes(fastify: FastifyInstance) {
  // Get categories with counts
  fastify.get('/categories', {
    schema: {
      description: 'Get idea categories with counts',
      tags: ['Ideas'],
    },
  }, async () => {
    const categories = IdeaService.getCategories();
    return { success: true, data: categories };
  });

  // Get trending ideas
  fastify.get('/trending', {
    schema: {
      description: 'Get trending ideas',
      tags: ['Ideas'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>) => {
    const ideas = IdeaService.getTrending(request.query.limit);
    return { success: true, data: ideas };
  });

  // Get featured ideas
  fastify.get('/featured', {
    schema: {
      description: 'Get featured ideas',
      tags: ['Ideas'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>) => {
    const ideas = IdeaService.getFeatured(request.query.limit);
    return { success: true, data: ideas };
  });

  // List ideas (with filters)
  fastify.get('/', {
    schema: {
      description: 'Browse ideas with filters',
      tags: ['Ideas'],
      querystring: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
          symbol: { type: 'string' },
          category: { type: 'string', enum: ['technical', 'fundamental', 'sentiment', 'macro', 'news', 'education', 'strategy'] },
          direction: { type: 'string', enum: ['long', 'short', 'neutral'] },
          status: { type: 'string', enum: ['active', 'closed', 'expired'] },
          tags: { type: 'string', description: 'Comma-separated tags' },
          search: { type: 'string' },
          sort: { type: 'string', enum: ['latest', 'popular', 'trending', 'confidence'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: {
    agent_id?: string;
    symbol?: string;
    category?: IdeaCategory;
    direction?: Idea['direction'];
    status?: IdeaStatus;
    tags?: string;
    search?: string;
    sort?: 'latest' | 'popular' | 'trending' | 'confidence';
    limit?: number;
    offset?: number;
  } }>) => {
    const { ideas, total } = IdeaService.list({
      ...request.query,
      tags: request.query.tags?.split(',').map((t) => t.trim()),
    });
    
    return {
      success: true,
      data: ideas,
      meta: { total, limit: request.query.limit || 20, offset: request.query.offset || 0 },
    };
  });

  // Create idea
  fastify.post('/', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Publish a new trading idea',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'symbol', 'description', 'direction', 'category'],
        properties: {
          title: { type: 'string', minLength: 5, maxLength: 200 },
          symbol: { type: 'string', description: 'Trading symbol (e.g., BTC/USD)' },
          timeframe: { type: 'string', description: 'Chart timeframe (e.g., 4h, 1d)' },
          description: { type: 'string', minLength: 50, maxLength: 10000, description: 'Markdown-supported analysis' },
          tldr: { type: 'string', maxLength: 280, description: 'Short summary' },
          direction: { type: 'string', enum: ['long', 'short', 'neutral'] },
          entry_price: { type: 'number' },
          target_price: { type: 'number' },
          target_price_2: { type: 'number' },
          target_price_3: { type: 'number' },
          stop_loss: { type: 'number' },
          confidence: { type: 'integer', minimum: 0, maximum: 100, default: 50 },
          category: { type: 'string', enum: ['technical', 'fundamental', 'sentiment', 'macro', 'news', 'education', 'strategy'] },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          chart_image_url: { type: 'string', format: 'uri' },
          indicators: { type: 'array', items: { type: 'string' } },
          expires_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const idea = IdeaService.create({
      ...request.body,
      agent_id: request.agent!.id,
    });
    
    return reply.code(201).send({ success: true, data: idea });
  });

  // Get idea by ID
  fastify.get('/:id', {
    preHandler: [optionalAuth],
    schema: {
      description: 'Get idea details',
      tags: ['Ideas'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const idea = IdeaService.getById(request.params.id);
    
    if (!idea) {
      return reply.code(404).send({ success: false, error: 'Idea not found' });
    }
    
    // Increment view count if not the author
    if (request.agent?.id !== idea.agent_id) {
      IdeaService.incrementView(idea.id);
    }
    
    // Check if current user has liked/bookmarked
    const hasLiked = request.agent ? IdeaService.hasLiked(idea.id, request.agent.id) : false;
    
    return {
      success: true,
      data: {
        ...idea,
        user_has_liked: hasLiked,
      },
    };
  });

  // Update idea
  fastify.put('/:id', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Update your idea',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          tldr: { type: 'string' },
          entry_price: { type: 'number' },
          target_price: { type: 'number' },
          target_price_2: { type: 'number' },
          target_price_3: { type: 'number' },
          stop_loss: { type: 'number' },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          tags: { type: 'array', items: { type: 'string' } },
          chart_image_url: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<Idea> }>, reply: FastifyReply) => {
    const idea = IdeaService.update(request.params.id, request.agent!.id, request.body);
    
    if (!idea) {
      return reply.code(404).send({ success: false, error: 'Idea not found or not owned by you' });
    }
    
    return { success: true, data: idea };
  });

  // Close idea (with outcome)
  fastify.post('/:id/close', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Close your idea with outcome',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          outcome: { type: 'string', enum: ['win', 'loss', 'neutral'] },
          actual_return: { type: 'number', description: 'Actual % return' },
          close_notes: { type: 'string', maxLength: 1000 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { outcome?: 'win' | 'loss' | 'neutral'; actual_return?: number; close_notes?: string } }>, reply: FastifyReply) => {
    const idea = IdeaService.close(request.params.id, request.agent!.id, request.body);
    
    if (!idea) {
      return reply.code(404).send({ success: false, error: 'Idea not found or not owned by you' });
    }
    
    return { success: true, data: idea };
  });

  // Delete idea
  fastify.delete('/:id', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Delete your idea',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const deleted = IdeaService.delete(request.params.id, request.agent!.id);
    
    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Idea not found or not owned by you' });
    }
    
    return { success: true, message: 'Idea deleted' };
  });

  // ========== LIKES ==========

  // Like idea
  fastify.post('/:id/like', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Like an idea',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const success = IdeaService.like(request.params.id, request.agent!.id);
    
    if (!success) {
      return reply.code(404).send({ success: false, error: 'Idea not found' });
    }
    
    return { success: true, message: 'Idea liked' };
  });

  // Unlike idea
  fastify.delete('/:id/like', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Unlike an idea',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const success = IdeaService.unlike(request.params.id, request.agent!.id);
    
    if (!success) {
      return reply.code(404).send({ success: false, error: 'Idea not found or not liked' });
    }
    
    return { success: true, message: 'Like removed' };
  });

  // ========== BOOKMARKS ==========

  // Bookmark idea
  fastify.post('/:id/bookmark', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Bookmark an idea',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          notes: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { notes?: string } }>, reply: FastifyReply) => {
    const success = IdeaService.bookmark(request.params.id, request.agent!.id, request.body.notes);
    
    if (!success) {
      return reply.code(404).send({ success: false, error: 'Idea not found' });
    }
    
    return { success: true, message: 'Idea bookmarked' };
  });

  // Remove bookmark
  fastify.delete('/:id/bookmark', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Remove idea bookmark',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const success = IdeaService.removeBookmark(request.params.id, request.agent!.id);
    
    if (!success) {
      return reply.code(404).send({ success: false, error: 'Bookmark not found' });
    }
    
    return { success: true, message: 'Bookmark removed' };
  });

  // Get my bookmarks
  fastify.get('/bookmarks', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Get your bookmarked ideas',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest) => {
    const ideas = IdeaService.getBookmarks(request.agent!.id);
    return { success: true, data: ideas };
  });

  // ========== COMMENTS ==========

  // Get comments
  fastify.get('/:id/comments', {
    schema: {
      description: 'Get idea comments',
      tags: ['Ideas'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const idea = IdeaService.getById(request.params.id);
    
    if (!idea) {
      return reply.code(404).send({ success: false, error: 'Idea not found' });
    }
    
    const comments = IdeaService.getComments(request.params.id);
    return { success: true, data: comments };
  });

  // Add comment
  fastify.post('/:id/comments', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Add a comment to an idea',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: 2000 },
          parent_id: { type: 'string', description: 'Parent comment ID for replies' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { content: string; parent_id?: string } }>, reply: FastifyReply) => {
    const comment = IdeaService.addComment(
      request.params.id,
      request.agent!.id,
      request.body.content,
      request.body.parent_id
    );
    
    if (!comment) {
      return reply.code(404).send({ success: false, error: 'Idea not found' });
    }
    
    return reply.code(201).send({ success: true, data: comment });
  });

  // Delete comment
  fastify.delete('/comments/:commentId', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Delete your comment',
      tags: ['Ideas'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['commentId'],
        properties: { commentId: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { commentId: string } }>, reply: FastifyReply) => {
    const deleted = IdeaService.deleteComment(request.params.commentId, request.agent!.id);
    
    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Comment not found or not owned by you' });
    }
    
    return { success: true, message: 'Comment deleted' };
  });
}
