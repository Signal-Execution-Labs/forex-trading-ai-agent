/**
 * K.I.T. Auto-Pilot Engine
 * 
 * The brain of K.I.T. - makes autonomous trading decisions.
 * Operates in three modes: manual, semi-auto, full-auto.
 */

import { EventEmitter } from 'events';

export type AutoPilotMode = 'manual' | 'semi-auto' | 'full-auto';
export type DecisionType = 'trade' | 'rebalance' | 'alert' | 'report';
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';

export interface Decision {
  id: string;
  type: DecisionType;
  timestamp: Date;
  status: DecisionStatus;
  
  // What the decision is about
  action: string;
  params: any;
  
  // Why this decision was made
  reasoning: string;
  confidence: number;  // 0-1
  
  // Risk assessment
  risk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    potentialLoss: number;
    potentialGain: number;
    riskRewardRatio: number;
  };
  
  // Approval tracking
  requiresApproval: boolean;
  approvalDeadline?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  
  // Execution tracking
  executedAt?: Date;
  executionResult?: any;
  error?: string;
}

export interface AutoPilotConfig {
  mode: AutoPilotMode;
  
  // Risk limits
  maxDailyLoss: number;        // Percentage
  maxPositionSize: number;     // Percentage of portfolio
  maxDrawdown: number;         // Percentage
  maxLeverage: number;
  
  // Auto-approval thresholds (for semi-auto mode)
  autoApproveBelow: number;    // Auto-approve trades below this USD amount
  autoApproveConfidence: number; // Auto-approve if confidence > this
  
  // Timing
  approvalTimeoutMinutes: number;
  tradingHoursOnly: boolean;
  tradingHours?: {
    start: string;  // "09:00"
    end: string;    // "22:00"
    timezone: string;
  };
  
  // Notifications
  notifyOn: {
    decisions: boolean;
    trades: boolean;
    alerts: boolean;
    dailyReport: boolean;
  };
  notificationChannel: string;  // telegram, discord, etc.
}

export interface RiskState {
  dailyPnL: number;
  dailyPnLPercent: number;
  currentDrawdown: number;
  openPositions: number;
  totalExposure: number;
  lastTradeTime?: Date;
}

export class AutoPilot extends EventEmitter {
  private config: AutoPilotConfig;
  private decisions: Map<string, Decision> = new Map();
  private riskState: RiskState;
  private isKilled: boolean = false;
  private isPaused: boolean = false;

  constructor(config: AutoPilotConfig) {
    super();
    this.config = config;
    this.riskState = {
      dailyPnL: 0,
      dailyPnLPercent: 0,
      currentDrawdown: 0,
      openPositions: 0,
      totalExposure: 0,
    };
  }

  /**
   * Process a potential trading opportunity
   */
  async evaluateOpportunity(opportunity: {
    type: 'trade' | 'rebalance';
    action: string;
    params: any;
    analysis: any;
  }): Promise<Decision> {
    // Check if killed or paused
    if (this.isKilled) {
      throw new Error('Auto-pilot is killed. Manual restart required.');
    }
    if (this.isPaused) {
      throw new Error('Auto-pilot is paused.');
    }

    // Check risk limits
    const riskCheck = this.checkRiskLimits(opportunity);
    if (!riskCheck.allowed) {
      console.log(`[AutoPilot] Opportunity rejected: ${riskCheck.reason}`);
      return this.createDecision({
        ...opportunity,
        status: 'rejected',
        reasoning: riskCheck.reason,
        confidence: 0,
        risk: riskCheck.risk,
      });
    }

    // Calculate confidence and reasoning
    const evaluation = this.evaluateSignal(opportunity.analysis);
    
    // Create decision
    const decision = this.createDecision({
      ...opportunity,
      status: 'pending',
      reasoning: evaluation.reasoning,
      confidence: evaluation.confidence,
      risk: riskCheck.risk,
    });

    // Determine if approval is needed
    decision.requiresApproval = this.needsApproval(decision);
    
    if (decision.requiresApproval) {
      decision.approvalDeadline = new Date(
        Date.now() + this.config.approvalTimeoutMinutes * 60 * 1000
      );
      this.emit('decision:pending', decision);
    } else {
      // Auto-execute in full-auto mode
      await this.executeDecision(decision);
    }

    this.decisions.set(decision.id, decision);
    return decision;
  }

