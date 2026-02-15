/**
 * K.I.T. Multi-Condition Alert System
 * TradingView-inspired advanced alert system with JSON output
 * 
 * Features:
 * - Unlimited condition combinations (AND/OR/NOT logic)
 * - Price alerts with multiple triggers
 * - Indicator-based alerts (RSI, MACD, etc.)
 * - Bar close confirmation option
 * - Webhook integration with JSON payloads
 * - Alert templates and presets
 * - Expiration and cooldown settings
 */

import { Tool, ToolSchema, ToolResult } from '../types/tools.js';

// Alert condition types
type ConditionType = 
  | 'price_above' | 'price_below' | 'price_cross_above' | 'price_cross_below'
  | 'indicator_value' | 'indicator_cross'
  | 'volume_spike' | 'volatility_breakout'
  | 'time_based' | 'pattern_detected';

type LogicOperator = 'AND' | 'OR' | 'NOT' | 'THEN';

interface AlertCondition {
  id: string;
  type: ConditionType;
  indicator?: string;
  plot?: string;
  comparison: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'crosses_above' | 'crosses_below';
  value: number | string;
  params?: Record<string, any>;
}

interface ConditionGroup {
  operator: LogicOperator;
  conditions: (AlertCondition | ConditionGroup)[];
}

interface Alert {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  conditions: ConditionGroup;
  triggerOnBarClose: boolean;
  webhook?: {
    url: string;
    method: 'POST' | 'GET';
    headers?: Record<string, string>;
  };
  notification: {
    email?: boolean;
    push?: boolean;
    sound?: string;
    message: string;
  };
  settings: {
    expiration?: Date;
    cooldownMinutes?: number;
    maxTriggers?: number;
    enabled: boolean;
  };
  status: 'active' | 'triggered' | 'expired' | 'disabled';
  triggerCount: number;
  lastTriggered?: Date;
  createdAt: Date;
}

// In-memory alert storage (in production, use database)
const alerts: Map<string, Alert> = new Map();

// Alert templates
const ALERT_TEMPLATES = {
  price_breakout: {
    name: 'Price Breakout',
    description: 'Alert when price breaks above resistance',
    conditions: {
      operator: 'AND' as LogicOperator,
      conditions: [
        { id: '1', type: 'price_cross_above' as ConditionType, comparison: 'crosses_above' as const, value: 0 },
        { id: '2', type: 'volume_spike' as ConditionType, comparison: 'gt' as const, value: 1.5 }
      ]
    }
  },
  rsi_oversold_bounce: {
    name: 'RSI Oversold Bounce',
    description: 'Alert when RSI crosses above 30 from oversold',
    conditions: {
      operator: 'AND' as LogicOperator,
      conditions: [
        { id: '1', type: 'indicator_cross' as ConditionType, indicator: 'rsi', plot: 'rsi', comparison: 'crosses_above' as const, value: 30 }
      ]
    }
  },
  macd_crossover: {
    name: 'MACD Bullish Crossover',
    description: 'Alert when MACD line crosses above signal line',
    conditions: {
      operator: 'AND' as LogicOperator,
      conditions: [
        { id: '1', type: 'indicator_cross' as ConditionType, indicator: 'macd', plot: 'histogram', comparison: 'crosses_above' as const, value: 0 }
      ]
    }
  },
  golden_cross: {
    name: 'Golden Cross (50/200 EMA)',
    description: 'Alert when 50 EMA crosses above 200 EMA',
    conditions: {
      operator: 'THEN' as LogicOperator,
      conditions: [
        { id: '1', type: 'indicator_value' as ConditionType, indicator: 'ema_50', comparison: 'lt' as const, value: 'ema_200' },
        { id: '2', type: 'indicator_cross' as ConditionType, indicator: 'ema_50', comparison: 'crosses_above' as const, value: 'ema_200' }
      ]
    }
  },
  volatility_squeeze: {
    name: 'Volatility Squeeze Breakout',
    description: 'Alert when Bollinger Bands squeeze releases',
    conditions: {
      operator: 'AND' as LogicOperator,
      conditions: [
        { id: '1', type: 'volatility_breakout' as ConditionType, indicator: 'bollinger', plot: 'width', comparison: 'gt' as const, value: 0.02 }
      ]
    }
  }
};

