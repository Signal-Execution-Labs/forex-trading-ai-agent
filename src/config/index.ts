/**
 * K.I.T. Configuration System
 * 
 * Config loading order:
 * 1. Built-in defaults
 * 2. ~/.kit/config.json (user config)
 * 3. ./kit.config.json (project config)
 * 4. Environment variables (KIT_*)
 * 5. CLI flags
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Types
// ============================================================================

export interface KitConfig {
  // Core settings
  version: string;
  agent: AgentConfig;
  gateway: GatewayConfig;
  
  // AI Provider
  ai: AIConfig;
  
  // Trading
  exchanges: Record<string, ExchangeConfig>;
  trading: TradingConfig;
  
  // Automation
  heartbeat: HeartbeatConfig;
  cron: CronConfig;
  
  // Memory & Workspace
  memory: MemoryConfig;
  workspace: WorkspaceConfig;
  
  // Channels
  channels: Record<string, ChannelConfig>;
  
  // Logging
  logging: LoggingConfig;
}

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
}

export interface GatewayConfig {
  host: string;
  port: number;
  token?: string;
  ssl?: {
    enabled: boolean;
    cert?: string;
    key?: string;
  };
}

export interface AIConfig {
  defaultProvider: string;
  defaultModel: string;
  providers: Record<string, AIProviderConfig>;
}

export interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  enabled?: boolean;
}

export interface ExchangeConfig {
  type: 'crypto' | 'mt5' | 'broker';
  enabled: boolean;
  credentials: {
    apiKey?: string;
    secret?: string;
    password?: string;
    server?: string;
    login?: string;
  };
  sandbox?: boolean;
  rateLimit?: number;
}

export interface TradingConfig {
  enabled: boolean;
  autoTrade: boolean;
  riskManagement: {
    maxPositionSize: number;
    maxDailyLoss: number;
    maxDrawdown: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  };
  allowedSymbols?: string[];
  blockedSymbols?: string[];
}

export interface HeartbeatConfig {
  enabled: boolean;
  every: string;
  activeHours?: {
    start: string;
    end: string;
    timezone?: string;
  };
  prompt?: string;
}

export interface CronConfig {
  enabled: boolean;
  jobs?: CronJobConfig[];
}

export interface CronJobConfig {
  name: string;
  schedule: string;
  task: string;
  enabled?: boolean;
  channel?: string;
}

export interface MemoryConfig {
  embeddings?: {
    provider: 'openai' | 'local' | 'none';
    model?: string;
    apiKey?: string;
  };
  vectorStore?: {
    type: 'local' | 'pinecone' | 'qdrant';
    path?: string;
    apiKey?: string;
    url?: string;
  };
}

export interface WorkspaceConfig {
  path: string;
  autoSave: boolean;
  gitAutoCommit: boolean;
}

export interface ChannelConfig {
  type: 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'signal';
  enabled: boolean;
  credentials: Record<string, string>;
  defaultChannel?: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  file?: string;
  console: boolean;
}

// ============================================================================
// Default Config
// ============================================================================

export const DEFAULT_CONFIG: KitConfig = {
  version: '1.0.0',
  
  agent: {
    id: 'main',
    name: 'K.I.T.',
    description: 'Knight Industries Trading AI',
    model: 'anthropic/claude-sonnet-4-20250514',
  },
  
  gateway: {
    host: '127.0.0.1',
    port: 18799,
  },
  
  ai: {
    defaultProvider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
    providers: {
      anthropic: { enabled: true },
      openai: { enabled: false },
      openrouter: { enabled: false },
      ollama: { enabled: false, baseUrl: 'http://localhost:11434' },
    },
  },
  
  exchanges: {},
  
  trading: {
    enabled: false,
    autoTrade: false,
    riskManagement: {
      maxPositionSize: 0.1, // 10% of portfolio
      maxDailyLoss: 0.02, // 2%
      maxDrawdown: 0.1, // 10%
      stopLossPercent: 0.02, // 2%
      takeProfitPercent: 0.04, // 4%
    },
  },
  
  heartbeat: {
    enabled: true,
    every: '30m',
  },
  
  cron: {
    enabled: true,
    jobs: [],
  },
  
  memory: {
    embeddings: {
      provider: 'none',
    },
  },
  
  workspace: {
    path: path.join(os.homedir(), '.kit', 'workspace'),
    autoSave: true,
    gitAutoCommit: false,
  },
  
  channels: {},
  
  logging: {
    level: 'info',
    console: true,
  },
};

// ============================================================================
// Config Loader
// ============================================================================

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: KitConfig;
  private configPath: string;
  
  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = path.join(os.homedir(), '.kit', 'config.json');
  }
  
  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }
  
  /**
   * Load configuration from all sources
   */
  load(): KitConfig {
    // 1. Start with defaults
    this.config = { ...DEFAULT_CONFIG };
    
    // 2. Load user config (~/.kit/config.json)
    this.loadFile(path.join(os.homedir(), '.kit', 'config.json'));
    
    // 3. Load project config (./kit.config.json)
    this.loadFile(path.join(process.cwd(), 'kit.config.json'));
    
    // 4. Load environment variables
    this.loadEnv();
    
    return this.config;
  }
  
  /**
   * Get current config
   */
  get(): KitConfig {
    return this.config;
  }
  
  /**
   * Get a specific config value by path
   */
  getValue<T>(path: string, defaultValue?: T): T {
    const parts = path.split('.');
    let current: any = this.config;
    
    for (const part of parts) {
      if (current === undefined || current === null) {
        return defaultValue as T;
      }
      current = current[part];
    }
    
    return (current ?? defaultValue) as T;
  }
  
  /**
   * Save config to file
   */
  save(filepath?: string): void {
    const targetPath = filepath || this.configPath;
    const dir = path.dirname(targetPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(
      targetPath,
      JSON.stringify(this.config, null, 2),
      'utf8'
    );
  }
  
  /**
   * Update config values
   */
  update(updates: Partial<KitConfig>): void {
    this.config = this.deepMerge(this.config, updates);
  }
  
  /**
   * Load config from a file
   */
  private loadFile(filepath: string): void {
    if (!fs.existsSync(filepath)) {
      return;
    }
    
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      const fileConfig = JSON.parse(content);
      this.config = this.deepMerge(this.config, fileConfig);
    } catch (error) {
      console.warn(`Failed to load config from ${filepath}:`, error);
    }
  }
  
  /**
   * Load config from environment variables
   */
  private loadEnv(): void {
    // Gateway
    if (process.env.KIT_GATEWAY_HOST) {
      this.config.gateway.host = process.env.KIT_GATEWAY_HOST;
    }
    if (process.env.KIT_GATEWAY_PORT) {
      this.config.gateway.port = parseInt(process.env.KIT_GATEWAY_PORT, 10);
    }
    if (process.env.KIT_GATEWAY_TOKEN) {
      this.config.gateway.token = process.env.KIT_GATEWAY_TOKEN;
    }
    
    // AI Providers
    if (process.env.ANTHROPIC_API_KEY) {
      this.config.ai.providers.anthropic = {
        ...this.config.ai.providers.anthropic,
        apiKey: process.env.ANTHROPIC_API_KEY,
        enabled: true,
      };
    }
    if (process.env.OPENAI_API_KEY) {
      this.config.ai.providers.openai = {
        ...this.config.ai.providers.openai,
        apiKey: process.env.OPENAI_API_KEY,
        enabled: true,
      };
    }
    if (process.env.OPENROUTER_API_KEY) {
      this.config.ai.providers.openrouter = {
        ...this.config.ai.providers.openrouter,
        apiKey: process.env.OPENROUTER_API_KEY,
        enabled: true,
      };
    }
    
    // Trading
    if (process.env.KIT_TRADING_ENABLED) {
      this.config.trading.enabled = process.env.KIT_TRADING_ENABLED === 'true';
    }
    if (process.env.KIT_AUTO_TRADE) {
      this.config.trading.autoTrade = process.env.KIT_AUTO_TRADE === 'true';
    }
    
    // Logging
    if (process.env.KIT_LOG_LEVEL) {
      this.config.logging.level = process.env.KIT_LOG_LEVEL as any;
    }
  }
  
  /**
   * Deep merge objects
   */
  private deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const result = { ...target };
    
    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = (result as any)[key];
      
      if (sourceValue === undefined) continue;
      
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        (result as any)[key] = this.deepMerge(targetValue, sourceValue);
      } else {
        (result as any)[key] = sourceValue;
      }
    }
    
    return result;
  }
}

// ============================================================================
// Exports
// ============================================================================

export function loadConfig(): KitConfig {
  return ConfigLoader.getInstance().load();
}

export function getConfig(): KitConfig {
  return ConfigLoader.getInstance().get();
}

export function getConfigValue<T>(path: string, defaultValue?: T): T {
  return ConfigLoader.getInstance().getValue(path, defaultValue);
}

export function saveConfig(filepath?: string): void {
  ConfigLoader.getInstance().save(filepath);
}

export function updateConfig(updates: Partial<KitConfig>): void {
  ConfigLoader.getInstance().update(updates);
}
