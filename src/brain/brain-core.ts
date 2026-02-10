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
    
    // Convert parsed goal to full UserGoal type
    const now = new Date();
    const fullGoal: UserGoal = {
      id: `goal-${Date.now()}`,
      type: parsed.goal.type,
      targetReturn: parsed.goal.targetReturn,
      riskTolerance: parsed.goal.riskTolerance,
      timeHorizon: parsed.goal.timeHorizon,
      originalPrompt: parsed.goal.raw,
      createdAt: now,
      updatedAt: now
    };
    
    // Replace existing goals (single goal for now)
    this.state.goals = [fullGoal];
    this.decisionEngine.setGoals(this.state.goals);
    
    console.log(`\\n✅ Goal understood (${parsed.confidence}% confidence):`);
    console.log(parsed.reasoning);
    
    this.emit('event', {
      type: 'goal_set',
      goal: fullGoal
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
    
    if (this.config.verbose) {
      console.log(`⏰ Analysis cycle starting at ${this.state.lastAnalysis.toISOString()}`);
    }
    
    try {
      // 1. Get watchlist from goals
      const watchlist = this.getWatchlistFromGoals();
      
      // 2. Analyze each asset on the watchlist
      for (const asset of watchlist) {
        await this.analyzeAsset(asset);
      }
      
      // 3. Process any pending decisions at autonomy level 3
      if (this.autonomyManager.getLevel() === 3) {
        const pending = this.decisionEngine.getPendingDecisions();
        for (const decision of pending) {
          // Auto-approve decisions that pass risk checks at level 3
          if (decision.riskCheckPassed) {
            this.decisionEngine.approveDecision(decision.id);
          }
        }
      }
      
      if (this.config.verbose) {
        console.log(`✅ Analysis cycle completed`);
      }
    } catch (error) {
      console.error('Analysis cycle error:', error);
      this.emit('error', { type: 'analysis', error });
    }
    
    this.emit('analysis_complete');
  }
  
  /**
   * Get watchlist of assets based on current goals
   */
  private getWatchlistFromGoals(): Asset[] {
    const assets: Asset[] = [];
    
    for (const goal of this.state.goals) {
      const allowedMarkets = goal.constraints?.allowedMarkets || ['crypto', 'forex', 'stocks'];
      
      // Add default assets for each allowed market
      if (allowedMarkets.includes('crypto')) {
        assets.push(
          { symbol: 'BTC/USDT', name: 'Bitcoin', market: 'crypto' },
          { symbol: 'ETH/USDT', name: 'Ethereum', market: 'crypto' }
        );
      }
      if (allowedMarkets.includes('forex')) {
        assets.push(
          { symbol: 'EUR/USD', name: 'Euro/Dollar', market: 'forex' },
          { symbol: 'GBP/USD', name: 'Pound/Dollar', market: 'forex' }
        );
      }
      if (allowedMarkets.includes('stocks')) {
        assets.push(
          { symbol: 'SPY', name: 'S&P 500 ETF', market: 'stocks' },
          { symbol: 'AAPL', name: 'Apple Inc', market: 'stocks' }
        );
      }
    }
    
    // Remove duplicates based on symbol
    const seen = new Set<string>();
    return assets.filter(a => {
      if (seen.has(a.symbol)) return false;
      seen.add(a.symbol);
      return true;
    });
  }
  
  /**
   * Analyze a single asset and generate opportunities
   */
  private async analyzeAsset(asset: Asset): Promise<void> {
    try {
      // Generate mock signals for now (in production, this would use real market data)
      // The MarketAnalyzer from tools/market-analysis.ts can be integrated here
      const signals: Signal[] = this.generateMockSignals(asset);
      
      if (signals.length > 0) {
        // Use decision engine to analyze signals and create opportunities
        const opportunity = this.decisionEngine.analyzeSignals(signals, asset);
        
        if (opportunity && this.config.verbose) {
          console.log(`📊 Opportunity found: ${asset.symbol} - ${opportunity.action} (${opportunity.confidenceScore}% confidence)`);
        }
      }
    } catch (error) {
      if (this.config.verbose) {
        console.error(`Error analyzing ${asset.symbol}:`, error);
      }
    }
  }
  
  /**
   * Generate mock signals for testing (replace with real market data in production)
   */
  private generateMockSignals(asset: Asset): Signal[] {
    // In production, this would:
    // 1. Fetch real-time price data from exchanges
    // 2. Calculate technical indicators (RSI, MACD, etc.)
    // 3. Check news sentiment
    // 4. Analyze whale movements
    
    // For now, generate random signals for demonstration
    const random = Math.random();
    
    // Only generate signals 20% of the time to simulate real market conditions
    if (random > 0.2) {
      return [];
    }
    
    const direction: 'bullish' | 'bearish' | 'neutral' = 
      random < 0.07 ? 'bullish' : random < 0.14 ? 'bearish' : 'neutral';
    
    const strength = Math.floor(Math.random() * 40) + 40; // 40-80
    
    return [{
      source: 'technical-analysis',
      type: 'technical',
      direction,
      strength,
      details: `Mock signal for ${asset.symbol}: ${direction} with ${strength}% strength`,
      timestamp: new Date()
    }];
  }
  
  // ============================================
  // Decisions
  // ============================================
  
  /**
   * Make a decision on an opportunity
   */
  async makeDecision(opportunityId: string): Promise<Decision | null> {
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

// Re-export types for convenience
export type { BrainState } from './types';
