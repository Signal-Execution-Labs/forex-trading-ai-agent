/**
 * Session Memory Hook Handler
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler } from '../../types.js';

const handler: HookHandler = async (ctx) => {
  const memoryDir = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.kit',
    'workspace',
    'memory'
  );
  
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }
  
  const date = ctx.timestamp.toISOString().split('T')[0];
  const memoryPath = path.join(memoryDir, `${date}.md`);
  
  const entry = `\n## Session End - ${ctx.timestamp.toLocaleTimeString()}\n${ctx.data.summary || 'Session ended.'}\n`;
  fs.appendFileSync(memoryPath, entry);
};

export default handler;
