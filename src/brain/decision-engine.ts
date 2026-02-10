/**
 * K.I.T. Decision Engine
 * Makes trading decisions based on market opportunities.
 */

export interface MarketOpportunity {
  id: string;
  type: 'buy' | 'sell' | 'hold' | 'stake' | 'unstake';
  asset: string;
  confidence: number;
  potentialReturn: number;
  risk: number;
  timeframe: string;
  reason: string;
}

export interface Decision {
  opportunity: MarketOpportunity;
  action: 'execute' | 'skip' | 'pending';
  reason: string;
  timestamp: Date;
}

export class DecisionEngine {
  private minConfidence: number;
  private maxRisk: number;
  
  constructor(options: { minConfidence?: number; maxRisk?: number } = {}) {
    this.minConfidence = options.minConfidence || 70;
    this.maxRisk = options.maxRisk || 10;
  }
  
  evaluate(opportunity: MarketOpportunity): Decision {
    let action: Decision['action'] = 'skip';
    let reason = '';
    
    if (opportunity.confidence < this.minConfidence) {
      reason = `Confidence ${opportunity.confidence}% below threshold ${this.minConfidence}%`;
    } else if (opportunity.risk > this.maxRisk) {
      reason = `Risk ${opportunity.risk}% above threshold ${this.maxRisk}%`;
    } else {
      action = 'execute';
      reason = `Meets criteria: ${opportunity.confidence}% confidence, ${opportunity.risk}% risk`;
    }
    
    return {
      opportunity,
      action,
      reason,
      timestamp: new Date(),
    };
  }
  
  setMinConfidence(value: number): void {
    this.minConfidence = value;
  }
  
  setMaxRisk(value: number): void {
    this.maxRisk = value;
  }
}

export default DecisionEngine;
