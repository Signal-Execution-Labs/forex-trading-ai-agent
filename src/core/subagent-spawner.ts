/**
 * K.I.T. Sub-Agent Spawner
 * 
 * Specialized spawner for trading strategies and parallel task execution.
 * Built on top of SessionSpawner with trading-specific enhancements.
 * 
 * Similar to OpenClaw's sessions_spawn but tailored for:
 * - Running different trading strategies in parallel
 * - Backtesting multiple assets simultaneously  
 * - Market analysis across timeframes
 * - Sharing results between agents
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  SessionSpawner, 
  getSessionSpawner, 
  SubAgentSession, 
  SpawnOptions,
  SessionStatus 
} from './session-spawner';

// ============================================================================
// Types
// ============================================================================

export type SubAgentType = 
  | 'strategy'      // Trading strategy execution
  | 'analysis'      // Market analysis
  | 'backtest'      // Historical backtesting
  | 'research'      // General research task
  | 'monitor'       // Continuous monitoring
  | 'aggregator'    // Collects results from other agents
  | 'generic';      // General purpose

export interface TradingContext {
  /** Trading symbols to focus on */
  symbols?: string[];
  /** Timeframe (e.g., 'M5', 'H1', 'D1') */
  timeframe?: string;
  /** Strategy name */
  strategy?: string;
  /** Risk parameters */
  riskParams?: {
    maxRiskPercent?: number;
    maxDrawdown?: number;
    maxPositions?: number;
  };
  /** Backtest date range */
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface SubAgentSpawnOptions extends SpawnOptions {
  /** Type of sub-agent */
  type?: SubAgentType;
  /** Trading-specific context */
  tradingContext?: TradingContext;
  /** Share results with these session IDs */
  shareResultsWith?: string[];
  /** Callback URL for webhooks */
  webhookUrl?: string;
  /** Tags for filtering */
  tags?: string[];
}

export interface SubAgentResult {
  sessionId: string;
  type: SubAgentType;
  status: 'success' | 'partial' | 'error';
  data?: unknown;
  metrics?: {
    profit?: number;
    winRate?: number;
    trades?: number;
    sharpeRatio?: number;
  };
  summary: string;
  completedAt: number;
  durationMs: number;
}

export interface SubAgentRegistry {
  id: string;
  type: SubAgentType;
  label: string;
  task: string;
  status: SessionStatus;
  tradingContext?: TradingContext;
  tags: string[];
  parentId: string;
  createdAt: number;
  result?: SubAgentResult;
}

// ============================================================================
// System Prompts by Type
// ============================================================================

const SUBAGENT_PROMPTS: Record<SubAgentType, string> = {
  strategy: `You are a K.I.T. Strategy Sub-Agent spawned for trading strategy execution.

## Your Role
- Execute a specific trading strategy as instructed
- Use MT5 tools for market data and trade execution
- Follow risk management rules strictly
- Report results in structured format

## Rules
1. Focus ONLY on the assigned strategy and symbols
2. Never exceed risk parameters
3. Use paper trading unless explicitly told otherwise
4. Report every trade decision with reasoning

## Output Format
Report results as:
- Trades executed: count and details
- P&L: profit/loss summary
- Win rate: percentage
- Any warnings or anomalies`,

  analysis: `You are a K.I.T. Analysis Sub-Agent spawned for market analysis.

## Your Role
- Analyze market conditions for specified symbols/timeframes
- Use technical indicators and price action
- Identify trading opportunities
- Provide actionable insights

## Rules
1. Focus on the assigned symbols only
2. Use mt5_price and mt5_indicators tools
3. Be specific about entry/exit levels
4. Include confidence levels in your analysis

## Output Format
- Market condition: bullish/bearish/neutral
- Key levels: support, resistance
- Signals: buy/sell/wait with reasons
- Risk assessment`,

  backtest: `You are a K.I.T. Backtest Sub-Agent spawned for strategy backtesting.

## Your Role
- Backtest the specified strategy on historical data
- Calculate performance metrics
- Identify strengths and weaknesses
- Compare with benchmarks if provided

## Rules
1. Use only the specified date range
2. Include transaction costs in calculations
3. Report drawdown and risk metrics
4. Be objective - don't oversell results

## Output Format
- Total return: percentage
- Win rate: percentage
- Max drawdown: percentage
- Sharpe ratio: number
- Trade count and breakdown`,

  research: `You are a K.I.T. Research Sub-Agent spawned for research tasks.

## Your Role
- Research the assigned topic thoroughly
- Use web_search and web_fetch for data gathering
- Synthesize information from multiple sources
- Present findings clearly

## Rules
1. Focus on the assigned research question
2. Cite sources when possible
3. Distinguish facts from opinions
4. Note any data limitations

## Output Format
- Key findings: bullet points
- Data sources: list
- Conclusion: actionable insights
- Confidence level`,

  monitor: `You are a K.I.T. Monitor Sub-Agent spawned for continuous monitoring.

## Your Role
- Monitor specified markets or conditions
- Alert on significant events
- Track price movements and news
- Report at regular intervals

## Rules
1. Only alert on meaningful changes
2. Use thresholds to avoid noise
3. Keep monitoring until timeout or cancellation
4. Preserve state between checks

## Output Format
- Status: normal/warning/alert
- Events: list of significant occurrences
- Current levels: key metrics
- Recommendations`,

  aggregator: `You are a K.I.T. Aggregator Sub-Agent spawned to collect and combine results.

## Your Role
- Collect results from specified sub-agents
- Aggregate and synthesize data
- Resolve conflicts if any
- Present unified summary

## Rules
1. Wait for all source agents or timeout
2. Weight results by confidence if provided
3. Flag any inconsistencies
4. Produce actionable summary

## Output Format
- Combined results: unified data
- Source count: how many agents contributed
- Conflicts: any disagreements
- Overall recommendation`,

  generic: `You are a K.I.T. Sub-Agent spawned for a specific task.

## Your Role
- Complete the assigned task efficiently
- Use available tools as needed
- Report results clearly
- Stay focused on the task

## Rules
1. Do only what's assigned
2. Ask clarifying questions if truly stuck
3. Report progress if long-running
4. Complete or fail gracefully

## Output Format
- Task completed: yes/no/partial
- Results: relevant data
- Notes: anything important`,
};

