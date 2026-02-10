/**
 * K.I.T. Autonomy Manager
 * 
 * Implements the THREE LEVELS OF AUTONOMY from VISION.md:
 * 
 * Level 1 - ASSISTANT: K.I.T. suggests, human approves everything
 * Level 2 - CO-PILOT: Small actions auto, large actions ask
 * Level 3 - AUTOPILOT: K.I.T. handles everything, human gets reports
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/18
 */

import { EventEmitter } from 'events';
import { 
  AutonomyLevel, 
  AutonomyConfig, 
  Decision, 
  TradeAction,
  BrainEvent 
} from './types';

export interface AutonomyState {
  config: AutonomyConfig;
  dailyStats: {
    tradesExecuted: number;
    totalVolume: number;
    profit: number;
    loss: number;
    positionsOpened: number;
  };
  paused: boolean;
  pauseReason?: string;
  lastActivity: Date;
}

const DEFAULT_THRESHOLDS = {
  maxTradeSize: 100,        // $100 max per trade
  maxDailyLoss: 50,         // $50 max daily loss
  maxPositions: 5,          // 5 positions max
  maxPortfolioPercent: 5    // 5% of portfolio per trade
};

/**
 * Autonomy Manager - Controls K.I.T.'s level of independence
 */
export class AutonomyManager extends EventEmitter {
  private state: AutonomyState;
  private portfolioValue: number = 0;
  
  constructor(config: Partial<AutonomyConfig> = {}) {
    super();
    
    this.state = {
      config: {
        level: 1,
        thresholds: DEFAULT_THRESHOLDS,
        notifications: 'all',
        reportFrequency: 'daily',
        ...config
      },
      dailyStats: this.createEmptyDailyStats(),
      paused: false,
      lastActivity: new Date()
    };
  }
  
  // ============================================
  // Configuration
  // ============================================
  
  /**
   * Set the autonomy level (1, 2, or 3)
   */
  setLevel(level: AutonomyLevel): void {
    if (level < 1 || level > 3) {
      throw new Error('Autonomy level must be 1, 2, or 3');
    }
    
    const oldLevel = this.state.config.level;
    this.state.config.level = level;
    
    this.emit('event', {
      type: 'autonomy_changed',
      config: this.state.config
    } as BrainEvent);
    
    console.log(`🤖 Autonomy level changed: ${oldLevel} → ${level}`);
    console.log(this.getLevelDescription(level));
  }
  
  /**
   * Get current autonomy level
   */
  getLevel(): AutonomyLevel {
    return this.state.config.level;
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutonomyConfig>): void {
    this.state.config = { ...this.state.config, ...config };
    this.emit('event', {
      type: 'autonomy_changed',
      config: this.state.config
    } as BrainEvent);
  }
  
  /**
   * Set portfolio value for percentage calculations
   */
  setPortfolioValue(value: number): void {
    this.portfolioValue = value;
  }
  
  // ============================================
  // Decision Approval
  // ============================================
  
  /**
   * Check if a decision requires user approval
   */
  requiresApproval(decision: Decision): boolean {
    const level = this.state.config.level;
    
    // Level 1: Everything requires approval
    if (level === 1) {
      return true;
    }
    
    // Level 3: Nothing requires approval (except paused state)
    if (level === 3) {
      return this.state.paused;
    }
    
    // Level 2: Check thresholds
    return this.exceedsThresholds(decision.action);
  }
  
