/**
 * K.I.T. Cron Tools
 * Tools for managing cron jobs via agent
 * Uses the CronManager from gateway module
 */

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolHandler, ToolContext } from './tool-registry';
import { CronManager, CronJob, JobSchedule, JobPayload, DeliveryConfig } from '../../gateway/cron-manager';
import { HeartbeatManager } from '../../gateway/heartbeat';

// Singleton reference to managers (set by gateway server)
let cronManagerRef: CronManager | null = null;
let heartbeatManagerRef: HeartbeatManager | null = null;

/**
 * Set the cron manager instance (called by gateway server)
 */
export function setCronManager(manager: CronManager): void {
  cronManagerRef = manager;
}

/**
 * Set the heartbeat manager instance (called by gateway server)
 */
export function setHeartbeatManager(manager: HeartbeatManager): void {
  heartbeatManagerRef = manager;
}

/**
 * Get the cron manager
 */
export function getCronManagerRef(): CronManager | null {
  return cronManagerRef;
}

/**
 * Get the heartbeat manager
 */
export function getHeartbeatManagerRef(): HeartbeatManager | null {
  return heartbeatManagerRef;
}

// ============================================================================
// Helper: Parse interval string to milliseconds
// ============================================================================

function parseInterval(interval: string): number | null {
  const match = interval.match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return null;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

// ============================================================================
// Cron List Tool
// ============================================================================

export const cronListToolDefinition: ToolDefinition = {
  name: 'cron_list',
  description: 'List all scheduled cron jobs. Filter by enabled status or agent ID.',
  parameters: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        description: 'Filter by enabled status (true/false)',
      },
      agentId: {
        type: 'string',
        description: 'Filter by agent ID',
      },
    },
    required: [],
  },
};

export const cronListToolHandler: ToolHandler = async (args) => {
  const { enabled, agentId } = args as {
    enabled?: boolean;
    agentId?: string;
  };
  
  if (!cronManagerRef) {
    return {
      success: false,
      error: 'Cron manager not initialized. Gateway may not be running.',
    };
  }
  
  const jobs = cronManagerRef.list({ enabled, agentId });
  
  return {
    success: true,
    count: jobs.length,
    jobs: jobs.map(job => ({
      id: job.id,
      name: job.name,
      description: job.description,
      enabled: job.enabled,
      schedule: formatSchedule(job.schedule),
      sessionTarget: job.sessionTarget,
      payload: job.payload.kind,
      delivery: job.delivery?.mode,
      nextRun: job.nextRunAt?.toISOString(),
      lastRun: job.lastRunAt?.toISOString(),
      runCount: job.runCount,
      deleteAfterRun: job.deleteAfterRun,
    })),
  };
};

function formatSchedule(schedule: JobSchedule): string {
  switch (schedule.kind) {
    case 'at':
      return `at ${new Date(schedule.at).toISOString()}`;
    case 'every':
      return `every ${formatMs(schedule.everyMs)}`;
    case 'cron':
      return `cron: ${schedule.expr}${schedule.tz ? ` (${schedule.tz})` : ''}`;
    default:
      return 'unknown';
  }
}

function formatMs(ms: number): string {
  if (ms < 60000) return `${ms / 1000}s`;
  if (ms < 3600000) return `${ms / 60000}m`;
  if (ms < 86400000) return `${ms / 3600000}h`;
  return `${ms / 86400000}d`;
}

// ============================================================================
// Cron Add Tool
// ============================================================================

