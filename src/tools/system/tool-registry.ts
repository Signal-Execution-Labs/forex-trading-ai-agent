/**
 * K.I.T. Tool Registry
 * Central registry for all tools like OpenClaw
 */

import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Types
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string | string[];
      description: string;
      enum?: string[];
      items?: any;
      properties?: any;
      required?: string[];
    }>;
    required: string[];
  };
}

export interface ToolContext {
  workspaceDir: string;
  configDir: string;
  agentId: string;
  sessionId?: string;
  userId?: string;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<unknown>;

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
  category: 'system' | 'trading' | 'analysis' | 'channel' | 'utility';
  enabled: boolean;
}

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private defaultContext: ToolContext;

  constructor(workspaceDir?: string) {
    this.defaultContext = {
      workspaceDir: workspaceDir || path.join(os.homedir(), '.kit', 'workspace'),
      configDir: path.join(os.homedir(), '.kit'),
      agentId: 'main',
    };
  }

  /**
   * Register a tool
   */
  register(
    definition: ToolDefinition,
    handler: ToolHandler,
    category: RegisteredTool['category'] = 'utility'
  ): void {
    this.tools.set(definition.name, {
      definition,
      handler,
      category,
      enabled: true,
    });
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get tool by name
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all tools
   */
  list(category?: RegisteredTool['category']): RegisteredTool[] {
    const tools = Array.from(this.tools.values());
    if (category) {
      return tools.filter(t => t.category === category);
    }
    return tools;
  }

  /**
   * Get tool definitions for LLM
   */
  getDefinitions(enabledOnly = true): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => !enabledOnly || t.enabled)
      .map(t => t.definition);
  }

  /**
   * Execute a tool
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context?: Partial<ToolContext>
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    if (!tool.enabled) {
      throw new Error(`Tool is disabled: ${name}`);
    }

    const fullContext: ToolContext = {
      ...this.defaultContext,
      ...context,
    };

    try {
      return await tool.handler(args, fullContext);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Tool '${name}' failed: ${message}`);
    }
  }

  /**
   * Enable/disable a tool
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;
    tool.enabled = enabled;
    return true;
  }

  /**
   * Get context
   */
  getContext(): ToolContext {
    return { ...this.defaultContext };
  }

  /**
   * Set workspace directory
   */
  setWorkspaceDir(dir: string): void {
    this.defaultContext.workspaceDir = dir;
  }
}

// ============================================================================
// Default Registry with System Tools
// ============================================================================

import {
  readToolDefinition, readToolHandler,
  writeToolDefinition, writeToolHandler,
  editToolDefinition, editToolHandler,
  listToolDefinition, listToolHandler,
} from './file-tools';

import {
  execToolDefinition, execToolHandler,
  processToolDefinition, processToolHandler,
} from './exec-tools';

import {
  configGetToolDefinition, configGetToolHandler,
  configSetToolDefinition, configSetToolHandler,
  configDeleteToolDefinition, configDeleteToolHandler,
  envSetToolDefinition, envSetToolHandler,
  statusToolDefinition, statusToolHandler,
  userProfileToolDefinition, userProfileToolHandler,
} from './config-tools';

import {
  skillsListToolDefinition, skillsListToolHandler,
  skillsEnableToolDefinition, skillsEnableToolHandler,
  skillsDisableToolDefinition, skillsDisableToolHandler,
  skillsSetupToolDefinition, skillsSetupToolHandler,
} from './skills-tools';

import {
  onboardingStartToolDefinition, onboardingStartToolHandler,
  onboardingContinueToolDefinition, onboardingContinueToolHandler,
  onboardingStatusToolDefinition, onboardingStatusToolHandler,
} from './onboarding';

import {
  telegramSetupToolDefinition, telegramSetupToolHandler,
  telegramStatusToolDefinition, telegramStatusToolHandler,
  telegramSendToolDefinition, telegramSendToolHandler,
  telegramGetUpdatesToolDefinition, telegramGetUpdatesToolHandler,
  telegramGetChatIdToolDefinition, telegramGetChatIdToolHandler,
  telegramSetChatIdToolDefinition, telegramSetChatIdToolHandler,
} from './telegram-tools';

