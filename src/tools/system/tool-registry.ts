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
  groups?: string[];  // For group-based filtering (e.g., 'group:fs', 'group:trading')
}

// ============================================================================
// Tool Profiles (OpenClaw-style)
// ============================================================================

/**
 * Tool profiles define base allowlists for different use cases.
 * Like OpenClaw: minimal, coding, messaging, full
 * Plus K.I.T.-specific: trading, analysis
 */
export type ToolProfile = 'minimal' | 'trading' | 'analysis' | 'messaging' | 'full';

/**
 * Tool groups for bulk allow/deny
 */
export const TOOL_GROUPS: Record<string, string[]> = {
  'group:fs': ['read', 'write', 'edit', 'list'],
  'group:runtime': ['exec', 'process'],
  'group:sessions': ['session_spawn', 'session_list', 'session_send', 'session_status', 'session_cancel'],
  'group:memory': ['memory_search', 'memory_get', 'memory_write', 'memory_update', 'memory_list'],
  'group:messaging': ['telegram_send', 'whatsapp_send', 'discord_send', 'slack_send'],
  'group:browser': ['browser_open', 'browser_navigate', 'browser_screenshot', 'browser_snapshot', 
                    'browser_click', 'browser_type', 'browser_wait', 'browser_close', 'browser_evaluate'],
  'group:canvas': ['canvas_present', 'canvas_chart', 'canvas_portfolio', 'canvas_signals', 
                   'canvas_table', 'canvas_snapshot', 'canvas_hide', 'canvas_back'],
  'group:cron': ['cron_list', 'cron_add', 'cron_remove', 'cron_run', 'cron_enable', 
                 'cron_disable', 'cron_status', 'cron_history', 'heartbeat_trigger'],
  'group:trading': ['auto_trade', 'market_analysis', 'portfolio_tracker', 'alert_system',
                    'task_scheduler', 'tax_tracker', 'backtester', 'defi_connector',
                    'binary_login', 'binary_trade', 'binary_balance', 'binary_history',
                    'mt5_connect', 'mt5_account_info', 'mt5_positions', 'mt5_market_order', 
                    'mt5_close_position', 'mt5_price',
                    'strategy_save', 'strategy_start', 'strategy_stop', 'strategy_list', 'strategy_evaluate',
                    'auto_strategy_save', 'auto_strategy_start', 'auto_strategy_stop', 'auto_strategy_list', 'auto_strategy_evaluate'],
  'group:analysis': ['image_analyze', 'chart_analyze', 'screenshot_analyze', 'web_search', 'web_fetch'],
  'group:tts': ['tts_speak', 'tts_voices', 'tts_play'],
  'group:onboarding': ['onboarding_start', 'onboarding_continue', 'onboarding_status'],
  'group:config': ['config_get', 'config_set', 'config_delete', 'env_set', 'status', 'user_profile'],
  'group:skills': ['skills_list', 'skills_enable', 'skills_disable', 'skills_setup'],
};

/**
 * Profile definitions - which groups/tools are allowed by default
 */
export const PROFILE_DEFINITIONS: Record<ToolProfile, {
  allow: string[];
  description: string;
}> = {
  minimal: {
    allow: ['session_status', 'status'],
    description: 'Minimal tools - only status checks'
  },
  trading: {
    allow: [
      'group:fs', 'group:memory', 'group:sessions', 'group:trading',
      'group:analysis', 'group:canvas', 'group:cron', 'group:config',
      'session_status', 'status', 'web_search', 'web_fetch'
    ],
    description: 'Trading tools - market analysis, portfolio, trading execution'
  },
  analysis: {
    allow: [
      'group:fs', 'group:memory', 'group:analysis', 'group:canvas',
      'session_status', 'status', 'web_search', 'web_fetch'
    ],
    description: 'Analysis tools - charts, data, research (no trading)'
  },
  messaging: {
    allow: [
      'group:messaging', 'group:sessions', 'group:memory',
      'session_status', 'status'
    ],
    description: 'Messaging tools - channels, notifications'
  },
  full: {
    allow: ['*'],
    description: 'Full access - all tools enabled'
  }
};

