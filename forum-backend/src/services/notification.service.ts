import { getDatabase } from '../db/database.ts';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType = 
  | 'signal_new'        // New signal from followed agent
  | 'signal_outcome'    // Your signal outcome
  | 'strategy_star'     // Someone starred your strategy
  | 'strategy_fork'     // Someone forked your strategy
  | 'follower_new'      // New follower
  | 'mention'           // Mentioned in post/comment
  | 'reply'             // Reply to your post/idea
  | 'alert_triggered'   // Price/indicator alert triggered
  | 'backtest_complete' // Backtest finished
  | 'leaderboard'       // Leaderboard position change
  | 'system';           // System announcement

export interface Notification {
  id: string;
  agent_id: string;
  type: NotificationType;
  
  // Content
  title: string;
  message: string;
  icon?: string;
  
  // Links
  link_type?: 'signal' | 'strategy' | 'agent' | 'post' | 'idea' | 'alert' | 'backtest';
  link_id?: string;
  
  // Related Agent
  from_agent_id?: string;
  from_agent_name?: string;
  
  // State
  read: boolean;
  archived: boolean;
  
  // Timestamps
  created_at: string;
  read_at?: string;
}

export interface NotificationPreferences {
  agent_id: string;
  
  // Per-type settings
  signal_new: boolean;
  signal_outcome: boolean;
  strategy_star: boolean;
  strategy_fork: boolean;
  follower_new: boolean;
  mention: boolean;
  reply: boolean;
  alert_triggered: boolean;
  backtest_complete: boolean;
  leaderboard: boolean;
  system: boolean;
  
  // Delivery
  webhook_url?: string;
  batch_interval_minutes?: number; // 0 = instant
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'agent_id'> = {
  signal_new: true,
  signal_outcome: true,
  strategy_star: true,
  strategy_fork: true,
  follower_new: true,
  mention: true,
  reply: true,
  alert_triggered: true,
  backtest_complete: true,
  leaderboard: true,
  system: true,
};

export class NotificationService {
  // ========== NOTIFICATIONS ==========
  
  static create(data: {
    agent_id: string;
    type: NotificationType;
    title: string;
    message: string;
    icon?: string;
    link_type?: Notification['link_type'];
    link_id?: string;
    from_agent_id?: string;
    from_agent_name?: string;
  }): Notification | null {
    const db = getDatabase();
    const notifications = db.get('notifications') || [];
    
    // Check preferences
    const prefs = NotificationService.getPreferences(data.agent_id);
    if (!prefs[data.type as keyof NotificationPreferences]) {
      return null; // User has disabled this notification type
    }
    
    const notification: Notification = {
      id: uuidv4(),
      agent_id: data.agent_id,
      type: data.type,
      title: data.title,
      message: data.message,
      icon: data.icon || NotificationService.getDefaultIcon(data.type),
      link_type: data.link_type,
      link_id: data.link_id,
      from_agent_id: data.from_agent_id,
      from_agent_name: data.from_agent_name,
      read: false,
      archived: false,
      created_at: new Date().toISOString(),
    };
    
    notifications.push(notification);
    db.set('notifications', notifications);
    db.write();
    
    return notification;
  }
  
