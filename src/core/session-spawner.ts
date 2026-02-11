/**
 * K.I.T. Session Spawner
 * 
 * Spawns isolated sub-agent sessions for background tasks.
 * Each sub-agent has its own context, memory, and can report results
 * back to the parent session.
 * 
 * Similar to OpenClaw's subagent system.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createAgentRunner, AgentRunner } from '../gateway/agent-runner';

// ============================================================================
// Types
// ============================================================================

export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SubAgentSession {
  id: string;
  label: string;
  parentSessionId: string;
  task: string;
  status: SessionStatus;
  progress?: number;
  result?: unknown;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface SpawnOptions {
  /** Human-readable label for the session */
  label?: string;
  /** Parent session that spawned this sub-agent */
  parentSessionId?: string;
  /** Model to use (defaults to parent's model) */
  model?: string;
  /** System prompt override */
  systemPrompt?: string;
  /** Timeout in milliseconds (default: 5 minutes) */
  timeoutMs?: number;
  /** Whether to announce results to parent (default: true) */
  announceResult?: boolean;
  /** Priority level */
  priority?: 'low' | 'normal' | 'high';
  /** Additional context/metadata */
  metadata?: Record<string, unknown>;
}

export interface SessionSpawnerConfig {
  /** Maximum concurrent sessions */
  maxConcurrent?: number;
  /** Default timeout in milliseconds */
  defaultTimeoutMs?: number;
  /** Default model for sub-agents */
  defaultModel?: string;
}

// ============================================================================
// Sub-Agent System Prompt
// ============================================================================

const SUBAGENT_SYSTEM_PROMPT = `You are a K.I.T. sub-agent spawned for a specific background task.

## Your Role
- You were created to handle a specific task assigned by the main agent
- Complete the task efficiently and report back
- You have access to tools but should focus on your assigned task

## Rules
1. **Stay focused** - Do your assigned task, nothing else
2. **Complete the task** - Your final response will be reported to the main agent
3. **Be concise** - Report results clearly and efficiently
4. **No side effects** - Don't send messages or take actions beyond your task

## Output Format
When complete, provide:
- What you accomplished
- Any relevant data or results
- Brief summary for the main agent`;

// ============================================================================
// Session Spawner
// ============================================================================

export class SessionSpawner extends EventEmitter {
  private sessions: Map<string, SubAgentSession> = new Map();
  private runners: Map<string, AgentRunner> = new Map();
  private config: Required<SessionSpawnerConfig>;
  private runningCount: number = 0;
  private pendingQueue: Array<{ session: SubAgentSession; options: SpawnOptions }> = [];

