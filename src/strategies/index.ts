/**
 * K.I.T. Strategies Index
 * Export all strategies for easy importing
 */

// Base class and types
export { BaseStrategy, Signal, OHLCV, StrategyConfig } from './base';

// Strategy implementations
export { SMACrossoverStrategy } from './sma-crossover';
export { RSIStrategy } from './rsi';
export { MACDStrategy } from './macd';
export { BollingerStrategy } from './bollinger';
export { IchimokuStrategy } from './ichimoku';
export { VolumeProfileStrategy } from './volume-profile';

// Manager
export { StrategyManager, Strategy, StrategyWeight, AggregatedSignal } from './manager';

// Strategy factory for dynamic loading
export const AVAILABLE_STRATEGIES = [
  'SMA_Crossover',
  'RSI_Strategy', 
  'MACD_Strategy',
  'Bollinger_Bands',
  'Ichimoku_Cloud',
  'Volume_Profile'
] as const;

export type StrategyName = typeof AVAILABLE_STRATEGIES[number];
