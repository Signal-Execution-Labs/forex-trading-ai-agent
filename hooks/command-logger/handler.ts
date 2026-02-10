/**
 * Command Logger Hook
 * 
 * Logs all command events to a centralized audit file.
 * Inspired by OpenClaw's command-logger hook.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface HookEvent {
  type: 'command' | 'session' | 'agent' | 'gateway';
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  context: {
    sessionId?: string;
    commandSource?: string;
    senderId?: string;
    [key: string]: any;
  };
}

export type HookHandler = (event: HookEvent) => Promise<void>;

const KIT_HOME = path.join(os.homedir(), '.kit');
const LOG_DIR = path.join(KIT_HOME, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'commands.log');

/**
 * Command Logger Hook Handler
 */
const handler: HookHandler = async (event) => {
  // Only log command events
  if (event.type !== 'command') {
    return;
  }
  
  // Ensure logs directory exists
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  
  // Build log entry
  const logEntry = {
    timestamp: event.timestamp.toISOString(),
    action: event.action,
    sessionKey: event.sessionKey,
    senderId: event.context.senderId || null,
    source: event.context.commandSource || null,
    sessionId: event.context.sessionId || null,
  };
  
  try {
    // Append to log file (JSONL format)
    fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error(`[command-logger] Failed to log:`, error);
  }
};

export default handler;
