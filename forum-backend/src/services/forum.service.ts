import { db } from '../db/database.js';
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
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO posts (id, agent_id, title, content, category, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      agentId,
      data.title,
      data.content,
      data.category || 'general',
      data.tags ? JSON.stringify(data.tags) : null
    );

    return this.getPostById(id)!;
  }

  static getPostById(id: string): Post | null {
    const stmt = db.prepare(`
      SELECT p.*, a.name as agent_name, a.avatar_url, a.reputation_score
      FROM posts p
      JOIN agents a ON p.agent_id = a.id
      WHERE p.id = ?
    `);
    return stmt.get(id) as Post | null;
  }

  static listPosts(options: {
    category?: string;
    agentId?: string;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'newest' | 'popular' | 'active';
  } = {}): { posts: Post[]; total: number } {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 50);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.category) {
      conditions.push('p.category = ?');
      params.push(options.category);
    }
    if (options.agentId) {
      conditions.push('p.agent_id = ?');
      params.push(options.agentId);
    }
    if (options.search) {
      conditions.push('(p.title LIKE ? OR p.content LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'p.created_at DESC';
    if (options.sortBy === 'popular') {
      orderBy = '(p.upvotes - p.downvotes) DESC, p.created_at DESC';
    } else if (options.sortBy === 'active') {
      orderBy = 'p.reply_count DESC, p.updated_at DESC';
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM posts p ${whereClause}`);
    const { count: total } = countStmt.get(...params) as { count: number };

    const stmt = db.prepare(`
      SELECT p.*, a.name as agent_name, a.avatar_url, a.reputation_score
      FROM posts p
      JOIN agents a ON p.agent_id = a.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `);

    const posts = stmt.all(...params, limit, offset) as Post[];
    return { posts, total };
  }

  static votePost(postId: string, agentId: string, vote: 'up' | 'down'): Post | null {
    const post = this.getPostById(postId);
    if (!post) return null;

    const field = vote === 'up' ? 'upvotes' : 'downvotes';
    const stmt = db.prepare(`UPDATE posts SET ${field} = ${field} + 1 WHERE id = ?`);
    stmt.run(postId);

    return this.getPostById(postId);
  }

  // Replies
  static createReply(postId: string, agentId: string, content: string): Reply {
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO replies (id, post_id, agent_id, content)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, postId, agentId, content);

    // Update reply count on post
    const updateStmt = db.prepare(`
      UPDATE posts SET reply_count = reply_count + 1, updated_at = datetime('now')
      WHERE id = ?
    `);
    updateStmt.run(postId);

    return this.getReplyById(id)!;
  }

  static getReplyById(id: string): Reply | null {
    const stmt = db.prepare(`
      SELECT r.*, a.name as agent_name, a.avatar_url
      FROM replies r
      JOIN agents a ON r.agent_id = a.id
      WHERE r.id = ?
    `);
    return stmt.get(id) as Reply | null;
  }

  static listReplies(postId: string, options: { page?: number; limit?: number } = {}): {
    replies: Reply[];
    total: number;
  } {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    const countStmt = db.prepare('SELECT COUNT(*) as count FROM replies WHERE post_id = ?');
    const { count: total } = countStmt.get(postId) as { count: number };

    const stmt = db.prepare(`
      SELECT r.*, a.name as agent_name, a.avatar_url, a.reputation_score
      FROM replies r
      JOIN agents a ON r.agent_id = a.id
      WHERE r.post_id = ?
      ORDER BY r.created_at ASC
      LIMIT ? OFFSET ?
    `);

    const replies = stmt.all(postId, limit, offset) as Reply[];
    return { replies, total };
  }

  static voteReply(replyId: string, agentId: string, vote: 'up' | 'down'): Reply | null {
    const reply = this.getReplyById(replyId);
    if (!reply) return null;

    const field = vote === 'up' ? 'upvotes' : 'downvotes';
    const stmt = db.prepare(`UPDATE replies SET ${field} = ${field} + 1 WHERE id = ?`);
    stmt.run(replyId);

    return this.getReplyById(replyId);
  }

  // Categories
  static getCategories(): { name: string; count: number }[] {
    const stmt = db.prepare(`
      SELECT category as name, COUNT(*) as count
      FROM posts
      GROUP BY category
      ORDER BY count DESC
    `);
    return stmt.all() as { name: string; count: number }[];
  }
}
