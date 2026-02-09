/**
 * K.I.T. Cron Manager
 * Inspired by OpenClaw's Cron System
 * 
 * Features:
 * - Persistent job store
 * - Schedule types: at, every, cron
 * - Session targets: main, isolated
 * - Delivery modes: announce, none
 * - Run history with JSONL
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface CronConfig {
  enabled: boolean;
  storePath: string;
  maxConcurrentRuns: number;
}

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  agentId?: string;
  schedule: JobSchedule;
  sessionTarget: 'main' | 'isolated';
  wakeMode: 'now' | 'next-heartbeat';
  payload: JobPayload;
  delivery?: DeliveryConfig;
  enabled: boolean;
  deleteAfterRun: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
}

export type JobSchedule = 
  | { kind: 'at'; at: Date }
  | { kind: 'every'; everyMs: number }
  | { kind: 'cron'; expr: string; tz?: string };

export type JobPayload =
  | { kind: 'systemEvent'; text: string }
  | { kind: 'agentTurn'; message: string; model?: string; thinking?: string; timeoutSeconds?: number };

export interface DeliveryConfig {
  mode: 'announce' | 'none';
  channel?: string;
  to?: string;
  accountId?: string;
  bestEffort?: boolean;
}

export interface JobRun {
  id: string;
  jobId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'success' | 'failed' | 'skipped';
  response?: string;
  error?: string;
  delivered?: boolean;
  deliveryTarget?: string;
}

export interface CronStore {
  version: number;
  jobs: Record<string, CronJob>;
  lastUpdated: Date;
}

export type JobExecutor = (job: CronJob) => Promise<{
  response?: string;
  error?: string;
}>;

export type DeliveryExecutor = (job: CronJob, response: string) => Promise<boolean>;

// ============================================================================
// Cron Parser (simple implementation)
// ============================================================================

export function parseCronExpression(expr: string, tz?: string): Date | null {
  const parts = expr.split(' ');
  if (parts.length !== 5) {
    console.error('Invalid cron expression:', expr);
    return null;
  }
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  const now = new Date();
  let candidate = new Date(now);
  
  // Set to next minute
  candidate.setSeconds(0);
  candidate.setMilliseconds(0);
  candidate.setMinutes(candidate.getMinutes() + 1);
  
  // Find next matching time (limited to 366 days)
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (
      matchesCronField(candidate.getMinutes(), minute) &&
      matchesCronField(candidate.getHours(), hour) &&
      matchesCronField(candidate.getDate(), dayOfMonth) &&
      matchesCronField(candidate.getMonth() + 1, month) &&
      matchesCronField(candidate.getDay(), dayOfWeek)
    ) {
      return candidate;
    }
    
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  
  return null;
}

function matchesCronField(value: number, field: string): boolean {
  if (field === '*') return true;
  
  // Handle lists (1,2,3)
  if (field.includes(',')) {
    return field.split(',').some(f => matchesCronField(value, f));
  }
  
  // Handle ranges (1-5)
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return value >= start && value <= end;
  }
  
  // Handle steps (*/5)
  if (field.includes('/')) {
    const [base, step] = field.split('/');
    if (base === '*') {
      return value % Number(step) === 0;
    }
    const start = Number(base);
    return (value - start) % Number(step) === 0 && value >= start;
  }
  
  return value === Number(field);
}

// ============================================================================
// Cron Manager
// ============================================================================

export class CronManager extends EventEmitter {
  private config: CronConfig;
  private store: CronStore;
  private runHistoryDir: string;
  private timer?: NodeJS.Timeout;
  private executor?: JobExecutor;
  private deliveryExecutor?: DeliveryExecutor;
  private runningJobs: Map<string, JobRun> = new Map();
  