export interface ToolPolicyConfig {
  profile?: ToolProfile;
  allow?: string[];  // Additional tools to allow (can include group:* patterns)
  deny?: string[];   // Tools to deny (overrides allow, can include group:* patterns)
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
   * Apply a tool policy (profile + allow/deny)
   * This is the OpenClaw-style tool filtering system
   */
  applyPolicy(policy: ToolPolicyConfig): void {
    const profile = policy.profile || 'full';
    const profileDef = PROFILE_DEFINITIONS[profile];
    
    // Start by disabling all tools
    for (const tool of this.tools.values()) {
      tool.enabled = false;
    }

    // Build the allow set from profile
    const allowSet = new Set<string>();
    
    // Expand profile allows
    for (const item of profileDef.allow) {
      if (item === '*') {
        // Full access - enable all
        for (const toolName of this.tools.keys()) {
          allowSet.add(toolName);
        }
      } else if (item.startsWith('group:')) {
        // Expand group
        const groupTools = TOOL_GROUPS[item] || [];
        for (const toolName of groupTools) {
          allowSet.add(toolName);
        }
      } else {
        allowSet.add(item);
      }
    }

    // Add additional allows from policy
    if (policy.allow) {
      for (const item of policy.allow) {
        if (item.startsWith('group:')) {
          const groupTools = TOOL_GROUPS[item] || [];
          for (const toolName of groupTools) {
            allowSet.add(toolName);
          }
        } else {
          allowSet.add(item);
        }
      }
    }

    // Remove denied tools
    if (policy.deny) {
      for (const item of policy.deny) {
        if (item === '*') {
          // Deny all - clear everything
          allowSet.clear();
        } else if (item.startsWith('group:')) {
          const groupTools = TOOL_GROUPS[item] || [];
          for (const toolName of groupTools) {
            allowSet.delete(toolName);
          }
        } else {
          allowSet.delete(item);
        }
      }
    }

    // Apply the allow set
    for (const toolName of allowSet) {
      const tool = this.tools.get(toolName);
      if (tool) {
        tool.enabled = true;
      }
    }
  }

  /**
   * Get current profile status
   */
  getProfileStatus(): { enabled: number; disabled: number; total: number; enabledTools: string[] } {
    const tools = Array.from(this.tools.values());
    const enabled = tools.filter(t => t.enabled);
    return {
      enabled: enabled.length,
      disabled: tools.length - enabled.length,
      total: tools.length,
      enabledTools: enabled.map(t => t.definition.name),
    };
  }

  /**
   * Expand a group reference to tool names
   */
  expandGroup(group: string): string[] {
    return TOOL_GROUPS[group] || [];
  }

