/**
 * K.I.T. Brain Types
 * 
 * Core type definitions for the autonomous decision engine.
 */

// ============================================
// User Goals
// ============================================

export type GoalType = 'growth' | 'income' | 'preservation' | 'aggressive' | 'custom';
export type RiskTolerance = 'low' | 'medium' | 'high' | 'very-high';
export type TimeHorizon = 'short' | 'medium' | 'long';

export interface UserGoal {
  /** Goal identifier */
  id: string;
  
  /** Type of financial goal */
  type: GoalType;
  
  /** Target annual return percentage (optional) */
  targetReturn?: number;
  
  /** How much risk is acceptable */
  riskTolerance: RiskTolerance;
  
  /** Investment time horizon */
  timeHorizon: TimeHorizon;
  
  /** Target amount to reach (optional) */
  targetAmount?: number;
  
  /** Natural language description from user */
  originalPrompt?: string;
  
  /** Constraints and preferences */
  constraints?: GoalConstraints;
  
  /** When goal was set */
  createdAt: Date;
  
  /** Last goal update */
  updatedAt: Date;
}

export interface GoalConstraints {
  /** Maximum loss tolerance (percentage) */
  maxDrawdown?: number;
  
  /** Markets to include/exclude */
  allowedMarkets?: MarketType[];
  excludedMarkets?: MarketType[];
  
  /** Assets to exclude */
  excludedAssets?: string[];
  
  /** Maximum single position size */
  maxPositionSize?: number;
  
  /** Maximum leverage allowed */
  maxLeverage?: number;
  
  /** Exclude DeFi protocols */
  noDeFi?: boolean;
  
  /** Exclude leverage trading */
  noLeverage?: boolean;
}

// ============================================
// Markets & Assets
// ============================================

export type MarketType = 'crypto' | 'forex' | 'stocks' | 'defi' | 'commodities' | 'options';

export interface Asset {
  symbol: string;
  name: string;
  market: MarketType;
  exchange?: string;
  chain?: string;
}

export interface Position {
  asset: Asset;
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  timestamp: Date;
}

// ============================================
// Opportunities & Decisions
// ============================================

export type OpportunityType = 
  | 'trade'           // Buy/sell opportunity
  | 'yield'           // Yield farming opportunity
  | 'arbitrage'       // Price difference opportunity
  | 'staking'         // Staking opportunity
  | 'rebalance'       // Portfolio rebalance needed
  | 'exit'            // Exit position opportunity
  | 'hedge';          // Hedging opportunity

export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very-high';

export interface MarketOpportunity {
  /** Unique opportunity ID */
  id: string;
  
  /** Type of opportunity */
  type: OpportunityType;
  
  /** Affected asset */
  asset: Asset;
  
  /** Recommended action */
  action: 'buy' | 'sell' | 'stake' | 'unstake' | 'provide' | 'withdraw' | 'swap';
  
  /** AI confidence in this opportunity */
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-100
  
  /** Expected return */
  expectedReturn: number;
  expectedReturnPercent: number;
  
  /** Risk assessment */
  riskScore: number; // 0-100, higher = riskier
  
  /** Why this opportunity was identified */
  reasoning: string[];
  
  /** Data supporting this opportunity */
  signals: Signal[];
  
  /** Time sensitivity */
  urgency: 'immediate' | 'soon' | 'flexible';
  expiresAt?: Date;
  
  /** Timestamp */
  detectedAt: Date;
}

export interface Signal {
  source: string;
  type: 'technical' | 'fundamental' | 'sentiment' | 'news' | 'whale' | 'ai';
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  details: string;
  timestamp: Date;
}

export interface Decision {
  /** Decision ID */
  id: string;
  
  /** Based on this opportunity */
  opportunityId: string;
  
  /** What action to take */
  action: TradeAction;
  
  /** Current autonomy level */
  autonomyLevel: number;
  
  /** Does this need user approval? */
  requiresApproval: boolean;
  
  /** Approval status */
  approved?: boolean;
  approvedAt?: Date;
  
  /** Risk check passed */
  riskCheckPassed: boolean;
  riskCheckDetails?: string;
  
  /** Execution status */
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'executed' | 'failed';
  
  /** Execution result */
  executionResult?: TradeResult;
  
  /** Timestamps */
  createdAt: Date;
  executedAt?: Date;
}

export interface TradeAction {
  type: 'market' | 'limit' | 'stop' | 'stake' | 'unstake' | 'provide_liquidity' | 'withdraw_liquidity';
  asset: Asset;
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  exchange?: string;
  protocol?: string;
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  filledAmount?: number;
  filledPrice?: number;
  fees?: number;
  error?: string;
  timestamp: Date;
}

// ============================================
// Autonomy Levels
// ============================================

export type AutonomyLevel = 1 | 2 | 3;

export interface AutonomyConfig {
  /** Current autonomy level (1-3) */
  level: AutonomyLevel;
  
  /** Thresholds for Level 2 (auto-approve if under) */
  thresholds?: {
    /** Max trade size in USD for auto-approve */
    maxTradeSize: number;
    
    /** Max daily loss before pausing */
    maxDailyLoss: number;
    
    /** Max number of positions */
    maxPositions: number;
    
    /** Max portfolio percentage per trade */
    maxPortfolioPercent: number;
  };
  
  /** Notification preferences */
  notifications: 'all' | 'important' | 'emergency';
  
  /** How often to send reports */
  reportFrequency: 'realtime' | 'daily' | 'weekly';
  
  /** Active trading hours (empty = 24/7) */
  activeHours?: {
    start: string; // "09:00"
    end: string;   // "17:00"
    timezone: string;
    weekdaysOnly: boolean;
  };
}

// ============================================
// Brain State
// ============================================

export interface BrainState {
  /** Is the brain active? */
  active: boolean;
  
  /** Current user goals */
  goals: UserGoal[];
  
  /** Current autonomy configuration */
  autonomy: AutonomyConfig;
  
  /** Pending decisions awaiting approval */
  pendingDecisions: Decision[];
  
  /** Recent executed decisions */
  recentDecisions: Decision[];
  
  /** Current opportunities being tracked */
  opportunities: MarketOpportunity[];
  
  /** Performance metrics */
  performance: PerformanceMetrics;
  
  /** Last analysis timestamp */
  lastAnalysis: Date;
  
  /** Error state */
  error?: string;
}

export interface PerformanceMetrics {
  /** Total return since inception */
  totalReturn: number;
  totalReturnPercent: number;
  
  /** Daily P&L */
  dailyPnL: number;
  dailyPnLPercent: number;
  
  /** Weekly P&L */
  weeklyPnL: number;
  weeklyPnLPercent: number;
  
  /** Win rate */
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  
  /** Risk metrics */
  maxDrawdown: number;
  sharpeRatio: number;
  
  /** Last updated */
  updatedAt: Date;
}

// ============================================
// Events
// ============================================

export type BrainEvent = 
  | { type: 'goal_set'; goal: UserGoal }
  | { type: 'opportunity_detected'; opportunity: MarketOpportunity }
  | { type: 'decision_made'; decision: Decision }
  | { type: 'approval_required'; decision: Decision }
  | { type: 'trade_executed'; decision: Decision; result: TradeResult }
  | { type: 'trade_failed'; decision: Decision; error: string }
  | { type: 'risk_alert'; message: string; severity: 'warning' | 'critical' }
  | { type: 'performance_update'; metrics: PerformanceMetrics }
  | { type: 'autonomy_changed'; config: AutonomyConfig };
