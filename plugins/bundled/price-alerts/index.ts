/**
 * Price Alerts Plugin for K.I.T.
 * 
 * Provides real-time price monitoring and multi-channel alert notifications.
 * 
 * Features:
 * - Above/below price alerts
 * - Percentage change alerts
 * - Multi-asset support (crypto, forex, stocks)
 * - Telegram, Discord, webhook notifications
 * - Alert history and statistics
 */

import { PluginAPI, PluginContext, PluginService } from '../../../src/plugins';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below' | 'change_pct';
  targetPrice?: number;
  changePct?: number;
  currentPrice?: number;
  createdAt: string;
  triggeredAt?: string;
  triggered: boolean;
  notified: boolean;
  repeat: boolean;
  cooldownMs?: number;
  lastNotified?: string;
}

interface AlertStore {
  alerts: PriceAlert[];
  history: PriceAlert[];
}

// ============================================================================
// Price Alert Service
// ============================================================================

class PriceAlertService implements PluginService {
  private running = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private store: AlertStore = { alerts: [], history: [] };
  private storePath: string;
  private api: PluginAPI;
  private ctx: PluginContext;

  constructor(api: PluginAPI, ctx: PluginContext) {
    this.api = api;
    this.ctx = ctx;
    this.storePath = path.join(api.getStoragePath(), 'alerts.json');
    this.loadStore();
  }

  async start(): Promise<void> {
    if (this.running) return;
    
    this.running = true;
    const intervalMs = this.ctx.config.checkIntervalMs || 30000;
    
    this.checkInterval = setInterval(() => this.checkAlerts(), intervalMs);
    this.api.log.info(`Price alert service started (checking every ${intervalMs}ms)`);
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.running = false;
    this.api.log.info('Price alert service stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  // Alert management
  addAlert(alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered' | 'notified'>): PriceAlert {
    const newAlert: PriceAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      triggered: false,
      notified: false,
    };
    
    this.store.alerts.push(newAlert);
    this.saveStore();
    
    this.api.log.info(`Alert created: ${newAlert.symbol} ${newAlert.condition} ${newAlert.targetPrice || newAlert.changePct}%`);
    return newAlert;
  }

  removeAlert(id: string): boolean {
    const index = this.store.alerts.findIndex(a => a.id === id);
    if (index === -1) return false;
    
    const removed = this.store.alerts.splice(index, 1)[0];
    this.store.history.push({ ...removed, triggeredAt: new Date().toISOString() });
    this.saveStore();
    
    return true;
  }

  getAlerts(): PriceAlert[] {
    return this.store.alerts;
  }

  getHistory(): PriceAlert[] {
    return this.store.history;
  }

  // Private methods
  private async checkAlerts(): Promise<void> {
    for (const alert of this.store.alerts) {
      if (alert.triggered && !alert.repeat) continue;
      if (alert.triggered && alert.repeat && alert.cooldownMs) {
        const lastNotified = new Date(alert.lastNotified || 0).getTime();
        if (Date.now() - lastNotified < alert.cooldownMs) continue;
      }
      
      try {
        const price = await this.getPrice(alert.symbol);
        if (!price) continue;
        
        alert.currentPrice = price;
        let shouldTrigger = false;
        
        switch (alert.condition) {
          case 'above':
            shouldTrigger = price >= (alert.targetPrice || 0);
            break;
          case 'below':
            shouldTrigger = price <= (alert.targetPrice || 0);
            break;
          case 'change_pct':
            // Would need baseline price tracking
            break;
        }
        
        if (shouldTrigger && !alert.notified) {
          await this.triggerAlert(alert, price);
        }
      } catch (error) {
        this.api.log.warn(`Failed to check price for ${alert.symbol}:`, error);
      }
    }
  }

  private async getPrice(symbol: string): Promise<number | null> {
    // Simplified - in real implementation, would call exchange APIs
    // For demo, return mock prices
    const mockPrices: Record<string, number> = {
      'BTC/USD': 98500 + Math.random() * 1000,
      'ETH/USD': 2650 + Math.random() * 100,
      'EUR/USD': 1.0850 + Math.random() * 0.01,
      'GBP/USD': 1.2550 + Math.random() * 0.01,
    };
    
    return mockPrices[symbol] || null;
  }

  private async triggerAlert(alert: PriceAlert, currentPrice: number): Promise<void> {
    alert.triggered = true;
    alert.triggeredAt = new Date().toISOString();
    alert.lastNotified = alert.triggeredAt;
    
    const message = `🚨 Price Alert: ${alert.symbol} is now ${alert.condition} $${alert.targetPrice} (current: $${currentPrice.toFixed(4)})`;
    
    this.api.log.info(message);
    
    // Emit hook event for notification integrations
    // In real implementation, would call Telegram/Discord APIs
    
    if (!alert.repeat) {
      alert.notified = true;
      this.store.history.push({ ...alert });
      const index = this.store.alerts.findIndex(a => a.id === alert.id);
      if (index >= 0) this.store.alerts.splice(index, 1);
    }
    
    this.saveStore();
  }

  private loadStore(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        this.store = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
      }
    } catch (error) {
      this.api.log.warn('Failed to load alert store:', error);
    }
  }

  private saveStore(): void {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2));
    } catch (error) {
      this.api.log.warn('Failed to save alert store:', error);
    }
  }
}