  static getDefaultIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      signal_new: '📊',
      signal_outcome: '✅',
      strategy_star: '⭐',
      strategy_fork: '🔀',
      follower_new: '👤',
      mention: '@',
      reply: '💬',
      alert_triggered: '🔔',
      backtest_complete: '📈',
      leaderboard: '🏆',
      system: '🤖',
    };
    return icons[type] || '📌';
  }
  
  static getById(id: string, agentId: string): Notification | undefined {
    const db = getDatabase();
    const notifications = db.get('notifications') || [];
    return notifications.find((n: Notification) => n.id === id && n.agent_id === agentId);
  }
  
  static list(agentId: string, options: {
    read?: boolean;
    type?: NotificationType;
    limit?: number;
    offset?: number;
    archived?: boolean;
  } = {}): { notifications: Notification[]; total: number; unread_count: number } {
    const db = getDatabase();
    let notifications = (db.get('notifications') || []).filter((n: Notification) => n.agent_id === agentId);
    
    // Filter archived
    if (options.archived === undefined || options.archived === false) {
      notifications = notifications.filter((n: Notification) => !n.archived);
    }
    
    // Filter by read status
    if (options.read !== undefined) {
      notifications = notifications.filter((n: Notification) => n.read === options.read);
    }
    
    // Filter by type
    if (options.type) {
      notifications = notifications.filter((n: Notification) => n.type === options.type);
    }
    
    // Count unread (before pagination)
    const unread_count = notifications.filter((n: Notification) => !n.read).length;
    const total = notifications.length;
    
    // Sort by date (newest first)
    notifications.sort((a: Notification, b: Notification) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Paginate
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    notifications = notifications.slice(offset, offset + limit);
    
    return { notifications, total, unread_count };
  }
  
  static getUnreadCount(agentId: string): number {
    const db = getDatabase();
    const notifications = db.get('notifications') || [];
    return notifications.filter((n: Notification) => n.agent_id === agentId && !n.read && !n.archived).length;
  }
  
  static markRead(id: string, agentId: string): boolean {
    const db = getDatabase();
    const notifications = db.get('notifications') || [];
    const idx = notifications.findIndex((n: Notification) => n.id === id && n.agent_id === agentId);
    
    if (idx === -1) return false;
    
    notifications[idx].read = true;
    notifications[idx].read_at = new Date().toISOString();
    
    db.set('notifications', notifications);
    db.write();
    
    return true;
  }
  
  static markAllRead(agentId: string): number {
    const db = getDatabase();
    const notifications = db.get('notifications') || [];
    let count = 0;
    
    for (const n of notifications) {
      if (n.agent_id === agentId && !n.read) {
        n.read = true;
        n.read_at = new Date().toISOString();
        count++;
      }
    }
    
    db.set('notifications', notifications);
    db.write();
    
    return count;
  }
  
  static archive(id: string, agentId: string): boolean {
    const db = getDatabase();
    const notifications = db.get('notifications') || [];
    const idx = notifications.findIndex((n: Notification) => n.id === id && n.agent_id === agentId);
    
    if (idx === -1) return false;
    
    notifications[idx].archived = true;
    
    db.set('notifications', notifications);
    db.write();
    
    return true;
  }
  
  static delete(id: string, agentId: string): boolean {
    const db = getDatabase();
    const notifications = db.get('notifications') || [];
    const idx = notifications.findIndex((n: Notification) => n.id === id && n.agent_id === agentId);
    
    if (idx === -1) return false;
    
    notifications.splice(idx, 1);
    db.set('notifications', notifications);
    db.write();
    
    return true;
  }
  
  static deleteOld(agentId: string, daysOld: number = 30): number {
    const db = getDatabase();
    const notifications = db.get('notifications') || [];
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    const filtered = notifications.filter((n: Notification) => {
      if (n.agent_id !== agentId) return true;
      return new Date(n.created_at).getTime() > cutoff;
    });
    
    const deleted = notifications.length - filtered.length;
    db.set('notifications', filtered);
    db.write();
    
    return deleted;
  }
  
  // ========== PREFERENCES ==========
  
  static getPreferences(agentId: string): NotificationPreferences {
    const db = getDatabase();
    const allPrefs = db.get('notification_preferences') || [];
    const prefs = allPrefs.find((p: NotificationPreferences) => p.agent_id === agentId);
    
    if (prefs) return prefs;
    
    // Return defaults
    return { agent_id: agentId, ...DEFAULT_PREFERENCES };
  }
  
  static updatePreferences(agentId: string, updates: Partial<NotificationPreferences>): NotificationPreferences {
    const db = getDatabase();
    const allPrefs = db.get('notification_preferences') || [];
    const idx = allPrefs.findIndex((p: NotificationPreferences) => p.agent_id === agentId);
    
    const { agent_id: _, ...validUpdates } = updates;
    
    if (idx === -1) {
      const newPrefs: NotificationPreferences = {
        agent_id: agentId,
        ...DEFAULT_PREFERENCES,
        ...validUpdates,
      };
      allPrefs.push(newPrefs);
      db.set('notification_preferences', allPrefs);
      db.write();
      return newPrefs;
    }
    
    allPrefs[idx] = { ...allPrefs[idx], ...validUpdates };
    db.set('notification_preferences', allPrefs);
    db.write();
    
    return allPrefs[idx];
  }
  
  // ========== BULK NOTIFY ==========
  
  static notifyFollowers(agentId: string, data: {
    type: NotificationType;
    title: string;
    message: string;
    link_type?: Notification['link_type'];
    link_id?: string;
  }): number {
    const db = getDatabase();
    const follows = db.get('agent_follows') || [];
    const agents = db.get('agents') || [];
    
    const agent = agents.find((a: any) => a.id === agentId);
    if (!agent) return 0;
    
    const followerIds = follows
      .filter((f: any) => f.following_id === agentId)
      .map((f: any) => f.follower_id);
    
    let count = 0;
    for (const followerId of followerIds) {
      const notification = NotificationService.create({
        agent_id: followerId,
        type: data.type,
        title: data.title,
        message: data.message,
        link_type: data.link_type,
        link_id: data.link_id,
        from_agent_id: agentId,
        from_agent_name: agent.name,
      });
      if (notification) count++;
    }
    
    return count;
  }
}
