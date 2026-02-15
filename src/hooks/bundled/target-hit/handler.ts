/**
 * Target Hit Hook
 * 
 * Monitors prices and alerts when targets are hit:
 * - Take-profit targets
 * - Stop-loss targets
 * - Support/resistance levels
 * 
 * @event price_tick
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface PriceTarget {
  id: string;
  symbol: string;
  price: number;
  direction: 'above' | 'below';
  type: 'tp' | 'sl' | 'alert' | 'support' | 'resistance';
  note?: string;
  triggered: boolean;
  createdAt: number;
}

interface TargetState {
  targets: PriceTarget[];
  history: Array<{
    target: PriceTarget;
    triggeredAt: number;
    priceAtTrigger: number;
  }>;
  lastUpdated: number;
}

const TARGETS_FILE = path.join(os.homedir(), '.kit', 'price-targets.json');

function loadState(): TargetState {
  try {
    if (fs.existsSync(TARGETS_FILE)) {
      return JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf-8'));
    }
  } catch {
    // Ignore
  }
  return {
    targets: [],
    history: [],
    lastUpdated: Date.now(),
  };
}

function saveState(state: TargetState): void {
  try {
    const dir = path.dirname(TARGETS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TARGETS_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[target-hit] Failed to save state:', e);
  }
}

function getIcon(type: string): string {
  switch (type) {
    case 'tp': return '🎯';
    case 'sl': return '🛑';
    case 'support': return '📉';
    case 'resistance': return '📈';
    default: return '🔔';
  }
}

function getLabel(type: string): string {
  switch (type) {
    case 'tp': return 'Take Profit';
    case 'sl': return 'Stop Loss';
    case 'support': return 'Support';
    case 'resistance': return 'Resistance';
    default: return 'Price Alert';
  }
}

function formatAlert(target: PriceTarget, currentPrice: number): string {
  const icon = getIcon(target.type);
  const label = getLabel(target.type);
  const direction = target.direction === 'above' ? 'crossed above' : 'dropped below';
  
  let message = `${icon} ${label} HIT: ${target.symbol} ${direction} $${target.price.toFixed(2)} (now: $${currentPrice.toFixed(2)})`;
  
  if (target.note) {
    message += `\n   📝 ${target.note}`;
  }
  
  return message;
}

function checkTarget(target: PriceTarget, currentPrice: number): boolean {
  if (target.triggered) return false;
  
  if (target.direction === 'above') {
    return currentPrice >= target.price;
  } else {
    return currentPrice <= target.price;
  }
}

export async function handler(event: string, data: any): Promise<void> {
  if (event !== 'price_tick') return;
  
  const { symbol, price } = data || {};
  if (!symbol || typeof price !== 'number') return;
  
  const state = loadState();
  const now = Date.now();
  let hasChanges = false;
  
  // Check targets for this symbol
  for (const target of state.targets) {
    if (target.symbol !== symbol || target.triggered) continue;
    
    if (checkTarget(target, price)) {
      const message = formatAlert(target, price);
      console.log(`[target-hit] ${message}`);
      
      target.triggered = true;
      hasChanges = true;
      
      // Add to history
      state.history.push({
        target: { ...target },
        triggeredAt: now,
        priceAtTrigger: price,
      });
      
      // Keep history manageable
      if (state.history.length > 100) {
        state.history = state.history.slice(-50);
      }
      
      // Suggest action based on type
      if (target.type === 'tp') {
        console.log('[target-hit] 💡 Consider taking profits');
      } else if (target.type === 'sl') {
        console.log('[target-hit] ⚠️ Stop loss triggered - review position');
      }
    }
  }
  
  if (hasChanges) {
    // Remove triggered targets
    state.targets = state.targets.filter(t => !t.triggered);
    state.lastUpdated = now;
    saveState(state);
  }
}

// Helper to add targets programmatically
export function addTarget(target: Omit<PriceTarget, 'id' | 'triggered' | 'createdAt'>): void {
  const state = loadState();
  state.targets.push({
    ...target,
    id: `${target.symbol}-${target.price}-${Date.now()}`,
    triggered: false,
    createdAt: Date.now(),
  });
  saveState(state);
  console.log(`[target-hit] Added ${getLabel(target.type)} for ${target.symbol} at $${target.price}`);
}

export const events = ['price_tick'];
export const name = 'target-hit';
export const description = 'Alerts when price targets or stop losses are hit';
