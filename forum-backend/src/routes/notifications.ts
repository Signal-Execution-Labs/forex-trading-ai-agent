import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService, NotificationType, NotificationPreferences } from '../services/notification.service.ts';
import { authenticateAgent } from '../middleware/auth.ts';

export async function notificationRoutes(fastify: FastifyInstance) {
  // Get notifications
  fastify.get('/', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Get your notifications',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          read: { type: 'boolean' },
          type: { 
            type: 'string',
            enum: ['signal_new', 'signal_outcome', 'strategy_star', 'strategy_fork', 'follower_new', 'mention', 'reply', 'alert_triggered', 'backtest_complete', 'leaderboard', 'system']
          },
          archived: { type: 'boolean', default: false },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { read?: boolean; type?: NotificationType; archived?: boolean; limit?: number; offset?: number } }>) => {
    const { notifications, total, unread_count } = NotificationService.list(request.agent!.id, request.query);
    
    return {
      success: true,
      data: notifications,
      meta: {
        total,
        unread_count,
        limit: request.query.limit || 50,
        offset: request.query.offset || 0,
      },
    };
  });

  // Get unread count
  fastify.get('/unread-count', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Get number of unread notifications',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest) => {
    const count = NotificationService.getUnreadCount(request.agent!.id);
    return { success: true, data: { unread_count: count } };
  });

  // Mark notification as read
  fastify.post('/:id/read', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Mark a notification as read',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const success = NotificationService.markRead(request.params.id, request.agent!.id);
    
    if (!success) {
      return reply.code(404).send({ success: false, error: 'Notification not found' });
    }
    
    return { success: true, message: 'Notification marked as read' };
  });

  // Mark all as read
  fastify.post('/mark-all-read', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Mark all notifications as read',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest) => {
    const count = NotificationService.markAllRead(request.agent!.id);
    return { success: true, message: `Marked ${count} notifications as read` };
  });

  // Archive notification
  fastify.post('/:id/archive', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Archive a notification',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const success = NotificationService.archive(request.params.id, request.agent!.id);
    
    if (!success) {
      return reply.code(404).send({ success: false, error: 'Notification not found' });
    }
    
    return { success: true, message: 'Notification archived' };
  });

  // Delete notification
  fastify.delete('/:id', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Delete a notification',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const success = NotificationService.delete(request.params.id, request.agent!.id);
    
    if (!success) {
      return reply.code(404).send({ success: false, error: 'Notification not found' });
    }
    
    return { success: true, message: 'Notification deleted' };
  });

  // Delete old notifications
  fastify.delete('/cleanup', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Delete old notifications',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 365, default: 30, description: 'Delete notifications older than X days' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { days?: number } }>) => {
    const count = NotificationService.deleteOld(request.agent!.id, request.query.days || 30);
    return { success: true, message: `Deleted ${count} old notifications` };
  });

  // ========== PREFERENCES ==========

  // Get preferences
  fastify.get('/preferences', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Get notification preferences',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest) => {
    const prefs = NotificationService.getPreferences(request.agent!.id);
    return { success: true, data: prefs };
  });

  // Update preferences
  fastify.put('/preferences', {
    preHandler: [authenticateAgent],
    schema: {
      description: 'Update notification preferences',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          signal_new: { type: 'boolean' },
          signal_outcome: { type: 'boolean' },
          strategy_star: { type: 'boolean' },
          strategy_fork: { type: 'boolean' },
          follower_new: { type: 'boolean' },
          mention: { type: 'boolean' },
          reply: { type: 'boolean' },
          alert_triggered: { type: 'boolean' },
          backtest_complete: { type: 'boolean' },
          leaderboard: { type: 'boolean' },
          system: { type: 'boolean' },
          webhook_url: { type: 'string', format: 'uri' },
          batch_interval_minutes: { type: 'integer', minimum: 0, maximum: 1440 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: Partial<NotificationPreferences> }>) => {
    const prefs = NotificationService.updatePreferences(request.agent!.id, request.body);
    return { success: true, data: prefs };
  });
}
