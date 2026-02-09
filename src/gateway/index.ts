/**
 * K.I.T. Gateway Module
 * 
 * Complete gateway implementation inspired by OpenClaw
 * with K.I.T.-specific trading enhancements
 */

// Protocol
export {
  ProtocolHandler,
  ProtocolFrame,
  ProtocolError,
  PROTOCOL_METHODS,
  PROTOCOL_EVENTS,
  ERROR_CODES,
  createRequest,
  generateRequestId,
  protocolHandler,
  type ConnectParams,
  type DeviceIdentity,
  type HelloPayload,
  type GatewayHealth,
  type ChannelHealth,
  type AgentHealth,
  type PresenceState,
  type AgentPresence,
  type ChannelPresence,
  type MethodHandler,
  type RequestContext,
} from './protocol';

// Session Management
export {
  SessionManager,
  SessionKeyBuilder,
  createSessionManager,
  type SessionConfig,
  type Session,
  type SessionType,
  type SessionOrigin,
  type TranscriptEntry,
  type SessionStore,
  type ResetPolicy,
} from './session-manager';

// Memory Management
export {
  MemoryManager,
  createMemoryManager,
  type MemoryConfig,
  type MemoryChunk,
  type SearchResult,
  type MemoryFile,
  type MemoryIndex,
  type EmbeddingConfig,
  type SyncConfig,
  type SearchConfig,
} from './memory-manager';

// Heartbeat System
export {
  HeartbeatManager,
  createHeartbeatManager,
  parseDuration,
  DEFAULT_HEARTBEAT_PROMPT,
  type HeartbeatConfig,
  type HeartbeatState,
  type HeartbeatResult,
  type HeartbeatHandler,
  type DeliveryHandler,
} from './heartbeat';

// Cron Scheduler
export {
  CronManager,
  createCronManager,
  parseCronExpression,
  type CronConfig,
  type CronJob,
  type JobSchedule,
  type JobPayload,
  type DeliveryConfig,
  type JobRun,
  type CronStore,
  type JobExecutor,
  type DeliveryExecutor,
} from './cron-manager';

// Gateway Server
export {
  GatewayServer,
  createGatewayServer,
  type GatewayConfig,
  type AgentConfig,
  type Client,
  type GatewayState,
} from './server';
