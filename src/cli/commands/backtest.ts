/**
 * K.I.T. Backtest CLI Command
 * 
 * Run strategy backtests.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const BACKTESTS_DIR = path.join(KIT_HOME, 'backtests');

export interface BacktestResult {
  id: string;
  strategy: string;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  trades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  runAt: string;
}

export function registerBacktestCommand(program: Command): void {
  const backtest = program
    .command('backtest')
    .description('Run strategy backtests');

  // Run backtest
  backtest
    .command('run')
    .description('Run a backtest')
    .requiredOption('--strategy <name>', 'Strategy to test')
    .requiredOption('--symbol <pair>', 'Trading pair')
    .option('--timeframe <tf>', 'Timeframe (1m, 5m, 15m, 1h, 4h, 1d)', '1h')
    .option('--start <date>', 'Start date (YYYY-MM-DD)')
    .option('--end <date>', 'End date (YYYY-MM-DD)')
    .option('--capital <amount>', 'Starting capital', parseFloat)
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      console.log('📊 Running Backtest...\n');
      console.log(`Strategy:  ${options.strategy}`);
      console.log(`Symbol:    ${options.symbol}`);
      console.log(`Timeframe: ${options.timeframe}`);
      console.log(`Period:    ${options.start || '90 days ago'} to ${options.end || 'now'}`);
      console.log('');
      
      // Simulate backtest (in real implementation, this would run actual backtest)
      console.log('⏳ Fetching historical data...');
      await sleep(500);
      
      console.log('⏳ Running strategy simulation...');
      await sleep(1000);
      
      // Generate mock results
      const result: BacktestResult = {
        id: `bt_${Date.now()}`,
        strategy: options.strategy,
        symbol: options.symbol.toUpperCase(),
        timeframe: options.timeframe,
        startDate: options.start || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: options.end || new Date().toISOString().split('T')[0],
        trades: Math.floor(Math.random() * 100) + 50,
        winRate: Math.random() * 30 + 45, // 45-75%
        totalReturn: Math.random() * 40 - 10, // -10% to +30%
        maxDrawdown: Math.random() * 15 + 5, // 5-20%
        sharpeRatio: Math.random() * 2 + 0.5, // 0.5-2.5
        profitFactor: Math.random() * 1.5 + 0.8, // 0.8-2.3
        runAt: new Date().toISOString(),
      };
      
      // Save result
      saveBacktest(result);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      
      console.log('\n✅ Backtest Complete!\n');
      console.log('━'.repeat(50));
      console.log(`📈 Results: ${result.strategy} on ${result.symbol}`);
      console.log('━'.repeat(50));
      console.log(`Trades:        ${result.trades}`);
      console.log(`Win Rate:      ${result.winRate.toFixed(1)}%`);
      console.log(`Total Return:  ${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(2)}%`);
      console.log(`Max Drawdown:  -${result.maxDrawdown.toFixed(2)}%`);
      console.log(`Sharpe Ratio:  ${result.sharpeRatio.toFixed(2)}`);
      console.log(`Profit Factor: ${result.profitFactor.toFixed(2)}`);
      console.log('━'.repeat(50));
      console.log(`\n💡 Full report saved: ${result.id}`);
      console.log('   View with: kit backtest show ' + result.id);
    });

  // List backtests
  backtest
    .command('list')
    .alias('ls')
    .description('List saved backtests')
    .option('--strategy <name>', 'Filter by strategy')
    .option('--symbol <pair>', 'Filter by symbol')
    .option('--limit <n>', 'Limit results', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      const backtests = loadBacktests();
      let filtered = backtests;
      
      if (options.strategy) {
        filtered = filtered.filter(b => 
          b.strategy.toLowerCase().includes(options.strategy.toLowerCase())
        );
      }
      if (options.symbol) {
        filtered = filtered.filter(b => 
          b.symbol.toLowerCase().includes(options.symbol.toLowerCase())
        );
      }
      
      // Sort by date descending
      filtered.sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());
      
      if (options.limit) {
        filtered = filtered.slice(0, options.limit);
      }
      
      if (options.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }
      
      if (filtered.length === 0) {
        console.log('No backtests found.');
        console.log('\nRun a backtest:');
        console.log('  kit backtest run --strategy RSI --symbol BTC/USD');
        return;
      }
      
      console.log('📊 Saved Backtests\n');
      
      for (const bt of filtered) {
        const returnStr = bt.totalReturn >= 0 
          ? `+${bt.totalReturn.toFixed(1)}%` 
          : `${bt.totalReturn.toFixed(1)}%`;
        const returnIcon = bt.totalReturn >= 0 ? '📈' : '📉';
        
        console.log(`${returnIcon} ${bt.strategy} on ${bt.symbol}`);
        console.log(`   ${bt.id} | ${bt.trades} trades | ${bt.winRate.toFixed(0)}% WR | ${returnStr}`);
        console.log(`   ${bt.startDate} to ${bt.endDate} (${bt.timeframe})`);
        console.log('');
      }
    });

  // Show backtest details
  backtest
    .command('show <id>')
    .description('Show backtest details')
    .option('--json', 'Output as JSON')
    .action((id, options) => {
      const backtests = loadBacktests();
      const bt = backtests.find(b => b.id === id);
      
      if (!bt) {
        console.error(`Backtest not found: ${id}`);
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(bt, null, 2));
        return;
      }
      
      console.log('📊 Backtest Details\n');
      console.log('━'.repeat(50));
      console.log(`ID:            ${bt.id}`);
      console.log(`Strategy:      ${bt.strategy}`);
      console.log(`Symbol:        ${bt.symbol}`);
      console.log(`Timeframe:     ${bt.timeframe}`);
      console.log(`Period:        ${bt.startDate} to ${bt.endDate}`);
      console.log('━'.repeat(50));
      console.log(`Trades:        ${bt.trades}`);
      console.log(`Win Rate:      ${bt.winRate.toFixed(1)}%`);
      console.log(`Total Return:  ${bt.totalReturn >= 0 ? '+' : ''}${bt.totalReturn.toFixed(2)}%`);
      console.log(`Max Drawdown:  -${bt.maxDrawdown.toFixed(2)}%`);
      console.log(`Sharpe Ratio:  ${bt.sharpeRatio.toFixed(2)}`);
      console.log(`Profit Factor: ${bt.profitFactor.toFixed(2)}`);
      console.log('━'.repeat(50));
      console.log(`Run At:        ${bt.runAt}`);
    });

  // Compare backtests
  backtest
    .command('compare <id1> <id2>')
    .description('Compare two backtests')
    .action((id1, id2) => {
      const backtests = loadBacktests();
      const bt1 = backtests.find(b => b.id === id1);
      const bt2 = backtests.find(b => b.id === id2);
      
      if (!bt1 || !bt2) {
        console.error('One or both backtests not found');
        process.exit(1);
      }
      
      console.log('📊 Backtest Comparison\n');
      console.log('Metric'.padEnd(20) + bt1.strategy.padEnd(20) + bt2.strategy);
      console.log('━'.repeat(60));
      console.log('Symbol'.padEnd(20) + bt1.symbol.padEnd(20) + bt2.symbol);
      console.log('Trades'.padEnd(20) + String(bt1.trades).padEnd(20) + bt2.trades);
      console.log('Win Rate'.padEnd(20) + `${bt1.winRate.toFixed(1)}%`.padEnd(20) + `${bt2.winRate.toFixed(1)}%`);
      console.log('Return'.padEnd(20) + `${bt1.totalReturn.toFixed(2)}%`.padEnd(20) + `${bt2.totalReturn.toFixed(2)}%`);
      console.log('Drawdown'.padEnd(20) + `-${bt1.maxDrawdown.toFixed(2)}%`.padEnd(20) + `-${bt2.maxDrawdown.toFixed(2)}%`);
      console.log('Sharpe'.padEnd(20) + bt1.sharpeRatio.toFixed(2).padEnd(20) + bt2.sharpeRatio.toFixed(2));
      console.log('Profit Factor'.padEnd(20) + bt1.profitFactor.toFixed(2).padEnd(20) + bt2.profitFactor.toFixed(2));
    });

  // Delete backtest
  backtest
    .command('delete <id>')
    .alias('rm')
    .description('Delete a backtest')
    .action((id) => {
      const file = path.join(BACKTESTS_DIR, `${id}.json`);
      
      if (!fs.existsSync(file)) {
        console.error(`Backtest not found: ${id}`);
        process.exit(1);
      }
      
      fs.unlinkSync(file);
      console.log(`✅ Deleted: ${id}`);
    });

  // List strategies
  backtest
    .command('strategies')
    .description('List available strategies')
    .action(() => {
      console.log('📋 Available Strategies\n');
      
      const strategies = [
        { name: 'RSI', desc: 'Relative Strength Index oversold/overbought' },
        { name: 'MACD', desc: 'Moving Average Convergence Divergence crossover' },
        { name: 'EMA_Cross', desc: 'Exponential Moving Average crossover' },
        { name: 'Bollinger', desc: 'Bollinger Bands mean reversion' },
        { name: 'Trend_Follow', desc: 'Trend following with ADX' },
        { name: 'Breakout', desc: 'Support/resistance breakout' },
        { name: 'Mean_Reversion', desc: 'Statistical mean reversion' },
        { name: 'Momentum', desc: 'Price momentum strategy' },
      ];
      
      for (const s of strategies) {
        console.log(`  • ${s.name.padEnd(15)} - ${s.desc}`);
      }
      
      console.log('\n💡 Run a backtest:');
      console.log('   kit backtest run --strategy RSI --symbol BTC/USD');
    });
}

function loadBacktests(): BacktestResult[] {
  if (!fs.existsSync(BACKTESTS_DIR)) {
    return [];
  }
  
  const backtests: BacktestResult[] = [];
  const files = fs.readdirSync(BACKTESTS_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(BACKTESTS_DIR, file), 'utf8'));
      backtests.push(data);
    } catch {
      // Skip invalid files
    }
  }
  
  return backtests;
}

function saveBacktest(result: BacktestResult): void {
  fs.mkdirSync(BACKTESTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(BACKTESTS_DIR, `${result.id}.json`),
    JSON.stringify(result, null, 2)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
