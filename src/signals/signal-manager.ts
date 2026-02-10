/**
 * K.I.T. Signal Manager
 * 
 * Signal ecosystem for trading signal aggregation, tracking, and copy trading:
 * - Aggregates signals from multiple sources
 * - Tracks performance of each signal source
 * - Auto-ranks providers based on results
 * - Enables copy trading with risk limits
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/23
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

// ============================================
// Types
// ============================================

export type SignalType = 'entry' | 'exit' | 'take-profit' | 'stop-loss' | 'update';
export type SignalDirection = 'long' | 'short' | 'neutral';
export type SignalConfidence = 'low' | 'medium' | 'high' | 'very-high';

export interface TradingSignal {
  /** Unique signal ID */
  id: string;
  
  /** Source/Provider of the signal */
  source: string;
  sourceType: 'telegram' | 'discord' | 'api' | 'internal' | 'manual';
  
  /** Signal type */
  type: SignalType;
  
  /** Asset symbol */
  symbol: string;
  
  /** Direction */
  direction: SignalDirection;
  
  /** Entry price (for entry signals) */
  entryPrice?: number;
  
  /** Take profit targets */
  takeProfits?: number[];
  
  /** Stop loss */
  stopLoss?: number;
  
  /** Confidence level */
  confidence: SignalConfidence;
  confidenceScore: number; // 0-100
  
  /** Reasoning */
  reasoning?: string;
  
  /** Risk/Reward ratio */
  riskReward?: number;
  
  /** Recommended position size (% of portfolio) */
  positionSize?: number;
  
  /** Expiration time */
  expiresAt?: Date;
  
  /** Raw message (for parsed signals) */
  rawMessage?: string;
  
  /** Timestamp */
  createdAt: Date;
  
  /** Status tracking */
  status: 'pending' | 'active' | 'hit-tp' | 'hit-sl' | 'expired' | 'cancelled';
  
  /** Result tracking */
  result?: SignalResult;
}

export interface SignalResult {
  /** Was it profitable? */
  profitable: boolean;
  
  /** P&L percentage */
  pnlPercent: number;
  
  /** Exit price */
  exitPrice: number;
  
  /** Exit reason */
  exitReason: 'tp' | 'sl' | 'manual' | 'expired';
  
  /** Duration (ms) */
  duration: number;
  
  /** Timestamp */
  closedAt: Date;
}

export interface SignalSource {
  /** Source ID */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Source type */
  type: 'telegram' | 'discord' | 'api' | 'internal';
  
  /** Is active */
  active: boolean;
  
  /** Copy trading enabled */
  copyEnabled: boolean;
  
  /** Copy ratio (0-1, e.g., 0.5 = half size) */
  copyRatio: number;
  
  /** Max position size from this source */
  maxPositionSize: number;
  
  /** Risk limit (max loss %) */
  riskLimit: number;
  
  /** Performance metrics */
  performance: SourcePerformance;
  
  /** Created at */
  createdAt: Date;
}

export interface SourcePerformance {
  /** Total signals */
  totalSignals: number;
  
  /** Winning signals */
  winningSignals: number;
  
  /** Win rate */
  winRate: number;
  
  /** Total P&L % */
  totalPnlPercent: number;
  
  /** Average P&L per signal */
  avgPnlPercent: number;
  
  /** Average win */
  avgWin: number;
  
  /** Average loss */
  avgLoss: number;
  
  /** Profit factor */
  profitFactor: number;
  
  /** Max drawdown */
  maxDrawdown: number;
  
  /** Sharpe ratio (if enough data) */
  sharpeRatio?: number;
  
  /** Rank score (composite) */
  rankScore: number;
  
  /** Last updated */
  updatedAt: Date;
}

export interface SignalManagerConfig {
  /** Auto-copy from top sources */
  autoCopy: boolean;
  
  /** Minimum win rate for auto-copy */
  minWinRate: number;
  
  /** Minimum signals for trust */
  minSignals: number;
  
  /** Global max position size */
  maxPositionSize: number;
  
  /** Global risk limit per day */
  dailyRiskLimit: number;
  
  /** Duplicate detection window (ms) */
  duplicateWindow: number;
  
  /** Verbose logging */
  verbose: boolean;
}

// ============================================
// Signal Manager
// ============================================

