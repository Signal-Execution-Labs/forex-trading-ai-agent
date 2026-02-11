import { getDatabase } from '../db/database.ts';
import { v4 as uuidv4 } from 'uuid';

export interface Alert {
  id: string;
  agent_id: string;
  name: string;
  
  // Alert Conditions
  symbol: string;
  condition_type: 'price_above' | 'price_below' | 'price_cross' | 'rsi_above' | 'rsi_below' | 'macd_cross' | 'ema_cross' | 'volume_spike' | 'custom';
  threshold: number;
  secondary_threshold?: number; // For cross conditions (e.g., EMA 12 crosses EMA 26)
  timeframe?: string; // '1m', '5m', '15m', '1h', '4h', '1d'
  
  // Alert Settings
  message?: string;
  webhook_url?: string;
  notification_types: ('platform' | 'webhook' | 'signal')[];
  auto_create_signal?: boolean;
  signal_direction?: 'long' | 'short';
  
  // Frequency
  frequency: 'once' | 'every_time' | 'once_per_bar';
  expiry_time?: string; // ISO date
  cooldown_minutes?: number; // Min time between alerts
  
  // State
  status: 'active' | 'paused' | 'triggered' | 'expired';
  last_triggered?: string;
  trigger_count: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface AlertLog {
  id: string;
  alert_id: string;
  agent_id: string;
  
  // Trigger Data
  triggered_at: string;
  trigger_price: number;
  trigger_value?: number; // For indicator-based alerts
  
  // Actions Taken
  signal_created?: string; // Signal ID if auto-created
  webhook_response?: string;
  notification_sent: boolean;
}

export class AlertService {
  // ========== ALERTS ==========
  
