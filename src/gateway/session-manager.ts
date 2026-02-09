/**
 * K.I.T. Session Manager
 * Inspired by OpenClaw's Session Management System
 * 
 * Features:
 * - Session keys with agent scope
 * - DM scope isolation
 * - JSONL transcript persistence
 * - Daily/Idle reset policies
 * - Compaction support
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface SessionConfig {
  stateDir: string;
  mainKey: string;
  dmScope: 'main' | 'per-peer' | 'per-channel-peer' | 'per-account-channel-peer';
  reset: ResetPolicy;
  resetByType?: Record<SessionType, ResetPolicy>;
  resetByChannel?: Record<string, ResetPolicy>;
  identityLinks?: Record<string, string[]>;
}

export interface ResetPolicy {
  mode: 'daily' | 'idle' | 'both';
  atHour?: number; // 0-23 for daily mode
  idleMinutes?: number;
}

export type SessionType = 'dm' | 'group' | 'thread' | 'cron' | 'node';

export interface Session {
  id: string;
  key: string;
  agentId: string;
  type: SessionType;
  createdAt: Date;
  updatedAt: Date;
  
  // Metadata
  displayName?: string;
  channel?: string;
  accountId?: string;
  peerId?: string;
  
  // Origin tracking
  origin?: SessionOrigin;
  
  // Token tracking
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens: number;
  
  // Compaction
  compactionCount: number;
  lastCompactionAt?: Date;
  memoryFlushed?: boolean;
  
  // State
  enabled: boolean;
  model?: string;
}

export interface SessionOrigin {
  label?: string;
  provider?: string;
  from?: string;
  to?: string;
  accountId?: string;
  threadId?: string;
}

export interface TranscriptEntry {
  timestamp: Date;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: Record<string, unknown>;
  toolName?: string;
  toolCallId?: string;
  tokens?: {
    input?: number;
    output?: number;
  };
}

export interface SessionStore {
  version: number;
  sessions: Record<string, Session>;
  lastUpdated: Date;
}

// ============================================================================
// Session Key Builder
// ============================================================================

export class SessionKeyBuilder {
  private agentId: string;
  private config: SessionConfig;
  
  constructor(agentId: string, config: SessionConfig) {
    this.agentId = agentId;
    this.config = config;
  }
  
  /**
   * Build a session key for a direct message
   */
  buildDMKey(channel: string, peerId: string, accountId?: string): string {
    // Check identity links first
    const canonicalPeerId = this.resolveIdentity(channel, peerId);
    
    switch (this.config.dmScope) {
      case 'main':
        return `agent:${this.agentId}:${this.config.mainKey}`;
        
      case 'per-peer':
        return `agent:${this.agentId}:dm:${canonicalPeerId}`;
        
      case 'per-channel-peer':
        return `agent:${this.agentId}:${channel}:dm:${canonicalPeerId}`;
        
      case 'per-account-channel-peer':
        const acc = accountId || 'default';
        return `agent:${this.agentId}:${channel}:${acc}:dm:${canonicalPeerId}`;
        
      default:
        return `agent:${this.agentId}:${this.config.mainKey}`;
    }
  }
  
  /**
   * Build a session key for a group chat
   */
  buildGroupKey(channel: string, groupId: string, threadId?: string): string {
    let key = `agent:${this.agentId}:${channel}:group:${groupId}`;
    if (threadId) {
      key += `:topic:${threadId}`;
    }
    return key;
  }
  
  /**
   * Build a session key for a cron job
   */
  buildCronKey(jobId: string): string {
    return `cron:${jobId}`;
  }
  
  /**
   * Build a session key for a node
   */
  buildNodeKey(nodeId: string): string {
    return `node-${nodeId}`;
  }
  
  /**
   * Resolve identity links
   */
  private resolveIdentity(channel: string, peerId: string): string {
    if (!this.config.identityLinks) return peerId;
    
    const prefixedId = `${channel}:${peerId}`;
    
    for (const [canonical, links] of Object.entries(this.config.identityLinks)) {
      if (links.includes(prefixedId)) {
        return canonical;
      }
    }
    
    return peerId;
  }
}

// ============================================================================
// Session Manager
// ============================================================================

export class SessionManager extends EventEmitter {
  private config: SessionConfig;
  private store: SessionStore;
  private storePath: string;
  private transcriptDir: string;
  private keyBuilder: SessionKeyBuilder;
  private saveDebounce?: NodeJS.Timeout;
  
  constructor(agentId: string, config: Partial<SessionConfig> = {}) {
    super();
    
    this.config = {
      stateDir: config.stateDir || path.join(process.env.HOME || '', '.kit', 'agents', agentId),
      mainKey: config.mainKey || 'main',
      dmScope: config.dmScope || 'main',
      reset: config.reset || { mode: 'daily', atHour: 4 },
      resetByType: config.resetByType,
      resetByChannel: config.resetByChannel,
      identityLinks: config.identityLinks,
    };
    
    this.storePath = path.join(this.config.stateDir, 'sessions', 'sessions.json');
    this.transcriptDir = path.join(this.config.stateDir, 'sessions');
    this.keyBuilder = new SessionKeyBuilder(agentId, this.config);
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load or initialize store
    this.store = this.loadStore();
  }
  
