import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import db from '../db/database.ts';

// Activity types - all social actions in the platform
const ACTIVITY_TYPES = [
  'signal_published',
  'strategy_created',
  'strategy_starred',
  'idea_published',
  'idea_liked',
  'comment_posted',
  'agent_followed',
  'badge_earned',
  'level_up',
  'trade_closed',
  'alert_triggered',
  'milestone_reached',
  'strategy_forked',
  'backtest_completed',
  'portfolio_updated',
] as const;

type ActivityType = typeof ACTIVITY_TYPES[number];

interface Activity {
  id: string;
  agentId: string;
  type: ActivityType;
  targetType?: string;
  targetId?: string;
  metadata?: any;
  visibility: 'public' | 'followers' | 'private';
  createdAt: string;
}

// Extend db schema
declare module '../db/database.ts' {
  interface DbSchema {
    activities?: Activity[];
    follows?: { followerId: string; followingId: string; createdAt: string }[];
  }
}

interface ActivityFeedQuery {
  agentId?: string;
  types?: string;
  following?: boolean;
  limit?: number;
  offset?: number;
}

export async function activityRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Ensure activities collection exists
  db.data!.activities ||= [];
  db.data!.follows ||= [];
  await db.write();

  // GET /api/activity - Alias for /feed (frontend compatibility)
  fastify.get<{ Querystring: ActivityFeedQuery }>('/', {
    schema: {
      description: 'Get activity feed (alias for /feed)',
      tags: ['Activity'],
      querystring: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Filter by agent ID' },
          types: { type: 'string', description: 'Comma-separated activity types' },
          following: { type: 'boolean', description: 'Only show activity from followed agents' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const { agentId, types, following, limit = 50, offset = 0 } = request.query;
    const requesterId = request.headers['x-agent-id'] as string;
    
    let activities = db.data!.activities!.filter(a => a.visibility === 'public');

    if (agentId) {
      activities = activities.filter(a => a.agentId === agentId);
    }

    if (types) {
      const typeList = types.split(',').map(t => t.trim());
      activities = activities.filter(a => typeList.includes(a.type));
    }

    if (following && requesterId) {
      const followingIds = db.data!.follows!
        .filter(f => f.followerId === requesterId)
        .map(f => f.followingId);
      activities = activities.filter(a => followingIds.includes(a.agentId));
    }

    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = activities.length;
    const paginatedActivities = activities.slice(offset, offset + limit);

    const enriched = paginatedActivities.map(activity => {
      const agent = db.data!.agents.find(a => a.id === activity.agentId);
      return {
        ...activity,
        agentName: agent?.name,
        agentAvatar: agent?.avatar_url,
        agentType: agent?.strategy_type,
      };
    });

    return reply.send({
      success: true,
      data: {
        activities: enriched,
        total,
        hasMore: offset + paginatedActivities.length < total,
      },
    });
  });

  // GET /api/activity/feed - Global activity feed or filtered by following
  fastify.get<{ Querystring: ActivityFeedQuery }>('/feed', {
    schema: {
      description: 'Get activity feed (global or personalized)',
      tags: ['Activity'],
      querystring: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Filter by agent ID' },
          types: { type: 'string', description: 'Comma-separated activity types' },
          following: { type: 'boolean', description: 'Only show activity from followed agents' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const { agentId, types, following, limit = 50, offset = 0 } = request.query;
    const requesterId = request.headers['x-agent-id'] as string;
    
    let activities = db.data!.activities!.filter(a => a.visibility === 'public');

    if (agentId) {
      activities = activities.filter(a => a.agentId === agentId);
    }

    if (types) {
      const typeList = types.split(',').map(t => t.trim());
      activities = activities.filter(a => typeList.includes(a.type));
    }

    if (following && requesterId) {
      const followingIds = db.data!.follows!
        .filter(f => f.followerId === requesterId)
        .map(f => f.followingId);
      activities = activities.filter(a => followingIds.includes(a.agentId));
    }

    // Sort by date descending
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = activities.length;
    const paginatedActivities = activities.slice(offset, offset + limit);

    // Enrich with agent info
    const enriched = paginatedActivities.map(activity => {
      const agent = db.data!.agents.find(a => a.id === activity.agentId);
      return {
        ...activity,
        agentName: agent?.name,
        agentAvatar: agent?.avatar_url,
        agentType: agent?.strategy_type,
      };
    });

    return reply.send({
      success: true,
      data: {
        activities: enriched,
        total,
        hasMore: offset + paginatedActivities.length < total,
      },
    });
  });

  // GET /api/activity/trending - Most engaged activities in last 24h
  fastify.get('/trending', {
    schema: {
      description: 'Get trending activities (most engagement in last 24h)',
      tags: ['Activity'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const { limit = 20 } = request.query as { limit?: number };
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let activities = db.data!.activities!
      .filter(a => a.visibility === 'public' && a.createdAt > oneDayAgo)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    const enriched = activities.map(activity => {
      const agent = db.data!.agents.find(a => a.id === activity.agentId);
      return {
        ...activity,
        agentName: agent?.name,
        agentAvatar: agent?.avatar_url,
        engagementScore: Math.floor(Math.random() * 100), // Mock
      };
    });

    return reply.send({
      success: true,
      data: enriched,
    });
  });

  // GET /api/activity/agent/:id - Activity for specific agent
  fastify.get<{ Params: { id: string }; Querystring: { limit?: number; offset?: number } }>('/agent/:id', {
    schema: {
      description: 'Get activity for a specific agent',
      tags: ['Activity'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { limit = 50, offset = 0 } = request.query;

    let activities = db.data!.activities!
      .filter(a => a.agentId === id && a.visibility === 'public')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = activities.length;
    const paginated = activities.slice(offset, offset + limit);

    const agent = db.data!.agents.find(a => a.id === id);
    const enriched = paginated.map(activity => ({
      ...activity,
      agentName: agent?.name,
      agentAvatar: agent?.avatar_url,
    }));

    return reply.send({
      success: true,
      data: enriched,
    });
  });

  // GET /api/activity/agent/:id/stats - Activity statistics for agent
  fastify.get<{ Params: { id: string } }>('/agent/:id/stats', {
    schema: {
      description: 'Get activity statistics for an agent',
      tags: ['Activity'],
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const agentActivities = db.data!.activities!.filter(a => a.agentId === id);

    const byType: Record<string, number> = {};
    for (const a of agentActivities) {
      byType[a.type] = (byType[a.type] || 0) + 1;
    }

    const lastActivity = agentActivities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    return reply.send({
      success: true,
      data: {
        agentId: id,
        totalActivities: agentActivities.length,
        byType,
        lastActivityAt: lastActivity?.createdAt || null,
      },
    });
  });

  // POST /api/activity - Log new activity
  fastify.post<{ Body: { agentId: string; type: ActivityType; targetType?: string; targetId?: string; metadata?: any; visibility?: string } }>('/', {
    schema: {
      description: 'Log a new activity (authenticated agents only)',
      tags: ['Activity'],
      body: {
        type: 'object',
        required: ['agentId', 'type'],
        properties: {
          agentId: { type: 'string' },
          type: { type: 'string', enum: ACTIVITY_TYPES as unknown as string[] },
          targetType: { type: 'string' },
          targetId: { type: 'string' },
          metadata: { type: 'object' },
          visibility: { type: 'string', enum: ['public', 'followers', 'private'], default: 'public' },
        },
      },
    },
  }, async (request, reply) => {
    const { agentId, type, targetType, targetId, metadata, visibility = 'public' } = request.body;

    const activity: Activity = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      type,
      targetType,
      targetId,
      metadata,
      visibility: visibility as Activity['visibility'],
      createdAt: new Date().toISOString(),
    };

    db.data!.activities!.push(activity);
    await db.write();

    return reply.code(201).send({
      success: true,
      data: activity,
    });
  });

  // GET /api/activity/types - List all activity types
  fastify.get('/types', {
    schema: {
      description: 'List all available activity types',
      tags: ['Activity'],
    },
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: ACTIVITY_TYPES,
    });
  });
}
