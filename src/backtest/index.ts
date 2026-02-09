/**
 * K.I.T. Backtesting Framework
 * Main export file
 */

export * from './engine';
export * from './data-loader';
export * from './metrics';
export * from './report';

// Re-export main classes for convenience
export { BacktestEngine, BacktestConfig, BacktestResult, Position } from './engine';
export { BacktestDataLoader, DataLoaderConfig, HistoricalData } from './data-loader';
export { MetricsCalculator, PerformanceMetrics, BacktestTrade, EquityPoint, StrategyMetrics } from './metrics';
export { ReportGenerator, ReportConfig } from './report';
