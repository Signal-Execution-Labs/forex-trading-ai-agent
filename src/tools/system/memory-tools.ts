/**
 * K.I.T. Memory Tools
 * Persistent memory system like OpenClaw
 * 
 * Files:
 * - MEMORY.md - Curated long-term memory
 * - memory/YYYY-MM-DD.md - Daily memory logs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler, ToolContext } from './tool-registry';

const KIT_HOME = path.join(os.homedir(), '.kit');
const WORKSPACE_DIR = path.join(KIT_HOME, 'workspace');
const MEMORY_DIR = path.join(WORKSPACE_DIR, 'memory');

// ============================================================================
// Memory Search Tool
// ============================================================================

export const memorySearchToolDefinition: ToolDefinition = {
  name: 'memory_search',
  description: 'Search through memory files (MEMORY.md and memory/*.md) for relevant information. Use before answering questions about prior work, decisions, or user preferences.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query - what to look for in memory',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
      },
    },
    required: ['query'],
  },
};

export const memorySearchToolHandler: ToolHandler = async (args) => {
  const { query, maxResults = 5 } = args as { query: string; maxResults?: number };

  const results: { file: string; line: number; content: string; score: number }[] = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  // Helper to search a file
  const searchFile = (filePath: string, relativePath: string) => {
    if (!fs.existsSync(filePath)) return;
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineLower = line.toLowerCase();
      
      // Calculate simple relevance score
      let score = 0;
      
      // Exact phrase match
      if (lineLower.includes(queryLower)) {
        score += 10;
      }
      
      // Individual word matches
      for (const word of queryWords) {
        if (lineLower.includes(word)) {
          score += 2;
        }
      }
      
      if (score > 0 && line.trim().length > 0) {
        results.push({
          file: relativePath,
          line: index + 1,
          content: line.trim().substring(0, 200),
          score,
        });
      }
    });
  };

  // Search MEMORY.md
  searchFile(path.join(WORKSPACE_DIR, 'MEMORY.md'), 'MEMORY.md');

  // Search daily memory files
  if (fs.existsSync(MEMORY_DIR)) {
    const files = fs.readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse(); // Most recent first
    
    for (const file of files.slice(0, 30)) { // Last 30 days
      searchFile(path.join(MEMORY_DIR, file), `memory/${file}`);
    }
  }

  // Sort by score and limit
  results.sort((a, b) => b.score - a.score);
  const topResults = results.slice(0, maxResults);

  return {
    success: true,
    query,
    resultCount: topResults.length,
    totalMatches: results.length,
    results: topResults,
  };
};

// ============================================================================
// Memory Get Tool
// ============================================================================

export const memoryGetToolDefinition: ToolDefinition = {
  name: 'memory_get',
  description: 'Read content from a memory file. Use after memory_search to get full context.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to memory file (e.g., "MEMORY.md" or "memory/2024-01-15.md")',
      },
      from: {
        type: 'number',
        description: 'Start line number (1-indexed)',
      },
      lines: {
        type: 'number',
        description: 'Number of lines to read (default: 50)',
      },
    },
    required: ['path'],
  },
};

export const memoryGetToolHandler: ToolHandler = async (args) => {
  const { path: memPath, from = 1, lines = 50 } = args as { 
    path: string; 
    from?: number; 
    lines?: number;
  };

  // Resolve path
  let fullPath: string;
  if (memPath.startsWith('memory/')) {
    fullPath = path.join(WORKSPACE_DIR, memPath);
  } else if (memPath === 'MEMORY.md') {
    fullPath = path.join(WORKSPACE_DIR, 'MEMORY.md');
  } else {
    fullPath = path.join(WORKSPACE_DIR, memPath);
  }

  if (!fs.existsSync(fullPath)) {
    return {
      success: false,
      error: `File not found: ${memPath}`,
    };
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const allLines = content.split('\n');
  
  const startLine = Math.max(1, from) - 1;
  const endLine = Math.min(startLine + lines, allLines.length);
  const selectedLines = allLines.slice(startLine, endLine);

  return {
    success: true,
    path: memPath,
    fromLine: startLine + 1,
    toLine: endLine,
    totalLines: allLines.length,
    content: selectedLines.join('\n'),
  };
};

// ============================================================================
// Memory Write Tool
// ============================================================================

export const memoryWriteToolDefinition: ToolDefinition = {
  name: 'memory_write',
  description: 'Write to daily memory log (memory/YYYY-MM-DD.md). Use to record important events, decisions, or learnings.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Content to add to today\'s memory log',
      },
      section: {
        type: 'string',
        description: 'Optional section header (e.g., "Trading", "Decisions")',
      },
    },
    required: ['content'],
  },
};

export const memoryWriteToolHandler: ToolHandler = async (args) => {
  const { content, section } = args as { content: string; section?: string };

  // Ensure memory directory exists
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  const filePath = path.join(MEMORY_DIR, `${today}.md`);

  // Format entry
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  let entry = '';
  
  if (section) {
    entry = `\n## ${section}\n\n`;
  }
  entry += `**${timestamp}**\n${content}\n`;

  // Create or append to file
  if (fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, entry);
  } else {
    const header = `# Memory Log - ${today}\n\n`;
    fs.writeFileSync(filePath, header + entry);
  }

  return {
    success: true,
    file: `memory/${today}.md`,
    timestamp,
    message: 'Memory entry added',
  };
};

// ============================================================================
// Memory Update Tool (for MEMORY.md)
// ============================================================================

export const memoryUpdateToolDefinition: ToolDefinition = {
  name: 'memory_update',
  description: 'Update the long-term memory file (MEMORY.md). Use for important, curated information that should persist.',
  parameters: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description: 'Section name to add/update (e.g., "User Preferences", "Trading History")',
      },
      content: {
        type: 'string',
        description: 'Content for this section',
      },
      append: {
        type: 'string',
        description: 'Set to "true" to append to existing section instead of replacing',
      },
    },
    required: ['section', 'content'],
  },
};

export const memoryUpdateToolHandler: ToolHandler = async (args) => {
  const { section, content, append } = args as { 
    section: string; 
    content: string;
    append?: string;
  };

  const filePath = path.join(WORKSPACE_DIR, 'MEMORY.md');
  const shouldAppend = append === 'true';

  // Create file if doesn't exist
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }

  let fileContent = '';
  if (fs.existsSync(filePath)) {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } else {
    fileContent = '# K.I.T. Long-Term Memory\n\nCurated memories and important information.\n\n';
  }

  // Find or create section
  const sectionHeader = `## ${section}`;
  const sectionRegex = new RegExp(`(## ${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?)(?=\\n## |$)`);
  
  const timestamp = new Date().toISOString().split('T')[0];
  const newContent = `${sectionHeader}\n\n*Updated: ${timestamp}*\n\n${content}\n\n`;

  if (fileContent.includes(sectionHeader)) {
    if (shouldAppend) {
      // Append to existing section
      fileContent = fileContent.replace(sectionRegex, `$1\n${content}\n\n`);
    } else {
      // Replace section
      fileContent = fileContent.replace(sectionRegex, newContent);
    }
  } else {
    // Add new section
    fileContent += newContent;
  }

  fs.writeFileSync(filePath, fileContent);

  return {
    success: true,
    file: 'MEMORY.md',
    section,
    action: shouldAppend ? 'appended' : 'updated',
    message: `Memory section "${section}" ${shouldAppend ? 'appended' : 'updated'}`,
  };
};

// ============================================================================
// Memory List Tool
// ============================================================================

export const memoryListToolDefinition: ToolDefinition = {
  name: 'memory_list',
  description: 'List available memory files and their last modified dates.',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of daily files to list (default: 10)',
      },
    },
    required: [],
  },
};

export const memoryListToolHandler: ToolHandler = async (args) => {
  const { limit = 10 } = args as { limit?: number };

  const files: { name: string; path: string; modified: string; size: number }[] = [];

  // Check MEMORY.md
  const memoryPath = path.join(WORKSPACE_DIR, 'MEMORY.md');
  if (fs.existsSync(memoryPath)) {
    const stats = fs.statSync(memoryPath);
    files.push({
      name: 'MEMORY.md',
      path: 'MEMORY.md',
      modified: stats.mtime.toISOString(),
      size: stats.size,
    });
  }

  // List daily files
  if (fs.existsSync(MEMORY_DIR)) {
    const dailyFiles = fs.readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, limit);
    
    for (const file of dailyFiles) {
      const filePath = path.join(MEMORY_DIR, file);
      const stats = fs.statSync(filePath);
      files.push({
        name: file,
        path: `memory/${file}`,
        modified: stats.mtime.toISOString(),
        size: stats.size,
      });
    }
  }

  return {
    success: true,
    files,
    memoryDir: MEMORY_DIR,
    workspaceDir: WORKSPACE_DIR,
  };
};
