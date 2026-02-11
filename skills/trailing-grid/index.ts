/**
 * K.I.T. Trailing Grid Bot Skill
 * 
 * Grid trading with automatic trailing - never miss a trend!
 */

export { 
  TrailingGridBot, 
  InfinityTrailingBot,
  quickStart,
  optimize 
} from './trailing-grid';

export const skillInfo = {
  name: 'trailing-grid',
  description: 'Advanced grid trading with auto-trailing. Grid follows price to stay in range.',
  version: '1.0.0',
  author: 'K.I.T.',
  category: 'trading-bots',
  features: [
    'Trailing Up - Grid shifts upward as price rises',
    'Trailing Down - Grid shifts downward as price falls',
    'Infinity Trailing - No upper limit with trailing stops',
    'AI Parameter Optimization - Analyzes historical data',
    'Dynamic Profit Per Grid - Adjusts based on volatility'
  ],
  exchanges: ['binance', 'bybit', 'okx', 'kraken', 'kucoin'],
  commands: [
    'kit trailing-grid start --symbol BTCUSDT --lower 40000 --upper 50000 --grids 20 --investment 2000 --trail-up',
    'kit trailing-grid optimize --symbol BTCUSDT --investment 5000 --days 30',
    'kit trailing-grid status',
    'kit trailing-grid stop --symbol BTCUSDT'
  ]
};
