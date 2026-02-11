/**
 * Spot-Futures Arbitrage Bot
 * K.I.T. Financial Agent
 * 
 * Delta-neutral strategy exploiting funding rate differentials
 */

import { EventEmitter } from 'events';

export interface SpotFuturesArbConfig {
  // Entry criteria
  minFundingRate: number;
  minFundingPeriods: number;
  
  // Position sizing
  maxPositionSize: number;
  maxTotalExposure: number;
  leverageMultiplier: number;
  
  // Risk management
  stopLossRate: number;
  minMarginRatio: number;
  maxSlippage: number;
  
  // Execution
  preferredExchanges: string[];
  hedgeOnSameExchange: boolean;
  rebalanceThreshold: number;
  
  // Notifications
  notifyOnEntry: boolean;
  notifyOnFunding: boolean;
  notifyOnExit: boolean;
}

export interface FundingRate {
  exchange: string;
  symbol: string;
  rate: number;
  nextFundingTime: Date;
  interval: number; // hours
  predictedRate?: number;
  annualizedRate: number;
}

export interface ArbPosition {
  id: string;
  symbol: string;
  spotExchange: string;
  futuresExchange: string;
  spotSize: number;
  futuresSize: number;
  spotEntryPrice: number;
  futuresEntryPrice: number;
  entryTime: Date;
  totalFundingCollected: number;
  totalFeesPaid: number;
  fundingPayments: FundingPayment[];
  status: 'active' | 'closing' | 'closed';
  closeReason?: string;
}

export interface FundingPayment {
  timestamp: Date;
  amount: number;
  rate: number;
  exchange: string;
}

export interface ArbOpportunity {
  symbol: string;
  exchange: string;
  currentFundingRate: number;
  annualizedRate: number;
  predictedRate: number;
  spotPrice: number;
  futuresPrice: number;
  spread: number;
  spreadPercent: number;
  recommendedSize: number;
  estimatedDailyProfit: number;
  estimatedMonthlyProfit: number;
  breakEvenDays: number;
}

const DEFAULT_CONFIG: SpotFuturesArbConfig = {
  minFundingRate: 0.15, // 15% annualized minimum
  minFundingPeriods: 3, // 3 consecutive positive periods
  maxPositionSize: 10000,
  maxTotalExposure: 50000,
  leverageMultiplier: 1,
  stopLossRate: -0.10, // Exit if -10% annualized
  minMarginRatio: 0.50,
  maxSlippage: 0.002,
  preferredExchanges: ['binance', 'bybit', 'okx'],
  hedgeOnSameExchange: true,
  rebalanceThreshold: 0.02,
  notifyOnEntry: true,
  notifyOnFunding: false,
  notifyOnExit: true,
};

export class SpotFuturesArbBot extends EventEmitter {
  private config: SpotFuturesArbConfig;
  private positions: Map<string, ArbPosition> = new Map();
  private monitorInterval?: NodeJS.Timeout;
  private fundingRates: Map<string, FundingRate[]> = new Map();

