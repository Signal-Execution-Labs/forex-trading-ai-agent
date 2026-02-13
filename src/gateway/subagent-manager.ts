/**
 * K.I.T. Sub-Agent Manager
 * 
 * Implements isolated agent turns for task-specific work.
 * Inspired by OpenClaw's sub-agent system.
 * 
 * Sub-agents:
 * - Run in isolated sessions (subagent:<id>)
 * - Execute specific tasks without polluting main context
 * - Auto-terminate on completion
 * - Report results back to spawning session
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

export interface SubAgentConfig {
  /** Maximum concurrent sub-agents */
  maxConcurrent: number;
  /** Default timeout in seconds */
  defaultTimeout: number;
  /** State directory for persistence */
  stateDir: string;
}

export interface SubAgentTask {
  /** Unique task ID */
  id: string;
  /** Human-readable label */
  label: string;
  /** Task description/prompt */
  prompt: string;
  /** Session that spawned this sub-agent */
  parentSession: string;
  /** Model override (optional) */
  model?: string;
  /** Thinking level override (optional) */
  thinking?: 'off' | 'low' | 'medium' | 'high';
  /** Timeout in seconds */
  timeout: number;
  /** Created timestamp */
  createdAt: Date;
  /** Started timestamp */
  startedAt?: Date;
  /** Completed timestamp */
  completedAt?: Date;
  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  /** Result or error message */
  result?: string;
  /** Error details if failed */
  error?: string;
  /** Progress updates */
  progress: string[];
}

export interface SpawnParams {
  /** Task label (for display) */
  label: string;
  /** Task prompt/instructions */
  prompt: string;
  /** Parent session key */
  parentSession: string;
  /** Model override */
  model?: string;
  /** Thinking level */
  thinking?: 'off' | 'low' | 'medium' | 'high';
  /** Timeout in seconds (default: 300) */
  timeout?: number;
}

export interface SubAgentResult {
  taskId: string;
  label: string;
  status: 'completed' | 'failed' | 'timeout';
  result?: string;
  error?: string;
  duration: number;
}

// ============================================================================
// Sub-Agent Manager
// ============================================================================

export class SubAgentManager extends EventEmitter {
  private config: SubAgentConfig;
  private tasks: Map<string, SubAgentTask> = new Map();
  private running: Map<string, NodeJS.Timeout> = new Map();
  private chatHandler: any = null;
  
  constructor(config?: Partial<SubAgentConfig>) {
    super();
    
    this.config = {
      maxConcurrent: config?.maxConcurrent || 5,
      defaultTimeout: config?.defaultTimeout || 300,
      stateDir: config?.stateDir || path.join(os.homedir(), '.kit', 'subagents'),
    };
    
    // Ensure state directory exists
    if (!fs.existsSync(this.config.stateDir)) {
      fs.mkdirSync(this.config.stateDir, { recursive: true });
    }
    
    // Load persisted tasks
    this.loadTasks();
  }
  
  /**
   * Set the chat handler for executing sub-agent tasks
   */
  setChatHandler(handler: any): void {
    this.chatHandler = handler;
  }
  
  /**
   * Spawn a new sub-agent task
   */
  async spawn(params: SpawnParams): Promise<SubAgentTask> {
    // Check concurrent limit
    const runningCount = Array.from(this.tasks.values())
      .filter(t => t.status === 'running').length;
    
    if (runningCount >= this.config.maxConcurrent) {
      throw new Error(`Maximum concurrent sub-agents (${this.config.maxConcurrent}) reached`);
    }
    
    const task: SubAgentTask = {
      id: uuid(),
      label: params.label,
      prompt: params.prompt,
      parentSession: params.parentSession,
      model: params.model,
      thinking: params.thinking,
      timeout: params.timeout || this.config.defaultTimeout,
      createdAt: new Date(),
      status: 'pending',
      progress: [],
    };
    
    this.tasks.set(task.id, task);
    this.saveTasks();
    
    console.log(`[SubAgent] Spawned: ${task.label} (${task.id})`);
    this.emit('spawned', task);
    
    // Start execution asynchronously
    this.executeTask(task).catch(err => {
      console.error(`[SubAgent] Execution error for ${task.id}:`, err);
      task.status = 'failed';
      task.error = err.message;
      task.completedAt = new Date();
      this.saveTasks();
      this.emit('failed', task);
    });
    
    return task;
  }
  
