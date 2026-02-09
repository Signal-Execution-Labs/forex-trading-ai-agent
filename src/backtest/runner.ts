#!/usr/bin/env node
/**
 * K.I.T. Backtest Runner
 * CLI interface for running backtests
 */

import { BacktestEngine, BacktestConfig } from './engine';
import { BacktestDataLoader, DataLoaderConfig } from './data-loader';
import { ReportGenerator } from './report';
import { Logger } from '../core/logger';
import { Strategy, Signal } from '../strategies/manager';
import { MarketData } from '../exchanges/manager';

// ===== CLI ARGUMENT PARSING =====

interface CLIArgs {
  // Data options
  symbol: string;
  exchange: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  dataFile?: string;
  
  // Backtest options
  capital: number;
  fee: number;
  slippage: number;
  maxPositions: number;
  positionSize: number;
  positionSizing: 'fixed' | 'percent' | 'kelly';
  stopLoss: number;
  takeProfit: number;
  allowShorts: boolean;
  leverage: number;
  
  // Strategy options
  strategy: string;
  lookback: number;
  
  // Output options
  output?: string;
  format: 'html' | 'json' | 'md' | 'console';
  verbose: boolean;
  
  // Misc
  help: boolean;
  synthetic: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    symbol: 'BTC/USDT',
    exchange: 'binance',
    timeframe: '1h',
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    capital: 10000,
    fee: 0.1,
    slippage: 0.05,
    maxPositions: 5,
    positionSize: 2,
    positionSizing: 'percent',
    stopLoss: 2,
    takeProfit: 4,
    allowShorts: true,
    leverage: 1,
    strategy: 'all',
    lookback: 50,
    format: 'console',
    verbose: false,
    help: false,
    synthetic: false
  };

  const argv = process.argv.slice(2);
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const nextArg = argv[i + 1];

    switch (arg) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-s':
      case '--symbol':
        args.symbol = nextArg;
        i++;
        break;
      case '-e':
      case '--exchange':
        args.exchange = nextArg;
        i++;
        break;
      case '-t':
      case '--timeframe':
        args.timeframe = nextArg;
        i++;
        break;
      case '--start':
        args.startDate = nextArg;
        i++;
        break;
      case '--end':
        args.endDate = nextArg;
        i++;
        break;
      case '-f':
      case '--file':
        args.dataFile = nextArg;
        i++;
        break;
      case '-c':
      case '--capital':
        args.capital = parseFloat(nextArg);
        i++;
        break;
      case '--fee':
        args.fee = parseFloat(nextArg);
        i++;
        break;
      case '--slippage':
        args.slippage = parseFloat(nextArg);
        i++;
        break;
      case '--max-positions':
        args.maxPositions = parseInt(nextArg);
        i++;
        break;
      case '--position-size':
        args.positionSize = parseFloat(nextArg);
        i++;
        break;
      case '--position-sizing':
        args.positionSizing = nextArg as any;
        i++;
        break;
      case '--stop-loss':
        args.stopLoss = parseFloat(nextArg);
        i++;
        break;
      case '--take-profit':
        args.takeProfit = parseFloat(nextArg);
        i++;
        break;
      case '--no-shorts':
        args.allowShorts = false;
        break;
      case '--leverage':
        args.leverage = parseFloat(nextArg);
        i++;
        break;
      case '--strategy':
        args.strategy = nextArg;
        i++;
        break;
      case '--lookback':
        args.lookback = parseInt(nextArg);
        i++;
        break;
      case '-o':
      case '--output':
        args.output = nextArg;
        i++;
        break;
      case '--format':
        args.format = nextArg as any;
        i++;
        break;
      case '-v':
      case '--verbose':
        args.verbose = true;
        break;
      case '--synthetic':
        args.synthetic = true;
        break;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║               K.I.T. BACKTEST RUNNER                        ║
╚══════════════════════════════════════════════════════════════╝

USAGE:
  npx ts-node src/backtest/runner.ts [options]
  npm run backtest -- [options]

