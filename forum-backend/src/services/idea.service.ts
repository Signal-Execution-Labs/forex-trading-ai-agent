import { getDatabase } from '../db/database.ts';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from './notification.service.ts';

export type IdeaCategory = 'technical' | 'fundamental' | 'sentiment' | 'macro' | 'news' | 'education' | 'strategy';
export type IdeaStatus = 'active' | 'closed' | 'expired';

export interface Idea {
  id: string;
  agent_id: string;
  agent_name?: string;
  
  // Content
  title: string;
  symbol: string;
  timeframe?: string;
  description: string; // Long-form markdown content
  tldr?: string; // Short summary
  
  // Trade Idea
  direction: 'long' | 'short' | 'neutral';
  entry_price?: number;
  target_price?: number;
  target_price_2?: number;
  target_price_3?: number;
  stop_loss?: number;
  risk_reward?: number;
  confidence: number; // 0-100
  
  // Categorization
  category: IdeaCategory;
  tags: string[];
  
  // Charting
  chart_image_url?: string;
  indicators?: string[];
  
  // Social
  views: number;
  likes: number;
  comments_count: number;
  bookmarks: number;
  
  // Outcome Tracking
  status: IdeaStatus;
  outcome?: 'win' | 'loss' | 'neutral';
  actual_return?: number;
  closed_at?: string;
  close_notes?: string;
  
  // Featured
  is_featured: boolean;
  featured_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface IdeaComment {
  id: string;
  idea_id: string;
  agent_id: string;
  agent_name?: string;
  parent_id?: string; // For nested replies
  
  content: string;
  likes: number;
  
  created_at: string;
  updated_at?: string;
}

export interface IdeaLike {
  agent_id: string;
  idea_id: string;
  created_at: string;
}

export interface IdeaBookmark {
  agent_id: string;
  idea_id: string;
  created_at: string;
  notes?: string;
}

export class IdeaService {
  // ========== IDEAS ==========
  
  static create(data: {
    agent_id: string;
    title: string;
    symbol: string;
    description: string;
    direction: Idea['direction'];
    category: IdeaCategory;
    timeframe?: string;
    tldr?: string;
    entry_price?: number;
    target_price?: number;
    target_price_2?: number;
    target_price_3?: number;
    stop_loss?: number;
    confidence?: number;
    tags?: string[];
    chart_image_url?: string;
    indicators?: string[];
    expires_at?: string;
  }): Idea {
    const db = getDatabase();
    const ideas = db.get('ideas') || [];
    const agents = db.get('agents') || [];
    
    const agent = agents.find((a: any) => a.id === data.agent_id);
    
    // Calculate risk/reward
    let risk_reward: number | undefined;
    if (data.entry_price && data.target_price && data.stop_loss) {
      const reward = Math.abs(data.target_price - data.entry_price);
      const risk = Math.abs(data.entry_price - data.stop_loss);
      risk_reward = risk > 0 ? Math.round((reward / risk) * 100) / 100 : undefined;
    }
    
    const idea: Idea = {
      id: uuidv4(),
      agent_id: data.agent_id,
      agent_name: agent?.name,
      title: data.title,
      symbol: data.symbol.toUpperCase(),
      timeframe: data.timeframe,
      description: data.description,
      tldr: data.tldr,
      direction: data.direction,
      entry_price: data.entry_price,
      target_price: data.target_price,
      target_price_2: data.target_price_2,
      target_price_3: data.target_price_3,
      stop_loss: data.stop_loss,
      risk_reward,
      confidence: data.confidence || 50,
      category: data.category,
      tags: data.tags || [],
      chart_image_url: data.chart_image_url,
      indicators: data.indicators,
      views: 0,
      likes: 0,
      comments_count: 0,
      bookmarks: 0,
      status: 'active',
      is_featured: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: data.expires_at,
    };
    
    ideas.push(idea);
    db.set('ideas', ideas);
    db.write();
    
    // Notify followers
    NotificationService.notifyFollowers(data.agent_id, {
      type: 'signal_new',
      title: `New Idea: ${idea.title}`,
      message: `${agent?.name || 'An agent'} published a new ${idea.direction} idea on ${idea.symbol}`,
      link_type: 'idea',
      link_id: idea.id,
    });
    
    return idea;
  }
  
  static getById(id: string): Idea | undefined {
    const db = getDatabase();
    const ideas = db.get('ideas') || [];
    return ideas.find((i: Idea) => i.id === id);
  }
  
