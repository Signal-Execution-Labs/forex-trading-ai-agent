/**
 * K.I.T. Brain Core
 * 
 * The main orchestrator that brings together:
 * - Goal Parser: Understanding user intentions
 * - Decision Engine: Making trading decisions
 * - Autonomy Manager: Controlling independence levels
 * 
 * This is the "supernatural financial agent" from VISION.md
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/17
 */

import { EventEmitter } from 'events';
import { GoalParser, ParsedGoal, UserGoal as GoalParserUserGoal } from './goal-parser';
import { DecisionEngine } from './decision-engine';
import { AutonomyManager } from './autonomy-manager';
import {
  UserGoal,
  BrainState,
  BrainEvent,
  AutonomyConfig,
  AutonomyLevel,
  MarketOpportunity,
  Decision,
  Signal,
  Asset,
  PerformanceMetrics,
  TradeResult
} from './types';

export interface BrainConfig {
  /** Initial autonomy level */
  autonomyLevel?: AutonomyLevel;
  
  /** Autonomy configuration */
  autonomy?: Partial<AutonomyConfig>;
  
  /** Paper trading mode */
  paperTrade?: boolean;
  
  /** Verbose logging */
  verbose?: boolean;
  
  /** Analysis interval in milliseconds */
  analysisInterval?: number;
}

const DEFAULT_CONFIG: BrainConfig = {
  autonomyLevel: 1,
  paperTrade: true,
  verbose: true,
  analysisInterval: 60000 // 1 minute
};

/**
 * K.I.T. Brain Core - The Autonomous Financial Agent
 */
export class BrainCore extends EventEmitter {
  private config: BrainConfig;
  private goalParser: GoalParser;
  private decisionEngine: DecisionEngine;
  private autonomyManager: AutonomyManager;
  
  private state: BrainState;
  private analysisTimer?: ReturnType<typeof setInterval>;
  private portfolioValue: number = 0;
  
  constructor(config: BrainConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize components
    this.goalParser = new GoalParser();
    this.decisionEngine = new DecisionEngine({
      paperTrade: this.config.paperTrade,
      verbose: this.config.verbose
    });
    this.autonomyManager = new AutonomyManager({
      level: this.config.autonomyLevel,
      ...this.config.autonomy
    });
    
    // Initialize state
    this.state = {
      active: false,
      goals: [],
      autonomy: this.autonomyManager.getState().config,
      pendingDecisions: [],
      recentDecisions: [],
      opportunities: [],
      performance: this.createEmptyMetrics(),
      lastAnalysis: new Date()
    };
    
    // Wire up events
    this.setupEventForwarding();
    
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🤖 K.I.T. BRAIN INITIALIZED                            ║
║   "Your wealth is my mission."                           ║
║                                                           ║
║   Autonomy Level: ${this.config.autonomyLevel} (${['', 'Assistant', 'Co-Pilot', 'Autopilot'][this.config.autonomyLevel || 1]})
║   Paper Trade: ${this.config.paperTrade ? 'YES (safe mode)' : 'NO (live trading!)'}
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  }
  
  // ============================================
  // Lifecycle
  // ============================================
  
  /**
   * Activate the brain
   */
  activate(): void {
    this.state.active = true;
    console.log('🧠 Brain ACTIVATED - Monitoring markets...');
    
    // Start analysis loop
    if (this.config.analysisInterval && this.config.analysisInterval > 0) {
      this.analysisTimer = setInterval(() => {
        this.runAnalysisCycle();
      }, this.config.analysisInterval);
    }
    
    this.emit('activated');
  }
  
  /**
   * Deactivate the brain
   */
  deactivate(): void {
    this.state.active = false;
    
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = undefined;
    }
    
