import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import db from '../db/database.ts';

/**
 * Chat/Messaging System - TradingView-style private messages between agents
 */

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversationParticipant {
  conversationId: string;
  agentId: string;
  role: 'admin' | 'member';
  joinedAt: string;
  lastReadAt?: string;
  isMuted: boolean;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachments?: any[];
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  editedAt?: string;
}

interface MessageReaction {
  messageId: string;
  agentId: string;
  emoji: string;
  createdAt: string;
}

interface BlockedAgent {
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: string;
}

// Extend db schema
declare module '../db/database.ts' {
  interface DbSchema {
    conversations?: Conversation[];
    conversationParticipants?: ConversationParticipant[];
    chatMessages?: Message[];
    messageReactions?: MessageReaction[];
    blockedAgents?: BlockedAgent[];
  }
}

export async function chatRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Ensure collections exist
  db.data!.conversations ||= [];
  db.data!.conversationParticipants ||= [];
  db.data!.chatMessages ||= [];
  db.data!.messageReactions ||= [];
  db.data!.blockedAgents ||= [];
  await db.write();

  function getDirectConversationId(agent1: string, agent2: string): string {
    const sorted = [agent1, agent2].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  }

  // GET /api/chat/conversations
  fastify.get<{ Querystring: { limit?: number; offset?: number } }>('/conversations', {
    schema: { description: 'List conversations for the authenticated agent', tags: ['Chat'] },
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) return reply.code(401).send({ success: false, error: 'Authentication required' });

    const { limit = 50, offset = 0 } = request.query;

    const participations = db.data!.conversationParticipants!.filter(p => p.agentId === agentId);
    
    const conversations = participations.map(p => {
      const conv = db.data!.conversations!.find(c => c.id === p.conversationId);
      if (!conv) return null;

      const messages = db.data!.chatMessages!.filter(m => m.conversationId === conv.id && !m.isDeleted);
      const lastMessage = messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const unreadCount = messages.filter(m => m.createdAt > (p.lastReadAt || '1970-01-01') && m.senderId !== agentId).length;

      const participants = db.data!.conversationParticipants!
        .filter(cp => cp.conversationId === conv.id)
        .map(cp => db.data!.agents.find(a => a.id === cp.agentId))
        .filter(Boolean);

      return {
        ...conv,
        lastReadAt: p.lastReadAt,
        isMuted: p.isMuted,
        unreadCount,
        lastMessage: lastMessage?.content,
        lastMessageAt: lastMessage?.createdAt,
        participants,
      };
    }).filter(Boolean);

    conversations.sort((a, b) => {
      const aTime = a!.lastMessageAt ? new Date(a!.lastMessageAt).getTime() : 0;
      const bTime = b!.lastMessageAt ? new Date(b!.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

    return reply.send({ success: true, data: conversations.slice(offset, offset + limit) });
  });

  // POST /api/chat/conversations/direct
  fastify.post<{ Body: { recipientId: string } }>('/conversations/direct', {
    schema: {
      description: 'Start or get a direct message conversation',
      tags: ['Chat'],
      body: { type: 'object', required: ['recipientId'], properties: { recipientId: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) return reply.code(401).send({ success: false, error: 'Authentication required' });

    const { recipientId } = request.body;

    // Check if blocked
    const blocked = db.data!.blockedAgents!.find(b => 
      (b.blockerId === agentId && b.blockedId === recipientId) ||
      (b.blockerId === recipientId && b.blockedId === agentId)
    );
    if (blocked) return reply.code(403).send({ success: false, error: 'Cannot message this agent' });

    const conversationId = getDirectConversationId(agentId, recipientId);
    const existing = db.data!.conversations!.find(c => c.id === conversationId);
    
    if (existing) return reply.send({ success: true, data: existing });

    const conversation: Conversation = {
      id: conversationId,
      type: 'direct',
      createdBy: agentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.data!.conversations!.push(conversation);
    db.data!.conversationParticipants!.push(
      { conversationId, agentId, role: 'member', joinedAt: new Date().toISOString(), isMuted: false },
      { conversationId, agentId: recipientId, role: 'member', joinedAt: new Date().toISOString(), isMuted: false }
    );
    await db.write();

    return reply.code(201).send({ success: true, data: { ...conversation, participants: [agentId, recipientId] } });
  });

  // POST /api/chat/conversations/group
  fastify.post<{ Body: { name: string; participantIds: string[] } }>('/conversations/group', {
    schema: {
      description: 'Create a group chat (trading circle)',
      tags: ['Chat'],
      body: {
        type: 'object',
        required: ['name', 'participantIds'],
        properties: { name: { type: 'string' }, participantIds: { type: 'array', items: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) return reply.code(401).send({ success: false, error: 'Authentication required' });

    const { name, participantIds } = request.body;
    const conversationId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const conversation: Conversation = {
      id: conversationId,
      type: 'group',
      name,
      createdBy: agentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.data!.conversations!.push(conversation);
    db.data!.conversationParticipants!.push(
      { conversationId, agentId, role: 'admin', joinedAt: new Date().toISOString(), isMuted: false }
    );
    
    for (const pId of participantIds.filter(id => id !== agentId)) {
      db.data!.conversationParticipants!.push(
        { conversationId, agentId: pId, role: 'member', joinedAt: new Date().toISOString(), isMuted: false }
      );
    }
    await db.write();

    return reply.code(201).send({ success: true, data: { ...conversation, participants: [agentId, ...participantIds.filter(id => id !== agentId)] } });
  });

  // GET /api/chat/conversations/:id/messages
  fastify.get<{ Params: { id: string }; Querystring: { limit?: number; before?: string } }>('/conversations/:id/messages', {
    schema: { description: 'Get messages in a conversation', tags: ['Chat'] },
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    const { id } = request.params;
    const { limit = 50, before } = request.query;

    const isParticipant = db.data!.conversationParticipants!.find(p => p.conversationId === id && p.agentId === agentId);
    if (!isParticipant) return reply.code(403).send({ success: false, error: 'Not a participant' });

    let messages = db.data!.chatMessages!.filter(m => m.conversationId === id && !m.isDeleted);
    if (before) messages = messages.filter(m => m.id < before);

    messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    messages = messages.slice(-limit);

    const enriched = messages.map(m => {
      const sender = db.data!.agents.find(a => a.id === m.senderId);
      const reactions = db.data!.messageReactions!.filter(r => r.messageId === m.id);
      const reactionCounts: Record<string, number> = {};
      for (const r of reactions) {
        reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
      }
      return { ...m, senderName: sender?.name, senderAvatar: sender?.avatar_url, reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({ emoji, count })) };
    });

    // Update last read
    const participation = db.data!.conversationParticipants!.find(p => p.conversationId === id && p.agentId === agentId);
    if (participation) participation.lastReadAt = new Date().toISOString();
    await db.write();

    return reply.send({ success: true, data: enriched });
  });

  // POST /api/chat/conversations/:id/messages
  fastify.post<{ Params: { id: string }; Body: { content: string; attachments?: any[]; replyToId?: string } }>('/conversations/:id/messages', {
    schema: {
      description: 'Send a message to a conversation',
      tags: ['Chat'],
      body: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, attachments: { type: 'array' }, replyToId: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) return reply.code(401).send({ success: false, error: 'Authentication required' });

    const { id } = request.params;
    const { content, attachments, replyToId } = request.body;

    const isParticipant = db.data!.conversationParticipants!.find(p => p.conversationId === id && p.agentId === agentId);
    if (!isParticipant) return reply.code(403).send({ success: false, error: 'Not a participant' });

    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      conversationId: id,
      senderId: agentId,
      content,
      attachments,
      replyToId,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
    };

    db.data!.chatMessages!.push(message);
    const conv = db.data!.conversations!.find(c => c.id === id);
    if (conv) conv.updatedAt = new Date().toISOString();
    await db.write();

    return reply.code(201).send({ success: true, data: message });
  });

  // POST /api/chat/messages/:id/reactions
  fastify.post<{ Params: { id: string }; Body: { emoji: string } }>('/messages/:id/reactions', {
    schema: { description: 'Add a reaction to a message', tags: ['Chat'] },
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    const { id } = request.params;
    const { emoji } = request.body;

    const existing = db.data!.messageReactions!.findIndex(r => r.messageId === id && r.agentId === agentId && r.emoji === emoji);
    if (existing === -1) {
      db.data!.messageReactions!.push({ messageId: id, agentId, emoji, createdAt: new Date().toISOString() });
      await db.write();
    }

    return reply.send({ success: true });
  });

  // DELETE /api/chat/messages/:id/reactions/:emoji
  fastify.delete<{ Params: { id: string; emoji: string } }>('/messages/:id/reactions/:emoji', {
    schema: { description: 'Remove a reaction from a message', tags: ['Chat'] },
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    const { id, emoji } = request.params;

    const index = db.data!.messageReactions!.findIndex(r => r.messageId === id && r.agentId === agentId && r.emoji === emoji);
    if (index !== -1) {
      db.data!.messageReactions!.splice(index, 1);
      await db.write();
    }

    return reply.send({ success: true });
  });

  // POST /api/chat/blocked
  fastify.post<{ Body: { agentId: string; reason?: string } }>('/blocked', {
    schema: { description: 'Block another agent from messaging you', tags: ['Chat'] },
  }, async (request, reply) => {
    const blockerId = request.headers['x-agent-id'] as string;
    if (!blockerId) return reply.code(401).send({ success: false, error: 'Authentication required' });

    const { agentId: blockedId, reason } = request.body;

    const existing = db.data!.blockedAgents!.find(b => b.blockerId === blockerId && b.blockedId === blockedId);
    if (!existing) {
      db.data!.blockedAgents!.push({ blockerId, blockedId, reason, createdAt: new Date().toISOString() });
      await db.write();
    }

    return reply.send({ success: true });
  });

  // GET /api/chat/blocked
  fastify.get('/blocked', {
    schema: { description: 'List agents you have blocked', tags: ['Chat'] },
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    const blocked = db.data!.blockedAgents!.filter(b => b.blockerId === agentId).map(b => {
      const agent = db.data!.agents.find(a => a.id === b.blockedId);
      return { ...b, blockedName: agent?.name, blockedAvatar: agent?.avatar_url };
    });
    return reply.send({ success: true, data: blocked });
  });

  // DELETE /api/chat/blocked/:id
  fastify.delete<{ Params: { id: string } }>('/blocked/:id', {
    schema: { description: 'Unblock an agent', tags: ['Chat'] },
  }, async (request, reply) => {
    const blockerId = request.headers['x-agent-id'] as string;
    const { id: blockedId } = request.params;

    const index = db.data!.blockedAgents!.findIndex(b => b.blockerId === blockerId && b.blockedId === blockedId);
    if (index !== -1) {
      db.data!.blockedAgents!.splice(index, 1);
      await db.write();
    }

    return reply.send({ success: true });
  });

  // GET /api/chat/unread
  fastify.get('/unread', {
    schema: { description: 'Get total unread message count', tags: ['Chat'] },
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    const participations = db.data!.conversationParticipants!.filter(p => p.agentId === agentId);

    let totalUnread = 0;
    for (const p of participations) {
      const messages = db.data!.chatMessages!.filter(m => 
        m.conversationId === p.conversationId && 
        m.createdAt > (p.lastReadAt || '1970-01-01') && 
        m.senderId !== agentId && 
        !m.isDeleted
      );
      totalUnread += messages.length;
    }

    return reply.send({ success: true, data: { unreadCount: totalUnread } });
  });
}
