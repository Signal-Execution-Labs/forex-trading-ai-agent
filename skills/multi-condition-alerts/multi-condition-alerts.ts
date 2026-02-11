/**
 * Multi-Condition Alert Builder
 * 
 * Inspired by TradingView's advanced alerts (5 conditions)
 * K.I.T. supports unlimited conditions with nested AND/OR/THEN logic
 */

// ============== Types ==============

export type ConditionType = 
  | 'price' | 'indicator' | 'drawing' | 'pattern' 
  | 'volume' | 'time' | 'spread' | 'correlation';

export type ComparisonOperator = 
  | 'above' | 'below' | 'crosses_above' | 'crosses_below'
  | 'equals' | 'between' | 'outside';

export type LogicalOperator = 'AND' | 'OR' | 'NOT' | 'THEN';

export interface Condition {
  type: ConditionType;
  symbol?: string;
  timeframe?: string;
  indicator?: string;
  period?: number;
  condition: ComparisonOperator | string;
  value?: number | string;
  value2?: number; // For "between" conditions
  multiplier?: number;
  pattern?: string;
  symbol1?: string;
  symbol2?: string;
}

export interface ConditionGroup {
  operator: LogicalOperator;
  conditions: (Condition | ConditionGroup)[];
  windowMs?: number; // For THEN operator - max time between conditions
}

export interface AlertAction {
  type: 'webhook' | 'telegram' | 'discord' | 'email' | 'sms' | 'popup';
  url?: string;
  payload?: Record<string, unknown>;
  message?: string;
  channel?: string;
  to?: string;
}

export interface Alert {
  id?: string;
  name: string;
  symbol?: string;
  watchlist?: string[];
  logic: ConditionGroup;
  actions: AlertAction[];
  enabled: boolean;
  createdAt?: Date;
  lastTriggered?: Date;
  triggerCount?: number;
}

export interface BacktestResult {
  alertId: string;
  period: { start: Date; end: Date };
  triggerCount: number;
  triggers: { timestamp: Date; price: number; conditions: string[] }[];
  avgTimeBetweenTriggers: number;
  winRate?: number; // If price data available
  avgReturn?: number;
  falsePositiveEstimate: number;
}

// ============== Condition Evaluators ==============

export class ConditionEvaluator {
  private marketData: Map<string, MarketSnapshot> = new Map();
  private indicatorCache: Map<string, number> = new Map();

  async evaluate(condition: Condition | ConditionGroup, context: EvaluationContext): Promise<boolean> {
    if ('operator' in condition) {
      return this.evaluateGroup(condition, context);
    }
    return this.evaluateSingle(condition, context);
  }

  private async evaluateGroup(group: ConditionGroup, context: EvaluationContext): Promise<boolean> {
    switch (group.operator) {
      case 'AND':
        for (const cond of group.conditions) {
          if (!(await this.evaluate(cond, context))) return false;
        }
        return true;

      case 'OR':
        for (const cond of group.conditions) {
          if (await this.evaluate(cond, context)) return true;
        }
        return false;

      case 'NOT':
        if (group.conditions.length !== 1) {
          throw new Error('NOT operator requires exactly one condition');
        }
        return !(await this.evaluate(group.conditions[0], context));

      case 'THEN':
        return this.evaluateSequential(group, context);

      default:
        throw new Error(`Unknown operator: ${group.operator}`);
    }
  }

  private async evaluateSequential(group: ConditionGroup, context: EvaluationContext): Promise<boolean> {
    const windowMs = group.windowMs || 3600000; // Default 1 hour
    const now = Date.now();
    
    // Check if first condition was met within window
    const firstCondition = group.conditions[0];
    const firstMet = context.conditionHistory.find(h => 
      h.conditionHash === this.hashCondition(firstCondition) &&
      now - h.timestamp < windowMs
    );

    if (!firstMet) {
      // Check if first condition is currently true
      if (await this.evaluate(firstCondition, context)) {
        context.conditionHistory.push({
          conditionHash: this.hashCondition(firstCondition),
          timestamp: now
        });
      }
      return false;
    }

    // First was met, check subsequent conditions
    for (let i = 1; i < group.conditions.length; i++) {
      if (!(await this.evaluate(group.conditions[i], context))) {
        return false;
      }
    }

    return true;
  }

