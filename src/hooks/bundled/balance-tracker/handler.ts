/**
 * Balance Tracker Hook
 * 
 * Monitors portfolio balance changes and alerts on significant movements.
 * Fires on gateway:heartbeat and trade:executed events.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface BalanceSnapshot {
  timestamp: string;
  totalUsd: number;
  byExchange: Record<string, number>;
  byAsset: Record<string, { amount: number; usdValue: number }>;
}

interface BalanceHistory {
  snapshots: BalanceSnapshot[];
  lastAlert?: string;
}

const KIT_HOME = path.join(os.homedir(), '.kit');
const DATA_DIR = path.join(KIT_HOME, 'data');
const REPORTS_DIR = path.join(KIT_HOME, 'reports');
const HISTORY_FILE = path.join(DATA_DIR, 'balance-history.json');

// Ensure directories exist
function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

// Load balance history
function loadHistory(): BalanceHistory {
  ensureDirs();
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    } catch {
      return { snapshots: [] };
    }
  }
  return { snapshots: [] };
}

// Save balance history
function saveHistory(history: BalanceHistory): void {
  ensureDirs();
  // Keep only last 30 days of hourly snapshots
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  history.snapshots = history.snapshots.filter(
    s => new Date(s.timestamp).getTime() > thirtyDaysAgo
  );
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Calculate percent change
function percentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

// Format currency
function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Mock balance fetcher (in real implementation, this would call exchange APIs)
async function fetchBalances(): Promise<BalanceSnapshot> {
  // This would be replaced with actual exchange API calls
  // For now, return a mock snapshot
  return {
    timestamp: new Date().toISOString(),
    totalUsd: 10000 + Math.random() * 500, // Mock: $10k +/- $500
    byExchange: {
      binance: 5000 + Math.random() * 250,
      coinbase: 3000 + Math.random() * 150,
      kraken: 2000 + Math.random() * 100,
    },
    byAsset: {
      BTC: { amount: 0.15, usdValue: 7500 },
      ETH: { amount: 2.5, usdValue: 2000 },
      USDT: { amount: 500, usdValue: 500 },
    },
  };
}

// Save daily report
function saveDailyReport(snapshot: BalanceSnapshot, history: BalanceHistory): void {
  const today = new Date().toISOString().split('T')[0];
  const reportFile = path.join(REPORTS_DIR, `balance-${today}.json`);
  
  // Find yesterday's snapshot for comparison
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const yesterdaySnapshots = history.snapshots.filter(
    s => s.timestamp.startsWith(yesterday)
  );
  const yesterdayBalance = yesterdaySnapshots.length > 0
    ? yesterdaySnapshots[yesterdaySnapshots.length - 1].totalUsd
    : null;
  
  const report = {
    date: today,
    current: snapshot,
    previousDay: yesterdayBalance,
    change24h: yesterdayBalance 
      ? percentChange(yesterdayBalance, snapshot.totalUsd)
      : null,
    generatedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
}

interface HookEvent {
  type: string;
  action: string;
  sessionKey?: string;
  timestamp: Date;
  messages: string[];
  context: {
    cfg?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

type HookHandler = (event: HookEvent) => Promise<void>;

const handler: HookHandler = async (event) => {
  // Only process heartbeat and trade events
  const validEvents = [
    { type: 'gateway', action: 'heartbeat' },
    { type: 'trade', action: 'executed' },
  ];
  
  const isValidEvent = validEvents.some(
    v => event.type === v.type && event.action === v.action
  );
  
  if (!isValidEvent) {
    return;
  }

  const threshold = parseFloat(process.env.BALANCE_THRESHOLD_PERCENT || '5');
  const alertOnDecreaseOnly = process.env.ALERT_ON_DECREASE_ONLY === 'true';

  try {
    const history = loadHistory();
    const currentSnapshot = await fetchBalances();
    
    // Get previous snapshot
    const previousSnapshot = history.snapshots[history.snapshots.length - 1];
    
    // Check for significant change
    if (previousSnapshot) {
      const change = percentChange(previousSnapshot.totalUsd, currentSnapshot.totalUsd);
      const absChange = Math.abs(change);
      
      if (absChange >= threshold) {
        const shouldAlert = !alertOnDecreaseOnly || change < 0;
        
        if (shouldAlert) {
          const direction = change > 0 ? '📈' : '📉';
          const verb = change > 0 ? 'increased' : 'decreased';
          const diff = currentSnapshot.totalUsd - previousSnapshot.totalUsd;
          
          event.messages.push(
            `${direction} **Balance Alert**: Portfolio ${verb} by ${absChange.toFixed(2)}%\n` +
            `• Previous: ${formatUsd(previousSnapshot.totalUsd)}\n` +
            `• Current: ${formatUsd(currentSnapshot.totalUsd)}\n` +
            `• Change: ${diff > 0 ? '+' : ''}${formatUsd(diff)}`
          );
          
          history.lastAlert = new Date().toISOString();
        }
      }
    }
    
    // Add current snapshot to history
    history.snapshots.push(currentSnapshot);
    saveHistory(history);
    
    // Save daily report (once per day)
    const today = new Date().toISOString().split('T')[0];
    const reportFile = path.join(REPORTS_DIR, `balance-${today}.json`);
    if (!fs.existsSync(reportFile)) {
      saveDailyReport(currentSnapshot, history);
    }
    
    console.log(`[balance-tracker] Balance: ${formatUsd(currentSnapshot.totalUsd)}`);
    
  } catch (error) {
    console.error('[balance-tracker] Error:', error);
  }
};

export default handler;
