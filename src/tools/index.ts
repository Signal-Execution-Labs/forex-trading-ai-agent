/**
 * K.I.T. Tools Index
 * 
 * Central export point for all K.I.T. trading tools.
 */

// Types
export * from './types';

// Core Tools
export { AutoTrader, createAutoTrader } from './auto-trader';
export type { TradeParams, TradeResult, AutoTraderConfig } from './auto-trader';

export { MarketAnalyzer, createMarketAnalyzer } from './market-analysis';
export type { AnalysisParams, PriceData, SupportResistance, TrendAnalysis, SignalResult } from './market-analysis';

export { PortfolioTracker, createPortfolioTracker } from './portfolio-tracker';
export type { PortfolioConfig, PnLResult, AllocationResult, PerformanceMetrics } from './portfolio-tracker';

export { AlertSystem, createAlertSystem } from './alert-system';
export type { CreateAlertParams, AlertSystemConfig, AlertSummary } from './alert-system';

// Additional Tools
export { Backtester, createBacktester } from './backtester';
export type { BacktestParams, BacktesterConfig, StrategyFunction, StrategySignal } from './backtester';

export { Scheduler, createScheduler } from './scheduler';
export type { ScheduledTask, TaskResult, SchedulerConfig, TaskType } from './scheduler';

export { TaxTracker, createTaxTracker } from './tax-tracker';
export type { TaxTrackerConfig, TaxLot, DisposalEvent, TaxSummary, TaxReport, CostBasisMethod } from './tax-tracker';

export { DeFiConnector, createDeFiConnector } from './defi-connector';
export type { DeFiConnectorConfig, DexQuote, YieldOpportunity, LiquidityPool, LendingPosition, DeFiProtocol, NetworkId } from './defi-connector';

// Factory for creating all tools
export interface ToolInstances {
  autoTrader: InstanceType<typeof import('./auto-trader').AutoTrader>;
  marketAnalyzer: InstanceType<typeof import('./market-analysis').MarketAnalyzer>;
  portfolioTracker: InstanceType<typeof import('./portfolio-tracker').PortfolioTracker>;
  alertSystem: InstanceType<typeof import('./alert-system').AlertSystem>;
}

export function createAllTools(exchangeConfig?: import('./types').ExchangeConfig): ToolInstances {
  const { createAutoTrader } = require('./auto-trader');
  const { createMarketAnalyzer } = require('./market-analysis');
  const { createPortfolioTracker } = require('./portfolio-tracker');
  const { createAlertSystem } = require('./alert-system');

  return {
    autoTrader: createAutoTrader({ exchange: exchangeConfig }),
    marketAnalyzer: createMarketAnalyzer(exchangeConfig),
    portfolioTracker: createPortfolioTracker({ 
      exchanges: exchangeConfig ? [exchangeConfig] : undefined 
    }),
    alertSystem: createAlertSystem({ exchange: exchangeConfig }),
  };
}
