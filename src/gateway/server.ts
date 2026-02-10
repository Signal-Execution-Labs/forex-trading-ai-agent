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
import { ChatManager, createChatManager, ChatSendParams, ChatHistoryParams, ChatAbortParams } from './chat-manager';
import { getToolEnabledChatHandler, ToolEnabledChatHandler } from './tool-enabled-chat';
import { TelegramChannel, createTelegramChannel } from '../channels/telegram-channel';
import { WhatsAppChannel, createWhatsAppChannel, hasWhatsAppCredentials } from '../channels/whatsapp-channel';
import { getBinaryFasterState } from '../tools/binary-options-tools';

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
  private chat: ChatManager;
  
  // Channels
  private telegramChannel: TelegramChannel | null = null;
  private whatsappChannel: WhatsAppChannel | null = null;
  
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
    
    // Initialize HTTP server with dashboard
    this.httpServer = createServer((req, res) => {
      const fs = require('fs');
      
      // Health endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.getHealth()));
        return;
      }
      
      // Serve dashboard - always use inline for reliability
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(this.getInlineDashboard());
        return;
      }
      
      // API status endpoint - returns full dashboard data
      if (req.url === '/api/status') {
        const dashboardData = this.getDashboardData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: this.state.status,
          agent: this.config.agent,
          health: this.getHealth(),
          wsUrl: `ws://${this.config.host}:${this.config.port}`,
          // Dashboard data
          portfolio: dashboardData.portfolio,
          skillsActive: dashboardData.skillsActive,
          skillsTotal: dashboardData.skillsTotal,
          skills: dashboardData.skillsList,
          channels: dashboardData.channels,
          user: dashboardData.user,
        }));
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
    
    this.chat = createChatManager(this.config.agent.id);
    
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
    if (this.telegramChannel) {
      this.telegramChannel.stop();
    }
    if (this.whatsappChannel) {
      this.whatsappChannel.stop();
    }
    
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

    // Start Telegram channel if configured
    this.startTelegramChannel();

    // Start WhatsApp channel if configured
    this.startWhatsAppChannel();
  }

  /**
   * Start Telegram channel for bidirectional messaging
   */
  private async startTelegramChannel(): Promise<void> {
    try {
      this.telegramChannel = createTelegramChannel();
      
      if (!this.telegramChannel) {
        console.log('[Telegram] Not configured - use telegram_setup tool to connect');
        return;
      }

      // Initialize tool chat handler for Telegram
      const toolChatHandler = getToolEnabledChatHandler();

      await this.telegramChannel.start(async (msg) => {
        console.log(`[Telegram] Message from ${msg.username || msg.firstName}: ${msg.text}`);
        
        // Process message through AI with tools
        const response = await toolChatHandler.processMessage(
          `telegram_${msg.chatId}`,
          msg.text,
          () => {}, // No streaming for Telegram
          () => {}, // No tool call display
          () => {}  // No tool result display
        );

        return response;
      });

      console.log('📱 Telegram channel active - listening for messages');
    } catch (error) {
      console.error('[Telegram] Failed to start:', error);
    }
  }

  /**
   * Start WhatsApp channel for bidirectional messaging
   */
  private async startWhatsAppChannel(): Promise<void> {
    try {
      // Check if we have credentials
      if (!hasWhatsAppCredentials()) {
        console.log('[WhatsApp] No credentials found - use "kit whatsapp login" to connect');
        return;
      }

      this.whatsappChannel = createWhatsAppChannel();
      
      if (!this.whatsappChannel) {
        return;
      }

      // Initialize tool chat handler for WhatsApp
      const toolChatHandler = getToolEnabledChatHandler();

      await this.whatsappChannel.start(async (msg) => {
        console.log(`[WhatsApp] Message from ${msg.senderPhone}: ${msg.text}`);
        
        // Process message through AI with tools
        const response = await toolChatHandler.processMessage(
          `whatsapp_${msg.chatId}`,
          msg.text,
          () => {}, // No streaming for WhatsApp
          () => {}, // No tool call display
          () => {}  // No tool result display
        );

        return response;
      });

      console.log('📱 WhatsApp channel active - listening for messages');
    } catch (error) {
      console.error('[WhatsApp] Failed to start:', error);
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
    
    // Chat handlers
    this.protocol.registerHandler(PROTOCOL_METHODS.CHAT_SEND, async (params, context) => {
      const chatParams = params as unknown as ChatSendParams;
      const result = await this.chat.send(chatParams, context.clientId);
      return result;
    });
    
    this.protocol.registerHandler(PROTOCOL_METHODS.CHAT_HISTORY, async (params) => {
      const historyParams = params as unknown as ChatHistoryParams;
      const messages = this.chat.getHistory(historyParams);
      return { messages };
    });
    
    this.protocol.registerHandler(PROTOCOL_METHODS.CHAT_ABORT, async (params) => {
      const abortParams = params as unknown as ChatAbortParams;
      const aborted = this.chat.abort(abortParams);
      return { aborted };
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
          const message = JSON.parse(data.toString());
          
          // Handle simple chat messages from dashboard
          if (message.type === 'chat' && message.content) {
            console.log(`[Chat] ${clientId}: ${message.content}`);
            
            // Get AI response with tool support
            const response = await this.handleSimpleChat(message.content, clientId, ws);
            ws.send(JSON.stringify({ type: 'message', content: response }));
            return;
          }
          
          const frame = message as ProtocolFrame;
          
          // First frame must be connect (for protocol mode)
          if (!client.authenticated && frame.method !== PROTOCOL_METHODS.CONNECT) {
            // Allow unauthenticated chat for dashboard
            if (message.type === 'chat') return;
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
    
    // Chat events
    this.chat.on('chat.start', (data) => {
      this.broadcastToClient(data.clientId, PROTOCOL_EVENTS.CHAT_START, data);
    });
    
    this.chat.on('chat.chunk', (data) => {
      this.broadcastToClient(data.clientId, PROTOCOL_EVENTS.CHAT_CHUNK, { 
        sessionId: data.sessionId,
        requestId: data.requestId,
        chunk: data.chunk 
      });
    });
    
    this.chat.on('chat.tool_call', (data) => {
      this.broadcastToClient(data.clientId, PROTOCOL_EVENTS.CHAT_TOOL_CALL, data);
    });
    
    this.chat.on('chat.tool_result', (data) => {
      this.broadcastToClient(data.clientId, PROTOCOL_EVENTS.CHAT_TOOL_RESULT, data);
    });
    
    this.chat.on('chat.complete', (data) => {
      this.broadcastToClient(data.clientId, PROTOCOL_EVENTS.CHAT_COMPLETE, data);
    });
    
    this.chat.on('chat.error', (data) => {
      this.broadcastToClient(data.clientId, PROTOCOL_EVENTS.CHAT_ERROR, data);
    });
    
    this.chat.on('chat.aborted', (data) => {
      this.broadcast(PROTOCOL_EVENTS.CHAT_ABORTED, data);
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
  
  /**
   * Send an event to a specific client
   */
  broadcastToClient(clientId: string, event: string, payload: unknown): void {
    const client = this.state.clients.get(clientId);
    if (!client || !client.authenticated || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const frame = this.protocol.createEvent(
      event,
      payload,
      ++this.eventSeq
    );
    
    client.ws.send(JSON.stringify(frame));
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

  /**
   * Handle chat messages from dashboard with full tool support
   */
  private toolChatHandler: ToolEnabledChatHandler | null = null;

  private async handleSimpleChat(userMessage: string, clientId: string, ws: WebSocket): Promise<string> {
    // Initialize tool chat handler if needed
    if (!this.toolChatHandler) {
      this.toolChatHandler = getToolEnabledChatHandler();
    }

    // Process with tool support
    const response = await this.toolChatHandler.processMessage(
      clientId,
      userMessage,
      // Send chunks
      (chunk) => {
        ws.send(JSON.stringify({ type: 'chunk', content: chunk }));
      },
      // Send tool calls
      (name, args) => {
        ws.send(JSON.stringify({ type: 'tool_call', name, args }));
      },
      // Send tool results
      (name, result) => {
        ws.send(JSON.stringify({ type: 'tool_result', name, result }));
      }
    );

    return response;
  }

  /**
   * Get portfolio value from all connected platforms
   */
  private getPortfolioValue(): { totalValue: number; change24h: number; platforms: Record<string, number> } {
    const platforms: Record<string, number> = {};
    let totalValue = 0;

    // Get BinaryFaster balance
    try {
      const bfState = getBinaryFasterState();
      if (bfState.loggedIn) {
        const bfBalance = bfState.demoMode ? bfState.balance.demo : bfState.balance.real;
        platforms['BinaryFaster'] = bfBalance;
        totalValue += bfBalance;
      }
    } catch (e) {
      // BinaryFaster not initialized
    }

    // TODO: Add more platforms here
    // - Binance
    // - MT5
    // - Coinbase
    // etc.

    return {
      totalValue,
      change24h: 0, // TODO: Calculate from history
      platforms,
    };
  }

  /**
   * Get dashboard data
   */
  private getDashboardData(): any {
    const fs = require('fs');
    const configPath = path.join(this.config.stateDir, 'config.json');
    // Skills can be in multiple locations
    const possibleSkillsDirs = [
      path.join(__dirname, '..', '..', 'skills'),           // From dist/src/gateway
      path.join(__dirname, '..', '..', '..', 'skills'),     // One more level up
      path.join(process.cwd(), 'skills'),                    // From project root
    ];
    const skillsDir = possibleSkillsDirs.find(d => fs.existsSync(d)) || possibleSkillsDirs[2];
    
    // Load config
    let config: any = {};
    let user: any = null;
    let channels: any = {};
    
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // User can be in different places
        user = config.user || { name: config.userName || config.name };
        channels = config.channels || {};
      } catch (e) {
        console.log('[Dashboard] Error loading config:', e);
      }
    }
    
    // Also check onboarding state for user name
    const onboardingPath = path.join(this.config.stateDir, 'onboarding.json');
    if (fs.existsSync(onboardingPath) && !user?.name) {
      try {
        const onboarding = JSON.parse(fs.readFileSync(onboardingPath, 'utf8'));
        if (onboarding.data?.userName) {
          user = { name: onboarding.data.userName };
        }
      } catch {}
    }
    
    // Count skills
    let skillsActive = 0;
    let skillsTotal = 0;
    const skillsList: { name: string; active: boolean }[] = [];
    
    if (fs.existsSync(skillsDir)) {
      const dirs = fs.readdirSync(skillsDir).filter((d: string) => {
        const skillPath = path.join(skillsDir, d, 'SKILL.md');
        return fs.existsSync(skillPath);
      });
      skillsTotal = dirs.length;
      
      // Check which skills are enabled in config
      const enabledSkills = config.skills || {};
      
      for (const dir of dirs.slice(0, 20)) { // First 20
        const isActive = enabledSkills[dir]?.enabled !== false;
        if (isActive) skillsActive++;
        skillsList.push({ name: dir, active: isActive });
      }
    }
    
    // Check channel status
    const telegramConnected = !!channels.telegram?.token;
    const whatsappConnected = fs.existsSync(path.join(this.config.stateDir, 'credentials', 'whatsapp', 'creds.json'));
    
    return {
      user,
      skillsActive,
      skillsTotal,
      skillsList,
      channels: {
        telegram: { connected: telegramConnected, username: channels.telegram?.botUsername },
        whatsapp: { connected: whatsappConnected },
      },
      portfolio: this.getPortfolioValue(),
    };
  }

  /**
   * Get inline dashboard HTML
   */
  private getInlineDashboard(): string {
    const health = this.getHealth();
    const data = this.getDashboardData();
    const uptimeHours = Math.floor(health.uptime / 3600000);
    const uptimeMinutes = Math.floor((health.uptime % 3600000) / 60000);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K.I.T. Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      color: #fff;
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 1.5rem; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .logo-section { display: flex; align-items: center; gap: 1rem; }
    .logo {
      font-size: 2rem;
      font-weight: bold;
      background: linear-gradient(90deg, #00d4ff, #7b2fff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline { color: #888; font-size: 0.9rem; }
    .user-section { text-align: right; }
    .user-name { font-size: 1.1rem; color: #00d4ff; }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.8rem;
      background: rgba(0,255,136,0.2);
      color: #00ff88;
    }
    
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    @media (max-width: 1200px) { .dashboard-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .dashboard-grid { grid-template-columns: 1fr; } }
    
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 1rem;
      padding: 1.25rem;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .card-title {
      font-size: 0.8rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-icon { font-size: 1.25rem; }
    .card-value {
      font-size: 1.75rem;
      font-weight: bold;
    }
    .card-value.green { color: #00ff88; }
    .card-value.blue { color: #00d4ff; }
    .card-value.purple { color: #7b2fff; }
    .card-value.yellow { color: #ffaa00; }
    .card-sub { font-size: 0.85rem; color: #666; margin-top: 0.25rem; }
    
    .main-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 900px) { .main-grid { grid-template-columns: 1fr; } }
    
    .chat-container {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 1rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      height: 500px;
    }
    .chat-header { margin-bottom: 1rem; }
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      background: rgba(0,0,0,0.2);
      border-radius: 0.5rem;
      margin-bottom: 1rem;
    }
    .message { margin-bottom: 0.75rem; line-height: 1.4; }
    .message.kit { color: #00d4ff; }
    .message.user { color: #888; }
    .message.tool { color: #7b2fff; font-size: 0.85rem; }
    .chat-input {
      width: 100%;
      padding: 0.875rem 1rem;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 0.5rem;
      color: #fff;
      font-size: 1rem;
    }
    .chat-input:focus { outline: none; border-color: #00d4ff; }
    
    .sidebar { display: flex; flex-direction: column; gap: 1rem; }
    
    .skills-card { max-height: 240px; }
    .skills-list {
      max-height: 160px;
      overflow-y: auto;
    }
    .skill-item {
      display: flex;
      justify-content: space-between;
      padding: 0.4rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 0.85rem;
    }
    .skill-name { color: #ccc; }
    .skill-status { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 0.25rem; }
    .skill-status.active { background: rgba(0,255,136,0.2); color: #00ff88; }
    .skill-status.inactive { background: rgba(255,170,0,0.2); color: #ffaa00; }
    
    .channels-list { margin-top: 0.5rem; }
    .channel-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0;
      font-size: 0.9rem;
    }
    .channel-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .channel-dot.connected { background: #00ff88; }
    .channel-dot.disconnected { background: #ff4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-section">
        <div class="logo">🤖 K.I.T.</div>
        <div class="tagline">Knight Industries Trading<br><small>"Your wealth is my mission"</small></div>
      </div>
      <div class="user-section">
        <div class="user-name">${data.user?.name || 'Guest'}</div>
        <span class="status-badge">● Online</span>
      </div>
    </div>
    
    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Portfolio Value</span>
          <span class="card-icon">💰</span>
        </div>
        <div class="card-value green">$${(data.portfolio?.totalValue || 0).toLocaleString()}</div>
        <div class="card-sub">${data.portfolio?.change24h >= 0 ? '+' : ''}${data.portfolio?.change24h || 0}% (24h)</div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <span class="card-title">Active Skills</span>
          <span class="card-icon">⚡</span>
        </div>
        <div class="card-value blue">${data.skillsActive}/${data.skillsTotal}</div>
        <div class="card-sub">Trading skills ready</div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <span class="card-title">Uptime</span>
          <span class="card-icon">⏱️</span>
        </div>
        <div class="card-value purple">${uptimeHours}h ${uptimeMinutes}m</div>
        <div class="card-sub">Gateway running</div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <span class="card-title">Connections</span>
          <span class="card-icon">🔗</span>
        </div>
        <div class="card-value yellow">${health.clients}</div>
        <div class="card-sub">Active clients</div>
      </div>
    </div>
    
    <div class="main-grid">
      <div class="chat-container">
        <div class="chat-header">
          <div class="card-title">💬 Chat with K.I.T.</div>
        </div>
        <div class="chat-messages" id="messages">
          <div class="message kit">K.I.T.: Hello${data.user?.name ? ' ' + data.user.name : ''}! I'm your autonomous financial agent. How can I help you today?</div>
        </div>
        <input type="text" class="chat-input" placeholder="Type a message... (Enter to send)" id="chatInput">
      </div>
      
      <div class="sidebar">
        <div class="card skills-card">
          <div class="card-header">
            <span class="card-title">📊 Skills Status</span>
          </div>
          <div class="skills-list">
            ${data.skillsList.slice(0, 10).map((s: any) => `
              <div class="skill-item">
                <span class="skill-name">${s.name}</span>
                <span class="skill-status ${s.active ? 'active' : 'inactive'}">${s.active ? 'Active' : 'Inactive'}</span>
              </div>
            `).join('')}
          </div>
          <div class="card-sub" style="margin-top: 0.5rem;">
            ${data.skillsTotal > 10 ? `+${data.skillsTotal - 10} more skills` : ''}
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <span class="card-title">📱 Channels</span>
          </div>
          <div class="channels-list">
            <div class="channel-item">
              <span class="channel-dot ${data.channels.telegram.connected ? 'connected' : 'disconnected'}"></span>
              <span>Telegram ${data.channels.telegram.username ? '@' + data.channels.telegram.username : ''}</span>
            </div>
            <div class="channel-item">
              <span class="channel-dot ${data.channels.whatsapp.connected ? 'connected' : 'disconnected'}"></span>
              <span>WhatsApp</span>
            </div>
            <div class="channel-item">
              <span class="channel-dot connected"></span>
              <span>Dashboard (this)</span>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <span class="card-title">⚙️ Quick Links</span>
          </div>
          <div style="font-size: 0.85rem; color: #888;">
            <div style="margin-bottom: 0.5rem;">
              <a href="https://github.com/kayzaa/k.i.t.-bot" target="_blank" style="color: #00d4ff; text-decoration: none;">📚 Documentation</a>
            </div>
            <div style="margin-bottom: 0.5rem;">
              <span>🛠️ Run: <code style="background: rgba(0,0,0,0.3); padding: 0.1rem 0.3rem; border-radius: 0.25rem;">kit onboard</code></span>
            </div>
            <div>
              <span>📊 Run: <code style="background: rgba(0,0,0,0.3); padding: 0.1rem 0.3rem; border-radius: 0.25rem;">kit status</code></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const ws = new WebSocket('ws://' + window.location.host);
    const messages = document.getElementById('messages');
    const input = document.getElementById('chatInput');
    let thinking = false;
    
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'message') {
        messages.innerHTML += '<div class="message kit">K.I.T.: ' + data.content.replace(/\\n/g, '<br>') + '</div>';
        messages.scrollTop = messages.scrollHeight;
        thinking = false;
      } else if (data.type === 'tool_call') {
        messages.innerHTML += '<div class="message tool">🔧 Using: ' + data.name + '</div>';
        messages.scrollTop = messages.scrollHeight;
      } else if (data.type === 'chunk') {
        // Handle streaming chunks
      }
    };
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && input.value.trim() && !thinking) {
        messages.innerHTML += '<div class="message user">You: ' + input.value + '</div>';
        ws.send(JSON.stringify({ type: 'chat', content: input.value }));
        input.value = '';
        thinking = true;
        messages.innerHTML += '<div class="message kit" id="thinking">K.I.T.: <em>Thinking...</em></div>';
        messages.scrollTop = messages.scrollHeight;
      }
    });
    
    ws.onopen = () => {
      console.log('Connected to K.I.T.');
    };
  </script>
</body>
</html>`;
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