  constructor(config: Partial<CronConfig> = {}) {
    super();
    
    const stateDir = path.join(process.env.HOME || '', '.kit', 'cron');
    
    this.config = {
      enabled: config.enabled ?? true,
      storePath: config.storePath || path.join(stateDir, 'jobs.json'),
      maxConcurrentRuns: config.maxConcurrentRuns ?? 3,
    };
    
    this.runHistoryDir = path.join(stateDir, 'runs');
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load store
    this.store = this.loadStore();
    
    // Calculate next run times
    this.updateNextRunTimes();
  }
  
  // ==========================================================================
  // Lifecycle
  // ==========================================================================
  
  /**
   * Start the cron scheduler
   */
  start(executor: JobExecutor, deliveryExecutor?: DeliveryExecutor): void {
    if (!this.config.enabled) {
      console.log('Cron is disabled');
      return;
    }
    
    this.executor = executor;
    this.deliveryExecutor = deliveryExecutor;
    
    // Check every 10 seconds
    this.timer = setInterval(() => {
      this.tick().catch(err => {
        console.error('Cron tick failed:', err);
      });
    }, 10000);
    
    console.log('Cron scheduler started');
    this.emit('started');
  }
  
  /**
   * Stop the cron scheduler
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    
    console.log('Cron scheduler stopped');
    this.emit('stopped');
  }
  
  // ==========================================================================
  // Job CRUD
  // ==========================================================================
  
  /**
   * Add a new job
   */
  add(params: {
    name: string;
    description?: string;
    agentId?: string;
    schedule: JobSchedule;
    sessionTarget?: 'main' | 'isolated';
    wakeMode?: 'now' | 'next-heartbeat';
    payload: JobPayload;
    delivery?: DeliveryConfig;
    enabled?: boolean;
    deleteAfterRun?: boolean;
  }): CronJob {
    const id = this.generateJobId();
    
    const job: CronJob = {
      id,
      name: params.name,
      description: params.description,
      agentId: params.agentId,
      schedule: params.schedule,
      sessionTarget: params.sessionTarget || 'main',
      wakeMode: params.wakeMode || 'now',
      payload: params.payload,
      delivery: params.delivery,
      enabled: params.enabled ?? true,
      deleteAfterRun: params.deleteAfterRun ?? (params.schedule.kind === 'at'),
      createdAt: new Date(),
      updatedAt: new Date(),
      runCount: 0,
    };
    
    // Calculate next run time
    job.nextRunAt = this.calculateNextRun(job);
    
    this.store.jobs[id] = job;
    this.saveStore();
    
    this.emit('job.added', job);
    return job;
  }
  
  /**
   * Update a job
   */
  update(id: string, patch: Partial<Omit<CronJob, 'id' | 'createdAt'>>): CronJob | null {
    const job = this.store.jobs[id];
    if (!job) return null;
    
    Object.assign(job, patch, { updatedAt: new Date() });
    
    // Recalculate next run if schedule changed
    if (patch.schedule) {
      job.nextRunAt = this.calculateNextRun(job);
    }
    
    this.saveStore();
    this.emit('job.updated', job);
    
    return job;
  }
  
  /**
   * Remove a job
   */
  remove(id: string): boolean {
    const job = this.store.jobs[id];
    if (!job) return false;
    
    delete this.store.jobs[id];
    this.saveStore();
    
    this.emit('job.removed', id);
    return true;
  }
  
  /**
   * Get a job by ID
   */
  get(id: string): CronJob | undefined {
    return this.store.jobs[id];
  }
  
  /**
   * List all jobs
   */
  list(options?: { enabled?: boolean; agentId?: string }): CronJob[] {
    let jobs = Object.values(this.store.jobs);
    
    if (options?.enabled !== undefined) {
      jobs = jobs.filter(j => j.enabled === options.enabled);
    }
    
    if (options?.agentId) {
      jobs = jobs.filter(j => j.agentId === options.agentId);
    }
    
    return jobs.sort((a, b) => {
      const aNext = a.nextRunAt?.getTime() || Infinity;
      const bNext = b.nextRunAt?.getTime() || Infinity;
      return aNext - bNext;
    });
  }
  
  // ==========================================================================
  // Execution
  // ==========================================================================
  
