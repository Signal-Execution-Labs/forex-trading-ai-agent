/**
 * K.I.T. Configuration Loader
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface KitConfig {
  agent?: {
    name?: string;
    model?: string;
  };
  gateway?: {
    port?: number;
    bind?: string;
    auth?: {
      mode?: 'token' | 'password' | 'none';
      token?: string;
      password?: string;
    };
  };
  exchanges?: {
    binance?: { apiKey: string; secret: string };
    kraken?: { apiKey: string; secret: string };
    mt5?: { server: string; login: number; password: string };
  };
  trading?: {
    maxRiskPerTrade?: number;
    maxDailyLoss?: number;
    defaultLeverage?: number;
  };
  channels?: {
    telegram?: { token: string; chatId?: string };
    discord?: { token: string; guildId?: string };
  };
}

const CONFIG_PATHS = [
  'kit.config.json',
  '.kit/config.json',
  join(homedir(), '.kit', 'config.json'),
];

export async function loadConfig(customPath?: string): Promise<KitConfig> {
  const paths = customPath ? [customPath, ...CONFIG_PATHS] : CONFIG_PATHS;
  
  for (const configPath of paths) {
    try {
      await access(configPath);
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      // Merge with environment variables
      return mergeEnvConfig(config);
    } catch {
      continue;
    }
  }
  
  // No config file found, use env vars only
  return mergeEnvConfig({});
}

function mergeEnvConfig(config: KitConfig): KitConfig {
  return {
    agent: {
      name: process.env.KIT_AGENT_NAME || config.agent?.name || 'K.I.T.',
      model: process.env.KIT_MODEL || config.agent?.model,
    },
    gateway: {
      port: parseInt(process.env.KIT_PORT || '', 10) || config.gateway?.port || 18799,
      bind: process.env.KIT_BIND || config.gateway?.bind || 'localhost',
      auth: config.gateway?.auth,
    },
    exchanges: {
      binance: {
        apiKey: process.env.BINANCE_API_KEY || config.exchanges?.binance?.apiKey || '',
        secret: process.env.BINANCE_SECRET || config.exchanges?.binance?.secret || '',
      },
      kraken: {
        apiKey: process.env.KRAKEN_API_KEY || config.exchanges?.kraken?.apiKey || '',
        secret: process.env.KRAKEN_SECRET || config.exchanges?.kraken?.secret || '',
      },
      mt5: {
        server: process.env.MT5_SERVER || config.exchanges?.mt5?.server || '',
        login: parseInt(process.env.MT5_LOGIN || '', 10) || config.exchanges?.mt5?.login || 0,
        password: process.env.MT5_PASSWORD || config.exchanges?.mt5?.password || '',
      },
    },
    trading: {
      maxRiskPerTrade: parseFloat(process.env.KIT_MAX_RISK || '') || config.trading?.maxRiskPerTrade || 0.02,
      maxDailyLoss: parseFloat(process.env.KIT_MAX_DAILY_LOSS || '') || config.trading?.maxDailyLoss || 0.05,
      defaultLeverage: parseInt(process.env.KIT_LEVERAGE || '', 10) || config.trading?.defaultLeverage || 1,
    },
    channels: {
      telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN || config.channels?.telegram?.token || '',
        chatId: process.env.TELEGRAM_CHAT_ID || config.channels?.telegram?.chatId,
      },
      discord: {
        token: process.env.DISCORD_BOT_TOKEN || config.channels?.discord?.token || '',
        guildId: process.env.DISCORD_GUILD_ID || config.channels?.discord?.guildId,
      },
    },
  };
}

export function getConfigPath(): string {
  return join(homedir(), '.kit', 'config.json');
}
