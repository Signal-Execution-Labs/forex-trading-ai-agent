/**
 * K.I.T. Task Scheduler Tool
 * 
 * Issue #6: Task Scheduler - Cron-like Automation
 * 
 * Provides scheduling capabilities:
 * - Cron-style scheduling
 * - One-time scheduled tasks
 * - Recurring market checks
 * - Strategy execution scheduling
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export type TaskType = 'market_check' | 'portfolio_snapshot' | 'strategy_run' | 'alert_check' | 'custom';

export interface ScheduledTask {
  id: string;
  name: string;
  type: TaskType;
  schedule: string; // Cron expression or 'once'
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  params?: Record<string, any>;
  createdAt: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  timestamp: number;
}

export interface SchedulerConfig {
  persistPath?: string;
  checkInterval?: number; // seconds
  maxHistory?: number;
  onTaskExecute?: (task: ScheduledTask) => Promise<any>;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  persistPath: path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'scheduler'),
  checkInterval: 60,
  maxHistory: 100,
};

// Simple cron parser for common patterns
interface CronParts {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

export class Scheduler extends EventEmitter {
  private config: SchedulerConfig;
  private tasks: Map<string, ScheduledTask> = new Map();
  private history: TaskResult[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private isRunning: boolean = false;

  constructor(config?: Partial<SchedulerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadTasks();
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    const intervalMs = (this.config.checkInterval || 60) * 1000;
    
    this.timer = setInterval(() => this.tick(), intervalMs);
    this.emit('started');
    
    // Initial check
    this.tick();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.persistTasks();
    this.emit('stopped');
  }

  /**
   * Create a scheduled task
   */
  createTask(params: {
    name: string;
    type: TaskType;
    schedule: string;
    taskParams?: Record<string, any>;
  }): ScheduledTask {
    const task: ScheduledTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: params.name,
      type: params.type,
      schedule: params.schedule,
      enabled: true,
      runCount: 0,
      params: params.taskParams,
      createdAt: Date.now(),
    };

    // Calculate next run
    task.nextRun = this.calculateNextRun(params.schedule);

    this.tasks.set(task.id, task);
    this.persistTasks();
    this.emit('taskCreated', task);

    return task;
  }

  /**
   * Schedule a market check
   */
  scheduleMarketCheck(symbol: string, schedule: string): ScheduledTask {
    return this.createTask({
      name: `Market check: ${symbol}`,
      type: 'market_check',
      schedule,
      taskParams: { symbol },
    });
  }

  /**
   * Schedule a portfolio snapshot
   */
  schedulePortfolioSnapshot(schedule: string): ScheduledTask {
    return this.createTask({
      name: 'Portfolio snapshot',
      type: 'portfolio_snapshot',
      schedule,
    });
  }

  /**
   * Schedule a strategy run
   */
  scheduleStrategyRun(strategy: string, symbol: string, schedule: string): ScheduledTask {
    return this.createTask({
      name: `Strategy: ${strategy} on ${symbol}`,
      type: 'strategy_run',
      schedule,
      taskParams: { strategy, symbol },
    });
  }

  /**
   * Schedule a one-time task
   */
  scheduleOnce(name: string, type: TaskType, delayMinutes: number, params?: Record<string, any>): ScheduledTask {
    const task: ScheduledTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      schedule: 'once',
      enabled: true,
      runCount: 0,
      params,
      createdAt: Date.now(),
      nextRun: Date.now() + delayMinutes * 60 * 1000,
    };

    this.tasks.set(task.id, task);
    this.persistTasks();
    this.emit('taskCreated', task);

    return task;
  }

  /**
   * List all tasks
   */
  listTasks(enabled?: boolean): ScheduledTask[] {
    const tasks = Array.from(this.tasks.values());
    if (enabled !== undefined) {
      return tasks.filter(t => t.enabled === enabled);
    }
    return tasks;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Enable a task
   */
  enableTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    task.enabled = true;
    task.nextRun = this.calculateNextRun(task.schedule);
    this.persistTasks();
    this.emit('taskEnabled', task);
    return true;
  }

  /**
   * Disable a task
   */
  disableTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    task.enabled = false;
    this.persistTasks();
    this.emit('taskDisabled', task);
    return true;
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    this.tasks.delete(taskId);
    this.persistTasks();
    this.emit('taskDeleted', task);
    return true;
  }

  /**
   * Run a task immediately
   */
  async runTask(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return this.executeTask(task);
  }

  /**
   * Get task history
   */
  getHistory(taskId?: string): TaskResult[] {
    if (taskId) {
      return this.history.filter(h => h.taskId === taskId);
    }
    return [...this.history];
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    taskCount: number;
    enabledTasks: number;
    nextTask?: { task: ScheduledTask; in: number };
  } {
    const enabledTasks = this.listTasks(true);
    const nextTask = enabledTasks
      .filter(t => t.nextRun)
      .sort((a, b) => (a.nextRun || 0) - (b.nextRun || 0))[0];

    return {
      running: this.isRunning,
      taskCount: this.tasks.size,
      enabledTasks: enabledTasks.length,
      nextTask: nextTask ? {
        task: nextTask,
        in: Math.max(0, (nextTask.nextRun || 0) - Date.now()),
      } : undefined,
    };
  }

  // Private methods

  private async tick(): Promise<void> {
    if (!this.isRunning) return;

    const now = Date.now();
    const tasksToRun: ScheduledTask[] = [];

    for (const task of this.tasks.values()) {
      if (task.enabled && task.nextRun && task.nextRun <= now) {
        tasksToRun.push(task);
      }
    }

    for (const task of tasksToRun) {
      try {
        await this.executeTask(task);
      } catch (error: any) {
        console.error(`Task ${task.id} failed:`, error.message);
      }
    }
  }

  private async executeTask(task: ScheduledTask): Promise<TaskResult> {
    const startTime = Date.now();
    let result: TaskResult;

    try {
      let taskResult: any;

      // Use custom handler if provided
      if (this.config.onTaskExecute) {
        taskResult = await this.config.onTaskExecute(task);
      } else {
        // Default behavior based on task type
        taskResult = await this.defaultTaskHandler(task);
      }

      result = {
        taskId: task.id,
        success: true,
        result: taskResult,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      result = {
        taskId: task.id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    // Update task
    task.lastRun = Date.now();
    task.runCount++;

    if (task.schedule === 'once') {
      task.enabled = false;
    } else {
      task.nextRun = this.calculateNextRun(task.schedule);
    }

    // Store history
    this.history.push(result);
    if (this.history.length > (this.config.maxHistory || 100)) {
      this.history.shift();
    }

    this.persistTasks();
    this.emit('taskExecuted', { task, result });

    return result;
  }

  private async defaultTaskHandler(task: ScheduledTask): Promise<any> {
    // Emit event for external handling
    this.emit(`task:${task.type}`, task.params);
    return { message: `Task type "${task.type}" executed`, params: task.params };
  }

  private calculateNextRun(schedule: string): number {
    if (schedule === 'once') {
      return Date.now();
    }

    try {
      const parts = this.parseCron(schedule);
      return this.getNextCronTime(parts);
    } catch {
      // Default to 1 hour if parsing fails
      console.warn(`Invalid cron expression: ${schedule}, defaulting to 1 hour`);
      return Date.now() + 60 * 60 * 1000;
    }
  }

  private parseCron(expression: string): CronParts {
    // Support common shortcuts
    const shortcuts: Record<string, string> = {
      '@hourly': '0 * * * *',
      '@daily': '0 0 * * *',
      '@weekly': '0 0 * * 0',
      '@monthly': '0 0 1 * *',
      '@yearly': '0 0 1 1 *',
    };

    const cron = shortcuts[expression] || expression;
    const parts = cron.split(/\s+/);

    if (parts.length !== 5) {
      throw new Error('Invalid cron expression');
    }

    return {
      minute: this.parseCronField(parts[0], 0, 59),
      hour: this.parseCronField(parts[1], 0, 23),
      dayOfMonth: this.parseCronField(parts[2], 1, 31),
      month: this.parseCronField(parts[3], 1, 12),
      dayOfWeek: this.parseCronField(parts[4], 0, 6),
    };
  }

  private parseCronField(field: string, min: number, max: number): number[] {
    if (field === '*') {
      return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }

    const values: number[] = [];

    for (const part of field.split(',')) {
      if (part.includes('/')) {
        const [range, step] = part.split('/');
        const stepNum = parseInt(step, 10);
        const [start, end] = range === '*' 
          ? [min, max] 
          : range.split('-').map(n => parseInt(n, 10));
        
        for (let i = start; i <= (end || max); i += stepNum) {
          values.push(i);
        }
      } else if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n, 10));
        for (let i = start; i <= end; i++) {
          values.push(i);
        }
      } else {
        values.push(parseInt(part, 10));
      }
    }

    return [...new Set(values)].sort((a, b) => a - b);
  }

  private getNextCronTime(parts: CronParts): number {
    const now = new Date();
    let next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);

    // Start from next minute
    next.setMinutes(next.getMinutes() + 1);

    // Find next matching time (max 1 year ahead)
    const maxIterations = 365 * 24 * 60;
    
    for (let i = 0; i < maxIterations; i++) {
      const minute = next.getMinutes();
      const hour = next.getHours();
      const dayOfMonth = next.getDate();
      const month = next.getMonth() + 1;
      const dayOfWeek = next.getDay();

      if (
        parts.minute.includes(minute) &&
        parts.hour.includes(hour) &&
        parts.dayOfMonth.includes(dayOfMonth) &&
        parts.month.includes(month) &&
        parts.dayOfWeek.includes(dayOfWeek)
      ) {
        return next.getTime();
      }

      next.setMinutes(next.getMinutes() + 1);
    }

    // Fallback to 1 hour
    return Date.now() + 60 * 60 * 1000;
  }

  private loadTasks(): void {
    if (!this.config.persistPath) return;
    try {
      const filePath = path.join(this.config.persistPath, 'tasks.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        for (const task of data.tasks || []) {
          this.tasks.set(task.id, task);
        }
        this.history = data.history || [];
        console.log(`Loaded ${this.tasks.size} scheduled tasks`);
      }
    } catch (e: any) {
      console.warn('Could not load tasks:', e.message);
    }
  }

  private persistTasks(): void {
    if (!this.config.persistPath) return;
    try {
      if (!fs.existsSync(this.config.persistPath)) {
        fs.mkdirSync(this.config.persistPath, { recursive: true });
      }
      fs.writeFileSync(
        path.join(this.config.persistPath, 'tasks.json'),
        JSON.stringify({
          tasks: Array.from(this.tasks.values()),
          history: this.history.slice(-(this.config.maxHistory || 100)),
        }, null, 2)
      );
    } catch (e: any) {
      console.error('Could not persist tasks:', e.message);
    }
  }
}

export function createScheduler(config?: Partial<SchedulerConfig>): Scheduler {
  return new Scheduler(config);
}

export default Scheduler;
