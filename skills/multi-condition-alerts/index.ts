/**
 * Multi-Condition Alert Builder Skill
 * 
 * Build complex trading alerts with unlimited conditions and nested logic.
 * Inspired by TradingView (5 conditions max) - K.I.T. has no limits!
 */

export * from './multi-condition-alerts';

import { AlertBuilder, AlertManager, AlertAI, alertManager, alertAI } from './multi-condition-alerts';

// Quick access functions
export async function createAlert(config: {
  name: string;
  symbol?: string;
  watchlist?: string[];
  conditions: unknown[];
  actions: unknown[];
}): Promise<string> {
  const builder = new AlertBuilder();
  builder.name(config.name);
  if (config.symbol) builder.symbol(config.symbol);
  if (config.watchlist) builder.watchlist(config.watchlist);
  
  // Build from config...
  const alert = builder.build();
  return alertManager.create(alert);
}

export async function createAlertFromDescription(description: string, symbol: string): Promise<string> {
  const conditions = await alertAI.suggestConditions(description);
  const builder = new AlertBuilder()
    .name(`AI Alert: ${description.substring(0, 30)}...`)
    .symbol(symbol);
  
  // Apply AI-suggested conditions
  const alert = builder.build();
  alert.logic = conditions;
  
  return alertManager.create(alert);
}

export async function listAlerts(): Promise<unknown[]> {
  return alertManager.list();
}

export async function pauseAlert(id: string): Promise<void> {
  return alertManager.pause(id);
}

export async function resumeAlert(id: string): Promise<void> {
  return alertManager.activate(id);
}

export async function deleteAlert(id: string): Promise<void> {
  return alertManager.delete(id);
}

export async function backtestAlert(id: string, days: number = 30): Promise<unknown> {
  return alertManager.backtest(id, { days });
}

// Default exports
export { AlertBuilder, AlertManager, AlertAI, alertManager, alertAI };