  constructor(config: SessionSpawnerConfig = {}) {
    super();
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 5,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 5 * 60 * 1000, // 5 minutes
      defaultModel: config.defaultModel ?? 'openai/gpt-4o-mini',
    };
  }

  /**
   * Spawn a new sub-agent session
   */
  async spawn(task: string, options: SpawnOptions = {}): Promise<SubAgentSession> {
    const sessionId = `subagent:${uuidv4()}`;
    const now = Date.now();

    const session: SubAgentSession = {
      id: sessionId,
      label: options.label || `SubAgent-${sessionId.slice(-8)}`,
      parentSessionId: options.parentSessionId || 'main',
      task,
      status: 'pending',
      createdAt: now,
      metadata: options.metadata,
    };

    this.sessions.set(sessionId, session);
    this.emit('session.created', { session });

    // Check if we can run immediately or need to queue
    if (this.runningCount < this.config.maxConcurrent) {
      await this.startSession(session, options);
    } else {
      this.pendingQueue.push({ session, options });
      this.emit('session.queued', { session, position: this.pendingQueue.length });
    }

    return session;
  }

  /**
   * Get a session by ID
   */
  get(sessionId: string): SubAgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all sessions
   */
  list(filter?: {
    status?: SessionStatus | SessionStatus[];
    parentSessionId?: string;
    limit?: number;
  }): SubAgentSession[] {
    let sessions = Array.from(this.sessions.values());

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      sessions = sessions.filter(s => statuses.includes(s.status));
    }

    if (filter?.parentSessionId) {
      sessions = sessions.filter(s => s.parentSessionId === filter.parentSessionId);
    }

    // Sort by creation time (newest first)
    sessions.sort((a, b) => b.createdAt - a.createdAt);

    if (filter?.limit) {
      sessions = sessions.slice(0, filter.limit);
    }

    return sessions;
  }

  /**
   * Send a message to a running session
   */
  async sendMessage(sessionId: string, message: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    const runner = this.runners.get(sessionId);

    if (!session || !runner) {
      return false;
    }

    if (session.status !== 'running') {
      return false;
    }

    try {
      await runner.chat(message, { sessionId });
      return true;
    } catch (error) {
      console.error(`Failed to send message to session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Cancel a session
   */
  async cancel(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // If pending, remove from queue
    const queueIndex = this.pendingQueue.findIndex(p => p.session.id === sessionId);
    if (queueIndex !== -1) {
      this.pendingQueue.splice(queueIndex, 1);
    }

    // If running, stop the runner
    const runner = this.runners.get(sessionId);
    if (runner) {
      await runner.stop();
      this.runners.delete(sessionId);
      this.runningCount--;
    }

    session.status = 'cancelled';
    session.completedAt = Date.now();
    this.emit('session.cancelled', { session });

    // Process queue
    this.processQueue();

    return true;
  }

  /**
   * Get status summary
   */
  getStatus(): {
    total: number;
    running: number;
    pending: number;
    completed: number;
    failed: number;
    maxConcurrent: number;
  } {
    const sessions = Array.from(this.sessions.values());
    return {
      total: sessions.length,
      running: sessions.filter(s => s.status === 'running').length,
      pending: sessions.filter(s => s.status === 'pending').length,
      completed: sessions.filter(s => s.status === 'completed').length,
      failed: sessions.filter(s => s.status === 'failed').length,
      maxConcurrent: this.config.maxConcurrent,
    };
  }

  /**
   * Clean up old sessions
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (
        session.completedAt &&
        session.completedAt < cutoff &&
        (session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled')
      ) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async startSession(session: SubAgentSession, options: SpawnOptions): Promise<void> {
    this.runningCount++;
    session.status = 'running';
    session.startedAt = Date.now();
    this.emit('session.started', { session });

    // Create sub-agent runner
    const runner = createAgentRunner({
      agentId: session.id,
      agentName: session.label,
      model: options.model || this.config.defaultModel,
      systemPrompt: options.systemPrompt || SUBAGENT_SYSTEM_PROMPT,
      tools: 'trading', // Sub-agents get trading tools
    });

    this.runners.set(session.id, runner);

    // Set up timeout
    const timeoutMs = options.timeoutMs || this.config.defaultTimeoutMs;
    const timeoutHandle = setTimeout(() => {
      this.handleTimeout(session.id);
    }, timeoutMs);

    // Collect response
    let response = '';

    runner.on('chat.chunk', ({ chunk }) => {
      response += chunk;
      session.progress = Math.min(95, (response.length / 1000) * 10); // Rough progress
      this.emit('session.progress', { session, progress: session.progress });
    });

    runner.on('chat.complete', async () => {
      clearTimeout(timeoutHandle);
      await this.completeSession(session.id, response, options);
    });

    runner.on('chat.error', async ({ error }) => {
      clearTimeout(timeoutHandle);
      await this.failSession(session.id, error);
    });

    // Start the runner and send the task
    try {
      await runner.start();
      await runner.chat(
        `# Your Task\n\n${session.task}\n\nComplete this task and report your results.`,
        { sessionId: session.id }
      );
    } catch (error) {
      clearTimeout(timeoutHandle);
      await this.failSession(session.id, error instanceof Error ? error.message : String(error));
    }
  }

  private async completeSession(
    sessionId: string,
    result: string,
    options: SpawnOptions
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.result = result;
    session.progress = 100;
    session.completedAt = Date.now();

    // Clean up runner
    const runner = this.runners.get(sessionId);
    if (runner) {
      await runner.stop();
      this.runners.delete(sessionId);
    }

    this.runningCount--;
    this.emit('session.completed', {
      session,
      result,
      announceToParent: options.announceResult !== false,
    });

    // Process queue
    this.processQueue();
  }

  private async failSession(sessionId: string, error: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'failed';
    session.error = error;
    session.completedAt = Date.now();

    // Clean up runner
    const runner = this.runners.get(sessionId);
    if (runner) {
      await runner.stop();
      this.runners.delete(sessionId);
    }

    this.runningCount--;
    this.emit('session.failed', { session, error });

    // Process queue
    this.processQueue();
  }

  private handleTimeout(sessionId: string): void {
    this.failSession(sessionId, 'Session timed out');
  }

  private processQueue(): void {
    while (this.runningCount < this.config.maxConcurrent && this.pendingQueue.length > 0) {
      const next = this.pendingQueue.shift();
      if (next) {
        this.startSession(next.session, next.options);
      }
    }
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let spawnerInstance: SessionSpawner | null = null;

export function getSessionSpawner(): SessionSpawner {
  if (!spawnerInstance) {
    spawnerInstance = new SessionSpawner();
  }
  return spawnerInstance;
}

export function createSessionSpawner(config?: SessionSpawnerConfig): SessionSpawner {
  return new SessionSpawner(config);
}
