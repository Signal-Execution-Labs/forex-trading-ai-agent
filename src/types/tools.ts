/**
 * Tool Type Definitions for K.I.T.
 * Compatible with OpenClaw tool patterns
 */

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: any;
  enum?: string[];
}

export interface ToolSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  description?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: ToolParameter[];
  schema?: ToolSchema;
  returns?: {
    type: string;
    description: string;
  };
}

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolContext {
  logger: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
    debug: (msg: string, ...args: any[]) => void;
  };
  config: Record<string, any>;
  storage?: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
}

export interface Tool extends ToolDefinition {
  execute?: (params: Record<string, any>, context?: ToolContext) => Promise<ToolResult>;
  handler?: (params: Record<string, any>, context?: ToolContext) => Promise<ToolResult>;
}

export type { Tool as default };