    console.log('🧠 Brain DEACTIVATED');
    this.emit('deactivated');
  }
  
  /**
   * Check if brain is active
   */
  isActive(): boolean {
    return this.state.active;
  }
  
  // ============================================
  // Goals
  // ============================================
  
  /**
   * Set a new goal from natural language
   */
  async setGoal(prompt: string): Promise<ParsedGoal> {
    console.log(`\\n📎 Processing goal: "${prompt}"`);
    
    const parsed = await this.goalParser.parse(prompt);
    
    // Replace existing goals (single goal for now)
    this.state.goals = [parsed.goal];
    this.decisionEngine.setGoals(this.state.goals);
    
    console.log(`\\n✅ Goal understood (${parsed.confidence}% confidence):`);
    console.log(parsed.reasoning);
    
    this.emit('event', {
      type: 'goal_set',
      goal: parsed.goal
    } as BrainEvent);
    
    return parsed;
  }
  
  /**
   * Get current goals
   */
  getGoals(): UserGoal[] {
    return [...this.state.goals];
  }
  
  /**
   * Clear all goals
   */
  clearGoals(): void {
    this.state.goals = [];
    this.decisionEngine.setGoals([]);
    console.log('📎 Goals cleared');
  }
  
  // ============================================
  // Autonomy
  // ============================================
  
  /**
   * Set autonomy level (1, 2, or 3)
   */
  setAutonomyLevel(level: AutonomyLevel): void {
    this.autonomyManager.setLevel(level);
    this.state.autonomy = this.autonomyManager.getState().config;
  }
  
  /**
   * Get current autonomy level
   */
  getAutonomyLevel(): AutonomyLevel {
    return this.autonomyManager.getLevel();
  }
  
  /**
   * Get autonomy status
   */
  getAutonomyStatus(): string {
    return this.autonomyManager.getStatusSummary();
  }
  
  /**
   * Pause trading
   */
  pause(reason?: string): void {
    this.autonomyManager.pause(reason);
  }
  
  /**
   * Resume trading
   */
  resume(): void {
    this.autonomyManager.resume();
  }
  
  // ============================================
  // Market Analysis
  // ============================================
  
  /**
   * Analyze signals for an asset
   */
  analyzeSignals(signals: Signal[], asset: Asset): MarketOpportunity | null {
    return this.decisionEngine.analyzeSignals(signals, asset);
  }
  
  /**
   * Submit a yield opportunity
   */
  submitYieldOpportunity(
    protocol: string,
    asset: Asset,
    apy: number,
    tvl: number,
    riskFactors: string[] = []
  ): MarketOpportunity {
    return this.decisionEngine.createYieldOpportunity(
      protocol, asset, apy, tvl, riskFactors
    );
  }
  
  /**
   * Run a full analysis cycle
   */
  async runAnalysisCycle(): Promise<void> {
    if (!this.state.active || this.autonomyManager.isPaused()) {
      return;
    }
    
    if (!this.autonomyManager.isWithinActiveHours()) {
      return;
    }
    
    this.state.lastAnalysis = new Date();
    
    // TODO: Fetch market data and generate signals
    // This is where K.I.T. would:
    // 1. Fetch prices from exchanges
    // 2. Run technical analysis
    // 3. Check news feeds
    // 4. Analyze sentiment
    // 5. Generate opportunities
    // 6. Make decisions
    
    if (this.config.verbose) {
      console.log(`⏰ Analysis cycle at ${this.state.lastAnalysis.toISOString()}`);
    }
    
    this.emit('analysis_complete');
  }
  
  // ============================================
  // Decisions
  // ============================================
  
  /**
   * Make a decision on an opportunity
   */
  makeDecision(opportunityId: string): Decision | null {
    return this.decisionEngine.makeDecision(
      opportunityId,
      this.autonomyManager.getLevel(),
      this.portfolioValue
    );
  }
  
  /**
   * Approve a pending decision
   */
  approveDecision(decisionId: string): Decision | null {
    return this.decisionEngine.approveDecision(decisionId);
  }
  
  /**
   * Reject a pending decision
   */
  rejectDecision(decisionId: string): Decision | null {
    return this.decisionEngine.rejectDecision(decisionId);
  }
  
  /**
   * Get pending decisions
   */
  getPendingDecisions(): Decision[] {
    return this.decisionEngine.getPendingDecisions();
  }
  
  /**
   * Get decisions ready for execution
   */
  getApprovedDecisions(): Decision[] {
    return this.decisionEngine.getApprovedDecisions();
  }
  
  // ============================================
  // Portfolio
  // ============================================
  
  /**
   * Update portfolio value (for position sizing)
   */
  setPortfolioValue(value: number): void {
    this.portfolioValue = value;
    this.autonomyManager.setPortfolioValue(value);
  }
  
  /**
   * Record a completed trade
   */
  recordTrade(result: TradeResult, tradeSize: number): void {
    const profit = result.success ? (result.filledPrice || 0) - tradeSize : -tradeSize * 0.01;
    this.autonomyManager.recordTrade(tradeSize, profit);
    
    // Update performance metrics
    this.updatePerformanceMetrics(result);
  }
  
  // ============================================
  // State
  // ============================================
  
  /**
   * Get full brain state
   */
  getState(): BrainState {
    return {
      ...this.state,
      autonomy: this.autonomyManager.getState().config,
      pendingDecisions: this.decisionEngine.getPendingDecisions(),
      recentDecisions: this.decisionEngine.getApprovedDecisions().slice(-10)
    };
  }
  
  /**
   * Get status summary
   */
  getStatusSummary(): string {
    const lines = [
      ``,
      `╔═══════════════════════════════════════╗`,
      `║       K.I.T. BRAIN STATUS             ║`,
      `╚═══════════════════════════════════════╝`,
      ``,
      `🔋 Status: ${this.state.active ? '🟢 ACTIVE' : '🔴 INACTIVE'}`,
      `🤖 Autonomy: Level ${this.getAutonomyLevel()}`,
      `📊 Paper Trade: ${this.config.paperTrade ? 'YES' : 'NO'}`,
      ``,
      `📎 GOALS: ${this.state.goals.length}`,
    ];
    
    for (const goal of this.state.goals) {
      lines.push(`   • ${goal.type} (${goal.riskTolerance} risk)`);
    }
    
    lines.push(
      ``,
      `⏳ Pending Decisions: ${this.getPendingDecisions().length}`,
      `✅ Ready to Execute: ${this.getApprovedDecisions().length}`,
      ``,
      `📈 PERFORMANCE`,
      `   Total Return: ${this.state.performance.totalReturnPercent.toFixed(2)}%`,
      `   Win Rate: ${(this.state.performance.winRate * 100).toFixed(1)}%`,
      `   Trades: ${this.state.performance.totalTrades}`,
      ``
    );
    
    return lines.join('\\n');
  }
  
  // ============================================
  // Private Helpers
  // ============================================
  
  private setupEventForwarding(): void {
    // Forward events from components
    this.autonomyManager.on('event', (event: BrainEvent) => {
      this.emit('event', event);
    });
    
    this.decisionEngine.on('event', (event: BrainEvent) => {
      this.emit('event', event);
      
      // Update state based on events
      if (event.type === 'opportunity_detected') {
        this.state.opportunities.push(event.opportunity);
        // Keep only recent
        if (this.state.opportunities.length > 50) {
          this.state.opportunities = this.state.opportunities.slice(-50);
        }
      }
    });
  }
  
  private updatePerformanceMetrics(result: TradeResult): void {
    this.state.performance.totalTrades++;
    
    if (result.success) {
      this.state.performance.winningTrades++;
    }
    
    this.state.performance.winRate = 
      this.state.performance.winningTrades / this.state.performance.totalTrades;
    
    this.state.performance.updatedAt = new Date();
  }
  
  private createEmptyMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      dailyPnL: 0,
      dailyPnLPercent: 0,
      weeklyPnL: 0,
      weeklyPnLPercent: 0,
      totalTrades: 0,
      winningTrades: 0,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      updatedAt: new Date()
    };
  }
}

/**
 * Factory function
 */
export function createBrainCore(config?: BrainConfig): BrainCore {
  return new BrainCore(config);
}