  // ==========================================================================
  // Session CRUD
  // ==========================================================================
  
  /**
   * Get or create a session
   */
  async getOrCreate(
    key: string,
    type: SessionType,
    metadata?: Partial<Session>
  ): Promise<Session> {
    // Check if session exists and is valid
    let session = this.store.sessions[key];
    
    if (session && this.isExpired(session, type)) {
      // Archive old session
      await this.archiveSession(session);
      session = undefined;
    }
    
    if (!session) {
      session = this.createSession(key, type, metadata);
      this.store.sessions[key] = session;
      this.scheduleSave();
    }
    
    return session;
  }
  
  /**
   * Get session by key
   */
  get(key: string): Session | undefined {
    return this.store.sessions[key];
  }
  
  /**
   * List all sessions
   */
  list(options?: { active?: boolean; type?: SessionType; channel?: string }): Session[] {
    let sessions = Object.values(this.store.sessions);
    
    if (options?.active) {
      sessions = sessions.filter(s => s.enabled && !this.isExpired(s, s.type));
    }
    
    if (options?.type) {
      sessions = sessions.filter(s => s.type === options.type);
    }
    
    if (options?.channel) {
      sessions = sessions.filter(s => s.channel === options.channel);
    }
    
    return sessions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }
  
  /**
   * Update session
   */
  update(key: string, updates: Partial<Session>): Session | undefined {
    const session = this.store.sessions[key];
    if (!session) return undefined;
    
    Object.assign(session, updates, { updatedAt: new Date() });
    this.scheduleSave();
    this.emit('session.update', session);
    
    return session;
  }
  
  /**
   * Delete session
   */
  async delete(key: string): Promise<boolean> {
    const session = this.store.sessions[key];
    if (!session) return false;
    
    // Archive first
    await this.archiveSession(session);
    
    delete this.store.sessions[key];
    this.scheduleSave();
    this.emit('session.delete', key);
    
    return true;
  }
  
  // ==========================================================================
  // Transcript Management
  // ==========================================================================
  
