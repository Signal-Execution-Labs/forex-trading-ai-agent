/**
 * Session Memory Hook
 * 
 * Saves session context to memory when /new is issued.
 * Inspired by OpenClaw's session-memory hook.
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
    sessionFile?: string;
    commandSource?: string;
    senderId?: string;
    workspaceDir?: string;
    [key: string]: any;
  };
}

export type HookHandler = (event: HookEvent) => Promise<void>;

const KIT_HOME = path.join(os.homedir(), '.kit');

/**
 * Generate a slug from the session context
 */
function generateSlug(event: HookEvent): string {
  const now = new Date();
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  
  // Try to extract meaningful slug from session key
  const parts = event.sessionKey.split(':');
  const sessionType = parts.length > 2 ? parts[2] : 'session';
  
  // Use source and time as fallback
  const source = event.context.commandSource || 'unknown';
  
  return `${hour}${minute}-${source}-${sessionType}`;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Session Memory Hook Handler
 */
const handler: HookHandler = async (event) => {
  // Only trigger on 'new' command
  if (event.type !== 'command' || event.action !== 'new') {
    return;
  }
  
  console.log(`[session-memory] Processing /new command`);
  
  // Determine memory directory
  const workspaceDir = event.context.workspaceDir || path.join(KIT_HOME, 'workspace');
  const memoryDir = path.join(workspaceDir, 'memory');
  
  // Ensure memory directory exists
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }
  
  // Generate filename
  const date = formatDate(event.timestamp);
  const slug = generateSlug(event);
  const filename = `${date}-${slug}.md`;
  const filepath = path.join(memoryDir, filename);
  
  // Build memory content
  const content = `# Session: ${event.timestamp.toISOString()}

- **Session Key**: ${event.sessionKey}
- **Session ID**: ${event.context.sessionId || 'unknown'}
- **Source**: ${event.context.commandSource || 'unknown'}
- **Sender**: ${event.context.senderId || 'unknown'}
- **Saved At**: ${new Date().toISOString()}

## Context

${event.context.sessionFile ? `Session file: ${event.context.sessionFile}` : 'No session file available.'}

---

*Saved by session-memory hook*
`;

  try {
    fs.writeFileSync(filepath, content);
    console.log(`[session-memory] Saved to: ${filepath}`);
    
    // Push confirmation message
    event.messages.push(`💾 Session saved to memory: ${filename}`);
  } catch (error) {
    console.error(`[session-memory] Failed to save:`, error);
  }
};

export default handler;
