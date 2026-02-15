/**
 * DCA Automator Skill
 * 
 * Automated Dollar-Cost Averaging with smart enhancements:
 * - Fixed interval DCA (daily, weekly, monthly)
 * - Value averaging (buy more when price is low)
 * - Dynamic DCA (AI-adjusted based on volatility)
 * - Dip buying (increase allocation during dips)
 * - Multiple asset DCA with rebalancing
 * 
 * @version 1.0.0
 */

import { Skill, SkillContext, SkillResult } from '../types/skill.js';

interface DCASchedule {
  id: string;
  name: string;
  assets: DCAAsset[];
  strategy: 'fixed' | 'value_averaging' | 'dynamic' | 'dip_buying' | 'smart';
  frequency: 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-28 for monthly
  hour?: number; // 0-23
  timezone: string;
  totalBudget: number;
  budgetPeriod: 'per_execution' | 'monthly' | 'yearly';
  currency: string;
  enabled: boolean;
  broker: 'alpaca' | 'binance' | 'coinbase' | 'kraken' | 'interactive_brokers';
  createdAt: Date;
  updatedAt: Date;
  lastExecuted?: Date;
  nextExecution?: Date;
  executionCount: number;
  totalInvested: number;
  currentValue?: number;
  settings: DCASettings;
}

interface DCAAsset {
  symbol: string;
  allocation: number; // Percentage 0-100
  minPrice?: number; // Don't buy above this
  maxPrice?: number; // Don't buy below this (for shorts)
  accumulationTarget?: number; // Target quantity to accumulate
  currentHolding?: number;
  averageCost?: number;
}

interface DCASettings {
  // Value Averaging
  targetGrowthRate?: number; // Monthly growth rate target (e.g., 0.02 for 2%)
  
  // Dip Buying
  dipThreshold?: number; // Percentage drop to trigger extra buy (e.g., 0.05 for 5%)
  dipMultiplier?: number; // Multiply normal amount by this during dips
  maxDipMultiplier?: number; // Cap the multiplier
  dipReferencePrice?: 'sma20' | 'sma50' | 'sma200' | 'ath' | 'recent_high';
  
  // Dynamic DCA
  volatilityAdjust?: boolean; // Reduce size in high volatility
  sentimentAdjust?: boolean; // Adjust based on market sentiment
  momentumAdjust?: boolean; // Buy more in uptrends
  
  // Smart DCA
  fearGreedThreshold?: number; // Buy more when fear/greed below this
  rsiOversoldLevel?: number; // RSI level to increase buys
  rsiOverboughtLevel?: number; // RSI level to decrease buys
  
  // Risk Management
  maxSinglePurchase?: number; // Max amount per single purchase
  minSinglePurchase?: number; // Min amount to bother executing
  skipIfPriceAboveSMA?: boolean; // Skip if price > SMA200
  pauseOnDrawdown?: number; // Pause if drawdown exceeds this %
  
  // Notifications
  notifyOnExecution?: boolean;
  notifyOnSkip?: boolean;
  notifyOnError?: boolean;
  notifyChannel?: string;
}

interface DCAExecution {
  id: string;
  scheduleId: string;
  executedAt: Date;
  status: 'success' | 'partial' | 'skipped' | 'failed';
  reason?: string;
  purchases: DCAPurchase[];
  totalSpent: number;
  totalValue: number;
  marketConditions?: MarketConditions;
}

interface DCAPurchase {
  symbol: string;
  quantity: number;
  price: number;
  value: number;
  orderId?: string;
  status: 'filled' | 'partial' | 'failed' | 'skipped';
  skipReason?: string;
}

interface MarketConditions {
  fearGreedIndex?: number;
  btcDominance?: number;
  totalMarketCap?: number;
  volatilityIndex?: number;
  trendStrength?: number;
  indicators: Record<string, number>;
}

interface ValueAveragingCalculation {
  symbol: string;
  currentValue: number;
  targetValue: number;
  requiredPurchase: number;
  currentPrice: number;
  quantityToBuy: number;
  adjustmentReason: string;
}

