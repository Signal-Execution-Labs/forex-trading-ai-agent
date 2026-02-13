/**
 * K.I.T. Sub-Agent Tools
 * 
 * Tools for spawning and managing sub-agents from the main agent.
 * 
 * Usage:
 * - subagent_spawn: Create a new sub-agent for a specific task
 * - subagent_status: Check the status of a sub-agent
 * - subagent_wait: Wait for a sub-agent to complete
 * - subagent_list: List all sub-agents
 * - subagent_cancel: Cancel a running sub-agent
 */

import { ToolDefinition, ToolContext, ToolResult } from './tool-registry';
import { getSubAgentManager, SubAgentTask } from '../../gateway/subagent-manager';

// ============================================================================
// Tool Definitions
// ============================================================================

export const subagentSpawnTool: ToolDefinition = {
  name: 'subagent_spawn',
  description: `Spawn a sub-agent to handle a specific task in isolation.

Use this when you need to:
- Delegate a complex task to run in the background
- Execute something that shouldn't pollute the main conversation
- Parallelize work by spawning multiple sub-agents

The sub-agent runs in its own session and reports back when done.

Example use cases:
- "Analyze this data set and summarize findings"
- "Search through memory for relevant information"
- "Execute a multi-step process"`,
  parameters: {
    type: 'object',
    properties: {
      label: {
        type: 'string',
        description: 'Short label describing the task (for display)',
      },
      prompt: {
        type: 'string',
        description: 'Full instructions/prompt for the sub-agent',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (default: 300)',
      },
      model: {
        type: 'string',
        description: 'Model override (e.g., "gpt-4o", "claude-sonnet-4-20250514")',
      },
      thinking: {
        type: 'string',
        enum: ['off', 'low', 'medium', 'high'],
        description: 'Thinking level for supported models',
      },
    },
    required: ['label', 'prompt'],
  },
};

export const subagentStatusTool: ToolDefinition = {
  name: 'subagent_status',
  description: `Check the status of a spawned sub-agent.

Returns:
- id: Task identifier
- label: Task label
- status: pending | running | completed | failed | timeout
- progress: Recent progress updates`,
  parameters: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID returned from subagent_spawn',
      },
    },
    required: ['taskId'],
  },
};

export const subagentWaitTool: ToolDefinition = {
  name: 'subagent_wait',
  description: `Wait for a sub-agent to complete and get its result.

This will block until the sub-agent finishes (or times out).
Use when you need the result before continuing.`,
  parameters: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID to wait for',
      },
      timeout: {
        type: 'number',
        description: 'Additional wait timeout in seconds (default: task timeout + 5s)',
      },
    },
    required: ['taskId'],
  },
};

export const subagentListTool: ToolDefinition = {
  name: 'subagent_list',
  description: `List all sub-agents, optionally filtered by status.`,
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'running', 'completed', 'failed', 'timeout'],
        description: 'Filter by status',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10)',
      },
    },
  },
};

export const subagentCancelTool: ToolDefinition = {
  name: 'subagent_cancel',
  description: `Cancel a running sub-agent task.`,
  parameters: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID to cancel',
      },
    },
    required: ['taskId'],
  },
};

// ============================================================================
// Tool Handlers
// ============================================================================

export async function handleSubagentSpawn(
  args: {
    label: string;
    prompt: string;
    timeout?: number;
    model?: string;
    thinking?: 'off' | 'low' | 'medium' | 'high';
  },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const manager = getSubAgentManager();
    
    const task = await manager.spawn({
      label: args.label,
      prompt: args.prompt,
      parentSession: context.sessionId || 'main',
      timeout: args.timeout,
      model: args.model,
      thinking: args.thinking,
    });
    
    return {
      success: true,
      data: {
        taskId: task.id,
        label: task.label,
        status: task.status,
        message: `Sub-agent spawned: ${task.label}. Use subagent_status or subagent_wait to get results.`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function handleSubagentStatus(
  args: { taskId: string },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const manager = getSubAgentManager();
    const status = manager.status(args.taskId);
    
    if (!status) {
      return {
        success: false,
        error: `Task not found: ${args.taskId}`,
      };
    }
    
    return {
      success: true,
      data: status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function handleSubagentWait(
  args: { taskId: string; timeout?: number },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const manager = getSubAgentManager();
    const result = await manager.wait(args.taskId, args.timeout ? args.timeout * 1000 : undefined);
    
    return {
      success: true,
      data: {
        taskId: result.taskId,
        label: result.label,
        status: result.status,
        result: result.result,
        error: result.error,
        durationMs: result.duration,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function handleSubagentList(
  args: { status?: SubAgentTask['status']; limit?: number },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const manager = getSubAgentManager();
    let tasks = manager.list({ status: args.status });
    
    if (args.limit && args.limit > 0) {
      tasks = tasks.slice(0, args.limit);
    }
    
    return {
      success: true,
      data: {
        count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          label: t.label,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
          completedAt: t.completedAt?.toISOString(),
        })),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function handleSubagentCancel(
  args: { taskId: string },
  context: ToolContext
): Promise<ToolResult> {
  try {
    const manager = getSubAgentManager();
    const cancelled = manager.cancel(args.taskId);
    
    if (!cancelled) {
      return {
        success: false,
        error: `Could not cancel task ${args.taskId} - task not found or not running`,
      };
    }
    
    return {
      success: true,
      data: {
        taskId: args.taskId,
        message: 'Task cancelled successfully',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// Registration
// ============================================================================

export function registerSubagentTools(registry: {
  register: (def: ToolDefinition, handler: (args: any, ctx: ToolContext) => Promise<ToolResult>) => void;
}): void {
  registry.register(subagentSpawnTool, handleSubagentSpawn);
  registry.register(subagentStatusTool, handleSubagentStatus);
  registry.register(subagentWaitTool, handleSubagentWait);
  registry.register(subagentListTool, handleSubagentList);
  registry.register(subagentCancelTool, handleSubagentCancel);
  
  console.log('[Tools] Registered 5 sub-agent tools');
}
