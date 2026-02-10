/**
 * K.I.T. Brain Core
 * The main orchestrator for all AI decision-making.
 */

import { GoalParser, UserGoal, GoalConfig } from './goal-parser';
import { DecisionEngine, Decision, MarketOpportunity } from './decision-engine';
import { AutonomyManager, AutonomyLevel } from './autonomy-manager';
import { EventEmitter } from 'events';

export interface BrainConfig {
  autonomyLevel: AutonomyLevel;
  defaultGoal?: string;
  scanIntervalMs: number;
}

export interface BrainState {
  isRunning: boolean;
  currentGoal: UserGoal | null;
  pendingDecisions: Decision[];
  executedDecisions: Decision[];
  lastScanAt: Date | null;
}

export class BrainCore extends EventEmitter {
  private config: BrainConfig;
  private state: BrainState;
  private goalParser: GoalParser;
  private decisionEngine: DecisionEngine;
  private autonomyManager: AutonomyManager;
  private scanInterval: NodeJS.Timeout | null = null;
  
  constructor(config: Partial<BrainConfig> = {}) {
    super();
    
    this.config = {
      autonomyLevel: 'copilot',
      scanIntervalMs: 60000,  // 1 minute
      ...config,
    };
    
    this.state = {
      isRunning: false,
      currentGoal: null,
      pendingDecisions: [],
      executedDecisions: [],
      lastScanAt: null,
    };
    
    this.goalParser = new GoalParser();
    this.decisionEngine = new DecisionEngine();
    this.autonomyManager = new AutonomyManager({ level: this.config.autonomyLevel });
    
    if (this.config.defaultGoal) {
      this.setGoal(this.config.defaultGoal);
    }
  }
  
  start(): void {
    if (this.state.isRunning) return;
    
    console.log('🧠 K.I.T. Brain starting...');
    this.state.isRunning = true;
    
    // Start scanning
    this.scan();
    this.scanInterval = setInterval(() => this.scan(), this.config.scanIntervalMs);
    
    this.emit('started');
  }
  
  stop(): void {
    if (!this.state.isRunning) return;
    
    console.log('🧠 K.I.T. Brain stopping...');
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    this.state.isRunning = false;
    this.emit('stopped');
  }
  
  setGoal(input: string): UserGoal {
    const goal = this.goalParser.parse(input);
    this.state.currentGoal = goal;
    
    console.log(`🎯 Goal set: ${goal.type} (${goal.riskLevel} risk)`);
    this.emit('goal_updated', goal);
    
    return goal;
  }
  
  setAutonomyLevel(level: AutonomyLevel): void {
    this.autonomyManager.setLevel(level);
    this.emit('autonomy_changed', level);
  }
  
  private async scan(): Promise<void> {
    if (!this.state.isRunning) return;
    
    this.state.lastScanAt = new Date();
    
    // In production, this would scan all markets for opportunities
    // For now, emit a scan event that other components can use
    this.emit('scan', { timestamp: this.state.lastScanAt });
  }
  
  processOpportunity(opportunity: MarketOpportunity): Decision {
    const decision = this.decisionEngine.evaluate(opportunity);
    
    if (decision.action === 'execute') {
      const canAuto = this.autonomyManager.canExecute(
        opportunity.type,
        opportunity.potentialReturn,
        opportunity.asset
      );
      
      if (!canAuto) {
        decision.action = 'pending';
        decision.reason = 'Requires human approval';
        this.state.pendingDecisions.push(decision);
        this.emit('approval_needed', decision);
      } else {
        this.state.executedDecisions.push(decision);
        this.emit('execute', decision);
      }
    }
    
    return decision;
  }
  
  approve(decisionId: string): void {
    const index = this.state.pendingDecisions.findIndex(
      d => d.opportunity.id === decisionId
    );
    
    if (index === -1) return;
    
    const decision = this.state.pendingDecisions.splice(index, 1)[0];
    decision.action = 'execute';
    this.state.executedDecisions.push(decision);
    
    this.emit('approved', decision);
    this.emit('execute', decision);
  }
  
  reject(decisionId: string): void {
    const index = this.state.pendingDecisions.findIndex(
      d => d.opportunity.id === decisionId
    );
    
    if (index === -1) return;
    
    const decision = this.state.pendingDecisions.splice(index, 1)[0];
    decision.action = 'skip';
    
    this.emit('rejected', decision);
  }
  
  getState(): BrainState {
    return { ...this.state };
  }
}

export default BrainCore;
