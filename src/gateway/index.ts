/**
 * K.I.T. Gateway - WebSocket API Server
 * 
 * Provides real-time communication between K.I.T. and clients
 * (Dashboard, Telegram, Discord, etc.)
 */

export { GatewayServer, createGatewayServer, GatewayConfig } from './server';
export { SessionManager, createSessionManager, Session } from './session-manager';
export { MemoryManager, createMemoryManager } from './memory-manager';
export { HeartbeatManager, createHeartbeatManager, parseDuration } from './heartbeat';
export { CronManager, createCronManager, CronJob } from './cron-manager';
export { ChatManager, createChatManager, ChatMessage, ChatSession } from './chat-manager';
export { ToolEnabledChatHandler, getToolEnabledChatHandler } from './tool-enabled-chat';
export { 
  ProtocolHandler, 
  ProtocolFrame,
  PROTOCOL_METHODS,
  PROTOCOL_EVENTS,
  ERROR_CODES,
  createRequest,
  generateRequestId
} from './protocol';

// Agent Runner - The Brain
export { AgentRunner, createAgentRunner, AgentRunnerConfig, AgentStatus } from './agent-runner';

// Hooks System (OpenClaw-inspired)
export { 
  HooksManager, 
  getHooksManager, 
  initHooks,
  createHookEvent,
  HookEvent,
  HookHandler,
  HookMetadata,
  HookEventType,
  HookContext,
} from './hooks';
