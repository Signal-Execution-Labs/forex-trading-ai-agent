/**
 * K.I.T. Decision Engine
 * 
 * The core decision-making component that:
 * 1. Analyzes market opportunities
 * 2. Evaluates risk
 * 3. Makes trade decisions
 * 4. Respects autonomy levels
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/17
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import {
  UserGoal,
  MarketOpportunity,
  Decision,
  TradeAction,
  Signal,
  Asset,
  OpportunityType,
  ConfidenceLevel,
  BrainEvent,
  RiskTolerance
} from './types';

export interface DecisionEngineConfig {
  /** Minimum confidence to act (0-100) */
  minConfidence: number;
  
  /** Maximum risk score to accept (0-100) */
  maxRiskScore: number;
  
  /** Enable paper trading mode */
  paperTrade: boolean;
  
  /** Log all decisions */
  verbose: boolean;
}

const DEFAULT_CONFIG: DecisionEngineConfig = {
  minConfidence: 60,
  maxRiskScore: 70,
  paperTrade: true,
  verbose: true
};

/**
 * Maps risk tolerance to acceptable risk scores
 */
const RISK_TOLERANCE_SCORES: Record<RiskTolerance, number> = {
  'low': 30,
  'medium': 50,
  'high': 75,
  'very-high': 100
};

/**
 * Decision Engine - Makes autonomous trading decisions
 */
export class DecisionEngine extends EventEmitter {
  private config: DecisionEngineConfig;
  private goals: UserGoal[] = [];
  private opportunities: Map<string, MarketOpportunity> = new Map();
  private decisions: Decision[] = [];
  
