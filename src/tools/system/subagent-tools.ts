/**
 * K.I.T. Sub-Agent Tools
 * 
 * Specialized tools for spawning and managing trading sub-agents.
 * Wraps the SubAgentSpawner for LLM tool access.
 */

import { ToolDefinition, ToolHandler, ToolContext } from './tool-registry';
import { 
  getSubAgentSpawner, 
  SubAgentType, 
  SubAgentSpawnOptions,
  TradingContext,
  SubAgentRegistry,
} from '../../core/subagent-spawner';
import { SessionStatus } from '../../core/session-spawner';

// ============================================================================
// subagent_spawn - Spawn a trading sub-agent
// ============================================================================

export const subagentSpawnToolDefinition: ToolDefinition = {
  name: 'subagent_spawn',
  description: `Spawn a specialized sub-agent for parallel trading tasks.

Unlike generic session_spawn, this creates trading-aware sub-agents that understand:
- Trading strategies and their parameters
- Market analysis across symbols and timeframes
- Backtesting with proper metrics
- Risk management constraints

Use cases:
- Run multiple trading strategies in parallel
- Analyze multiple symbols simultaneously
- Backtest strategies on historical data
- Research market conditions in background

Sub-agent types:
- strategy: Execute a trading strategy
- analysis: Analyze market conditions
- backtest: Test strategy on historical data
- research: General research task
- monitor: Continuous market monitoring
- aggregator: Collect results from other agents`,
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The task for the sub-agent. Be specific about what to analyze or execute.',
      },
      type: {
        type: 'string',
        enum: ['strategy', 'analysis', 'backtest', 'research', 'monitor', 'aggregator', 'generic'],
        description: 'Type of sub-agent to spawn. Determines the specialized system prompt.',
      },
      label: {
        type: 'string',
        description: 'Human-readable label (e.g., "EURUSD Scalper", "BTC Analysis")',
      },
      symbols: {
        type: 'string',
        description: 'Comma-separated trading symbols (e.g., "EURUSD,GBPUSD,USDJPY")',
      },
      timeframe: {
        type: 'string',
        description: 'Timeframe for analysis (e.g., "M5", "H1", "D1")',
      },
      strategy: {
        type: 'string',
        description: 'Strategy name if spawning a strategy sub-agent',
      },
      maxRiskPercent: {
        type: 'number',
        description: 'Maximum risk per trade as percentage (e.g., 2 for 2%)',
      },
      tags: {
        type: 'string',
        description: 'Comma-separated tags for filtering (e.g., "forex,scalping")',
      },
      timeoutMs: {
        type: 'number',
        description: 'Timeout in milliseconds. Default: 300000 (5 minutes)',
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high'],
        description: 'Priority level for execution queue',
      },
    },
    required: ['task'],
  },
};

export const subagentSpawnToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> => {
  const task = args.task as string;
  const type = (args.type as SubAgentType) || 'generic';
  const label = args.label as string | undefined;
  const symbolsStr = args.symbols as string | undefined;
  const timeframe = args.timeframe as string | undefined;
  const strategy = args.strategy as string | undefined;
  const maxRiskPercent = args.maxRiskPercent as number | undefined;
  const tagsStr = args.tags as string | undefined;
  const timeoutMs = args.timeoutMs as number | undefined;
  const priority = args.priority as 'low' | 'normal' | 'high' | undefined;

  if (!task || task.trim().length === 0) {
    return {
      success: false,
      error: 'Task description is required',
    };
  }

  const spawner = getSubAgentSpawner();

  // Build trading context
  const tradingContext: TradingContext = {};
  if (symbolsStr) {
    tradingContext.symbols = symbolsStr.split(',').map(s => s.trim().toUpperCase());
  }
  if (timeframe) {
    tradingContext.timeframe = timeframe;
  }
  if (strategy) {
    tradingContext.strategy = strategy;
  }
  if (maxRiskPercent !== undefined) {
    tradingContext.riskParams = { maxRiskPercent };
  }

  const options: SubAgentSpawnOptions = {
    type,
    label,
    tradingContext: Object.keys(tradingContext).length > 0 ? tradingContext : undefined,
    tags: tagsStr ? tagsStr.split(',').map(t => t.trim()) : undefined,
    timeoutMs,
    priority,
    parentSessionId: context.sessionId || 'main',
    metadata: {
      userId: context.userId,
      agentId: context.agentId,
    },
  };

  try {
    const entry = await spawner.spawn(task, options);

    return {
      success: true,
      sessionId: entry.id,
      label: entry.label,
      type: entry.type,
      status: entry.status,
      tradingContext: entry.tradingContext,
      tags: entry.tags,
      message: `Sub-agent "${entry.label}" (${entry.type}) spawned and ${entry.status === 'running' ? 'is now running' : 'queued'}`,
      createdAt: new Date(entry.createdAt).toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// ============================================================================
// subagent_list - List sub-agents
// ============================================================================

export const subagentListToolDefinition: ToolDefinition = {
  name: 'subagent_list',
  description: 'List all trading sub-agents with filtering options.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['strategy', 'analysis', 'backtest', 'research', 'monitor', 'aggregator', 'generic', 'all'],
        description: 'Filter by sub-agent type. Default: all',
      },
      status: {
        type: 'string',
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'all'],
        description: 'Filter by status. Default: all',
      },
      tags: {
        type: 'string',
        description: 'Comma-separated tags to filter by (matches any)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results. Default: 20',
      },
    },
    required: [],
  },
};

