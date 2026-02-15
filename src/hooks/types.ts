/**
 * K.I.T. Hooks Type Definitions
 * OpenClaw-compatible hook system types
 */

// ============================================================================
// Hook Events
// ============================================================================

export type HookEvent =
  | 'trade:executed'
  | 'trade:closed'
  | 'portfolio:changed'
  | 'alert:triggered'
  | 'session:start'
  | 'session:end'
  | 'signal:received'
  | 'risk:warning'
  | 'market:open'
  | 'market:close'
  | 'market:tick'
  | 'onboarding:complete'
  | 'config:changed'
  | 'gateway:startup'
  | 'command:new'
  | 'command:reset';

// ============================================================================
// Hook Context
// ============================================================================

export interface HookContext {
  event: HookEvent;
  timestamp: Date;
  data: Record<string, any>;
  kitVersion: string;
  agentId: string;
  messages: string[]; // Push messages here to send to user (OpenClaw-compatible)
  context: {
    sessionKey?: string;
    workspaceDir?: string;
    cfg?: Record<string, any>;
  };
}

// ============================================================================
// Hook Metadata (from HOOK.md frontmatter)
// ============================================================================

export interface HookMetadataKit {
  emoji?: string;
  events: HookEvent[];
  export?: string; // Named export to use (defaults to 'default')
  homepage?: string;
  priority?: number;
  always?: boolean; // Bypass eligibility checks
  requires?: {
    bins?: string[];        // Required binaries on PATH
    anyBins?: string[];     // At least one must be present
    env?: string[];         // Required environment variables
    config?: string[];      // Required config paths
    os?: string[];          // Required platforms
  };
  install?: Array<{ id: string; kind: string }>;
}

export interface HookFrontmatter {
  name: string;
  description: string;
  version?: string;
  author?: string;
  homepage?: string;
  metadata?: {
    kit?: HookMetadataKit;
  };
}

// ============================================================================
// Hook Definition
// ============================================================================

export interface HookDefinition extends HookFrontmatter {
  id: string;
  path: string;       // Path to hook directory
  handlerPath: string; // Path to handler.ts
  enabled: boolean;
  source: 'bundled' | 'managed' | 'workspace';
}

export type HookHandler = (context: HookContext) => Promise<void> | void;

export interface LoadedHook extends HookDefinition {
  handler: HookHandler;
  // Direct access for backward compatibility (always set during registration)
  events: HookEvent[];
  priority: number;
  emoji: string;
}

// ============================================================================
// Hook Results
// ============================================================================

export interface HookResult {
  hookId: string;
  success: boolean;
  durationMs: number;
  error?: string;
  messages?: string[];
}

// ============================================================================
// Hook Config
// ============================================================================

export interface HookConfig {
  internal?: {
    enabled?: boolean;
    entries?: Record<string, { enabled?: boolean; env?: Record<string, string> }>;
    load?: {
      extraDirs?: string[];
    };
  };
}

// ============================================================================
// Backward Compatibility Aliases
// ============================================================================

/** @deprecated Use LoadedHook instead */
export interface Hook extends HookMetadata {
  id: string;
  handler: HookHandler;
  events: HookEvent[];
  enabled: boolean;
  priority?: number;
}

/** @deprecated Use HookFrontmatter instead */
export interface HookMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  homepage?: string;
  emoji?: string;
  events?: HookEvent[];
  priority?: number;
  enabled?: boolean;
}

/**
 * HookRegistry class interface for backward compatibility
 */
export interface HookRegistryInterface {
  initialize(): Promise<void>;
  register(hook: LoadedHook): void;
  unregister(hookId: string): boolean;
  setEnabled(hookId: string, enabled: boolean): boolean;
  getAll(): LoadedHook[];
  getForEvent(event: HookEvent): LoadedHook[];
  get(hookId: string): LoadedHook | undefined;
  emit(event: HookEvent, data?: Record<string, any>, agentId?: string): Promise<HookResult[]>;
}