  constructor(config: Partial<DecisionEngineConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // ============================================
  // Goal Management
  // ============================================
  
  /**
   * Set current user goals
   */
  setGoals(goals: UserGoal[]): void {
    this.goals = goals;
    console.log(`📎 Decision engine updated with ${goals.length} goal(s)`);
  }
  
  /**
   * Get risk score limit based on current goals
   */
  private getMaxRiskFromGoals(): number {
    if (this.goals.length === 0) {
      return this.config.maxRiskScore;
    }
    
    // Use the most conservative risk tolerance
    const risks = this.goals.map(g => RISK_TOLERANCE_SCORES[g.riskTolerance]);
    return Math.min(...risks);
  }
  
  // ============================================
  // Opportunity Analysis
  // ============================================
  
  /**
   * Analyze signals and create opportunities
   */
  analyzeSignals(signals: Signal[], asset: Asset): MarketOpportunity | null {
    if (signals.length === 0) return null;
    
    // Calculate aggregate signal strength
    const bullishSignals = signals.filter(s => s.direction === 'bullish');
    const bearishSignals = signals.filter(s => s.direction === 'bearish');
    
    const bullishStrength = bullishSignals.reduce((sum, s) => sum + s.strength, 0) / Math.max(bullishSignals.length, 1);
    const bearishStrength = bearishSignals.reduce((sum, s) => sum + s.strength, 0) / Math.max(bearishSignals.length, 1);
    
    // Determine direction
    const netStrength = bullishStrength - bearishStrength;
    if (Math.abs(netStrength) < 20) return null; // Not strong enough
    
    const isBullish = netStrength > 0;
    const confidenceScore = Math.min(Math.abs(netStrength), 100);
    
    const opportunity: MarketOpportunity = {
      id: uuid(),
      type: 'trade',
      asset,
      action: isBullish ? 'buy' : 'sell',
      confidence: this.scoreToConfidence(confidenceScore),
      confidenceScore,
      expectedReturn: this.estimateReturn(confidenceScore, isBullish),
      expectedReturnPercent: confidenceScore * 0.1, // Rough estimate
      riskScore: this.calculateRiskScore(signals, asset),
      reasoning: this.generateReasoning(signals, isBullish),
      signals,
      urgency: confidenceScore > 80 ? 'immediate' : 'soon',
      detectedAt: new Date()
    };
    
    this.opportunities.set(opportunity.id, opportunity);
    
    this.emit('event', {
      type: 'opportunity_detected',
      opportunity
    } as BrainEvent);
    
    return opportunity;
  }
  
  /**
   * Create a yield opportunity
   */
  createYieldOpportunity(
    protocol: string,
    asset: Asset,
    apy: number,
    tvl: number,
    riskFactors: string[]
  ): MarketOpportunity {
    const riskScore = this.calculateYieldRisk(apy, tvl, riskFactors);
    const confidenceScore = Math.max(0, 100 - riskScore);
    
    const opportunity: MarketOpportunity = {
      id: uuid(),
      type: 'yield',
      asset,
      action: 'stake',
      confidence: this.scoreToConfidence(confidenceScore),
      confidenceScore,
      expectedReturn: apy,
      expectedReturnPercent: apy,
      riskScore,
      reasoning: [
        `Protocol: ${protocol}`,
        `APY: ${apy.toFixed(2)}%`,
        `TVL: $${(tvl / 1e6).toFixed(1)}M`,
        ...riskFactors.map(r => `Risk: ${r}`)
      ],
      signals: [{
        source: 'yield-scanner',
        type: 'fundamental',
        direction: 'bullish',
        strength: confidenceScore,
        details: `${apy.toFixed(2)}% APY on ${protocol}`,
        timestamp: new Date()
      }],
      urgency: 'flexible',
      detectedAt: new Date()
    };
    
    this.opportunities.set(opportunity.id, opportunity);
    
    this.emit('event', {
      type: 'opportunity_detected',
      opportunity
    } as BrainEvent);
    
    return opportunity;
  }
  
  // ============================================
  // Decision Making
  // ============================================
  
  /**
   * Make a decision on an opportunity
   */
  makeDecision(
    opportunityId: string,
    autonomyLevel: number,
    portfolioValue: number
  ): Decision | null {
    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) {
      console.error(`Opportunity ${opportunityId} not found`);
      return null;
    }
    
    // Risk check
    const maxRisk = this.getMaxRiskFromGoals();
    const riskCheckPassed = opportunity.riskScore <= maxRisk;
    
    // Confidence check
    const confidenceCheckPassed = opportunity.confidenceScore >= this.config.minConfidence;
    
    // Build trade action
    const action = this.buildTradeAction(opportunity, portfolioValue);
    
    // Determine if approval needed
    const requiresApproval = autonomyLevel === 1 || !riskCheckPassed || !confidenceCheckPassed;
    
    const decision: Decision = {
      id: uuid(),
      opportunityId,
      action,
      autonomyLevel,
      requiresApproval,
      riskCheckPassed,
      riskCheckDetails: riskCheckPassed 
        ? `Risk score ${opportunity.riskScore} within limit ${maxRisk}`
        : `Risk score ${opportunity.riskScore} exceeds limit ${maxRisk}`,
      status: requiresApproval ? 'pending' : 'approved',
      approved: !requiresApproval,
      createdAt: new Date()
    };
    
    this.decisions.push(decision);
    
    this.emit('event', {
      type: 'decision_made',
      decision
    } as BrainEvent);
    
    if (requiresApproval) {
      this.emit('event', {
        type: 'approval_required',
        decision
      } as BrainEvent);
    }
    
    if (this.config.verbose) {
      console.log(`\\n🧠 DECISION MADE`);
      console.log(`━━━━━━━━━━━━━━━━━━`);
      console.log(`Asset: ${opportunity.asset.symbol}`);
      console.log(`Action: ${action.side.toUpperCase()} ${action.amount}`);
      console.log(`Confidence: ${opportunity.confidenceScore}%`);
      console.log(`Risk: ${opportunity.riskScore}/100`);
      console.log(`Risk Check: ${riskCheckPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Requires Approval: ${requiresApproval ? 'YES' : 'NO'}`);
    }
    
    return decision;
  }
  
