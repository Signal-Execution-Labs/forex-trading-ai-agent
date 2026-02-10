/**
 * K.I.T. Goal Parser
 * Parses natural language goals into actionable configurations.
 */

export interface UserGoal {
  raw: string;
  type: 'growth' | 'income' | 'preservation' | 'custom';
  targetReturn?: number;
  riskLevel: 'low' | 'medium' | 'high';
  timeHorizon: 'short' | 'medium' | 'long';
}

export interface GoalConfig {
  maxRiskPercent: number;
  targetReturnPercent: number;
  rebalanceInterval: 'daily' | 'weekly' | 'monthly';
  allowedAssets: string[];
}

export class GoalParser {
  parse(input: string): UserGoal {
    const lower = input.toLowerCase();
    
    let type: UserGoal['type'] = 'growth';
    let riskLevel: UserGoal['riskLevel'] = 'medium';
    let targetReturn: number | undefined;
    let timeHorizon: UserGoal['timeHorizon'] = 'long';
    
    // Parse type
    if (lower.includes('safe') || lower.includes('preserve')) {
      type = 'preservation';
      riskLevel = 'low';
    } else if (lower.includes('income') || lower.includes('passive') || lower.includes('yield')) {
      type = 'income';
    } else if (lower.includes('aggressive') || lower.includes('maximize')) {
      type = 'growth';
      riskLevel = 'high';
    }
    
    // Parse return target
    const returnMatch = lower.match(/(\d+)%?.*return/);
    if (returnMatch) {
      targetReturn = parseInt(returnMatch[1], 10);
    }
    
    // Parse time horizon
    if (lower.includes('short') || lower.includes('quick')) {
      timeHorizon = 'short';
    } else if (lower.includes('medium')) {
      timeHorizon = 'medium';
    }
    
    return { raw: input, type, targetReturn, riskLevel, timeHorizon };
  }
  
  toConfig(goal: UserGoal): GoalConfig {
    return {
      maxRiskPercent: goal.riskLevel === 'low' ? 5 : goal.riskLevel === 'medium' ? 10 : 20,
      targetReturnPercent: goal.targetReturn || 15,
      rebalanceInterval: goal.timeHorizon === 'short' ? 'daily' : 'weekly',
      allowedAssets: ['BTC', 'ETH', 'USDC', 'USDT'],
    };
  }
}

export default GoalParser;