  static list(options: {
    agent_id?: string;
    symbol?: string;
    category?: IdeaCategory;
    direction?: Idea['direction'];
    status?: IdeaStatus;
    tags?: string[];
    search?: string;
    sort?: 'latest' | 'popular' | 'trending' | 'confidence';
    limit?: number;
    offset?: number;
  } = {}): { ideas: Idea[]; total: number } {
    const db = getDatabase();
    let ideas: Idea[] = db.get('ideas') || [];
    
    // Filter by agent
    if (options.agent_id) {
      ideas = ideas.filter((i) => i.agent_id === options.agent_id);
    }
    
    // Filter by symbol
    if (options.symbol) {
      ideas = ideas.filter((i) => i.symbol === options.symbol.toUpperCase());
    }
    
    // Filter by category
    if (options.category) {
      ideas = ideas.filter((i) => i.category === options.category);
    }
    
    // Filter by direction
    if (options.direction) {
      ideas = ideas.filter((i) => i.direction === options.direction);
    }
    
    // Filter by status
    if (options.status) {
      ideas = ideas.filter((i) => i.status === options.status);
    }
    
    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      ideas = ideas.filter((i) => options.tags!.some((t) => i.tags.includes(t)));
    }
    
    // Search
    if (options.search) {
      const search = options.search.toLowerCase();
      ideas = ideas.filter((i) =>
        i.title.toLowerCase().includes(search) ||
        i.description.toLowerCase().includes(search) ||
        i.symbol.toLowerCase().includes(search) ||
        i.tags.some((t) => t.toLowerCase().includes(search))
      );
    }
    
    const total = ideas.length;
    
    // Sort
    const sort = options.sort || 'latest';
    switch (sort) {
      case 'latest':
        ideas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'popular':
        ideas.sort((a, b) => (b.likes + b.views / 10) - (a.likes + a.views / 10));
        break;
      case 'trending':
        // Recent + engagement
        const now = Date.now();
        ideas.sort((a, b) => {
          const ageA = (now - new Date(a.created_at).getTime()) / (24 * 60 * 60 * 1000);
          const ageB = (now - new Date(b.created_at).getTime()) / (24 * 60 * 60 * 1000);
          const scoreA = (a.likes * 2 + a.comments_count + a.views / 20) / Math.max(1, ageA);
          const scoreB = (b.likes * 2 + b.comments_count + b.views / 20) / Math.max(1, ageB);
          return scoreB - scoreA;
        });
        break;
      case 'confidence':
        ideas.sort((a, b) => b.confidence - a.confidence);
        break;
    }
    
    // Paginate
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    ideas = ideas.slice(offset, offset + limit);
    
    return { ideas, total };
  }
  
  static incrementView(id: string): void {
    const db = getDatabase();
    const ideas = db.get('ideas') || [];
    const idx = ideas.findIndex((i: Idea) => i.id === id);
    
    if (idx !== -1) {
      ideas[idx].views += 1;
      db.set('ideas', ideas);
      db.write();
    }
  }
  
  static update(id: string, agentId: string, data: Partial<Idea>): Idea | null {
    const db = getDatabase();
    const ideas = db.get('ideas') || [];
    const idx = ideas.findIndex((i: Idea) => i.id === id && i.agent_id === agentId);
    
    if (idx === -1) return null;
    
    const { id: _, agent_id: __, created_at: ___, views: ____, likes: _____, comments_count: ______, bookmarks: _______, ...updateFields } = data;
    
    // Recalculate risk/reward if prices changed
    const entry = data.entry_price ?? ideas[idx].entry_price;
    const target = data.target_price ?? ideas[idx].target_price;
    const stop = data.stop_loss ?? ideas[idx].stop_loss;
    if (entry && target && stop) {
      const reward = Math.abs(target - entry);
      const risk = Math.abs(entry - stop);
      updateFields.risk_reward = risk > 0 ? Math.round((reward / risk) * 100) / 100 : undefined;
    }
    
    ideas[idx] = {
      ...ideas[idx],
      ...updateFields,
      updated_at: new Date().toISOString(),
    };
    
    db.set('ideas', ideas);
    db.write();
    
    return ideas[idx];
  }
  
  static close(id: string, agentId: string, data: { outcome?: 'win' | 'loss' | 'neutral'; actual_return?: number; close_notes?: string }): Idea | null {
    const db = getDatabase();
    const ideas = db.get('ideas') || [];
    const idx = ideas.findIndex((i: Idea) => i.id === id && i.agent_id === agentId);
    
    if (idx === -1) return null;
    
    ideas[idx].status = 'closed';
    ideas[idx].outcome = data.outcome;
    ideas[idx].actual_return = data.actual_return;
    ideas[idx].close_notes = data.close_notes;
    ideas[idx].closed_at = new Date().toISOString();
    ideas[idx].updated_at = new Date().toISOString();
    
    db.set('ideas', ideas);
    db.write();
    
    return ideas[idx];
  }
  
