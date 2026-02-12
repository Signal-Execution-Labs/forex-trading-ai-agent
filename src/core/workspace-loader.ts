/**
 * K.I.T. WORKSPACE LOADER
 * 
 * Loads workspace files exactly like OpenClaw does.
 * These files provide context to every session.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const KIT_HOME = path.join(os.homedir(), '.kit');
const WORKSPACE_DIR = path.join(KIT_HOME, 'workspace');
const TEMPLATES_DIR = path.join(__dirname, '../../workspace-templates');

// Maximum characters to include from each file (prevent token bloat)
const MAX_FILE_CHARS = 10000;

// ============================================================================
// Workspace Files (in order of loading)
// ============================================================================

const WORKSPACE_FILES = [
  'AGENTS.md',      // Operating instructions
  'SOUL.md',        // Persona and tone
  'USER.md',        // User info
  'IDENTITY.md',    // Agent identity
  'TOOLS.md',       // Local tool notes
  'HEARTBEAT.md',   // Heartbeat checklist
  'BOOT.md',        // Startup tasks
  'BOOTSTRAP.md',   // First-run ritual (if exists)
  'MEMORY.md',      // Long-term memory (main session only)
];

// Files that should only be loaded in main (private) sessions
const MAIN_SESSION_ONLY = ['MEMORY.md'];

// ============================================================================
// File Operations
// ============================================================================

/**
 * Ensure workspace directory exists with all template files
 */
export function ensureWorkspace(): void {
  // Create workspace directory
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }

  // Create memory directory
  const memoryDir = path.join(WORKSPACE_DIR, 'memory');
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }

  // Copy template files if they don't exist
  for (const file of WORKSPACE_FILES) {
    const workspaceFile = path.join(WORKSPACE_DIR, file);
    const templateFile = path.join(TEMPLATES_DIR, file);

    if (!fs.existsSync(workspaceFile) && fs.existsSync(templateFile)) {
      fs.copyFileSync(templateFile, workspaceFile);
      console.log(`[Workspace] Created ${file} from template`);
    }
  }
}

/**
 * Read a workspace file with size limit
 */
function readWorkspaceFile(filename: string): string | null {
  const filePath = path.join(WORKSPACE_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Truncate if too long
    if (content.length > MAX_FILE_CHARS) {
      content = content.slice(0, MAX_FILE_CHARS) + '\n\n[...truncated, file too long...]';
    }
    
    return content;
  } catch (e) {
    console.error(`[Workspace] Failed to read ${filename}:`, e);
    return null;
  }
}

/**
 * Write to a workspace file
 */
export function writeWorkspaceFile(filename: string, content: string): boolean {
  const filePath = path.join(WORKSPACE_DIR, filename);
  
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (e) {
    console.error(`[Workspace] Failed to write ${filename}:`, e);
    return false;
  }
}

/**
 * Check if BOOTSTRAP.md exists (indicates first run)
 */
export function isFirstRun(): boolean {
  const bootstrapPath = path.join(WORKSPACE_DIR, 'BOOTSTRAP.md');
  return fs.existsSync(bootstrapPath);
}

/**
 * Delete BOOTSTRAP.md after first run is complete
 */
export function completeBootstrap(): void {
  const bootstrapPath = path.join(WORKSPACE_DIR, 'BOOTSTRAP.md');
  if (fs.existsSync(bootstrapPath)) {
    fs.unlinkSync(bootstrapPath);
    console.log('[Workspace] Bootstrap complete, removed BOOTSTRAP.md');
  }
}

// ============================================================================
// Memory System
// ============================================================================

/**
 * Get today's date string for memory files
 */
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get yesterday's date string
 */
function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Read today's memory log
 */
export function readTodayMemory(): string | null {
  const filename = `memory/${getTodayString()}.md`;
  return readWorkspaceFile(filename);
}

/**
 * Read yesterday's memory log
 */
export function readYesterdayMemory(): string | null {
  const filename = `memory/${getYesterdayString()}.md`;
  return readWorkspaceFile(filename);
}

/**
 * Append to today's memory log
 */
export function appendToMemory(content: string): void {
  const filename = `memory/${getTodayString()}.md`;
  const filePath = path.join(WORKSPACE_DIR, filename);
  
  // Create file with header if it doesn't exist
  if (!fs.existsSync(filePath)) {
    const header = `# ${getTodayString()} - K.I.T. Daily Memory\n\n`;
    fs.writeFileSync(filePath, header, 'utf8');
  }
  
  // Append content with timestamp
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = `\n## ${timestamp}\n${content}\n`;
  fs.appendFileSync(filePath, entry, 'utf8');
}