  /**
   * Check for and run due jobs
   */
  private async tick(): Promise<void> {
    const now = new Date();
    const dueJobs = Object.values(this.store.jobs).filter(job => 
      job.enabled &&
      job.nextRunAt &&
      job.nextRunAt <= now &&
      !this.runningJobs.has(job.id)
    );
    
    // Respect max concurrent limit
    const available = this.config.maxConcurrentRuns - this.runningJobs.size;
    const toRun = dueJobs.slice(0, available);
    
    for (const job of toRun) {
      this.runJob(job, 'due').catch(err => {
        console.error(`Job ${job.id} failed:`, err);
      });
    }
  }
  
  /**
   * Run a specific job
   */
  async runJob(job: CronJob, mode: 'due' | 'force' = 'force'): Promise<JobRun> {
    // Check if already running
    if (this.runningJobs.has(job.id)) {
      return {
        id: this.generateRunId(),
        jobId: job.id,
        startedAt: new Date(),
        status: 'skipped',
        error: 'Job already running',
      };
    }
    
    // Check if due (when mode is 'due')
    if (mode === 'due' && job.nextRunAt && job.nextRunAt > new Date()) {
      return {
        id: this.generateRunId(),
        jobId: job.id,
        startedAt: new Date(),
        status: 'skipped',
        error: 'Not yet due',
      };
    }
    
    const run: JobRun = {
      id: this.generateRunId(),
      jobId: job.id,
      startedAt: new Date(),
      status: 'running',
    };
    
    this.runningJobs.set(job.id, run);
    this.emit('job.run.start', { job, run });
    
    try {
      if (!this.executor) {
        throw new Error('No executor configured');
      }
      
      // Execute job
      const result = await this.executor(job);
      
      run.completedAt = new Date();
      run.response = result.response;
      
      if (result.error) {
        run.status = 'failed';
        run.error = result.error;
      } else {
        run.status = 'success';
        
        // Handle delivery for isolated jobs with announce mode
        if (
          job.sessionTarget === 'isolated' &&
          job.delivery?.mode === 'announce' &&
          result.response &&
          this.deliveryExecutor
        ) {
          try {
            run.delivered = await this.deliveryExecutor(job, result.response);
            run.deliveryTarget = job.delivery.channel || 'last';
          } catch (err) {
            if (!job.delivery.bestEffort) {
              run.status = 'failed';
              run.error = `Delivery failed: ${err}`;
            }
          }
        }
      }
      
    } catch (error) {
      run.completedAt = new Date();
      run.status = 'failed';
      run.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Clean up
    this.runningJobs.delete(job.id);
    
    // Update job
    job.lastRunAt = run.startedAt;
    job.runCount++;
    job.nextRunAt = this.calculateNextRun(job);
    
    // Handle one-shot deletion
    if (run.status === 'success' && job.deleteAfterRun) {
      this.remove(job.id);
    } else {
      this.saveStore();
    }
    
    // Save run history
    await this.saveRunHistory(run);
    
    this.emit('job.run.complete', { job, run });
    return run;
  }
  
  /**
   * Manually run a job
   */
  async run(id: string, mode: 'force' | 'due' = 'force'): Promise<JobRun | null> {
    const job = this.store.jobs[id];
    if (!job) return null;
    
    return this.runJob(job, mode);
  }
  
  // ==========================================================================
  // Run History
  // ==========================================================================
  
  /**
   * Get run history for a job
   */
  async getRuns(jobId: string, options?: { limit?: number }): Promise<JobRun[]> {
    const historyPath = path.join(this.runHistoryDir, `${jobId}.jsonl`);
    
    if (!fs.existsSync(historyPath)) {
      return [];
    }
    
    const content = await fs.promises.readFile(historyPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    let runs = lines.map(line => {
      const parsed = JSON.parse(line);
      return {
        ...parsed,
        startedAt: new Date(parsed.startedAt),
        completedAt: parsed.completedAt ? new Date(parsed.completedAt) : undefined,
      } as JobRun;
    });
    
    // Sort by most recent first
    runs = runs.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    
    if (options?.limit) {
      runs = runs.slice(0, options.limit);
    }
    
    return runs;
  }
  
  /**
   * Save run to history
   */
  private async saveRunHistory(run: JobRun): Promise<void> {
    const historyPath = path.join(this.runHistoryDir, `${run.jobId}.jsonl`);
    const line = JSON.stringify({
      ...run,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString(),
    }) + '\n';
    
    await fs.promises.appendFile(historyPath, line, 'utf-8');
    
    // Prune old entries (keep last 100)
    await this.pruneRunHistory(run.jobId, 100);
  }
  
  /**
   * Prune run history to max entries
   */
  private async pruneRunHistory(jobId: string, maxEntries: number): Promise<void> {
    const historyPath = path.join(this.runHistoryDir, `${jobId}.jsonl`);
    
    if (!fs.existsSync(historyPath)) return;
    
    const content = await fs.promises.readFile(historyPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    if (lines.length > maxEntries) {
      const keepLines = lines.slice(-maxEntries);
      await fs.promises.writeFile(historyPath, keepLines.join('\n') + '\n', 'utf-8');
    }
  }
  
  // ==========================================================================
  // Schedule Calculation
  // ==========================================================================
  
  /**
   * Calculate next run time for a job
   */
  private calculateNextRun(job: CronJob): Date | undefined {
    if (!job.enabled) return undefined;
    
    const now = new Date();
    
    switch (job.schedule.kind) {
      case 'at':
        // One-shot: only if not yet past
        const atTime = new Date(job.schedule.at);
        return atTime > now ? atTime : undefined;
        
      case 'every':
        // Interval: from last run or now
        const lastRun = job.lastRunAt || job.createdAt;
        return new Date(lastRun.getTime() + job.schedule.everyMs);
        
      case 'cron':
        // Cron expression
        return parseCronExpression(job.schedule.expr, job.schedule.tz) || undefined;
        
      default:
        return undefined;
    }
  }
  
  /**
   * Update next run times for all jobs
   */
  private updateNextRunTimes(): void {
    for (const job of Object.values(this.store.jobs)) {
      job.nextRunAt = this.calculateNextRun(job);
    }
    this.saveStore();
  }
  
  // ==========================================================================
  // Persistence
  // ==========================================================================
  
  /**
   * Load store from disk
   */
  private loadStore(): CronStore {
    try {
      if (fs.existsSync(this.config.storePath)) {
        const data = fs.readFileSync(this.config.storePath, 'utf-8');
        const store = JSON.parse(data);
        
        // Convert date strings
        for (const job of Object.values(store.jobs) as CronJob[]) {
          job.createdAt = new Date(job.createdAt);
          job.updatedAt = new Date(job.updatedAt);
          if (job.lastRunAt) job.lastRunAt = new Date(job.lastRunAt);
          if (job.nextRunAt) job.nextRunAt = new Date(job.nextRunAt);
          
          if (job.schedule.kind === 'at') {
            job.schedule.at = new Date(job.schedule.at);
          }
        }
        
        return store;
      }
    } catch (error) {
      console.error('Failed to load cron store:', error);
    }
    
    return {
      version: 1,
      jobs: {},
      lastUpdated: new Date(),
    };
  }
  
  /**
   * Save store to disk
   */
  private saveStore(): void {
    try {
      this.store.lastUpdated = new Date();
      fs.writeFileSync(
        this.config.storePath,
        JSON.stringify(this.store, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save cron store:', error);
    }
  }
  
  // ==========================================================================
  // Helpers
  // ==========================================================================
  
  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  
  /**
   * Generate unique run ID
   */
  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  
  /**
   * Ensure directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      path.dirname(this.config.storePath),
      this.runHistoryDir,
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createCronManager(config?: Partial<CronConfig>): CronManager {
  return new CronManager(config);
}
