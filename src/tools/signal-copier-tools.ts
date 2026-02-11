/**
 * K.I.T. Signal Copier Tools
 * 
 * User says: "Copy signals from @CryptoWhale"
 * K.I.T. handles EVERYTHING automatically.
 */

import { Tool } from './types';
import * as fs from 'fs';
import * as path from 'path';

// Signal copier state (persisted to workspace)
interface SignalChannel {
  id: string;
  name: string;
  type: 'telegram' | 'discord';
  markets: string[];
  autoExecute: boolean;
  enabled: boolean;
  addedAt: string;
  stats: {
    signalsReceived: number;
    signalsExecuted: number;
    wins: number;
    losses: number;
  };
}

interface SignalCopierState {
  channels: SignalChannel[];
  settings: {
    maxRiskPerTrade: number;
    maxTradesPerDay: number;
    requireConfirmation: boolean;
    defaultMarkets: string[];
  };
  routing: {
    crypto: string;
    forex: string;
    binary: string;
    stocks: string;
  };
}

function getStatePath(): string {
  const workspace = process.env.KIT_WORKSPACE || process.cwd();
  return path.join(workspace, 'signal-copier.json');
}

function loadState(): SignalCopierState {
  const statePath = getStatePath();
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  }
  return {
    channels: [],
    settings: {
      maxRiskPerTrade: 2,
      maxTradesPerDay: 20,
      requireConfirmation: false,
      defaultMarkets: ['crypto', 'forex', 'binary']
    },
    routing: {
      crypto: 'binance',
      forex: 'mt5',
      binary: 'binaryfaster',
      stocks: 'alpaca'
    }
  };
}

