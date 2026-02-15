/**
 * K.I.T. Autonomous Trading Tools
 * Allows users to say "manage my €1000" and K.I.T. handles the rest
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const KIT_DIR = path.join(os.homedir(), '.kit');
const AUTONOMOUS_DIR = path.join(KIT_DIR, 'autonomous-trading');

interface AutonomousConfig {
  capital: number;
  currency: string;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  markets: string[];
  duration?: string;
}

// Ensure autonomous trading directory exists
function ensureDir() {
  if (!fs.existsSync(AUTONOMOUS_DIR)) {
    fs.mkdirSync(AUTONOMOUS_DIR, { recursive: true });
  }
  const logsDir = path.join(AUTONOMOUS_DIR, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

// Risk profiles
const RISK_PROFILES = {
  conservative: {
    maxPositionSizePercent: 5,
    maxDailyDrawdownPercent: 10,
    maxTotalDrawdownPercent: 15,
    maxOpenPositions: 3,
    defaultStopLossPercent: 1.5,
    defaultTakeProfitPercent: 3,
    minConfidenceScore: 80
  },
  moderate: {
    maxPositionSizePercent: 10,
    maxDailyDrawdownPercent: 15,
    maxTotalDrawdownPercent: 25,
    maxOpenPositions: 5,
    defaultStopLossPercent: 2,
    defaultTakeProfitPercent: 4,
    minConfidenceScore: 70
  },
  aggressive: {
    maxPositionSizePercent: 20,
    maxDailyDrawdownPercent: 25,
    maxTotalDrawdownPercent: 40,
    maxOpenPositions: 8,
    defaultStopLossPercent: 3,
    defaultTakeProfitPercent: 6,
    minConfidenceScore: 60
  }
};

/**
 * Start autonomous trading with user's capital
 */
export async function startAutonomousTrading(config: AutonomousConfig): Promise<string> {
  ensureDir();
  
  const riskProfile = RISK_PROFILES[config.riskLevel] || RISK_PROFILES.moderate;
  
  // Create config.json
  const tradingConfig = {
    name: "K.I.T. Autonomous Trader",
    version: "1.0.0",
    mode: "paper", // Always start with paper trading for safety
    startDate: new Date().toISOString().split('T')[0],
    owner: "User",
    capital: {
      initial: config.capital,
      currency: config.currency,
      currentBalance: config.capital
    },
    riskManagement: {
      ...riskProfile,
      useStopLoss: true,
      useTakeProfit: true,
      riskRewardMinimum: 1.5
    },
    markets: {
      crypto: {
        enabled: config.markets.includes('crypto'),
        symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"],
        exchange: "binance_paper",
        maxAllocationPercent: 70
      },
      forex: {
        enabled: config.markets.includes('forex'),
        symbols: ["EURUSD", "GBPUSD", "USDJPY"],
        exchange: "mt5_paper",
        maxAllocationPercent: 20,
        note: "Requires MT5 or API keys for Alpha Vantage/Twelve Data"
      },
      indices: {
        enabled: config.markets.includes('indices'),
        symbols: ["US500", "US100", "GER40"],
        exchange: "mt5_paper",
        maxAllocationPercent: 10,
        note: "Requires MT5 connection"
      }
    },
    strategy: {
      mode: "autonomous",
      decisionMaker: "ai",
      tradingHours: "24/7",
      minConfidenceScore: riskProfile.minConfidenceScore
    },
    reporting: {
      dailyReport: true,
      reportTime: "20:00"
    }
  };
  
  // Create state.json
  const state = {
    status: "active",
    startedAt: new Date().toISOString(),
    lastUpdate: null,
    portfolio: {
      initialCapital: config.capital,
      currentCapital: config.capital,
      currency: config.currency,
      totalPnL: 0,
      totalPnLPercent: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      highWaterMark: config.capital,
      maxDrawdown: 0,
      maxDrawdownPercent: 0
    },
    positions: [],
    statistics: {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      largestWin: 0,
      largestLoss: 0
    },
    tradeHistory: [],
    decisions: []
  };
  
  // Write files
  fs.writeFileSync(
    path.join(AUTONOMOUS_DIR, 'config.json'),
    JSON.stringify(tradingConfig, null, 2)
  );
  
  fs.writeFileSync(
    path.join(AUTONOMOUS_DIR, 'state.json'),
    JSON.stringify(state, null, 2)
  );
  
  // Copy trader.py if not exists
  const traderSrc = path.join(__dirname, '..', '..', 'examples', 'autonomous-trader.py');
  const traderDest = path.join(AUTONOMOUS_DIR, 'trader.py');
  if (fs.existsSync(traderSrc) && !fs.existsSync(traderDest)) {
    fs.copyFileSync(traderSrc, traderDest);
  }
  
  // Run first cycle
  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const result = execSync(`${pythonCmd} "${path.join(AUTONOMOUS_DIR, 'trader.py')}"`, {
      encoding: 'utf8',
      timeout: 60000,
      cwd: AUTONOMOUS_DIR
    });
    
    return `✅ Autonomous trading started!

📊 Configuration:
• Capital: ${config.currency} ${config.capital.toLocaleString()}
• Risk Level: ${config.riskLevel}
• Markets: ${config.markets.join(', ')}

🤖 K.I.T. is now analyzing markets and will trade autonomously.

📁 Files: ~/.kit/autonomous-trading/
📈 First cycle complete!

${result.includes('Position') ? result : 'Waiting for good trading opportunities...'}`;
  } catch (error: any) {
    return `⚠️ Autonomous trading configured but first cycle had issues:
${error.message}

Configuration saved. Will retry on next cycle.`;
  }
}

