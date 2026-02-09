/**
 * K.I.T. Task Scheduler - Automated Trading Task Management
 * Issue #6: Scheduled trading actions, DCA, rebalancing, reporting
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// ============================================================
// TYPES
// ============================================================

export type TaskType = 
  | 'dca'           // Dollar Cost Averaging
  | 'rebalance'     // Portfolio rebalancing
  | 'report'        // Generate and send reports
  | 'alert-check'   // Check alert conditions
  | 'price-check'   // Monitor prices
  | 'custom';       // User-defined tasks

export type TaskFrequency = 
  | 'once'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'cron';  // Custom cron expression

export interface ScheduledTask {
  id: string;
  name: string;
  type: TaskType;
  frequency: TaskFrequency;
  cronExpression?: string;  // For cron frequency
  enabled: boolean;
  
  // Timing
  nextRun: Date;
  lastRun?: Date;
  lastResult?: TaskResult;
  
  // Task-specific config
  config: TaskConfig;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  runCount: number;
  errorCount: number;
}

export interface TaskConfig {
  // DCA config
  symbol?: string;
  amount?: number;
  side?: 'buy' | 'sell';
  
  // Rebalance config
  targetAllocations?: Record<string, number>;  // symbol -> percentage
  threshold?: number;  // Rebalance when deviation exceeds this %
  
  // Report config
  reportType?: 'daily' | 'weekly' | 'monthly' | 'performance';
  recipients?: string[];  // Email, Telegram, etc.
  
  // Custom config
  action?: string;
  params?: Record<string, unknown>;
}

export interface TaskResult {
  success: boolean;
  executedAt: Date;
  duration: number;  // ms
  message: string;
  data?: unknown;
  error?: string;
}

export interface SchedulerConfig {
  enabled: boolean;
  checkIntervalMs: number;  // How often to check for due tasks
  maxConcurrentTasks: number;
  timezone: string;
  persistPath: string;
}

// ============================================================
// TASK SCHEDULER CLASS
// ============================================================

export class TaskScheduler extends EventEmitter {
  private tasks: Map<string, ScheduledTask> = new Map();
  private config: SchedulerConfig;
  private intervalId?: NodeJS.Timeout;
  private running: Set<string> = new Set();
  
  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      checkIntervalMs: 60000,  // Check every minute
      maxConcurrentTasks: 5,
      timezone: 'Europe/Berlin',
      persistPath: path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'scheduler'),
      ...config
    };
    
    this.ensureDirectory();
    this.loadTasks();
  }
  
  // --------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------
  
  start(): void {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTasks();
    }, this.config.checkIntervalMs);
    
    this.emit('started');
    console.log('🕐 Task Scheduler started');
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.emit('stopped');
    console.log('🕐 Task Scheduler stopped');
  }
  
  // --------------------------------------------------------
  // Task Management
  // --------------------------------------------------------
  
  createTask(params: {
    name: string;
    type: TaskType;
    frequency: TaskFrequency;
    cronExpression?: string;
    config: TaskConfig;
    startAt?: Date;
  }): ScheduledTask {
    const id = this.generateId();
    const now = new Date();
    
    const task: ScheduledTask = {
      id,
      name: params.name,
      type: params.type,
      frequency: params.frequency,
      cronExpression: params.cronExpression,
      enabled: true,
      nextRun: params.startAt || this.calculateNextRun(params.frequency, params.cronExpression),
      config: params.config,
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      errorCount: 0
    };
    
    this.tasks.set(id, task);
    this.saveTasks();
    this.emit('taskCreated', task);
    
    return task;
  }
  
  updateTask(id: string, updates: Partial<ScheduledTask>): ScheduledTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    
    const updated = {
      ...task,
      ...updates,
      updatedAt: new Date()
    };
    
    this.tasks.set(id, updated);
    this.saveTasks();
    this.emit('taskUpdated', updated);
    
    return updated;
  }
  
  deleteTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    
    this.tasks.delete(id);
    this.saveTasks();
    this.emit('taskDeleted', task);
    
    return true;
  }
  
  getTask(id: string): ScheduledTask | null {
    return this.tasks.get(id) || null;
  }
  
  listTasks(filter?: { type?: TaskType; enabled?: boolean }): ScheduledTask[] {
    let tasks = Array.from(this.tasks.values());
    
    if (filter?.type) {
      tasks = tasks.filter(t => t.type === filter.type);
    }
    if (filter?.enabled !== undefined) {
      tasks = tasks.filter(t => t.enabled === filter.enabled);
    }
    
    return tasks.sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
  }
  
  enableTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    
    task.enabled = true;
    task.nextRun = this.calculateNextRun(task.frequency, task.cronExpression);
    task.updatedAt = new Date();
    this.saveTasks();
    
    return true;
  }
  
  disableTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    
    task.enabled = false;
    task.updatedAt = new Date();
    this.saveTasks();
    
    return true;
  }
  
  // --------------------------------------------------------
  // DCA (Dollar Cost Averaging)
  // --------------------------------------------------------
  
  createDCATask(params: {
    name: string;
    symbol: string;
    amount: number;
    frequency: TaskFrequency;
    startAt?: Date;
  }): ScheduledTask {
    return this.createTask({
      name: params.name,
      type: 'dca',
      frequency: params.frequency,
      config: {
        symbol: params.symbol,
        amount: params.amount,
        side: 'buy'
      },
      startAt: params.startAt
    });
  }
  
  // --------------------------------------------------------
  // Rebalancing
  // --------------------------------------------------------
  
  createRebalanceTask(params: {
    name: string;
    targetAllocations: Record<string, number>;
    threshold: number;
    frequency: TaskFrequency;
  }): ScheduledTask {
    // Validate allocations sum to 100
    const sum = Object.values(params.targetAllocations).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.01) {
      throw new Error(`Target allocations must sum to 100%, got ${sum}%`);
    }
    
    return this.createTask({
      name: params.name,
      type: 'rebalance',
      frequency: params.frequency,
      config: {
        targetAllocations: params.targetAllocations,
        threshold: params.threshold
      }
    });
  }
  
  // --------------------------------------------------------
  // Reports
  // --------------------------------------------------------
  
  createReportTask(params: {
    name: string;
    reportType: 'daily' | 'weekly' | 'monthly' | 'performance';
    frequency: TaskFrequency;
    recipients?: string[];
  }): ScheduledTask {
    return this.createTask({
      name: params.name,
      type: 'report',
      frequency: params.frequency,
      config: {
        reportType: params.reportType,
        recipients: params.recipients
      }
    });
  }
  
  // --------------------------------------------------------
  // Execution
  // --------------------------------------------------------
  
  private async checkAndExecuteTasks(): Promise<void> {
    if (!this.config.enabled) return;
    
    const now = new Date();
    const dueTasks = this.listTasks({ enabled: true })
      .filter(t => t.nextRun <= now && !this.running.has(t.id));
    
    for (const task of dueTasks.slice(0, this.config.maxConcurrentTasks)) {
      this.executeTask(task);
    }
  }
  
  async executeTask(task: ScheduledTask): Promise<TaskResult> {
    if (this.running.has(task.id)) {
      return {
        success: false,
        executedAt: new Date(),
        duration: 0,
        message: 'Task already running',
        error: 'ALREADY_RUNNING'
      };
    }
    
    this.running.add(task.id);
    const startTime = Date.now();
    this.emit('taskStarted', task);
    
    let result: TaskResult;
    
    try {
      switch (task.type) {
        case 'dca':
          result = await this.executeDCA(task);
          break;
        case 'rebalance':
          result = await this.executeRebalance(task);
          break;
        case 'report':
          result = await this.executeReport(task);
          break;
        case 'alert-check':
          result = await this.executeAlertCheck(task);
          break;
        case 'price-check':
          result = await this.executePriceCheck(task);
          break;
        case 'custom':
          result = await this.executeCustom(task);
          break;
        default:
          result = {
            success: false,
            executedAt: new Date(),
            duration: Date.now() - startTime,
            message: `Unknown task type: ${task.type}`,
            error: 'UNKNOWN_TYPE'
          };
      }
    } catch (error) {
      result = {
        success: false,
        executedAt: new Date(),
        duration: Date.now() - startTime,
        message: `Task failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.stack : String(error)
      };
    }
    
    // Update task
    task.lastRun = result.executedAt;
    task.lastResult = result;
    task.runCount++;
    if (!result.success) task.errorCount++;
    
    // Schedule next run (unless one-time)
    if (task.frequency !== 'once') {
      task.nextRun = this.calculateNextRun(task.frequency, task.cronExpression);
    } else {
      task.enabled = false;
    }
    
    task.updatedAt = new Date();
    this.saveTasks();
    
    this.running.delete(task.id);
    this.emit('taskCompleted', task, result);
    
    return result;
  }
  
  // Task executors
  
  private async executeDCA(task: ScheduledTask): Promise<TaskResult> {
    const { symbol, amount, side } = task.config;
    
    // In real implementation, this would call the AutoTrader
    // For now, simulate the action
    const message = `DCA: ${side} ${amount} of ${symbol}`;
    
    console.log(`🤖 Executing DCA: ${symbol} - ${side} $${amount}`);
    
    return {
      success: true,
      executedAt: new Date(),
      duration: 100,
      message,
      data: { symbol, amount, side, orderId: `DCA-${Date.now()}` }
    };
  }
  
  private async executeRebalance(task: ScheduledTask): Promise<TaskResult> {
    const { targetAllocations, threshold } = task.config;
    
    // In real implementation, this would:
    // 1. Get current portfolio
    // 2. Calculate deviations
    // 3. Generate rebalance orders
    // 4. Execute orders
    
    console.log(`🔄 Executing Rebalance - Threshold: ${threshold}%`);
    
    return {
      success: true,
      executedAt: new Date(),
      duration: 500,
      message: `Rebalance check completed`,
      data: { targetAllocations, rebalanceNeeded: false }
    };
  }
  
  private async executeReport(task: ScheduledTask): Promise<TaskResult> {
    const { reportType, recipients } = task.config;
    
    console.log(`📊 Generating ${reportType} report`);
    
    // Generate report data
    const report = {
      type: reportType,
      generatedAt: new Date().toISOString(),
      summary: {
        totalValue: 50000,
        dayChange: 2.5,
        weekChange: -1.2,
        topPerformer: 'BTC',
        worstPerformer: 'SOL'
      }
    };
    
    return {
      success: true,
      executedAt: new Date(),
      duration: 200,
      message: `${reportType} report generated`,
      data: { report, sentTo: recipients }
    };
  }
  
  private async executeAlertCheck(task: ScheduledTask): Promise<TaskResult> {
    // Check all configured alerts
    console.log(`🔔 Checking alerts...`);
    
    return {
      success: true,
      executedAt: new Date(),
      duration: 150,
      message: 'Alert check completed',
      data: { alertsTriggered: 0 }
    };
  }
  
  private async executePriceCheck(task: ScheduledTask): Promise<TaskResult> {
    const { symbol } = task.config;
    
    console.log(`💰 Checking price for ${symbol || 'all assets'}...`);
    
    return {
      success: true,
      executedAt: new Date(),
      duration: 100,
      message: `Price check completed`,
      data: { symbol, price: 45000 }  // Mock
    };
  }
  
  private async executeCustom(task: ScheduledTask): Promise<TaskResult> {
    const { action, params } = task.config;
    
    console.log(`⚙️ Executing custom action: ${action}`);
    
    return {
      success: true,
      executedAt: new Date(),
      duration: 50,
      message: `Custom action '${action}' executed`,
      data: params
    };
  }
  
  // --------------------------------------------------------
  // Scheduling Helpers
  // --------------------------------------------------------
  
  private calculateNextRun(frequency: TaskFrequency, cronExpression?: string): Date {
    const now = new Date();
    
    switch (frequency) {
      case 'once':
        return now;
        
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000);
        
      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);  // 9 AM
        return tomorrow;
        
      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay() + 1) % 7 || 7);
        nextWeek.setHours(9, 0, 0, 0);
        return nextWeek;
        
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(9, 0, 0, 0);
        return nextMonth;
        
      case 'cron':
        // Simplified cron parsing - in production use a library
        return this.parseCron(cronExpression || '0 9 * * *');
        
      default:
        return now;
    }
  }
  
  private parseCron(expression: string): Date {
    // Basic cron parser - format: minute hour day month dayOfWeek
    // For production, use a proper cron library like 'cron-parser'
    const parts = expression.split(' ');
    const [minute, hour] = parts.map(p => p === '*' ? 0 : parseInt(p));
    
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    
    if (next <= new Date()) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  }
  
  // --------------------------------------------------------
  // Persistence
  // --------------------------------------------------------
  
  private ensureDirectory(): void {
    if (!fs.existsSync(this.config.persistPath)) {
      fs.mkdirSync(this.config.persistPath, { recursive: true });
    }
  }
  
  private getTasksFilePath(): string {
    return path.join(this.config.persistPath, 'tasks.json');
  }
  
  private saveTasks(): void {
    const data = Array.from(this.tasks.entries());
    fs.writeFileSync(
      this.getTasksFilePath(),
      JSON.stringify(data, null, 2)
    );
  }
  
  private loadTasks(): void {
    const filePath = this.getTasksFilePath();
    if (!fs.existsSync(filePath)) return;
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.tasks = new Map(
        data.map(([id, task]: [string, ScheduledTask]) => [
          id,
          {
            ...task,
            nextRun: new Date(task.nextRun),
            lastRun: task.lastRun ? new Date(task.lastRun) : undefined,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt)
          }
        ])
      );
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }
  
  // --------------------------------------------------------
  // Utilities
  // --------------------------------------------------------
  
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  getStatus(): {
    running: boolean;
    taskCount: number;
    enabledCount: number;
    runningTasks: string[];
    nextTask: ScheduledTask | null;
  } {
    const tasks = this.listTasks({ enabled: true });
    
    return {
      running: !!this.intervalId,
      taskCount: this.tasks.size,
      enabledCount: tasks.length,
      runningTasks: Array.from(this.running),
      nextTask: tasks.length > 0 ? tasks[0] : null
    };
  }
}

// ============================================================
// FACTORY & EXPORT
// ============================================================

let schedulerInstance: TaskScheduler | null = null;

export function createTaskScheduler(config?: Partial<SchedulerConfig>): TaskScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new TaskScheduler(config);
  }
  return schedulerInstance;
}

export function getScheduler(): TaskScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new TaskScheduler();
  }
  return schedulerInstance;
}

export default TaskScheduler;
