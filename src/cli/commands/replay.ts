/**
 * K.I.T. Market Replay CLI Command
 * 
 * Replay historical market data for training and analysis.
 * Practice trading decisions on past market conditions.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';
import * as readline from 'readline';

const KIT_HOME = path.join(os.homedir(), '.kit');
const REPLAYS_DIR = path.join(KIT_HOME, 'replays');

export interface ReplaySession {
  id: string;
  symbol: string;
  startDate: string;
  endDate: string;
  speed: number;
  currentIndex: number;
  totalCandles: number;
  positions: Position[];
  trades: Trade[];
  pnl: number;
  status: 'running' | 'paused' | 'completed';
  createdAt: string;
}

export interface Position {
  id: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  entryTime: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Trade {
  id: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  size: number;
  pnl: number;
  pnlPercent: number;
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Historical events for education
const HISTORICAL_EVENTS: Record<string, { name: string; date: string; symbol: string; description: string }> = {
  'btc-2020-halving': { name: 'Bitcoin Halving 2020', date: '2020-05-11', symbol: 'BTCUSDT', description: 'Third Bitcoin halving event' },
  'btc-2021-ath': { name: 'Bitcoin ATH 2021', date: '2021-11-10', symbol: 'BTCUSDT', description: 'Bitcoin reaches $69,000' },
  'btc-luna-crash': { name: 'Luna/UST Crash', date: '2022-05-09', symbol: 'BTCUSDT', description: 'Terra Luna collapse' },
  'btc-ftx-crash': { name: 'FTX Collapse', date: '2022-11-08', symbol: 'BTCUSDT', description: 'FTX exchange bankruptcy' },
  'eth-merge': { name: 'Ethereum Merge', date: '2022-09-15', symbol: 'ETHUSDT', description: 'ETH transitions to PoS' },
  'covid-crash': { name: 'COVID Market Crash', date: '2020-03-12', symbol: 'BTCUSDT', description: 'Black Thursday crypto crash' },
  'btc-etf': { name: 'Bitcoin ETF Approval', date: '2024-01-10', symbol: 'BTCUSDT', description: 'SEC approves spot BTC ETFs' },
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateMockCandles(symbol: string, startDate: string, count: number): Candle[] {
  const candles: Candle[] = [];
  let price = symbol.includes('BTC') ? 45000 : symbol.includes('ETH') ? 3000 : 1.0;
  const volatility = symbol.includes('BTC') || symbol.includes('ETH') ? 0.02 : 0.005;
  
  const start = new Date(startDate);
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    
    candles.push({
      timestamp: new Date(start.getTime() + i * 60 * 60 * 1000).toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000) + 100000,
    });
    
    price = close;
  }
  
  return candles;
}

function formatPrice(price: number, symbol: string): string {
  if (symbol.includes('BTC') || symbol.includes('ETH')) {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return price.toFixed(5);
}

function drawCandleChart(candles: Candle[], width: number = 60): string {
  if (candles.length === 0) return '';
  
  const prices = candles.flatMap(c => [c.high, c.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;
  const height = 10;
  
  const lines: string[] = [];
  
  // Draw chart
  for (let row = height - 1; row >= 0; row--) {
    const priceLevel = minPrice + (range * row / (height - 1));
    let line = '';
    
    for (let i = Math.max(0, candles.length - width); i < candles.length; i++) {
      const c = candles[i];
      const highNorm = (c.high - minPrice) / range * (height - 1);
      const lowNorm = (c.low - minPrice) / range * (height - 1);
      const openNorm = (c.open - minPrice) / range * (height - 1);
      const closeNorm = (c.close - minPrice) / range * (height - 1);
      
      if (row >= lowNorm && row <= highNorm) {
        if (row >= Math.min(openNorm, closeNorm) && row <= Math.max(openNorm, closeNorm)) {
          line += c.close >= c.open ? '█' : '░';
        } else {
          line += '│';
        }
      } else {
        line += ' ';
      }
    }
    
    const priceStr = formatPrice(priceLevel, 'BTC').padStart(12);
    lines.push(`${priceStr} │${line}`);
  }
  
  lines.push(' '.repeat(12) + ' └' + '─'.repeat(Math.min(width, candles.length)));
  
  return lines.join('\n');
}

export function registerReplayCommand(program: Command): void {
  const replay = program
    .command('replay')
    .description('Replay historical market data for practice trading');

  // Start replay
  replay
    .command('start')
    .description('Start a new market replay session')
    .requiredOption('--symbol <pair>', 'Trading pair (e.g., BTCUSDT)')
    .option('--date <date>', 'Start date (YYYY-MM-DD)')
    .option('--event <name>', 'Start from historical event')
    .option('--speed <x>', 'Replay speed multiplier', parseFloat, 1)
    .option('--candles <n>', 'Number of candles to replay', parseInt, 500)
    .action(async (options) => {
      let startDate = options.date;
      let eventInfo = '';
      
      if (options.event) {
        const event = HISTORICAL_EVENTS[options.event];
        if (!event) {
          console.log(`❌ Unknown event: ${options.event}`);
          console.log('   Available events:');
          for (const [key, e] of Object.entries(HISTORICAL_EVENTS)) {
            console.log(`   - ${key}: ${e.name} (${e.date})`);
          }
          return;
        }
        startDate = event.date;
        eventInfo = `\n📅 Event: ${event.name}\n   ${event.description}`;
      }
      
      startDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`\n🎬 K.I.T. Market Replay`);
      console.log('═'.repeat(50));
      console.log(`Symbol:    ${options.symbol.toUpperCase()}`);
      console.log(`Start:     ${startDate}`);
      console.log(`Speed:     ${options.speed}x`);
      console.log(`Candles:   ${options.candles}`);
      eventInfo && console.log(eventInfo);
      console.log('═'.repeat(50));
      
      console.log('\n⏳ Loading historical data...');
      await sleep(500);
      
      const candles = generateMockCandles(options.symbol, startDate, options.candles);
      
      const session: ReplaySession = {
        id: `replay_${Date.now()}`,
        symbol: options.symbol.toUpperCase(),
        startDate,
        endDate: candles[candles.length - 1].timestamp.split('T')[0],
        speed: options.speed,
        currentIndex: 0,
        totalCandles: candles.length,
        positions: [],
        trades: [],
        pnl: 0,
        status: 'paused',
        createdAt: new Date().toISOString(),
      };
      
      // Save session
      ensureDir(REPLAYS_DIR);
      fs.writeFileSync(
        path.join(REPLAYS_DIR, `${session.id}.json`),
        JSON.stringify({ session, candles }, null, 2)
      );
      
      console.log(`\n✅ Replay session created: ${session.id}`);
      console.log(`\nCommands:`);
      console.log(`  kit replay play ${session.id}    - Start/resume replay`);
      console.log(`  kit replay status ${session.id}  - Show current state`);
      console.log(`  kit replay long ${session.id}    - Open long position`);
      console.log(`  kit replay short ${session.id}   - Open short position`);
      console.log(`  kit replay close ${session.id}   - Close position`);
      
      // Interactive mode
      console.log('\n🎮 Starting interactive mode...\n');
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      let running = false;
      let currentIdx = 0;
      const capital = 10000;
      let position: Position | null = null;
      let totalPnl = 0;
      const completedTrades: Trade[] = [];
      
      const showState = () => {
        const candle = candles[currentIdx];
        console.clear();
        console.log(`🎬 K.I.T. Replay: ${session.symbol} | Candle ${currentIdx + 1}/${candles.length}`);
        console.log('═'.repeat(70));
        console.log(`📅 ${candle.timestamp}`);
        console.log(`💰 Price: ${formatPrice(candle.close, session.symbol)} | O: ${formatPrice(candle.open, session.symbol)} H: ${formatPrice(candle.high, session.symbol)} L: ${formatPrice(candle.low, session.symbol)}`);
        console.log('');
        
        // Mini chart
        const chartCandles = candles.slice(Math.max(0, currentIdx - 30), currentIdx + 1);
        console.log(drawCandleChart(chartCandles, 50));
        console.log('');
        
        if (position) {
          const unrealizedPnl = (candle.close - position.entryPrice) * position.size * (position.side === 'long' ? 1 : -1);
          const pnlPct = ((candle.close / position.entryPrice - 1) * 100 * (position.side === 'long' ? 1 : -1));
          console.log(`📊 Position: ${position.side.toUpperCase()} ${position.size} @ ${formatPrice(position.entryPrice, session.symbol)}`);
          console.log(`   P&L: ${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`);
        } else {
          console.log('📊 No open position');
        }
        
        console.log(`💵 Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} | Trades: ${completedTrades.length}`);
        console.log('');
        console.log('Commands: [l]ong, [s]hort, [c]lose, [n]ext, [p]lay/pause, [q]uit');
      };
      
      showState();
      
      const handleCommand = (cmd: string) => {
        const candle = candles[currentIdx];
        
        switch (cmd.toLowerCase()) {
          case 'l':
          case 'long':
            if (position) {
              console.log('⚠️  Already have a position');
            } else {
              position = {
                id: `pos_${Date.now()}`,
                side: 'long',
                size: 1,
                entryPrice: candle.close,
                entryTime: candle.timestamp,
              };
              console.log(`✅ Opened LONG @ ${formatPrice(candle.close, session.symbol)}`);
            }
            break;
            
          case 's':
          case 'short':
            if (position) {
              console.log('⚠️  Already have a position');
            } else {
              position = {
                id: `pos_${Date.now()}`,
                side: 'short',
                size: 1,
                entryPrice: candle.close,
                entryTime: candle.timestamp,
              };
              console.log(`✅ Opened SHORT @ ${formatPrice(candle.close, session.symbol)}`);
            }
            break;
            
          case 'c':
          case 'close':
            if (!position) {
              console.log('⚠️  No position to close');
            } else {
              const pnl = (candle.close - position.entryPrice) * position.size * (position.side === 'long' ? 1 : -1);
              totalPnl += pnl;
              
              completedTrades.push({
                id: `trade_${Date.now()}`,
                side: position.side,
                entryPrice: position.entryPrice,
                exitPrice: candle.close,
                entryTime: position.entryTime,
                exitTime: candle.timestamp,
                size: position.size,
                pnl,
                pnlPercent: (candle.close / position.entryPrice - 1) * 100 * (position.side === 'long' ? 1 : -1),
              });
              
              console.log(`✅ Closed ${position.side.toUpperCase()} @ ${formatPrice(candle.close, session.symbol)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
              position = null;
            }
            break;
            
          case 'n':
          case 'next':
            if (currentIdx < candles.length - 1) {
              currentIdx++;
              showState();
            } else {
              console.log('🏁 End of replay');
            }
            break;
            
          case 'p':
          case 'play':
          case 'pause':
            running = !running;
            console.log(running ? '▶️  Playing...' : '⏸️  Paused');
            break;
            
          case 'q':
          case 'quit':
            console.log('\n📊 Final Results:');
            console.log(`   Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
            console.log(`   Trades: ${completedTrades.length}`);
            if (completedTrades.length > 0) {
              const wins = completedTrades.filter(t => t.pnl > 0).length;
              console.log(`   Win Rate: ${(wins / completedTrades.length * 100).toFixed(1)}%`);
            }
            rl.close();
            process.exit(0);
            break;
            
          default:
            console.log('Unknown command');
        }
      };
      
      rl.on('line', handleCommand);
      
      // Auto-advance when playing
      const tick = setInterval(() => {
        if (running && currentIdx < candles.length - 1) {
          currentIdx++;
          showState();
        } else if (currentIdx >= candles.length - 1) {
          running = false;
        }
      }, 1000 / options.speed);
      
      rl.on('close', () => {
        clearInterval(tick);
      });
    });

  // List historical events
  replay
    .command('events')
    .description('List available historical events to replay')
    .action(() => {
      console.log('📅 Historical Events\n');
      console.log('ID                │ Event                    │ Date       │ Symbol');
      console.log('──────────────────┼──────────────────────────┼────────────┼─────────');
      
      for (const [key, event] of Object.entries(HISTORICAL_EVENTS)) {
        console.log(
          `${key.padEnd(17)} │ ` +
          `${event.name.padEnd(24)} │ ` +
          `${event.date} │ ` +
          event.symbol
        );
      }
      
      console.log('\nUsage: kit replay start --event btc-2021-ath --symbol BTCUSDT');
    });

  // List sessions
  replay
    .command('list')
    .description('List replay sessions')
    .action(() => {
      ensureDir(REPLAYS_DIR);
      const files = fs.readdirSync(REPLAYS_DIR).filter(f => f.endsWith('.json'));
      
      if (files.length === 0) {
        console.log('📭 No replay sessions. Start one with: kit replay start --symbol BTCUSDT');
        return;
      }
      
      console.log('🎬 Replay Sessions\n');
      for (const file of files.slice(-10)) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(REPLAYS_DIR, file), 'utf-8'));
          const s = data.session;
          console.log(`${s.id} | ${s.symbol} | ${s.startDate} | ${s.currentIndex}/${s.totalCandles} candles | P&L: $${s.pnl.toFixed(2)}`);
        } catch {
          // Skip invalid files
        }
      }
    });

  // Delete session
  replay
    .command('delete <id>')
    .description('Delete a replay session')
    .action((id) => {
      const filePath = path.join(REPLAYS_DIR, `${id}.json`);
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Session not found: ${id}`);
        return;
      }
      fs.unlinkSync(filePath);
      console.log(`🗑️  Deleted session: ${id}`);
    });
}
