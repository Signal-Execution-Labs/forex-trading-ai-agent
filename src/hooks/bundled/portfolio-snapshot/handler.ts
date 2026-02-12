/**
 * Portfolio Snapshot Hook Handler
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler } from '../../types.js';

const handler: HookHandler = async (ctx) => {
  const snapshotDir = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.kit',
    'snapshots'
  );
  
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }
  
  const filename = `portfolio_${ctx.timestamp.toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(
    path.join(snapshotDir, filename),
    JSON.stringify(ctx.data, null, 2)
  );
};

export default handler;