DATA OPTIONS:
  -s, --symbol <symbol>      Trading pair (default: BTC/USDT)
  -e, --exchange <exchange>  Exchange name (default: binance)
  -t, --timeframe <tf>       Candle timeframe (default: 1h)
  --start <date>             Start date YYYY-MM-DD
  --end <date>               End date YYYY-MM-DD
  -f, --file <path>          Load data from CSV/JSON file
  --synthetic                Use synthetic data for testing

BACKTEST OPTIONS:
  -c, --capital <amount>     Initial capital (default: 10000)
  --fee <percent>            Trading fee % (default: 0.1)
  --slippage <percent>       Slippage % (default: 0.05)
  --max-positions <n>        Max concurrent positions (default: 5)
  --position-size <n>        Position size (default: 2)
  --position-sizing <type>   fixed|percent|kelly (default: percent)
  --stop-loss <percent>      Stop loss % (default: 2)
  --take-profit <percent>    Take profit % (default: 4)
  --no-shorts                Disable short positions
  --leverage <n>             Leverage multiplier (default: 1)

STRATEGY OPTIONS:
  --strategy <name>          Strategy to test (default: all)
                             Available: TrendFollower, MeanReversion,
                             Momentum, Breakout, all
  --lookback <n>             Candles for indicators (default: 50)

OUTPUT OPTIONS:
  -o, --output <path>        Output file path
  --format <fmt>             console|html|json|md (default: console)
  -v, --verbose              Show detailed logs

EXAMPLES:
  # Quick test with synthetic data
  npm run backtest -- --synthetic -v

  # Backtest BTC on Binance
  npm run backtest -- -s BTC/USDT -e binance --start 2024-01-01

  # Custom strategy with report
  npm run backtest -- --strategy MeanReversion -o report.html

  # Load from CSV file
  npm run backtest -- -f data/btc_history.csv --capital 50000
