/**
 * K.I.T. Trading Engine
 * Core orchestrator for all trading operations
 */

import { EventEmitter } from 'events';
import { Logger } from './logger';
import { ExchangeManager } from '../exchanges/manager';
import { StrategyManager } from '../strategies/manager';
import { RiskManager } from '../risk/manager';

export interface EngineConfig {
  exchanges: ExchangeManager;
  strategies: StrategyManager;
  risk: RiskManager;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: Date;
  strategy: string;
  exchange: string;
  status: 'pending' | 'open' | 'closed' | 'cancelled';
  pnl?: number;
}

export class TradingEngine extends EventEmitter {
  private logger: Logger;
  private exchanges: ExchangeManager;
  private strategies: StrategyManager;
  private risk: RiskManager;
  private isRunning: boolean = false;
  private trades: Map<string, Trade> = new Map();

  constructor(config: EngineConfig) {
    super();
    this.logger = new Logger('Engine');
    this.exchanges = config.exchanges;
    this.strategies = config.strategies;
    this.risk = config.risk;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Engine already running');
      return;
    }

    this.logger.info('Starting K.I.T. Trading Engine...');
    
    // Initialize exchanges
    await this.exchanges.initialize();
    
    // Load strategies
    await this.strategies.loadStrategies();
    
    // Initialize risk management
    await this.risk.initialize();
    
    // Start main loop
    this.isRunning = true;
    this.mainLoop();
    
    this.logger.info('Engine started successfully');
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping engine...');
    this.isRunning = false;
    
    // Close all open positions safely
    await this.closeAllPositions();
    
    // Disconnect exchanges
    await this.exchanges.disconnect();
    
    this.logger.info('Engine stopped');
  }

  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Get market data from all exchanges
        const marketData = await this.exchanges.getMarketData();
        
        // Run strategies
        const signals = await this.strategies.analyze(marketData);
        
        // Filter signals through risk management
        const validSignals = await this.risk.validateSignals(signals);
        
        // Execute valid trades
        for (const signal of validSignals) {
          await this.executeTrade(signal);
        }
        
        // Update open positions
        await this.updatePositions();
        
        // Emit status update
        this.emit('tick', {
          timestamp: new Date(),
          openTrades: this.trades.size,
          signals: signals.length,
          executed: validSignals.length
        });
        
      } catch (error) {
        this.logger.error('Error in main loop:', error);
      }
      
      // Wait before next iteration (configurable)
      await this.sleep(1000);
    }
  }

  private async executeTrade(signal: any): Promise<void> {
    const trade: Trade = {
      id: this.generateTradeId(),
      symbol: signal.symbol,
      side: signal.side,
      amount: signal.amount,
      price: signal.price,
      timestamp: new Date(),
      strategy: signal.strategy,
      exchange: signal.exchange,
      status: 'pending'
    };

    this.logger.info(`Executing trade: ${trade.side} ${trade.amount} ${trade.symbol}`);
    
    try {
      const result = await this.exchanges.executeOrder(trade);
      trade.status = 'open';
      this.trades.set(trade.id, trade);
      this.emit('trade', trade);
    } catch (error) {
      this.logger.error(`Trade execution failed:`, error);
      trade.status = 'cancelled';
    }
  }

  private async closeAllPositions(): Promise<void> {
    this.logger.info('Closing all open positions...');
    // Implementation for graceful position closure
  }

  private async updatePositions(): Promise<void> {
    // Update P&L for all open positions
  }

  private generateTradeId(): string {
    return `KIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
