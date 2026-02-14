/**
 * Rate Limit Tracker Hook Handler
 * Tracks API rate limits across exchanges and providers to prevent throttling
 * 
 * Listens on: signal:received (monitors API activity through signals)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler, HookContext } from '../../types.js';

interface RateLimitState {
  [endpoint: string]: {
    limit: number;
    remaining: number;
    resetAt: number;
    requestCount: number;
    lastRequest: number;
    warnings: number;
  };
}

const WARNING_THRESHOLD = 0.8;
const COOLDOWN_MS = 60000;

// In-memory state (persisted to file)
let state: RateLimitState = {};
let statePath: string;

function getStatePath(): string {
  if (!statePath) {
    statePath = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.kit',
      'logs',
      'rate-limits.json'
    );
  }
  return statePath;
}

function loadState(): void {
  try {
    const filePath = getStatePath();
    if (fs.existsSync(filePath)) {
      state = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    state = {};
  }
}

function saveState(): void {
  try {
    const filePath = getStatePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[rate-limit-tracker] Failed to save state:', err);
  }
}

function extractRateLimits(headers: Record<string, string | number | undefined>): { limit?: number; remaining?: number; reset?: number } {
  const result: { limit?: number; remaining?: number; reset?: number } = {};
  
  // Standard headers
  if (headers['x-ratelimit-limit']) {
    result.limit = Number(headers['x-ratelimit-limit']);
  }
  if (headers['x-ratelimit-remaining']) {
    result.remaining = Number(headers['x-ratelimit-remaining']);
  }
  if (headers['x-ratelimit-reset']) {
    result.reset = Number(headers['x-ratelimit-reset']) * 1000; // Convert to ms
  }
  
  // Binance style
  const binanceWeight = Object.keys(headers).find(k => k.startsWith('x-mbx-used-weight'));
  if (binanceWeight && headers[binanceWeight]) {
    const used = Number(headers[binanceWeight]);
    result.limit = result.limit || 1200; // Binance default
    result.remaining = result.limit - used;
  }
  
  // Coinbase style
  if (headers['ratelimit-limit']) {
    result.limit = Number(headers['ratelimit-limit']);
  }
  if (headers['ratelimit-remaining']) {
    result.remaining = Number(headers['ratelimit-remaining']);
  }
  
  return result;
}

const handler: HookHandler = async (ctx: HookContext) => {
  // Only process signal events that contain API metadata
  if (ctx.event !== 'signal:received') {
    return;
  }
  
  // Load state on first call
  if (Object.keys(state).length === 0) {
    loadState();
  }
  
  const { data, timestamp } = ctx;
  
  // Check if this signal contains API rate limit info
  if (!data?.apiMetadata) {
    return;
  }
  
  const apiMeta = data.apiMetadata;
  const endpoint = apiMeta.endpoint || apiMeta.url || 'unknown';
  const provider = apiMeta.provider || data.source || 'unknown';
  const key = `${provider}:${endpoint}`;
  
  // Initialize state for this endpoint
  if (!state[key]) {
    state[key] = {
      limit: 0,
      remaining: 0,
      resetAt: 0,
      requestCount: 0,
      lastRequest: 0,
      warnings: 0,
    };
  }
  
  const endpointState = state[key];
  endpointState.requestCount++;
  endpointState.lastRequest = timestamp.getTime();
  
  // Extract rate limits from headers if present
  if (apiMeta.headers) {
    const limits = extractRateLimits(apiMeta.headers);
    
    if (limits.limit !== undefined) {
      endpointState.limit = limits.limit;
    }
    if (limits.remaining !== undefined) {
      endpointState.remaining = limits.remaining;
    }
    if (limits.reset !== undefined) {
      endpointState.resetAt = limits.reset;
    }
  }
  
  // Check if we should warn about approaching limits
  if (endpointState.limit > 0 && endpointState.remaining > 0) {
    const usageRatio = 1 - (endpointState.remaining / endpointState.limit);
    if (usageRatio >= WARNING_THRESHOLD) {
      endpointState.warnings++;
      const warningMsg = `🚦 Rate limit warning: ${provider} at ${Math.round(usageRatio * 100)}% (${endpointState.remaining}/${endpointState.limit} remaining)`;
      console.warn(`[rate-limit-tracker] ${warningMsg}`);
      ctx.messages.push(warningMsg);
    }
  }
  
  // Check for rate limit exceeded (429 status)
  if (apiMeta.statusCode === 429) {
    const errorMsg = `🛑 Rate limit exceeded for ${provider}:${endpoint}`;
    console.error(`[rate-limit-tracker] ${errorMsg}`);
    ctx.messages.push(errorMsg);
    
    // Set reset time if not provided
    if (!endpointState.resetAt) {
      endpointState.resetAt = Date.now() + COOLDOWN_MS;
    }
    endpointState.remaining = 0;
  }
  
  // Save state periodically
  saveState();
};

export default handler;