  private async evaluateSingle(condition: Condition, context: EvaluationContext): Promise<boolean> {
    const symbol = condition.symbol || context.defaultSymbol;
    if (!symbol) throw new Error('No symbol specified');

    switch (condition.type) {
      case 'price':
        return this.evaluatePrice(condition, symbol);
      case 'indicator':
        return this.evaluateIndicator(condition, symbol);
      case 'volume':
        return this.evaluateVolume(condition, symbol);
      case 'pattern':
        return this.evaluatePattern(condition, symbol);
      case 'spread':
        return this.evaluateSpread(condition);
      case 'time':
        return this.evaluateTime(condition);
      default:
        throw new Error(`Unknown condition type: ${condition.type}`);
    }
  }

  private async evaluatePrice(condition: Condition, symbol: string): Promise<boolean> {
    const snapshot = await this.getMarketData(symbol);
    const price = snapshot.price;
    const value = typeof condition.value === 'number' ? condition.value : parseFloat(condition.value as string);

    switch (condition.condition) {
      case 'above':
        return price > value;
      case 'below':
        return price < value;
      case 'crosses_above':
        return snapshot.previousPrice <= value && price > value;
      case 'crosses_below':
        return snapshot.previousPrice >= value && price < value;
      case 'between':
        return price >= value && price <= (condition.value2 || value);
      default:
        return false;
    }
  }

  private async evaluateIndicator(condition: Condition, symbol: string): Promise<boolean> {
    const indicator = condition.indicator?.toUpperCase();
    const timeframe = condition.timeframe || '1H';
    const period = condition.period || 14;

    const value = await this.getIndicatorValue(symbol, indicator!, timeframe, period);
    const threshold = typeof condition.value === 'number' ? condition.value : parseFloat(condition.value as string || '0');

    switch (condition.condition) {
      case 'above':
      case 'price_above':
        return value > threshold;
      case 'below':
      case 'oversold':
        return value < threshold;
      case 'crosses_above':
      case 'oversold_cross':
        const prevValue = await this.getIndicatorValue(symbol, indicator!, timeframe, period, 1);
        return prevValue <= threshold && value > threshold;
      case 'histogram_positive':
        return value > 0;
      case 'histogram_negative':
        return value < 0;
      default:
        return false;
    }
  }

  private async evaluateVolume(condition: Condition, symbol: string): Promise<boolean> {
    const snapshot = await this.getMarketData(symbol);
    const volume = snapshot.volume;
    const avgVolume = snapshot.avgVolume || volume;
    const multiplier = condition.multiplier || 1;

    switch (condition.condition) {
      case 'above':
        const threshold = typeof condition.value === 'number' ? condition.value : avgVolume * multiplier;
        return volume > threshold;
      case 'above_average':
        return volume > avgVolume * multiplier;
      case 'below_average':
        return volume < avgVolume * multiplier;
      default:
        return false;
    }
  }

  private async evaluatePattern(condition: Condition, symbol: string): Promise<boolean> {
    // Pattern recognition would use candlestick analysis
    const pattern = condition.pattern?.toLowerCase();
    const snapshot = await this.getMarketData(symbol);
    
    // Simplified pattern detection - real implementation would be more sophisticated
    switch (pattern) {
      case 'bullish_divergence':
        // Price making lower lows but indicator making higher lows
        return snapshot.patterns?.includes('bullish_divergence') || false;
      case 'bearish_divergence':
        return snapshot.patterns?.includes('bearish_divergence') || false;
      case 'double_bottom':
        return snapshot.patterns?.includes('double_bottom') || false;
      case 'double_top':
        return snapshot.patterns?.includes('double_top') || false;
      case 'breakout':
        return snapshot.patterns?.includes('breakout') || false;
      default:
        return false;
    }
  }

  private async evaluateSpread(condition: Condition): Promise<boolean> {
    if (!condition.symbol1 || !condition.symbol2) {
      throw new Error('Spread condition requires symbol1 and symbol2');
    }

    const snap1 = await this.getMarketData(condition.symbol1);
    const snap2 = await this.getMarketData(condition.symbol2);
    const ratio = snap1.price / snap2.price;
    const value = typeof condition.value === 'number' ? condition.value : parseFloat(condition.value as string);

    switch (condition.condition) {
      case 'above':
        return ratio > value;
      case 'below':
        return ratio < value;
      default:
        return false;
    }
  }