`);
}

// ===== BUILT-IN STRATEGIES =====

function createStrategies(): Strategy[] {
  return [
    // Trend Following Strategy
    {
      name: 'TrendFollower',
      description: 'Follows market trends using moving averages',
      configure: () => {},
      analyze: async (data: MarketData[]) => {
        const signals: Signal[] = [];
        
        for (const market of data) {
          const ohlcv = (market as any).ohlcv || [];
          if (ohlcv.length < 20) continue;

          // Simple SMA crossover
          const closes = ohlcv.map((c: any) => c.close);
          const sma10 = closes.slice(-10).reduce((a: number, b: number) => a + b, 0) / 10;
          const sma20 = closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
          
          const prevCloses = closes.slice(-11, -1);
          const prevSma10 = prevCloses.slice(-10).reduce((a: number, b: number) => a + b, 0) / 10;

          // Crossover detection
          if (sma10 > sma20 && prevSma10 <= sma20) {
            signals.push({
              symbol: market.symbol,
              exchange: market.exchange,
              side: 'buy',
              amount: 0.01,
              price: market.price,
              strategy: 'TrendFollower',
              confidence: 0.7,
              timestamp: new Date()
            });
          } else if (sma10 < sma20 && prevSma10 >= sma20) {
            signals.push({
              symbol: market.symbol,
              exchange: market.exchange,
              side: 'sell',
              amount: 0.01,
              price: market.price,
              strategy: 'TrendFollower',
              confidence: 0.7,
              timestamp: new Date()
            });
          }
        }
        
        return signals;
      }
    },

    // Mean Reversion Strategy
    {
      name: 'MeanReversion',
      description: 'Trades on mean reversion principles using Bollinger Bands',
      configure: () => {},
      analyze: async (data: MarketData[]) => {
        const signals: Signal[] = [];
        
        for (const market of data) {
          const ohlcv = (market as any).ohlcv || [];
          if (ohlcv.length < 20) continue;

          const closes = ohlcv.map((c: any) => c.close);
          const sma20 = closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
          
          // Calculate standard deviation
          const variance = closes.slice(-20).reduce((sum: number, val: number) => {
            return sum + Math.pow(val - sma20, 2);
          }, 0) / 20;
          const stdDev = Math.sqrt(variance);
          
          const upperBand = sma20 + (2 * stdDev);
          const lowerBand = sma20 - (2 * stdDev);
          const currentPrice = market.price;

          // Buy when price touches lower band
          if (currentPrice <= lowerBand) {
            signals.push({
              symbol: market.symbol,
              exchange: market.exchange,
              side: 'buy',
              amount: 0.01,
              price: market.price,
              strategy: 'MeanReversion',
              confidence: 0.65 + (0.1 * ((lowerBand - currentPrice) / stdDev)),
              timestamp: new Date()
            });
          }
          // Sell when price touches upper band
          else if (currentPrice >= upperBand) {
            signals.push({
              symbol: market.symbol,
              exchange: market.exchange,
              side: 'sell',
              amount: 0.01,
              price: market.price,
              strategy: 'MeanReversion',
              confidence: 0.65 + (0.1 * ((currentPrice - upperBand) / stdDev)),
              timestamp: new Date()
            });
          }
        }
        
        return signals;
      }
    },

    // Momentum Strategy
    {
      name: 'Momentum',
      description: 'Trades based on price momentum and RSI',
      configure: () => {},
      analyze: async (data: MarketData[]) => {
        const signals: Signal[] = [];
        
        for (const market of data) {
          const ohlcv = (market as any).ohlcv || [];
          if (ohlcv.length < 15) continue;

          const closes = ohlcv.map((c: any) => c.close);
          
          // Calculate RSI
          const changes = [];
          for (let i = 1; i < closes.length; i++) {
            changes.push(closes[i] - closes[i - 1]);
          }
          
          const gains = changes.slice(-14).filter(c => c > 0);
          const losses = changes.slice(-14).filter(c => c < 0).map(c => Math.abs(c));
          
          const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / 14 : 0;
          const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / 14 : 0;
          
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          const rsi = 100 - (100 / (1 + rs));

          // Oversold - buy signal
          if (rsi < 30) {
            signals.push({
              symbol: market.symbol,
              exchange: market.exchange,
              side: 'buy',
              amount: 0.01,
              price: market.price,
              strategy: 'Momentum',
              confidence: 0.6 + (0.3 * ((30 - rsi) / 30)),
              timestamp: new Date()
            });
          }
          // Overbought - sell signal
          else if (rsi > 70) {
            signals.push({
              symbol: market.symbol,
              exchange: market.exchange,
              side: 'sell',
              amount: 0.01,
              price: market.price,
              strategy: 'Momentum',
              confidence: 0.6 + (0.3 * ((rsi - 70) / 30)),
              timestamp: new Date()
            });
          }
        }
        
        return signals;
      }
    },

    // Breakout Strategy
    {
      name: 'Breakout',
      description: 'Trades breakouts from support/resistance levels',
      configure: () => {},
      analyze: async (data: MarketData[]) => {
        const signals: Signal[] = [];
        
        for (const market of data) {
          const ohlcv = (market as any).ohlcv || [];
          if (ohlcv.length < 20) continue;

          // Find recent high/low (excluding last candle)
          const recentCandles = ohlcv.slice(-21, -1);
          const recentHigh = Math.max(...recentCandles.map((c: any) => c.high));
          const recentLow = Math.min(...recentCandles.map((c: any) => c.low));
          
          const currentPrice = market.price;
          const range = recentHigh - recentLow;

          // Breakout above resistance
          if (currentPrice > recentHigh && range > 0) {
            const breakoutStrength = (currentPrice - recentHigh) / range;
            signals.push({
              symbol: market.symbol,
              exchange: market.exchange,
              side: 'buy',
              amount: 0.01,
              price: market.price,
              strategy: 'Breakout',
              confidence: Math.min(0.5 + breakoutStrength, 0.9),
              timestamp: new Date()
            });
          }
          // Breakdown below support
          else if (currentPrice < recentLow && range > 0) {
            const breakdownStrength = (recentLow - currentPrice) / range;
            signals.push({
              symbol: market.symbol,
              exchange: market.exchange,
              side: 'sell',
              amount: 0.01,
              price: market.price,
              strategy: 'Breakout',
              confidence: Math.min(0.5 + breakdownStrength, 0.9),
              timestamp: new Date()
            });
          }
        }
        
        return signals;
      }
    }
  ];
}

// ===== MAIN EXECUTION =====

async function main(): Promise<void> {
  const logger = new Logger('BacktestRunner');
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         🤖 K.I.T. BACKTEST RUNNER v1.0.0                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Load data
  const dataLoader = new BacktestDataLoader();
  let historicalData;

  try {
    if (args.dataFile) {
      // Load from file
      const ext = args.dataFile.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        historicalData = await dataLoader.loadFromCSV(args.dataFile, {
          startDate: new Date(args.startDate),
          endDate: new Date(args.endDate)
        });
      } else if (ext === 'json') {
        historicalData = await dataLoader.loadFromJSON(args.dataFile);
      } else {
        throw new Error('Unsupported file format. Use .csv or .json');
      }
    } else if (args.synthetic) {
      // Generate synthetic data
      logger.info('Generating synthetic data for testing...');
      historicalData = dataLoader.generateSyntheticData({
        symbol: args.symbol,
        startDate: new Date(args.startDate),
        endDate: new Date(args.endDate),
        timeframe: args.timeframe,
        startPrice: 50000,
        volatility: 2,
        trend: 0.01
      });
    } else {
      // Load from exchange
      const config: DataLoaderConfig = {
        exchange: args.exchange,
        symbol: args.symbol,
        timeframe: args.timeframe,
        startDate: new Date(args.startDate),
        endDate: new Date(args.endDate)
      };
      historicalData = await dataLoader.loadFromExchange(config);
    }

    logger.info(`Loaded ${historicalData.candles.length} candles`);

  } catch (error) {
    logger.error('Failed to load data:', error);
    process.exit(1);
  }

  // Configure engine
  const engineConfig: Partial<BacktestConfig> = {
    initialCapital: args.capital,
    feeRate: args.fee / 100,
    slippage: args.slippage / 100,
    maxPositions: args.maxPositions,
    positionSizing: args.positionSizing,
    positionSize: args.positionSize,
    useStopLoss: args.stopLoss > 0,
    stopLossPercent: args.stopLoss,
    useTakeProfit: args.takeProfit > 0,
    takeProfitPercent: args.takeProfit,
    allowShorts: args.allowShorts,
    leverage: args.leverage
  };

  const engine = new BacktestEngine(engineConfig);

  // Add strategies
  const allStrategies = createStrategies();
  
  if (args.strategy === 'all') {
    for (const strategy of allStrategies) {
      engine.addStrategy(strategy);
    }
  } else {
    const selectedStrategy = allStrategies.find(
      s => s.name.toLowerCase() === args.strategy.toLowerCase()
    );
    if (selectedStrategy) {
      engine.addStrategy(selectedStrategy);
    } else {
      logger.error(`Unknown strategy: ${args.strategy}`);
      logger.info(`Available strategies: ${allStrategies.map(s => s.name).join(', ')}`);
      process.exit(1);
    }
  }

  // Progress tracking
  engine.on('progress', ({ percent }) => {
    if (args.verbose) {
      process.stdout.write(`\rProgress: ${percent}%`);
    }
  });

  // Run backtest
  logger.info('Starting backtest...');
  const result = await engine.run(historicalData, args.lookback);

  // Generate output
  const reporter = new ReportGenerator();

  switch (args.format) {
    case 'console':
      reporter.printSummary(result);
      break;
    case 'html':
      const htmlPath = args.output || `reports/backtest_${Date.now()}.html`;
      await reporter.saveReport(result, htmlPath);
      logger.info(`HTML report saved to ${htmlPath}`);
      break;
    case 'json':
      const jsonPath = args.output || `reports/backtest_${Date.now()}.json`;
      await reporter.saveReport(result, jsonPath);
      logger.info(`JSON report saved to ${jsonPath}`);
      break;
    case 'md':
      const mdPath = args.output || `reports/backtest_${Date.now()}.md`;
      await reporter.saveReport(result, mdPath);
      logger.info(`Markdown report saved to ${mdPath}`);
      break;
  }

  // Always print summary to console
  if (args.format !== 'console') {
    reporter.printSummary(result);
  }

  logger.info('Backtest complete!');
}

// Run if called directly
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Export for programmatic use
export { BacktestEngine, BacktestDataLoader, ReportGenerator };
export * from './engine';
export * from './data-loader';
export * from './metrics';
export * from './report';
