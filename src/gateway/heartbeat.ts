/**
 * K.I.T. Heartbeat System
 * Inspired by OpenClaw's Heartbeat Implementation
 * 
 * Features:
 * - Periodic agent turns
 * - HEARTBEAT.md checklist support
 * - Active hours configuration
 * - HEARTBEAT_OK response contract
 * - Target delivery configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface HeartbeatConfig {
  enabled: boolean;
  every: number; // milliseconds
  prompt: string;
  model?: string;
  target: 'last' | 'none' | string; // channel id or 'last' or 'none'
  to?: string; // specific recipient
  accountId?: string;
  session?: string;
  ackMaxChars: number;
  includeReasoning: boolean;
  activeHours?: {
    start: string; // HH:MM
    end: string; // HH:MM
    timezone?: string;
  };
}

export interface HeartbeatState {
  lastRun?: Date;
  lastResult?: HeartbeatResult;
  runCount: number;
  ackCount: number;
  alertCount: number;
}

export interface HeartbeatResult {
  timestamp: Date;
  duration: number;
  response: string;
  isAck: boolean;
  delivered: boolean;
  target?: string;
  error?: string;
}

export type HeartbeatHandler = (params: {
  prompt: string;
  model?: string;
  session?: string;
}) => Promise<{
  response: string;
  reasoning?: string;
}>;

export type DeliveryHandler = (params: {
  target: string;
  to?: string;
  accountId?: string;
  message: string;
  reasoning?: string;
}) => Promise<boolean>;

// ============================================================================
// Default Prompt
// ============================================================================

export const DEFAULT_HEARTBEAT_PROMPT = `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.

Consider:
- Outstanding tasks or follow-ups
- Time-sensitive items (market hours, appointments)
- Any alerts or notifications that need action
- Proactive work you can do without asking

If it's during active hours and nothing urgent, a brief check-in is welcome.
If outside active hours or nothing needs attention, reply with HEARTBEAT_OK.`;

// ============================================================================
// Heartbeat Manager
// ============================================================================

export class HeartbeatManager extends EventEmitter {
  private config: HeartbeatConfig;
  private state: HeartbeatState;
  private workspaceDir: string;
  private timer?: NodeJS.Timeout;
  private handler?: HeartbeatHandler;
  private deliveryHandler?: DeliveryHandler;
  private isRunning = false;
  
  constructor(
    agentId: string,
    config: Partial<HeartbeatConfig> = {},
    workspaceDir?: string
  ) {
    super();
    
    this.config = {
      enabled: config.enabled ?? true,
      every: config.every ?? 30 * 60 * 1000, // 30 minutes default
      prompt: config.prompt ?? DEFAULT_HEARTBEAT_PROMPT,
      model: config.model,
      target: config.target ?? 'last',
      to: config.to,
      accountId: config.accountId,
      session: config.session,
      ackMaxChars: config.ackMaxChars ?? 300,
      includeReasoning: config.includeReasoning ?? false,
      activeHours: config.activeHours,
    };
    
    this.workspaceDir = workspaceDir || path.join(
      process.env.HOME || '',
      '.kit',
      'workspace'
    );
    
    this.state = {
      runCount: 0,
      ackCount: 0,
      alertCount: 0,
    };
  }
  
  // ==========================================================================
  // Lifecycle
  // ==========================================================================
  
  /**
   * Start heartbeat timer
   */
  start(
    handler: HeartbeatHandler,
    deliveryHandler?: DeliveryHandler
  ): void {
    if (!this.config.enabled) {
      console.log('Heartbeat is disabled');
      return;
    }
    
    this.handler = handler;
    this.deliveryHandler = deliveryHandler;
    
    // Clear existing timer
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    // Start new timer
    this.timer = setInterval(() => {
      this.tick().catch(err => {
        console.error('Heartbeat tick failed:', err);
        this.emit('error', err);
      });
    }, this.config.every);
    
    console.log(`Heartbeat started with interval: ${this.config.every}ms`);
    this.emit('started');
    
    // Run first tick immediately if within active hours
    if (this.isWithinActiveHours()) {
      this.tick().catch(err => {
        console.error('Initial heartbeat tick failed:', err);
      });
    }
  }
  
  /**
   * Stop heartbeat timer
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    
    console.log('Heartbeat stopped');
    this.emit('stopped');
  }
  
  /**
   * Force a heartbeat run
   */
  async forceRun(): Promise<HeartbeatResult> {
    return this.tick(true);
  }
  
  // ==========================================================================
  // Core Logic
  // ==========================================================================
  
  /**
   * Execute a heartbeat tick
   */
  private async tick(force = false): Promise<HeartbeatResult> {
    // Check if already running
    if (this.isRunning && !force) {
      console.log('Heartbeat already running, skipping');
      return {
        timestamp: new Date(),
        duration: 0,
        response: '',
        isAck: true,
        delivered: false,
        error: 'Already running',
      };
    }
    
    // Check active hours
    if (!force && !this.isWithinActiveHours()) {
      console.log('Outside active hours, skipping heartbeat');
      return {
        timestamp: new Date(),
        duration: 0,
        response: '',
        isAck: true,
        delivered: false,
        error: 'Outside active hours',
      };
    }
    
    // Check HEARTBEAT.md
    const heartbeatMd = await this.readHeartbeatMd();
    if (heartbeatMd !== null && this.isHeartbeatMdEmpty(heartbeatMd)) {
      console.log('HEARTBEAT.md is empty, skipping');
      return {
        timestamp: new Date(),
        duration: 0,
        response: '',
        isAck: true,
        delivered: false,
        error: 'HEARTBEAT.md is empty',
      };
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      this.emit('tick.start');
      
      // Execute handler
      if (!this.handler) {
        throw new Error('No handler configured');
      }
      
      const { response, reasoning } = await this.handler({
        prompt: this.config.prompt,
        model: this.config.model,
        session: this.config.session,
      });
      
      const duration = Date.now() - startTime;
      
      // Check for HEARTBEAT_OK
      const { isAck, cleanedResponse } = this.processResponse(response);
      
      // Update state
      this.state.lastRun = new Date();
      this.state.runCount++;
      
      if (isAck) {
        this.state.ackCount++;
      } else {
        this.state.alertCount++;
      }
      
      // Handle delivery
      let delivered = false;
      
      if (!isAck && this.config.target !== 'none' && this.deliveryHandler) {
        try {
          delivered = await this.deliveryHandler({
            target: this.config.target,
            to: this.config.to,
            accountId: this.config.accountId,
            message: cleanedResponse,
            reasoning: this.config.includeReasoning ? reasoning : undefined,
          });
        } catch (err) {
          console.error('Heartbeat delivery failed:', err);
        }
      }
      
      const result: HeartbeatResult = {
        timestamp: new Date(),
        duration,
        response: cleanedResponse,
        isAck,
        delivered,
        target: isAck ? undefined : this.config.target,
      };
      
      this.state.lastResult = result;
      this.emit('tick.complete', result);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: HeartbeatResult = {
        timestamp: new Date(),
        duration,
        response: '',
        isAck: false,
        delivered: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      this.state.lastResult = result;
      this.emit('tick.error', result);
      
      return result;
      
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Process response for HEARTBEAT_OK
   */
  private processResponse(response: string): { isAck: boolean; cleanedResponse: string } {
    const trimmed = response.trim();
    
    // Check for HEARTBEAT_OK at start
    if (trimmed.startsWith('HEARTBEAT_OK')) {
      const remainder = trimmed.slice('HEARTBEAT_OK'.length).trim();
      
      if (remainder.length <= this.config.ackMaxChars) {
        return { isAck: true, cleanedResponse: remainder };
      }
    }
    
    // Check for HEARTBEAT_OK at end
    if (trimmed.endsWith('HEARTBEAT_OK')) {
      const remainder = trimmed.slice(0, -'HEARTBEAT_OK'.length).trim();
      
      if (remainder.length <= this.config.ackMaxChars) {
        return { isAck: true, cleanedResponse: remainder };
      }
    }
    
    // Check if entire response is just HEARTBEAT_OK
    if (trimmed === 'HEARTBEAT_OK') {
      return { isAck: true, cleanedResponse: '' };
    }
    
    return { isAck: false, cleanedResponse: trimmed };
  }
  
  // ==========================================================================
  // HEARTBEAT.md
  // ==========================================================================
  
  /**
   * Read HEARTBEAT.md file
   */
  private async readHeartbeatMd(): Promise<string | null> {
    const filePath = path.join(this.workspaceDir, 'HEARTBEAT.md');
    
    try {
      if (fs.existsSync(filePath)) {
        return await fs.promises.readFile(filePath, 'utf-8');
      }
    } catch (error) {
      console.error('Failed to read HEARTBEAT.md:', error);
    }
    
    return null;
  }
  
  /**
   * Check if HEARTBEAT.md is effectively empty
   */
  private isHeartbeatMdEmpty(content: string): boolean {
    // Remove markdown headers and blank lines
    const lines = content.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .filter(l => !l.startsWith('#'));
    
    return lines.length === 0;
  }
  
  // ==========================================================================
  // Active Hours
  // ==========================================================================
  
  /**
   * Check if current time is within active hours
   */
  private isWithinActiveHours(): boolean {
    if (!this.config.activeHours) {
      return true; // No restriction
    }
    
    const { start, end, timezone } = this.config.activeHours;
    
    // Get current time in the configured timezone
    const now = new Date();
    let currentHours: number;
    let currentMinutes: number;
    
    if (timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        });
        const parts = formatter.formatToParts(now);
        currentHours = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
        currentMinutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      } catch {
        currentHours = now.getHours();
        currentMinutes = now.getMinutes();
      }
    } else {
      currentHours = now.getHours();
      currentMinutes = now.getMinutes();
    }
    
    const currentTime = currentHours * 60 + currentMinutes;
    
    // Parse start and end times
    const [startHours, startMinutes] = start.split(':').map(Number);
    const [endHours, endMinutes] = end.split(':').map(Number);
    
    const startTime = startHours * 60 + startMinutes;
    let endTime = endHours * 60 + endMinutes;
    
    // Handle 24:00 as end of day
    if (end === '24:00') {
      endTime = 24 * 60;
    }
    
    return currentTime >= startTime && currentTime < endTime;
  }
  
  // ==========================================================================
  // Configuration
  // ==========================================================================
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<HeartbeatConfig>): void {
    const wasRunning = !!this.timer;
    
    if (wasRunning) {
      this.stop();
    }
    
    Object.assign(this.config, config);
    
    if (wasRunning && this.config.enabled && this.handler) {
      this.start(this.handler, this.deliveryHandler);
    }
  }
  
  /**
   * Get current state
   */
  getState(): HeartbeatState {
    return { ...this.state };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): HeartbeatConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createHeartbeatManager(
  agentId: string,
  config?: Partial<HeartbeatConfig>,
  workspaceDir?: string
): HeartbeatManager {
  return new HeartbeatManager(agentId, config, workspaceDir);
}

// ============================================================================
// Utility: Parse duration string
// ============================================================================

export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h)?$/);
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  
  const value = parseInt(match[1]);
  const unit = match[2] || 'm';
  
  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      return value * 60 * 1000;
  }
}