// ============================================================================
// Sub-Agent Spawner
// ============================================================================

export class SubAgentSpawner extends EventEmitter {
  private sessionSpawner: SessionSpawner;
  private registry: Map<string, SubAgentRegistry> = new Map();
  private resultCollector: Map<string, SubAgentResult[]> = new Map();

  constructor() {
    super();
    this.sessionSpawner = getSessionSpawner();
    this.setupEventListeners();
  }

  /**
   * Spawn a trading sub-agent
   */
  async spawn(task: string, options: SubAgentSpawnOptions = {}): Promise<SubAgentRegistry> {
    const type = options.type || 'generic';
    const tags = options.tags || [];
    const systemPrompt = this.buildSystemPrompt(type, options.tradingContext);
    
    // Add trading context to task if provided
    const enrichedTask = this.enrichTaskWithContext(task, options.tradingContext);

    // Spawn via base session spawner
    const session = await this.sessionSpawner.spawn(enrichedTask, {
      ...options,
      systemPrompt,
      metadata: {
        ...options.metadata,
        type,
        tradingContext: options.tradingContext,
        tags,
        shareResultsWith: options.shareResultsWith,
      },
    });

    // Create registry entry
    const entry: SubAgentRegistry = {
      id: session.id,
      type,
      label: session.label,
      task,
      status: session.status,
      tradingContext: options.tradingContext,
      tags,
      parentId: session.parentSessionId,
      createdAt: session.createdAt,
    };

    this.registry.set(session.id, entry);
    this.emit('subagent.spawned', { entry });

    return entry;
  }

  /**
   * Spawn multiple strategy agents in parallel
   */
  async spawnStrategies(strategies: Array<{
    name: string;
    symbols: string[];
    timeframe: string;
    task: string;
  }>): Promise<SubAgentRegistry[]> {
    const spawned: SubAgentRegistry[] = [];

    for (const strategy of strategies) {
      const entry = await this.spawn(strategy.task, {
        type: 'strategy',
        label: `Strategy-${strategy.name}`,
        tradingContext: {
          strategy: strategy.name,
          symbols: strategy.symbols,
          timeframe: strategy.timeframe,
        },
        tags: ['strategy', strategy.name],
      });
      spawned.push(entry);
    }

    return spawned;
  }

