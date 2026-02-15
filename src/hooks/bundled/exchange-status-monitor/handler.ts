/**
 * Exchange Status Monitor Hook
 *
 * Monitors exchange API status and alerts on outages/maintenance.
 * Critical for trading systems to avoid executing during incidents.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Types
type ExchangeStatus = 'operational' | 'degraded' | 'maintenance' | 'outage' | 'unknown';

interface ExchangeState {
  exchange: string;
  status: ExchangeStatus;
  statusPage: string;
  lastCheck: string;
  latencyMs: number | null;
  errorRate: number; // errors per 100 requests
  message?: string;
  tradingAllowed: boolean;
}

interface StatusHistory {
  exchanges: Record<string, ExchangeState>;
  lastUpdate: string;
  incidents: Array<{
    exchange: string;
    status: ExchangeStatus;
    message: string;
    timestamp: string;
    resolved?: string;
  }>;
}

interface HookEvent {
  type: string;
  action?: string;
  messages: string[];
  context: {
    workspaceDir?: string;
    cfg?: Record<string, unknown>;
  };
}

// Constants
const KIT_HOME = path.join(os.homedir(), '.kit');
const DATA_DIR = path.join(KIT_HOME, 'data');
const REPORTS_DIR = path.join(KIT_HOME, 'reports');
const STATE_FILE = path.join(DATA_DIR, 'exchange-status.json');
const INCIDENTS_LOG = path.join(REPORTS_DIR, 'exchange-incidents.log');

// Exchange configurations
const EXCHANGE_CONFIG: Record<
  string,
  { statusPage: string; healthEndpoint: string }
> = {
  binance: {
    statusPage: 'https://status.binance.com',
    healthEndpoint: 'https://api.binance.com/api/v3/ping',
  },
  coinbase: {
    statusPage: 'https://status.coinbase.com',
    healthEndpoint: 'https://api.coinbase.com/v2/time',
  },
  kraken: {
    statusPage: 'https://status.kraken.com',
    healthEndpoint: 'https://api.kraken.com/0/public/SystemStatus',
  },
  kucoin: {
    statusPage: 'https://status.kucoin.com',
    healthEndpoint: 'https://api.kucoin.com/api/v1/timestamp',
  },
  bybit: {
    statusPage: 'https://status.bybit.com',
    healthEndpoint: 'https://api.bybit.com/v5/market/time',
  },
  okx: {
    statusPage: 'https://status.okx.com',
    healthEndpoint: 'https://www.okx.com/api/v5/public/time',
  },
};

const DEFAULT_EXCHANGES = ['binance', 'coinbase', 'kraken'];
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes default

// Ensure directories exist
function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

// Load current state
function loadState(): StatusHistory {
  ensureDirs();
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    } catch {
      return { exchanges: {}, lastUpdate: '', incidents: [] };
    }
  }
  return { exchanges: {}, lastUpdate: '', incidents: [] };
}

// Save state
function saveState(state: StatusHistory): void {
  ensureDirs();
  // Keep only last 50 incidents
  state.incidents = state.incidents.slice(-50);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Log incident
function logIncident(
  exchange: string,
  status: ExchangeStatus,
  message: string
): void {
  ensureDirs();
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${exchange.toUpperCase()}: ${status} - ${message}\n`;
  fs.appendFileSync(INCIDENTS_LOG, logLine);
}

// Check exchange health (simulated - in production would make real API calls)
async function checkExchangeHealth(
  exchange: string
): Promise<{
  status: ExchangeStatus;
  latencyMs: number | null;
  errorRate: number;
  message?: string;
}> {
  const config = EXCHANGE_CONFIG[exchange];
  if (!config) {
    return {
      status: 'unknown',
      latencyMs: null,
      errorRate: 0,
      message: 'Exchange not configured',
    };
  }

  // Simulate health check (in production, make actual HTTP requests)
  // Using exchange name hash + time for deterministic but varied results
  const hash = exchange.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const minute = new Date().getMinutes();

  // Most of the time exchanges are operational
  const random = (hash + minute) % 100;

  if (random < 85) {
    // 85% - Operational
    return {
      status: 'operational',
      latencyMs: 50 + (hash % 100),
      errorRate: 0.1 + (hash % 5) / 10,
    };
  } else if (random < 93) {
    // 8% - Degraded
    return {
      status: 'degraded',
      latencyMs: 500 + (hash % 500),
      errorRate: 5 + (hash % 10),
      message: 'Elevated latency detected',
    };
  } else if (random < 98) {
    // 5% - Maintenance
    return {
      status: 'maintenance',
      latencyMs: null,
      errorRate: 100,
      message: 'Scheduled maintenance in progress',
    };
  } else {
    // 2% - Outage
    return {
      status: 'outage',
      latencyMs: null,
      errorRate: 100,
      message: 'API unreachable',
    };
  }
}

// Determine if trading should be allowed
function isTradingAllowed(
  status: ExchangeStatus,
  pauseOnDegraded: boolean
): boolean {
  switch (status) {
    case 'operational':
      return true;
    case 'degraded':
      return !pauseOnDegraded;
    case 'maintenance':
    case 'outage':
      return false;
    default:
      return false;
  }
}

// Format status for display
function formatStatus(status: ExchangeStatus): string {
  const formats: Record<ExchangeStatus, string> = {
    operational: '🟢 Operational',
    degraded: '🟡 Degraded',
    maintenance: '🟠 Maintenance',
    outage: '🔴 Outage',
    unknown: '⚪ Unknown',
  };
  return formats[status];
}

// Main handler
const handler = async (event: HookEvent): Promise<void> => {
  // Only trigger on heartbeat or startup
  if (
    event.type !== 'gateway' ||
    (event.action !== 'heartbeat' && event.action !== 'startup')
  ) {
    return;
  }

  const now = new Date();
  const state = loadState();

  // Check if we should run (respect interval)
  const lastUpdate = state.lastUpdate ? new Date(state.lastUpdate) : null;
  const intervalMs = parseInt(process.env.ESM_CHECK_INTERVAL || '300', 10) * 1000;

  if (lastUpdate && now.getTime() - lastUpdate.getTime() < intervalMs) {
    // Skip this check, too soon
    return;
  }

  // Get exchanges from config
  const exchangesEnv = process.env.ESM_EXCHANGES;
  const exchanges = exchangesEnv
    ? exchangesEnv.split(',').map((e) => e.trim().toLowerCase())
    : DEFAULT_EXCHANGES;

  const pauseOnDegraded = process.env.ESM_PAUSE_ON_DEGRADED !== 'false';

  // Check each exchange
  for (const exchange of exchanges) {
    const previousState = state.exchanges[exchange];
    const healthCheck = await checkExchangeHealth(exchange);

    const config = EXCHANGE_CONFIG[exchange] || {
      statusPage: '#',
      healthEndpoint: '#',
    };

    const newState: ExchangeState = {
      exchange,
      status: healthCheck.status,
      statusPage: config.statusPage,
      lastCheck: now.toISOString(),
      latencyMs: healthCheck.latencyMs,
      errorRate: healthCheck.errorRate,
      message: healthCheck.message,
      tradingAllowed: isTradingAllowed(healthCheck.status, pauseOnDegraded),
    };

    // Check for status change
    if (previousState && previousState.status !== healthCheck.status) {
      const isIncident =
        healthCheck.status !== 'operational' &&
        previousState.status === 'operational';
      const isResolved =
        healthCheck.status === 'operational' &&
        previousState.status !== 'operational';

      if (isIncident) {
        // New incident
        const message = healthCheck.message || `Status changed to ${healthCheck.status}`;
        logIncident(exchange, healthCheck.status, message);

        state.incidents.push({
          exchange,
          status: healthCheck.status,
          message,
          timestamp: now.toISOString(),
        });

        // Alert user
        event.messages.push(
          `🏛️ **Exchange Alert: ${exchange.toUpperCase()}**\n` +
            `${formatStatus(healthCheck.status)}\n` +
            `${message}\n\n` +
            `Trading: ${newState.tradingAllowed ? '✅ Allowed' : '⛔ Paused'}\n` +
            `Status page: ${config.statusPage}`
        );
      } else if (isResolved) {
        // Incident resolved
        logIncident(exchange, 'operational', 'Issue resolved');

        // Mark last incident as resolved
        const lastIncident = state.incidents
          .filter((i) => i.exchange === exchange && !i.resolved)
          .pop();
        if (lastIncident) {
          lastIncident.resolved = now.toISOString();
        }

        // Alert user
        event.messages.push(
          `🏛️ **Exchange Recovered: ${exchange.toUpperCase()}**\n` +
            `${formatStatus('operational')}\n` +
            `Trading: ✅ Resumed\n` +
            `Latency: ${healthCheck.latencyMs}ms`
        );
      }
    }

    state.exchanges[exchange] = newState;
  }

  state.lastUpdate = now.toISOString();
  saveState(state);
};

export default handler;
