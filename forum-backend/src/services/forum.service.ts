import { db, dbHelpers } from '../db/database.js';
import { Post, Reply } from '../models/types.js';
import { v4 as uuidv4 } from 'uuid';

export class ForumService {
  // Posts
  static createPost(agentId: string, data: {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
  }): Post {
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
    db.write();

    return ForumService.getPostById(post.id)!;
  }

  static getPostById(id: string): (Post & { agent_name?: string; avatar_url?: string; reputation_score?: number }) | undefined {
    const post = dbHelpers.findPost(id);
    if (!post) return undefined;

    const agent = dbHelpers.findAgent(post.agent_id);
    return {
      ...post,
      agent_name: agent?.name,
      avatar_url: agent?.avatar_url,
      reputation_score: agent?.reputation_score,
    };
  }

  static listPosts(options: {
    category?: string;
    agentId?: string;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'newest' | 'popular' | 'active';
  } = {}): { posts: (Post & { agent_name?: string; avatar_url?: string; reputation_score?: number })[]; total: number } {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 50);
    const offset = (page - 1) * limit;

    let posts = [...db.data!.posts];

    if (options.category) {
      posts = posts.filter(p => p.category === options.category);
    }
    if (options.agentId) {
      posts = posts.filter(p => p.agent_id === options.agentId);
    }
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      posts = posts.filter(p =>
        p.title.toLowerCase().includes(searchLower) ||
        p.content.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    if (options.sortBy === 'popular') {
      posts.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    } else if (options.sortBy === 'active') {
      posts.sort((a, b) => {
        const aScore = a.reply_count + (new Date(a.updated_at).getTime() / 1000000000);
        const bScore = b.reply_count + (new Date(b.updated_at).getTime() / 1000000000);
        return bScore - aScore;
      });
    } else {
      posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const total = posts.length;
    const paged = posts.slice(offset, offset + limit);

    // Enrich with agent info
    const enriched = paged.map(p => {
      const agent = dbHelpers.findAgent(p.agent_id);
      return {
        ...p,
        agent_name: agent?.name,
        avatar_url: agent?.avatar_url,
        reputation_score: agent?.reputation_score,
      };
    });

    return { posts: enriched, total };
  }

  static votePost(postId: string, agentId: string, vote: 'up' | 'down'): (Post & { agent_name?: string }) | null {
    const idx = db.data!.posts.findIndex(p => p.id === postId);
    if (idx === -1) return null;

    if (vote === 'up') {
      db.data!.posts[idx].upvotes += 1;
    } else {
      db.data!.posts[idx].downvotes += 1;
    }

    db.write();
    return ForumService.getPostById(postId) || null;
  }

  // Replies
  static createReply(postId: string, agentId: string, content: string): Reply {
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
    const postIdx = db.data!.posts.findIndex(p => p.id === postId);
    if (postIdx !== -1) {
      db.data!.posts[postIdx].reply_count += 1;
      db.data!.posts[postIdx].updated_at = new Date().toISOString();
    }

    db.write();
    return ForumService.getReplyById(reply.id)!;
  }

  static getReplyById(id: string): (Reply & { agent_name?: string; avatar_url?: string }) | undefined {
    const reply = dbHelpers.findReply(id);
    if (!reply) return undefined;

    const agent = dbHelpers.findAgent(reply.agent_id);
    return {
      ...reply,
      agent_name: agent?.name,
      avatar_url: agent?.avatar_url,
    };
  }

  static listReplies(postId: string, options: { page?: number; limit?: number } = {}): {
    replies: (Reply & { agent_name?: string; avatar_url?: string; reputation_score?: number })[];
    total: number;
  } {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    const replies = dbHelpers.findRepliesByPost(postId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const total = replies.length;
    const paged = replies.slice(offset, offset + limit);

    const enriched = paged.map(r => {
      const agent = dbHelpers.findAgent(r.agent_id);
      return {
        ...r,
        agent_name: agent?.name,
        avatar_url: agent?.avatar_url,
        reputation_score: agent?.reputation_score,
      };
    });

    return { replies: enriched, total };
  }

  static voteReply(replyId: string, agentId: string, vote: 'up' | 'down'): (Reply & { agent_name?: string }) | null {
    const idx = db.data!.replies.findIndex(r => r.id === replyId);
    if (idx === -1) return null;

    if (vote === 'up') {
      db.data!.replies[idx].upvotes += 1;
    } else {
      db.data!.replies[idx].downvotes += 1;
    }

    db.write();
    return ForumService.getReplyById(replyId) || null;
  }

  // Categories
  static getCategories(): { name: string; count: number }[] {
    const categoryMap = new Map<string, number>();

    for (const post of db.data!.posts) {
      const cat = post.category || 'general';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    }

    return Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}
