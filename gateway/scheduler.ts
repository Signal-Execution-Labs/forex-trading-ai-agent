/**
 * K.I.T. Task Scheduler
 * 
 * Cron-like scheduler for automated tasks:
 * - Portfolio rebalancing
 * - Daily/weekly reports
 * - Market scans
 * - News digests
 * - Dividend reinvestment
 */

import { EventEmitter } from 'events';

export type TaskFrequency = 
  | 'minute' 
  | 'hourly' 
  | 'daily' 
  | 'weekly' 
  | 'monthly'
  | 'cron';

export type TaskStatus = 'active' | 'paused' | 'completed' | 'error';

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  
  // Schedule
  frequency: TaskFrequency;
  cronExpression?: string;  // For custom schedules
  time?: string;            // "09:00" for daily
  dayOfWeek?: number;       // 0-6 for weekly
  dayOfMonth?: number;      // 1-31 for monthly
  timezone: string;
  
  // Task details
  type: string;
  params: any;
  
  // Status
  status: TaskStatus;
  lastRun?: Date;
  nextRun?: Date;
  lastResult?: any;
  lastError?: string;
  runCount: number;
  
  // Options
  enabled: boolean;
  retryOnError: boolean;
  maxRetries: number;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
}

export interface TaskResult {
  taskId: string;
  timestamp: Date;
  success: boolean;
  duration: number;  // ms
  result?: any;
  error?: string;
}

export class Scheduler extends EventEmitter {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private running: boolean = false;

  constructor() {
    super();
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) return;
    
    this.running = true;
    console.log('[Scheduler] Started');
    
    // Schedule all active tasks
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }
    
    this.emit('started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false;
    
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    
    console.log('[Scheduler] Stopped');
    this.emit('stopped');
  }

  /**
   * Add a new task
   */
  addTask(task: Omit<ScheduledTask, 'id' | 'status' | 'runCount'>): ScheduledTask {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const scheduledTask: ScheduledTask = {
      ...task,
      id,
      status: 'active',
      runCount: 0,
      nextRun: this.calculateNextRun(task as ScheduledTask),
    };
    
    this.tasks.set(id, scheduledTask);
    
    if (this.running && task.enabled) {
      this.scheduleTask(scheduledTask);
    }
    
    console.log(`[Scheduler] Task added: ${task.name} (${task.frequency})`);
    this.emit('task:added', scheduledTask);
    
    return scheduledTask;
  }

  /**
   * Remove a task
   */
  removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    // Clear timer
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }
    
    this.tasks.delete(taskId);
    this.emit('task:removed', task);
    
    return true;
  }

  /**
   * Pause a task
   */
  pauseTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.enabled = false;
    task.status = 'paused';
    
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }
    
    this.emit('task:paused', task);
    return true;
  }

  /**
   * Resume a task
   */
  resumeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.enabled = true;
    task.status = 'active';
    task.nextRun = this.calculateNextRun(task);
    
    if (this.running) {
      this.scheduleTask(task);
    }
    
    this.emit('task:resumed', task);
    return true;
  }

  /**
   * Run a task immediately
   */
  async runTaskNow(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    
    return await this.executeTask(task);
  }

  /**
   * Schedule a task
   */
  private scheduleTask(task: ScheduledTask): void {
    if (!task.nextRun) {
      task.nextRun = this.calculateNextRun(task);
    }
    
    const delay = task.nextRun.getTime() - Date.now();
    
    if (delay < 0) {
      // If next run is in the past, calculate new next run
      task.nextRun = this.calculateNextRun(task);
      this.scheduleTask(task);
      return;
    }
    
    // Clear existing timer
    const existingTimer = this.timers.get(task.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer
    const timer = setTimeout(async () => {
      await this.executeTask(task);
      
      // Schedule next run
      if (task.enabled && this.running) {
        task.nextRun = this.calculateNextRun(task);
        this.scheduleTask(task);
      }
    }, Math.min(delay, 2147483647)); // Max timeout value
    
    this.timers.set(task.id, timer);
    
    console.log(`[Scheduler] Task scheduled: ${task.name} at ${task.nextRun.toISOString()}`);
  }

  /**
   * Execute a task
   */
  private async executeTask(task: ScheduledTask): Promise<TaskResult> {
    const startTime = Date.now();
    
    console.log(`[Scheduler] Executing: ${task.name}`);
    this.emit('task:start', task);
    
    const result: TaskResult = {
      taskId: task.id,
      timestamp: new Date(),
      success: false,
      duration: 0,
    };
    
    try {
      // Emit execute event - actual execution handled by listeners
      const executeResult = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Task timeout'));
        }, 5 * 60 * 1000); // 5 minute timeout
        
        this.emit('task:execute', task, (err: any, res: any) => {
          clearTimeout(timeout);
          if (err) reject(err);
          else resolve(res);
        });
      });
      
      result.success = true;
      result.result = executeResult;
      task.lastResult = executeResult;
      task.lastError = undefined;
      
    } catch (error: any) {
      result.success = false;
      result.error = error.message;
      task.lastError = error.message;
      task.status = 'error';
      
      console.error(`[Scheduler] Task error: ${task.name}`, error);
      
      if (task.notifyOnError) {
        this.emit('task:notify', task, 'error', error.message);
      }
    }
    
    result.duration = Date.now() - startTime;
    task.lastRun = new Date();
    task.runCount++;
    
    this.emit('task:complete', task, result);
    
    if (result.success && task.notifyOnComplete) {
      this.emit('task:notify', task, 'complete', result.result);
    }
    
    return result;
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(task: ScheduledTask): Date {
    const now = new Date();
    const next = new Date(now);
    
    switch (task.frequency) {
      case 'minute':
        next.setMinutes(next.getMinutes() + 1);
        next.setSeconds(0);
        break;
        
      case 'hourly':
        next.setHours(next.getHours() + 1);
        next.setMinutes(0);
        next.setSeconds(0);
        break;
        
      case 'daily':
        if (task.time) {
          const [hours, minutes] = task.time.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
          if (next <= now) {
            next.setDate(next.getDate() + 1);
          }
        } else {
          next.setDate(next.getDate() + 1);
          next.setHours(0, 0, 0, 0);
        }
        break;
        
      case 'weekly':
        const targetDay = task.dayOfWeek ?? 1; // Default Monday
        const currentDay = next.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        next.setDate(next.getDate() + daysUntil);
        if (task.time) {
          const [hours, minutes] = task.time.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
        } else {
          next.setHours(9, 0, 0, 0); // Default 9 AM
        }
        break;
        
      case 'monthly':
        const targetDate = task.dayOfMonth ?? 1;
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDate);
        if (task.time) {
          const [hours, minutes] = task.time.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
        } else {
          next.setHours(9, 0, 0, 0);
        }
        break;
        
      case 'cron':
        // Simplified cron parsing (would need a library for full support)
        // For now, fall back to hourly
        next.setHours(next.getHours() + 1);
        next.setMinutes(0);
        next.setSeconds(0);
        break;
    }
    
    return next;
  }

  /**
   * Get all tasks
   */
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get upcoming tasks
   */
  getUpcomingTasks(limit = 10): ScheduledTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.enabled && t.nextRun)
      .sort((a, b) => (a.nextRun?.getTime() || 0) - (b.nextRun?.getTime() || 0))
      .slice(0, limit);
  }
}

