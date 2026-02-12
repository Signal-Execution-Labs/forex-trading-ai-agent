/**
 * Risk Alert Hook Handler
 */

import { createLogger } from '../../../core/logger.js';
import type { HookHandler } from '../../types.js';

const logger = createLogger('hooks:risk-alert');

const handler: HookHandler = async (ctx) => {
  logger.warn(`⚠️ RISK WARNING: ${ctx.data.message || 'Risk limit approached'}`, ctx.data);
  ctx.messages.push(`⚠️ Risk Warning: ${ctx.data.message || 'Risk limit approached'}`);
};

export default handler;
