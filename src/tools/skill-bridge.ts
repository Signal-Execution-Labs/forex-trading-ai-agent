/**
 * K.I.T. Skill Bridge
 * ==================
 * Dynamically discovers and registers Python skills as callable tools.
 * 
 * This bridges the 60+ Python skills in /skills/ to K.I.T.'s tool system,
 * allowing the AI to call any implemented skill via tool calls.
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler, ToolRegistry } from './system/tool-registry';

// ============================================================================
// Python Path Detection (cross-platform)
// ============================================================================

let cachedPythonPath: string | null = null;

/**
 * Auto-detect Python executable path
 * Works on Windows, Mac, Linux without requiring PATH to be set
 */
export function getPythonPath(): string {
  if (cachedPythonPath) return cachedPythonPath;
  
  const isWindows = os.platform() === 'win32';
  
  // Try common commands first
  const commands = isWindows 
    ? ['python', 'python3', 'py -3', 'py']
    : ['python3', 'python'];
  
  for (const cmd of commands) {
    try {
      const result = execSync(`${cmd} --version`, { 
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      if (result.includes('Python 3')) {
        cachedPythonPath = cmd.split(' ')[0]; // Get just 'python' or 'py'
        console.log(`[Python] Found: ${cmd} → ${result.trim()}`);
        return cachedPythonPath;
      }
    } catch {}
  }
  
  // Windows: Check common installation paths
  if (isWindows) {
    const windowsPaths = [
      'C:\\Python314\\python.exe',
      'C:\\Python313\\python.exe',
      'C:\\Python312\\python.exe',
      'C:\\Python311\\python.exe',
      'C:\\Python310\\python.exe',
      path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python314\\python.exe'),
      path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python313\\python.exe'),
      path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python312\\python.exe'),
      path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python311\\python.exe'),
      path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python310\\python.exe'),
      'C:\\Program Files\\Python314\\python.exe',
      'C:\\Program Files\\Python311\\python.exe',
    ];
    
    for (const pyPath of windowsPaths) {
      if (fs.existsSync(pyPath)) {
        try {
          const result = execSync(`"${pyPath}" --version`, { 
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          if (result.includes('Python 3')) {
            cachedPythonPath = pyPath;
            console.log(`[Python] Found at: ${pyPath} → ${result.trim()}`);
            return cachedPythonPath;
          }
        } catch {}
      }
    }
  }
  
  // Mac/Linux: Check common paths
  if (!isWindows) {
    const unixPaths = [
      '/usr/bin/python3',
      '/usr/local/bin/python3',
      '/opt/homebrew/bin/python3',
      path.join(os.homedir(), '.pyenv/shims/python3'),
    ];
    
    for (const pyPath of unixPaths) {
      if (fs.existsSync(pyPath)) {
        cachedPythonPath = pyPath;
        console.log(`[Python] Found at: ${pyPath}`);
        return cachedPythonPath;
      }
    }
  }
  
  // Fallback - will likely fail but let the error message help user
  console.warn('[Python] Could not auto-detect Python. Skills may not work.');
  console.warn('[Python] Install Python 3.10+ from https://python.org');
  return 'python';
}

// ============================================================================
// Types
// ============================================================================

export interface SkillInfo {
  name: string;
  slug: string;           // folder name (e.g., "smart-router")
  toolName: string;       // tool name (e.g., "skill_smart_router")
  description: string;
  category: string;
  emoji: string;
  tier: string;
  hasImplementation: boolean;
  implementationType: 'python' | 'typescript' | 'planned';
  scriptPath?: string;
  mainScript?: string;    // e.g., "router.py", "analyzer.py"
  skillMdPath: string;
  dependencies?: string[];
}

export interface SkillExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTimeMs?: number;
  logs?: string[];
}

// ============================================================================
// Skill Discovery
// ============================================================================

/**
 * Discover all skills in the /skills directory
 */
export function discoverSkills(skillsDir?: string): SkillInfo[] {
  const baseDir = skillsDir || path.join(process.cwd(), 'skills');
  
  if (!fs.existsSync(baseDir)) {
    console.warn(`Skills directory not found: ${baseDir}`);
    return [];
  }
  
  const skills: SkillInfo[] = [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    
    const skillDir = path.join(baseDir, entry.name);
    const skillInfo = parseSkillDirectory(entry.name, skillDir);
    
    if (skillInfo) {
      skills.push(skillInfo);
    }
  }
  
  // Sort by name
  skills.sort((a, b) => a.name.localeCompare(b.name));
  
  return skills;
}

/**
 * Parse a single skill directory
 */
function parseSkillDirectory(folderName: string, skillDir: string): SkillInfo | null {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  
  // Default values
  let description = `${folderName} skill`;
  let category = 'utility';
  let emoji = '🔧';
  let tier = 'free';
  
  // Parse SKILL.md if exists
  if (fs.existsSync(skillMdPath)) {
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const parsed = parseSkillMd(content);
    description = parsed.description || description;
    category = parsed.category || category;
    emoji = parsed.emoji || emoji;
    tier = parsed.tier || tier;
  }
  
  // Find Python implementation
  const pythonFiles = findPythonFiles(skillDir);
  const mainScript = findMainScript(pythonFiles, folderName);
  
  // Check for TypeScript implementation
  const tsFiles = fs.readdirSync(skillDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');
  const mainTsScript = tsFiles.length > 0 ? tsFiles[0] : undefined;
  
  // Has implementation if Python OR TypeScript files exist
  const hasImplementation = pythonFiles.length > 0 || tsFiles.length > 0;
  const implementationType = pythonFiles.length > 0 ? 'python' : 
                            tsFiles.length > 0 ? 'typescript' : 'planned';
  
  // Prefer Python script, fall back to TypeScript
  const finalMainScript = mainScript || mainTsScript;
  
  const slug = folderName;
  const toolName = `skill_${folderName.replace(/-/g, '_')}`;
  
  return {
    name: formatSkillName(folderName),
    slug,
    toolName,
    description,
    category,
    emoji,
    tier,
    hasImplementation,
    implementationType,
    scriptPath: mainScript ? path.join(skillDir, mainScript) : undefined,
    mainScript: finalMainScript,
    skillMdPath,
  };
}

/**
 * Parse SKILL.md frontmatter and content
 */
function parseSkillMd(content: string): {
  description?: string;
  category?: string;
  emoji?: string;
  tier?: string;
} {
  const result: any = {};
  
  // Check for YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    
    // Parse description from frontmatter
    const descMatch = frontmatter.match(/description:\s*["']?([^"'\n]+)["']?/);
    if (descMatch) {
      result.description = descMatch[1].trim();
    }
    
    // Parse category
    const catMatch = frontmatter.match(/category:\s*["']?([^"'\n]+)["']?/);
    if (catMatch) {
      result.category = catMatch[1].trim();
    }
    
    // Parse emoji
    const emojiMatch = frontmatter.match(/emoji:\s*["']?([^"'\n]+)["']?/);
    if (emojiMatch) {
      result.emoji = emojiMatch[1].trim();
    }
    
    // Parse tier
    const tierMatch = frontmatter.match(/tier:\s*["']?([^"'\n]+)["']?/);
    if (tierMatch) {
      result.tier = tierMatch[1].trim();
    }
  }
  
  // If no description from frontmatter, get from first paragraph after title
  if (!result.description) {
    // Look for first paragraph after # heading
    const titleMatch = content.match(/^#\s+[^\n]+\n+\*?\*?([^*\n][^\n]+)/m);
    if (titleMatch) {
      result.description = titleMatch[1].trim().replace(/\*+/g, '');
    }
  }
  
  // Extract emoji from title if not in frontmatter
  if (!result.emoji) {
    const titleMatch = content.match(/^#\s+([^\n]+)/m);
    if (titleMatch) {
      const title = titleMatch[1];
      const emojiMatch = title.match(/([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/u);
      if (emojiMatch) {
        result.emoji = emojiMatch[1];
      }
    }
  }
  
  return result;
}

/**
 * Find Python files in skill directory
 */
function findPythonFiles(skillDir: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(skillDir);
    for (const entry of entries) {
      if (entry.endsWith('.py') && entry !== '__init__.py') {
        files.push(entry);
      }
    }
    
    // Also check scripts/ subdirectory
    const scriptsDir = path.join(skillDir, 'scripts');
    if (fs.existsSync(scriptsDir)) {
      const scriptEntries = fs.readdirSync(scriptsDir);
      for (const entry of scriptEntries) {
        if (entry.endsWith('.py')) {
          files.push(`scripts/${entry}`);
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }
  
  return files;
}

/**
 * Find the main script for a skill
 */
function findMainScript(pythonFiles: string[], folderName: string): string | undefined {
  if (pythonFiles.length === 0) return undefined;
  
  // Priority order for main script detection
  const underscoreName = folderName.replace(/-/g, '_');
  const priorities = [
    `${underscoreName}.py`,         // whale_tracker.py
    `${folderName}.py`,             // whale-tracker.py (unlikely but check)
    'main.py',
    'index.py',
    'router.py',
    'analyzer.py',
    'tracker.py',
    'finder.py',
    'bot.py',
    'agent.py',
  ];
  
  for (const priority of priorities) {
    if (pythonFiles.includes(priority)) {
      return priority;
    }
  }
  
  // Return first Python file if no match
  return pythonFiles[0];
}

/**
 * Format skill name from folder name
 */
function formatSkillName(folderName: string): string {
  return folderName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// Skill Execution
// ============================================================================

/**
 * Execute a Python skill
 */
export async function executeSkill(
  skill: SkillInfo,
  args: Record<string, any> = {}
): Promise<SkillExecutionResult> {
  if (!skill.hasImplementation || !skill.scriptPath) {
    return {
      success: false,
      error: `Skill ${skill.name} is not implemented yet (planned)`,
    };
  }
  
  if (skill.implementationType !== 'python') {
    return {
      success: false,
      error: `Skill ${skill.name} is implemented in ${skill.implementationType}, not Python`,
    };
  }
  
  const startTime = Date.now();
  
  try {
    // Prepare arguments as JSON
    const argsJson = JSON.stringify(args);
    
    // Execute Python script
    const result = execSync(
      `python "${skill.scriptPath}" '${argsJson.replace(/'/g, "\\'")}' 2>&1`,
      {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 60000, // 60s timeout
        cwd: path.dirname(skill.scriptPath),
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          KIT_SKILL_ARGS: argsJson,
        }
      }
    );
    
    const executionTimeMs = Date.now() - startTime;
    
    // Try to parse JSON output
    try {
      // Find JSON in output (might have logs before it)
      const jsonMatch = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data,
          executionTimeMs,
          logs: result.split('\n').filter(line => !line.startsWith('{') && !line.startsWith('[')),
        };
      }
      
      // Return raw output if no JSON
      return {
        success: true,
        data: { output: result.trim() },
        executionTimeMs,
      };
    } catch (parseError) {
      // Return raw output
      return {
        success: true,
        data: { output: result.trim() },
        executionTimeMs,
      };
    }
  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;
    return {
      success: false,
      error: error.message || String(error),
      executionTimeMs,
      logs: error.stdout ? [error.stdout] : undefined,
    };
  }
}

/**
 * Execute skill with streaming output (for long-running tasks)
 */
export function executeSkillStreaming(
  skill: SkillInfo,
  args: Record<string, any> = {},
  onOutput: (data: string) => void,
  onError: (error: string) => void
): Promise<SkillExecutionResult> {
  return new Promise((resolve) => {
    if (!skill.hasImplementation || !skill.scriptPath) {
      resolve({
        success: false,
        error: `Skill ${skill.name} is not implemented yet`,
      });
      return;
    }
    
    const startTime = Date.now();
    const argsJson = JSON.stringify(args);
    
    const pythonPath = getPythonPath();
    const child = spawn(pythonPath, [skill.scriptPath, argsJson], {
      cwd: path.dirname(skill.scriptPath),
      shell: pythonPath.includes(' '), // Use shell if path has spaces or is a command like 'py -3'
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        KIT_SKILL_ARGS: argsJson,
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      onOutput(text);
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      onError(text);
    });
    
    child.on('close', (code) => {
      const executionTimeMs = Date.now() - startTime;
      
      if (code === 0) {
        // Try to parse final JSON
        try {
          const jsonMatch = stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) {
            resolve({
              success: true,
              data: JSON.parse(jsonMatch[0]),
              executionTimeMs,
            });
            return;
          }
        } catch {}
        
        resolve({
          success: true,
          data: { output: stdout.trim() },
          executionTimeMs,
        });
      } else {
        resolve({
          success: false,
          error: stderr || `Process exited with code ${code}`,
          executionTimeMs,
        });
      }
    });
  });
}

// ============================================================================
// Tool Creation
// ============================================================================

/**
 * Create a tool definition for a skill
 */
export function createSkillToolDefinition(skill: SkillInfo): ToolDefinition {
  return {
    name: skill.toolName,
    description: `${skill.emoji} ${skill.name}: ${skill.description}`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform (depends on skill)',
        },
        symbol: {
          type: 'string',
          description: 'Trading symbol (e.g., BTC/USDT)',
        },
        amount: {
          type: 'number',
          description: 'Amount for trade/operation',
        },
        params: {
          type: 'object',
          description: 'Additional parameters as JSON object',
        },
      },
      required: [],
    },
  };
}

/**
 * Create a tool handler for a skill
 */
export function createSkillToolHandler(skill: SkillInfo): ToolHandler {
  return async (args, context) => {
    const result = await executeSkill(skill, args);
    
    if (!result.success) {
      return {
        error: result.error,
        skill: skill.name,
        executionTimeMs: result.executionTimeMs,
      };
    }
    
    return {
      skill: skill.name,
      ...result.data,
      executionTimeMs: result.executionTimeMs,
    };
  };
}

// ============================================================================
// Registry Integration
// ============================================================================

/**
 * Register all discovered skills as tools
 */
export function registerAllSkills(
  registry: ToolRegistry,
  skillsDir?: string
): { registered: number; skipped: number; skills: SkillInfo[] } {
  const skills = discoverSkills(skillsDir);
  
  let registered = 0;
  let skipped = 0;
  
  for (const skill of skills) {
    if (skill.hasImplementation && skill.implementationType === 'python') {
      const definition = createSkillToolDefinition(skill);
      const handler = createSkillToolHandler(skill);
      
      registry.register(definition, handler, 'trading');
      registered++;
      
      console.log(`✅ Registered skill: ${skill.toolName} (${skill.mainScript})`);
    } else {
      skipped++;
      // console.log(`⏭️  Skipped skill: ${skill.name} (${skill.implementationType})`);
    }
  }
  
  return { registered, skipped, skills };
}

/**
 * Get skill by name or tool name
 */
export function getSkill(nameOrToolName: string, skillsDir?: string): SkillInfo | undefined {
  const skills = discoverSkills(skillsDir);
  
  return skills.find(s => 
    s.name.toLowerCase() === nameOrToolName.toLowerCase() ||
    s.toolName === nameOrToolName ||
    s.slug === nameOrToolName
  );
}

/**
 * List all skills with their status
 */
export function listSkillsWithStatus(skillsDir?: string): {
  total: number;
  implemented: number;
  planned: number;
  byCategory: Record<string, SkillInfo[]>;
  skills: SkillInfo[];
} {
  const skills = discoverSkills(skillsDir);
  
  const implemented = skills.filter(s => s.hasImplementation);
  const planned = skills.filter(s => !s.hasImplementation);
  
  const byCategory: Record<string, SkillInfo[]> = {};
  for (const skill of skills) {
    if (!byCategory[skill.category]) {
      byCategory[skill.category] = [];
    }
    byCategory[skill.category].push(skill);
  }
  
  return {
    total: skills.length,
    implemented: implemented.length,
    planned: planned.length,
    byCategory,
    skills,
  };
}

// All functions are already exported inline with 'export function'