  /**
   * List all available profiles
   */
  static getProfiles(): Array<{ name: ToolProfile; description: string; toolCount: number }> {
    return Object.entries(PROFILE_DEFINITIONS).map(([name, def]) => {
      let toolCount = 0;
      if (def.allow.includes('*')) {
        toolCount = -1; // Unlimited
      } else {
        for (const item of def.allow) {
          if (item.startsWith('group:')) {
            toolCount += (TOOL_GROUPS[item] || []).length;
          } else {
            toolCount += 1;
          }
        }
      }
      return {
        name: name as ToolProfile,
        description: def.description,
        toolCount,
      };
    });
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

import {
  webSearchToolDefinition, webSearchToolHandler,
  webFetchToolDefinition, webFetchToolHandler,
} from './web-tools';

import {
  browserOpenToolDefinition, browserOpenToolHandler,
  browserNavigateToolDefinition, browserNavigateToolHandler,
  browserScreenshotToolDefinition, browserScreenshotToolHandler,
  browserSnapshotToolDefinition, browserSnapshotToolHandler,
  browserClickToolDefinition, browserClickToolHandler,
  browserTypeToolDefinition, browserTypeToolHandler,
  browserWaitToolDefinition, browserWaitToolHandler,
  browserCloseToolDefinition, browserCloseToolHandler,
  browserEvaluateToolDefinition, browserEvaluateToolHandler,
} from './browser-tools';

import {
  imageAnalyzeToolDefinition, imageAnalyzeToolHandler,
  chartAnalyzeToolDefinition, chartAnalyzeToolHandler,
  screenshotAnalyzeToolDefinition, screenshotAnalyzeToolHandler,
} from './image-tools';

import {
  canvasPresentToolDefinition, canvasPresentToolHandler,
  canvasChartToolDefinition, canvasChartToolHandler,
  canvasPortfolioToolDefinition, canvasPortfolioToolHandler,
  canvasSignalsToolDefinition, canvasSignalsToolHandler,
  canvasTableToolDefinition, canvasTableToolHandler,
  canvasSnapshotToolDefinition, canvasSnapshotToolHandler,
  canvasHideToolDefinition, canvasHideToolHandler,
  canvasBackToolDefinition, canvasBackToolHandler,
} from './canvas-tools';

import {
  getBinaryOptionsTools,
  getBinaryOptionsHandlers,
} from '../binary-options-tools';

import {
  cronListToolDefinition, cronListToolHandler,
  cronAddToolDefinition, cronAddToolHandler,
  cronRemoveToolDefinition, cronRemoveToolHandler,
  cronRunToolDefinition, cronRunToolHandler,
  cronEnableToolDefinition, cronEnableToolHandler,
  cronDisableToolDefinition, cronDisableToolHandler,
  cronStatusToolDefinition, cronStatusToolHandler,
  heartbeatTriggerToolDefinition, heartbeatTriggerToolHandler,
  cronHistoryToolDefinition, cronHistoryToolHandler,
} from './cron-tools';

import {
  sessionSpawnToolDefinition, sessionSpawnToolHandler,
  sessionListToolDefinition, sessionListToolHandler,
  sessionSendToolDefinition, sessionSendToolHandler,
  sessionStatusToolDefinition, sessionStatusToolHandler,
  sessionCancelToolDefinition, sessionCancelToolHandler,
} from './session-tools';

import {
  ttsSpeakToolDefinition, ttsSpeakToolHandler,
  ttsVoicesToolDefinition, ttsVoicesToolHandler,
  ttsPlayToolDefinition, ttsPlayToolHandler,
} from './tts-tools';

import { forumTools } from '../forum-tools';
import { MT5_TOOLS, MT5_TOOL_HANDLERS } from '../mt5-tools';
import { STRATEGY_TOOLS, STRATEGY_TOOL_HANDLERS, initializeStrategies } from '../strategy-tools';
import { UNIVERSAL_STRATEGY_TOOLS, UNIVERSAL_STRATEGY_HANDLERS, initializeUniversalStrategies } from '../universal-strategy';

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

  // Web tools
  registry.register(webSearchToolDefinition, webSearchToolHandler, 'utility');
  registry.register(webFetchToolDefinition, webFetchToolHandler, 'utility');

  // Browser automation tools
  registry.register(browserOpenToolDefinition, browserOpenToolHandler, 'system');
  registry.register(browserNavigateToolDefinition, browserNavigateToolHandler, 'system');
  registry.register(browserScreenshotToolDefinition, browserScreenshotToolHandler, 'system');
  registry.register(browserSnapshotToolDefinition, browserSnapshotToolHandler, 'system');
  registry.register(browserClickToolDefinition, browserClickToolHandler, 'system');
  registry.register(browserTypeToolDefinition, browserTypeToolHandler, 'system');
  registry.register(browserWaitToolDefinition, browserWaitToolHandler, 'system');
  registry.register(browserCloseToolDefinition, browserCloseToolHandler, 'system');
  registry.register(browserEvaluateToolDefinition, browserEvaluateToolHandler, 'system');

  // Image analysis tools
  registry.register(imageAnalyzeToolDefinition, imageAnalyzeToolHandler, 'analysis');
  registry.register(chartAnalyzeToolDefinition, chartAnalyzeToolHandler, 'analysis');
  registry.register(screenshotAnalyzeToolDefinition, screenshotAnalyzeToolHandler, 'analysis');

  // Canvas tools - UI visualization
  registry.register(canvasPresentToolDefinition, canvasPresentToolHandler, 'system');
  registry.register(canvasChartToolDefinition, canvasChartToolHandler, 'system');
  registry.register(canvasPortfolioToolDefinition, canvasPortfolioToolHandler, 'system');
  registry.register(canvasSignalsToolDefinition, canvasSignalsToolHandler, 'system');
  registry.register(canvasTableToolDefinition, canvasTableToolHandler, 'system');
  registry.register(canvasSnapshotToolDefinition, canvasSnapshotToolHandler, 'system');
  registry.register(canvasHideToolDefinition, canvasHideToolHandler, 'system');
  registry.register(canvasBackToolDefinition, canvasBackToolHandler, 'system');

  // Cron & Heartbeat tools
  registry.register(cronListToolDefinition, cronListToolHandler, 'system');
  registry.register(cronAddToolDefinition, cronAddToolHandler, 'system');
  registry.register(cronRemoveToolDefinition, cronRemoveToolHandler, 'system');
  registry.register(cronRunToolDefinition, cronRunToolHandler, 'system');
  registry.register(cronEnableToolDefinition, cronEnableToolHandler, 'system');
  registry.register(cronDisableToolDefinition, cronDisableToolHandler, 'system');
  registry.register(cronStatusToolDefinition, cronStatusToolHandler, 'system');
  registry.register(cronHistoryToolDefinition, cronHistoryToolHandler, 'system');
  registry.register(heartbeatTriggerToolDefinition, heartbeatTriggerToolHandler, 'system');

  // Session/Sub-Agent tools
  registry.register(sessionSpawnToolDefinition, sessionSpawnToolHandler, 'system');
  registry.register(sessionListToolDefinition, sessionListToolHandler, 'system');
  registry.register(sessionSendToolDefinition, sessionSendToolHandler, 'system');
  registry.register(sessionStatusToolDefinition, sessionStatusToolHandler, 'system');
  registry.register(sessionCancelToolDefinition, sessionCancelToolHandler, 'system');

  // TTS (Text-to-Speech) tools
  registry.register(ttsSpeakToolDefinition, ttsSpeakToolHandler, 'system');
  registry.register(ttsVoicesToolDefinition, ttsVoicesToolHandler, 'system');
  registry.register(ttsPlayToolDefinition, ttsPlayToolHandler, 'system');

  // Binary Options / BinaryFaster trading tools
  const binaryTools = getBinaryOptionsTools();
  const binaryHandlers = getBinaryOptionsHandlers();
  for (const tool of binaryTools) {
    const handler = binaryHandlers[tool.name];
    if (handler) {
      registry.register(
        {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters as ToolDefinition['parameters'],
        },
        async (args, _context) => handler(args),
        'trading'
      );
    }
  }

  // kitbot.finance Forum tools
  for (const [name, tool] of Object.entries(forumTools)) {
    registry.register(
      {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as ToolDefinition['parameters'],
      },
      async (args, _context) => tool.execute(args as any),
      'channel'
    );
  }

  // MetaTrader 5 tools (auto-connect, NO CREDENTIALS NEEDED!)
  for (const tool of MT5_TOOLS) {
    const handler = MT5_TOOL_HANDLERS[tool.name];
    if (handler) {
      registry.register(
        {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters as ToolDefinition['parameters'],
        },
        async (args, _context) => handler(args),
        'trading'
      );
    }
  }

  // Strategy Management tools (24/7 auto-trading)
  for (const tool of STRATEGY_TOOLS) {
    const handler = STRATEGY_TOOL_HANDLERS[tool.name];
    if (handler) {
      registry.register(
        {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters as ToolDefinition['parameters'],
        },
        async (args, _context) => handler(args),
        'trading'
      );
    }
  }

  // Initialize running strategies on startup
  initializeStrategies();

  // Universal Strategy tools (AI-powered, any strategy!)
  for (const tool of UNIVERSAL_STRATEGY_TOOLS) {
    const handler = UNIVERSAL_STRATEGY_HANDLERS[tool.name];
    if (handler) {
      registry.register(
        {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters as ToolDefinition['parameters'],
        },
        async (args, _context) => handler(args),
        'trading'
      );
    }
  }

  // Initialize universal strategies on startup
  initializeUniversalStrategies();

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
