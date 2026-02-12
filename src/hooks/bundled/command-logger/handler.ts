/**
 * Command Logger Hook
 * Logs all command events for auditing (OpenClaw-inspired)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { HookHandler } from '../../types';

const KIT_HOME = path.join(os.homedir(), '.kit');
const LOGS_DIR = path.join(KIT_HOME, 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'commands.log');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const handler: HookHandler = async (ctx) => {
  // Only log command events
  if (!ctx.event.startsWith('command:')) {
    return;
  }

  try {
    const logEntry = {
      timestamp: ctx.timestamp.toISOString(),
      event: ctx.event,
      sessionKey: ctx.context?.sessionKey,
      agentId: ctx.agentId,
      data: ctx.data,
    };

    // Append to log file
    fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('[command-logger] Failed to log command:', error);
  }
};

export default handler;