export const subagentListToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<unknown> => {
  const typeFilter = args.type as string | undefined;
  const statusFilter = args.status as string | undefined;
  const tagsStr = args.tags as string | undefined;
  const limit = (args.limit as number) || 20;

  const spawner = getSubAgentSpawner();

  const filter: {
    type?: SubAgentType | SubAgentType[];
    status?: SessionStatus | SessionStatus[];
    tags?: string[];
    limit: number;
  } = { limit };

  if (typeFilter && typeFilter !== 'all') {
    filter.type = typeFilter as SubAgentType;
  }

  if (statusFilter && statusFilter !== 'all') {
    filter.status = statusFilter as SessionStatus;
  }

  if (tagsStr) {
    filter.tags = tagsStr.split(',').map(t => t.trim());
  }

  const entries = spawner.list(filter);
  const status = spawner.getStatus();

  return {
    success: true,
    summary: {
      total: status.total,
      byType: status.byType,
      byStatus: status.byStatus,
      runningCount: status.running.length,
    },
    subagents: entries.map(e => ({
      id: e.id,
      label: e.label,
      type: e.type,
      status: e.status,
      tags: e.tags,
      task: e.task.length > 100 ? e.task.substring(0, 100) + '...' : e.task,
      tradingContext: e.tradingContext,
      createdAt: new Date(e.createdAt).toISOString(),
      hasResult: e.result !== undefined,
      resultSummary: e.result?.summary,
    })),
  };
};

// ============================================================================
// subagent_status - Get detailed sub-agent status
// ============================================================================

export const subagentStatusToolDefinition: ToolDefinition = {
  name: 'subagent_status',
  description: 'Get detailed status and result of a specific sub-agent.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The sub-agent session ID',
      },
      includeResult: {
        type: 'boolean',
        description: 'Include full result data. Default: true',
      },
    },
    required: ['sessionId'],
  },
};

export const subagentStatusToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<unknown> => {
  const sessionId = args.sessionId as string;
  const includeResult = args.includeResult !== false;

  if (!sessionId) {
    return {
      success: false,
      error: 'sessionId is required',
    };
  }

  const spawner = getSubAgentSpawner();
  const entry = spawner.get(sessionId);

  if (!entry) {
    return {
      success: false,
      error: `Sub-agent not found: ${sessionId}`,
    };
  }

  const response: Record<string, unknown> = {
    success: true,
    subagent: {
      id: entry.id,
      label: entry.label,
      type: entry.type,
      status: entry.status,
      task: entry.task,
      tags: entry.tags,
      tradingContext: entry.tradingContext,
      parentId: entry.parentId,
      createdAt: new Date(entry.createdAt).toISOString(),
    },
  };

  if (entry.result) {
    (response.subagent as Record<string, unknown>).resultStatus = entry.result.status;
    (response.subagent as Record<string, unknown>).metrics = entry.result.metrics;
    (response.subagent as Record<string, unknown>).completedAt = new Date(entry.result.completedAt).toISOString();
    (response.subagent as Record<string, unknown>).durationMs = entry.result.durationMs;

    if (includeResult) {
      (response.subagent as Record<string, unknown>).result = entry.result.data;
      (response.subagent as Record<string, unknown>).summary = entry.result.summary;
    }
  }

  return response;
};

