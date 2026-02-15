/**
 * Price Alert Hook
 * 
 * Monitors price levels and sends alerts when targets are hit.
 */

import type { HookHandler, HookContext } from '../../types.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface PriceAlert {
  id?: string;
  symbol: string;
  condition: 'above' | 'below' | 'cross' | 'percent_up' | 'percent_down';
  price: number;
  entryPrice?: number; // For percentage conditions
  message?: string;
  repeat?: boolean;
  triggered?: boolean;
  lastTriggered?: number;
  cooldownMs?: number; // Cooldown between repeat alerts
}

interface AlertConfig {
  alerts: PriceAlert[];
  defaultCooldownMs?: number;
}

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

// In-memory cache of last known prices
const lastPrices: Map<string, number> = new Map();

const priceAlertHandler: HookHandler = async (context: HookContext) => {
  // Handle price update events
  if (context.event !== 'market:tick') {
    return;
  }
  
  try {
    const workspaceDir = context.context.workspaceDir || join(process.cwd(), 'workspace');
    const configPath = join(workspaceDir, 'price-alerts.json');
    
    let config: AlertConfig;
    try {
      const content = await readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      // No alerts configured
      return;
    }
    
    if (!config.alerts || config.alerts.length === 0) {
      return;
    }
    
    // Get price data from event
    const priceData = context.data as PriceUpdate | undefined;
    if (!priceData?.symbol || typeof priceData.price !== 'number') {
      return;
    }
    
    const { symbol, price } = priceData;
    const previousPrice = lastPrices.get(symbol);
    lastPrices.set(symbol, price);
    
    const triggeredAlerts: string[] = [];
    const now = Date.now();
    const defaultCooldown = config.defaultCooldownMs || 60000; // 1 minute default
    
    for (const alert of config.alerts) {
      if (alert.symbol.toUpperCase() !== symbol.toUpperCase()) {
        continue;
      }
      
      // Check cooldown for repeat alerts
      if (alert.triggered && alert.repeat) {
        const cooldown = alert.cooldownMs || defaultCooldown;
        if (alert.lastTriggered && (now - alert.lastTriggered) < cooldown) {
          continue;
        }
      }
      
      // Skip non-repeat alerts that already triggered
      if (alert.triggered && !alert.repeat) {
        continue;
      }
      
      let shouldTrigger = false;
      
      switch (alert.condition) {
        case 'above':
          shouldTrigger = price >= alert.price && (previousPrice === undefined || previousPrice < alert.price);
          break;
          
        case 'below':
          shouldTrigger = price <= alert.price && (previousPrice === undefined || previousPrice > alert.price);
          break;
          
        case 'cross':
          if (previousPrice !== undefined) {
            shouldTrigger = (price >= alert.price && previousPrice < alert.price) ||
                           (price <= alert.price && previousPrice > alert.price);
          }
          break;
          
        case 'percent_up':
          if (alert.entryPrice) {
            const targetPrice = alert.entryPrice * (1 + alert.price / 100);
            shouldTrigger = price >= targetPrice;
          }
          break;
          
        case 'percent_down':
          if (alert.entryPrice) {
            const targetPrice = alert.entryPrice * (1 - alert.price / 100);
            shouldTrigger = price <= targetPrice;
          }
          break;
      }
      
      if (shouldTrigger) {
        alert.triggered = true;
        alert.lastTriggered = now;
        
        const message = alert.message || 
          `🎯 Price Alert: ${symbol} ${alert.condition} ${alert.price} (current: ${price.toFixed(6)})`;
        
        triggeredAlerts.push(message);
        
        // Log the alert
        console.log(`[price-alert] ${message}`);
      }
    }
    
    // Save updated config with triggered states
    if (triggeredAlerts.length > 0) {
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      
      // Add messages to context for notification
      context.messages.push(...triggeredAlerts);
    }
    
  } catch (error) {
    console.error('[price-alert] Error:', error);
  }
};

export default priceAlertHandler;