  /**
   * Spawn parallel analysis for multiple symbols
   */
  async spawnMultiSymbolAnalysis(
    symbols: string[],
    timeframe: string,
    analysisType: string = 'technical'
  ): Promise<SubAgentRegistry[]> {
    const spawned: SubAgentRegistry[] = [];

    for (const symbol of symbols) {
      const entry = await this.spawn(
        `Analyze ${symbol} on ${timeframe} timeframe. Focus on ${analysisType} analysis. ` +
        `Identify key levels, trends, and potential trade setups.`,
        {
          type: 'analysis',
          label: `Analysis-${symbol}`,
          tradingContext: {
            symbols: [symbol],
            timeframe,
          },
          tags: ['analysis', symbol, analysisType],
        }
      );
      spawned.push(entry);
    }

    return spawned;
  }

  /**
   * Get sub-agent by ID
   */
  get(sessionId: string): SubAgentRegistry | undefined {
    return this.registry.get(sessionId);
  }

  /**
   * List sub-agents with filters
   */
  list(filter?: {
    type?: SubAgentType | SubAgentType[];
    status?: SessionStatus | SessionStatus[];
    tags?: string[];
    parentId?: string;
    limit?: number;
  }): SubAgentRegistry[] {
    let entries = Array.from(this.registry.values());

    if (filter?.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      entries = entries.filter(e => types.includes(e.type));
    }

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      entries = entries.filter(e => statuses.includes(e.status));
    }

    if (filter?.tags && filter.tags.length > 0) {
      entries = entries.filter(e => 
        filter.tags!.some(tag => e.tags.includes(tag))
      );
    }

    if (filter?.parentId) {
      entries = entries.filter(e => e.parentId === filter.parentId);
    }

    // Sort by creation time (newest first)
    entries.sort((a, b) => b.createdAt - a.createdAt);

    if (filter?.limit) {
      entries = entries.slice(0, filter.limit);
    }

