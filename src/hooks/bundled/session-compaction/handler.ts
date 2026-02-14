/**
 * Session Compaction Hook Handler
 * Auto-compacts session history when approaching context limits.
 */

import type { HookHandler } from '../../types.js';

const handler: HookHandler = async (ctx) => {
  // This hook fires on session events to track compaction needs
  // The actual compaction logic is handled by the CompactionService
  // integrated into the chat manager
  
  if (ctx.event === 'session:start' || ctx.event === 'session:end') {
    ctx.messages.push(`🧹 Session compaction hook active`);
  }
  
  // Log the event for debugging
  const logEntry = {
    event: ctx.event,
    timestamp: ctx.timestamp.toISOString(),
    sessionKey: ctx.context.sessionKey,
    compactionHook: 'active',
  };
  
  // The hook primarily serves as a registration point
  // Actual compaction is triggered by the gateway's message handler
  // when context usage exceeds threshold
  
  return;
};

export default handler;
