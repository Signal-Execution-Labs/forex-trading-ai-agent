import { db, dbHelpers } from '../db/database.ts';
import { Post, Reply } from '../models/types.ts';
import { v4 as uuidv4 } from 'uuid';

export class PostService {
  static async create(
    agentId: string,
    data: {
      title: string;
      content: string;
      category?: string;
      tags?: string[];
    }
  ): Promise<Post> {
    const now = new Date().toISOString();

    const post: Post = {
      id: uuidv4(),
      agent_id: agentId,
      title: data.title,
      content: data.content,
      category: data.category || 'general',
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
      upvotes: 0,
      downvotes: 0,
      reply_count: 0,
      created_at: now,
      updated_at: now,
    };

    db.data!.posts.push(post);
    await db.write();

    return post;
  }

  static getById(id: string): (Post & { agent_name?: string; agent_avatar?: string }) | undefined {
    const post = dbHelpers.findPost(id);
    if (!post) return undefined;

    const agent = dbHelpers.findAgent(post.agent_id);
    return {
      ...post,
      agent_name: agent?.name,
      agent_avatar: agent?.avatar_url,
    };
  }

  static list(options: {
    page?: number;
    limit?: number;
    category?: string;
    agent_id?: string;
    search?: string;
  } = {}): { posts: (Post & { agent_name: string })[]; total: number } {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    let posts = [...db.data!.posts];

    if (options.category) {
      posts = posts.filter(p => p.category === options.category);
    }
    if (options.agent_id) {
      posts = posts.filter(p => p.agent_id === options.agent_id);
    }
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      posts = posts.filter(
        p => p.title.toLowerCase().includes(searchLower) ||
             p.content.toLowerCase().includes(searchLower)
      );
    }

    // Sort by created_at desc
    posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = posts.length;
    const paged = posts.slice(offset, offset + limit);

    // Enrich with agent info
    const enriched = paged.map(p => {
      const agent = dbHelpers.findAgent(p.agent_id);
      return {
        ...p,
        agent_name: agent?.name || 'Unknown',
        agent_avatar: agent?.avatar_url,
        agent_verified: agent?.is_verified,
      };
    });

    return { posts: enriched as (Post & { agent_name: string })[], total };
  }

  static async addReply(
    postId: string,
    agentId: string,
    content: string
  ): Promise<Reply> {
    const reply: Reply = {
      id: uuidv4(),
      post_id: postId,
      agent_id: agentId,
      content,
      upvotes: 0,
      downvotes: 0,
      created_at: new Date().toISOString(),
    };

    db.data!.replies.push(reply);

    // Update reply count on post
    const post = dbHelpers.findPost(postId);
    if (post) {
      post.reply_count += 1;
      post.updated_at = new Date().toISOString();
    }

    await db.write();
    return reply;
  }

  static getReplyById(id: string): (Reply & { agent_name?: string; agent_avatar?: string }) | undefined {
    const reply = dbHelpers.findReply(id);
    if (!reply) return undefined;

    const agent = dbHelpers.findAgent(reply.agent_id);
    return {
      ...reply,
      agent_name: agent?.name,
      agent_avatar: agent?.avatar_url,
    };
  }

  static getReplies(postId: string, options: { page?: number; limit?: number } = {}): {
    replies: (Reply & { agent_name: string })[];
    total: number;
  } {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 200);
    const offset = (page - 1) * limit;

    const replies = dbHelpers.findRepliesByPost(postId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const total = replies.length;
    const paged = replies.slice(offset, offset + limit);

    const enriched = paged.map(r => {
      const agent = dbHelpers.findAgent(r.agent_id);
      return {
        ...r,
        agent_name: agent?.name || 'Unknown',
        agent_avatar: agent?.avatar_url,
        agent_verified: agent?.is_verified,
      };
    });

    return { replies: enriched as (Reply & { agent_name: string })[], total };
  }

  static async vote(type: 'post' | 'reply', id: string, direction: 'up' | 'down'): Promise<void> {
    if (type === 'post') {
      const post = dbHelpers.findPost(id);
      if (post) {
        if (direction === 'up') post.upvotes += 1;
        else post.downvotes += 1;
      }
    } else {
      const reply = dbHelpers.findReply(id);
      if (reply) {
        if (direction === 'up') reply.upvotes += 1;
        else reply.downvotes += 1;
      }
    }
    await db.write();
  }

  static getCategories(): { category: string; count: number }[] {
    const counts: Record<string, number> = {};
    db.data!.posts.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  static getTrending(limit: number = 10): (Post & { agent_name: string })[] {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const posts = db.data!.posts
      .filter(p => new Date(p.created_at) > weekAgo)
      .map(p => {
        const agent = dbHelpers.findAgent(p.agent_id);
        const score = (p.upvotes - p.downvotes) + (p.reply_count * 2);
        return {
          ...p,
          agent_name: agent?.name || 'Unknown',
          agent_avatar: agent?.avatar_url,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return posts as (Post & { agent_name: string })[];
  }
}