export const cronAddToolDefinition: ToolDefinition = {
  name: 'cron_add',
  description: `Create a new scheduled job. Schedule types:
- "at": One-shot at specific time (ISO timestamp or relative like "in 1h")
- "every": Recurring interval (e.g., "30m", "1h", "1d")
- "cron": Cron expression (e.g., "0 9 * * 1-5" for 9 AM weekdays)

Payload types:
- "systemEvent": Send a system message/event
- "agentTurn": Trigger an agent turn with a prompt

Delivery modes (for isolated sessions):
- "announce": Deliver response to a channel
- "none": Don't deliver (silent execution)`,
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Human-readable name for the job',
      },
      description: {
        type: 'string',
        description: 'Optional description',
      },
      scheduleType: {
        type: 'string',
        description: 'Schedule type: "at", "every", or "cron"',
        enum: ['at', 'every', 'cron'],
      },
      at: {
        type: 'string',
        description: 'For scheduleType="at": ISO timestamp or relative (e.g., "in 30m", "in 2h")',
      },
      every: {
        type: 'string',
        description: 'For scheduleType="every": Interval like "30m", "1h", "1d"',
      },
      cron: {
        type: 'string',
        description: 'For scheduleType="cron": Cron expression (e.g., "0 9 * * 1-5")',
      },
      timezone: {
        type: 'string',
        description: 'Timezone for cron expressions (e.g., "Europe/Berlin")',
      },
      payloadType: {
        type: 'string',
        description: 'What to execute: "systemEvent" or "agentTurn"',
        enum: ['systemEvent', 'agentTurn'],
      },
      message: {
        type: 'string',
        description: 'Message or prompt for the payload',
      },
      model: {
        type: 'string',
        description: 'Model to use for agentTurn (optional)',
      },
      sessionTarget: {
        type: 'string',
        description: 'Run in "main" session or "isolated" session',
        enum: ['main', 'isolated'],
      },
      deliveryMode: {
        type: 'string',
        description: 'For isolated sessions: "announce" to channel or "none"',
        enum: ['announce', 'none'],
      },
      deliveryChannel: {
        type: 'string',
        description: 'Channel to deliver to (telegram, discord, etc.)',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether job is enabled (default: true)',
      },
      deleteAfterRun: {
        type: 'boolean',
        description: 'Delete job after successful run (default: true for "at" jobs)',
      },
    },
    required: ['name', 'scheduleType', 'payloadType', 'message'],
  },
};