interface DipBuyingSignal {
  symbol: string;
  currentPrice: number;
  referencePrice: number;
  dropPercentage: number;
  dipLevel: 'minor' | 'moderate' | 'major' | 'extreme';
  suggestedMultiplier: number;
  triggered: boolean;
}

export class DCAAutomatorSkill implements Skill {
  name = 'dca-automator';
  description = 'Automated Dollar-Cost Averaging with smart enhancements';
  version = '1.0.0';
  
  private schedules: Map<string, DCASchedule> = new Map();
  private executions: DCAExecution[] = [];
  
  async initialize(context: SkillContext): Promise<void> {
    // Load saved schedules from storage
    const saved = await context.storage?.get<DCASchedule[]>('dca-schedules');
    if (saved && Array.isArray(saved)) {
      for (const schedule of saved) {
        this.schedules.set(schedule.id, schedule);
      }
    }
  }
  
  // ===== SCHEDULE MANAGEMENT =====
  
  createSchedule(params: Omit<DCASchedule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'totalInvested'>): DCASchedule {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const schedule: DCASchedule = {
      ...params,
      id,
      createdAt: now,
      updatedAt: now,
      executionCount: 0,
      totalInvested: 0,
      nextExecution: this.calculateNextExecution(params),
    };
    
    this.schedules.set(id, schedule);
    return schedule;
  }
  
  updateSchedule(id: string, updates: Partial<DCASchedule>): DCASchedule | null {
    const schedule = this.schedules.get(id);
    if (!schedule) return null;
    
    const updated = {
      ...schedule,
      ...updates,
      updatedAt: new Date(),
      nextExecution: this.calculateNextExecution({ ...schedule, ...updates }),
    };
    
    this.schedules.set(id, updated);
    return updated;
  }
  
  deleteSchedule(id: string): boolean {
    return this.schedules.delete(id);
  }
  
  getSchedule(id: string): DCASchedule | undefined {
    return this.schedules.get(id);
  }
  
  listSchedules(filter?: { enabled?: boolean; broker?: string }): DCASchedule[] {
    let results = Array.from(this.schedules.values());
    
    if (filter?.enabled !== undefined) {
      results = results.filter(s => s.enabled === filter.enabled);
    }
    if (filter?.broker) {
      results = results.filter(s => s.broker === filter.broker);
    }
    
    return results.sort((a, b) => 
      (a.nextExecution?.getTime() || 0) - (b.nextExecution?.getTime() || 0)
    );
  }
  
  // ===== EXECUTION =====
  
