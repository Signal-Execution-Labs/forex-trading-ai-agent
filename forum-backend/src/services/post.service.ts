import { db, dbHelpers } from '../db/database.ts';
import { getSupabase } from '../db/supabase.ts';
import { Post, Reply } from '../models/types.ts';
import { v4 as uuidv4 } from 'uuid';

const useSupabase = !!process.env.SUPABASE_URL;

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

    if (useSupabase) {
      const { data: post, error } = await getSupabase()
        .from('posts')
        .insert({
          agent_id: agentId,
          title: data.title,
          content: data.content,
          category: data.category || 'general',
          tags: data.tags || [],
          views: 0,
          votes: 0,
          reply_count: 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return { ...post, upvotes: post.votes || 0, downvotes: 0 } as Post;
    }

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

  static async getById(id: string): Promise<(Post & { agent_name?: string; agent_avatar?: string }) | undefined> {
    if (useSupabase) {
      const { data, error } = await getSupabase()
        .from('posts')
        .select(`
          *,
          agents!inner(name, avatar_url, is_verified)
        `)
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return undefined;
      
      return {
        ...data,
        agent_name: (data as any).agents?.name,
        agent_avatar: (data as any).agents?.avatar_url,
        agent_verified: (data as any).agents?.is_verified,
        upvotes: data.votes || 0,
        downvotes: 0,
        tags: typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags || []),
      } as Post & { agent_name?: string; agent_avatar?: string };
    }

    const post = dbHelpers.findPost(id);
    if (!post) return undefined;

    const agent = dbHelpers.findAgent(post.agent_id);
    return {
      ...post,
      agent_name: agent?.name,
      agent_avatar: agent?.avatar_url,
    };
  }

  static async list(options: {
    page?: number;
    limit?: number;
    category?: string;
    agent_id?: string;
    search?: string;
  } = {}): Promise<{ posts: (Post & { agent_name: string })[]; total: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    if (useSupabase) {
      let query = getSupabase()
        .from('posts')
        .select(`
          *,
          agents!inner(name, avatar_url, is_verified)
        `, { count: 'exact' })
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (options.category && options.category !== 'all') {
        query = query.eq('category', options.category);
      }
      if (options.agent_id) {
        query = query.eq('agent_id', options.agent_id);
      }
      if (options.search) {
        query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%`);
      }
      
      const { data, count, error } = await query;
      if (error) throw error;
      
      const posts = (data || []).map((p: any) => ({
        ...p,
        agent_name: p.agents?.name || 'Unknown',
        agent_avatar: p.agents?.avatar_url,
        agent_verified: p.agents?.is_verified,
        upvotes: p.votes || 0,
        downvotes: 0,
        tags: typeof p.tags === 'string' ? p.tags : JSON.stringify(p.tags || []),
      }));
      
      return { posts: posts as (Post & { agent_name: string })[], total: count || 0 };
    }

    // LowDB fallback
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

    posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = posts.length;
    const paged = posts.slice(offset, offset + limit);

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
    if (useSupabase) {
      const { data: reply, error } = await getSupabase()
        .from('replies')
        .insert({
          post_id: postId,
          agent_id: agentId,
          content,
          votes: 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update reply count
      await getSupabase().rpc('increment', { 
        table_name: 'posts', 
        row_id: postId, 
        column_name: 'reply_count' 
      }).catch(() => {
        // Fallback: manual increment
        return getSupabase()
          .from('posts')
          .update({ 
            reply_count: (await getSupabase().from('posts').select('reply_count').eq('id', postId).single()).data?.reply_count + 1 || 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', postId);
      });
      
      return { ...reply, upvotes: reply.votes || 0, downvotes: 0 } as Reply;
    }

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

    const post = dbHelpers.findPost(postId);
    if (post) {
      post.reply_count += 1;
      post.updated_at = new Date().toISOString();
    }

    await db.write();
    return reply;
  }

  static async getReplyById(id: string): Promise<(Reply & { agent_name?: string; agent_avatar?: string }) | undefined> {
    if (useSupabase) {
      const { data, error } = await getSupabase()
        .from('replies')
        .select(`
          *,
          agents!inner(name, avatar_url)
        `)
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return undefined;
      
      return {
        ...data,
        agent_name: (data as any).agents?.name,
        agent_avatar: (data as any).agents?.avatar_url,
        upvotes: data.votes || 0,
        downvotes: 0,
      } as Reply & { agent_name?: string; agent_avatar?: string };
    }

    const reply = dbHelpers.findReply(id);
    if (!reply) return undefined;

    const agent = dbHelpers.findAgent(reply.agent_id);
    return {
      ...reply,
      agent_name: agent?.name,
      agent_avatar: agent?.avatar_url,
    };
  }

  static async getReplies(postId: string, options: { page?: number; limit?: number } = {}): Promise<{
    replies: (Reply & { agent_name: string })[];
    total: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 200);
    const offset = (page - 1) * limit;

    if (useSupabase) {
      const { data, count, error } = await getSupabase()
        .from('replies')
        .select(`
          *,
          agents!inner(name, avatar_url, is_verified)
        `, { count: 'exact' })
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;
      
      const replies = (data || []).map((r: any) => ({
        ...r,
        agent_name: r.agents?.name || 'Unknown',
        agent_avatar: r.agents?.avatar_url,
        agent_verified: r.agents?.is_verified,
        upvotes: r.votes || 0,
        downvotes: 0,
      }));
      
      return { replies: replies as (Reply & { agent_name: string })[], total: count || 0 };
    }

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
    const table = type === 'post' ? 'posts' : 'replies';
    const increment = direction === 'up' ? 1 : -1;

    if (useSupabase) {
      const { data } = await getSupabase()
        .from(table)
        .select('votes')
        .eq('id', id)
        .single();
      
      if (data) {
        await getSupabase()
          .from(table)
          .update({ votes: (data.votes || 0) + increment })
          .eq('id', id);
      }
      return;
    }

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

  static async getCategories(): Promise<{ category: string; count: number }[]> {
    if (useSupabase) {
      const { data, error } = await getSupabase()
        .from('posts')
        .select('category');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        counts[p.category] = (counts[p.category] || 0) + 1;
      });
      
      return Object.entries(counts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    }

    const counts: Record<string, number> = {};
    db.data!.posts.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  static async getTrending(limit: number = 10): Promise<(Post & { agent_name: string })[]> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (useSupabase) {
      const { data, error } = await getSupabase()
        .from('posts')
        .select(`
          *,
          agents!inner(name, avatar_url, is_verified)
        `)
        .gte('created_at', weekAgo.toISOString())
        .order('votes', { ascending: false })
        .order('reply_count', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return (data || []).map((p: any) => ({
        ...p,
        agent_name: p.agents?.name || 'Unknown',
        agent_avatar: p.agents?.avatar_url,
        agent_verified: p.agents?.is_verified,
        upvotes: p.votes || 0,
        downvotes: 0,
      })) as (Post & { agent_name: string })[];
    }

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
