import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TwitterService, TwitterCredentials } from '../services/twitter.service.ts';
import { authenticateAgent } from '../middleware/auth.ts';
import { z } from 'zod';

// Validation schemas
const TwitterCredentialsSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  accessToken: z.string().min(1),
  accessTokenSecret: z.string().min(1),
  handle: z.string().min(1).optional(),
  autoPost: z.boolean().default(false),
});

const TweetSchema = z.object({
  text: z.string().min(1).max(280),
  replyToTweetId: z.string().optional(),
});

const TwitterSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoPost: z.boolean().optional(),
  handle: z.string().min(1).optional(),
});

export async function twitterRoutes(fastify: FastifyInstance) {
  /**
   * POST /twitter_post - Post a tweet (tool endpoint)
   * This is the main tool endpoint for bots to tweet
   */
  fastify.post('/twitter_post', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Post a tweet to Twitter/X. This is the twitter_post tool for AI bots.',
      tags: ['Twitter'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 280,
            description: 'Tweet text (max 280 characters)',
          },
          replyToTweetId: { 
            type: 'string',
            description: 'Tweet ID to reply to (optional)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                tweetId: { type: 'string' },
                tweetUrl: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { text: string; replyToTweetId?: string } }>, reply: FastifyReply) => {
    try {
      const parsed = TweetSchema.parse(request.body);
      const result = await TwitterService.tweet(request.agent!.id, parsed);

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: result.error,
        });
      }

      return {
        success: true,
        data: {
          tweetId: result.tweetId,
          tweetUrl: result.tweetUrl,
        },
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

  /**
   * POST /config - Set up Twitter credentials
   */
  fastify.post('/config', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Configure Twitter API credentials for your agent',
      tags: ['Twitter'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret'],
        properties: {
          apiKey: { type: 'string', description: 'Twitter API Key' },
          apiSecret: { type: 'string', description: 'Twitter API Secret' },
          accessToken: { type: 'string', description: 'Twitter Access Token' },
          accessTokenSecret: { type: 'string', description: 'Twitter Access Token Secret' },
          handle: { type: 'string', description: 'Twitter handle (without @)' },
          autoPost: { type: 'boolean', description: 'Auto-post signals to Twitter', default: false },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: TwitterCredentials & { handle?: string; autoPost?: boolean } }>, reply: FastifyReply) => {
    try {
      const parsed = TwitterCredentialsSchema.parse(request.body);
      
      const credentials: TwitterCredentials = {
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
        accessToken: parsed.accessToken,
        accessTokenSecret: parsed.accessTokenSecret,
      };

      await TwitterService.setCredentials(
        request.agent!.id,
        credentials,
        parsed.handle || '',
        parsed.autoPost
      );

      return {
        success: true,
        message: 'Twitter configured successfully',
        data: TwitterService.getStatus(request.agent!.id),
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.code(400).send({
        success: false,
        error: error.message || 'Failed to configure Twitter',
      });
    }
  });

  /**
   * PUT /settings - Update Twitter settings
   */
  fastify.put('/settings', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Update Twitter settings (enable/disable, auto-post)',
      tags: ['Twitter'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'Enable/disable Twitter integration' },
          autoPost: { type: 'boolean', description: 'Auto-post signals to Twitter' },
          handle: { type: 'string', description: 'Twitter handle' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { enabled?: boolean; autoPost?: boolean; handle?: string } }>, reply: FastifyReply) => {
    try {
      const parsed = TwitterSettingsSchema.parse(request.body);
      await TwitterService.updateSettings(request.agent!.id, parsed);

      return {
        success: true,
        message: 'Twitter settings updated',
        data: TwitterService.getStatus(request.agent!.id),
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.code(400).send({
        success: false,
        error: error.message || 'Failed to update settings',
      });
    }
  });

  /**
   * GET /status - Get Twitter configuration status
   */
  fastify.get('/status', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Get Twitter configuration status for your agent',
      tags: ['Twitter'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      success: true,
      data: TwitterService.getStatus(request.agent!.id),
    };
  });

  /**
   * GET /history - Get tweet history
   */
  fastify.get('/history', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Get tweet history for your agent',
      tags: ['Twitter'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>, reply: FastifyReply) => {
    const limit = request.query.limit || 50;
    const history = TwitterService.getTweetHistory(request.agent!.id, limit);

    return {
      success: true,
      data: history,
      meta: {
        count: history.length,
      },
    };
  });

  /**
   * DELETE /config - Remove Twitter configuration
   */
  fastify.delete('/config', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Remove Twitter configuration for your agent',
      tags: ['Twitter'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    await TwitterService.removeConfig(request.agent!.id);

    return {
      success: true,
      message: 'Twitter configuration removed',
    };
  });
}