/**
 * Pre-defined task templates
 */
export const TaskTemplates = {
  dailyReport: {
    name: 'Daily Performance Report',
    description: 'Generate and send daily portfolio performance report',
    frequency: 'daily' as TaskFrequency,
    time: '08:00',
    timezone: 'Europe/Berlin',
    type: 'report',
    params: { reportType: 'daily' },
    enabled: true,
    retryOnError: true,
    maxRetries: 3,
    notifyOnComplete: true,
    notifyOnError: true,
  },
  
  weeklyReport: {
    name: 'Weekly Performance Report',
    description: 'Generate and send weekly portfolio summary',
    frequency: 'weekly' as TaskFrequency,
    dayOfWeek: 1, // Monday
    time: '09:00',
    timezone: 'Europe/Berlin',
    type: 'report',
    params: { reportType: 'weekly' },
    enabled: true,
    retryOnError: true,
    maxRetries: 3,
    notifyOnComplete: true,
    notifyOnError: true,
  },
  
  portfolioRebalance: {
    name: 'Portfolio Rebalancing',
    description: 'Check and rebalance portfolio allocations',
    frequency: 'weekly' as TaskFrequency,
    dayOfWeek: 0, // Sunday
    time: '20:00',
    timezone: 'Europe/Berlin',
    type: 'rebalance',
    params: { threshold: 5 }, // Rebalance if >5% drift
    enabled: false, // Disabled by default - user must enable
    retryOnError: false,
    maxRetries: 0,
    notifyOnComplete: true,
    notifyOnError: true,
  },
  
  marketScan: {
    name: 'Market Opportunity Scan',
    description: 'Scan markets for trading opportunities',
    frequency: 'hourly' as TaskFrequency,
    timezone: 'Europe/Berlin',
    type: 'scan',
    params: { pairs: ['BTC/USDT', 'ETH/USDT'] },
    enabled: true,
    retryOnError: true,
    maxRetries: 2,
    notifyOnComplete: false,
    notifyOnError: true,
  },
  
  newsDigest: {
    name: 'News Digest',
    description: 'Compile and analyze market news',
    frequency: 'daily' as TaskFrequency,
    time: '07:00',
    timezone: 'Europe/Berlin',
    type: 'news',
    params: { sources: ['coindesk', 'cointelegraph', 'reuters'] },
    enabled: true,
    retryOnError: true,
    maxRetries: 3,
    notifyOnComplete: true,
    notifyOnError: false,
  },
  
  dividendCheck: {
    name: 'Dividend Reinvestment Check',
    description: 'Check for received dividends and reinvest if configured',
    frequency: 'daily' as TaskFrequency,
    time: '10:00',
    timezone: 'Europe/Berlin',
    type: 'dividend',
    params: { autoReinvest: false },
    enabled: false,
    retryOnError: true,
    maxRetries: 2,
    notifyOnComplete: true,
    notifyOnError: true,
  },
};
