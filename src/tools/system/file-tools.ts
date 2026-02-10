/**
 * K.I.T. File Tools
 * Read, write, and edit files like OpenClaw
 */

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolHandler } from './tool-registry';

// ============================================================================
// Read Tool
// ============================================================================

export const readToolDefinition: ToolDefinition = {
  name: 'read',
  description: 'Read the contents of a file. Supports text files. Use offset/limit for large files.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read (relative to workspace or absolute)',
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (1-indexed)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read (default: 500)',
      },
    },
    required: ['path'],
  },
};

export const readToolHandler: ToolHandler = async (args, context) => {
  const { path: filePath, offset = 1, limit = 500 } = args as {
    path: string;
    offset?: number;
    limit?: number;
  };

  // Resolve path relative to workspace
  const resolvedPath = path.isAbsolute(filePath) 
    ? filePath 
    : path.join(context.workspaceDir, filePath);

  // Security check - don't allow reading outside workspace
  if (!resolvedPath.startsWith(context.workspaceDir) && !path.isAbsolute(filePath)) {
    throw new Error(`Path must be within workspace: ${context.workspaceDir}`);
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    // List directory contents
    const entries = fs.readdirSync(resolvedPath);
    return {
      type: 'directory',
      path: resolvedPath,
      entries: entries.map(entry => {
        const entryPath = path.join(resolvedPath, entry);
        const entryStat = fs.statSync(entryPath);
        return {
          name: entry,
          type: entryStat.isDirectory() ? 'directory' : 'file',
          size: entryStat.size,
        };
      }),
    };
  }

  // Read file
  const content = fs.readFileSync(resolvedPath, 'utf8');
  const lines = content.split('\n');
  const totalLines = lines.length;

  // Apply offset and limit
  const startLine = Math.max(1, offset) - 1;
  const selectedLines = lines.slice(startLine, startLine + limit);

  return {
    type: 'file',
    path: resolvedPath,
    totalLines,
    offset: startLine + 1,
    limit,
    content: selectedLines.join('\n'),
    truncated: startLine + limit < totalLines,
  };
};

// ============================================================================
// Write Tool
// ============================================================================

export const writeToolDefinition: ToolDefinition = {
  name: 'write',
  description: 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does. Automatically creates parent directories.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
};

export const writeToolHandler: ToolHandler = async (args, context) => {
  const { path: filePath, content } = args as {
    path: string;
    content: string;
  };

  // Resolve path relative to workspace
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(context.workspaceDir, filePath);

  // Security check
  if (!resolvedPath.startsWith(context.workspaceDir) && !path.isAbsolute(filePath)) {
    throw new Error(`Path must be within workspace: ${context.workspaceDir}`);
  }

  // Create parent directories
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Check if file exists
  const existed = fs.existsSync(resolvedPath);

  // Write file
  fs.writeFileSync(resolvedPath, content, 'utf8');

  return {
    success: true,
    path: resolvedPath,
    created: !existed,
    bytes: Buffer.byteLength(content, 'utf8'),
    lines: content.split('\n').length,
  };
};

// ============================================================================
// Edit Tool
// ============================================================================

export const editToolDefinition: ToolDefinition = {
  name: 'edit',
  description: 'Edit a file by replacing exact text. The oldText must match exactly (including whitespace). Use this for precise, surgical edits.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit',
      },
      oldText: {
        type: 'string',
        description: 'Exact text to find and replace (must match exactly)',
      },
      newText: {
        type: 'string',
        description: 'New text to replace the old text with',
      },
    },
    required: ['path', 'oldText', 'newText'],
  },
};

export const editToolHandler: ToolHandler = async (args, context) => {
  const { path: filePath, oldText, newText } = args as {
    path: string;
    oldText: string;
    newText: string;
  };

  // Resolve path
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(context.workspaceDir, filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  // Read current content
  const content = fs.readFileSync(resolvedPath, 'utf8');

  // Check if old text exists
  if (!content.includes(oldText)) {
    throw new Error(`Text not found in file. Make sure the oldText matches exactly, including whitespace.`);
  }

  // Count occurrences
  const occurrences = content.split(oldText).length - 1;
  if (occurrences > 1) {
    return {
      success: false,
      error: `Found ${occurrences} occurrences. Please use more specific text to ensure unique match.`,
      occurrences,
    };
  }

  // Replace
  const newContent = content.replace(oldText, newText);
  fs.writeFileSync(resolvedPath, newContent, 'utf8');

  return {
    success: true,
    path: resolvedPath,
    replaced: 1,
    oldLength: oldText.length,
    newLength: newText.length,
  };
};

// ============================================================================
// List Directory Tool
// ============================================================================

export const listToolDefinition: ToolDefinition = {
  name: 'list',
  description: 'List files and directories in a path',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path to list (defaults to workspace root)',
      },
      recursive: {
        type: 'boolean',
        description: 'List recursively (default: false)',
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum depth for recursive listing (default: 3)',
      },
    },
    required: [],
  },
};

export const listToolHandler: ToolHandler = async (args, context) => {
  const { path: dirPath = '.', recursive = false, maxDepth = 3 } = args as {
    path?: string;
    recursive?: boolean;
    maxDepth?: number;
  };

  const resolvedPath = path.isAbsolute(dirPath)
    ? dirPath
    : path.join(context.workspaceDir, dirPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory not found: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${resolvedPath}`);
  }

  const listDir = (dir: string, depth: number): any[] => {
    if (depth > maxDepth) return [];
    
    const entries = fs.readdirSync(dir);
    return entries.map(entry => {
      const entryPath = path.join(dir, entry);
      const entryStat = fs.statSync(entryPath);
      const isDir = entryStat.isDirectory();
      
      const result: any = {
        name: entry,
        type: isDir ? 'directory' : 'file',
        size: entryStat.size,
      };
      
      if (recursive && isDir && depth < maxDepth) {
        result.children = listDir(entryPath, depth + 1);
      }
      
      return result;
    });
  };

  return {
    path: resolvedPath,
    entries: listDir(resolvedPath, 0),
  };
};