  /**
   * Approve a pending decision
   */
  approveDecision(decisionId: string): Decision | null {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (!decision) {
      console.error(`Decision ${decisionId} not found`);
      return null;
    }
    
    decision.approved = true;
    decision.approvedAt = new Date();
    decision.status = 'approved';
    
    console.log(`✅ Decision ${decisionId} APPROVED`);
    return decision;
  }
  
  /**
   * Reject a pending decision
   */
  rejectDecision(decisionId: string): Decision | null {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (!decision) {
      console.error(`Decision ${decisionId} not found`);
      return null;
    }
    
    decision.approved = false;
    decision.status = 'rejected';
    
    console.log(`❌ Decision ${decisionId} REJECTED`);
    return decision;
  }
  
  /**
   * Get pending decisions
   */
  getPendingDecisions(): Decision[] {
    return this.decisions.filter(d => d.status === 'pending');
  }
  
  /**
   * Get approved decisions ready for execution
   */
  getApprovedDecisions(): Decision[] {
    return this.decisions.filter(d => d.status === 'approved');
  }
  
  // ============================================
  // Helpers
  // ============================================
  
  private buildTradeAction(opportunity: MarketOpportunity, portfolioValue: number): TradeAction {
    // Position sizing based on risk
    const riskPercent = Math.max(1, 5 - (opportunity.riskScore / 25)); // 1-5% based on risk
    const positionSize = (portfolioValue * riskPercent) / 100;
    
    return {
      type: opportunity.type === 'yield' ? 'stake' : 'market',
      asset: opportunity.asset,
      side: opportunity.action === 'buy' || opportunity.action === 'stake' ? 'buy' : 'sell',
      amount: positionSize / (1), // TODO: Get current price
    };
  }
  
  private scoreToConfidence(score: number): ConfidenceLevel {
    if (score >= 80) return 'very-high';
    if (score >= 65) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }
  
  private calculateRiskScore(signals: Signal[], asset: Asset): number {
    let risk = 30; // Base risk
    
    // More signals = more confidence = lower risk
    risk -= Math.min(signals.length * 5, 20);
    
    // Consistent signals = lower risk
    const directions = signals.map(s => s.direction);
    const uniqueDirections = new Set(directions).size;
    if (uniqueDirections === 1) risk -= 10;
    
    // Market type risk adjustment
    const marketRisk: Record<string, number> = {
      'crypto': 20,
      'defi': 25,
      'forex': 10,
      'stocks': 15,
      'commodities': 15,
      'options': 30
    };
    risk += marketRisk[asset.market] || 20;
    
    return Math.max(0, Math.min(100, risk));
  }
  
  private calculateYieldRisk(apy: number, tvl: number, riskFactors: string[]): number {
    let risk = 20; // Base risk
    
    // High APY = higher risk
    if (apy > 50) risk += 30;
    else if (apy > 20) risk += 15;
    else if (apy > 10) risk += 5;
    
    // Low TVL = higher risk
    if (tvl < 1_000_000) risk += 25;
    else if (tvl < 10_000_000) risk += 15;
    else if (tvl < 100_000_000) risk += 5;
    
    // Additional risk factors
    risk += riskFactors.length * 10;
    
    return Math.max(0, Math.min(100, risk));
  }
  
  private estimateReturn(confidenceScore: number, isBullish: boolean): number {
    const baseReturn = confidenceScore * 0.05; // 0.05% per confidence point
    return isBullish ? baseReturn : -baseReturn;
  }
  
  private generateReasoning(signals: Signal[], isBullish: boolean): string[] {
    const reasoning: string[] = [];
    
    reasoning.push(isBullish ? '📈 Bullish signals detected' : '📉 Bearish signals detected');
    
    for (const signal of signals.slice(0, 3)) {
      reasoning.push(`• ${signal.source}: ${signal.details}`);
    }
    
    if (signals.length > 3) {
      reasoning.push(`• ... and ${signals.length - 3} more signals`);
    }
    
    return reasoning;
  }
}

/**
 * Factory function
 */
export function createDecisionEngine(config?: Partial<DecisionEngineConfig>): DecisionEngine {
  return new DecisionEngine(config);
}

export { Decision, MarketOpportunity };
