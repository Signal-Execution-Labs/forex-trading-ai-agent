/**
 * K.I.T. Session Tools
 * 
 * Tools for spawning and managing sub-agent sessions.
 * Enables background task execution with isolated contexts.
 */

import { ToolDefinition, ToolHandler, ToolContext } from './tool-registry';
import { getSessionSpawner, SessionStatus, SpawnOptions } from '../../core/session-spawner';

// ============================================================================
// session_spawn - Start a background agent with a task
// ============================================================================

export const sessionSpawnToolDefinition: ToolDefinition = {
  name: 'session_spawn',
  description: `Spawn a sub-agent to handle a background task. The sub-agent runs independently and reports results when done.

Use cases:
- Long-running analysis that shouldn't block the conversation
- Parallel research on multiple topics
- Background data processing
- Scheduled task execution

The sub-agent has its own context and access to trading tools.`,
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The task for the sub-agent to complete. Be specific and detailed.',
      },
      label: {
        type: 'string',
        description: 'Human-readable label for this session (e.g., "BTC Analysis", "Portfolio Review")',
      },
      model: {
        type: 'string',
        description: 'Model to use (e.g., "anthropic/claude-sonnet-4-20250514"). Defaults to main agent model.',
      },
      timeoutMs: {
        type: 'number',
        description: 'Timeout in milliseconds. Default: 300000 (5 minutes)',
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high'],
        description: 'Priority level. High priority sessions are processed first.',
      },
      announceResult: {
        type: 'boolean',
        description: 'Whether to announce results to parent session. Default: true',
      },
    },
    required: ['task'],
  },
};

export const sessionSpawnToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> => {
  const task = args.task as string;
  const label = args.label as string | undefined;
  const model = args.model as string | undefined;
  const timeoutMs = args.timeoutMs as number | undefined;
  const priority = args.priority as 'low' | 'normal' | 'high' | undefined;
  const announceResult = args.announceResult as boolean | undefined;

  if (!task || task.trim().length === 0) {
    return {
      success: false,
      error: 'Task description is required',
    };
  }

  const spawner = getSessionSpawner();

  const options: SpawnOptions = {
    label,
    parentSessionId: context.sessionId || 'main',
    model,
    timeoutMs,
    priority,
    announceResult,
    metadata: {
      userId: context.userId,
      agentId: context.agentId,
    },
  };

  try {
    const session = await spawner.spawn(task, options);

    return {
      success: true,
      sessionId: session.id,
      label: session.label,
      status: session.status,
      message: `Sub-agent "${session.label}" spawned and ${session.status === 'running' ? 'is now running' : 'queued for execution'}`,
      createdAt: new Date(session.createdAt).toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// ============================================================================
// session_list - List active sessions
// ============================================================================

export const sessionListToolDefinition: ToolDefinition = {
  name: 'session_list',
  description: 'List all sub-agent sessions with their current status.',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'all'],
        description: 'Filter by status. Default: all',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of sessions to return. Default: 20',
      },
    },
    required: [],
  },
};

export const sessionListToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> => {
  const statusFilter = args.status as string | undefined;
  const limit = (args.limit as number) || 20;

  const spawner = getSessionSpawner();

  let filter: { status?: SessionStatus | SessionStatus[]; limit: number } = { limit };

  if (statusFilter && statusFilter !== 'all') {
    filter.status = statusFilter as SessionStatus;
  }

  const sessions = spawner.list(filter);
  const status = spawner.getStatus();

  return {
    success: true,
    summary: {
      total: status.total,
      running: status.running,
      pending: status.pending,
      completed: status.completed,
      failed: status.failed,
      maxConcurrent: status.maxConcurrent,
    },
    sessions: sessions.map(s => ({
      id: s.id,
      label: s.label,
      status: s.status,
      progress: s.progress,
      task: s.task.length > 100 ? s.task.substring(0, 100) + '...' : s.task,
      createdAt: new Date(s.createdAt).toISOString(),
      startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : null,
      completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
      error: s.error,
      hasResult: s.result !== undefined,
    })),
  };
};

// ============================================================================
// session_send - Send message to a session
// ============================================================================

export const sessionSendToolDefinition: ToolDefinition = {
  name: 'session_send',
  description: 'Send a message or additional instructions to a running sub-agent session.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The session ID to send the message to',
      },
      message: {
        type: 'string',
        description: 'Message or instructions to send',
      },
    },
    required: ['sessionId', 'message'],
  },
};

export const sessionSendToolHandler: ToolHandler = async (
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

  const spawner = getSessionSpawner();
  const session = spawner.get(sessionId);

  if (!session) {
    return {
      success: false,
      error: `Session not found: ${sessionId}`,
    };
  }

  if (session.status !== 'running') {
    return {
      success: false,
      error: `Cannot send message to session with status: ${session.status}`,
      sessionStatus: session.status,
    };
  }

  const sent = await spawner.sendMessage(sessionId, message);

  return {
    success: sent,
    sessionId,
    message: sent
      ? `Message sent to "${session.label}"`
      : `Failed to send message to session`,
  };
};

// ============================================================================
// session_status - Get detailed status of a session
// ============================================================================

export const sessionStatusToolDefinition: ToolDefinition = {
  name: 'session_status',
  description: 'Get detailed status and result of a specific sub-agent session.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The session ID to check',
      },
      includeResult: {
        type: 'boolean',
        description: 'Include the full result in the response. Default: true',
      },
    },
    required: ['sessionId'],
  },
};

export const sessionStatusToolHandler: ToolHandler = async (
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

  const spawner = getSessionSpawner();
  const session = spawner.get(sessionId);

  if (!session) {
    return {
      success: false,
      error: `Session not found: ${sessionId}`,
    };
  }

  const response: Record<string, unknown> = {
    success: true,
    session: {
      id: session.id,
      label: session.label,
      parentSessionId: session.parentSessionId,
      status: session.status,
      progress: session.progress,
      task: session.task,
      createdAt: new Date(session.createdAt).toISOString(),
      startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
      completedAt: session.completedAt ? new Date(session.completedAt).toISOString() : null,
      durationMs: session.completedAt && session.startedAt
        ? session.completedAt - session.startedAt
        : session.startedAt
          ? Date.now() - session.startedAt
          : null,
      metadata: session.metadata,
    },
  };

  if (session.error) {
    (response.session as Record<string, unknown>).error = session.error;
  }

  if (includeResult && session.result !== undefined) {
    (response.session as Record<string, unknown>).result = session.result;
  }

  return response;
};

// ============================================================================
// session_cancel - Cancel a session
// ============================================================================

export const sessionCancelToolDefinition: ToolDefinition = {
  name: 'session_cancel',
  description: 'Cancel a pending or running sub-agent session.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The session ID to cancel',
      },
    },
    required: ['sessionId'],
  },
};

export const sessionCancelToolHandler: ToolHandler = async (
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

  const spawner = getSessionSpawner();
  const session = spawner.get(sessionId);

  if (!session) {
    return {
      success: false,
      error: `Session not found: ${sessionId}`,
    };
  }

  const cancelled = await spawner.cancel(sessionId);

  return {
    success: cancelled,
    sessionId,
    label: session.label,
    previousStatus: session.status,
    message: cancelled
      ? `Session "${session.label}" has been cancelled`
      : `Failed to cancel session`,
  };
};
