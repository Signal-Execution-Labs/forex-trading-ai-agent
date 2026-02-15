/**
 * Skill Type Definitions for K.I.T.
 */

export interface SkillInput {
  action: string;
  params: any;  // Allow any params type for flexibility
}

export interface SkillContext {
  config: Record<string, any>;
  input?: SkillInput;
  logger: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
    debug: (msg: string, ...args: any[]) => void;
  };
  storage: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  http: {
    get: <T>(url: string, options?: RequestInit) => Promise<T>;
    post: <T>(url: string, body: any, options?: RequestInit) => Promise<T>;
    put: <T>(url: string, body: any, options?: RequestInit) => Promise<T>;
    delete: <T>(url: string, options?: RequestInit) => Promise<T>;
  };
  emit: (event: string, data: any) => void;
}

export interface SkillResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  author?: string;
  requires?: string[];
}

export interface Skill extends SkillDefinition {
  config?: any;
  init?: (ctx: SkillContext) => Promise<void>;
  execute: (context: SkillContext) => Promise<SkillResult>;
  cleanup?: (ctx: SkillContext) => Promise<void>;
}

export type { Skill as default };