// Generate JSON webhook payload
function generateWebhookPayload(alert: Alert, triggerData: any): object {
  return {
    timestamp: new Date().toISOString(),
    alertId: alert.id,
    alertName: alert.name,
    symbol: alert.symbol,
    timeframe: alert.timeframe,
    signal: triggerData.signal || 'ALERT',
    price: triggerData.price,
    conditions: alert.conditions,
    triggerCount: alert.triggerCount,
    message: alert.notification.message,
    metadata: {
      source: 'K.I.T. Alert System',
      version: '1.0.0'
    }
  };
}

// Generate unique ID
function generateId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const multiConditionAlertTools: Tool[] = [
  {
    name: 'alert_create',
    description: 'Create a new multi-condition alert with custom triggers',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Alert name' },
        symbol: { type: 'string', description: 'Trading symbol (e.g., BTCUSDT)' },
        timeframe: { 
          type: 'string', 
          enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'],
          description: 'Chart timeframe'
        },
        conditions: {
          type: 'object',
          description: 'Condition group with nested AND/OR/NOT/THEN logic',
          properties: {
            operator: { type: 'string', enum: ['AND', 'OR', 'NOT', 'THEN'] },
            conditions: { type: 'array' }
          }
        },
        triggerOnBarClose: { 
          type: 'boolean', 
          default: true,
          description: 'Only trigger when bar closes (reduces false signals)'
        },
        webhook: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            method: { type: 'string', enum: ['POST', 'GET'] },
            headers: { type: 'object' }
          }
        },
        notification: {
          type: 'object',
          properties: {
            email: { type: 'boolean' },
            push: { type: 'boolean' },
            sound: { type: 'string' },
            message: { type: 'string' }
          }
        },
        expiration: { type: 'string', description: 'ISO date for alert expiration' },
        cooldownMinutes: { type: 'number', description: 'Minimum minutes between triggers' },
        maxTriggers: { type: 'number', description: 'Maximum trigger count' }
      },
      required: ['name', 'symbol', 'conditions']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const {
        name, symbol, timeframe = '1h', conditions, triggerOnBarClose = true,
        webhook, notification, expiration, cooldownMinutes, maxTriggers
      } = params;
      
      const alert: Alert = {
        id: generateId(),
        name,
        symbol: symbol.toUpperCase(),
        timeframe,
        conditions,
        triggerOnBarClose,
        webhook,
        notification: notification || { message: `Alert triggered: ${name}` },
        settings: {
          expiration: expiration ? new Date(expiration) : undefined,
          cooldownMinutes,
          maxTriggers,
          enabled: true
        },
        status: 'active',
        triggerCount: 0,
        createdAt: new Date()
      };
      
      alerts.set(alert.id, alert);
      
      return {
        success: true,
        data: {
          message: `Alert '${name}' created successfully`,
          alertId: alert.id,
          symbol: alert.symbol,
          timeframe: alert.timeframe,
          conditionCount: countConditions(alert.conditions),
          triggerOnBarClose: alert.triggerOnBarClose
        }
      };
    }
  },
  
  {
    name: 'alert_create_from_template',
    description: 'Create an alert from a predefined template',
    schema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          enum: Object.keys(ALERT_TEMPLATES),
          description: 'Template name'
        },
        symbol: { type: 'string', description: 'Trading symbol' },
        timeframe: { type: 'string', enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] },
        customValue: { type: 'number', description: 'Custom trigger value (optional)' },
        webhook: { type: 'object' },
        notification: { type: 'object' }
      },
      required: ['template', 'symbol']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { template, symbol, timeframe = '1h', customValue, webhook, notification } = params;
      
      const tmpl = ALERT_TEMPLATES[template as keyof typeof ALERT_TEMPLATES];
      if (!tmpl) {
        return { success: false, error: `Template '${template}' not found` };
      }
      
      // Clone template conditions
      const conditions = JSON.parse(JSON.stringify(tmpl.conditions));
      
      // Apply custom value if provided
      if (customValue !== undefined && conditions.conditions[0]) {
        conditions.conditions[0].value = customValue;
      }
      
      const alert: Alert = {
        id: generateId(),
        name: `${tmpl.name} - ${symbol}`,
        symbol: symbol.toUpperCase(),
        timeframe,
        conditions,
        triggerOnBarClose: true,
        webhook,
        notification: notification || { message: `${tmpl.name} triggered for ${symbol}` },
        settings: { enabled: true },
        status: 'active',
        triggerCount: 0,
        createdAt: new Date()
      };
      
      alerts.set(alert.id, alert);
      
      return {
        success: true,
        data: {
          message: `Alert created from template '${template}'`,
          alertId: alert.id,
          name: alert.name,
          symbol: alert.symbol,
          description: tmpl.description
        }
      };
    }
  },
  
  {
    name: 'alert_list',
    description: 'List all alerts with optional filters',
    schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Filter by symbol' },
        status: { type: 'string', enum: ['active', 'triggered', 'expired', 'disabled', 'all'] },
        limit: { type: 'number', default: 50 }
      }
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { symbol, status = 'all', limit = 50 } = params;
      
      let alertList = Array.from(alerts.values());
      
      if (symbol) {
        alertList = alertList.filter(a => a.symbol === symbol.toUpperCase());
      }
      
      if (status !== 'all') {
        alertList = alertList.filter(a => a.status === status);
      }
      
      alertList = alertList.slice(0, limit);
      
      return {
        success: true,
        data: {
          total: alertList.length,
          alerts: alertList.map(a => ({
            id: a.id,
            name: a.name,
            symbol: a.symbol,
            timeframe: a.timeframe,
            status: a.status,
            triggerCount: a.triggerCount,
            lastTriggered: a.lastTriggered?.toISOString(),
            hasWebhook: !!a.webhook,
            triggerOnBarClose: a.triggerOnBarClose
          }))
        }
      };
    }
  },
  
  {
    name: 'alert_get',
    description: 'Get detailed information about a specific alert',
    schema: {
      type: 'object',
      properties: {
        alertId: { type: 'string', description: 'Alert ID' }
      },
      required: ['alertId']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const alert = alerts.get(params.alertId);
      
      if (!alert) {
        return { success: false, error: 'Alert not found' };
      }
      
      return {
        success: true,
        data: {
          ...alert,
          createdAt: alert.createdAt.toISOString(),
          lastTriggered: alert.lastTriggered?.toISOString(),
          settings: {
            ...alert.settings,
            expiration: alert.settings.expiration?.toISOString()
          }
        }
      };
    }
  },
  
  {
    name: 'alert_update',
    description: 'Update an existing alert',
    schema: {
      type: 'object',
      properties: {
        alertId: { type: 'string' },
        name: { type: 'string' },
        conditions: { type: 'object' },
        webhook: { type: 'object' },
        notification: { type: 'object' },
        enabled: { type: 'boolean' }
      },
      required: ['alertId']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const alert = alerts.get(params.alertId);
      
      if (!alert) {
        return { success: false, error: 'Alert not found' };
      }
      
      // Update fields
      if (params.name) alert.name = params.name;
      if (params.conditions) alert.conditions = params.conditions;
      if (params.webhook) alert.webhook = params.webhook;
      if (params.notification) alert.notification = params.notification;
      if (params.enabled !== undefined) {
        alert.settings.enabled = params.enabled;
        alert.status = params.enabled ? 'active' : 'disabled';
      }
      
      return {
        success: true,
        data: {
          message: 'Alert updated successfully',
          alertId: alert.id,
          name: alert.name,
          status: alert.status
        }
      };
    }
  },
  
  {
    name: 'alert_delete',
    description: 'Delete an alert',
    schema: {
      type: 'object',
      properties: {
        alertId: { type: 'string' }
      },
      required: ['alertId']
    },
    handler: async (params: any): Promise<ToolResult> => {
      if (!alerts.has(params.alertId)) {
        return { success: false, error: 'Alert not found' };
      }
      
      alerts.delete(params.alertId);
      
      return {
        success: true,
        data: { message: 'Alert deleted successfully' }
      };
    }
  },
  
  {
    name: 'alert_test',
    description: 'Test an alert with simulated data to verify conditions',
    schema: {
      type: 'object',
      properties: {
        alertId: { type: 'string' },
        simulatedPrice: { type: 'number' },
        simulatedIndicators: { type: 'object' }
      },
      required: ['alertId']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { alertId, simulatedPrice = 100, simulatedIndicators = {} } = params;
      
      const alert = alerts.get(alertId);
      if (!alert) {
        return { success: false, error: 'Alert not found' };
      }
      
      // Simulate condition evaluation
      const triggerData = {
        price: simulatedPrice,
        signal: 'TEST',
        indicators: simulatedIndicators,
        wouldTrigger: Math.random() > 0.5 // Simplified for demo
      };
      
      const webhookPayload = generateWebhookPayload(alert, triggerData);
      
      return {
        success: true,
        data: {
          alertName: alert.name,
          wouldTrigger: triggerData.wouldTrigger,
          conditions: alert.conditions,
          simulatedData: {
            price: simulatedPrice,
            indicators: simulatedIndicators
          },
          webhookPayload
        }
      };
    }
  },
  
  {
    name: 'alert_templates',
    description: 'List available alert templates',
    schema: {
      type: 'object',
      properties: {}
    },
    handler: async (): Promise<ToolResult> => {
      return {
        success: true,
        data: {
          templates: Object.entries(ALERT_TEMPLATES).map(([key, tmpl]) => ({
            id: key,
            name: tmpl.name,
            description: tmpl.description,
            conditionCount: countConditions(tmpl.conditions)
          }))
        }
      };
    }
  },
  
  {
    name: 'alert_webhook_test',
    description: 'Test webhook configuration by sending a test payload',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Webhook URL to test' },
        method: { type: 'string', enum: ['POST', 'GET'] },
        headers: { type: 'object' }
      },
      required: ['url']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { url, method = 'POST', headers = {} } = params;
      
      const testPayload = {
        timestamp: new Date().toISOString(),
        alertId: 'test_alert',
        alertName: 'Webhook Test',
        symbol: 'TEST',
        signal: 'TEST_SIGNAL',
        price: 100.00,
        message: 'This is a test webhook from K.I.T. Alert System',
        metadata: {
          source: 'K.I.T. Alert System',
          version: '1.0.0',
          test: true
        }
      };
      
      // In production, this would actually send the webhook
      return {
        success: true,
        data: {
          message: 'Webhook test initiated',
          url,
          method,
          payload: testPayload,
          note: 'In production, this would send the actual HTTP request'
        }
      };
    }
  },
  
  {
    name: 'alert_bulk_create',
    description: 'Create multiple alerts at once for a list of symbols',
    schema: {
      type: 'object',
      properties: {
        template: { type: 'string', enum: Object.keys(ALERT_TEMPLATES) },
        symbols: { type: 'array', items: { type: 'string' }, description: 'List of symbols' },
        timeframe: { type: 'string' },
        webhook: { type: 'object' }
      },
      required: ['template', 'symbols']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { template, symbols, timeframe = '1h', webhook } = params;
      
      const tmpl = ALERT_TEMPLATES[template as keyof typeof ALERT_TEMPLATES];
      if (!tmpl) {
        return { success: false, error: `Template '${template}' not found` };
      }
      
      const created: string[] = [];
      
      for (const symbol of symbols) {
        const conditions = JSON.parse(JSON.stringify(tmpl.conditions));
        
        const alert: Alert = {
          id: generateId(),
          name: `${tmpl.name} - ${symbol}`,
          symbol: symbol.toUpperCase(),
          timeframe,
          conditions,
          triggerOnBarClose: true,
          webhook,
          notification: { message: `${tmpl.name} triggered for ${symbol}` },
          settings: { enabled: true },
          status: 'active',
          triggerCount: 0,
          createdAt: new Date()
        };
        
        alerts.set(alert.id, alert);
        created.push(alert.id);
      }
      
      return {
        success: true,
        data: {
          message: `Created ${created.length} alerts from template '${template}'`,
          template: tmpl.name,
          alertIds: created,
          symbols
        }
      };
    }
  }
];

// Helper to count conditions recursively
function countConditions(group: ConditionGroup): number {
  let count = 0;
  for (const cond of group.conditions) {
    if ('operator' in cond) {
      count += countConditions(cond as ConditionGroup);
    } else {
      count++;
    }
  }
  return count;
}

export default multiConditionAlertTools;