  /**
   * Check if trade passes risk limits
   */
  private checkRiskLimits(opportunity: any): {
    allowed: boolean;
    reason: string;
    risk: Decision['risk'];
  } {
    const risk: Decision['risk'] = {
      level: 'low',
      potentialLoss: 0,
      potentialGain: 0,
      riskRewardRatio: 0,
    };

    // Check daily loss limit
    if (this.riskState.dailyPnLPercent <= -this.config.maxDailyLoss) {
      return {
        allowed: false,
        reason: `Daily loss limit reached (${this.riskState.dailyPnLPercent.toFixed(2)}%)`,
        risk: { ...risk, level: 'critical' },
      };
    }

    // Check drawdown limit
    if (this.riskState.currentDrawdown >= this.config.maxDrawdown) {
      return {
        allowed: false,
        reason: `Max drawdown reached (${this.riskState.currentDrawdown.toFixed(2)}%)`,
        risk: { ...risk, level: 'critical' },
      };
    }

    // Calculate risk metrics for this trade
    const positionSize = opportunity.params.amount || 0;
    const stopLoss = opportunity.params.stopLoss || 0.05; // Default 5%
    const takeProfit = opportunity.params.takeProfit || 0.10; // Default 10%
    
    risk.potentialLoss = positionSize * stopLoss;
    risk.potentialGain = positionSize * takeProfit;
    risk.riskRewardRatio = risk.potentialGain / risk.potentialLoss;
    
    // Determine risk level
    if (risk.potentialLoss > 0.05 * this.riskState.totalExposure) {
      risk.level = 'high';
    } else if (risk.potentialLoss > 0.02 * this.riskState.totalExposure) {
      risk.level = 'medium';
    }

    // Check R/R ratio
    if (risk.riskRewardRatio < 1.5) {
      return {
        allowed: false,
        reason: `Risk/Reward ratio too low (${risk.riskRewardRatio.toFixed(2)}:1)`,
        risk,
      };
    }

    return { allowed: true, reason: 'All checks passed', risk };
  }

  /**
   * Evaluate signal quality
   */
  private evaluateSignal(analysis: any): {
    confidence: number;
    reasoning: string;
  } {
    let confidence = 0.5;
    const reasons: string[] = [];

    // Check trend alignment
    if (analysis.trend === 'bullish' && analysis.signal === 'buy') {
      confidence += 0.15;
      reasons.push('Trend aligned with signal');
    } else if (analysis.trend === 'bearish' && analysis.signal === 'sell') {
      confidence += 0.15;
      reasons.push('Trend aligned with signal');
    }

    // Check RSI
    if (analysis.indicators?.rsi) {
      const rsi = analysis.indicators.rsi;
      if ((rsi < 30 && analysis.signal === 'buy') || (rsi > 70 && analysis.signal === 'sell')) {
        confidence += 0.1;
        reasons.push(`RSI confirmation (${rsi})`);
      }
    }

    // Check MACD
    if (analysis.indicators?.macd) {
      if (analysis.indicators.macd.histogram > 0 && analysis.signal === 'buy') {
        confidence += 0.1;
        reasons.push('MACD bullish');
      }
    }

    // Check volume
    if (analysis.volumeConfirmation) {
      confidence += 0.1;
      reasons.push('Volume confirmation');
    }

    // Check support/resistance
    if (analysis.nearSupport && analysis.signal === 'buy') {
      confidence += 0.1;
      reasons.push('Near support level');
    } else if (analysis.nearResistance && analysis.signal === 'sell') {
      confidence += 0.1;
      reasons.push('Near resistance level');
    }

    return {
      confidence: Math.min(confidence, 1),
      reasoning: reasons.join('. ') || 'Standard signal evaluation',
    };
  }

  /**
   * Check if decision needs manual approval
   */
  private needsApproval(decision: Decision): boolean {
    if (this.config.mode === 'manual') return true;
    if (this.config.mode === 'full-auto') return false;
    
    // Semi-auto: check thresholds
    const tradeAmount = decision.params.amount || 0;
    
    if (tradeAmount < this.config.autoApproveBelow) return false;
    if (decision.confidence > this.config.autoApproveConfidence) return false;
    if (decision.risk.level === 'high' || decision.risk.level === 'critical') return true;
    
    return true;
  }

  /**
   * Approve a pending decision
   */
  async approveDecision(decisionId: string, approver: string): Promise<Decision> {
    const decision = this.decisions.get(decisionId);
    if (!decision) throw new Error('Decision not found');
    if (decision.status !== 'pending') throw new Error('Decision is not pending');

    decision.status = 'approved';
    decision.approvedBy = approver;
    decision.approvedAt = new Date();
    
    this.emit('decision:approved', decision);
    
    // Execute the decision
    await this.executeDecision(decision);
    
    return decision;
  }