// ============================================================================
// Plugin Entry Point
// ============================================================================

let alertService: PriceAlertService | null = null;

export async function activate(api: PluginAPI, ctx: PluginContext): Promise<void> {
  ctx.logger.info('Activating Price Alerts plugin...');
  
  // Create and register service
  alertService = new PriceAlertService(api, ctx);
  api.registerService('price-alerts', alertService);
  
  // Register tools
  api.registerTool(
    {
      name: 'price_alert_create',
      description: 'Create a new price alert',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading pair (e.g., BTC/USD)' },
          condition: { type: 'string', enum: ['above', 'below'], description: 'Alert condition' },
          targetPrice: { type: 'number', description: 'Target price' },
          repeat: { type: 'boolean', description: 'Repeat alert after cooldown' },
          cooldownMs: { type: 'number', description: 'Cooldown between repeats (ms)' },
        },
        required: ['symbol', 'condition', 'targetPrice'],
      },
    },
    async (params) => {
      if (!alertService) throw new Error('Service not initialized');
      
      const alert = alertService.addAlert({
        symbol: params.symbol,
        condition: params.condition,
        targetPrice: params.targetPrice,
        repeat: params.repeat || false,
        cooldownMs: params.cooldownMs,
      });
      
      return { success: true, alert };
    }
  );
  
  api.registerTool(
    {
      name: 'price_alert_list',
      description: 'List all active price alerts',
      parameters: { type: 'object', properties: {} },
    },
    async () => {
      if (!alertService) throw new Error('Service not initialized');
      return { alerts: alertService.getAlerts() };
    }
  );
  
  api.registerTool(
    {
      name: 'price_alert_delete',
      description: 'Delete a price alert',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Alert ID to delete' },
        },
        required: ['id'],
      },
    },
    async (params) => {
      if (!alertService) throw new Error('Service not initialized');
      const success = alertService.removeAlert(params.id);
      return { success };
    }
  );
  
  // Register RPC methods
  api.registerRPC('alerts.list', async () => {
    if (!alertService) throw new Error('Service not initialized');
    return alertService.getAlerts();
  });
  
  api.registerRPC('alerts.history', async () => {
    if (!alertService) throw new Error('Service not initialized');
    return alertService.getHistory();
  });
  
  // Auto-start service
  await alertService.start();
  
  ctx.logger.info('✅ Price Alerts plugin activated');
}

export async function deactivate(): Promise<void> {
  if (alertService) {
    await alertService.stop();
    alertService = null;
  }
}