  static delete(id: string, agentId: string): boolean {
    const db = getDatabase();
    const ideas = db.get('ideas') || [];
    const idx = ideas.findIndex((i: Idea) => i.id === id && i.agent_id === agentId);
    
    if (idx === -1) return false;
    
    ideas.splice(idx, 1);
    
    // Also delete comments
    const comments = db.get('idea_comments') || [];
    const filtered = comments.filter((c: IdeaComment) => c.idea_id !== id);
    
    db.set('ideas', ideas);
    db.set('idea_comments', filtered);
    db.write();
    
    return true;
  }
  
  // ========== LIKES ==========
  
  static like(ideaId: string, agentId: string): boolean {
    const db = getDatabase();
    const likes = db.get('idea_likes') || [];
    const ideas = db.get('ideas') || [];
    
    // Check if idea exists
    const ideaIdx = ideas.findIndex((i: Idea) => i.id === ideaId);
    if (ideaIdx === -1) return false;
    
    // Already liked?
    const existing = likes.find((l: IdeaLike) => l.idea_id === ideaId && l.agent_id === agentId);
    if (existing) return true;
    
    likes.push({
      agent_id: agentId,
      idea_id: ideaId,
      created_at: new Date().toISOString(),
    });
    
    ideas[ideaIdx].likes += 1;
    
    db.set('idea_likes', likes);
    db.set('ideas', ideas);
    db.write();
    
    // Notify idea author
    if (ideas[ideaIdx].agent_id !== agentId) {
      const agents = db.get('agents') || [];
      const liker = agents.find((a: any) => a.id === agentId);
      
      NotificationService.create({
        agent_id: ideas[ideaIdx].agent_id,
        type: 'strategy_star',
        title: 'Idea Liked!',
        message: `${liker?.name || 'Someone'} liked your idea: ${ideas[ideaIdx].title}`,
        link_type: 'idea',
        link_id: ideaId,
        from_agent_id: agentId,
        from_agent_name: liker?.name,
      });
    }
    
    return true;
  }
  
  static unlike(ideaId: string, agentId: string): boolean {
    const db = getDatabase();
    const likes = db.get('idea_likes') || [];
    const ideas = db.get('ideas') || [];
    
    const idx = likes.findIndex((l: IdeaLike) => l.idea_id === ideaId && l.agent_id === agentId);
    if (idx === -1) return false;
    
    likes.splice(idx, 1);
    
    const ideaIdx = ideas.findIndex((i: Idea) => i.id === ideaId);
    if (ideaIdx !== -1) {
      ideas[ideaIdx].likes = Math.max(0, ideas[ideaIdx].likes - 1);
    }
    
    db.set('idea_likes', likes);
    db.set('ideas', ideas);
    db.write();
    
    return true;
  }
  
  static hasLiked(ideaId: string, agentId: string): boolean {
    const db = getDatabase();
    const likes = db.get('idea_likes') || [];
    return likes.some((l: IdeaLike) => l.idea_id === ideaId && l.agent_id === agentId);
  }
  
  // ========== BOOKMARKS ==========
  
  static bookmark(ideaId: string, agentId: string, notes?: string): boolean {
    const db = getDatabase();
    const bookmarks = db.get('idea_bookmarks') || [];
    const ideas = db.get('ideas') || [];
    
    const ideaIdx = ideas.findIndex((i: Idea) => i.id === ideaId);
    if (ideaIdx === -1) return false;
    
    const existing = bookmarks.find((b: IdeaBookmark) => b.idea_id === ideaId && b.agent_id === agentId);
    if (existing) return true;
    
    bookmarks.push({
      agent_id: agentId,
      idea_id: ideaId,
      created_at: new Date().toISOString(),
      notes,
    });
    
    ideas[ideaIdx].bookmarks += 1;
    
    db.set('idea_bookmarks', bookmarks);
    db.set('ideas', ideas);
    db.write();
    
    return true;
  }
  
  static removeBookmark(ideaId: string, agentId: string): boolean {
    const db = getDatabase();
    const bookmarks = db.get('idea_bookmarks') || [];
    const ideas = db.get('ideas') || [];
    
    const idx = bookmarks.findIndex((b: IdeaBookmark) => b.idea_id === ideaId && b.agent_id === agentId);
    if (idx === -1) return false;
    
    bookmarks.splice(idx, 1);
    
    const ideaIdx = ideas.findIndex((i: Idea) => i.id === ideaId);
    if (ideaIdx !== -1) {
      ideas[ideaIdx].bookmarks = Math.max(0, ideas[ideaIdx].bookmarks - 1);
    }
    
    db.set('idea_bookmarks', bookmarks);
    db.set('ideas', ideas);
    db.write();
    
    return true;
  }
  
