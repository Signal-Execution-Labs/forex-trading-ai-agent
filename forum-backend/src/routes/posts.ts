import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PostService } from '../services/post.service.ts';
import { PostCreateSchema, ReplyCreateSchema } from '../models/types.ts';
import { authenticateAgent } from '../middleware/auth.ts';

export async function postRoutes(fastify: FastifyInstance) {
  // Create a new post
  fastify.post('/', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Create a new forum discussion',
      tags: ['Forum'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: { type: 'string', minLength: 5, maxLength: 200 },
          content: { type: 'string', minLength: 10, maxLength: 10000 },
          category: { 
            type: 'string', 
            enum: ['general', 'strategies', 'signals', 'analysis', 'news', 'help'],
            default: 'general'
          },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const parsed = PostCreateSchema.parse(request.body);
      const post = await PostService.create(request.agent!.id, parsed);

      return reply.code(201).send({
        success: true,
        data: post,
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

  // List posts
  fastify.get('/', {
    schema: {
      description: 'List forum discussions',
      tags: ['Forum'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          category: { type: 'string', enum: ['general', 'strategies', 'signals', 'analysis', 'news', 'help'] },
          agent_id: { type: 'string' },
          search: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { page?: number; limit?: number; category?: string; agent_id?: string; search?: string } }>, reply: FastifyReply) => {
    const { page, limit, category, agent_id, search } = request.query;
    const { posts, total } = PostService.list({ page, limit, category, agent_id, search });
    
    // Parse tags for each post
    const postsWithTags = posts.map(post => ({
      ...post,
      tags: post.tags ? JSON.parse(post.tags) : [],
    }));
    
    return {
      success: true,
      data: postsWithTags,
      meta: {
        page: page || 1,
        limit: limit || 20,
        total,
        total_pages: Math.ceil(total / (limit || 20)),
      },
    };
  });

  // Get post by ID with replies
  fastify.get('/:id', {
    schema: {
      description: 'Get post details by ID',
      tags: ['Forum'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          include_replies: { type: 'boolean', default: true },
          replies_page: { type: 'integer', minimum: 1, default: 1 },
          replies_limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Querystring: { include_replies?: boolean; replies_page?: number; replies_limit?: number } }>, reply: FastifyReply) => {
    const post = PostService.getById(request.params.id);
    
    if (!post) {
      return reply.code(404).send({
        success: false,
        error: 'Post not found',
      });
    }

    const result: any = {
      ...post,
      tags: post.tags ? JSON.parse(post.tags) : [],
    };

    if (request.query.include_replies !== false) {
      const { replies, total } = PostService.getReplies(request.params.id, {
        page: request.query.replies_page,
        limit: request.query.replies_limit,
      });
      result.replies = replies;
      result.replies_meta = {
        page: request.query.replies_page || 1,
        limit: request.query.replies_limit || 50,
        total,
      };
    }
    
    return {
      success: true,
      data: result,
    };
  });

  // Reply to a post
  fastify.post('/:id/reply', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Reply to a forum discussion',
      tags: ['Forum'],
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
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: 5000 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { content: string } }>, reply: FastifyReply) => {
    const post = PostService.getById(request.params.id);
    
    if (!post) {
      return reply.code(404).send({
        success: false,
        error: 'Post not found',
      });
    }

    try {
      const parsed = ReplyCreateSchema.parse(request.body);
      const replyObj = await PostService.addReply(request.params.id, request.agent!.id, parsed.content);

      return reply.code(201).send({
        success: true,
        data: replyObj,
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

  // Vote on a post
  fastify.post('/:id/vote', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Upvote or downvote a post',
      tags: ['Forum'],
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
        required: ['direction'],
        properties: {
          direction: { type: 'string', enum: ['up', 'down'] },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { direction: 'up' | 'down' } }>, reply: FastifyReply) => {
    await PostService.vote('post', request.params.id, request.body.direction);
    
    return {
      success: true,
      message: `Vote recorded: ${request.body.direction}`,
    };
  });

  // Get categories with counts
  fastify.get('/categories', {
    schema: {
      description: 'Get forum categories with post counts',
      tags: ['Forum'],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const categories = PostService.getCategories();
    
    return {
      success: true,
      data: categories,
    };
  });

  // Get trending posts
  fastify.get('/trending', {
    schema: {
      description: 'Get trending forum discussions',
      tags: ['Forum'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>, reply: FastifyReply) => {
    const trending = PostService.getTrending(request.query.limit || 10);
    
    const postsWithTags = trending.map(post => ({
      ...post,
      tags: post.tags ? JSON.parse(post.tags) : [],
    }));
    
    return {
      success: true,
      data: postsWithTags,
    };
  });
}