function saveState(state: SignalCopierState): void {
  const statePath = getStatePath();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// ============================================================
// SIGNAL PARSER (TypeScript version)
// ============================================================

interface ParsedSignal {
  market: 'crypto' | 'forex' | 'binary' | 'stocks' | 'defi';
  symbol: string;
  direction: 'long' | 'short';
  entryPrice?: number;
  takeProfits: number[];
  stopLoss?: number;
  expiry?: string;
  confidence: 'high' | 'medium' | 'low';
  rawText: string;
}

function parseSignal(text: string): ParsedSignal | null {
  const upper = text.toUpperCase();
  
  // Detect market
  let market: ParsedSignal['market'] | null = null;
  let symbol: string | null = null;
  
  // Crypto patterns
  const cryptoMatch = upper.match(/(BTC|ETH|XRP|SOL|BNB|ADA|DOGE|AVAX|DOT|LINK|MATIC)[\/\-]?(USDT|USD|BUSD|USDC|BTC|ETH)?/);
  if (cryptoMatch) {
    market = 'crypto';
    symbol = `${cryptoMatch[1]}/${cryptoMatch[2] || 'USDT'}`;
  }
  
  // Forex patterns
  const forexMatch = upper.match(/(EUR|USD|GBP|JPY|AUD|NZD|CAD|CHF)[\/\-]?(EUR|USD|GBP|JPY|AUD|NZD|CAD|CHF)/);
  if (forexMatch && !market) {
    // Check if binary (has expiry)
    if (/\d+\s*(MIN|M|SEC|S|MINUTE)/i.test(text) || /CALL|PUT/i.test(text)) {
      market = 'binary';
    } else {
      market = 'forex';
    }
    symbol = `${forexMatch[1]}/${forexMatch[2]}`;
  }
  
  // Stock patterns
  const stockMatch = upper.match(/\b(AAPL|TSLA|GOOGL|AMZN|MSFT|NVDA|META|AMD|NFLX|SPY|QQQ)\b/);
  if (stockMatch && !market) {
    market = 'stocks';
    symbol = stockMatch[1];
  }
  
  if (!market || !symbol) return null;
  
  // Detect direction
  let direction: 'long' | 'short' | null = null;
  if (/\b(BUY|LONG|CALL|BULLISH)\b/i.test(text) || /🟢|🚀|📈|⬆️|💚/.test(text)) {
    direction = 'long';
  } else if (/\b(SELL|SHORT|PUT|BEARISH)\b/i.test(text) || /🔴|📉|⬇️/.test(text)) {
    direction = 'short';
  }
  
  if (!direction) return null;
  
  // Extract prices
  const entryMatch = text.match(/entry[:\s]*\$?([\d.,]+)/i) || text.match(/@\s*\$?([\d.,]+)/);
  const entryPrice = entryMatch ? parseFloat(entryMatch[1].replace(',', '.')) : undefined;
  
  const tpMatches = [...text.matchAll(/tp\d?[:\s]*\$?([\d.,]+)/gi)];
  const takeProfits = tpMatches.map(m => parseFloat(m[1].replace(',', '.'))).filter(n => !isNaN(n));
  
  const slMatch = text.match(/sl[:\s]*\$?([\d.,]+)/i) || text.match(/stop[:\s]*\$?([\d.,]+)/i);
  const stopLoss = slMatch ? parseFloat(slMatch[1].replace(',', '.')) : undefined;
  
  // Expiry for binary
  let expiry: string | undefined;
  if (market === 'binary') {
    const expiryMatch = text.match(/(\d+)\s*(min|m|minute|sec|s)/i);
    if (expiryMatch) {
      expiry = `${expiryMatch[1]}${expiryMatch[2][0].toLowerCase()}`;
    } else {
      expiry = '5m';
    }
  }
  
  // Confidence
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (/HIGH|STRONG|🔥|💎|STARK/i.test(text)) confidence = 'high';
  if (/LOW|WEAK|SCHWACH/i.test(text)) confidence = 'low';
  
  return {
    market,
    symbol,
    direction,
    entryPrice,
    takeProfits,
    stopLoss,
    expiry,
    confidence,
    rawText: text
  };
}

// ============================================================
// TOOLS
// ============================================================

export const signalCopierTools: Tool[] = [
  {
    name: 'signal_copier_add_channel',
    description: 'Add a Telegram channel or group to copy trading signals from. User just says the channel name, K.I.T. handles everything.',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Telegram channel/group name or link (e.g., @CryptoSignals, t.me/ForexVIP)'
        },
        markets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Markets to copy: crypto, forex, binary, stocks. Default: all'
        },
        autoExecute: {
          type: 'boolean',
          description: 'Auto-execute signals without confirmation. Default: true'
        }
      },
      required: ['channel']
    },
    handler: async (params: { channel: string; markets?: string[]; autoExecute?: boolean }) => {
      const state = loadState();
      
      // Normalize channel name
      let channelId = params.channel.trim();
      if (channelId.includes('t.me/')) {
        channelId = '@' + channelId.split('t.me/')[1].split('/')[0];
      }
      if (!channelId.startsWith('@') && !channelId.startsWith('-')) {
        channelId = '@' + channelId;
      }
      
      // Check if already exists
      if (state.channels.find(c => c.id.toLowerCase() === channelId.toLowerCase())) {
        return {
          success: false,
          error: `Channel ${channelId} is already being monitored`
        };
      }
      
      const newChannel: SignalChannel = {
        id: channelId,
        name: channelId,
        type: 'telegram',
        markets: params.markets || state.settings.defaultMarkets,
        autoExecute: params.autoExecute ?? true,
        enabled: true,
        addedAt: new Date().toISOString(),
        stats: {
          signalsReceived: 0,
          signalsExecuted: 0,
          wins: 0,
          losses: 0
        }
      };
      
      state.channels.push(newChannel);
      saveState(state);
      
      return {
        success: true,
        message: `✅ Now copying signals from ${channelId}`,
        channel: newChannel,
        config: {
          markets: newChannel.markets,
          autoExecute: newChannel.autoExecute,
          routing: state.routing
        }
      };
    }
  },
  
  {
    name: 'signal_copier_remove_channel',
    description: 'Stop copying signals from a channel',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel name to remove'
        }
      },
      required: ['channel']
    },
    handler: async (params: { channel: string }) => {
      const state = loadState();
      
      let channelId = params.channel.trim();
      if (!channelId.startsWith('@')) channelId = '@' + channelId;
      
      const index = state.channels.findIndex(c => c.id.toLowerCase() === channelId.toLowerCase());
      if (index === -1) {
        return {
          success: false,
          error: `Channel ${channelId} not found in your signal sources`
        };
      }
      
      const removed = state.channels.splice(index, 1)[0];
      saveState(state);
      
      return {
        success: true,
        message: `✅ Stopped copying signals from ${removed.id}`,
        stats: removed.stats
      };
    }
  },
  
  {
    name: 'signal_copier_list',
    description: 'List all channels being monitored for signals',
    parameters: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const state = loadState();
      
      if (state.channels.length === 0) {
        return {
          success: true,
          message: 'No signal channels configured yet. Add one with: "Copy signals from @ChannelName"',
          channels: []
        };
      }
      
      return {
        success: true,
        channels: state.channels.map(c => ({
          id: c.id,
          markets: c.markets,
          autoExecute: c.autoExecute,
          enabled: c.enabled,
          stats: c.stats
        })),
        settings: state.settings,
        routing: state.routing
      };
    }
  },
  
  {
    name: 'signal_copier_pause',
    description: 'Pause signal copying for a channel or all channels',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel to pause, or "all" for all channels'
        }
      },
      required: ['channel']
    },
    handler: async (params: { channel: string }) => {
      const state = loadState();
      
      if (params.channel.toLowerCase() === 'all') {
        state.channels.forEach(c => c.enabled = false);
        saveState(state);
        return {
          success: true,
          message: '⏸️ Paused all signal channels'
        };
      }
      
      let channelId = params.channel.trim();
      if (!channelId.startsWith('@')) channelId = '@' + channelId;
      
      const channel = state.channels.find(c => c.id.toLowerCase() === channelId.toLowerCase());
      if (!channel) {
        return { success: false, error: `Channel ${channelId} not found` };
      }
      
      channel.enabled = false;
      saveState(state);
      
      return {
        success: true,
        message: `⏸️ Paused signal copying from ${channel.id}`
      };
    }
  },
  
  {
    name: 'signal_copier_resume',
    description: 'Resume signal copying for a channel or all channels',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel to resume, or "all" for all channels'
        }
      },
      required: ['channel']
    },
    handler: async (params: { channel: string }) => {
      const state = loadState();
      
      if (params.channel.toLowerCase() === 'all') {
        state.channels.forEach(c => c.enabled = true);
        saveState(state);
        return {
          success: true,
          message: '▶️ Resumed all signal channels'
        };
      }
      
      let channelId = params.channel.trim();
      if (!channelId.startsWith('@')) channelId = '@' + channelId;
      
      const channel = state.channels.find(c => c.id.toLowerCase() === channelId.toLowerCase());
      if (!channel) {
        return { success: false, error: `Channel ${channelId} not found` };
      }
      
      channel.enabled = true;
      saveState(state);
      
      return {
        success: true,
        message: `▶️ Resumed signal copying from ${channel.id}`
      };
    }
  },
  
  {
    name: 'signal_copier_settings',
    description: 'Update signal copier settings',
    parameters: {
      type: 'object',
      properties: {
        maxRiskPerTrade: {
          type: 'number',
          description: 'Max risk per trade in % (e.g., 2 for 2%)'
        },
        maxTradesPerDay: {
          type: 'number',
          description: 'Max trades per day'
        },
        requireConfirmation: {
          type: 'boolean',
          description: 'Require confirmation before executing'
        },
        cryptoExchange: {
          type: 'string',
          description: 'Exchange for crypto trades (binance, kraken, etc.)'
        },
        forexPlatform: {
          type: 'string',
          description: 'Platform for forex trades (mt5, mt4)'
        },
        binaryPlatform: {
          type: 'string',
          description: 'Platform for binary options (binaryfaster, etc.)'
        }
      }
    },
    handler: async (params: any) => {
      const state = loadState();
      
      if (params.maxRiskPerTrade !== undefined) {
        state.settings.maxRiskPerTrade = params.maxRiskPerTrade;
      }
      if (params.maxTradesPerDay !== undefined) {
        state.settings.maxTradesPerDay = params.maxTradesPerDay;
      }
      if (params.requireConfirmation !== undefined) {
        state.settings.requireConfirmation = params.requireConfirmation;
      }
      if (params.cryptoExchange) {
        state.routing.crypto = params.cryptoExchange;
      }
      if (params.forexPlatform) {
        state.routing.forex = params.forexPlatform;
      }
      if (params.binaryPlatform) {
        state.routing.binary = params.binaryPlatform;
      }
      
      saveState(state);
      
      return {
        success: true,
        message: '✅ Settings updated',
        settings: state.settings,
        routing: state.routing
      };
    }
  },
  
  {
    name: 'signal_copier_process',
    description: 'Process an incoming signal message (called automatically by Telegram channel listener)',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The signal message text'
        },
        channelId: {
          type: 'string',
          description: 'Source channel ID'
        }
      },
      required: ['text', 'channelId']
    },
    handler: async (params: { text: string; channelId: string }) => {
      const state = loadState();
      
      // Find the channel
      const channel = state.channels.find(c => 
        c.id.toLowerCase() === params.channelId.toLowerCase() && c.enabled
      );
      
      if (!channel) {
        return {
          success: false,
          isSignal: false,
          reason: 'Channel not monitored or disabled'
        };
      }
      
      // Parse the signal
      const signal = parseSignal(params.text);
      
      if (!signal) {
        return {
          success: true,
          isSignal: false,
          reason: 'Not a valid signal format'
        };
      }
      
      // Check if market is enabled for this channel
      if (!channel.markets.includes(signal.market)) {
        return {
          success: true,
          isSignal: true,
          executed: false,
          reason: `Market ${signal.market} not enabled for this channel`
        };
      }
      
      // Update stats
      channel.stats.signalsReceived++;
      
      // Check daily limit
      // TODO: Track daily trades properly
      
      saveState(state);
      
      // Return signal for execution
      return {
        success: true,
        isSignal: true,
        signal: {
          market: signal.market,
          symbol: signal.symbol,
          direction: signal.direction,
          entry: signal.entryPrice,
          takeProfits: signal.takeProfits,
          stopLoss: signal.stopLoss,
          expiry: signal.expiry,
          confidence: signal.confidence
        },
        routing: state.routing[signal.market as keyof typeof state.routing],
        autoExecute: channel.autoExecute && !state.settings.requireConfirmation,
        channel: channel.id
      };
    }
  },
  
  {
    name: 'signal_copier_stats',
    description: 'Get signal copier statistics',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel to get stats for, or omit for all'
        }
      }
    },
    handler: async (params: { channel?: string }) => {
      const state = loadState();
      
      if (params.channel) {
        let channelId = params.channel.trim();
        if (!channelId.startsWith('@')) channelId = '@' + channelId;
        
        const channel = state.channels.find(c => c.id.toLowerCase() === channelId.toLowerCase());
        if (!channel) {
          return { success: false, error: `Channel ${channelId} not found` };
        }
        
        const winRate = channel.stats.signalsExecuted > 0 
          ? ((channel.stats.wins / channel.stats.signalsExecuted) * 100).toFixed(1)
          : '0';
        
        return {
          success: true,
          channel: channel.id,
          stats: {
            ...channel.stats,
            winRate: `${winRate}%`
          }
        };
      }
      
      // All channels
      const totals = state.channels.reduce((acc, c) => ({
        signalsReceived: acc.signalsReceived + c.stats.signalsReceived,
        signalsExecuted: acc.signalsExecuted + c.stats.signalsExecuted,
        wins: acc.wins + c.stats.wins,
        losses: acc.losses + c.stats.losses
      }), { signalsReceived: 0, signalsExecuted: 0, wins: 0, losses: 0 });
      
      const winRate = totals.signalsExecuted > 0 
        ? ((totals.wins / totals.signalsExecuted) * 100).toFixed(1)
        : '0';
      
      return {
        success: true,
        totalChannels: state.channels.length,
        activeChannels: state.channels.filter(c => c.enabled).length,
        totals: {
          ...totals,
          winRate: `${winRate}%`
        },
        channels: state.channels.map(c => ({
          id: c.id,
          enabled: c.enabled,
          stats: c.stats
        }))
      };
    }
  }
];

export default signalCopierTools;
