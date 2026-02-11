import { getDatabase } from '../db/database.ts';
import { v4 as uuidv4 } from 'uuid';

export interface Watchlist {
  id: string;
  agent_id: string;
  name: string;
  description?: string;
  color?: string; // Hex color for UI
  icon?: string; // Emoji or icon name
  is_public: boolean;
  
  // Stats
  symbol_count: number;
  followers: number;
  views: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  
  // Symbol Info
  symbol: string;
  exchange?: string;
  asset_type?: 'crypto' | 'forex' | 'stock' | 'index' | 'commodity';
  
  // Notes & Targets
  notes?: string;
  target_price?: number;
  stop_loss?: number;
  alert_id?: string; // Linked alert
  
  // Display
  color?: string;
  sort_order: number;
  
  // Timestamps
  added_at: string;
  updated_at: string;
}

export interface WatchlistFollow {
  agent_id: string;
  watchlist_id: string;
  created_at: string;
}

export class WatchlistService {
  // ========== WATCHLISTS ==========
  
  static create(data: { agent_id: string; name: string; description?: string; color?: string; icon?: string; is_public?: boolean }): Watchlist {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    
    const watchlist: Watchlist = {
      id: uuidv4(),
      agent_id: data.agent_id,
      name: data.name,
      description: data.description,
      color: data.color || '#3b82f6',
      icon: data.icon || '📈',
      is_public: data.is_public ?? false,
      symbol_count: 0,
      followers: 0,
      views: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    watchlists.push(watchlist);
    db.set('watchlists', watchlists);
    db.write();
    
    return watchlist;
  }
  
  static getById(id: string): Watchlist | undefined {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    return watchlists.find((w: Watchlist) => w.id === id);
  }
  
  static listByAgent(agentId: string): Watchlist[] {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    return watchlists.filter((w: Watchlist) => w.agent_id === agentId);
  }
  
  static listPublic(options: { search?: string; limit?: number; offset?: number } = {}): { watchlists: Watchlist[]; total: number } {
    const db = getDatabase();
    let watchlists = (db.get('watchlists') || []).filter((w: Watchlist) => w.is_public);
    
    if (options.search) {
      const search = options.search.toLowerCase();
      watchlists = watchlists.filter((w: Watchlist) => 
        w.name.toLowerCase().includes(search) || 
        w.description?.toLowerCase().includes(search)
      );
    }
    
    const total = watchlists.length;
    watchlists.sort((a: Watchlist, b: Watchlist) => b.followers - a.followers);
    
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    
    return {
      watchlists: watchlists.slice(offset, offset + limit),
      total,
    };
  }
  
  static update(id: string, agentId: string, data: Partial<Watchlist>): Watchlist | null {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    const idx = watchlists.findIndex((w: Watchlist) => w.id === id && w.agent_id === agentId);
    
    if (idx === -1) return null;
    
    const { id: _, agent_id: __, created_at: ___, symbol_count: ____, followers: _____, ...updateFields } = data;
    watchlists[idx] = {
      ...watchlists[idx],
      ...updateFields,
      updated_at: new Date().toISOString(),
    };
    
    db.set('watchlists', watchlists);
    db.write();
    
    return watchlists[idx];
  }
  
  static delete(id: string, agentId: string): boolean {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    const items = db.get('watchlist_items') || [];
    
    const idx = watchlists.findIndex((w: Watchlist) => w.id === id && w.agent_id === agentId);
    if (idx === -1) return false;
    
    // Remove watchlist and all its items
    watchlists.splice(idx, 1);
    const filteredItems = items.filter((i: WatchlistItem) => i.watchlist_id !== id);
    
    db.set('watchlists', watchlists);
    db.set('watchlist_items', filteredItems);
    db.write();
    
    return true;
  }
  
  static incrementView(id: string): void {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    const idx = watchlists.findIndex((w: Watchlist) => w.id === id);
    
    if (idx !== -1) {
      watchlists[idx].views += 1;
      db.set('watchlists', watchlists);
      db.write();
    }
  }
  
  // ========== WATCHLIST ITEMS ==========
  
  static addSymbol(watchlistId: string, agentId: string, data: { symbol: string; exchange?: string; asset_type?: string; notes?: string; target_price?: number; stop_loss?: number; color?: string }): WatchlistItem | null {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    const items = db.get('watchlist_items') || [];
    
    const wlIdx = watchlists.findIndex((w: Watchlist) => w.id === watchlistId && w.agent_id === agentId);
    if (wlIdx === -1) return null;
    
    // Check if symbol already exists
    const existing = items.find((i: WatchlistItem) => 
      i.watchlist_id === watchlistId && i.symbol === data.symbol.toUpperCase()
    );
    if (existing) return existing;
    
    const maxOrder = items
      .filter((i: WatchlistItem) => i.watchlist_id === watchlistId)
      .reduce((max: number, i: WatchlistItem) => Math.max(max, i.sort_order), 0);
    
    const item: WatchlistItem = {
      id: uuidv4(),
      watchlist_id: watchlistId,
      symbol: data.symbol.toUpperCase(),
      exchange: data.exchange,
      asset_type: data.asset_type as any,
      notes: data.notes,
      target_price: data.target_price,
      stop_loss: data.stop_loss,
      color: data.color,
      sort_order: maxOrder + 1,
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    items.push(item);
    watchlists[wlIdx].symbol_count += 1;
    watchlists[wlIdx].updated_at = new Date().toISOString();
    
    db.set('watchlist_items', items);
    db.set('watchlists', watchlists);
    db.write();
    
    return item;
  }
  
  static getItems(watchlistId: string): WatchlistItem[] {
    const db = getDatabase();
    const items = db.get('watchlist_items') || [];
    return items
      .filter((i: WatchlistItem) => i.watchlist_id === watchlistId)
      .sort((a: WatchlistItem, b: WatchlistItem) => a.sort_order - b.sort_order);
  }
  
  static updateItem(itemId: string, watchlistId: string, agentId: string, data: Partial<WatchlistItem>): WatchlistItem | null {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    const items = db.get('watchlist_items') || [];
    
    // Verify ownership
    const wl = watchlists.find((w: Watchlist) => w.id === watchlistId && w.agent_id === agentId);
    if (!wl) return null;
    
    const idx = items.findIndex((i: WatchlistItem) => i.id === itemId && i.watchlist_id === watchlistId);
    if (idx === -1) return null;
    
    const { id: _, watchlist_id: __, added_at: ___, ...updateFields } = data;
    items[idx] = {
      ...items[idx],
      ...updateFields,
      updated_at: new Date().toISOString(),
    };
    
    db.set('watchlist_items', items);
    db.write();
    
    return items[idx];
  }
  
  static removeSymbol(itemId: string, watchlistId: string, agentId: string): boolean {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    const items = db.get('watchlist_items') || [];
    
    const wlIdx = watchlists.findIndex((w: Watchlist) => w.id === watchlistId && w.agent_id === agentId);
    if (wlIdx === -1) return false;
    
    const itemIdx = items.findIndex((i: WatchlistItem) => i.id === itemId && i.watchlist_id === watchlistId);
    if (itemIdx === -1) return false;
    
    items.splice(itemIdx, 1);
    watchlists[wlIdx].symbol_count = Math.max(0, watchlists[wlIdx].symbol_count - 1);
    watchlists[wlIdx].updated_at = new Date().toISOString();
    
    db.set('watchlist_items', items);
    db.set('watchlists', watchlists);
    db.write();
    
    return true;
  }
  
  static reorderItems(watchlistId: string, agentId: string, itemOrder: string[]): boolean {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    const items = db.get('watchlist_items') || [];
    
    const wl = watchlists.find((w: Watchlist) => w.id === watchlistId && w.agent_id === agentId);
    if (!wl) return false;
    
    for (let i = 0; i < itemOrder.length; i++) {
      const idx = items.findIndex((item: WatchlistItem) => item.id === itemOrder[i] && item.watchlist_id === watchlistId);
      if (idx !== -1) {
        items[idx].sort_order = i + 1;
      }
    }
    
    db.set('watchlist_items', items);
    db.write();
    
    return true;
  }
  
  // ========== FOLLOWING ==========
  
  static follow(agentId: string, watchlistId: string): boolean {
    const db = getDatabase();
    const follows = db.get('watchlist_follows') || [];
    const watchlists = db.get('watchlists') || [];
    
    const wl = watchlists.find((w: Watchlist) => w.id === watchlistId && w.is_public);
    if (!wl) return false;
    
    // Already following?
    const existing = follows.find((f: WatchlistFollow) => f.agent_id === agentId && f.watchlist_id === watchlistId);
    if (existing) return true;
    
    follows.push({
      agent_id: agentId,
      watchlist_id: watchlistId,
      created_at: new Date().toISOString(),
    });
    
    // Update follower count
    const wlIdx = watchlists.findIndex((w: Watchlist) => w.id === watchlistId);
    watchlists[wlIdx].followers += 1;
    
    db.set('watchlist_follows', follows);
    db.set('watchlists', watchlists);
    db.write();
    
    return true;
  }
  
  static unfollow(agentId: string, watchlistId: string): boolean {
    const db = getDatabase();
    const follows = db.get('watchlist_follows') || [];
    const watchlists = db.get('watchlists') || [];
    
    const idx = follows.findIndex((f: WatchlistFollow) => f.agent_id === agentId && f.watchlist_id === watchlistId);
    if (idx === -1) return false;
    
    follows.splice(idx, 1);
    
    const wlIdx = watchlists.findIndex((w: Watchlist) => w.id === watchlistId);
    if (wlIdx !== -1) {
      watchlists[wlIdx].followers = Math.max(0, watchlists[wlIdx].followers - 1);
    }
    
    db.set('watchlist_follows', follows);
    db.set('watchlists', watchlists);
    db.write();
    
    return true;
  }
  
  static getFollowing(agentId: string): Watchlist[] {
    const db = getDatabase();
    const follows = db.get('watchlist_follows') || [];
    const watchlists = db.get('watchlists') || [];
    
    const followedIds = follows
      .filter((f: WatchlistFollow) => f.agent_id === agentId)
      .map((f: WatchlistFollow) => f.watchlist_id);
    
    return watchlists.filter((w: Watchlist) => followedIds.includes(w.id));
  }
  
  // ========== FORK ==========
  
  static fork(originalId: string, agentId: string): Watchlist | null {
    const db = getDatabase();
    const watchlists = db.get('watchlists') || [];
    const items = db.get('watchlist_items') || [];
    
    const original = watchlists.find((w: Watchlist) => w.id === originalId && w.is_public);
    if (!original) return null;
    
    // Create new watchlist
    const forked = WatchlistService.create({
      agent_id: agentId,
      name: `${original.name} (forked)`,
      description: `Forked from ${original.name}`,
      color: original.color,
      icon: original.icon,
      is_public: false,
    });
    
    // Copy all items
    const originalItems = items.filter((i: WatchlistItem) => i.watchlist_id === originalId);
    for (const item of originalItems) {
      WatchlistService.addSymbol(forked.id, agentId, {
        symbol: item.symbol,
        exchange: item.exchange,
        asset_type: item.asset_type,
        notes: item.notes,
        target_price: item.target_price,
        stop_loss: item.stop_loss,
        color: item.color,
      });
    }
    
    return WatchlistService.getById(forked.id) || forked;
  }
}