  /**
   * Execute a sub-agent task
   */
  private async executeTask(task: SubAgentTask): Promise<void> {
    if (!this.chatHandler) {
      throw new Error('Chat handler not set - cannot execute sub-agent');
    }
    
    task.status = 'running';
    task.startedAt = new Date();
    task.progress.push(`Started at ${task.startedAt.toISOString()}`);
    this.saveTasks();
    this.emit('started', task);
    
    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      if (task.status === 'running') {
        task.status = 'timeout';
        task.completedAt = new Date();
        task.error = `Task timed out after ${task.timeout} seconds`;
        task.progress.push(`Timeout at ${task.completedAt.toISOString()}`);
        this.saveTasks();
        this.emit('timeout', task);
        console.log(`[SubAgent] Timeout: ${task.label} (${task.id})`);
      }
    }, task.timeout * 1000);
    
    this.running.set(task.id, timeoutHandle);
    
    try {
      // Build sub-agent system prompt
      const systemPrompt = this.buildSubAgentPrompt(task);
      
      // Create isolated session key
      const sessionKey = `subagent:${task.id}`;
      
      // Execute through chat handler
      const result = await this.chatHandler.processMessage(
        sessionKey,
        task.prompt,
        // Progress callback
        (chunk: string) => {
          task.progress.push(chunk.slice(0, 100) + (chunk.length > 100 ? '...' : ''));
          this.emit('progress', { taskId: task.id, chunk });
        },
        // Tool call callback
        (name: string, args: any) => {
          task.progress.push(`Tool: ${name}`);
          this.emit('tool_call', { taskId: task.id, name, args });
        },
        // Tool result callback
        (name: string, result: any) => {
          this.emit('tool_result', { taskId: task.id, name, result });
        },
        // Override system prompt for sub-agent context
        systemPrompt
      );
      
      // Clear timeout
      clearTimeout(timeoutHandle);
      this.running.delete(task.id);
      
      // Mark completed
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;
      task.progress.push(`Completed at ${task.completedAt.toISOString()}`);
      this.saveTasks();
      
      console.log(`[SubAgent] Completed: ${task.label} (${task.id})`);
      this.emit('completed', task);
      
    } catch (error: any) {
      clearTimeout(timeoutHandle);
      this.running.delete(task.id);
      
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error.message;
      task.progress.push(`Failed: ${error.message}`);
      this.saveTasks();
      
      console.error(`[SubAgent] Failed: ${task.label} (${task.id}):`, error);
      this.emit('failed', task);
    }
  }
  
  /**
   * Build the system prompt for a sub-agent
   */
  private buildSubAgentPrompt(task: SubAgentTask): string {
    return `# Sub-Agent Context

You are a **sub-agent** spawned by the main K.I.T. agent for a specific task.

## Your Task
**Label:** ${task.label}
**Spawned by:** ${task.parentSession}

## Rules
1. **Stay focused** - Do your assigned task, nothing else
2. **Complete the task** - Your response will be reported to the main agent
3. **Don't initiate** - No heartbeats, no proactive actions
4. **Be ephemeral** - You will be terminated after task completion

## Output
When complete, your response should include:
- What you accomplished or found
- Any relevant details the main agent should know
- Keep it concise but informative

## What You DON'T Do
- NO user conversations (that's main agent's job)
- NO external messages unless explicitly instructed
- NO cron jobs or persistent state
- NO pretending to be the main agent

## Session Info
- Session: subagent:${task.id}
- Timeout: ${task.timeout} seconds
- Started: ${task.startedAt?.toISOString() || 'now'}

Now execute your task:
`;
  }
  
  /**
   * Get a task by ID
   */
  get(taskId: string): SubAgentTask | undefined {
    return this.tasks.get(taskId);
  }
  
  /**
   * Get task status
   */
  status(taskId: string): Pick<SubAgentTask, 'id' | 'label' | 'status' | 'progress'> | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    
    return {
      id: task.id,
      label: task.label,
      status: task.status,
      progress: task.progress,
    };
  }
  
  /**
   * Wait for a task to complete
   */
  async wait(taskId: string, timeoutMs?: number): Promise<SubAgentResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    // Already completed
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'timeout') {
      return this.taskToResult(task);
    }
    
    // Wait for completion
    return new Promise((resolve, reject) => {
      const timeout = timeoutMs || (task.timeout * 1000 + 5000);
      
      const timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error(`Wait timeout for task ${taskId}`));
      }, timeout);
      
      const onComplete = (completedTask: SubAgentTask) => {
        if (completedTask.id === taskId) {
          cleanup();
          resolve(this.taskToResult(completedTask));
        }
      };
      
      const onFailed = (failedTask: SubAgentTask) => {
        if (failedTask.id === taskId) {
          cleanup();
          resolve(this.taskToResult(failedTask));
        }
      };
      
      const onTimeout = (timedOutTask: SubAgentTask) => {
        if (timedOutTask.id === taskId) {
          cleanup();
          resolve(this.taskToResult(timedOutTask));
        }
      };
      
      const cleanup = () => {
        clearTimeout(timeoutHandle);
        this.off('completed', onComplete);
        this.off('failed', onFailed);
        this.off('timeout', onTimeout);
      };
      
      this.on('completed', onComplete);
      this.on('failed', onFailed);
      this.on('timeout', onTimeout);
    });
  }
  
  /**
   * Convert task to result
   */
  private taskToResult(task: SubAgentTask): SubAgentResult {
    const duration = task.completedAt && task.startedAt
      ? task.completedAt.getTime() - task.startedAt.getTime()
      : 0;
    
    return {
      taskId: task.id,
      label: task.label,
      status: task.status as 'completed' | 'failed' | 'timeout',
      result: task.result,
      error: task.error,
      duration,
    };
  }
  
  /**
   * List all tasks
   */
  list(filter?: { status?: SubAgentTask['status']; parentSession?: string }): SubAgentTask[] {
    let tasks = Array.from(this.tasks.values());
    
    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }
    
    if (filter?.parentSession) {
      tasks = tasks.filter(t => t.parentSession === filter.parentSession);
    }
    
    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  /**
   * Cancel a running task
   */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') {
      return false;
    }
    
    // Clear timeout
    const timeout = this.running.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.running.delete(taskId);
    }
    
    task.status = 'failed';
    task.completedAt = new Date();
    task.error = 'Cancelled by user';
    task.progress.push('Cancelled');
    this.saveTasks();
    
    this.emit('cancelled', task);
    return true;
  }
  
  /**
   * Cleanup old completed tasks
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    
    for (const [id, task] of this.tasks) {
      if (
        (task.status === 'completed' || task.status === 'failed' || task.status === 'timeout') &&
        task.completedAt &&
        task.completedAt.getTime() < cutoff
      ) {
        this.tasks.delete(id);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.saveTasks();
    }
    
    return removed;
  }
  
  /**
   * Load tasks from disk
   */
  private loadTasks(): void {
    const filePath = path.join(this.config.stateDir, 'tasks.json');
    
    if (!fs.existsSync(filePath)) {
      return;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      for (const taskData of data) {
        const task: SubAgentTask = {
          ...taskData,
          createdAt: new Date(taskData.createdAt),
          startedAt: taskData.startedAt ? new Date(taskData.startedAt) : undefined,
          completedAt: taskData.completedAt ? new Date(taskData.completedAt) : undefined,
        };
        
        // Mark running tasks as failed (gateway restarted)
        if (task.status === 'running' || task.status === 'pending') {
          task.status = 'failed';
          task.error = 'Gateway restarted';
          task.completedAt = new Date();
        }
        
        this.tasks.set(task.id, task);
      }
      
      console.log(`[SubAgent] Loaded ${this.tasks.size} tasks`);
    } catch (error) {
      console.error('[SubAgent] Failed to load tasks:', error);
    }
  }
  
  /**
   * Save tasks to disk
   */
  private saveTasks(): void {
    const filePath = path.join(this.config.stateDir, 'tasks.json');
    
    try {
      const data = Array.from(this.tasks.values());
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[SubAgent] Failed to save tasks:', error);
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: SubAgentManager | null = null;

export function getSubAgentManager(): SubAgentManager {
  if (!instance) {
    instance = new SubAgentManager();
  }
  return instance;
}

export function createSubAgentManager(config?: Partial<SubAgentConfig>): SubAgentManager {
  instance = new SubAgentManager(config);
  return instance;
}