  private evaluateTime(condition: Condition): boolean {
    const now = new Date();
    // Time-based conditions (session filters, weekday filters, etc.)
    // Implementation depends on condition.value format
    return true;
  }

  // Helper methods
  private async getMarketData(symbol: string): Promise<MarketSnapshot> {
    // Would fetch from exchange API or cache
    return this.marketData.get(symbol) || {
      symbol,
      price: 0,
      previousPrice: 0,
      volume: 0,
      avgVolume: 0,
      patterns: []
    };
  }

  private async getIndicatorValue(
    symbol: string, 
    indicator: string, 
    timeframe: string, 
    period: number,
    barsBack: number = 0
  ): Promise<number> {
    const cacheKey = `${symbol}:${indicator}:${timeframe}:${period}:${barsBack}`;
    if (this.indicatorCache.has(cacheKey)) {
      return this.indicatorCache.get(cacheKey)!;
    }
    // Would calculate or fetch from TradingView API
    return 0;
  }

  private hashCondition(condition: Condition | ConditionGroup): string {
    return JSON.stringify(condition);
  }

  updateMarketData(symbol: string, snapshot: MarketSnapshot): void {
    this.marketData.set(symbol, snapshot);
  }
}

interface MarketSnapshot {
  symbol: string;
  price: number;
  previousPrice: number;
  volume: number;
  avgVolume?: number;
  patterns?: string[];
}

interface EvaluationContext {
  defaultSymbol?: string;
  conditionHistory: { conditionHash: string; timestamp: number }[];
}

// ============== Alert Builder (Fluent API) ==============

export class AlertBuilder {
  private alert: Partial<Alert> = {
    enabled: true,
    actions: []
  };
  private currentGroup: ConditionGroup = { operator: 'AND', conditions: [] };
  private pendingCondition: Partial<Condition> = {};

  name(name: string): AlertBuilder {
    this.alert.name = name;
    return this;
  }

  symbol(symbol: string): AlertBuilder {
    this.alert.symbol = symbol;
    return this;
  }

  watchlist(symbols: string[]): AlertBuilder {
    this.alert.watchlist = symbols;
    return this;
  }

  when(indicator: string, options?: { period?: number; timeframe?: string }): AlertBuilder {
    this.flushPendingCondition();
    this.pendingCondition = {
      type: 'indicator',
      indicator,
      period: options?.period,
      timeframe: options?.timeframe
    };
    return this;
  }

  price(): AlertBuilder {
    this.flushPendingCondition();
    this.pendingCondition = { type: 'price' };
    return this;
  }

  volume(): AlertBuilder {
    this.flushPendingCondition();
    this.pendingCondition = { type: 'volume' };
    return this;
  }

  above(value: number): AlertBuilder {
    this.pendingCondition.condition = 'above';
    this.pendingCondition.value = value;
    return this;
  }

  below(value: number): AlertBuilder {
    this.pendingCondition.condition = 'below';
    this.pendingCondition.value = value;
    return this;
  }

  crossesAbove(value: number | string): AlertBuilder {
    this.pendingCondition.condition = 'crosses_above';
    this.pendingCondition.value = value;
    return this;
  }

  crossesBelow(value: number | string): AlertBuilder {
    this.pendingCondition.condition = 'crosses_below';
    this.pendingCondition.value = value;
    return this;
  }

  aboveAverage(multiplier: number = 1): AlertBuilder {
    this.pendingCondition.condition = 'above_average';
    this.pendingCondition.multiplier = multiplier;
    return this;
  }

  and(indicator?: string, options?: { period?: number }): AlertBuilder {
    this.flushPendingCondition();
    if (indicator) {
      this.pendingCondition = {
        type: 'indicator',
        indicator,
        period: options?.period
      };
    }
    return this;
  }