  constructor(config: Partial<SpotFuturesArbConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current funding rates across exchanges
   */
  async getFundingRates(symbol?: string): Promise<FundingRate[]> {
    const rates: FundingRate[] = [];
    
    for (const exchange of this.config.preferredExchanges) {
      try {
        const exchangeRates = await this.fetchExchangeFundingRates(exchange, symbol);
        rates.push(...exchangeRates);
      } catch (error) {
        console.error(`Failed to fetch funding rates from ${exchange}:`, error);
      }
    }

    // Sort by annualized rate descending
    rates.sort((a, b) => b.annualizedRate - a.annualizedRate);
    return rates;
  }

  private async fetchExchangeFundingRates(exchange: string, symbol?: string): Promise<FundingRate[]> {
    // TODO: Integrate with exchange-connector
    // This is a placeholder that would call the actual exchange API
    
    // Placeholder data structure
    const now = new Date();
    const nextFunding = new Date(now);
    nextFunding.setHours(nextFunding.getHours() + (8 - (now.getHours() % 8)));

    return [{
      exchange,
      symbol: symbol || 'BTC/USDT',
      rate: 0.0001, // 0.01% per 8h
      nextFundingTime: nextFunding,
      interval: 8,
      annualizedRate: 0.0001 * 3 * 365, // ~10.95%
    }];
  }

  /**
   * Find best arbitrage opportunities
   */
  async findOpportunities(minAnnualizedRate: number = this.config.minFundingRate): Promise<ArbOpportunity[]> {
    const rates = await this.getFundingRates();
    const opportunities: ArbOpportunity[] = [];

    for (const rate of rates) {
      if (rate.annualizedRate < minAnnualizedRate) continue;

      // Get spot and futures prices
      const { spotPrice, futuresPrice } = await this.getPrices(rate.exchange, rate.symbol);
      const spread = futuresPrice - spotPrice;
      const spreadPercent = spread / spotPrice;

      // Calculate estimated profits
      const positionSize = Math.min(this.config.maxPositionSize, this.getAvailableCapacity());
      const dailyFunding = positionSize * rate.rate * 3; // 3 funding periods per day
      const tradingFees = positionSize * 0.002; // ~0.1% entry + exit

      const opportunity: ArbOpportunity = {
        symbol: rate.symbol,
        exchange: rate.exchange,
        currentFundingRate: rate.rate,
        annualizedRate: rate.annualizedRate,
        predictedRate: rate.predictedRate || rate.rate,
        spotPrice,
        futuresPrice,
        spread,
        spreadPercent,
        recommendedSize: positionSize,
        estimatedDailyProfit: dailyFunding,
        estimatedMonthlyProfit: dailyFunding * 30,
        breakEvenDays: tradingFees / dailyFunding,
      };

      opportunities.push(opportunity);
    }

    // Sort by estimated daily profit
    opportunities.sort((a, b) => b.estimatedDailyProfit - a.estimatedDailyProfit);
    return opportunities;
  }

  private async getPrices(exchange: string, symbol: string): Promise<{ spotPrice: number; futuresPrice: number }> {
    // TODO: Integrate with exchange-connector
    // Placeholder
    return { spotPrice: 60000, futuresPrice: 60050 };
  }

  private getAvailableCapacity(): number {
    const totalExposure = Array.from(this.positions.values())
      .filter(p => p.status === 'active')
      .reduce((sum, p) => sum + p.spotSize * p.spotEntryPrice, 0);
    
    return Math.max(0, this.config.maxTotalExposure - totalExposure);
  }

  /**
   * Open a new arbitrage position
   */
  async openPosition(symbol: string, sizeUsd: number, exchange?: string): Promise<ArbPosition> {
    const selectedExchange = exchange || this.config.preferredExchanges[0];
    
    // Get current prices
    const { spotPrice, futuresPrice } = await this.getPrices(selectedExchange, symbol);
    
    // Calculate position size in base currency
    const baseSize = sizeUsd / spotPrice;

    // Validate
    if (sizeUsd > this.config.maxPositionSize) {
      throw new Error(`Position size ${sizeUsd} exceeds max ${this.config.maxPositionSize}`);
    }

    if (sizeUsd > this.getAvailableCapacity()) {
      throw new Error(`Insufficient capacity. Available: ${this.getAvailableCapacity()}`);
    }

    // Execute trades
    // TODO: Integrate with exchange-connector
    console.log(`[ARB] Opening position: Buy ${baseSize} ${symbol} spot at ${spotPrice}`);
    console.log(`[ARB] Opening position: Short ${baseSize} ${symbol}-PERP at ${futuresPrice}`);

    const position: ArbPosition = {
      id: `arb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      symbol,
      spotExchange: selectedExchange,
      futuresExchange: selectedExchange,
      spotSize: baseSize,
      futuresSize: baseSize,
      spotEntryPrice: spotPrice,
      futuresEntryPrice: futuresPrice,
      entryTime: new Date(),
      totalFundingCollected: 0,
      totalFeesPaid: sizeUsd * 0.002, // Estimated entry fees
      fundingPayments: [],
      status: 'active',
    };

    this.positions.set(position.id, position);
    this.emit('position:opened', position);

    if (this.config.notifyOnEntry) {
      this.emit('notify', {
        type: 'entry',
        message: `Opened ${symbol} arb position: $${sizeUsd.toFixed(2)} | Entry spread: ${((futuresPrice - spotPrice) / spotPrice * 100).toFixed(3)}%`,
        position,
      });
    }

    return position;
  }

  /**
   * Close an arbitrage position
   */
  async closePosition(positionId: string, reason?: string): Promise<ArbPosition> {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    if (position.status !== 'active') {
      throw new Error(`Position ${positionId} is already ${position.status}`);
    }

    position.status = 'closing';

    // Get current prices for exit
    const { spotPrice, futuresPrice } = await this.getPrices(position.spotExchange, position.symbol);

    // Execute closing trades
    // TODO: Integrate with exchange-connector
    console.log(`[ARB] Closing position: Sell ${position.spotSize} ${position.symbol} spot at ${spotPrice}`);
    console.log(`[ARB] Closing position: Cover ${position.futuresSize} ${position.symbol}-PERP at ${futuresPrice}`);

    // Add exit fees
    const exitValue = position.spotSize * spotPrice;
    position.totalFeesPaid += exitValue * 0.002; // Exit fees

    position.status = 'closed';
    position.closeReason = reason || 'Manual close';

    this.emit('position:closed', position);

    if (this.config.notifyOnExit) {
      const netProfit = position.totalFundingCollected - position.totalFeesPaid;
      const holdingDays = (Date.now() - position.entryTime.getTime()) / (1000 * 60 * 60 * 24);
      
      this.emit('notify', {
        type: 'exit',
        message: `Closed ${position.symbol} arb position | Funding: $${position.totalFundingCollected.toFixed(2)} | Fees: $${position.totalFeesPaid.toFixed(2)} | Net: $${netProfit.toFixed(2)} | Days: ${holdingDays.toFixed(1)}`,
        position,
      });
    }

    return position;
  }

  /**
   * Process funding payment for a position
   */
  private processFundingPayment(position: ArbPosition, rate: number): void {
    const positionValue = position.futuresSize * position.futuresEntryPrice;
    const fundingAmount = positionValue * Math.abs(rate);

    // If rate is positive, shorts receive funding (we're short futures)
    const payment: FundingPayment = {
      timestamp: new Date(),
      amount: rate > 0 ? fundingAmount : -fundingAmount,
      rate,
      exchange: position.futuresExchange,
    };

    position.fundingPayments.push(payment);
    position.totalFundingCollected += payment.amount;

    this.emit('funding:received', { position, payment });

    if (this.config.notifyOnFunding && Math.abs(payment.amount) > 0.01) {
      const direction = payment.amount > 0 ? 'Received' : 'Paid';
      this.emit('notify', {
        type: 'funding',
        message: `${position.symbol}: ${direction} $${Math.abs(payment.amount).toFixed(4)} funding | Rate: ${(rate * 100).toFixed(4)}%`,
        position,
        payment,
      });
    }

    // Check if we should exit due to negative funding
    const recentPayments = position.fundingPayments.slice(-this.config.minFundingPeriods);
    const avgRate = recentPayments.reduce((sum, p) => sum + p.rate, 0) / recentPayments.length;
    const annualizedAvg = avgRate * 3 * 365;

    if (annualizedAvg < this.config.stopLossRate) {
      this.closePosition(position.id, `Funding rate dropped to ${(annualizedAvg * 100).toFixed(2)}% annualized`);
    }
  }

  /**
   * Get active positions
   */
  getActivePositions(): ArbPosition[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'active');
  }

  /**
   * Get all positions (including closed)
   */
  getAllPositions(): ArbPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalPositions: number;
    activePositions: number;
    totalFundingCollected: number;
    totalFeesPaid: number;
    netProfit: number;
    totalExposure: number;
  } {
    const positions = Array.from(this.positions.values());
    const active = positions.filter(p => p.status === 'active');
    
    const totalFunding = positions.reduce((sum, p) => sum + p.totalFundingCollected, 0);
    const totalFees = positions.reduce((sum, p) => sum + p.totalFeesPaid, 0);
    const exposure = active.reduce((sum, p) => sum + p.spotSize * p.spotEntryPrice, 0);

    return {
      totalPositions: positions.length,
      activePositions: active.length,
      totalFundingCollected: totalFunding,
      totalFeesPaid: totalFees,
      netProfit: totalFunding - totalFees,
      totalExposure: exposure,
    };
  }

  /**
   * Start monitoring (check funding rates and positions periodically)
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = setInterval(async () => {
      try {
        // Update funding rates
        const rates = await this.getFundingRates();
        
        // Check each active position
        for (const position of this.getActivePositions()) {
          const rate = rates.find(
            r => r.exchange === position.futuresExchange && r.symbol === position.symbol
          );
          
          if (rate) {
            // Check if funding was just paid
            const now = new Date();
            const lastPayment = position.fundingPayments[position.fundingPayments.length - 1];
            const hoursSinceLastPayment = lastPayment 
              ? (now.getTime() - lastPayment.timestamp.getTime()) / (1000 * 60 * 60)
              : Infinity;

            if (hoursSinceLastPayment >= rate.interval) {
              this.processFundingPayment(position, rate.rate);
            }
          }
        }

        this.emit('monitor:tick', { rates, positions: this.getActivePositions() });
      } catch (error) {
        console.error('[ARB] Monitor error:', error);
      }
    }, intervalMs);

    this.emit('monitor:started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
    this.emit('monitor:stopped');
  }
}

export default SpotFuturesArbBot;
