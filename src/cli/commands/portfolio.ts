/**
 * K.I.T. Portfolio CLI Command
 * 
 * View and manage your trading portfolio.
 * 
 * @see K.I.T. docs/portfolio.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const PORTFOLIO_FILE = path.join(KIT_HOME, 'portfolio.json');
const TRADES_FILE = path.join(KIT_HOME, 'trades.json');

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice?: number;
  quantity: number;
  openedAt: string;
  exchange: string;
  pnl?: number;
  pnlPercent?: number;
}

export interface Portfolio {
  totalBalance: number;
  availableBalance: number;
  positions: Position[];
  lastUpdated: string;
}

export function registerPortfolioCommand(program: Command): void {
  const portfolio = program
    .command('portfolio')
    .description('View and manage your trading portfolio');

  // Show portfolio overview
  portfolio
    .command('show')
    .alias('view')
    .description('Show portfolio overview')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const data = loadPortfolio();
      
      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      
      console.log('💼 Portfolio Overview\n');
      console.log(`Total Balance:     $${data.totalBalance.toLocaleString()}`);
      console.log(`Available Balance: $${data.availableBalance.toLocaleString()}`);
      console.log(`Open Positions:    ${data.positions.length}`);
      console.log(`Last Updated:      ${data.lastUpdated}`);
      
      if (data.positions.length > 0) {
        console.log('\n📊 Open Positions:\n');
        
        for (const pos of data.positions) {
          const pnlStr = pos.pnl !== undefined 
            ? (pos.pnl >= 0 ? `+$${pos.pnl.toFixed(2)}` : `-$${Math.abs(pos.pnl).toFixed(2)}`)
            : 'N/A';
          const pnlColor = pos.pnl !== undefined && pos.pnl >= 0 ? '🟢' : '🔴';
          
          console.log(`${pnlColor} ${pos.symbol} ${pos.side.toUpperCase()}`);
          console.log(`   Entry: $${pos.entryPrice} | Qty: ${pos.quantity}`);
          console.log(`   P&L: ${pnlStr}`);
          console.log('');
        }
      }
    });

  // List positions
  portfolio
    .command('positions')
    .alias('pos')
    .description('List all open positions')
    .option('--exchange <exchange>', 'Filter by exchange')
    .option('--symbol <symbol>', 'Filter by symbol')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const data = loadPortfolio();
      let positions = data.positions;
      
      if (options.exchange) {
        positions = positions.filter(p => 
          p.exchange.toLowerCase() === options.exchange.toLowerCase()
        );
      }
      
      if (options.symbol) {
        positions = positions.filter(p => 
          p.symbol.toLowerCase().includes(options.symbol.toLowerCase())
        );
      }
      
      if (options.json) {
        console.log(JSON.stringify(positions, null, 2));
        return;
      }
      
      if (positions.length === 0) {
        console.log('No open positions.');
        return;
      }
      
      console.log(`📊 Open Positions (${positions.length}):\n`);
      
      // Table header
      console.log('Symbol          Side    Entry       Qty      P&L          Exchange');
      console.log('─'.repeat(75));
      
      for (const pos of positions) {
        const symbol = pos.symbol.padEnd(14);
        const side = pos.side.toUpperCase().padEnd(6);
        const entry = `$${pos.entryPrice.toFixed(2)}`.padEnd(10);
        const qty = String(pos.quantity).padEnd(8);
        const pnl = pos.pnl !== undefined 
          ? `${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)}`.padEnd(12)
          : 'N/A'.padEnd(12);
        
        console.log(`${symbol} ${side} ${entry} ${qty} ${pnl} ${pos.exchange}`);
      }
    });

  // Show trade history
  portfolio
    .command('history')
    .description('Show trade history')
    .option('--limit <n>', 'Limit number of trades', parseInt)
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const trades = loadTrades();
      let filtered = trades;
      
      if (options.from) {
        const fromDate = new Date(options.from);
        filtered = filtered.filter(t => new Date(t.closedAt) >= fromDate);
      }
      
      if (options.to) {
        const toDate = new Date(options.to);
        filtered = filtered.filter(t => new Date(t.closedAt) <= toDate);
      }
      
      if (options.limit) {
        filtered = filtered.slice(-options.limit);
      }
      
      if (options.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }
      
      if (filtered.length === 0) {
        console.log('No trade history found.');
        return;
      }
      
      console.log(`📈 Trade History (${filtered.length} trades):\n`);
      
      let totalPnl = 0;
      let wins = 0;
      
      for (const trade of filtered) {
        const pnl = trade.pnl || 0;
        totalPnl += pnl;
        if (pnl > 0) wins++;
        
        const icon = pnl >= 0 ? '✅' : '❌';
        const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
        
        console.log(`${icon} ${trade.symbol} ${trade.side} | ${pnlStr} | ${trade.closedAt}`);
      }
      
      console.log('');
      console.log('─'.repeat(50));
      console.log(`Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
      console.log(`Win Rate:  ${((wins / filtered.length) * 100).toFixed(1)}%`);
    });

  // Show performance stats
  portfolio
    .command('stats')
    .description('Show performance statistics')
    .option('--period <period>', 'Time period: day, week, month, year, all', 'all')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const trades = loadTrades();
      const portfolio = loadPortfolio();
      
      // Calculate stats
      const totalTrades = trades.length;
      const winningTrades = trades.filter(t => (t.pnl || 0) > 0).length;
      const losingTrades = trades.filter(t => (t.pnl || 0) < 0).length;
      const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const avgWin = winningTrades > 0 
        ? trades.filter(t => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades
        : 0;
      const avgLoss = losingTrades > 0
        ? trades.filter(t => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades
        : 0;
      
      const stats = {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
        totalPnl,
        avgWin,
        avgLoss,
        profitFactor: Math.abs(avgLoss) > 0 ? Math.abs(avgWin / avgLoss) : 0,
        currentBalance: portfolio.totalBalance,
      };
      
      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }
      
      console.log('📊 Performance Statistics\n');
      console.log(`Period: ${options.period.toUpperCase()}\n`);
      console.log(`Total Trades:   ${stats.totalTrades}`);
      console.log(`Winning Trades: ${stats.winningTrades}`);
      console.log(`Losing Trades:  ${stats.losingTrades}`);
      console.log(`Win Rate:       ${stats.winRate.toFixed(1)}%`);
      console.log('');
      console.log(`Total P&L:      ${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`);
      console.log(`Avg Win:        +$${stats.avgWin.toFixed(2)}`);
      console.log(`Avg Loss:       -$${Math.abs(stats.avgLoss).toFixed(2)}`);
      console.log(`Profit Factor:  ${stats.profitFactor.toFixed(2)}`);
      console.log('');
      console.log(`Current Balance: $${stats.currentBalance.toLocaleString()}`);
    });

  // Sync portfolio from exchanges
  portfolio
    .command('sync')
    .description('Sync portfolio data from connected exchanges')
    .action(async () => {
      console.log('🔄 Syncing portfolio from exchanges...');
      console.log('');
      console.log('💡 This requires the gateway to be running with exchange connections.');
      console.log('   Start K.I.T. first: kit start');
      console.log('');
      console.log('   Or connect exchanges: kit exchanges connect <exchange>');
    });
}

function loadPortfolio(): Portfolio {
  if (!fs.existsSync(PORTFOLIO_FILE)) {
    return {
      totalBalance: 0,
      availableBalance: 0,
      positions: [],
      lastUpdated: new Date().toISOString(),
    };
  }
  try {
    return JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf8'));
  } catch {
    return {
      totalBalance: 0,
      availableBalance: 0,
      positions: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

function loadTrades(): any[] {
  if (!fs.existsSync(TRADES_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8'));
  } catch {
    return [];
  }
}