  async executeSchedule(scheduleId: string, dryRun = false): Promise<DCAExecution> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }
    
    const execution: DCAExecution = {
      id: crypto.randomUUID(),
      scheduleId,
      executedAt: new Date(),
      status: 'success',
      purchases: [],
      totalSpent: 0,
      totalValue: 0,
    };
    
    // Get market conditions for smart strategies
    const marketConditions = await this.getMarketConditions();
    execution.marketConditions = marketConditions;
    
    // Check if we should skip due to market conditions
    const skipReason = this.shouldSkipExecution(schedule, marketConditions);
    if (skipReason) {
      execution.status = 'skipped';
      execution.reason = skipReason;
      this.executions.push(execution);
      return execution;
    }
    
    // Calculate amounts for each asset
    const amounts = await this.calculatePurchaseAmounts(schedule, marketConditions);
    
    // Execute purchases
    for (const amount of amounts) {
      const purchase: DCAPurchase = {
        symbol: amount.symbol,
        quantity: amount.quantityToBuy,
        price: amount.currentPrice,
        value: amount.quantityToBuy * amount.currentPrice,
        status: 'filled',
      };
      
      if (amount.quantityToBuy <= 0) {
        purchase.status = 'skipped';
        purchase.skipReason = amount.adjustmentReason;
      } else if (!dryRun) {
        try {
          // Execute actual order via broker
          const order = await this.executePurchase(schedule.broker, amount);
          purchase.orderId = order.id;
          purchase.quantity = order.filledQuantity;
          purchase.price = order.filledPrice;
          purchase.value = purchase.quantity * purchase.price;
          purchase.status = order.status === 'filled' ? 'filled' : 'partial';
        } catch (error: any) {
          purchase.status = 'failed';
          purchase.skipReason = error.message;
        }
      }
      
      execution.purchases.push(purchase);
      if (purchase.status === 'filled' || purchase.status === 'partial') {
        execution.totalSpent += purchase.value;
      }
    }
    
    // Update schedule stats
    if (!dryRun && execution.status !== 'skipped') {
      schedule.executionCount++;
      schedule.totalInvested += execution.totalSpent;
      schedule.lastExecuted = new Date();
      schedule.nextExecution = this.calculateNextExecution(schedule);
      this.schedules.set(scheduleId, schedule);
    }
    
    // Check for partial/failed status
    const failed = execution.purchases.filter(p => p.status === 'failed').length;
    const skipped = execution.purchases.filter(p => p.status === 'skipped').length;
    if (failed === execution.purchases.length) {
      execution.status = 'failed';
    } else if (failed > 0 || skipped > 0) {
      execution.status = 'partial';
    }
    
    this.executions.push(execution);
    return execution;
  }
  
  // ===== CALCULATION ENGINES =====
  
  private async calculatePurchaseAmounts(
    schedule: DCASchedule,
    market: MarketConditions
  ): Promise<ValueAveragingCalculation[]> {
    const results: ValueAveragingCalculation[] = [];
    
    for (const asset of schedule.assets) {
      const currentPrice = await this.getCurrentPrice(asset.symbol);
      const baseAmount = (schedule.totalBudget * asset.allocation) / 100;
      
      let calculation: ValueAveragingCalculation;
      
      switch (schedule.strategy) {
        case 'value_averaging':
          calculation = this.calculateValueAveraging(schedule, asset, currentPrice);
          break;
        case 'dip_buying':
          calculation = await this.calculateDipBuying(schedule, asset, currentPrice);
          break;
        case 'dynamic':
          calculation = this.calculateDynamicDCA(schedule, asset, currentPrice, market);
          break;
        case 'smart':
          calculation = this.calculateSmartDCA(schedule, asset, currentPrice, market);
          break;
        default: // 'fixed'
          calculation = {
            symbol: asset.symbol,
            currentValue: (asset.currentHolding || 0) * currentPrice,
            targetValue: baseAmount,
            requiredPurchase: baseAmount,
            currentPrice,
            quantityToBuy: baseAmount / currentPrice,
            adjustmentReason: 'Fixed DCA amount',
          };
      }
      
      // Apply min/max limits
      if (schedule.settings.minSinglePurchase && calculation.requiredPurchase < schedule.settings.minSinglePurchase) {
        calculation.quantityToBuy = 0;
        calculation.adjustmentReason = `Below minimum purchase threshold ($${schedule.settings.minSinglePurchase})`;
      }
      if (schedule.settings.maxSinglePurchase && calculation.requiredPurchase > schedule.settings.maxSinglePurchase) {
        calculation.requiredPurchase = schedule.settings.maxSinglePurchase;
        calculation.quantityToBuy = schedule.settings.maxSinglePurchase / currentPrice;
        calculation.adjustmentReason = `Capped at max purchase ($${schedule.settings.maxSinglePurchase})`;
      }
      
      // Check price limits
      if (asset.minPrice && currentPrice > asset.minPrice) {
        calculation.quantityToBuy = 0;
        calculation.adjustmentReason = `Price ($${currentPrice}) above max buy price ($${asset.minPrice})`;
      }
      if (asset.maxPrice && currentPrice < asset.maxPrice) {
        calculation.quantityToBuy = 0;
        calculation.adjustmentReason = `Price ($${currentPrice}) below min buy price ($${asset.maxPrice})`;
      }
      
      results.push(calculation);
    }
    
    return results;
  }
  
  private calculateValueAveraging(
    schedule: DCASchedule,
    asset: DCAAsset,
    currentPrice: number
  ): ValueAveragingCalculation {
    const targetGrowthRate = schedule.settings.targetGrowthRate || 0.02;
    const monthsInvesting = schedule.executionCount + 1;
    const baseAmount = (schedule.totalBudget * asset.allocation) / 100;
    
    // Target value grows with compound interest
    const targetValue = baseAmount * monthsInvesting * Math.pow(1 + targetGrowthRate, monthsInvesting / 12);
    const currentValue = (asset.currentHolding || 0) * currentPrice;
    const requiredPurchase = Math.max(0, targetValue - currentValue);
    
    return {
      symbol: asset.symbol,
      currentValue,
      targetValue,
      requiredPurchase,
      currentPrice,
      quantityToBuy: requiredPurchase / currentPrice,
      adjustmentReason: currentValue >= targetValue 
        ? 'Portfolio already at or above target value'
        : `Value averaging: need $${requiredPurchase.toFixed(2)} to reach target`,
    };
  }
  
  private async calculateDipBuying(
    schedule: DCASchedule,
    asset: DCAAsset,
    currentPrice: number
  ): Promise<ValueAveragingCalculation> {
    const baseAmount = (schedule.totalBudget * asset.allocation) / 100;
    const dipSignal = await this.detectDip(asset.symbol, schedule.settings);
    
    let multiplier = 1;
    let reason = 'Standard DCA amount';
    
    if (dipSignal.triggered) {
      multiplier = Math.min(
        dipSignal.suggestedMultiplier,
        schedule.settings.maxDipMultiplier || 3
      );
      reason = `Dip detected (${(dipSignal.dropPercentage * 100).toFixed(1)}% below reference): ${multiplier}x multiplier`;
    }
    
    return {
      symbol: asset.symbol,
      currentValue: (asset.currentHolding || 0) * currentPrice,
      targetValue: baseAmount * multiplier,
      requiredPurchase: baseAmount * multiplier,
      currentPrice,
      quantityToBuy: (baseAmount * multiplier) / currentPrice,
      adjustmentReason: reason,
    };
  }
  
  private calculateDynamicDCA(
    schedule: DCASchedule,
    asset: DCAAsset,
    currentPrice: number,
    market: MarketConditions
  ): ValueAveragingCalculation {
    const baseAmount = (schedule.totalBudget * asset.allocation) / 100;
    let multiplier = 1;
    const reasons: string[] = [];
    
    // Volatility adjustment
    if (schedule.settings.volatilityAdjust && market.volatilityIndex !== undefined) {
      if (market.volatilityIndex > 30) {
        multiplier *= 0.7; // Reduce in high volatility
        reasons.push('High volatility (-30%)');
      } else if (market.volatilityIndex < 15) {
        multiplier *= 1.2; // Increase in low volatility
        reasons.push('Low volatility (+20%)');
      }
    }
    
    // Momentum adjustment
    if (schedule.settings.momentumAdjust && market.trendStrength !== undefined) {
      if (market.trendStrength > 0.5) {
        multiplier *= 1.2; // Buy more in uptrend
        reasons.push('Strong uptrend (+20%)');
      } else if (market.trendStrength < -0.5) {
        multiplier *= 0.8; // Buy less in downtrend
        reasons.push('Strong downtrend (-20%)');
      }
    }
    
    // Sentiment adjustment
    if (schedule.settings.sentimentAdjust && market.fearGreedIndex !== undefined) {
      if (market.fearGreedIndex < 25) {
        multiplier *= 1.3; // Buy more in extreme fear
        reasons.push('Extreme fear (+30%)');
      } else if (market.fearGreedIndex > 75) {
        multiplier *= 0.7; // Buy less in extreme greed
        reasons.push('Extreme greed (-30%)');
      }
    }
    
    return {
      symbol: asset.symbol,
      currentValue: (asset.currentHolding || 0) * currentPrice,
      targetValue: baseAmount * multiplier,
      requiredPurchase: baseAmount * multiplier,
      currentPrice,
      quantityToBuy: (baseAmount * multiplier) / currentPrice,
      adjustmentReason: reasons.length > 0 
        ? `Dynamic adjustments: ${reasons.join(', ')}`
        : 'No market adjustments applied',
    };
  }
  
  private calculateSmartDCA(
    schedule: DCASchedule,
    asset: DCAAsset,
    currentPrice: number,
    market: MarketConditions
  ): ValueAveragingCalculation {
    const baseAmount = (schedule.totalBudget * asset.allocation) / 100;
    let multiplier = 1;
    const reasons: string[] = [];
    
    const rsi = market.indicators?.rsi;
    const fearGreed = market.fearGreedIndex;
    
    // RSI-based adjustment
    if (rsi !== undefined) {
      const oversold = schedule.settings.rsiOversoldLevel || 30;
      const overbought = schedule.settings.rsiOverboughtLevel || 70;
      
      if (rsi < oversold) {
        multiplier *= 1.5;
        reasons.push(`RSI oversold (${rsi.toFixed(0)})`);
      } else if (rsi > overbought) {
        multiplier *= 0.5;
        reasons.push(`RSI overbought (${rsi.toFixed(0)})`);
      }
    }
    
    // Fear & Greed adjustment
    if (fearGreed !== undefined) {
      const threshold = schedule.settings.fearGreedThreshold || 30;
      if (fearGreed < threshold) {
        multiplier *= 1.3;
        reasons.push(`Fear index low (${fearGreed})`);
      } else if (fearGreed > 100 - threshold) {
        multiplier *= 0.7;
        reasons.push(`Greed index high (${fearGreed})`);
      }
    }
    
    return {
      symbol: asset.symbol,
      currentValue: (asset.currentHolding || 0) * currentPrice,
      targetValue: baseAmount * multiplier,
      requiredPurchase: baseAmount * multiplier,
      currentPrice,
      quantityToBuy: (baseAmount * multiplier) / currentPrice,
      adjustmentReason: reasons.length > 0 
        ? `Smart DCA: ${reasons.join(', ')}`
        : 'Standard smart DCA',
    };
  }
  
  // ===== DIP DETECTION =====
  
  async detectDip(symbol: string, settings: DCASettings): Promise<DipBuyingSignal> {
    const currentPrice = await this.getCurrentPrice(symbol);
    const referencePrice = await this.getReferencePrice(symbol, settings.dipReferencePrice || 'sma50');
    
    const dropPercentage = (referencePrice - currentPrice) / referencePrice;
    const dipThreshold = settings.dipThreshold || 0.05;
    const baseMult = settings.dipMultiplier || 1.5;
    
    let dipLevel: 'minor' | 'moderate' | 'major' | 'extreme';
    let suggestedMultiplier: number;
    
    if (dropPercentage >= 0.20) {
      dipLevel = 'extreme';
      suggestedMultiplier = baseMult * 2.5;
    } else if (dropPercentage >= 0.15) {
      dipLevel = 'major';
      suggestedMultiplier = baseMult * 2;
    } else if (dropPercentage >= 0.10) {
      dipLevel = 'moderate';
      suggestedMultiplier = baseMult * 1.5;
    } else {
      dipLevel = 'minor';
      suggestedMultiplier = baseMult;
    }
    
    return {
      symbol,
      currentPrice,
      referencePrice,
      dropPercentage,
      dipLevel,
      suggestedMultiplier,
      triggered: dropPercentage >= dipThreshold,
    };
  }
  
  // ===== HELPER METHODS =====
  
  private calculateNextExecution(schedule: Partial<DCASchedule>): Date {
    const now = new Date();
    const next = new Date(now);
    
    switch (schedule.frequency) {
      case 'hourly':
        next.setHours(next.getHours() + 1);
        next.setMinutes(0, 0, 0);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(schedule.hour || 9, 0, 0, 0);
        break;
      case 'weekly':
        const daysUntil = ((schedule.dayOfWeek || 1) - next.getDay() + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntil);
        next.setHours(schedule.hour || 9, 0, 0, 0);
        break;
      case 'biweekly':
        const biweeklyDays = ((schedule.dayOfWeek || 1) - next.getDay() + 7) % 7 || 7;
        next.setDate(next.getDate() + biweeklyDays + 7);
        next.setHours(schedule.hour || 9, 0, 0, 0);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(schedule.dayOfMonth || 1);
        next.setHours(schedule.hour || 9, 0, 0, 0);
        break;
    }
    
    return next;
  }
  
  private shouldSkipExecution(schedule: DCASchedule, market: MarketConditions): string | null {
    // Check drawdown pause
    if (schedule.settings.pauseOnDrawdown && schedule.currentValue && schedule.totalInvested) {
      const drawdown = (schedule.totalInvested - schedule.currentValue) / schedule.totalInvested;
      if (drawdown > schedule.settings.pauseOnDrawdown) {
        return `Paused: Portfolio drawdown (${(drawdown * 100).toFixed(1)}%) exceeds threshold`;
      }
    }
    
    return null;
  }
  
  private async getCurrentPrice(symbol: string): Promise<number> {
    // Mock implementation - would call actual price API
    return 100 + Math.random() * 10;
  }
  
  private async getReferencePrice(symbol: string, reference: string): Promise<number> {
    // Mock implementation - would calculate actual reference
    const current = await this.getCurrentPrice(symbol);
    return current * (1 + Math.random() * 0.1);
  }
  
  private async getMarketConditions(): Promise<MarketConditions> {
    // Mock implementation - would fetch actual market data
    return {
      fearGreedIndex: Math.floor(Math.random() * 100),
      volatilityIndex: 15 + Math.random() * 20,
      trendStrength: (Math.random() * 2) - 1,
      indicators: {
        rsi: 30 + Math.random() * 40,
        macd: (Math.random() * 2) - 1,
      },
    };
  }
  
  private async executePurchase(broker: string, calculation: ValueAveragingCalculation): Promise<{
    id: string;
    filledQuantity: number;
    filledPrice: number;
    status: 'filled' | 'partial' | 'failed';
  }> {
    // Mock implementation - would execute actual order
    return {
      id: crypto.randomUUID(),
      filledQuantity: calculation.quantityToBuy,
      filledPrice: calculation.currentPrice,
      status: 'filled',
    };
  }
  
  // ===== ANALYTICS =====
  
  getPerformanceReport(scheduleId: string): {
    schedule: DCASchedule;
    totalInvested: number;
    currentValue: number;
    totalReturn: number;
    returnPercentage: number;
    averageCost: number;
    executionHistory: DCAExecution[];
  } | null {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return null;
    
    const history = this.executions.filter(e => e.scheduleId === scheduleId);
    const currentValue = schedule.currentValue || schedule.totalInvested;
    
    return {
      schedule,
      totalInvested: schedule.totalInvested,
      currentValue,
      totalReturn: currentValue - schedule.totalInvested,
      returnPercentage: schedule.totalInvested > 0 
        ? ((currentValue - schedule.totalInvested) / schedule.totalInvested) * 100 
        : 0,
      averageCost: schedule.executionCount > 0 
        ? schedule.totalInvested / schedule.executionCount 
        : 0,
      executionHistory: history,
    };
  }
  
  // ===== SKILL INTERFACE =====
  
  async execute(context: SkillContext): Promise<SkillResult> {
    if (!context.input) {
      return { success: false, error: 'No input provided' };
    }
    const { action, params } = context.input;
    
    try {
      let result: any;
      
      switch (action) {
        case 'createSchedule':
          result = this.createSchedule(params);
          break;
        case 'updateSchedule':
          result = this.updateSchedule(params.id, params.updates);
          break;
        case 'deleteSchedule':
          result = this.deleteSchedule(params.id);
          break;
        case 'getSchedule':
          result = this.getSchedule(params.id);
          break;
        case 'listSchedules':
          result = this.listSchedules(params);
          break;
        case 'executeSchedule':
          result = await this.executeSchedule(params.id, params.dryRun);
          break;
        case 'detectDip':
          result = await this.detectDip(params.symbol, params.settings || {});
          break;
        case 'getPerformance':
          result = this.getPerformanceReport(params.id);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export default new DCAAutomatorSkill();
