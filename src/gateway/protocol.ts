/**
 * K.I.T. Gateway Protocol
 * Inspired by OpenClaw's WebSocket RPC Protocol
 * 
 * Frame Types:
 * - req: Request from client
 * - res: Response to client
 * - event: Server-push event
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface ProtocolFrame {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  event?: string;
  payload?: unknown;
  error?: ProtocolError;
  ok?: boolean;
  seq?: number;
  stateVersion?: number;
}

export interface ProtocolError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ConnectParams {
  auth?: {
    token?: string;
  };
  role?: 'operator' | 'node';
  device?: DeviceIdentity;
  caps?: string[];
  commands?: string[];
}

export interface DeviceIdentity {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'server' | 'node';
  os?: string;
  version?: string;
}

export interface HelloPayload {
  sessionId: string;
  gatewayId: string;
  version: string;
  health: GatewayHealth;
  presence: PresenceState;
}

export interface GatewayHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  channels: ChannelHealth[];
  agents: AgentHealth[];
}

export interface ChannelHealth {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastMessage?: Date;
}

export interface AgentHealth {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'error';
  currentSession?: string;
}

export interface PresenceState {
  agents: Map<string, AgentPresence>;
  channels: Map<string, ChannelPresence>;
}

export interface AgentPresence {
  id: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  currentTask?: string;
}

export interface ChannelPresence {
  id: string;
  connected: boolean;
  lastActivity?: Date;
}

// ============================================================================
// Protocol Methods
// ============================================================================

export const PROTOCOL_METHODS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  PING: 'ping',
  
  // Agent
  AGENT_RUN: 'agent',
  AGENT_STOP: 'agent.stop',
  AGENT_STATUS: 'agent.status',
  
  // Sessions
  SESSION_LIST: 'sessions.list',
  SESSION_GET: 'sessions.get',
  SESSION_CREATE: 'sessions.create',
  SESSION_DELETE: 'sessions.delete',
  SESSION_COMPACT: 'sessions.compact',
  
  // Messages
  MESSAGE_SEND: 'send',
  MESSAGE_HISTORY: 'history',
  
  // Chat (AI Agent interaction)
  CHAT_SEND: 'chat.send',
  CHAT_HISTORY: 'chat.history',
  CHAT_ABORT: 'chat.abort',
  CHAT_STREAM: 'chat.stream',
  
  // Memory
  MEMORY_SEARCH: 'memory.search',
  MEMORY_GET: 'memory.get',
  MEMORY_SYNC: 'memory.sync',
  
  // Cron
  CRON_LIST: 'cron.list',
  CRON_ADD: 'cron.add',
  CRON_UPDATE: 'cron.update',
  CRON_REMOVE: 'cron.remove',
  CRON_RUN: 'cron.run',
  
  // Health
  HEALTH: 'health',
  STATUS: 'status',
  
  // Trading (K.I.T. specific)
  TRADE_EXECUTE: 'trade.execute',
  TRADE_POSITIONS: 'trade.positions',
  TRADE_HISTORY: 'trade.history',
  PORTFOLIO_GET: 'portfolio.get',
  MARKET_ANALYZE: 'market.analyze',
} as const;

// ============================================================================
// Protocol Events
// ============================================================================

export const PROTOCOL_EVENTS = {
  // System
  TICK: 'tick',
  SHUTDOWN: 'shutdown',
  
  // Agent
  AGENT_START: 'agent.start',
  AGENT_CHUNK: 'agent.chunk',
  AGENT_TOOL_CALL: 'agent.tool_call',
  AGENT_TOOL_RESULT: 'agent.tool_result',
  AGENT_COMPLETE: 'agent.complete',
  AGENT_ERROR: 'agent.error',
  
  // Chat streaming
  CHAT_START: 'chat.start',
  CHAT_CHUNK: 'chat.chunk',
  CHAT_TOOL_CALL: 'chat.tool_call',
  CHAT_TOOL_RESULT: 'chat.tool_result',
  CHAT_COMPLETE: 'chat.complete',
  CHAT_ABORTED: 'chat.aborted',
  CHAT_ERROR: 'chat.error',
  
  // Presence
  PRESENCE_UPDATE: 'presence',
  
  // Session
  SESSION_UPDATE: 'session.update',
  SESSION_COMPACT: 'session.compact',
  
  // Heartbeat
  HEARTBEAT: 'heartbeat',
  HEARTBEAT_RESULT: 'heartbeat.result',
  
  // Cron
  CRON_RUN_START: 'cron.run.start',
  CRON_RUN_COMPLETE: 'cron.run.complete',
  
  // Trading (K.I.T. specific)
  TRADE_EXECUTED: 'trade.executed',
  TRADE_ALERT: 'trade.alert',
  POSITION_UPDATE: 'position.update',
  MARKET_ALERT: 'market.alert',
} as const;

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  // Protocol errors
  INVALID_FRAME: 'INVALID_FRAME',
  UNKNOWN_METHOD: 'UNKNOWN_METHOD',
  MISSING_PARAMS: 'MISSING_PARAMS',
  
  // Auth errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  
  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Agent errors
  AGENT_BUSY: 'AGENT_BUSY',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_ERROR: 'AGENT_ERROR',
  
  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Internal
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// ============================================================================
// Protocol Handler
// ============================================================================

export type MethodHandler = (
  params: Record<string, unknown>,
  context: RequestContext
) => Promise<unknown>;

export interface RequestContext {
  clientId: string;
  device?: DeviceIdentity;
  role: 'operator' | 'node';
  agentId?: string;
  sessionId?: string;
}

export class ProtocolHandler extends EventEmitter {
  private handlers: Map<string, MethodHandler> = new Map();
  private idempotencyCache: Map<string, { result: unknown; timestamp: number }> = new Map();
  private readonly IDEMPOTENCY_TTL_MS = 60000; // 1 minute
  
  constructor() {
    super();
    this.setupDefaultHandlers();
    this.startIdempotencyCleaner();
  }
  
  /**
   * Register a method handler
   */
  registerHandler(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler);
  }
  
  /**
   * Process an incoming frame
   */
  async processFrame(
    frame: ProtocolFrame,
    context: RequestContext
  ): Promise<ProtocolFrame | null> {
    // Validate frame
    if (!this.isValidFrame(frame)) {
      return this.createErrorResponse(
        frame.id,
        ERROR_CODES.INVALID_FRAME,
        'Invalid frame structure'
      );
    }
    
    // Handle different frame types
    switch (frame.type) {
      case 'req':
        return this.handleRequest(frame, context);
      case 'event':
        // Events are server-push only, ignore incoming
        return null;
      default:
        return this.createErrorResponse(
          frame.id,
          ERROR_CODES.INVALID_FRAME,
          `Unknown frame type: ${frame.type}`
        );
    }
  }
  
  /**
   * Handle a request frame
   */
  private async handleRequest(
    frame: ProtocolFrame,
    context: RequestContext
  ): Promise<ProtocolFrame> {
    const { id, method, params } = frame;
    
    if (!method) {
      return this.createErrorResponse(id, ERROR_CODES.MISSING_PARAMS, 'Missing method');
    }
    
    // Check idempotency for side-effecting methods
    if (id && this.isSideEffecting(method)) {
      const cached = this.idempotencyCache.get(id);
      if (cached && Date.now() - cached.timestamp < this.IDEMPOTENCY_TTL_MS) {
        return this.createSuccessResponse(id, cached.result);
      }
    }
    
    // Find handler
    const handler = this.handlers.get(method);
    if (!handler) {
      return this.createErrorResponse(
        id,
        ERROR_CODES.UNKNOWN_METHOD,
        `Unknown method: ${method}`
      );
    }
    
    // Execute handler
    try {
      const result = await handler(params || {}, context);
      
      // Cache result for idempotency
      if (id && this.isSideEffecting(method)) {
        this.idempotencyCache.set(id, { result, timestamp: Date.now() });
      }
      
      return this.createSuccessResponse(id, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      return this.createErrorResponse(id, ERROR_CODES.INTERNAL_ERROR, message);
    }
  }
  
  /**
   * Create an event frame
   */
  createEvent(
    event: string,
    payload: unknown,
    seq?: number,
    stateVersion?: number
  ): ProtocolFrame {
    return {
      type: 'event',
      event,
      payload,
      seq,
      stateVersion,
    };
  }
  
  /**
   * Create a success response
   */
  private createSuccessResponse(id: string | undefined, payload: unknown): ProtocolFrame {
    return {
      type: 'res',
      id,
      ok: true,
      payload,
    };
  }
  
  /**
   * Create an error response
   */
  private createErrorResponse(
    id: string | undefined,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): ProtocolFrame {
    return {
      type: 'res',
      id,
      ok: false,
      error: { code, message, details },
    };
  }
  
  /**
   * Check if a frame is valid
   */
  private isValidFrame(frame: ProtocolFrame): boolean {
    if (!frame || typeof frame !== 'object') return false;
    if (!['req', 'res', 'event'].includes(frame.type)) return false;
    return true;
  }
  
  /**
   * Check if method has side effects (needs idempotency)
   */
  private isSideEffecting(method: string): boolean {
    const sideEffectingMethods = [
      PROTOCOL_METHODS.MESSAGE_SEND,
      PROTOCOL_METHODS.AGENT_RUN,
      PROTOCOL_METHODS.TRADE_EXECUTE,
      PROTOCOL_METHODS.CRON_ADD,
      PROTOCOL_METHODS.CRON_REMOVE,
      PROTOCOL_METHODS.SESSION_CREATE,
      PROTOCOL_METHODS.SESSION_DELETE,
    ];
    return sideEffectingMethods.includes(method as any);
  }
  
  /**
   * Setup default handlers
   */
  private setupDefaultHandlers(): void {
    // Ping handler
    this.registerHandler(PROTOCOL_METHODS.PING, async () => {
      return { pong: Date.now() };
    });
    
    // Connect handler (to be extended)
    this.registerHandler(PROTOCOL_METHODS.CONNECT, async (params, context) => {
      return {
        status: 'connected',
        clientId: context.clientId,
        timestamp: Date.now(),
      };
    });
  }
  
  /**
   * Cleanup expired idempotency entries
   */
  private startIdempotencyCleaner(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.idempotencyCache.entries()) {
        if (now - value.timestamp > this.IDEMPOTENCY_TTL_MS) {
          this.idempotencyCache.delete(key);
        }
      }
    }, 30000); // Clean every 30 seconds
  }
}

// ============================================================================
// Frame Builders
// ============================================================================

export function createRequest(
  method: string,
  params?: Record<string, unknown>,
  id?: string
): ProtocolFrame {
  return {
    type: 'req',
    id: id || generateRequestId(),
    method,
    params,
  };
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Export singleton instance
export const protocolHandler = new ProtocolHandler();