  or(indicator?: string, options?: { period?: number }): AlertBuilder {
    this.flushPendingCondition();
    // Create OR group
    const existingConditions = this.currentGroup.conditions;
    this.currentGroup = {
      operator: 'OR',
      conditions: [{ operator: 'AND', conditions: existingConditions }]
    };
    if (indicator) {
      this.pendingCondition = {
        type: 'indicator',
        indicator,
        period: options?.period
      };
    }
    return this;
  }

  then(): AlertBuilder {
    this.flushPendingCondition();
    return this;
  }

  webhook(url: string, payload?: Record<string, unknown>): AlertBuilder {
    this.alert.actions!.push({ type: 'webhook', url, payload });
    return this;
  }

  telegram(message: string, channel?: string): AlertBuilder {
    this.alert.actions!.push({ type: 'telegram', message, channel });
    return this;
  }

  discord(message: string, channel?: string): AlertBuilder {
    this.alert.actions!.push({ type: 'discord', message, channel });
    return this;
  }

  email(message: string, to?: string): AlertBuilder {
    this.alert.actions!.push({ type: 'email', message, to });
    return this;
  }

  build(): Alert {
    this.flushPendingCondition();
    this.alert.logic = this.currentGroup;
    return this.alert as Alert;
  }

  private flushPendingCondition(): void {
    if (this.pendingCondition.type) {
      this.currentGroup.conditions.push(this.pendingCondition as Condition);
      this.pendingCondition = {};
    }
  }
}

// ============== Alert Manager ==============

export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private evaluator: ConditionEvaluator;
  private contexts: Map<string, EvaluationContext> = new Map();
  private checkInterval?: NodeJS.Timeout;

  constructor() {
    this.evaluator = new ConditionEvaluator();
  }

  async create(alert: Alert): Promise<string> {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    alert.id = id;
    alert.createdAt = new Date();
    alert.triggerCount = 0;
    this.alerts.set(id, alert);
    this.contexts.set(id, { conditionHistory: [] });
    return id;
  }

  async activate(id: string): Promise<void> {
    const alert = this.alerts.get(id);
    if (!alert) throw new Error(`Alert not found: ${id}`);
    alert.enabled = true;
  }

  async pause(id: string): Promise<void> {
    const alert = this.alerts.get(id);
    if (!alert) throw new Error(`Alert not found: ${id}`);
    alert.enabled = false;
  }

  async delete(id: string): Promise<void> {
    this.alerts.delete(id);
    this.contexts.delete(id);
  }

  list(): Alert[] {
    return Array.from(this.alerts.values());
  }

  startMonitoring(intervalMs: number = 1000): void {
    this.checkInterval = setInterval(() => this.checkAllAlerts(), intervalMs);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private async checkAllAlerts(): Promise<void> {
    for (const [id, alert] of this.alerts) {
      if (!alert.enabled) continue;

      const context = this.contexts.get(id) || { conditionHistory: [] };
      context.defaultSymbol = alert.symbol;

      const symbols = alert.watchlist || (alert.symbol ? [alert.symbol] : []);
      
      for (const symbol of symbols) {
        context.defaultSymbol = symbol;
        
        try {
          const triggered = await this.evaluator.evaluate(alert.logic, context);
          
          if (triggered) {
            await this.executeActions(alert, symbol);
            alert.lastTriggered = new Date();
            alert.triggerCount = (alert.triggerCount || 0) + 1;
          }
        } catch (error) {
          console.error(`Error checking alert ${id}:`, error);
        }
      }
    }
  }

  private async executeActions(alert: Alert, triggeredSymbol: string): Promise<void> {
    for (const action of alert.actions) {
      const message = this.interpolateMessage(action.message || '', {
        symbol: triggeredSymbol,
        alert_name: alert.name,
        timestamp: new Date().toISOString()
      });

      switch (action.type) {
        case 'webhook':
          await this.sendWebhook(action.url!, { ...action.payload, symbol: triggeredSymbol });
          break;
        case 'telegram':
          await this.sendTelegram(message, action.channel);
          break;
        case 'discord':
          await this.sendDiscord(message, action.channel);
          break;
        case 'email':
          await this.sendEmail(message, action.to);
          break;
      }
    }
  }

  private interpolateMessage(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
  }

  private async sendWebhook(url: string, payload: unknown): Promise<void> {
    // Would use fetch to POST to webhook URL
    console.log(`[Webhook] ${url}:`, payload);
  }

  private async sendTelegram(message: string, channel?: string): Promise<void> {
    // Would integrate with K.I.T. notification system
    console.log(`[Telegram] ${channel || 'default'}:`, message);
  }

  private async sendDiscord(message: string, channel?: string): Promise<void> {
    console.log(`[Discord] ${channel || 'default'}:`, message);
  }

  private async sendEmail(message: string, to?: string): Promise<void> {
    console.log(`[Email] ${to || 'default'}:`, message);
  }

  // Backtesting
  async backtest(id: string, options: { days: number }): Promise<BacktestResult> {
    const alert = this.alerts.get(id);
    if (!alert) throw new Error(`Alert not found: ${id}`);

    const end = new Date();
    const start = new Date(end.getTime() - options.days * 24 * 60 * 60 * 1000);

    // Would fetch historical data and simulate alerts
    // Simplified implementation
    return {
      alertId: id,
      period: { start, end },
      triggerCount: 0,
      triggers: [],
      avgTimeBetweenTriggers: 0,
      falsePositiveEstimate: 0
    };
  }

  updateMarketData(symbol: string, snapshot: MarketSnapshot): void {
    this.evaluator.updateMarketData(symbol, snapshot);
  }
}