    return entries;
  }

  /**
   * Get status summary
   */
  getStatus(): {
    total: number;
    byType: Record<SubAgentType, number>;
    byStatus: Record<SessionStatus, number>;
    running: SubAgentRegistry[];
  } {
    const entries = Array.from(this.registry.values());
    
    const byType: Record<SubAgentType, number> = {
      strategy: 0,
      analysis: 0,
      backtest: 0,
      research: 0,
      monitor: 0,
      aggregator: 0,
      generic: 0,
    };

    const byStatus: Record<SessionStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const entry of entries) {
      byType[entry.type]++;
      byStatus[entry.status]++;
    }

    return {
      total: entries.length,
      byType,
      byStatus,
      running: entries.filter(e => e.status === 'running'),
    };
  }

  /**
   * Send message to a sub-agent
   */
  async send(sessionId: string, message: string): Promise<boolean> {
    const entry = this.registry.get(sessionId);
    if (!entry) return false;

    return await this.sessionSpawner.sendMessage(sessionId, message);
  }

  /**
   * Cancel a sub-agent
   */
  async cancel(sessionId: string): Promise<boolean> {
    const entry = this.registry.get(sessionId);
    if (!entry) return false;

    const cancelled = await this.sessionSpawner.cancel(sessionId);
    if (cancelled) {
      entry.status = 'cancelled';
      this.emit('subagent.cancelled', { entry });
    }

    return cancelled;
  }

  /**
   * Wait for multiple sub-agents to complete
   */
  async waitForAll(
    sessionIds: string[],
    timeoutMs: number = 10 * 60 * 1000
  ): Promise<SubAgentResult[]> {
    const startTime = Date.now();
    const results: SubAgentResult[] = [];

    while (Date.now() - startTime < timeoutMs) {
      let allDone = true;

      for (const id of sessionIds) {
        const entry = this.registry.get(id);
        if (!entry) continue;

        if (entry.status === 'running' || entry.status === 'pending') {
          allDone = false;
        } else if (entry.result && !results.find(r => r.sessionId === id)) {
          results.push(entry.result);
        }
      }

      if (allDone) break;

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Get aggregated results for a tag
   */
  getResultsByTag(tag: string): SubAgentResult[] {
    const results: SubAgentResult[] = [];
    
    for (const entry of this.registry.values()) {
      if (entry.tags.includes(tag) && entry.result) {
        results.push(entry.result);
      }
    }

    return results;
  }

  /**
   * Clean up old entries
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    for (const [id, entry] of this.registry) {
      const session = this.sessionSpawner.get(id);
      if (
        session?.completedAt &&
        session.completedAt < cutoff &&
        ['completed', 'failed', 'cancelled'].includes(entry.status)
      ) {
        this.registry.delete(id);
        cleaned++;
      }
    }

    // Also clean the base spawner
    this.sessionSpawner.cleanup(maxAgeMs);

    return cleaned;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setupEventListeners(): void {
    this.sessionSpawner.on('session.completed', ({ session, result }) => {
      const entry = this.registry.get(session.id);
      if (entry) {
        entry.status = 'completed';
        entry.result = this.parseResult(session, result as string);
        this.emit('subagent.completed', { entry, result: entry.result });

        // Share results if configured
        const shareWith = session.metadata?.shareResultsWith as string[] | undefined;
        if (shareWith) {
          for (const targetId of shareWith) {
            if (!this.resultCollector.has(targetId)) {
              this.resultCollector.set(targetId, []);
            }
            this.resultCollector.get(targetId)!.push(entry.result!);
          }
        }
      }
    });

    this.sessionSpawner.on('session.failed', ({ session, error }) => {
      const entry = this.registry.get(session.id);
      if (entry) {
        entry.status = 'failed';
        entry.result = {
          sessionId: session.id,
          type: entry.type,
          status: 'error',
          summary: `Failed: ${error}`,
          completedAt: Date.now(),
          durationMs: session.startedAt ? Date.now() - session.startedAt : 0,
        };
        this.emit('subagent.failed', { entry, error });
      }
    });

    this.sessionSpawner.on('session.progress', ({ session, progress }) => {
      const entry = this.registry.get(session.id);
      if (entry) {
        this.emit('subagent.progress', { entry, progress });
      }
    });
  }

  private buildSystemPrompt(type: SubAgentType, context?: TradingContext): string {
    let prompt = SUBAGENT_PROMPTS[type];

    if (context) {
      prompt += '\n\n## Trading Context\n';
      if (context.symbols) {
        prompt += `- Symbols: ${context.symbols.join(', ')}\n`;
      }
      if (context.timeframe) {
        prompt += `- Timeframe: ${context.timeframe}\n`;
      }
      if (context.strategy) {
        prompt += `- Strategy: ${context.strategy}\n`;
      }
      if (context.riskParams) {
        prompt += `- Risk Params: Max risk ${context.riskParams.maxRiskPercent || 2}%, `;
        prompt += `Max drawdown ${context.riskParams.maxDrawdown || 10}%\n`;
      }
    }

    return prompt;
  }

  private enrichTaskWithContext(task: string, context?: TradingContext): string {
    if (!context) return task;

    let enriched = task;

    if (context.symbols && !task.includes(context.symbols[0])) {
      enriched += `\n\nSymbols to analyze: ${context.symbols.join(', ')}`;
    }

    if (context.timeframe && !task.includes(context.timeframe)) {
      enriched += `\nTimeframe: ${context.timeframe}`;
    }

    if (context.dateRange) {
      enriched += `\nDate range: ${context.dateRange.start} to ${context.dateRange.end}`;
    }

    return enriched;
  }

  private parseResult(session: SubAgentSession, resultText: string): SubAgentResult {
    const entry = this.registry.get(session.id);
    const type = entry?.type || 'generic';

    // Try to extract metrics from result text
    const metrics: SubAgentResult['metrics'] = {};

    // Look for common patterns
    const profitMatch = resultText.match(/profit[:\s]+([+-]?\d+\.?\d*)/i);
    if (profitMatch) metrics.profit = parseFloat(profitMatch[1]);

    const winRateMatch = resultText.match(/win\s*rate[:\s]+(\d+\.?\d*)/i);
    if (winRateMatch) metrics.winRate = parseFloat(winRateMatch[1]);

    const tradesMatch = resultText.match(/trades?[:\s]+(\d+)/i);
    if (tradesMatch) metrics.trades = parseInt(tradesMatch[1]);

    const sharpeMatch = resultText.match(/sharpe[:\s]+([+-]?\d+\.?\d*)/i);
    if (sharpeMatch) metrics.sharpeRatio = parseFloat(sharpeMatch[1]);

    return {
      sessionId: session.id,
      type,
      status: 'success',
      data: resultText,
      metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      summary: resultText.length > 200 ? resultText.substring(0, 200) + '...' : resultText,
      completedAt: session.completedAt || Date.now(),
      durationMs: session.startedAt && session.completedAt
        ? session.completedAt - session.startedAt
        : 0,
    };
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let spawnerInstance: SubAgentSpawner | null = null;

export function getSubAgentSpawner(): SubAgentSpawner {
  if (!spawnerInstance) {
    spawnerInstance = new SubAgentSpawner();
  }
  return spawnerInstance;
}

export function createSubAgentSpawner(): SubAgentSpawner {
  return new SubAgentSpawner();
}
