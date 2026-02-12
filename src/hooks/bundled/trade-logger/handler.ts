/**
 * Trade Logger Hook Handler
 * Logs all executed and closed trades to ~/.kit/logs/trades.log
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler } from '../../types.js';

const handler: HookHandler = async (ctx) => {
  const logPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.kit',
    'logs',
    'trades.log'
  );
  
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const entry = JSON.stringify({
    event: ctx.event,
    timestamp: ctx.timestamp.toISOString(),
    ...ctx.data,
  }) + '\n';
  
  fs.appendFileSync(logPath, entry);
};

export default handler;
