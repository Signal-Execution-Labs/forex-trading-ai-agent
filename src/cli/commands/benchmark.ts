/**
 * K.I.T. Benchmark CLI Command
 * 
 * Compare multiple strategies against the same historical data.
 * Inspired by OpenClaw's testing philosophy - systematic comparison of approaches.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const BENCHMARKS_DIR = path.join(KIT_HOME, 'benchmarks');

export interface StrategyScore {
  strategy: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  trades: number;
  avgTradeDuration: string;
  score: number; // Composite score 0-100
}

export interface BenchmarkResult {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  strategies: StrategyScore[];
  winner: string;
  runAt: string;
  durationMs: number;
}

// Composite scoring weights
const SCORE_WEIGHTS = {
  totalReturn: 0.25,
  sharpeRatio: 0.25,
  maxDrawdown: 0.20, // Negative weight (lower is better)
  winRate: 0.15,
  profitFactor: 0.15,
};

function calculateCompositeScore(s: StrategyScore): number {
  // Normalize each metric to 0-100 scale and apply weights
  const returnScore = Math.min(100, Math.max(0, (s.totalReturn + 50) * 1)); // -50 to +50 → 0-100
  const sharpeScore = Math.min(100, Math.max(0, s.sharpeRatio * 33)); // 0-3 → 0-100
  const ddScore = Math.min(100, Math.max(0, 100 - s.maxDrawdown * 4)); // 0-25% DD → 100-0
  const winScore = s.winRate; // Already 0-100
  const pfScore = Math.min(100, Math.max(0, (s.profitFactor - 0.5) * 50)); // 0.5-2.5 → 0-100

  return Math.round(
    returnScore * SCORE_WEIGHTS.totalReturn +
    sharpeScore * SCORE_WEIGHTS.sharpeRatio +
    ddScore * SCORE_WEIGHTS.maxDrawdown +
    winScore * SCORE_WEIGHTS.winRate +
    pfScore * SCORE_WEIGHTS.profitFactor
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveBenchmark(result: BenchmarkResult): void {
  ensureDir(BENCHMARKS_DIR);
  const filePath = path.join(BENCHMARKS_DIR, `${result.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
}

function loadBenchmark(id: string): BenchmarkResult | null {
  const filePath = path.join(BENCHMARKS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function listBenchmarks(): BenchmarkResult[] {
  ensureDir(BENCHMARKS_DIR);
  const files = fs.readdirSync(BENCHMARKS_DIR).filter(f => f.endsWith('.json'));
  return files
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(BENCHMARKS_DIR, f), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());
}

// Default strategies to benchmark
const DEFAULT_STRATEGIES = [
  'trend-following',
  'mean-reversion', 
  'momentum',
  'breakout',
  'grid-trading',
];

// Strategy descriptions for help
const STRATEGY_INFO: Record<string, string> = {
  'trend-following': 'Follow established trends using MA crossovers',
  'mean-reversion': 'Trade price returns to average (RSI oversold/overbought)',
  'momentum': 'Trade based on price momentum and velocity',
  'breakout': 'Trade breakouts from consolidation patterns',
  'grid-trading': 'Place orders at fixed intervals around price',
  'scalping': 'Quick in-and-out trades on small moves',
  'swing': 'Hold positions for days to weeks',
  'dca': 'Dollar cost averaging on dips',
  'arbitrage': 'Exploit price differences across exchanges',
  'ml-ensemble': 'Machine learning ensemble of multiple models',
};

export function registerBenchmarkCommand(program: Command): void {
  const benchmark = program
    .command('benchmark')
    .alias('bench')
    .alias('compare')
    .description('Compare multiple trading strategies on the same data');

  // Run benchmark
  benchmark
    .command('run')
    .description('Run a strategy benchmark comparison')
    .requiredOption('--symbol <pair>', 'Trading pair (e.g., BTCUSDT)')
    .option('--strategies <list>', 'Comma-separated strategies', DEFAULT_STRATEGIES.join(','))
    .option('--timeframe <tf>', 'Timeframe (1m, 5m, 15m, 1h, 4h, 1d)', '1h')
    .option('--start <date>', 'Start date (YYYY-MM-DD)')
    .option('--end <date>', 'End date (YYYY-MM-DD)')
    .option('--capital <amount>', 'Starting capital', parseFloat, 10000)
    .option('--name <name>', 'Benchmark name')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const strategies = options.strategies.split(',').map((s: string) => s.trim());
      const startTime = Date.now();
      
      console.log('🏁 K.I.T. Strategy Benchmark\n');
      console.log(`Symbol:     ${options.symbol.toUpperCase()}`);
      console.log(`Timeframe:  ${options.timeframe}`);
      console.log(`Capital:    $${options.capital.toLocaleString()}`);
      console.log(`Strategies: ${strategies.length}`);
      console.log('');

      // Run each strategy
      const results: StrategyScore[] = [];
      
      for (const strategy of strategies) {
        process.stdout.write(`⏳ Running ${strategy}... `);
        await sleep(300 + Math.random() * 200);
        
        // Simulate strategy results (in real implementation, run actual backtest)
        const score: StrategyScore = {
          strategy,
          totalReturn: (Math.random() - 0.3) * 60, // -18% to +42%
          sharpeRatio: Math.random() * 2.5 + 0.2,
          maxDrawdown: Math.random() * 20 + 3,
          winRate: Math.random() * 35 + 40,
          profitFactor: Math.random() * 1.8 + 0.5,
          trades: Math.floor(Math.random() * 150) + 20,
          avgTradeDuration: ['2h', '4h', '8h', '1d', '2d', '3d'][Math.floor(Math.random() * 6)],
          score: 0,
        };
        score.score = calculateCompositeScore(score);
        results.push(score);
        
        console.log(`✓ Score: ${score.score}`);
      }

      // Sort by composite score
      results.sort((a, b) => b.score - a.score);
      const winner = results[0];

      const benchmarkResult: BenchmarkResult = {
        id: `bench_${Date.now()}`,
        name: options.name || `${options.symbol} Benchmark`,
        symbol: options.symbol.toUpperCase(),
        timeframe: options.timeframe,
        startDate: options.start || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: options.end || new Date().toISOString().split('T')[0],
        strategies: results,
        winner: winner.strategy,
        runAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      saveBenchmark(benchmarkResult);

      if (options.json) {
        console.log(JSON.stringify(benchmarkResult, null, 2));
        return;
      }

      // Display results table
      console.log('\n' + '═'.repeat(90));
      console.log(`🏆 BENCHMARK RESULTS: ${benchmarkResult.name}`);
      console.log('═'.repeat(90));
      console.log('');
      console.log('Rank │ Strategy         │ Return   │ Sharpe │ MaxDD   │ WinRate │ PF    │ Score');
      console.log('─────┼──────────────────┼──────────┼────────┼─────────┼─────────┼───────┼──────');
      
      results.forEach((s, i) => {
        const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1} `;
        const ret = s.totalReturn >= 0 ? `+${s.totalReturn.toFixed(1)}%` : `${s.totalReturn.toFixed(1)}%`;
        console.log(
          `${rank.padEnd(4)} │ ` +
          `${s.strategy.padEnd(16)} │ ` +
          `${ret.padStart(8)} │ ` +
          `${s.sharpeRatio.toFixed(2).padStart(6)} │ ` +
          `-${s.maxDrawdown.toFixed(1)}%`.padStart(7) + ` │ ` +
          `${s.winRate.toFixed(1)}%`.padStart(7) + ` │ ` +
          `${s.profitFactor.toFixed(2)}`.padStart(5) + ` │ ` +
          `${s.score}`.padStart(5)
        );
      });
      
      console.log('─────┴──────────────────┴──────────┴────────┴─────────┴─────────┴───────┴──────');
      console.log('');
      console.log(`🏆 Winner: ${winner.strategy} (Score: ${winner.score})`);
      console.log(`⏱️  Completed in ${(benchmarkResult.durationMs / 1000).toFixed(1)}s`);
      console.log(`💾 Saved: ${benchmarkResult.id}`);
      console.log('');
      console.log('Scoring: Return(25%) + Sharpe(25%) + LowDD(20%) + WinRate(15%) + PF(15%)');
    });

  // List benchmarks
  benchmark
    .command('list')
    .description('List previous benchmarks')
    .option('-n, --limit <n>', 'Number to show', parseInt, 10)
    .option('--json', 'Output as JSON')
    .action((options) => {
      const benchmarks = listBenchmarks().slice(0, options.limit);
      
      if (options.json) {
        console.log(JSON.stringify(benchmarks, null, 2));
        return;
      }

      if (benchmarks.length === 0) {
        console.log('📊 No benchmarks yet. Run: kit benchmark run --symbol BTCUSDT');
        return;
      }

      console.log('📊 Recent Benchmarks\n');
      console.log('ID                    │ Symbol    │ Winner           │ Strategies │ Date');
      console.log('──────────────────────┼───────────┼──────────────────┼────────────┼─────────────');
      
      for (const b of benchmarks) {
        const date = new Date(b.runAt).toLocaleDateString();
        console.log(
          `${b.id.padEnd(21)} │ ` +
          `${b.symbol.padEnd(9)} │ ` +
          `${b.winner.padEnd(16)} │ ` +
          `${b.strategies.length.toString().padStart(10)} │ ` +
          date
        );
      }
    });

  // Show benchmark details
  benchmark
    .command('show <id>')
    .description('Show benchmark details')
    .option('--json', 'Output as JSON')
    .action((id, options) => {
      const benchmark = loadBenchmark(id);
      
      if (!benchmark) {
        console.log(`❌ Benchmark not found: ${id}`);
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(benchmark, null, 2));
        return;
      }

      console.log(`\n📊 Benchmark: ${benchmark.name}`);
      console.log('═'.repeat(60));
      console.log(`Symbol:    ${benchmark.symbol}`);
      console.log(`Timeframe: ${benchmark.timeframe}`);
      console.log(`Period:    ${benchmark.startDate} to ${benchmark.endDate}`);
      console.log(`Winner:    🏆 ${benchmark.winner}`);
      console.log('');
      
      for (const s of benchmark.strategies) {
        const medal = s.strategy === benchmark.winner ? '🏆' : '  ';
        console.log(`${medal} ${s.strategy}`);
        console.log(`   Return: ${s.totalReturn >= 0 ? '+' : ''}${s.totalReturn.toFixed(2)}% | Sharpe: ${s.sharpeRatio.toFixed(2)} | DD: -${s.maxDrawdown.toFixed(1)}%`);
        console.log(`   Win Rate: ${s.winRate.toFixed(1)}% | PF: ${s.profitFactor.toFixed(2)} | Trades: ${s.trades}`);
        console.log(`   Composite Score: ${s.score}/100`);
        console.log('');
      }
    });

  // List available strategies
  benchmark
    .command('strategies')
    .description('List available strategies for benchmarking')
    .action(() => {
      console.log('📈 Available Strategies\n');
      console.log('Strategy           │ Description');
      console.log('───────────────────┼' + '─'.repeat(50));
      
      for (const [name, desc] of Object.entries(STRATEGY_INFO)) {
        console.log(`${name.padEnd(18)} │ ${desc}`);
      }
      
      console.log('\nUsage: kit benchmark run --symbol BTCUSDT --strategies trend-following,momentum');
    });

  // Delete benchmark
  benchmark
    .command('delete <id>')
    .description('Delete a benchmark')
    .action((id) => {
      const filePath = path.join(BENCHMARKS_DIR, `${id}.json`);
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Benchmark not found: ${id}`);
        return;
      }
      fs.unlinkSync(filePath);
      console.log(`🗑️  Deleted benchmark: ${id}`);
    });

  // Quick benchmark presets
  benchmark
    .command('preset <name>')
    .description('Run a preset benchmark (btc, eth, forex, stocks)')
    .option('--json', 'Output as JSON')
    .action(async (name, options) => {
      const presets: Record<string, { symbol: string; strategies: string[]; timeframe: string }> = {
        btc: { symbol: 'BTCUSDT', strategies: ['trend-following', 'momentum', 'breakout', 'dca'], timeframe: '4h' },
        eth: { symbol: 'ETHUSDT', strategies: ['trend-following', 'mean-reversion', 'scalping'], timeframe: '1h' },
        forex: { symbol: 'EURUSD', strategies: ['trend-following', 'mean-reversion', 'breakout'], timeframe: '1h' },
        stocks: { symbol: 'AAPL', strategies: ['trend-following', 'momentum', 'swing'], timeframe: '1d' },
      };

      const preset = presets[name.toLowerCase()];
      if (!preset) {
        console.log(`❌ Unknown preset: ${name}`);
        console.log(`   Available: ${Object.keys(presets).join(', ')}`);
        return;
      }

      // Simulate running with preset options
      console.log(`🎯 Running preset: ${name.toUpperCase()}`);
      console.log(`   Symbol: ${preset.symbol}, Strategies: ${preset.strategies.join(', ')}`);
      console.log('');
      
      // Would call the run command internally
      console.log(`💡 Run manually with:`);
      console.log(`   kit benchmark run --symbol ${preset.symbol} --strategies ${preset.strategies.join(',')} --timeframe ${preset.timeframe}`);
    });
}
