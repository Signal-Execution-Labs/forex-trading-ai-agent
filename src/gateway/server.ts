/**
 * K.I.T. Gateway Server
 * The central brain that orchestrates all systems
 * 
 * Combines:
 * - WebSocket Protocol (OpenClaw-inspired)
 * - Session Management
 * - Memory System
 * - Heartbeat System
 * - Cron Scheduler
 * - Trading Engine
 * - Multi-Channel Support
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer, createServer } from 'http';
import * as path from 'path';
import { EventEmitter } from 'eventemitter3';

// Import our systems
import { 
  ProtocolHandler, 
  ProtocolFrame,
  PROTOCOL_METHODS,
  PROTOCOL_EVENTS,
  RequestContext,
  DeviceIdentity,
  generateRequestId
} from './protocol';

import { SessionManager, createSessionManager, Session } from './session-manager';
import { MemoryManager, createMemoryManager } from './memory-manager';
import { HeartbeatManager, createHeartbeatManager, parseDuration } from './heartbeat';
import { CronManager, createCronManager, CronJob } from './cron-manager';

// ============================================================================
// Types
// ============================================================================

export interface GatewayConfig {
  port: number;
  host: string;
  token?: string;
  stateDir: string;
  workspaceDir: string;
  agent: AgentConfig;
  heartbeat: HeartbeatConfig;
  cron: CronConfig;
  memory: MemoryConfig;
}

export interface AgentConfig {
  id: string;
  name: string;
  model?: string;
  defaultSession?: string;
}

export interface HeartbeatConfig {
  enabled: boolean;
  every: string;
  activeHours?: {
    start: string;
    end: string;
    timezone?: string;
  };
}

export interface CronConfig {
  enabled: boolean;
}

export interface MemoryConfig {
  embeddings?: {
    provider: 'openai' | 'local' | 'none';
    model?: string;
    apiKey?: string;
  };
}

export interface Client {
  id: string;
  ws: WebSocket;
  device?: DeviceIdentity;
  role: 'operator' | 'node';
  authenticated: boolean;
  connectedAt: Date;
}

export interface GatewayState {
  status: 'starting' | 'running' | 'stopping' | 'stopped';
  startedAt?: Date;
  clients: Map<string, Client>;
  health: {
    uptime: number;
    clientCount: number;
    sessionCount: number;
    memoryIndexed: boolean;
  };
}

// ============================================================================
// Gateway Server
// ============================================================================

export class GatewayServer extends EventEmitter {
  private config: GatewayConfig;
  private httpServer: HttpServer;
  private wsServer: WebSocketServer;
  private protocol: ProtocolHandler;
  
  // Core systems
  private sessions: SessionManager;
  private memory: MemoryManager;
  private heartbeat: HeartbeatManager;
  private cron: CronManager;
  
  // State
  private state: GatewayState;
  private eventSeq: number = 0;
  
  constructor(config: Partial<GatewayConfig> = {}) {
    super();
    
    const defaultStateDir = path.join(process.env.HOME || '', '.kit');
    
    this.config = {
      port: config.port || 18799,
      host: config.host || '127.0.0.1',
      token: config.token || process.env.KIT_GATEWAY_TOKEN,
      stateDir: config.stateDir || defaultStateDir,
      workspaceDir: config.workspaceDir || path.join(defaultStateDir, 'workspace'),
      agent: config.agent || { id: 'main', name: 'K.I.T.' },
      heartbeat: config.heartbeat || { enabled: true, every: '30m' },
      cron: config.cron || { enabled: true },
      memory: config.memory || {},
    };
    
    this.state = {
      status: 'stopped',
      clients: new Map(),
      health: {
        uptime: 0,
        clientCount: 0,
        sessionCount: 0,
        memoryIndexed: false,
      },
    };
    
    // Initialize HTTP server
    this.httpServer = createServer((req, res) => {
      // Basic health endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.getHealth()));
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
    });
    
    // Initialize WebSocket server
    this.wsServer = new WebSocketServer({ server: this.httpServer });
    
    // Initialize protocol handler
    this.protocol = new ProtocolHandler();
    
    // Initialize core systems
    this.sessions = createSessionManager(this.config.agent.id, {
      stateDir: path.join(this.config.stateDir, 'agents', this.config.agent.id),
    });
    
    this.memory = createMemoryManager(this.config.agent.id, {
      workspaceDir: this.config.workspaceDir,
      embeddings: this.config.memory.embeddings,
    });
    
    this.heartbeat = createHeartbeatManager(
      this.config.agent.id,
      {
        enabled: this.config.heartbeat.enabled,
        every: parseDuration(this.config.heartbeat.every),
        activeHours: this.config.heartbeat.activeHours,
      },
      this.config.workspaceDir
    );
    
    this.cron = createCronManager({
      enabled: this.config.cron.enabled,
    });
    
    // Setup handlers
    this.setupProtocolHandlers();
    this.setupWebSocketHandlers();
    this.setupSystemEvents();
  }
  
  // ==========================================================================
  // Lifecycle
  // ==========================================================================
  
  /**
   * Start the gateway server
   */
  async start(): Promise<void> {
    if (this.state.status === 'running') {
      console.log('Gateway already running');
      return;
    }
    
    this.state.status = 'starting';
    console.log(`🤖 K.I.T. Gateway starting on ${this.config.host}:${this.config.port}...`);
    
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.config.port, this.config.host, () => {
        this.state.status = 'running';
        this.state.startedAt = new Date();
        
        console.log(`✅ K.I.T. Gateway running on ws://${this.config.host}:${this.config.port}`);
        console.log(`   Agent: ${this.config.agent.name} (${this.config.agent.id})`);
        console.log(`   Workspace: ${this.config.workspaceDir}`);
        
        // Start subsystems
        this.startSubsystems();
        
        this.emit('started');
        resolve();
      });
      
      this.httpServer.on('error', (error) => {
        console.error('Gateway server error:', error);
        reject(error);
      });
    });
  }
  
  /**
   * Stop the gateway server
   */
  async stop(): Promise<void> {
    if (this.state.status !== 'running') {
      console.log('Gateway not running');
      return;
    }
    
    this.state.status = 'stopping';
    console.log('🛑 K.I.T. Gateway stopping...');
    
    // Stop subsystems
    this.heartbeat.stop();
    this.cron.stop();
    
    // Flush sessions
    await this.sessions.flush();
    
    // Close all clients
    for (const client of this.state.clients.values()) {
      client.ws.close(1000, 'Gateway shutting down');
    }
    
    // Close servers
    return new Promise((resolve) => {
      this.wsServer.close(() => {
        this.httpServer.close(() => {
          this.state.status = 'stopped';
          console.log('✅ K.I.T. Gateway stopped');
          this.emit('stopped');
          resolve();
        });
      });
    });
  }
  
  /**
   * Start subsystems
   */
  private startSubsystems(): void {
    // Start heartbeat
    if (this.config.heartbeat.enabled) {
      this.heartbeat.start(
        async (params) => {
          // TODO: Integrate with LLM provider
          return { response: 'HEARTBEAT_OK' };
        },
        async (params) => {
          // TODO: Integrate with channel delivery
          console.log(`[Heartbeat] Would deliver to ${params.target}: ${params.message}`);
          return true;
        }
      );
    }
    
    // Start cron
    if (this.config.cron.enabled) {
      this.cron.start(
        async (job) => {
          // TODO: Integrate with agent execution
          console.log(`[Cron] Running job ${job.name}`);
          return { response: 'Job completed' };
        },
        async (job, response) => {
          // TODO: Integrate with channel delivery
          console.log(`[Cron] Would deliver for ${job.name}: ${response}`);
          return true;
        }
      );
    }
  }
  
  // ==========================================================================
  // Protocol Handlers
  // ==========================================================================
  
  private setupProtocolHandlers(): void {
    // Connect handler
    this.protocol.registerHandler(PROTOCOL_METHODS.CONNECT, async (params, context) => {
      const { auth, device, role } = params as any;
      
      // Validate token if required
      if (this.config.token && (!auth?.token || auth.token !== this.config.token)) {
        throw new Error('Invalid or missing token');
      }
      
      return {
        sessionId: generateRequestId(),
        gatewayId: `kit-gateway-${this.config.agent.id}`,
        version: '1.0.0',
        health: this.getHealth(),
        presence: this.getPresence(),
      };
    });
    
    // Health handler
    this.protocol.registerHandler(PROTOCOL_METHODS.HEALTH, async () => {
      return this.getHealth();
    });
    
    // Status handler
    this.protocol.registerHandler(PROTOCOL_METHODS.STATUS, async () => {
      return {
        status: this.state.status,
        startedAt: this.state.startedAt,
        agent: this.config.agent,
        health: this.getHealth(),
      };
    });
    
    // Session handlers
    this.protocol.registerHandler(PROTOCOL_METHODS.SESSION_LIST, async (params) => {
      const sessions = this.sessions.list(params as any);
      return { sessions };
    });
    
    this.protocol.registerHandler(PROTOCOL_METHODS.SESSION_GET, async (params) => {
      const { key } = params as { key: string };
      const session = this.sessions.get(key);
      if (!session) {
        throw new Error('Session not found');
      }
      return session;
    });
    
    // Memory handlers
    this.protocol.registerHandler(PROTOCOL_METHODS.MEMORY_SEARCH, async (params) => {
      const { query, maxResults, minScore } = params as any;
      const results = await this.memory.search(query, { maxResults, minScore });
      return { results };
    });
    
    this.protocol.registerHandler(PROTOCOL_METHODS.MEMORY_GET, async (params) => {
      const { path: filePath, startLine, lines } = params as any;
      const content = await this.memory.get(filePath, { startLine, lines });
      return { content };
    });
    
    // Cron handlers
    this.protocol.registerHandler(PROTOCOL_METHODS.CRON_LIST, async (params) => {
      const jobs = this.cron.list(params as any);
      return { jobs };
    });
    
    this.protocol.registerHandler(PROTOCOL_METHODS.CRON_ADD, async (params) => {
      const job = this.cron.add(params as any);
      return { job };
    });
    
    this.protocol.registerHandler(PROTOCOL_METHODS.CRON_UPDATE, async (params) => {
      const { jobId, patch } = params as { jobId: string; patch: any };
      const job = this.cron.update(jobId, patch);
      if (!job) {
        throw new Error('Job not found');
      }
      return { job };
    });
    
    this.protocol.registerHandler(PROTOCOL_METHODS.CRON_REMOVE, async (params) => {
      const { jobId } = params as { jobId: string };
      const removed = this.cron.remove(jobId);
      return { removed };
    });
    
    this.protocol.registerHandler(PROTOCOL_METHODS.CRON_RUN, async (params) => {
      const { jobId, mode } = params as { jobId: string; mode?: 'force' | 'due' };
      const run = await this.cron.run(jobId, mode);
      return { run };
    });
    
    // Trading handlers (K.I.T. specific)
    this.protocol.registerHandler(PROTOCOL_METHODS.PORTFOLIO_GET, async () => {
      // TODO: Integrate with trading system
      return {
        totalValue: 0,
        positions: [],
        pnl: { daily: 0, total: 0 },
      };
    });
    
    this.protocol.registerHandler(PROTOCOL_METHODS.TRADE_POSITIONS, async () => {
      // TODO: Integrate with trading system
      return { positions: [] };
    });
  }
  
  // ==========================================================================
  // WebSocket Handlers
  // ==========================================================================
  
  private setupWebSocketHandlers(): void {
    this.wsServer.on('connection', (ws, req) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      const client: Client = {
        id: clientId,
        ws,
        role: 'operator',
        authenticated: false,
        connectedAt: new Date(),
      };
      
      this.state.clients.set(clientId, client);
      console.log(`[WS] Client connected: ${clientId}`);
      
      ws.on('message', async (data) => {
        try {
          const frame = JSON.parse(data.toString()) as ProtocolFrame;
          
          // First frame must be connect
          if (!client.authenticated && frame.method !== PROTOCOL_METHODS.CONNECT) {
            ws.close(4001, 'First frame must be connect');
            return;
          }
          
          const context: RequestContext = {
            clientId,
            device: client.device,
            role: client.role,
            agentId: this.config.agent.id,
          };
          
          const response = await this.protocol.processFrame(frame, context);
          
          if (response) {
            // Mark as authenticated on successful connect
            if (frame.method === PROTOCOL_METHODS.CONNECT && response.ok) {
              client.authenticated = true;
              client.device = (frame.params as any)?.device;
              client.role = (frame.params as any)?.role || 'operator';
            }
            
            ws.send(JSON.stringify(response));
          }
        } catch (error) {
          console.error(`[WS] Error processing message from ${clientId}:`, error);
          ws.send(JSON.stringify({
            type: 'res',
            ok: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          }));
        }
      });
      
      ws.on('close', () => {
        this.state.clients.delete(clientId);
        console.log(`[WS] Client disconnected: ${clientId}`);
      });
      
      ws.on('error', (error) => {
        console.error(`[WS] Client error ${clientId}:`, error);
        this.state.clients.delete(clientId);
      });
    });
  }
  
  // ==========================================================================
  // System Events
  // ==========================================================================
  
  private setupSystemEvents(): void {
    // Session events
    this.sessions.on('session.update', (session: Session) => {
      this.broadcast(PROTOCOL_EVENTS.SESSION_UPDATE, { session });
    });
    
    this.sessions.on('session.compact', (data) => {
      this.broadcast(PROTOCOL_EVENTS.SESSION_COMPACT, data);
    });
    
    // Heartbeat events
    this.heartbeat.on('tick.complete', (result) => {
      this.broadcast(PROTOCOL_EVENTS.HEARTBEAT_RESULT, result);
    });
    
    // Cron events
    this.cron.on('job.run.start', (data) => {
      this.broadcast(PROTOCOL_EVENTS.CRON_RUN_START, data);
    });
    
    this.cron.on('job.run.complete', (data) => {
      this.broadcast(PROTOCOL_EVENTS.CRON_RUN_COMPLETE, data);
    });
  }
  
  // ==========================================================================
  // Broadcasting
  // ==========================================================================
  
  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: string, payload: unknown): void {
    const frame = this.protocol.createEvent(
      event,
      payload,
      ++this.eventSeq
    );
    
    const message = JSON.stringify(frame);
    
    for (const client of this.state.clients.values()) {
      if (client.authenticated && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }
  
  // ==========================================================================
  // Getters
  // ==========================================================================
  
  /**
   * Get current health status
   */
  getHealth() {
    const uptime = this.state.startedAt 
      ? Date.now() - this.state.startedAt.getTime()
      : 0;
    
    return {
      status: this.state.status === 'running' ? 'healthy' : 'degraded',
      uptime,
      clients: this.state.clients.size,
      sessions: this.sessions.list().length,
      agent: {
        id: this.config.agent.id,
        name: this.config.agent.name,
        status: 'idle',
      },
      heartbeat: {
        enabled: this.config.heartbeat.enabled,
        state: this.heartbeat.getState(),
      },
      cron: {
        enabled: this.config.cron.enabled,
        jobCount: this.cron.list().length,
      },
    };
  }
  
  /**
   * Get current presence
   */
  getPresence() {
    return {
      agents: new Map([[this.config.agent.id, {
        id: this.config.agent.id,
        status: 'online',
      }]]),
      channels: new Map(),
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createGatewayServer(config?: Partial<GatewayConfig>): GatewayServer {
  return new GatewayServer(config);
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const gateway = createGatewayServer();
  
  gateway.start().catch(err => {
    console.error('Failed to start gateway:', err);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    await gateway.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await gateway.stop();
    process.exit(0);
  });
}