const DEFAULT_CONFIG: SignalManagerConfig = {
  autoCopy: false,
  minWinRate: 0.55,
  minSignals: 10,
  maxPositionSize: 5,
  dailyRiskLimit: 10,
  duplicateWindow: 60000, // 1 minute
  verbose: true
};

/**
 * Signal Manager - Aggregate, track, and copy trading signals
 */
export class SignalManager extends EventEmitter {
  private config: SignalManagerConfig;
  private sources: Map<string, SignalSource> = new Map();
  private signals: TradingSignal[] = [];
  private signalsBySource: Map<string, TradingSignal[]> = new Map();
  
  constructor(config: Partial<SignalManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // ============================================
  // Source Management
  // ============================================
  
  /**
   * Register a signal source
   */
  registerSource(
    id: string,
    name: string,
    type: SignalSource['type'],
    options: Partial<Pick<SignalSource, 'copyEnabled' | 'copyRatio' | 'maxPositionSize' | 'riskLimit'>> = {}
  ): SignalSource {
    const source: SignalSource = {
      id,
      name,
      type,
      active: true,
      copyEnabled: options.copyEnabled ?? false,
      copyRatio: options.copyRatio ?? 1.0,
      maxPositionSize: options.maxPositionSize ?? this.config.maxPositionSize,
      riskLimit: options.riskLimit ?? 5,
      performance: this.createEmptyPerformance(),
      createdAt: new Date()
    };
    
    this.sources.set(id, source);
    this.signalsBySource.set(id, []);
    
    if (this.config.verbose) {
      console.log(`📡 Registered signal source: ${name} (${type})`);
    }
    
    this.emit('source_registered', source);
    return source;
  }
  
  /**
   * Get all sources ranked by performance
   */
  getRankedSources(): SignalSource[] {
    return Array.from(this.sources.values())
      .sort((a, b) => b.performance.rankScore - a.performance.rankScore);
  }
  
  /**
   * Get source by ID
   */
  getSource(id: string): SignalSource | undefined {
    return this.sources.get(id);
  }
  
  /**
   * Enable/disable copy trading for a source
   */
  setCopyEnabled(sourceId: string, enabled: boolean, ratio?: number): void {
    const source = this.sources.get(sourceId);
    if (source) {
      source.copyEnabled = enabled;
      if (ratio !== undefined) source.copyRatio = ratio;
      
      this.emit('source_updated', source);
    }
  }
  
  // ============================================
  // Signal Handling
  // ============================================
  
  /**
   * Add a new signal
   */
  addSignal(signal: Omit<TradingSignal, 'id' | 'createdAt' | 'status'>): TradingSignal {
    // Check for duplicates
    if (this.isDuplicate(signal)) {
      if (this.config.verbose) {
        console.log(`⚠️ Duplicate signal detected: ${signal.symbol} from ${signal.source}`);
      }
      const existing = this.findDuplicate(signal);
      if (existing) return existing;
    }
    
    const fullSignal: TradingSignal = {
      ...signal,
      id: uuid(),
      createdAt: new Date(),
      status: 'pending'
    };
    
    this.signals.push(fullSignal);
    
    // Track by source
    const sourceSignals = this.signalsBySource.get(signal.source) || [];
    sourceSignals.push(fullSignal);
    this.signalsBySource.set(signal.source, sourceSignals);
    
    if (this.config.verbose) {
      console.log(`📈 New signal: ${signal.direction.toUpperCase()} ${signal.symbol} from ${signal.source}`);
    }
    
    this.emit('signal_added', fullSignal);
    
    // Check for auto-copy
    if (this.shouldAutoCopy(fullSignal)) {
      this.emit('copy_signal', fullSignal);
    }
    
    return fullSignal;
  }
  
  /**
   * Update signal result (when trade closes)
   */
  updateSignalResult(signalId: string, result: SignalResult): void {
    const signal = this.signals.find(s => s.id === signalId);
    if (!signal) return;
    
    signal.result = result;
    signal.status = result.exitReason === 'tp' ? 'hit-tp' : 
                    result.exitReason === 'sl' ? 'hit-sl' : 
                    result.exitReason === 'expired' ? 'expired' : 'cancelled';
    
    // Update source performance
    this.updateSourcePerformance(signal.source);
    
    this.emit('signal_closed', signal);
  }
  
  /**
   * Get active signals
   */
  getActiveSignals(): TradingSignal[] {
    return this.signals.filter(s => s.status === 'pending' || s.status === 'active');
  }
  
  /**
   * Get signals by source
   */
  getSignalsBySource(sourceId: string): TradingSignal[] {
    return this.signalsBySource.get(sourceId) || [];
  }
  
  /**
   * Get recent signals
   */
  getRecentSignals(hours: number = 24): TradingSignal[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.signals.filter(s => s.createdAt.getTime() >= cutoff);
  }
  
  // ============================================
  // Signal Generation (K.I.T. own signals)
  // ============================================
  
  /**
   * Generate a signal from analysis
   */
  generateSignal(params: {
    symbol: string;
    direction: SignalDirection;
    entryPrice: number;
    takeProfits?: number[];
    stopLoss?: number;
    confidence: SignalConfidence;
    confidenceScore: number;
    reasoning?: string;
  }): TradingSignal {
    // Calculate risk/reward if TP and SL provided
    let riskReward: number | undefined;
    if (params.takeProfits?.[0] && params.stopLoss && params.entryPrice) {
      const reward = Math.abs(params.takeProfits[0] - params.entryPrice);
      const risk = Math.abs(params.entryPrice - params.stopLoss);
      riskReward = risk > 0 ? reward / risk : 0;
    }
    
    return this.addSignal({
      source: 'kit-ai',
      sourceType: 'internal',
      type: 'entry',
      symbol: params.symbol,
      direction: params.direction,
      entryPrice: params.entryPrice,
      takeProfits: params.takeProfits,
      stopLoss: params.stopLoss,
      confidence: params.confidence,
      confidenceScore: params.confidenceScore,
      reasoning: params.reasoning,
      riskReward
    });
  }
  
  // ============================================
  // Performance Analysis
  // ============================================
  
  /**
   * Get performance report for a source
   */
  getSourceReport(sourceId: string): string {
    const source = this.sources.get(sourceId);
    if (!source) return 'Source not found';
    
    const p = source.performance;
    
    return `
╔═══════════════════════════════════════════════════════════╗
║  SIGNAL SOURCE: ${source.name.padEnd(40)}  ║
╚═══════════════════════════════════════════════════════════╝

📊 STATISTICS
   Total Signals:    ${p.totalSignals}
   Win Rate:         ${(p.winRate * 100).toFixed(1)}%
   Profit Factor:    ${p.profitFactor.toFixed(2)}

💰 RETURNS
   Total P&L:        ${p.totalPnlPercent >= 0 ? '+' : ''}${p.totalPnlPercent.toFixed(2)}%
   Avg per Signal:   ${p.avgPnlPercent >= 0 ? '+' : ''}${p.avgPnlPercent.toFixed(2)}%
   Avg Win:          +${p.avgWin.toFixed(2)}%
   Avg Loss:         -${Math.abs(p.avgLoss).toFixed(2)}%

📈 RISK METRICS
   Max Drawdown:     ${p.maxDrawdown.toFixed(2)}%
   Rank Score:       ${p.rankScore.toFixed(0)}/100

🔧 SETTINGS
   Copy Enabled:     ${source.copyEnabled ? 'YES' : 'NO'}
   Copy Ratio:       ${(source.copyRatio * 100).toFixed(0)}%
   Max Position:     ${source.maxPositionSize}%
`;
  }
  
  /**
   * Get leaderboard
   */
  getLeaderboard(limit: number = 10): string {
    const ranked = this.getRankedSources().slice(0, limit);
    
    const lines = [
      '',
      '╔═══════════════════════════════════════════════════════════╗',
      '║            K.I.T. SIGNAL PROVIDER LEADERBOARD             ║',
      '╚═══════════════════════════════════════════════════════════╝',
      '',
      'Rank  Provider              Win%   P&L%    Signals  Score',
      '────────────────────────────────────────────────────────────'
    ];
    
    ranked.forEach((source, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
      const copy = source.copyEnabled ? '✓' : ' ';
      lines.push(
        `${medal}${(idx + 1).toString().padStart(2)}   ${source.name.slice(0, 18).padEnd(18)} ` +
        `${(source.performance.winRate * 100).toFixed(0).padStart(4)}%  ` +
        `${(source.performance.totalPnlPercent >= 0 ? '+' : '') + source.performance.totalPnlPercent.toFixed(1).padStart(5)}%  ` +
        `${source.performance.totalSignals.toString().padStart(7)}  ` +
        `${source.performance.rankScore.toFixed(0).padStart(5)} ${copy}`
      );
    });
    
    lines.push('────────────────────────────────────────────────────────────');
    lines.push('✓ = Copy trading enabled');
    lines.push('');
    
    return lines.join('\n');
  }
  
  // ============================================
  // Private Helpers
  // ============================================
  
  private isDuplicate(signal: Omit<TradingSignal, 'id' | 'createdAt' | 'status'>): boolean {
    const cutoff = Date.now() - this.config.duplicateWindow;
    
    return this.signals.some(s => 
      s.symbol === signal.symbol &&
      s.direction === signal.direction &&
      s.type === signal.type &&
      s.createdAt.getTime() >= cutoff
    );
  }
  
  private findDuplicate(signal: Omit<TradingSignal, 'id' | 'createdAt' | 'status'>): TradingSignal | undefined {
    const cutoff = Date.now() - this.config.duplicateWindow;
    
    return this.signals.find(s => 
      s.symbol === signal.symbol &&
      s.direction === signal.direction &&
      s.type === signal.type &&
      s.createdAt.getTime() >= cutoff
    );
  }
  
  private shouldAutoCopy(signal: TradingSignal): boolean {
    if (!this.config.autoCopy) return false;
    
    const source = this.sources.get(signal.source);
    if (!source || !source.copyEnabled) return false;
    
    // Check minimum requirements
    if (source.performance.totalSignals < this.config.minSignals) return false;
    if (source.performance.winRate < this.config.minWinRate) return false;
    
    return true;
  }
  
  private updateSourcePerformance(sourceId: string): void {
    const signals = this.signalsBySource.get(sourceId) || [];
    const closedSignals = signals.filter(s => s.result);
    
    if (closedSignals.length === 0) return;
    
    const source = this.sources.get(sourceId);
    if (!source) return;
    
    // Calculate metrics
    const wins = closedSignals.filter(s => s.result!.profitable);
    const losses = closedSignals.filter(s => !s.result!.profitable);
    
    const totalPnl = closedSignals.reduce((sum, s) => sum + s.result!.pnlPercent, 0);
    const avgWin = wins.length > 0 
      ? wins.reduce((sum, s) => sum + s.result!.pnlPercent, 0) / wins.length 
      : 0;
    const avgLoss = losses.length > 0
      ? losses.reduce((sum, s) => sum + s.result!.pnlPercent, 0) / losses.length
      : 0;
    
    const grossProfit = wins.reduce((sum, s) => sum + s.result!.pnlPercent, 0);
    const grossLoss = Math.abs(losses.reduce((sum, s) => sum + s.result!.pnlPercent, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
    
    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let equity = 0;
    for (const signal of closedSignals) {
      equity += signal.result!.pnlPercent;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
    
    // Calculate rank score (composite)
    const winRateScore = (wins.length / closedSignals.length) * 30;
    const pnlScore = Math.min(Math.max(totalPnl / closedSignals.length * 10, 0), 30);
    const pfScore = Math.min(profitFactor * 10, 20);
    const ddScore = Math.max(20 - maxDrawdown, 0);
    const rankScore = winRateScore + pnlScore + pfScore + ddScore;
    
    source.performance = {
      totalSignals: closedSignals.length,
      winningSignals: wins.length,
      winRate: wins.length / closedSignals.length,
      totalPnlPercent: totalPnl,
      avgPnlPercent: totalPnl / closedSignals.length,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      rankScore: Math.min(rankScore, 100),
      updatedAt: new Date()
    };
    
    this.emit('performance_updated', source);
  }
  
  private createEmptyPerformance(): SourcePerformance {
    return {
      totalSignals: 0,
      winningSignals: 0,
      winRate: 0,
      totalPnlPercent: 0,
      avgPnlPercent: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      rankScore: 0,
      updatedAt: new Date()
    };
  }
}

/**
 * Factory function
 */
export function createSignalManager(config?: Partial<SignalManagerConfig>): SignalManager {
  return new SignalManager(config);
}