  /**
   * Check if an action exceeds the configured thresholds
   */
  private exceedsThresholds(action: TradeAction): boolean {
    const thresholds = this.state.config.thresholds || DEFAULT_THRESHOLDS;
    const stats = this.state.dailyStats;
    
    // Calculate trade size in USD
    const tradeSize = action.amount * (action.price || 1);
    
    // Check max trade size
    if (tradeSize > thresholds.maxTradeSize) {
      return true;
    }
    
    // Check max portfolio percentage
    if (this.portfolioValue > 0) {
      const portfolioPercent = (tradeSize / this.portfolioValue) * 100;
      if (portfolioPercent > thresholds.maxPortfolioPercent) {
        return true;
      }
    }
    
    // Check max daily loss
    if (stats.loss >= thresholds.maxDailyLoss) {
      return true;
    }
    
    // Check max positions (for new positions only)
    if (action.side === 'buy' && stats.positionsOpened >= thresholds.maxPositions) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Record a completed trade for stats
   */
  recordTrade(tradeSize: number, profit: number): void {
    this.state.dailyStats.tradesExecuted++;
    this.state.dailyStats.totalVolume += tradeSize;
    
    if (profit >= 0) {
      this.state.dailyStats.profit += profit;
    } else {
      this.state.dailyStats.loss += Math.abs(profit);
    }
    
    this.state.lastActivity = new Date();
    this.checkDailyLimits();
  }
  
  /**
   * Record a new position opened
   */
  recordPositionOpened(): void {
    this.state.dailyStats.positionsOpened++;
    this.checkDailyLimits();
  }
  
  /**
   * Check if daily limits are exceeded and pause if needed
   */
  private checkDailyLimits(): void {
    const thresholds = this.state.config.thresholds || DEFAULT_THRESHOLDS;
    const stats = this.state.dailyStats;
    
    if (stats.loss >= thresholds.maxDailyLoss) {
      this.pause(`Daily loss limit reached: $${stats.loss.toFixed(2)}`);
    }
  }
  
  // ============================================
  // Pause/Resume
  // ============================================
  
  /**
   * Pause autonomous trading
   */
  pause(reason: string = 'Manual pause'): void {
    this.state.paused = true;
    this.state.pauseReason = reason;
    
    this.emit('event', {
      type: 'risk_alert',
      message: `Trading paused: ${reason}`,
      severity: 'warning'
    } as BrainEvent);
    
    console.log(`⏸️  Trading PAUSED: ${reason}`);
  }
  
  /**
   * Resume autonomous trading
   */
  resume(): void {
    this.state.paused = false;
    this.state.pauseReason = undefined;
    console.log('▶️  Trading RESUMED');
  }
  
  /**
   * Check if trading is paused
   */
  isPaused(): boolean {
    return this.state.paused;
  }
  
  // ============================================
  // Active Hours
  // ============================================
  
  /**
   * Check if we're within active trading hours
   */
  isWithinActiveHours(): boolean {
    const hours = this.state.config.activeHours;
    if (!hours) return true; // No restrictions
    
    const now = new Date();
    
    // Check weekday restriction
    if (hours.weekdaysOnly) {
      const day = now.getDay();
      if (day === 0 || day === 6) return false; // Sunday or Saturday
    }
    
    // Parse times
    const [startHour, startMin] = hours.start.split(':').map(Number);
    const [endHour, endMin] = hours.end.split(':').map(Number);
    
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  
  // ============================================
  // Daily Reset
  // ============================================
  
  /**
   * Reset daily statistics (call at midnight)
   */
  resetDailyStats(): void {
    this.state.dailyStats = this.createEmptyDailyStats();
    
    // Auto-resume if paused due to daily limits
    if (this.state.paused && this.state.pauseReason?.includes('Daily')) {
      this.resume();
    }
    
    console.log('📊 Daily stats reset');
  }
  
  private createEmptyDailyStats() {
    return {
      tradesExecuted: 0,
      totalVolume: 0,
      profit: 0,
      loss: 0,
      positionsOpened: 0
    };
  }
  
  // ============================================
  // Status & Descriptions
  // ============================================
  
  /**
   * Get current state
   */
  getState(): AutonomyState {
    return { ...this.state };
  }
  
  /**
   * Get human-readable description of a level
   */
  getLevelDescription(level: AutonomyLevel): string {
    const descriptions: Record<AutonomyLevel, string> = {
      1: `
🟢 LEVEL 1: ASSISTANT MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━
• K.I.T. analyzes and suggests trades
• YOU approve every action
• Full transparency and control
• Perfect for learning and building trust
      `.trim(),
      
      2: `
🟡 LEVEL 2: CO-PILOT MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━
• Small trades: AUTO (under $${this.state.config.thresholds?.maxTradeSize || 100})
• Large trades: Asks for approval
• Daily loss limit: $${this.state.config.thresholds?.maxDailyLoss || 50}
• Max positions: ${this.state.config.thresholds?.maxPositions || 5}
      `.trim(),
      
      3: `
🔴 LEVEL 3: FULL AUTOPILOT
━━━━━━━━━━━━━━━━━━━━━━━━━━
• K.I.T. handles EVERYTHING
• You get ${this.state.config.reportFrequency} reports
• Emergency alerts only
• THIS IS THE ULTIMATE GOAL
      `.trim()
    };
    
    return descriptions[level];
  }
  
  /**
   * Get status summary
   */
  getStatusSummary(): string {
    const { config, dailyStats, paused, pauseReason } = this.state;
    
    const lines = [
      `🤖 AUTONOMY STATUS`,
      `━━━━━━━━━━━━━━━━━━`,
      `Level: ${config.level} (${['', 'Assistant', 'Co-Pilot', 'Autopilot'][config.level]})`,
      `Status: ${paused ? `⏸️ PAUSED - ${pauseReason}` : '▶️ ACTIVE'}`,
      ``,
      `📊 TODAY'S STATS`,
      `━━━━━━━━━━━━━━━━━━`,
      `Trades: ${dailyStats.tradesExecuted}`,
      `Volume: $${dailyStats.totalVolume.toFixed(2)}`,
      `Profit: $${dailyStats.profit.toFixed(2)}`,
      `Loss: $${dailyStats.loss.toFixed(2)}`,
      `Net: $${(dailyStats.profit - dailyStats.loss).toFixed(2)}`
    ];
    
    if (config.level === 2 && config.thresholds) {
      lines.push(
        ``,
        `⚙️ THRESHOLDS`,
        `━━━━━━━━━━━━━━━━━━`,
        `Max trade: $${config.thresholds.maxTradeSize}`,
        `Max daily loss: $${config.thresholds.maxDailyLoss} (used: $${dailyStats.loss.toFixed(2)})`,
        `Max positions: ${config.thresholds.maxPositions} (open: ${dailyStats.positionsOpened})`
      );
    }
    
    return lines.join('\n');
  }
}

/**
 * Factory function
 */
export function createAutonomyManager(config?: Partial<AutonomyConfig>): AutonomyManager {
  return new AutonomyManager(config);
}

export { AutonomyConfig, AutonomyLevel };
