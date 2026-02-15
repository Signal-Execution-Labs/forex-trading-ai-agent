/**
 * K.I.T. Skill #154: Smart Alert Manager
 * 
 * Advanced alert organization, grouping, and intelligent notification routing
 * Inspired by TradingView's 1000-alert premium tier
 */

import { Skill, SkillContext, SkillResult } from '../types/skill.js';

interface Alert {
  id: string;
  name: string;
  symbol: string;
  condition: AlertCondition;
  priority: 'critical' | 'high' | 'medium' | 'low';
  group?: string;
  tags: string[];
  cooldownMs: number;
  expiresAt?: string;
  channels: NotificationChannel[];
  status: 'active' | 'triggered' | 'paused' | 'expired';
  triggeredCount: number;
  lastTriggered?: string;
  createdAt: string;
}

interface AlertCondition {
  type: 'price_cross' | 'indicator' | 'pattern' | 'volume' | 'time' | 'custom';
  operator: 'above' | 'below' | 'crosses_up' | 'crosses_down' | 'equals' | 'between';
  value: number | [number, number];
  indicator?: string;
  params?: Record<string, any>;
}

interface NotificationChannel {
  type: 'push' | 'email' | 'telegram' | 'discord' | 'webhook' | 'sms';
  target: string;
  template?: string;
}

interface AlertGroup {
  id: string;
  name: string;
  color: string;
  icon: string;
  alerts: string[];
  pauseOnFirstTrigger: boolean;
  maxTriggersPerHour: number;
}

interface SmartAlertConfig {
  maxAlerts: number;
  globalCooldownMs: number;
  quietHours?: { start: string; end: string };
  priorityEscalation: boolean;
  aiSummarization: boolean;
}

export class SmartAlertManager implements Skill {
  name = 'smart-alert-manager';
  description = 'Intelligent alert management with grouping, routing, and AI summarization';
  version = '1.0.0';
  
  private alerts: Map<string, Alert> = new Map();
  private groups: Map<string, AlertGroup> = new Map();
  private config: SmartAlertConfig = {
    maxAlerts: 1000,
    globalCooldownMs: 60000,
    priorityEscalation: true,
    aiSummarization: true
  };
  
  async execute(context: SkillContext): Promise<SkillResult> {
    const { action, ...params } = context.params || {};
    
    switch (action) {
      case 'create':
        return this.createAlert(params);
      case 'list':
        return this.listAlerts(params);
      case 'group':
        return this.manageGroup(params);
      case 'check':
        return this.checkAlerts(params);
      case 'summarize':
        return this.summarizeAlerts(params);
      case 'bulk':
        return this.bulkOperation(params);
      default:
        return this.getStatus();
    }
  }
  
  private createAlert(params: any): SkillResult {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: params.name || 'Unnamed Alert',
      symbol: params.symbol,
      condition: params.condition,
      priority: params.priority || 'medium',
      group: params.group,
      tags: params.tags || [],
      cooldownMs: params.cooldownMs || 300000,
      expiresAt: params.expiresAt,
      channels: params.channels || [{ type: 'push', target: 'default' }],
      status: 'active',
      triggeredCount: 0,
      createdAt: new Date().toISOString()
    };
    
    this.alerts.set(alert.id, alert);
    
    // Add to group if specified
    if (alert.group && this.groups.has(alert.group)) {
      this.groups.get(alert.group)!.alerts.push(alert.id);
    }
    
