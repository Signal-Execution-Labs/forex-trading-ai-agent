/**
 * Signal Bot Skill
 * 
 * Intelligent signal execution engine with professional order management.
 * Receives signals from any source and executes with TP, SL, DCA automation.
 */

export {
  SignalBot,
  TelegramSignalParser,
  SignalScorer,
  SignalFilterEngine,
  PositionManager,
  createSignalBotRouter,
  type Signal,
  type SignalFilter,
  type SignalBotConfig,
  type Position,
  type SignalStats,
  type TakeProfitConfig,
  type StopLossConfig,
  type DCAConfig
} from './signal-bot';

// Quick-start functions

import { SignalBot, SignalBotConfig } from './signal-bot';

/**
 * Create a basic signal bot for webhook signals
 */
export function createWebhookBot(
  exchanges: string[],
  riskPercent = 1
): SignalBot {
  return new SignalBot({
    exchanges,
    sizeMode: 'risk-percent',
    riskPercent,
    autoTakeProfit: {
      enabled: true,
      targets: [
        { percent: 2, closePercent: 50 },
        { percent: 5, closePercent: 100 }
      ]
    },
    autoStopLoss: {
      enabled: true,
      percent: 2
    },
    maxConcurrentTrades: 5
  });
}

/**
 * Create a signal bot with DCA support
 */
export function createDCASignalBot(
  exchanges: string[],
  riskPercent = 1
): SignalBot {
  return new SignalBot({
    exchanges,
    sizeMode: 'risk-percent',
    riskPercent,
    autoTakeProfit: {
      enabled: true,
      targets: [
        { percent: 3, closePercent: 50 },
        { percent: 6, closePercent: 100 }
      ]
    },
    autoStopLoss: {
      enabled: true,
      percent: 5
    },
    autoDCA: {
      enabled: true,
      levels: [
        { dropPercent: 2, sizeMultiplier: 1.5 },
        { dropPercent: 4, sizeMultiplier: 2 },
        { dropPercent: 6, sizeMultiplier: 2.5 }
      ],
      maxOrders: 3
    },
    maxConcurrentTrades: 3
  });
}

/**
 * Create a filtered signal bot (only trades high-quality signals)
 */
export function createFilteredBot(
  exchanges: string[],
  minScore = 0.7
): SignalBot {
  return new SignalBot({
    exchanges,
    sizeMode: 'risk-percent',
    riskPercent: 1,
    filter: {
      minSignalScore: minScore,
      maxDailyTrades: 5,
      rsiRange: [25, 75],
      timeWindows: ['08:00-12:00', '14:00-18:00']
    },
    autoTakeProfit: {
      enabled: true,
      targets: [{ percent: 3, closePercent: 100 }]
    },
    autoStopLoss: {
      enabled: true,
      percent: 2
    }
  });
}

export default SignalBot;
