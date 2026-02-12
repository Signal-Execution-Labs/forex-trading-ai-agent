/**
 * Boot MD Hook
 * Runs BOOT.md on gateway startup (OpenClaw-inspired)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { HookHandler } from '../../types';

const KIT_HOME = path.join(os.homedir(), '.kit');
const WORKSPACE_DIR = path.join(KIT_HOME, 'workspace');
const BOOT_FILE = path.join(WORKSPACE_DIR, 'BOOT.md');

const handler: HookHandler = async (ctx) => {
  // Only run on gateway startup
  if (ctx.event !== 'gateway:startup') {
    return;
  }

  // Check if BOOT.md exists
  if (!fs.existsSync(BOOT_FILE)) {
    console.log('[boot-md] No BOOT.md found, skipping');
    return;
  }

  try {
    const bootContent = fs.readFileSync(BOOT_FILE, 'utf8');
    
    if (!bootContent.trim()) {
      console.log('[boot-md] BOOT.md is empty, skipping');
      return;
    }

    console.log('[boot-md] Running startup tasks from BOOT.md...');
    
    // Push message to be processed by the agent
    ctx.messages.push(`[BOOT.md Startup Tasks]\n\n${bootContent}`);
    
    console.log('[boot-md] Startup tasks queued');
  } catch (error) {
    console.error('[boot-md] Failed to read BOOT.md:', error);
  }
};

export default handler;