// ============================================================================
// subagent_send - Send message to sub-agent
// ============================================================================

export const subagentSendToolDefinition: ToolDefinition = {
  name: 'subagent_send',
  description: 'Send a message or additional instructions to a running sub-agent.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The sub-agent session ID',
      },
      message: {
        type: 'string',
        description: 'Message or instructions to send',
      },
    },
    required: ['sessionId', 'message'],
  },
};

export const subagentSendToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<unknown> => {
  const sessionId = args.sessionId as string;
  const message = args.message as string;

  if (!sessionId || !message) {
    return {
      success: false,
      error: 'Both sessionId and message are required',
    };
  }

  const spawner = getSubAgentSpawner();
  const entry = spawner.get(sessionId);

  if (!entry) {
    return {
      success: false,
      error: `Sub-agent not found: ${sessionId}`,
    };
  }

  if (entry.status !== 'running') {
    return {
      success: false,
      error: `Cannot send message to sub-agent with status: ${entry.status}`,
      status: entry.status,
    };
  }

  const sent = await spawner.send(sessionId, message);

  return {
    success: sent,
    sessionId,
    label: entry.label,
    message: sent
      ? `Message sent to "${entry.label}"`
      : `Failed to send message`,
  };
};

// ============================================================================
// subagent_cancel - Cancel a sub-agent
// ============================================================================

export const subagentCancelToolDefinition: ToolDefinition = {
  name: 'subagent_cancel',
  description: 'Cancel a pending or running sub-agent.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The sub-agent session ID to cancel',
      },
    },
    required: ['sessionId'],
  },
};

export const subagentCancelToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<unknown> => {
  const sessionId = args.sessionId as string;

  if (!sessionId) {
    return {
      success: false,
      error: 'sessionId is required',
    };
  }

  const spawner = getSubAgentSpawner();
  const entry = spawner.get(sessionId);

  if (!entry) {
    return {
      success: false,
      error: `Sub-agent not found: ${sessionId}`,
    };
  }

  const cancelled = await spawner.cancel(sessionId);

  return {
    success: cancelled,
    sessionId,
    label: entry.label,
    type: entry.type,
    previousStatus: entry.status,
    message: cancelled
      ? `Sub-agent "${entry.label}" has been cancelled`
      : `Failed to cancel sub-agent`,
  };
};

// ============================================================================
// subagent_spawn_strategies - Spawn multiple strategy agents
// ============================================================================

export const subagentSpawnStrategiesToolDefinition: ToolDefinition = {
  name: 'subagent_spawn_strategies',
  description: `Spawn multiple trading strategy sub-agents in parallel.

Useful for comparing strategies or running diversified trading approaches simultaneously.
Each strategy runs in isolation with its own risk management.`,
  parameters: {
    type: 'object',
    properties: {
      strategies: {
        type: 'string',
        description: 'JSON array of strategies: [{"name":"Scalper","symbols":"EURUSD","timeframe":"M5","task":"Run scalping..."}]',
      },
    },
    required: ['strategies'],
  },
};

export const subagentSpawnStrategiesToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<unknown> => {
  const strategiesStr = args.strategies as string;

  if (!strategiesStr) {
    return {
      success: false,
      error: 'strategies array is required',
    };
  }

  let strategies: Array<{
    name: string;
    symbols: string;
    timeframe: string;
    task: string;
  }>;

  try {
    strategies = JSON.parse(strategiesStr);
  } catch {
    return {
      success: false,
      error: 'Invalid JSON for strategies array',
    };
  }

  if (!Array.isArray(strategies) || strategies.length === 0) {
    return {
      success: false,
      error: 'strategies must be a non-empty array',
    };
  }

  const spawner = getSubAgentSpawner();

  const spawned = await spawner.spawnStrategies(
    strategies.map(s => ({
      name: s.name,
      symbols: s.symbols.split(',').map(sym => sym.trim().toUpperCase()),
      timeframe: s.timeframe,
      task: s.task,
    }))
  );

  return {
    success: true,
    count: spawned.length,
    subagents: spawned.map(e => ({
      id: e.id,
      label: e.label,
      type: e.type,
      status: e.status,
      tradingContext: e.tradingContext,
    })),
    message: `Spawned ${spawned.length} strategy sub-agents`,
  };
};

