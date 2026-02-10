/**
 * K.I.T. Autonomy Manager
 * Controls the level of autonomous operation.
 */

export type AutonomyLevel = 'manual' | 'assisted' | 'copilot' | 'autopilot';

export interface AutonomyConfig {
  level: AutonomyLevel;
  maxTradeUsd: number;
  requireApprovalAbove: number;
  allowedActions: string[];
  blockedAssets: string[];
}

export class AutonomyManager {
  private config: AutonomyConfig;
  
  constructor(config: Partial<AutonomyConfig> = {}) {
    this.config = {
      level: 'copilot',
      maxTradeUsd: 1000,
      requireApprovalAbove: 500,
      allowedActions: ['buy', 'sell', 'stake', 'unstake', 'swap'],
      blockedAssets: [],
      ...config,
    };
  }
  
  getLevel(): AutonomyLevel {
    return this.config.level;
  }
  
  setLevel(level: AutonomyLevel): void {
    this.config.level = level;
    console.log(`Autonomy level set to: ${level}`);
  }
  
  canExecute(action: string, amountUsd: number, asset: string): boolean {
    // Manual mode: never auto-execute
    if (this.config.level === 'manual') {
      return false;
    }
    
    // Check blocked assets
    if (this.config.blockedAssets.includes(asset)) {
      return false;
    }
    
    // Check allowed actions
    if (!this.config.allowedActions.includes(action)) {
      return false;
    }
    
    // Check amount thresholds
    if (amountUsd > this.config.maxTradeUsd) {
      return false;
    }
    
    // Assisted mode: only very small trades
    if (this.config.level === 'assisted' && amountUsd > 100) {
      return false;
    }
    
    // Copilot mode: requires approval above threshold
    if (this.config.level === 'copilot' && amountUsd > this.config.requireApprovalAbove) {
      return false;
    }
    
    // Autopilot mode: execute everything within limits
    return true;
  }
  
  needsApproval(amountUsd: number): boolean {
    if (this.config.level === 'manual' || this.config.level === 'assisted') {
      return true;
    }
    if (this.config.level === 'copilot') {
      return amountUsd > this.config.requireApprovalAbove;
    }
    return false;  // Autopilot
  }
  
  getConfig(): AutonomyConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<AutonomyConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

export default AutonomyManager;