  /**
   * Append entry to transcript
   */
  async appendTranscript(sessionKey: string, entry: TranscriptEntry): Promise<void> {
    const session = this.store.sessions[sessionKey];
    if (!session) return;
    
    const transcriptPath = this.getTranscriptPath(session);
    const line = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    }) + '\n';
    
    await fs.promises.appendFile(transcriptPath, line, 'utf-8');
    
    // Update token counts
    if (entry.tokens) {
      session.inputTokens += entry.tokens.input || 0;
      session.outputTokens += entry.tokens.output || 0;
      session.totalTokens = session.inputTokens + session.outputTokens;
    }
    
    session.updatedAt = new Date();
    this.scheduleSave();
  }
  
  /**
   * Get transcript entries
   */
  async getTranscript(
    sessionKey: string,
    options?: { limit?: number; offset?: number }
  ): Promise<TranscriptEntry[]> {
    const session = this.store.sessions[sessionKey];
    if (!session) return [];
    
    const transcriptPath = this.getTranscriptPath(session);
    if (!fs.existsSync(transcriptPath)) return [];
    
    const content = await fs.promises.readFile(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    let entries = lines.map(line => {
      const parsed = JSON.parse(line);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      } as TranscriptEntry;
    });
    
    // Apply offset and limit
    const offset = options?.offset || 0;
    const limit = options?.limit || entries.length;
    entries = entries.slice(offset, offset + limit);
    
    return entries;
  }
  
  // ==========================================================================
  // Compaction
  // ==========================================================================
  
  /**
   * Compact a session's transcript
   */
  async compact(
    sessionKey: string,
    summary: string,
    keepRecent: number = 10
  ): Promise<void> {
    const session = this.store.sessions[sessionKey];
    if (!session) return;
    
    const entries = await this.getTranscript(sessionKey);
    if (entries.length <= keepRecent) return;
    
    // Keep recent entries
    const recentEntries = entries.slice(-keepRecent);
    
    // Create compaction entry
    const compactionEntry: TranscriptEntry = {
      timestamp: new Date(),
      role: 'system',
      content: `[COMPACTION SUMMARY]\n${summary}`,
      metadata: {
        compactionNumber: session.compactionCount + 1,
        originalEntryCount: entries.length - keepRecent,
      },
    };
    
    // Rewrite transcript
    const transcriptPath = this.getTranscriptPath(session);
    const newContent = [compactionEntry, ...recentEntries]
      .map(e => JSON.stringify({ ...e, timestamp: e.timestamp.toISOString() }))
      .join('\n') + '\n';
    
    await fs.promises.writeFile(transcriptPath, newContent, 'utf-8');
    
    // Update session
    session.compactionCount++;
    session.lastCompactionAt = new Date();
    this.scheduleSave();
    
    this.emit('session.compact', { sessionKey, summary });
  }
  
  /**
   * Check if session needs compaction
   */
  needsCompaction(sessionKey: string, maxTokens: number): boolean {
    const session = this.store.sessions[sessionKey];
    if (!session) return false;
    
    return session.contextTokens > maxTokens * 0.9;
  }
  
  // ==========================================================================
  // Reset Policy
  // ==========================================================================
  
  /**
   * Check if session is expired
   */
  private isExpired(session: Session, type: SessionType): boolean {
    const policy = this.getResetPolicy(type, session.channel);
    const updatedAt = new Date(session.updatedAt);
    const now = new Date();
    
    // Daily reset check
    if (policy.mode === 'daily' || policy.mode === 'both') {
      const resetHour = policy.atHour ?? 4;
      const lastReset = new Date(now);
      lastReset.setHours(resetHour, 0, 0, 0);
      
      if (now.getHours() < resetHour) {
        lastReset.setDate(lastReset.getDate() - 1);
      }
      
      if (updatedAt < lastReset) {
        return true;
      }
    }
    
    // Idle reset check
    if (policy.mode === 'idle' || policy.mode === 'both') {
      const idleMs = (policy.idleMinutes ?? 120) * 60 * 1000;
      if (now.getTime() - updatedAt.getTime() > idleMs) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get reset policy for session type
   */
  private getResetPolicy(type: SessionType, channel?: string): ResetPolicy {
    // Channel override takes precedence
    if (channel && this.config.resetByChannel?.[channel]) {
      return this.config.resetByChannel[channel];
    }
    
    // Type override
    if (this.config.resetByType?.[type]) {
      return this.config.resetByType[type];
    }
    
    // Default policy
    return this.config.reset;
  }
  
  // ==========================================================================
  // Key Builders (Proxy to SessionKeyBuilder)
  // ==========================================================================
  
  buildDMKey(channel: string, peerId: string, accountId?: string): string {
    return this.keyBuilder.buildDMKey(channel, peerId, accountId);
  }
  
  buildGroupKey(channel: string, groupId: string, threadId?: string): string {
    return this.keyBuilder.buildGroupKey(channel, groupId, threadId);
  }
  
  buildCronKey(jobId: string): string {
    return this.keyBuilder.buildCronKey(jobId);
  }
  
  buildNodeKey(nodeId: string): string {
    return this.keyBuilder.buildNodeKey(nodeId);
  }
  
  // ==========================================================================
  // Persistence
  // ==========================================================================
  
  /**
   * Load store from disk
   */
  private loadStore(): SessionStore {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8');
        const store = JSON.parse(data);
        
        // Convert date strings back to Date objects
        for (const session of Object.values(store.sessions) as Session[]) {
          session.createdAt = new Date(session.createdAt);
          session.updatedAt = new Date(session.updatedAt);
          if (session.lastCompactionAt) {
            session.lastCompactionAt = new Date(session.lastCompactionAt);
          }
        }
        
        return store;
      }
    } catch (error) {
      console.error('Failed to load session store:', error);
    }
    
    return {
      version: 1,
      sessions: {},
      lastUpdated: new Date(),
    };
  }
  
  /**
   * Save store to disk (debounced)
   */
  private scheduleSave(): void {
    if (this.saveDebounce) {
      clearTimeout(this.saveDebounce);
    }
    
    this.saveDebounce = setTimeout(() => {
      this.saveStore();
    }, 1000);
  }
  
  /**
   * Save store immediately
   */
  private saveStore(): void {
    try {
      this.store.lastUpdated = new Date();
      fs.writeFileSync(
        this.storePath,
        JSON.stringify(this.store, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save session store:', error);
    }
  }
  
  /**
   * Force save (for shutdown)
   */
  async flush(): Promise<void> {
    if (this.saveDebounce) {
      clearTimeout(this.saveDebounce);
    }
    this.saveStore();
  }
  
  // ==========================================================================
  // Helpers
  // ==========================================================================
  
  /**
   * Create a new session
   */
  private createSession(
    key: string,
    type: SessionType,
    metadata?: Partial<Session>
  ): Session {
    const agentId = key.split(':')[1] || 'main';
    
    return {
      id: this.generateSessionId(),
      key,
      agentId,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      contextTokens: 0,
      compactionCount: 0,
      enabled: true,
      ...metadata,
    };
  }
  
  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
  
  /**
   * Get transcript path for session
   */
  private getTranscriptPath(session: Session): string {
    return path.join(this.transcriptDir, `${session.id}.jsonl`);
  }
  
  /**
   * Archive a session
   */
  private async archiveSession(session: Session): Promise<void> {
    const archiveDir = path.join(this.config.stateDir, 'sessions', 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    
    const transcriptPath = this.getTranscriptPath(session);
    if (fs.existsSync(transcriptPath)) {
      const archivePath = path.join(
        archiveDir,
        `${session.id}_${Date.now()}.jsonl`
      );
      await fs.promises.rename(transcriptPath, archivePath);
    }
  }
  
  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      this.config.stateDir,
      this.transcriptDir,
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
}

// Export factory function
export function createSessionManager(
  agentId: string,
  config?: Partial<SessionConfig>
): SessionManager {
  return new SessionManager(agentId, config);
}
