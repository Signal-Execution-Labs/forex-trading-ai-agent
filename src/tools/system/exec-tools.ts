/**
 * K.I.T. Exec Tools
 * Execute shell commands like OpenClaw
 */

import { spawn, SpawnOptions } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler } from './tool-registry';

// Active processes for management
const activeProcesses = new Map<string, {
  process: ReturnType<typeof spawn>;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  startedAt: Date;
}>();

// ============================================================================
// Exec Tool
// ============================================================================

export const execToolDefinition: ToolDefinition = {
  name: 'exec',
  description: 'Execute shell commands. Use for running scripts, CLI tools, git operations, etc.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute',
      },
      workdir: {
        type: 'string',
        description: 'Working directory (defaults to workspace)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (default: 30)',
      },
      background: {
        type: 'boolean',
        description: 'Run in background (returns immediately)',
      },
    },
    required: ['command'],
  },
};

export const execToolHandler: ToolHandler = async (args, context) => {
  const { 
    command, 
    workdir, 
    timeout = 30, 
    background = false 
  } = args as {
    command: string;
    workdir?: string;
    timeout?: number;
    background?: boolean;
  };

  // Resolve working directory
  const cwd = workdir 
    ? (path.isAbsolute(workdir) ? workdir : path.join(context.workspaceDir, workdir))
    : context.workspaceDir;

  // Determine shell based on platform
  const isWindows = os.platform() === 'win32';
  const shell = isWindows ? 'powershell.exe' : '/bin/sh';
  const shellArgs = isWindows ? ['-Command', command] : ['-c', command];

  const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve, reject) => {
    const spawnOptions: SpawnOptions = {
      cwd,
      shell: false,
      env: { ...process.env },
    };

    const proc = spawn(shell, shellArgs, spawnOptions);
    
    let stdout = '';
    let stderr = '';
    let exitCode: number | null = null;
    let killed = false;

    // Store for background processes
    activeProcesses.set(processId, {
      process: proc,
      stdout: '',
      stderr: '',
      exitCode: null,
      startedAt: new Date(),
    });

    // Timeout handler
    const timeoutId = background ? null : setTimeout(() => {
      if (!killed) {
        killed = true;
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 1000);
      }
    }, timeout * 1000);

    proc.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      const entry = activeProcesses.get(processId);
      if (entry) entry.stdout += chunk;
    });

    proc.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      const entry = activeProcesses.get(processId);
      if (entry) entry.stderr += chunk;
    });

    // For background processes, resolve immediately
    if (background) {
      resolve({
        sessionId: processId,
        status: 'running',
        command,
        cwd,
        message: 'Process started in background. Use process tool to check status.',
      });
      return;
    }

    proc.on('close', (code) => {
      exitCode = code;
      if (timeoutId) clearTimeout(timeoutId);

      const entry = activeProcesses.get(processId);
      if (entry) {
        entry.exitCode = code;
        entry.stdout = stdout;
        entry.stderr = stderr;
      }

      // Truncate output if too large
      const maxOutput = 50000;
      const truncatedStdout = stdout.length > maxOutput 
        ? stdout.slice(-maxOutput) + '\n... (truncated)'
        : stdout;
      const truncatedStderr = stderr.length > maxOutput
        ? stderr.slice(-maxOutput) + '\n... (truncated)'
        : stderr;

      if (killed && code === null) {
        resolve({
          status: 'timeout',
          command,
          cwd,
          stdout: truncatedStdout,
          stderr: truncatedStderr,
          exitCode: null,
          error: `Command timed out after ${timeout} seconds`,
        });
      } else {
        resolve({
          status: code === 0 ? 'success' : 'error',
          command,
          cwd,
          stdout: truncatedStdout,
          stderr: truncatedStderr,
          exitCode: code,
        });
      }

      // Clean up after a delay for non-background processes
      setTimeout(() => activeProcesses.delete(processId), 5000);
    });

    proc.on('error', (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      activeProcesses.delete(processId);
      reject(new Error(`Failed to execute command: ${error.message}`));
    });
  });
};

// ============================================================================
// Process Management Tool
// ============================================================================

export const processToolDefinition: ToolDefinition = {
  name: 'process',
  description: 'Manage running exec sessions: list, poll status, get logs, kill',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'poll', 'log', 'kill'],
        description: 'Action to perform',
      },
      sessionId: {
        type: 'string',
        description: 'Session ID (required for poll, log, kill)',
      },
      limit: {
        type: 'number',
        description: 'Max log lines to return',
      },
    },
    required: ['action'],
  },
};

export const processToolHandler: ToolHandler = async (args, context) => {
  const { action, sessionId, limit = 100 } = args as {
    action: 'list' | 'poll' | 'log' | 'kill';
    sessionId?: string;
    limit?: number;
  };

  switch (action) {
    case 'list': {
      const processes = Array.from(activeProcesses.entries()).map(([id, p]) => ({
        sessionId: id,
        running: p.exitCode === null,
        exitCode: p.exitCode,
        startedAt: p.startedAt.toISOString(),
        stdoutLength: p.stdout.length,
        stderrLength: p.stderr.length,
      }));
      return { processes };
    }

    case 'poll': {
      if (!sessionId) throw new Error('sessionId required for poll');
      const proc = activeProcesses.get(sessionId);
      if (!proc) throw new Error(`Process not found: ${sessionId}`);
      return {
        sessionId,
        running: proc.exitCode === null,
        exitCode: proc.exitCode,
        stdoutLength: proc.stdout.length,
        stderrLength: proc.stderr.length,
      };
    }

    case 'log': {
      if (!sessionId) throw new Error('sessionId required for log');
      const proc = activeProcesses.get(sessionId);
      if (!proc) throw new Error(`Process not found: ${sessionId}`);
      
      const stdoutLines = proc.stdout.split('\n').slice(-limit);
      const stderrLines = proc.stderr.split('\n').slice(-limit);
      
      return {
        sessionId,
        stdout: stdoutLines.join('\n'),
        stderr: stderrLines.join('\n'),
        running: proc.exitCode === null,
        exitCode: proc.exitCode,
      };
    }

    case 'kill': {
      if (!sessionId) throw new Error('sessionId required for kill');
      const proc = activeProcesses.get(sessionId);
      if (!proc) throw new Error(`Process not found: ${sessionId}`);
      
      if (proc.exitCode !== null) {
        return { sessionId, killed: false, reason: 'Process already exited' };
      }
      
      proc.process.kill('SIGTERM');
      return { sessionId, killed: true };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
