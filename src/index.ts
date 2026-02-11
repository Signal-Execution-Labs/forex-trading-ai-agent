/**
 * K.I.T. - Knight Industries Trading
 * 
 * An AI Agent Framework for Financial Markets
 * Now with OpenClaw-inspired infrastructure!
 * 
 * Features:
 * - Gateway Protocol (WebSocket RPC)
 * - Session Management
 * - Memory System (Vector Search)
 * - Heartbeat System
 * - Cron Scheduler
 * - Trading Tools
 * - Multi-Channel Support
 */

// Gateway (OpenClaw-inspired infrastructure)
export * from './gateway';

// Core (Logger, SkillRouter, CanvasManager - Cron/Heartbeat are in gateway)
export { Logger, createLogger, LogLevel } from './core/logger';
export { SkillRouter, getSkillRouter, initSkillSystem, Skill, SkillMatch, SkillRegistry } from './core/skill-router';
export { CanvasManager, createCanvasManager, getCanvasManager, ChartConfig, CanvasEvent, CanvasContent, CanvasState } from './core/canvas-manager';

// Configuration System (exclude conflicting names)
export { 
  loadConfig, 
  getConfig,
  saveConfig,
  updateConfig,
  getConfigValue,
  DEFAULT_CONFIG,
  KitConfig,
  AgentConfig,
  AIConfig,
  TradingConfig,
  HeartbeatConfig,
  CronConfig,
  MemoryConfig,
  WorkspaceConfig,
  ChannelConfig,
  LoggingConfig
} from './config';

// Trading Tools (exclude ToolDefinition to avoid conflict with gateway)
export {
  // System tools
  getToolRegistry,
  createDefaultToolRegistry,
  ToolRegistry,
  ToolHandler,
  ToolContext,
  // File tools
  readToolDefinition, readToolHandler,
  writeToolDefinition, writeToolHandler,
  editToolDefinition, editToolHandler,
  listToolDefinition, listToolHandler,
  // Exec tools
  execToolDefinition, execToolHandler,
  processToolDefinition, processToolHandler,
  // Config tools
  configGetToolDefinition, configGetToolHandler,
  configSetToolDefinition, configSetToolHandler,
  configDeleteToolDefinition, configDeleteToolHandler,
  envSetToolDefinition, envSetToolHandler,
  statusToolDefinition, statusToolHandler,
  userProfileToolDefinition, userProfileToolHandler,
  // Skills tools
  skillsListToolDefinition, skillsListToolHandler,
  skillsEnableToolDefinition, skillsEnableToolHandler,
  skillsDisableToolDefinition, skillsDisableToolHandler,
  skillsSetupToolDefinition, skillsSetupToolHandler,
  // Onboarding
  onboardingStartToolDefinition, onboardingStartToolHandler,
  onboardingContinueToolDefinition, onboardingContinueToolHandler,
  onboardingStatusToolDefinition, onboardingStatusToolHandler,
  // Trading tools
  TRADING_TOOLS,
  getTradingTools,
  getMockHandlers,
  MOCK_TOOL_HANDLERS,
  // Tool factory
  createAllTools,
} from './tools';

// Model Providers
export * from './providers';

// Hooks System (OpenClaw-inspired event automation)
export {
  getHookRegistry,
  emitTradingEvent,
  createHook,
  HookRegistry,
  HookEvent,
  HookContext,
  HookMetadata,
  Hook,
  HookHandler,
  HookResult,
} from './hooks';

// Version
export const VERSION = '2.0.0';

// Quick start
export { createGatewayServer } from './gateway/server';

/**
 * Start K.I.T. with default configuration
 * Loads config from ~/.kit/config.json and environment variables
 */
export async function startKit(overrides?: {
  port?: number;
  agentName?: string;
  model?: string;
}) {
  const { loadConfig } = await import('./config');
  const { createGatewayServer } = await import('./gateway/server');
  
  // Load configuration
  const config = loadConfig();
  
  const gateway = createGatewayServer({
    port: overrides?.port || config.gateway?.port || 18799,
    host: config.gateway?.host || '127.0.0.1',
    token: config.gateway?.token,
    agent: {
      id: config.agent?.id || 'main',
      name: overrides?.agentName || config.agent?.name || 'K.I.T.',
      model: overrides?.model || config.agent?.model,
    },
    heartbeat: config.heartbeat || { enabled: true, every: '30m' },
    cron: config.cron || { enabled: true },
    memory: config.memory || {},
  } as any);
  
  await gateway.start();
  
  return gateway;
}

// CLI Entry
if (require.main === module) {
  startKit().catch(err => {
    console.error('Failed to start K.I.T.:', err);
    process.exit(1);
  });
}
