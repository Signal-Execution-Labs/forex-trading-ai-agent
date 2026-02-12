/**
 * Market Hours Hook Handler
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../../core/logger.js';
import type { HookHandler } from '../../types.js';

const logger = createLogger('hooks:market-hours');

const handler: HookHandler = async (ctx) => {
  const logPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.kit',
    'logs',
    'market-hours.log'
  );
  
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const marketName = ctx.data.market || 'Unknown';
  const eventType = ctx.event === 'market:open' ? '🟢 OPEN' : '🔴 CLOSE';
  
  const entry = JSON.stringify({
    event: eventType,
    market: marketName,
    timestamp: ctx.timestamp.toISOString(),
    timezone: ctx.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...ctx.data,
  }) + '\n';
  
  fs.appendFileSync(logPath, entry);
  logger.info(`${eventType}: ${marketName} at ${ctx.timestamp.toLocaleTimeString()}`);
};

export default handler;