    return {
      success: true,
      data: alert,
      message: `Alert "${alert.name}" created for ${alert.symbol}`
    };
  }
  
  private listAlerts(params: any): SkillResult {
    let alerts = Array.from(this.alerts.values());
    
    // Filter by status
    if (params.status) {
      alerts = alerts.filter(a => a.status === params.status);
    }
    
    // Filter by symbol
    if (params.symbol) {
      alerts = alerts.filter(a => a.symbol === params.symbol);
    }
    
    // Filter by group
    if (params.group) {
      alerts = alerts.filter(a => a.group === params.group);
    }
    
    // Filter by priority
    if (params.priority) {
      alerts = alerts.filter(a => a.priority === params.priority);
    }
    
    // Filter by tags
    if (params.tags && params.tags.length > 0) {
      alerts = alerts.filter(a => 
        params.tags.some((tag: string) => a.tags.includes(tag))
      );
    }
    
    // Sort
    const sortBy = params.sortBy || 'createdAt';
    alerts.sort((a, b) => {
      if (sortBy === 'priority') {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return {
      success: true,
      data: {
        alerts,
        total: alerts.length,
        byStatus: {
          active: alerts.filter(a => a.status === 'active').length,
          triggered: alerts.filter(a => a.status === 'triggered').length,
          paused: alerts.filter(a => a.status === 'paused').length
        },
        byPriority: {
          critical: alerts.filter(a => a.priority === 'critical').length,
          high: alerts.filter(a => a.priority === 'high').length,
          medium: alerts.filter(a => a.priority === 'medium').length,
          low: alerts.filter(a => a.priority === 'low').length
        }
      }
    };
  }
  
  private manageGroup(params: any): SkillResult {
    if (params.action === 'create') {
      const group: AlertGroup = {
        id: `group_${Date.now()}`,
        name: params.name,
        color: params.color || '#3B82F6',
        icon: params.icon || '📊',
        alerts: [],
        pauseOnFirstTrigger: params.pauseOnFirstTrigger || false,
        maxTriggersPerHour: params.maxTriggersPerHour || 10
      };
      
      this.groups.set(group.id, group);
      
      return {
        success: true,
        data: group,
        message: `Group "${group.name}" created`
      };
    }
    
    if (params.action === 'list') {
      return {
        success: true,
        data: Array.from(this.groups.values())
      };
    }
    
    return { success: false, message: 'Unknown group action' };
  }
  
  private checkAlerts(params: any): SkillResult {
    const { marketData } = params;
    const triggered: Alert[] = [];
    
    for (const alert of this.alerts.values()) {
      if (alert.status !== 'active') continue;
      
      const data = marketData?.[alert.symbol];
      if (!data) continue;
      
      const isTriggered = this.evaluateCondition(alert.condition, data);
      
      if (isTriggered) {
        alert.status = 'triggered';
        alert.triggeredCount++;
        alert.lastTriggered = new Date().toISOString();
        triggered.push(alert);
      }
    }
    
    return {
      success: true,
      data: {
        triggered,
        count: triggered.length
      },
      message: `${triggered.length} alerts triggered`
    };
  }
  
  private evaluateCondition(condition: AlertCondition, data: any): boolean {
    const { type, operator, value } = condition;
    const price = data.price || data.close;
    
    switch (operator) {
      case 'above':
        return price > (value as number);
      case 'below':
        return price < (value as number);
      case 'crosses_up':
        return data.previousClose < (value as number) && price >= (value as number);
      case 'crosses_down':
        return data.previousClose > (value as number) && price <= (value as number);
      case 'between':
        const [min, max] = value as [number, number];
        return price >= min && price <= max;
      default:
        return false;
    }
  }
  
  private summarizeAlerts(params: any): SkillResult {
    const alerts = Array.from(this.alerts.values());
    const triggered = alerts.filter(a => a.status === 'triggered');
    
    // AI-generated summary
    const summary = {
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => a.status === 'active').length,
      triggeredToday: triggered.filter(a => 
        new Date(a.lastTriggered!).toDateString() === new Date().toDateString()
      ).length,
      bySymbol: this.groupBy(alerts, 'symbol'),
      byPriority: this.groupBy(alerts, 'priority'),
      mostActive: [...alerts]
        .sort((a, b) => b.triggeredCount - a.triggeredCount)
        .slice(0, 5),
      aiInsight: this.generateAIInsight(alerts, triggered)
    };
    
    return {
      success: true,
      data: summary,
      message: 'Alert summary generated'
    };
  }
  
  private bulkOperation(params: any): SkillResult {
    const { operation, alertIds, filters } = params;
    let affected = 0;
    
    const targetAlerts = alertIds 
      ? alertIds.map((id: string) => this.alerts.get(id)).filter(Boolean)
      : Array.from(this.alerts.values());
    
    for (const alert of targetAlerts) {
      switch (operation) {
        case 'pause':
          alert.status = 'paused';
          affected++;
          break;
        case 'resume':
          alert.status = 'active';
          affected++;
          break;
        case 'delete':
          this.alerts.delete(alert.id);
          affected++;
          break;
        case 'reset':
          alert.status = 'active';
          alert.triggeredCount = 0;
          alert.lastTriggered = undefined;
          affected++;
          break;
      }
    }
    
    return {
      success: true,
      data: { affected },
      message: `${operation} applied to ${affected} alerts`
    };
  }
  
  private getStatus(): SkillResult {
    const alerts = Array.from(this.alerts.values());
    
    return {
      success: true,
      data: {
        config: this.config,
        stats: {
          total: alerts.length,
          active: alerts.filter(a => a.status === 'active').length,
          triggered: alerts.filter(a => a.status === 'triggered').length,
          paused: alerts.filter(a => a.status === 'paused').length,
          groups: this.groups.size
        },
        capacity: {
          used: alerts.length,
          max: this.config.maxAlerts,
          percentage: (alerts.length / this.config.maxAlerts) * 100
        }
      }
    };
  }
  
  private groupBy(arr: any[], key: string): Record<string, number> {
    return arr.reduce((acc, item) => {
      acc[item[key]] = (acc[item[key]] || 0) + 1;
      return acc;
    }, {});
  }
  
  private generateAIInsight(alerts: Alert[], triggered: Alert[]): string {
    if (triggered.length === 0) {
      return 'No alerts triggered recently. Market conditions are within expected ranges.';
    }
    
    const symbols = [...new Set(triggered.map(a => a.symbol))];
    const priorities = triggered.filter(a => a.priority === 'critical' || a.priority === 'high');
    
    if (priorities.length > 0) {
      return `⚠️ ${priorities.length} high-priority alerts on ${symbols.join(', ')}. Review positions immediately.`;
    }
    
    return `${triggered.length} alerts triggered across ${symbols.length} symbols. Market showing increased activity.`;
  }
}

export default SmartAlertManager;