import {
  whatsappStatusToolDefinition, whatsappStatusToolHandler,
  whatsappSetupToolDefinition, whatsappSetupToolHandler,
  whatsappSendToolDefinition, whatsappSendToolHandler,
  whatsappLogoutToolDefinition, whatsappLogoutToolHandler,
} from './whatsapp-tools';

import {
  memorySearchToolDefinition, memorySearchToolHandler,
  memoryGetToolDefinition, memoryGetToolHandler,
  memoryWriteToolDefinition, memoryWriteToolHandler,
  memoryUpdateToolDefinition, memoryUpdateToolHandler,
  memoryListToolDefinition, memoryListToolHandler,
} from './memory-tools';

export function createDefaultToolRegistry(workspaceDir?: string): ToolRegistry {
  const registry = new ToolRegistry(workspaceDir);

  // File tools
  registry.register(readToolDefinition, readToolHandler, 'system');
  registry.register(writeToolDefinition, writeToolHandler, 'system');
  registry.register(editToolDefinition, editToolHandler, 'system');
  registry.register(listToolDefinition, listToolHandler, 'system');

  // Exec tools
  registry.register(execToolDefinition, execToolHandler, 'system');
  registry.register(processToolDefinition, processToolHandler, 'system');

  // Config tools
  registry.register(configGetToolDefinition, configGetToolHandler, 'system');
  registry.register(configSetToolDefinition, configSetToolHandler, 'system');
  registry.register(configDeleteToolDefinition, configDeleteToolHandler, 'system');
  registry.register(envSetToolDefinition, envSetToolHandler, 'system');
  registry.register(statusToolDefinition, statusToolHandler, 'system');
  registry.register(userProfileToolDefinition, userProfileToolHandler, 'system');
  
  // Skills tools
  registry.register(skillsListToolDefinition, skillsListToolHandler, 'system');
  registry.register(skillsEnableToolDefinition, skillsEnableToolHandler, 'system');
  registry.register(skillsDisableToolDefinition, skillsDisableToolHandler, 'system');
  registry.register(skillsSetupToolDefinition, skillsSetupToolHandler, 'system');

  // Onboarding tools
  registry.register(onboardingStartToolDefinition, onboardingStartToolHandler, 'system');
  registry.register(onboardingContinueToolDefinition, onboardingContinueToolHandler, 'system');
  registry.register(onboardingStatusToolDefinition, onboardingStatusToolHandler, 'system');

  // Telegram/Channel tools
  registry.register(telegramSetupToolDefinition, telegramSetupToolHandler, 'channel');
  registry.register(telegramStatusToolDefinition, telegramStatusToolHandler, 'channel');
  registry.register(telegramSendToolDefinition, telegramSendToolHandler, 'channel');
  registry.register(telegramGetUpdatesToolDefinition, telegramGetUpdatesToolHandler, 'channel');
  registry.register(telegramGetChatIdToolDefinition, telegramGetChatIdToolHandler, 'channel');
  registry.register(telegramSetChatIdToolDefinition, telegramSetChatIdToolHandler, 'channel');

  // WhatsApp/Channel tools
  registry.register(whatsappStatusToolDefinition, whatsappStatusToolHandler, 'channel');
  registry.register(whatsappSetupToolDefinition, whatsappSetupToolHandler, 'channel');
  registry.register(whatsappSendToolDefinition, whatsappSendToolHandler, 'channel');
  registry.register(whatsappLogoutToolDefinition, whatsappLogoutToolHandler, 'channel');

  // Memory tools
  registry.register(memorySearchToolDefinition, memorySearchToolHandler, 'system');
  registry.register(memoryGetToolDefinition, memoryGetToolHandler, 'system');
  registry.register(memoryWriteToolDefinition, memoryWriteToolHandler, 'system');
  registry.register(memoryUpdateToolDefinition, memoryUpdateToolHandler, 'system');
  registry.register(memoryListToolDefinition, memoryListToolHandler, 'system');

  return registry;
}

// Singleton instance
let defaultRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultToolRegistry();
  }
  return defaultRegistry;
}
