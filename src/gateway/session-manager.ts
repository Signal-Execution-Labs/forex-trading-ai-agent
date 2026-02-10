/**
 * K.I.T. Session Manager
 * 
 * Manages chat sessions with transcript persistence
 */

import { EventEmitter } from 'events';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface Session {
  key: string;
  displayName?: string;
  channel?: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface SessionManagerConfig {
  transcriptsDir?: string;
  stateDir?: string;
  maxMessages?: number;
  autoSave?: boolean;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private config: SessionManagerConfig;

  constructor(config: SessionManagerConfig = {}) {
    super();
    this.config = {
      transcriptsDir: config.transcriptsDir || '.kit/transcripts',
      maxMessages: config.maxMessages || 100,
      autoSave: config.autoSave ?? true,
    };
  }

  /**
   * Get or create a session
   */
  async getOrCreate(key: string, options?: Partial<Session>): Promise<Session> {
    let session = this.sessions.get(key);
    
    if (!session) {
      // Try to load from disk
      session = await this.loadSession(key);
      
      if (!session) {
        // Create new session
        session = {
          key,
          displayName: options?.displayName || key,
          channel: options?.channel,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: options?.metadata,
        };
      }
      
      this.sessions.set(key, session);
    }
    
    return session;
  }

  /**
   * Get a session by key
   */
  get(key: string): Session | undefined {
    return this.sessions.get(key);
  }

  /**
   * Add a message to a session
   */
  async addMessage(
    sessionKey: string,
    role: Message['role'],
    content: string,
    metadata?: Record<string, any>
  ): Promise<Message> {
    const session = await this.getOrCreate(sessionKey);
    
    const message: Message = {
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };
    
    session.messages.push(message);
    session.updatedAt = Date.now();
    
    // Trim old messages
    if (session.messages.length > this.config.maxMessages!) {
      session.messages = session.messages.slice(-this.config.maxMessages!);
    }
    
    // Auto-save
    if (this.config.autoSave) {
      await this.saveSession(session);
    }
    
    this.emit('message', { session, message });
    return message;
  }

  /**
   * Get chat history for a session
   */
  async getHistory(sessionKey: string, limit?: number): Promise<Message[]> {
    const session = await this.getOrCreate(sessionKey);
    const messages = session.messages;
    
    if (limit && limit > 0) {
      return messages.slice(-limit);
    }
    
    return messages;
  }

  /**
   * Clear a session's messages
   */
  async clearSession(sessionKey: string): Promise<void> {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.messages = [];
      session.updatedAt = Date.now();
      
      if (this.config.autoSave) {
        await this.saveSession(session);
      }
      
      this.emit('cleared', { sessionKey });
    }
  }

  /**
   * List all active sessions
   */
  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Save session to disk
   */
  private async saveSession(session: Session): Promise<void> {
    try {
      const filePath = join(this.config.transcriptsDir!, `${session.key}.json`);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error(`Failed to save session ${session.key}:`, error);
    }
  }

  /**
   * Load session from disk
   */
  private async loadSession(key: string): Promise<Session | undefined> {
    try {
      const filePath = join(this.config.transcriptsDir!, `${key}.json`);
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  }

  /**
   * List all sessions (alias for listSessions)
   * @param filter Optional filter parameters
   */
  list(filter?: { channel?: string; limit?: number }): Session[] {
    let sessions = this.listSessions();
    
    if (filter?.channel) {
      sessions = sessions.filter(s => s.channel === filter.channel);
    }
    
    if (filter?.limit && filter.limit > 0) {
      sessions = sessions.slice(0, filter.limit);
    }
    
    return sessions;
  }

  /**
   * Flush all sessions to disk
   */
  async flush(): Promise<void> {
    const savePromises = Array.from(this.sessions.values()).map(session => 
      this.saveSession(session)
    );
    await Promise.all(savePromises);
  }
}

/**
 * Factory function to create SessionManager
 */
export function createSessionManager(agentId?: string, config?: SessionManagerConfig): SessionManager {
  // agentId can be used for namespacing transcripts
  // stateDir takes precedence, then transcriptsDir, then default
  const transcriptsDir = config?.stateDir || config?.transcriptsDir || 
    (agentId ? `.kit/transcripts/${agentId}` : '.kit/transcripts');
  
  return new SessionManager({
    ...config,
    transcriptsDir,
  });
}
