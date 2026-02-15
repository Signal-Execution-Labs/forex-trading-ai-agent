/**
 * API Health Monitor Hook Handler
 * Monitors exchange API connectivity and latency
 */

import type { HookHandler } from '../../types.js';

// Exchange API endpoints for health checks
const EXCHANGE_ENDPOINTS: Record<string, string> = {
  binance: 'https://api.binance.com/api/v3/ping',
  coinbase: 'https://api.exchange.coinbase.com/time',
  kraken: 'https://api.kraken.com/0/public/Time',
  bybit: 'https://api.bybit.com/v5/market/time',
  okx: 'https://www.okx.com/api/v5/public/time',
  kucoin: 'https://api.kucoin.com/api/v1/timestamp',
  gate: 'https://api.gateio.ws/api/v4/spot/time',
  mexc: 'https://api.mexc.com/api/v3/ping',
  htx: 'https://api.huobi.pro/v1/common/timestamp',
  bitget: 'https://api.bitget.com/api/v2/public/time'
};

const DEFAULT_EXCHANGES = ['binance', 'coinbase', 'kraken', 'bybit', 'okx'];
const LATENCY_THRESHOLD_MS = 500;

async function checkApiHealth(exchange: string): Promise<{ latencyMs: number; healthy: boolean; error?: string }> {
  const endpoint = EXCHANGE_ENDPOINTS[exchange.toLowerCase()];
  if (!endpoint) {
    return { latencyMs: 0, healthy: false, error: `Unknown exchange: ${exchange}` };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    
    return {
      latencyMs,
      healthy: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (err: any) {
    return {
      latencyMs: Date.now() - start,
      healthy: false,
      error: err.name === 'AbortError' ? 'Timeout' : err.message
    };
  }
}

function getStatusEmoji(healthy: boolean, latencyMs: number, threshold: number): string {
  if (!healthy) return '🔴';
  if (latencyMs > threshold) return '🟡';
  return '🟢';
}

const handler: HookHandler = async (ctx) => {
  const config = ctx.context?.cfg?.hooks?.['api-health-monitor']?.config || {};
  const exchanges = config.exchanges || DEFAULT_EXCHANGES;
  const latencyThreshold = config.latencyThresholdMs || LATENCY_THRESHOLD_MS;

  // On gateway startup, check all exchanges
  if (ctx.event === 'gateway:startup') {
    const results: string[] = ['🏥 **API Health Check**'];
    
    for (const exchange of exchanges) {
      const health = await checkApiHealth(exchange);
      const emoji = getStatusEmoji(health.healthy, health.latencyMs, latencyThreshold);
      
      let status = `${emoji} ${exchange}: ${health.latencyMs}ms`;
      if (!health.healthy) {
        status += ` (${health.error})`;
      } else if (health.latencyMs > latencyThreshold) {
        status += ' (degraded)';
      }
      results.push(status);
    }
    
    ctx.messages.push(results.join('\n'));
  }

  // Before trade execution, check specific exchange
  if (ctx.event === 'trade:executed' && ctx.data?.exchange) {
    const exchange = ctx.data.exchange.toLowerCase();
    const health = await checkApiHealth(exchange);
    
    if (!health.healthy) {
      ctx.messages.push(`⚠️ Warning: ${exchange.toUpperCase()} API issues detected (${health.error})`);
    } else if (health.latencyMs > latencyThreshold * 2) {
      ctx.messages.push(`⚠️ High latency on ${exchange.toUpperCase()}: ${health.latencyMs}ms`);
    }
  }
};

export default handler;
