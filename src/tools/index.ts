/**
 * K.I.T. Tools Index
 * 
 * Central export point for all K.I.T. trading tools.
 * Issues: #3, #4, #5, #6, #7, #8, #9, #10, #13
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

// Issue #6: Task Scheduler - DCA, Rebalancing, Scheduled Tasks
export { TaskScheduler, createTaskScheduler, getScheduler } from './task-scheduler';
export type { 
  ScheduledTask, 
  TaskResult, 
  SchedulerConfig, 
  TaskType,
  TaskFrequency,
  TaskConfig 
} from './task-scheduler';

// Issue #7: Tax Tracker - Capital Gains, Tax Reports
export { TaxTracker, createTaxTracker, getTaxTracker } from './tax-tracker';
export type { 
  TaxConfig, 
  Trade, 
  TaxLot, 
  CapitalGain, 
  TaxSummary,
  TaxMethod,
  TaxLossHarvestOpportunity 
} from './tax-tracker';

// Issue #8: Backtester - Strategy Testing
export { Backtester, createBacktester, STRATEGIES } from './backtester';
export type { 
  BacktestConfig, 
  BacktestResult, 
  BacktestTrade,
  StrategyConfig,
  StrategyFunction, 
  StrategySignal 
} from './backtester';

// Issue #9: DeFi Connector - Staking, Lending, Yield Farming
export { DeFiConnector, createDeFiConnector, getDeFiConnector } from './defi-connector';
export type { 
  DeFiConfig, 
  DeFiPosition, 
  DeFiProtocol,
  Chain,
  PositionType,
  StakingInfo,
  LendingInfo,
  YieldFarm,
  AutoCompoundConfig
} from './defi-connector';

// Factory for creating all tools
export interface ToolInstances {
  autoTrader: InstanceType<typeof import('./auto-trader').AutoTrader>;
  marketAnalyzer: InstanceType<typeof import('./market-analysis').MarketAnalyzer>;
  portfolioTracker: InstanceType<typeof import('./portfolio-tracker').PortfolioTracker>;
  alertSystem: InstanceType<typeof import('./alert-system').AlertSystem>;
  taskScheduler: InstanceType<typeof import('./task-scheduler').TaskScheduler>;
  taxTracker: InstanceType<typeof import('./tax-tracker').TaxTracker>;
  backtester: InstanceType<typeof import('./backtester').Backtester>;
  defiConnector: InstanceType<typeof import('./defi-connector').DeFiConnector>;
}

export function createAllTools(exchangeConfig?: import('./types').ExchangeConfig): ToolInstances {
  const { createAutoTrader } = require('./auto-trader');
  const { createMarketAnalyzer } = require('./market-analysis');
  const { createPortfolioTracker } = require('./portfolio-tracker');
  const { createAlertSystem } = require('./alert-system');
  const { createTaskScheduler } = require('./task-scheduler');
  const { createTaxTracker } = require('./tax-tracker');
  const { createBacktester } = require('./backtester');
  const { createDeFiConnector } = require('./defi-connector');

  return {
    autoTrader: createAutoTrader({ exchange: exchangeConfig }),
    marketAnalyzer: createMarketAnalyzer(exchangeConfig),
    portfolioTracker: createPortfolioTracker({ 
      exchanges: exchangeConfig ? [exchangeConfig] : undefined 
    }),
    alertSystem: createAlertSystem({ exchange: exchangeConfig }),
    taskScheduler: createTaskScheduler(),
    taxTracker: createTaxTracker(),
    backtester: createBacktester(),
    defiConnector: createDeFiConnector(),
  };
}
