/**
 * K.I.T. Risk Manager
 * Controls risk exposure and validates trades
 */

import { Logger } from '../core/logger';
import { Signal } from '../strategies/manager';

export interface RiskConfig {
  maxPositionSize: number;      // Max % of portfolio per position
  maxDailyLoss: number;         // Max daily loss % before stopping
  maxOpenPositions: number;     // Max concurrent positions
  minConfidence: number;        // Min signal confidence to trade
  stopLossPercent: number;      // Default stop loss %
  takeProfitPercent: number;    // Default take profit %
}

export interface PortfolioState {
  totalValue: number;
  availableBalance: number;
  openPositions: number;
  dailyPnL: number;
  dailyPnLPercent: number;
}

export class RiskManager {
  private logger: Logger;
  private config: RiskConfig;
  private portfolio: PortfolioState;
  private tradingEnabled: boolean = true;

  constructor() {
    this.logger = new Logger('Risk');
    this.config = this.getDefaultConfig();
    this.portfolio = {
      totalValue: 0,
      availableBalance: 0,
      openPositions: 0,
      dailyPnL: 0,
      dailyPnLPercent: 0
    };
  }

  private getDefaultConfig(): RiskConfig {
    return {
      maxPositionSize: 5,        // 5% max per position
      maxDailyLoss: 10,          // Stop trading at 10% daily loss
      maxOpenPositions: 10,      // Max 10 concurrent positions
      minConfidence: 0.6,        // Min 60% confidence
      stopLossPercent: 2,        // 2% stop loss
      takeProfitPercent: 4       // 4% take profit (2:1 ratio)
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing risk management...');
    this.logger.info(`Max position size: ${this.config.maxPositionSize}%`);
    this.logger.info(`Max daily loss: ${this.config.maxDailyLoss}%`);
    this.logger.info(`Max open positions: ${this.config.maxOpenPositions}`);
  }

  configure(config: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Risk configuration updated');
  }

  async validateSignals(signals: Signal[]): Promise<Signal[]> {
    if (!this.tradingEnabled) {
      this.logger.warn('Trading disabled - skipping all signals');
      return [];
    }

    const validSignals: Signal[] = [];

    for (const signal of signals) {
      const validation = this.validateSignal(signal);
      
      if (validation.valid) {
        // Adjust position size based on risk
        signal.amount = this.calculatePositionSize(signal);
        validSignals.push(signal);
      } else {
        this.logger.debug(`Signal rejected: ${validation.reason}`);
      }
    }

    this.logger.info(`Validated ${validSignals.length}/${signals.length} signals`);
    return validSignals;
  }

  private validateSignal(signal: Signal): { valid: boolean; reason?: string } {
    // Check confidence threshold
    if (signal.confidence < this.config.minConfidence) {
      return { valid: false, reason: `Low confidence: ${signal.confidence}` };
    }

    // Check max positions
    if (this.portfolio.openPositions >= this.config.maxOpenPositions) {
      return { valid: false, reason: 'Max positions reached' };
    }

    // Check daily loss limit
    if (this.portfolio.dailyPnLPercent <= -this.config.maxDailyLoss) {
      this.tradingEnabled = false;
      return { valid: false, reason: 'Daily loss limit reached' };
    }

    // Check available balance
    const requiredBalance = signal.amount * signal.price;
    if (requiredBalance > this.portfolio.availableBalance) {
      return { valid: false, reason: 'Insufficient balance' };
    }

    return { valid: true };
  }

  private calculatePositionSize(signal: Signal): number {
    // Calculate position size based on portfolio and risk
    const maxPositionValue = this.portfolio.totalValue * (this.config.maxPositionSize / 100);
    const requestedValue = signal.amount * signal.price;
    
    if (requestedValue > maxPositionValue) {
      // Scale down to max allowed
      return maxPositionValue / signal.price;
    }
    
    return signal.amount;
  }

  calculateStopLoss(entryPrice: number, side: 'buy' | 'sell'): number {
    const stopPercent = this.config.stopLossPercent / 100;
    
    if (side === 'buy') {
      return entryPrice * (1 - stopPercent);
    } else {
      return entryPrice * (1 + stopPercent);
    }
  }

  calculateTakeProfit(entryPrice: number, side: 'buy' | 'sell'): number {
    const tpPercent = this.config.takeProfitPercent / 100;
    
    if (side === 'buy') {
      return entryPrice * (1 + tpPercent);
    } else {
      return entryPrice * (1 - tpPercent);
    }
  }

  updatePortfolio(state: Partial<PortfolioState>): void {
    this.portfolio = { ...this.portfolio, ...state };
    
    // Re-enable trading if new day or conditions improve
    if (this.portfolio.dailyPnLPercent > -this.config.maxDailyLoss) {
      this.tradingEnabled = true;
    }
  }

  getPortfolioState(): PortfolioState {
    return { ...this.portfolio };
  }

  getRiskMetrics(): any {
    return {
      config: this.config,
      tradingEnabled: this.tradingEnabled,
      portfolio: this.portfolio
    };
  }

  enableTrading(): void {
    this.tradingEnabled = true;
    this.logger.info('Trading enabled');
  }

  disableTrading(): void {
    this.tradingEnabled = false;
    this.logger.info('Trading disabled');
  }
}