// ============================================================================
// Context Builder
// ============================================================================

export interface WorkspaceContext {
  files: Record<string, string>;
  isFirstRun: boolean;
  todayMemory: string | null;
  yesterdayMemory: string | null;
}

/**
 * Load all workspace context for a session
 */
export function loadWorkspaceContext(isMainSession: boolean = true): WorkspaceContext {
  ensureWorkspace();
  
  const files: Record<string, string> = {};
  
  for (const filename of WORKSPACE_FILES) {
    // Skip main-session-only files in non-main sessions
    if (!isMainSession && MAIN_SESSION_ONLY.includes(filename)) {
      continue;
    }
    
    const content = readWorkspaceFile(filename);
    if (content) {
      files[filename] = content;
    }
  }
  
  return {
    files,
    isFirstRun: isFirstRun(),
    todayMemory: isMainSession ? readTodayMemory() : null,
    yesterdayMemory: isMainSession ? readYesterdayMemory() : null,
  };
}

/**
 * Build the workspace context string for injection into system prompt
 */
export function buildWorkspacePrompt(isMainSession: boolean = true): string {
  const context = loadWorkspaceContext(isMainSession);
  
  let prompt = `\n# Workspace Context\n\n`;
  prompt += `The following workspace files define your identity and instructions.\n\n`;
  
  // Add each file
  for (const [filename, content] of Object.entries(context.files)) {
    prompt += `## ${filename}\n\`\`\`\n${content}\n\`\`\`\n\n`;
  }
  
  // Add memory context (main session only)
  if (isMainSession) {
    prompt += `## Recent Memory\n\n`;
    
    if (context.yesterdayMemory) {
      prompt += `### Yesterday\n\`\`\`\n${context.yesterdayMemory.slice(0, 2000)}\n\`\`\`\n\n`;
    }
    
    if (context.todayMemory) {
      prompt += `### Today\n\`\`\`\n${context.todayMemory.slice(0, 2000)}\n\`\`\`\n\n`;
    }
    
    if (!context.todayMemory && !context.yesterdayMemory) {
      prompt += `_No recent memory entries._\n\n`;
    }
  }
  
  // Note about first run
  if (context.isFirstRun) {
    prompt += `⚠️ **FIRST RUN DETECTED** - Follow BOOTSTRAP.md to complete initial setup.\n\n`;
  }
  
  return prompt;
}

/**
 * Get the HEARTBEAT.md content for heartbeat runs
 */
export function getHeartbeatChecklist(): string | null {
  return readWorkspaceFile('HEARTBEAT.md');
}

/**
 * Get the BOOT.md content for startup
 */
export function getBootChecklist(): string | null {
  return readWorkspaceFile('BOOT.md');
}

/**
 * Get user info from USER.md
 */
export function getUserInfo(): { name?: string; timezone?: string } {
  const content = readWorkspaceFile('USER.md');
  if (!content) return {};
  
  const info: { name?: string; timezone?: string } = {};
  
  // Parse name
  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/i) || 
                    content.match(/Name:\s*(.+)/i);
  if (nameMatch) info.name = nameMatch[1].trim();
  
  // Parse timezone
  const tzMatch = content.match(/\*\*Timezone:\*\*\s*(.+)/i) || 
                  content.match(/Timezone:\s*(.+)/i);
  if (tzMatch) info.timezone = tzMatch[1].trim();
  
  return info;
}

/**
 * Get agent identity from IDENTITY.md
 */
export function getAgentIdentity(): { name?: string; emoji?: string; tagline?: string } {
  const content = readWorkspaceFile('IDENTITY.md');
  if (!content) return { name: 'K.I.T.', emoji: '🚗', tagline: 'Your wealth is my mission.' };
  
  const identity: { name?: string; emoji?: string; tagline?: string } = {};
  
  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/i);
  if (nameMatch) identity.name = nameMatch[1].trim();
  
  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/i);
  if (emojiMatch) identity.emoji = emojiMatch[1].trim();
  
  const taglineMatch = content.match(/\*\*Tagline:\*\*\s*(.+)/i);
  if (taglineMatch) identity.tagline = taglineMatch[1].trim();
  
  return identity;
}