export const cronAddToolHandler: ToolHandler = async (args) => {
  const {
    name,
    description,
    scheduleType,
    at,
    every,
    cron,
    timezone,
    payloadType,
    message,
    model,
    sessionTarget,
    deliveryMode,
    deliveryChannel,
    enabled,
    deleteAfterRun,
  } = args as {
    name: string;
    description?: string;
    scheduleType: 'at' | 'every' | 'cron';
    at?: string;
    every?: string;
    cron?: string;
    timezone?: string;
    payloadType: 'systemEvent' | 'agentTurn';
    message: string;
    model?: string;
    sessionTarget?: 'main' | 'isolated';
    deliveryMode?: 'announce' | 'none';
    deliveryChannel?: string;
    enabled?: boolean;
    deleteAfterRun?: boolean;
  };
  
  if (!cronManagerRef) {
    return {
      success: false,
      error: 'Cron manager not initialized. Gateway may not be running.',
    };
  }
  
  // Build schedule
  let schedule: JobSchedule;
  
  switch (scheduleType) {
    case 'at':
      if (!at) {
        return { success: false, error: '"at" parameter required for scheduleType="at"' };
      }
      // Parse relative time like "in 30m"
      let atDate: Date;
      if (at.startsWith('in ')) {
        const relativeMs = parseInterval(at.slice(3));
        if (!relativeMs) {
          return { success: false, error: `Invalid relative time: ${at}` };
        }
        atDate = new Date(Date.now() + relativeMs);
      } else {
        atDate = new Date(at);
        if (isNaN(atDate.getTime())) {
          return { success: false, error: `Invalid date: ${at}` };
        }
      }
      schedule = { kind: 'at', at: atDate };
      break;
      
    case 'every':
      if (!every) {
        return { success: false, error: '"every" parameter required for scheduleType="every"' };
      }
      const everyMs = parseInterval(every);
      if (!everyMs) {
        return { success: false, error: `Invalid interval: ${every}. Use format like "30m", "1h", "1d"` };
      }
      schedule = { kind: 'every', everyMs };
      break;
      
    case 'cron':
      if (!cron) {
        return { success: false, error: '"cron" parameter required for scheduleType="cron"' };
      }
      schedule = { kind: 'cron', expr: cron, tz: timezone };
      break;
      
    default:
      return { success: false, error: `Unknown scheduleType: ${scheduleType}` };
  }
  
  // Build payload
  let payload: JobPayload;
  
  switch (payloadType) {
    case 'systemEvent':
      payload = { kind: 'systemEvent', text: message };
      break;
      
    case 'agentTurn':
      payload = { kind: 'agentTurn', message, model };
      break;
      
    default:
      return { success: false, error: `Unknown payloadType: ${payloadType}` };
  }
  
  // Build delivery config
  let delivery: DeliveryConfig | undefined;
  if (sessionTarget === 'isolated' && deliveryMode) {
    delivery = {
      mode: deliveryMode,
      channel: deliveryChannel,
    };
  }
  
  try {
    const job = cronManagerRef.add({
      name,
      description,
      schedule,
      sessionTarget: sessionTarget || 'main',
      payload,
      delivery,
      enabled: enabled ?? true,
      deleteAfterRun: deleteAfterRun ?? (scheduleType === 'at'),
    });
    
    return {
      success: true,
      message: `Created job "${name}" (${job.id})`,
      job: {
        id: job.id,
        name: job.name,
        enabled: job.enabled,
        schedule: formatSchedule(job.schedule),
        nextRun: job.nextRunAt?.toISOString(),
        payload: job.payload.kind,
        sessionTarget: job.sessionTarget,
        deleteAfterRun: job.deleteAfterRun,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// ============================================================================
// Cron Remove Tool
// ============================================================================

export const cronRemoveToolDefinition: ToolDefinition = {
  name: 'cron_remove',
  description: 'Remove/delete a scheduled cron job by ID.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Job ID to remove',
      },
    },
    required: ['id'],
  },
};

export const cronRemoveToolHandler: ToolHandler = async (args) => {
  const { id } = args as { id: string };
  
  if (!cronManagerRef) {
    return {
      success: false,
      error: 'Cron manager not initialized.',
    };
  }
  
  const job = cronManagerRef.get(id);
  if (!job) {
    return {
      success: false,
      error: `Job not found: ${id}`,
    };
  }
  
  const name = job.name;
  const deleted = cronManagerRef.remove(id);
  
  return {
    success: deleted,
    message: deleted ? `Deleted job "${name}" (${id})` : 'Failed to delete job',
  };
};

// ============================================================================
// Cron Run Tool
// ============================================================================

export const cronRunToolDefinition: ToolDefinition = {
  name: 'cron_run',
  description: 'Manually trigger/execute a cron job immediately.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Job ID to run',
      },
    },
    required: ['id'],
  },
};

export const cronRunToolHandler: ToolHandler = async (args) => {
  const { id } = args as { id: string };
  
  if (!cronManagerRef) {
    return {
      success: false,
      error: 'Cron manager not initialized.',
    };
  }
  
  const job = cronManagerRef.get(id);
  if (!job) {
    return {
      success: false,
      error: `Job not found: ${id}`,
    };
  }
  
  const result = await cronManagerRef.run(id, 'force');
  
  if (!result) {
    return {
      success: false,
      error: 'Failed to run job',
    };
  }
  
  return {
    success: result.status === 'success',
    jobId: result.jobId,
    jobName: job.name,
    status: result.status,
    startedAt: result.startedAt.toISOString(),
    completedAt: result.completedAt?.toISOString(),
    response: result.response,
    delivered: result.delivered,
    error: result.error,
  };
};

// ============================================================================
// Cron Enable/Disable Tools
// ============================================================================

export const cronEnableToolDefinition: ToolDefinition = {
  name: 'cron_enable',
  description: 'Enable a disabled cron job.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Job ID to enable',
      },
    },
    required: ['id'],
  },
};

export const cronEnableToolHandler: ToolHandler = async (args) => {
  const { id } = args as { id: string };
  
  if (!cronManagerRef) {
    return { success: false, error: 'Cron manager not initialized.' };
  }
  
  const job = cronManagerRef.get(id);
  if (!job) {
    return { success: false, error: `Job not found: ${id}` };
  }
  
  const updated = cronManagerRef.update(id, { enabled: true });
  
  return {
    success: !!updated,
    message: updated ? `Enabled job "${job.name}"` : 'Failed to enable job',
    nextRun: updated?.nextRunAt?.toISOString(),
  };
};

