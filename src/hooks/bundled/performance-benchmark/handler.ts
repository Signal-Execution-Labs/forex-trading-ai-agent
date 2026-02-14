/**
 * Performance Benchmark Hook Handler
 * Tracks execution times and performance metrics for K.I.T. operations
 * 
 * Listens on: trade:executed, trade:closed (core trading events)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler, HookContext } from '../../types.js';

interface OperationMetrics {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  samples: number[];
  slowCount: number;
  lastUpdated: number;
}

interface PerformanceState {
  operations: Record<string, OperationMetrics>;
  startedAt: number;
  lastSaved: number;
}

const SLOW_THRESHOLD_MS = 1000;
const MAX_SAMPLES = 1000;

let state: PerformanceState = {
  operations: {},
  startedAt: Date.now(),
  lastSaved: 0,
};

let statePath: string;

function getStatePath(): string {
  if (!statePath) {
    statePath = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.kit',
      'logs',
      'performance.json'
    );
  }
  return statePath;
}

function loadState(): void {
  try {
    const filePath = getStatePath();
    if (fs.existsSync(filePath)) {
      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      state = { ...state, ...loaded };
    }
  } catch {
    // Start fresh
  }
}

function saveState(): void {
  try {
    const filePath = getStatePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Calculate percentiles before saving
    const report = generateReport();
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    state.lastSaved = Date.now();
  } catch (err) {
    console.error('[performance-benchmark] Failed to save state:', err);
  }
}

function calculatePercentile(samples: number[], percentile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function generateReport(): object {
  const operations: Record<string, object> = {};
  
  for (const [name, metrics] of Object.entries(state.operations)) {
    operations[name] = {
      count: metrics.count,
      avgMs: metrics.count > 0 ? Math.round(metrics.totalMs / metrics.count * 100) / 100 : 0,
      minMs: metrics.minMs === Infinity ? 0 : metrics.minMs,
      maxMs: metrics.maxMs,
      p50Ms: calculatePercentile(metrics.samples, 50),
      p95Ms: calculatePercentile(metrics.samples, 95),
      p99Ms: calculatePercentile(metrics.samples, 99),
      slowCount: metrics.slowCount,
      lastUpdated: new Date(metrics.lastUpdated).toISOString(),
    };
  }
  
  return {
    startedAt: new Date(state.startedAt).toISOString(),
    lastUpdated: new Date().toISOString(),
    uptimeMs: Date.now() - state.startedAt,
    totalOperations: Object.values(state.operations).reduce((sum, m) => sum + m.count, 0),
    operations,
  };
}

const handler: HookHandler = async (ctx: HookContext) => {
  // Load state on first call
  if (state.startedAt === 0) {
    loadState();
    state.startedAt = Date.now();
  }
  
  const { event, data, timestamp } = ctx;
  const operationType = event as string;
  
  // Only track trade events
  if (event !== 'trade:executed' && event !== 'trade:closed') {
    return;
  }
  
  // Initialize metrics for this operation type
  if (!state.operations[operationType]) {
    state.operations[operationType] = {
      count: 0,
      totalMs: 0,
      minMs: Infinity,
      maxMs: 0,
      samples: [],
      slowCount: 0,
      lastUpdated: timestamp.getTime(),
    };
  }
  
  const metrics = state.operations[operationType];
  metrics.count++;
  metrics.lastUpdated = timestamp.getTime();
  
  // If duration provided in data (execution latency)
  if (data?.durationMs || data?.executionTime || data?.latencyMs) {
    const durationMs = data.durationMs || data.executionTime || data.latencyMs;
    metrics.totalMs += durationMs;
    metrics.minMs = Math.min(metrics.minMs, durationMs);
    metrics.maxMs = Math.max(metrics.maxMs, durationMs);
    
    // Keep samples for percentile calculation
    metrics.samples.push(durationMs);
    if (metrics.samples.length > MAX_SAMPLES) {
      metrics.samples.shift();
    }
    
    // Check for slow operations
    if (durationMs > SLOW_THRESHOLD_MS) {
      metrics.slowCount++;
      const warningMsg = `⏱️ Slow ${operationType}: ${durationMs}ms (threshold: ${SLOW_THRESHOLD_MS}ms)`;
      console.warn(`[performance-benchmark] ${warningMsg}`);
      ctx.messages.push(warningMsg);
    }
  }
  
  // Save state every 30 seconds
  if (Date.now() - state.lastSaved > 30000) {
    saveState();
  }
};

export default handler;
