/**
 * Marketplace API Routes (Fastify Plugin)
 * Strategy marketplace with subscriptions
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { marketplaceService } from '../services/marketplace.service.ts';

export async function marketplaceRoutes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Get featured listings
  fastify.get('/featured', {
    schema: {
      description: 'Get featured marketplace listings',
      tags: ['Marketplace'],
      response: {
        200: {
          type: 'object',
          properties: {
            listings: { type: 'array' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const listings = await marketplaceService.getFeatured();
    return { listings };
  });

  // Get categories with counts
  fastify.get('/categories', {
    schema: {
      description: 'Get strategy categories with counts',
      tags: ['Marketplace']
    }
  }, async (request, reply) => {
    const categories = await marketplaceService.getCategories();
    return { categories };
  });

  // Get top sellers
  fastify.get('/sellers/top', {
    schema: {
      description: 'Get top strategy sellers',
      tags: ['Marketplace'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 10 }
        }
      }
    }
  }, async (request, reply) => {
    const { limit } = request.query as any;
    const sellers = await marketplaceService.getTopSellers(limit || 10);
    return { sellers };
  });

  // Get my subscriptions
  fastify.get('/me/subscriptions', {
    schema: {
      description: 'Get my strategy subscriptions',
      tags: ['Marketplace']
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const subscriptions = await marketplaceService.getMySubscriptions(agentId);
    return { subscriptions };
  });

  // Get seller dashboard
  fastify.get('/me/seller', {
    schema: {
      description: 'Get seller dashboard with stats',
      tags: ['Marketplace']
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const dashboard = await marketplaceService.getSellerDashboard(agentId);
    return dashboard;
  });

  // Browse marketplace
  fastify.get('/', {
    schema: {
      description: 'Browse marketplace listings',
      tags: ['Marketplace'],
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          priceType: { type: 'string', enum: ['free', 'one_time', 'subscription', 'revenue_share'] },
          minRating: { type: 'number', minimum: 1, maximum: 5 },
          search: { type: 'string' },
          sortBy: { type: 'string', enum: ['popular', 'rating', 'newest', 'price_low', 'price_high'] },
          limit: { type: 'number', default: 20 },
          offset: { type: 'number', default: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const query = request.query as any;
    return await marketplaceService.browseListings(query);
  });

  // Get listing by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get marketplace listing details',
      tags: ['Marketplace'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const listing = await marketplaceService.getListing(id);
    if (!listing) {
      return reply.code(404).send({ error: 'Listing not found' });
    }
    return listing;
  });

  // Create listing
  fastify.post('/', {
    schema: {
      description: 'Create a new marketplace listing',
      tags: ['Marketplace'],
      body: {
        type: 'object',
        required: ['strategyId', 'name', 'description', 'shortDescription', 'category', 'pricing'],
        properties: {
          strategyId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          shortDescription: { type: 'string' },
          category: { type: 'string', enum: ['scalping', 'swing', 'position', 'arbitrage', 'grid', 'dca', 'ai', 'other'] },
          assets: { type: 'array', items: { type: 'string' } },
          timeframes: { type: 'array', items: { type: 'string' } },
          pricing: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['free', 'one_time', 'subscription', 'revenue_share'] },
              price: { type: 'number' },
              monthlyPrice: { type: 'number' },
              yearlyPrice: { type: 'number' },
              revenueSharePercent: { type: 'number' },
              trialDays: { type: 'number' }
            }
          },
          documentation: { type: 'string' },
          screenshots: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const listing = await marketplaceService.createListing({
      ...(request.body as any),
      sellerId: agentId
    });
    return reply.code(201).send(listing);
  });

  // Subscribe to a listing
  fastify.post('/:id/subscribe', {
    schema: {
      description: 'Subscribe to a marketplace listing',
      tags: ['Marketplace'],
      body: {
        type: 'object',
        required: ['subscriptionType'],
        properties: {
          subscriptionType: { type: 'string', enum: ['one_time', 'monthly', 'yearly'] }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { id } = request.params as any;
    const { subscriptionType } = request.body as any;
    
    const result = await marketplaceService.subscribe(id, agentId, subscriptionType);
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    return reply.code(201).send(result.subscription);
  });

  // Cancel subscription
  fastify.delete('/subscriptions/:subscriptionId', {
    schema: {
      description: 'Cancel a subscription',
      tags: ['Marketplace']
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { subscriptionId } = request.params as any;
    const result = await marketplaceService.cancelSubscription(subscriptionId, agentId);
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    return { success: true };
  });

  // Add rating/review
  fastify.post('/:id/reviews', {
    schema: {
      description: 'Add a rating/review to a listing',
      tags: ['Marketplace'],
      body: {
        type: 'object',
        required: ['rating', 'title', 'review'],
        properties: {
          rating: { type: 'number', minimum: 1, maximum: 5 },
          title: { type: 'string' },
          review: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { id } = request.params as any;
    const { rating, title, review } = request.body as any;
    
    const result = await marketplaceService.addRating(id, agentId, rating, title, review);
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    return reply.code(201).send({ success: true });
  });
}
