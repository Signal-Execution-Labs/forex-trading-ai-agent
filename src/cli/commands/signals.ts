/**
 * K.I.T. Signals CLI Command
 * 
 * Manage trading signals and subscriptions.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const SIGNALS_FILE = path.join(KIT_HOME, 'signals.json');

export interface Signal {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  confidence: number;
  source: string;
  status: 'pending' | 'active' | 'closed' | 'expired';
  createdAt: string;
  expiresAt?: string;
  closedAt?: string;
  result?: 'win' | 'loss' | 'breakeven';
}

interface SignalsConfig {
  version: number;
  signals: Signal[];
  sources: string[];
}

export function registerSignalsCommand(program: Command): void {
  const signals = program
    .command('signals')
    .description('Manage trading signals');

  // List signals
  signals
    .command('list')
    .alias('ls')
    .description('List signals')
    .option('--status <status>', 'Filter by status (pending, active, closed)')
    .option('--source <source>', 'Filter by source')
    .option('--symbol <symbol>', 'Filter by symbol')
    .option('--limit <n>', 'Limit results', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      const config = loadSignals();
      let filtered = config.signals;
      
      if (options.status) {
        filtered = filtered.filter(s => s.status === options.status);
      }
      if (options.source) {
        filtered = filtered.filter(s => 
          s.source.toLowerCase().includes(options.source.toLowerCase())
        );
      }
      if (options.symbol) {
        filtered = filtered.filter(s => 
          s.symbol.toLowerCase().includes(options.symbol.toLowerCase())
        );
      }
      
      // Sort by date descending
      filtered.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      if (options.limit) {
        filtered = filtered.slice(0, options.limit);
      }
      
      if (options.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }
      
      if (filtered.length === 0) {
        console.log('No signals found.');
        return;
      }
      
      console.log('📡 Trading Signals\n');
      
      for (const signal of filtered) {
        const dirIcon = signal.direction === 'LONG' ? '📈' : '📉';
        const statusIcon = signal.status === 'pending' ? '⏳' 
                        : signal.status === 'active' ? '🟢' 
                        : signal.status === 'closed' ? (signal.result === 'win' ? '✅' : '❌')
                        : '⏰';
        
        console.log(`${statusIcon} ${dirIcon} ${signal.symbol} ${signal.direction}`);
        console.log(`   Entry: $${signal.entryPrice} | Conf: ${signal.confidence}%`);
        if (signal.stopLoss) console.log(`   SL: $${signal.stopLoss}`);
        if (signal.takeProfit) console.log(`   TP: $${signal.takeProfit}`);
        console.log(`   Source: ${signal.source} | ${signal.id}`);
        console.log('');
      }
    });

  // Create signal
  signals
    .command('create')
    .description('Create a new signal')
    .requiredOption('--symbol <symbol>', 'Trading pair')
    .requiredOption('--direction <dir>', 'Direction (long/short)')
    .requiredOption('--entry <price>', 'Entry price', parseFloat)
    .option('--sl <price>', 'Stop loss', parseFloat)
    .option('--tp <price>', 'Take profit', parseFloat)
    .option('--confidence <pct>', 'Confidence percentage', parseFloat)
    .option('--source <name>', 'Signal source', 'manual')
    .option('--expires <time>', 'Expiration (e.g., 1h, 4h, 1d)')
    .action((options) => {
      const config = loadSignals();
      
      const direction = options.direction.toUpperCase();
      if (direction !== 'LONG' && direction !== 'SHORT') {
        console.error('Direction must be LONG or SHORT');
        process.exit(1);
      }
      
      const signal: Signal = {
        id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        symbol: options.symbol.toUpperCase(),
        direction: direction as 'LONG' | 'SHORT',
        entryPrice: options.entry,
        stopLoss: options.sl,
        takeProfit: options.tp,
        confidence: options.confidence || 75,
        source: options.source,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      
      if (options.expires) {
        signal.expiresAt = calculateExpiry(options.expires);
      }
      
      config.signals.push(signal);
      saveSignals(config);
      
      console.log(`✅ Signal created: ${signal.id}`);
      console.log(`   ${signal.symbol} ${signal.direction} @ $${signal.entryPrice}`);
    });

  // Activate signal
  signals
    .command('activate <id>')
    .description('Mark signal as active (entry hit)')
    .action((id) => {
      const config = loadSignals();
      const signal = config.signals.find(s => s.id === id);
      
      if (!signal) {
        console.error(`Signal not found: ${id}`);
        process.exit(1);
      }
      
      signal.status = 'active';
      saveSignals(config);
      console.log(`🟢 Activated: ${signal.symbol} ${signal.direction}`);
    });

  // Close signal
  signals
    .command('close <id>')
    .description('Close a signal')
    .option('--result <result>', 'Result (win/loss/breakeven)', 'win')
    .action((id, options) => {
      const config = loadSignals();
      const signal = config.signals.find(s => s.id === id);
      
      if (!signal) {
        console.error(`Signal not found: ${id}`);
        process.exit(1);
      }
      
      signal.status = 'closed';
      signal.closedAt = new Date().toISOString();
      signal.result = options.result as 'win' | 'loss' | 'breakeven';
      saveSignals(config);
      
      const resultIcon = options.result === 'win' ? '✅' 
                       : options.result === 'loss' ? '❌' 
                       : '➖';
      console.log(`${resultIcon} Closed: ${signal.symbol} ${signal.direction} - ${options.result}`);
    });

  // Delete signal
  signals
    .command('delete <id>')
    .alias('rm')
    .description('Delete a signal')
    .action((id) => {
      const config = loadSignals();
      const index = config.signals.findIndex(s => s.id === id);
      
      if (index === -1) {
        console.error(`Signal not found: ${id}`);
        process.exit(1);
      }
      
      const signal = config.signals[index];
      config.signals.splice(index, 1);
      saveSignals(config);
      console.log(`🗑️ Deleted: ${signal.symbol} ${signal.direction}`);
    });

  // Signal stats
  signals
    .command('stats')
    .description('Show signal statistics')
    .option('--source <source>', 'Filter by source')
    .option('--period <period>', 'Time period (day, week, month, all)', 'all')
    .action((options) => {
      const config = loadSignals();
      let filtered = config.signals.filter(s => s.status === 'closed');
      
      if (options.source) {
        filtered = filtered.filter(s => 
          s.source.toLowerCase().includes(options.source.toLowerCase())
        );
      }
      
      // Time filter
      if (options.period !== 'all') {
        const now = Date.now();
        const periods: Record<string, number> = {
          day: 24 * 60 * 60 * 1000,
          week: 7 * 24 * 60 * 60 * 1000,
          month: 30 * 24 * 60 * 60 * 1000,
        };
        const cutoff = now - (periods[options.period] || 0);
        filtered = filtered.filter(s => 
          new Date(s.closedAt || s.createdAt).getTime() > cutoff
        );
      }
      
      const wins = filtered.filter(s => s.result === 'win').length;
      const losses = filtered.filter(s => s.result === 'loss').length;
      const breakeven = filtered.filter(s => s.result === 'breakeven').length;
      const total = filtered.length;
      const winRate = total > 0 ? (wins / total) * 100 : 0;
      
      console.log('📊 Signal Statistics\n');
      console.log(`Period: ${options.period.toUpperCase()}`);
      if (options.source) console.log(`Source: ${options.source}`);
      console.log('');
      console.log(`Total Signals: ${total}`);
      console.log(`Wins:          ${wins} (${winRate.toFixed(1)}%)`);
      console.log(`Losses:        ${losses}`);
      console.log(`Breakeven:     ${breakeven}`);
      console.log('');
      
      // By source
      const sources = new Map<string, { wins: number; total: number }>();
      for (const s of filtered) {
        if (!sources.has(s.source)) {
          sources.set(s.source, { wins: 0, total: 0 });
        }
        const stats = sources.get(s.source)!;
        stats.total++;
        if (s.result === 'win') stats.wins++;
      }
      
      if (sources.size > 1) {
        console.log('By Source:');
        for (const [source, stats] of sources) {
          const wr = (stats.wins / stats.total) * 100;
          console.log(`  ${source}: ${stats.wins}/${stats.total} (${wr.toFixed(0)}%)`);
        }
      }
    });

  // List sources
  signals
    .command('sources')
    .description('List signal sources')
    .action(() => {
      const config = loadSignals();
      
      const sources = new Map<string, number>();
      for (const s of config.signals) {
        sources.set(s.source, (sources.get(s.source) || 0) + 1);
      }
      
      if (sources.size === 0) {
        console.log('No signal sources found.');
        return;
      }
      
      console.log('📡 Signal Sources\n');
      for (const [source, count] of sources) {
        console.log(`  • ${source} (${count} signals)`);
      }
    });
}

function loadSignals(): SignalsConfig {
  if (!fs.existsSync(SIGNALS_FILE)) {
    return { version: 1, signals: [], sources: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(SIGNALS_FILE, 'utf8'));
  } catch {
    return { version: 1, signals: [], sources: [] };
  }
}

function saveSignals(config: SignalsConfig): void {
  fs.mkdirSync(path.dirname(SIGNALS_FILE), { recursive: true });
  fs.writeFileSync(SIGNALS_FILE, JSON.stringify(config, null, 2));
}

function calculateExpiry(timeStr: string): string {
  const match = timeStr.match(/^(\d+)([mhd])$/);
  if (!match) return new Date(Date.now() + 3600000).toISOString();
  
  const value = parseInt(match[1]);
  const unit = match[2];
  const ms = unit === 'm' ? value * 60000 
           : unit === 'h' ? value * 3600000 
           : value * 86400000;
  
  return new Date(Date.now() + ms).toISOString();
}