  /**
   * Reject a pending decision
   */
  rejectDecision(decisionId: string, reason: string): Decision {
    const decision = this.decisions.get(decisionId);
    if (!decision) throw new Error('Decision not found');
    if (decision.status !== 'pending') throw new Error('Decision is not pending');

    decision.status = 'rejected';
    decision.rejectionReason = reason;
    
    this.emit('decision:rejected', decision);
    
    return decision;
  }

  /**
   * Execute a decision
   */
  private async executeDecision(decision: Decision): Promise<void> {
    try {
      decision.status = 'executed';
      decision.executedAt = new Date();
      
      // Emit event for actual execution
      this.emit('decision:execute', decision);
      
      console.log(`[AutoPilot] Executing: ${decision.action}`, decision.params);
      
    } catch (error: any) {
      decision.status = 'rejected';
      decision.error = error.message;
      this.emit('decision:error', decision, error);
    }
  }

  /**
   * Create a new decision
   */
  private createDecision(data: Partial<Decision>): Decision {
    return {
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: data.type || 'trade',
      timestamp: new Date(),
      status: data.status || 'pending',
      action: data.action || '',
      params: data.params || {},
      reasoning: data.reasoning || '',
      confidence: data.confidence || 0,
      risk: data.risk || {
        level: 'medium',
        potentialLoss: 0,
        potentialGain: 0,
        riskRewardRatio: 0,
      },
      requiresApproval: true,
    };
  }

  /**
   * Update risk state
   */
  updateRiskState(state: Partial<RiskState>): void {
    this.riskState = { ...this.riskState, ...state };
    
    // Check for critical conditions
    if (this.riskState.dailyPnLPercent <= -this.config.maxDailyLoss) {
      this.emit('risk:daily_limit_reached', this.riskState);
    }
    if (this.riskState.currentDrawdown >= this.config.maxDrawdown) {
      this.emit('risk:drawdown_limit_reached', this.riskState);
    }
  }

  /**
   * Emergency kill switch
   */
  kill(reason: string): void {
    this.isKilled = true;
    console.log(`[AutoPilot] KILLED: ${reason}`);
    this.emit('killed', reason);
  }

  /**
   * Pause auto-pilot
   */
  pause(): void {
    this.isPaused = true;
    this.emit('paused');
  }

  /**
   * Resume auto-pilot
   */
  resume(): void {
    this.isPaused = false;
    this.emit('resumed');
  }

  /**
   * Reset kill switch (requires explicit action)
   */
  reset(): void {
    this.isKilled = false;
    this.isPaused = false;
    this.emit('reset');
  }

  /**
   * Get current status
   */
  getStatus(): {
    mode: AutoPilotMode;
    isKilled: boolean;
    isPaused: boolean;
    riskState: RiskState;
    pendingDecisions: number;
    config: AutoPilotConfig;
  } {
    const pendingDecisions = Array.from(this.decisions.values())
      .filter(d => d.status === 'pending').length;
    
    return {
      mode: this.config.mode,
      isKilled: this.isKilled,
      isPaused: this.isPaused,
      riskState: this.riskState,
      pendingDecisions,
      config: this.config,
    };
  }

  /**
   * Get pending decisions
   */
  getPendingDecisions(): Decision[] {
    return Array.from(this.decisions.values())
      .filter(d => d.status === 'pending')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get decision history
   */
  getDecisionHistory(limit = 100): Decision[] {
    return Array.from(this.decisions.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Set mode
   */
  setMode(mode: AutoPilotMode): void {
    const oldMode = this.config.mode;
    this.config.mode = mode;
    this.emit('mode:changed', { from: oldMode, to: mode });
    console.log(`[AutoPilot] Mode changed: ${oldMode} → ${mode}`);
  }
}

/**
 * Default auto-pilot configuration
 */
export const defaultAutoPilotConfig: AutoPilotConfig = {
  mode: 'manual',
  
  maxDailyLoss: 5,
  maxPositionSize: 10,
  maxDrawdown: 15,
  maxLeverage: 3,
  
  autoApproveBelow: 100,
  autoApproveConfidence: 0.8,
  
  approvalTimeoutMinutes: 60,
  tradingHoursOnly: false,
  
  notifyOn: {
    decisions: true,
    trades: true,
    alerts: true,
    dailyReport: true,
  },
  notificationChannel: 'telegram',
};
