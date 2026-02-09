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
 */
export async function startKit(config?: {
  port?: number;
  agentName?: string;
  model?: string;
}) {
  const { createGatewayServer } = await import('./gateway/server');
  
  const gateway = createGatewayServer({
    port: config?.port || 18799,
    agent: {
      id: 'kit',
      name: config?.agentName || 'K.I.T.',
      model: config?.model,
    },
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