export const cronDisableToolDefinition: ToolDefinition = {
  name: 'cron_disable',
  description: 'Disable a cron job without deleting it.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Job ID to disable',
      },
    },
    required: ['id'],
  },
};

export const cronDisableToolHandler: ToolHandler = async (args) => {
  const { id } = args as { id: string };
  
  if (!cronManagerRef) {
    return { success: false, error: 'Cron manager not initialized.' };
  }
  
  const job = cronManagerRef.get(id);
  if (!job) {
    return { success: false, error: `Job not found: ${id}` };
  }
  
  const updated = cronManagerRef.update(id, { enabled: false });
  
  return {
    success: !!updated,
    message: updated ? `Disabled job "${job.name}"` : 'Failed to disable job',
  };
};

// ============================================================================
// Cron Status Tool
// ============================================================================

export const cronStatusToolDefinition: ToolDefinition = {
  name: 'cron_status',
  description: 'Get cron scheduler and heartbeat status.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const cronStatusToolHandler: ToolHandler = async () => {
  if (!cronManagerRef) {
    return {
      success: false,
      error: 'Cron manager not initialized.',
    };
  }
  
  const jobs = cronManagerRef.list();
  const enabledJobs = jobs.filter(j => j.enabled);
  const nextJob = enabledJobs.length > 0 ? enabledJobs[0] : null;
  
  const heartbeatStatus = heartbeatManagerRef ? {
    running: true, // If manager exists, it's running
    // Add more heartbeat status if available
  } : null;
  
  return {
    success: true,
    cron: {
      initialized: true,
      jobCount: jobs.length,
      enabledCount: enabledJobs.length,
      nextJob: nextJob ? {
        id: nextJob.id,
        name: nextJob.name,
        nextRun: nextJob.nextRunAt?.toISOString(),
      } : null,
    },
    heartbeat: heartbeatStatus,
  };
};

// ============================================================================
// Heartbeat Trigger Tool
// ============================================================================

export const heartbeatTriggerToolDefinition: ToolDefinition = {
  name: 'heartbeat_trigger',
  description: 'Manually trigger a heartbeat check. Reads HEARTBEAT.md and processes it.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const heartbeatTriggerToolHandler: ToolHandler = async (args, context: ToolContext) => {
  // Read HEARTBEAT.md from workspace
  const heartbeatPath = path.join(context.workspaceDir, 'HEARTBEAT.md');
  
  let heartbeatContent: string | null = null;
  if (fs.existsSync(heartbeatPath)) {
    heartbeatContent = fs.readFileSync(heartbeatPath, 'utf-8');
  }
  
  const isActive = heartbeatManagerRef ? true : false;
  
  return {
    success: true,
    heartbeatFile: heartbeatPath,
    exists: !!heartbeatContent,
    content: heartbeatContent,
    managerInitialized: isActive,
    message: heartbeatContent 
      ? 'HEARTBEAT.md found. Process the content and take action if needed.'
      : 'No HEARTBEAT.md found. Nothing to process.',
  };
};

// ============================================================================
// Cron History Tool
// ============================================================================

export const cronHistoryToolDefinition: ToolDefinition = {
  name: 'cron_history',
  description: 'Get run history for a cron job.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Job ID to get history for',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of runs to return (default: 10)',
      },
    },
    required: ['id'],
  },
};

export const cronHistoryToolHandler: ToolHandler = async (args) => {
  const { id, limit = 10 } = args as { id: string; limit?: number };
  
  if (!cronManagerRef) {
    return { success: false, error: 'Cron manager not initialized.' };
  }
  
  const job = cronManagerRef.get(id);
  if (!job) {
    return { success: false, error: `Job not found: ${id}` };
  }
  
  const runs = await cronManagerRef.getRuns(id, { limit });
  
  return {
    success: true,
    jobId: id,
    jobName: job.name,
    totalRuns: job.runCount,
    history: runs.map(run => ({
      id: run.id,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString(),
      delivered: run.delivered,
      error: run.error,
    })),
  };
};