// ============================================================================
// subagent_analyze_multi - Analyze multiple symbols in parallel
// ============================================================================

export const subagentAnalyzeMultiToolDefinition: ToolDefinition = {
  name: 'subagent_analyze_multi',
  description: `Spawn parallel analysis sub-agents for multiple symbols.

Each symbol gets its own analysis sub-agent running concurrently.
Results are tagged for easy aggregation.`,
  parameters: {
    type: 'object',
    properties: {
      symbols: {
        type: 'string',
        description: 'Comma-separated symbols (e.g., "EURUSD,GBPUSD,USDJPY,GOLD")',
      },
      timeframe: {
        type: 'string',
        description: 'Timeframe for analysis (e.g., "H1", "D1")',
      },
      analysisType: {
        type: 'string',
        enum: ['technical', 'fundamental', 'sentiment', 'comprehensive'],
        description: 'Type of analysis. Default: technical',
      },
    },
    required: ['symbols', 'timeframe'],
  },
};

export const subagentAnalyzeMultiToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<unknown> => {
  const symbolsStr = args.symbols as string;
  const timeframe = args.timeframe as string;
  const analysisType = (args.analysisType as string) || 'technical';

  if (!symbolsStr || !timeframe) {
    return {
      success: false,
      error: 'symbols and timeframe are required',
    };
  }

  const symbols = symbolsStr.split(',').map(s => s.trim().toUpperCase());

  if (symbols.length === 0) {
    return {
      success: false,
      error: 'At least one symbol is required',
    };
  }

  const spawner = getSubAgentSpawner();

  const spawned = await spawner.spawnMultiSymbolAnalysis(
    symbols,
    timeframe,
    analysisType
  );

  return {
    success: true,
    count: spawned.length,
    subagents: spawned.map(e => ({
      id: e.id,
      label: e.label,
      type: e.type,
      status: e.status,
      tags: e.tags,
    })),
    message: `Spawned ${spawned.length} analysis sub-agents for ${symbols.join(', ')}`,
    tag: `analysis-${timeframe}`,
  };
};

// ============================================================================
// subagent_results - Get aggregated results by tag
// ============================================================================

export const subagentResultsToolDefinition: ToolDefinition = {
  name: 'subagent_results',
  description: 'Get aggregated results from completed sub-agents by tag.',
  parameters: {
    type: 'object',
    properties: {
      tag: {
        type: 'string',
        description: 'Tag to filter results by',
      },
    },
    required: ['tag'],
  },
};

export const subagentResultsToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<unknown> => {
  const tag = args.tag as string;

  if (!tag) {
    return {
      success: false,
      error: 'tag is required',
    };
  }

  const spawner = getSubAgentSpawner();
  const results = spawner.getResultsByTag(tag);

  if (results.length === 0) {
    return {
      success: true,
      tag,
      count: 0,
      results: [],
      message: `No completed results found for tag: ${tag}`,
    };
  }

  // Aggregate metrics
  const aggregated = {
    totalProfit: 0,
    avgWinRate: 0,
    totalTrades: 0,
  };

  let metricsCount = 0;

  for (const result of results) {
    if (result.metrics) {
      if (result.metrics.profit) aggregated.totalProfit += result.metrics.profit;
      if (result.metrics.winRate) {
        aggregated.avgWinRate += result.metrics.winRate;
        metricsCount++;
      }
      if (result.metrics.trades) aggregated.totalTrades += result.metrics.trades;
    }
  }

  if (metricsCount > 0) {
    aggregated.avgWinRate = aggregated.avgWinRate / metricsCount;
  }

  return {
    success: true,
    tag,
    count: results.length,
    aggregated: metricsCount > 0 ? aggregated : undefined,
    results: results.map(r => ({
      sessionId: r.sessionId,
      type: r.type,
      status: r.status,
      summary: r.summary,
      metrics: r.metrics,
      durationMs: r.durationMs,
    })),
  };
};
