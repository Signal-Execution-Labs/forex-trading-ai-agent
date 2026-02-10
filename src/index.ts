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

// Trading Tools
export * from './tools';

// Model Providers
export * from './providers';

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
    port: overrides?.port || config.gateway.port,
    host: config.gateway.host,
    token: config.gateway.token,
    agent: {
      id: config.agent.id,
      name: overrides?.agentName || config.agent.name,
      model: overrides?.model || config.agent.model,
    },
    heartbeat: config.heartbeat,
    cron: config.cron,
    memory: config.memory,
  });
  
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