  static create(data: Partial<Alert> & { agent_id: string; symbol: string; condition_type: Alert['condition_type']; threshold: number }): Alert {
    const db = getDatabase();
    const alerts = db.get('alerts') || [];
    
    const alert: Alert = {
      id: uuidv4(),
      agent_id: data.agent_id,
      name: data.name || `${data.symbol} ${data.condition_type} ${data.threshold}`,
      symbol: data.symbol.toUpperCase(),
      condition_type: data.condition_type,
      threshold: data.threshold,
      secondary_threshold: data.secondary_threshold,
      timeframe: data.timeframe || '1h',
      message: data.message,
      webhook_url: data.webhook_url,
      notification_types: data.notification_types || ['platform'],
      auto_create_signal: data.auto_create_signal || false,
      signal_direction: data.signal_direction,
      frequency: data.frequency || 'once',
      expiry_time: data.expiry_time,
      cooldown_minutes: data.cooldown_minutes,
      status: 'active',
      trigger_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    alerts.push(alert);
    db.set('alerts', alerts);
    db.write();
    
    return alert;
  }
  
  static getById(id: string): Alert | undefined {
    const db = getDatabase();
    const alerts = db.get('alerts') || [];
    return alerts.find((a: Alert) => a.id === id);
  }
  
  static listByAgent(agentId: string, options: { status?: string; symbol?: string } = {}): Alert[] {
    const db = getDatabase();
    const alerts = db.get('alerts') || [];
    
    return alerts.filter((a: Alert) => {
      if (a.agent_id !== agentId) return false;
      if (options.status && a.status !== options.status) return false;
      if (options.symbol && a.symbol !== options.symbol.toUpperCase()) return false;
      return true;
    });
  }
  
  static update(id: string, agentId: string, data: Partial<Alert>): Alert | null {
    const db = getDatabase();
    const alerts = db.get('alerts') || [];
    const idx = alerts.findIndex((a: Alert) => a.id === id && a.agent_id === agentId);
    
    if (idx === -1) return null;
    
    const { id: _, agent_id: __, created_at: ___, ...updateFields } = data;
    alerts[idx] = {
      ...alerts[idx],
      ...updateFields,
      updated_at: new Date().toISOString(),
    };
    
    db.set('alerts', alerts);
    db.write();
    
    return alerts[idx];
  }
  
  static delete(id: string, agentId: string): boolean {
    const db = getDatabase();
    const alerts = db.get('alerts') || [];
    const idx = alerts.findIndex((a: Alert) => a.id === id && a.agent_id === agentId);
    
    if (idx === -1) return false;
    
    alerts.splice(idx, 1);
    db.set('alerts', alerts);
    db.write();
    
    return true;
  }
  
  static trigger(id: string, triggerData: { price: number; value?: number }): AlertLog | null {
    const db = getDatabase();
    const alerts = db.get('alerts') || [];
    const alertLogs = db.get('alert_logs') || [];
    
    const alertIdx = alerts.findIndex((a: Alert) => a.id === id);
    if (alertIdx === -1) return null;
    
    const alert = alerts[alertIdx];
    
    // Check cooldown
    if (alert.cooldown_minutes && alert.last_triggered) {
      const lastTrigger = new Date(alert.last_triggered).getTime();
      const cooldownMs = alert.cooldown_minutes * 60 * 1000;
      if (Date.now() - lastTrigger < cooldownMs) {
        return null; // Still in cooldown
      }
    }
    
    // Create log
    const log: AlertLog = {
      id: uuidv4(),
      alert_id: id,
      agent_id: alert.agent_id,
      triggered_at: new Date().toISOString(),
      trigger_price: triggerData.price,
      trigger_value: triggerData.value,
      notification_sent: true,
    };
    
    alertLogs.push(log);
    
    // Update alert
    alerts[alertIdx].last_triggered = log.triggered_at;
    alerts[alertIdx].trigger_count += 1;
    
    if (alert.frequency === 'once') {
      alerts[alertIdx].status = 'triggered';
    }
    
    db.set('alerts', alerts);
    db.set('alert_logs', alertLogs);
    db.write();
    
    return log;
  }
  
  static getLogs(alertId: string, limit: number = 50): AlertLog[] {
    const db = getDatabase();
    const logs = db.get('alert_logs') || [];
    
    return logs
      .filter((l: AlertLog) => l.alert_id === alertId)
      .sort((a: AlertLog, b: AlertLog) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime())
      .slice(0, limit);
  }
  
  // ========== BULK OPERATIONS ==========
  
  static pauseAll(agentId: string): number {
    const db = getDatabase();
    const alerts = db.get('alerts') || [];
    let count = 0;
    
    for (const alert of alerts) {
      if (alert.agent_id === agentId && alert.status === 'active') {
        alert.status = 'paused';
        alert.updated_at = new Date().toISOString();
        count++;
      }
    }
    
    db.set('alerts', alerts);
    db.write();
    
    return count;
  }
  
  static resumeAll(agentId: string): number {
    const db = getDatabase();
    const alerts = db.get('alerts') || [];
    let count = 0;
    
    for (const alert of alerts) {
      if (alert.agent_id === agentId && alert.status === 'paused') {
        alert.status = 'active';
        alert.updated_at = new Date().toISOString();
        count++;
      }
    }
    
    db.set('alerts', alerts);
    db.write();
    
    return count;
  }
  
  // ========== CONDITION PRESETS ==========
  
  static getConditionTypes(): { type: string; name: string; description: string; requires_secondary: boolean }[] {
    return [
      { type: 'price_above', name: 'Price Above', description: 'Trigger when price crosses above threshold', requires_secondary: false },
      { type: 'price_below', name: 'Price Below', description: 'Trigger when price crosses below threshold', requires_secondary: false },
      { type: 'price_cross', name: 'Price Cross', description: 'Trigger when price crosses threshold (either direction)', requires_secondary: false },
      { type: 'rsi_above', name: 'RSI Above', description: 'Trigger when RSI exceeds threshold (overbought)', requires_secondary: false },
      { type: 'rsi_below', name: 'RSI Below', description: 'Trigger when RSI drops below threshold (oversold)', requires_secondary: false },
      { type: 'macd_cross', name: 'MACD Cross', description: 'Trigger when MACD line crosses signal line', requires_secondary: false },
      { type: 'ema_cross', name: 'EMA Cross', description: 'Trigger when fast EMA crosses slow EMA', requires_secondary: true },
      { type: 'volume_spike', name: 'Volume Spike', description: 'Trigger when volume exceeds X times average', requires_secondary: false },
      { type: 'custom', name: 'Custom Condition', description: 'Custom KitScript expression', requires_secondary: false },
    ];
  }
}