/**
 * Get current autonomous trading status
 */
export function getAutonomousStatus(): string {
  const statePath = path.join(AUTONOMOUS_DIR, 'state.json');
  
  if (!fs.existsSync(statePath)) {
    return '❌ No autonomous trading active. Say "manage my €X" to start!';
  }
  
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const portfolio = state.portfolio;
    const stats = state.statistics;
    
    const pnlEmoji = portfolio.totalPnL >= 0 ? '📈' : '📉';
    
    return `🤖 K.I.T. Autonomous Trading Status

💰 Portfolio:
• Initial: ${portfolio.currency} ${portfolio.initialCapital.toLocaleString()}
• Current: ${portfolio.currency} ${portfolio.currentCapital.toLocaleString()}
• P&L: ${portfolio.currency} ${portfolio.totalPnL >= 0 ? '+' : ''}${portfolio.totalPnL.toFixed(2)} (${portfolio.totalPnLPercent >= 0 ? '+' : ''}${portfolio.totalPnLPercent.toFixed(1)}%) ${pnlEmoji}

📊 Statistics:
• Trades: ${stats.totalTrades}
• Win Rate: ${stats.winRate.toFixed(1)}%
• Profit Factor: ${stats.profitFactor.toFixed(2)}

📍 Open Positions: ${state.positions?.length || 0}
${state.positions?.map((p: any) => `  • ${p.symbol}: ${p.direction} @ ${p.entryPrice}`).join('\n') || '  None'}

⏰ Last Update: ${state.lastUpdate || 'Never'}`;
  } catch (error) {
    return '⚠️ Error reading trading state. Files may be corrupted.';
  }
}

/**
 * Stop autonomous trading
 */
export function stopAutonomousTrading(): string {
  const statePath = path.join(AUTONOMOUS_DIR, 'state.json');
  
  if (!fs.existsSync(statePath)) {
    return '❌ No autonomous trading active.';
  }
  
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.status = 'stopped';
    state.stoppedAt = new Date().toISOString();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    
    const portfolio = state.portfolio;
    return `⏹️ Autonomous trading stopped.

📊 Final Results:
• Initial: ${portfolio.currency} ${portfolio.initialCapital.toLocaleString()}
• Final: ${portfolio.currency} ${portfolio.currentCapital.toLocaleString()}
• Total P&L: ${portfolio.currency} ${portfolio.totalPnL >= 0 ? '+' : ''}${portfolio.totalPnL.toFixed(2)} (${portfolio.totalPnLPercent.toFixed(1)}%)
• Total Trades: ${state.statistics.totalTrades}
• Win Rate: ${state.statistics.winRate.toFixed(1)}%

Trade history saved to ~/.kit/autonomous-trading/state.json`;
  } catch (error) {
    return '⚠️ Error stopping trading. Check files manually.';
  }
}

/**
 * Tool definitions for the AI agent
 */
export const autonomousTools = [
  {
    name: 'autonomous_start',
    description: 'Start autonomous trading. Use when user says things like "manage my money", "invest €1000", "trade for me", "grow my savings".',
    parameters: {
      type: 'object',
      properties: {
        capital: {
          type: 'number',
          description: 'Amount to trade with (e.g., 1000)'
        },
        currency: {
          type: 'string',
          description: 'Currency (EUR, USD, GBP)',
          default: 'EUR'
        },
        riskLevel: {
          type: 'string',
          enum: ['conservative', 'moderate', 'aggressive'],
          description: 'Risk tolerance level',
          default: 'moderate'
        },
        markets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Markets to trade (crypto, forex, indices). Note: forex/indices require MT5 or API keys.',
          default: ['crypto']
        }
      },
      required: ['capital']
    },
    handler: async (params: any) => {
      return startAutonomousTrading({
        capital: params.capital,
        currency: params.currency || 'EUR',
        riskLevel: params.riskLevel || 'moderate',
        markets: params.markets || ['crypto']
      });
    }
  },
  {
    name: 'autonomous_status',
    description: 'Check current autonomous trading status, portfolio, P&L, and open positions.',
    parameters: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      return getAutonomousStatus();
    }
  },
  {
    name: 'autonomous_stop',
    description: 'Stop autonomous trading and get final results.',
    parameters: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      return stopAutonomousTrading();
    }
  }
];

export default autonomousTools;