  static getBookmarks(agentId: string): Idea[] {
    const db = getDatabase();
    const bookmarks = db.get('idea_bookmarks') || [];
    const ideas = db.get('ideas') || [];
    
    const bookmarkedIds = bookmarks
      .filter((b: IdeaBookmark) => b.agent_id === agentId)
      .map((b: IdeaBookmark) => b.idea_id);
    
    return ideas.filter((i: Idea) => bookmarkedIds.includes(i.id));
  }
  
  // ========== COMMENTS ==========
  
  static addComment(ideaId: string, agentId: string, content: string, parentId?: string): IdeaComment | null {
    const db = getDatabase();
    const comments = db.get('idea_comments') || [];
    const ideas = db.get('ideas') || [];
    const agents = db.get('agents') || [];
    
    const ideaIdx = ideas.findIndex((i: Idea) => i.id === ideaId);
    if (ideaIdx === -1) return null;
    
    const agent = agents.find((a: any) => a.id === agentId);
    
    const comment: IdeaComment = {
      id: uuidv4(),
      idea_id: ideaId,
      agent_id: agentId,
      agent_name: agent?.name,
      parent_id: parentId,
      content,
      likes: 0,
      created_at: new Date().toISOString(),
    };
    
    comments.push(comment);
    ideas[ideaIdx].comments_count += 1;
    
    db.set('idea_comments', comments);
    db.set('ideas', ideas);
    db.write();
    
    // Notify idea author
    if (ideas[ideaIdx].agent_id !== agentId) {
      NotificationService.create({
        agent_id: ideas[ideaIdx].agent_id,
        type: 'reply',
        title: 'New Comment',
        message: `${agent?.name || 'Someone'} commented on your idea: ${ideas[ideaIdx].title}`,
        link_type: 'idea',
        link_id: ideaId,
        from_agent_id: agentId,
        from_agent_name: agent?.name,
      });
    }
    
    return comment;
  }
  
  static getComments(ideaId: string): IdeaComment[] {
    const db = getDatabase();
    const comments = db.get('idea_comments') || [];
    
    return comments
      .filter((c: IdeaComment) => c.idea_id === ideaId)
      .sort((a: IdeaComment, b: IdeaComment) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  
  static deleteComment(commentId: string, agentId: string): boolean {
    const db = getDatabase();
    const comments = db.get('idea_comments') || [];
    const ideas = db.get('ideas') || [];
    
    const idx = comments.findIndex((c: IdeaComment) => c.id === commentId && c.agent_id === agentId);
    if (idx === -1) return false;
    
    const ideaId = comments[idx].idea_id;
    comments.splice(idx, 1);
    
    const ideaIdx = ideas.findIndex((i: Idea) => i.id === ideaId);
    if (ideaIdx !== -1) {
      ideas[ideaIdx].comments_count = Math.max(0, ideas[ideaIdx].comments_count - 1);
    }
    
    db.set('idea_comments', comments);
    db.set('ideas', ideas);
    db.write();
    
    return true;
  }
  
  // ========== TRENDING / FEATURED ==========
  
  static getTrending(limit: number = 10): Idea[] {
    return IdeaService.list({ sort: 'trending', limit, status: 'active' }).ideas;
  }
  
  static getFeatured(limit: number = 5): Idea[] {
    const db = getDatabase();
    const ideas: Idea[] = db.get('ideas') || [];
    
    return ideas
      .filter((i) => i.is_featured && i.status === 'active')
      .sort((a, b) => new Date(b.featured_at || b.created_at).getTime() - new Date(a.featured_at || a.created_at).getTime())
      .slice(0, limit);
  }
  
  static getCategories(): { category: IdeaCategory; count: number }[] {
    const db = getDatabase();
    const ideas: Idea[] = db.get('ideas') || [];
    
    const counts: Record<IdeaCategory, number> = {
      technical: 0,
      fundamental: 0,
      sentiment: 0,
      macro: 0,
      news: 0,
      education: 0,
      strategy: 0,
    };
    
    for (const idea of ideas) {
      if (idea.status === 'active') {
        counts[idea.category]++;
      }
    }
    
    return Object.entries(counts)
      .map(([category, count]) => ({ category: category as IdeaCategory, count }))
      .sort((a, b) => b.count - a.count);
  }
}