// ============== AI Assistant ==============

export class AlertAI {
  /**
   * Generate alert conditions from natural language description
   */
  async suggestConditions(description: string): Promise<ConditionGroup> {
    // Would use LLM to parse description into conditions
    // Example: "Alert me when BTC RSI goes oversold and there's volume spike"
    
    const conditions: Condition[] = [];
    const desc = description.toLowerCase();

    if (desc.includes('rsi') && (desc.includes('oversold') || desc.includes('below 30'))) {
      conditions.push({
        type: 'indicator',
        indicator: 'RSI',
        period: 14,
        condition: 'below',
        value: 30
      });
    }

    if (desc.includes('volume') && desc.includes('spike')) {
      conditions.push({
        type: 'volume',
        condition: 'above_average',
        multiplier: 2
      });
    }

    if (desc.includes('macd') && desc.includes('cross')) {
      conditions.push({
        type: 'indicator',
        indicator: 'MACD',
        condition: 'crosses_above',
        value: 'signal'
      });
    }

    return {
      operator: 'AND',
      conditions
    };
  }

  /**
   * Analyze alert quality and suggest improvements
   */
  async analyzeAlert(alert: Alert): Promise<{
    quality: number;
    suggestions: string[];
    estimatedFrequency: string;
  }> {
    const suggestions: string[] = [];
    let quality = 70;

    // Check for common issues
    const conditions = this.flattenConditions(alert.logic);
    
    if (conditions.length === 1) {
      suggestions.push('Consider adding more conditions to reduce false positives');
      quality -= 10;
    }

    if (!conditions.some(c => c.type === 'volume')) {
      suggestions.push('Adding volume confirmation can improve signal quality');
    }

    const hasMultiTimeframe = conditions.some(c => c.timeframe !== conditions[0]?.timeframe);
    if (!hasMultiTimeframe) {
      suggestions.push('Multi-timeframe analysis can provide stronger signals');
    }

    return {
      quality,
      suggestions,
      estimatedFrequency: this.estimateFrequency(conditions)
    };
  }

  private flattenConditions(group: ConditionGroup): Condition[] {
    const result: Condition[] = [];
    for (const item of group.conditions) {
      if ('operator' in item) {
        result.push(...this.flattenConditions(item));
      } else {
        result.push(item);
      }
    }
    return result;
  }

  private estimateFrequency(conditions: Condition[]): string {
    // Rough estimation based on condition types
    const baseFrequency = 100; // Per day for single condition
    const reductionPerCondition = 0.3;
    
    const estimated = baseFrequency * Math.pow(reductionPerCondition, conditions.length - 1);
    
    if (estimated > 10) return `~${Math.round(estimated)} times per day`;
    if (estimated > 1) return `~${Math.round(estimated * 7)} times per week`;
    return `~${Math.round(estimated * 30)} times per month`;
  }
}

// ============== Exports ==============

export const alertManager = new AlertManager();
export const alertAI = new AlertAI();
