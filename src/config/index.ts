/**
 * K.I.T. Configuration
 */

export * from './channels';
export * from './skills';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

export interface AgentConfig {
  id?: string;
  name?: string;
  model?: string;
  defaultSession?: string;
  workspace?: string;
}

export interface HeartbeatConfig {
  enabled?: boolean;
  every?: string;
  activeHours?: { start?: string; end?: string; timezone?: string };
}

export interface CronConfig {
  enabled?: boolean;
}

export interface MemoryConfig {
  embeddings?: { provider?: string; model?: string; apiKey?: string };
}

export interface AIConfig {
  defaultProvider?: string;
  providers?: Record<string, { apiKey?: string; enabled?: boolean }>;
}

export interface TradingConfig {
  style?: string;
  maxPositionSize?: number;
  autoTrade?: boolean;
}

export interface WorkspaceConfig {
  path?: string;
}

export interface ChannelConfig {
  enabled?: boolean;
  token?: string;
  [key: string]: any;
}

export interface LoggingConfig {
  level?: string;
  file?: string;
}

export interface KITConfig {
  version?: string;
  onboarded?: boolean;
  user?: {
    name?: string;
    timezone?: string;
    experience?: string;
    riskTolerance?: string;
    markets?: string[];
    goals?: string;
    autonomyLevel?: string;
  };
  ai?: AIConfig;
  trading?: TradingConfig;
  channels?: Record<string, ChannelConfig>;
  skills?: Record<string, { enabled?: boolean }>;
  exchanges?: Record<string, any>;
  gateway?: {
    port?: number;
    host?: string;
    token?: string;
  };
  agent?: AgentConfig;
  heartbeat?: HeartbeatConfig;
  cron?: CronConfig;
  memory?: MemoryConfig;
  workspace?: WorkspaceConfig;
  logging?: LoggingConfig;
}

// Aliases for compatibility
export type KitConfig = KITConfig;

export const DEFAULT_CONFIG: KITConfig = {
  version: '2.0.0',
  onboarded: false,
  gateway: { port: 18799, host: '127.0.0.1' },
  agent: { id: 'main', name: 'K.I.T.' },
  heartbeat: { enabled: true, every: '30m' },
  cron: { enabled: true },
  memory: {},
};

export function loadConfig(): KITConfig {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function saveConfig(config: KITConfig): void {
  if (!fs.existsSync(KIT_HOME)) {
    fs.mkdirSync(KIT_HOME, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getKitHome(): string {
  return KIT_HOME;
}

export function getConfig(): KITConfig {
  return loadConfig();
}

export function updateConfig(updates: Partial<KITConfig>): void {
  const current = loadConfig();
  const merged = { ...current, ...updates };
  saveConfig(merged);
}

export function getConfigValue<T>(path: string, defaultValue?: T): T | undefined {
  const config = loadConfig();
  const parts = path.split('.');
  let value: any = config;
  for (const part of parts) {
    if (value === undefined || value === null) return defaultValue;
    value = value[part];
  }
  return value ?? defaultValue;
}
