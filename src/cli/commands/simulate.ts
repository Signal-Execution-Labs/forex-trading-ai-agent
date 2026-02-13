/**
 * K.I.T. Simulate CLI Command
 * 
 * Paper trading simulation.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const PAPER_FILE = path.join(KIT_HOME, 'paper-trading.json');

export interface PaperPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: string;
}

export interface PaperAccount {
  balance: number;
  initialBalance: number;
  positions: PaperPosition[];
  closedTrades: any[];
  createdAt: string;
}

export function registerSimulateCommand(program: Command): void {
  const simulate = program
    .command('simulate')
    .alias('paper')
    .description('Paper trading simulation');

  // Show paper account status
  simulate
    .command('status')
    .description('Show paper trading account status')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const account = loadAccount();
      
      // Calculate unrealized P&L (mock current prices)
      let unrealizedPnl = 0;
      for (const pos of account.positions) {
        const currentPrice = pos.entryPrice * (1 + (Math.random() * 0.1 - 0.05)); // Mock ±5%
        const pnl = pos.side === 'long' 
          ? (currentPrice - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - currentPrice) * pos.quantity;
        unrealizedPnl += pnl;
      }
      
      const equity = account.balance + unrealizedPnl;
      const totalPnl = equity - account.initialBalance;
      const pnlPercent = (totalPnl / account.initialBalance) * 100;
      
      if (options.json) {
        console.log(JSON.stringify({
          ...account,
          equity,
          unrealizedPnl,
          totalPnl,
          pnlPercent,
        }, null, 2));
        return;
      }
      
      console.log('📊 Paper Trading Account\n');
      console.log('━'.repeat(45));
      console.log(`Initial Balance:  $${account.initialBalance.toLocaleString()}`);
      console.log(`Cash Balance:     $${account.balance.toLocaleString()}`);
      console.log(`Unrealized P&L:   ${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)}`);
      console.log(`Equity:           $${equity.toFixed(2)}`);
      console.log('━'.repeat(45));
      console.log(`Total P&L:        ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
      console.log(`Open Positions:   ${account.positions.length}`);
      console.log(`Closed Trades:    ${account.closedTrades.length}`);
    });

  // Open position
  simulate
    .command('buy <symbol>')
    .description('Open a long position')
    .requiredOption('--price <price>', 'Entry price', parseFloat)
    .requiredOption('--qty <quantity>', 'Quantity', parseFloat)
    .option('--sl <price>', 'Stop loss', parseFloat)
    .option('--tp <price>', 'Take profit', parseFloat)
    .action((symbol, options) => {
      openPosition(symbol, 'long', options);
    });

  simulate
    .command('sell <symbol>')
    .description('Open a short position')
    .requiredOption('--price <price>', 'Entry price', parseFloat)
    .requiredOption('--qty <quantity>', 'Quantity', parseFloat)
    .option('--sl <price>', 'Stop loss', parseFloat)
    .option('--tp <price>', 'Take profit', parseFloat)
    .action((symbol, options) => {
      openPosition(symbol, 'short', options);
    });

  // Close position
  simulate
    .command('close <id>')
    .description('Close a position')
    .requiredOption('--price <price>', 'Exit price', parseFloat)
    .action((id, options) => {
      const account = loadAccount();
      const index = account.positions.findIndex(p => p.id === id);
      
      if (index === -1) {
        console.error(`Position not found: ${id}`);
        process.exit(1);
      }
      
      const pos = account.positions[index];
      const pnl = pos.side === 'long'
        ? (options.price - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - options.price) * pos.quantity;
      
      // Update balance
      account.balance += (pos.entryPrice * pos.quantity) + pnl;
      
      // Record closed trade
      account.closedTrades.push({
        ...pos,
        exitPrice: options.price,
        pnl,
        closedAt: new Date().toISOString(),
        result: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
      });
      
      // Remove position
      account.positions.splice(index, 1);
      
      saveAccount(account);
      
      const emoji = pnl >= 0 ? '✅' : '❌';
      console.log(`${emoji} Closed: ${pos.symbol} ${pos.side.toUpperCase()}`);
      console.log(`   Entry: $${pos.entryPrice} → Exit: $${options.price}`);
      console.log(`   P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
    });

  // List positions
  simulate
    .command('positions')
    .alias('pos')
    .description('List open positions')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const account = loadAccount();
      
      if (options.json) {
        console.log(JSON.stringify(account.positions, null, 2));
        return;
      }
      
      if (account.positions.length === 0) {
        console.log('No open positions.');
        console.log('\n💡 Open a position: kit simulate buy BTC --price 96000 --qty 0.1');
        return;
      }
      
      console.log('📊 Open Positions\n');
      
      for (const pos of account.positions) {
        const icon = pos.side === 'long' ? '📈' : '📉';
        console.log(`${icon} ${pos.symbol} ${pos.side.toUpperCase()}`);
        console.log(`   ID: ${pos.id}`);
        console.log(`   Entry: $${pos.entryPrice} | Qty: ${pos.quantity}`);
        if (pos.stopLoss) console.log(`   SL: $${pos.stopLoss}`);
        if (pos.takeProfit) console.log(`   TP: $${pos.takeProfit}`);
        console.log('');
      }
    });

  // Show trade history
  simulate
    .command('trades')
    .description('Show closed trades')
    .option('--limit <n>', 'Limit results', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      const account = loadAccount();
      let trades = account.closedTrades;
      
      if (options.limit) {
        trades = trades.slice(-options.limit);
      }
      
      if (options.json) {
        console.log(JSON.stringify(trades, null, 2));
        return;
      }
      
      if (trades.length === 0) {
        console.log('No closed trades.');
        return;
      }
      
      console.log('📈 Closed Trades\n');
      
      let totalPnl = 0;
      let wins = 0;
      
      for (const trade of trades) {
        const icon = trade.result === 'win' ? '✅' : trade.result === 'loss' ? '❌' : '➖';
        totalPnl += trade.pnl;
        if (trade.result === 'win') wins++;
        
        console.log(`${icon} ${trade.symbol} ${trade.side.toUpperCase()}`);
        console.log(`   $${trade.entryPrice} → $${trade.exitPrice} | P&L: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`);
        console.log('');
      }
      
      console.log('━'.repeat(45));
      console.log(`Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
      console.log(`Win Rate: ${((wins / trades.length) * 100).toFixed(1)}%`);
    });

  // Reset paper account
  simulate
    .command('reset')
    .description('Reset paper trading account')
    .option('--balance <amount>', 'Initial balance', parseFloat)
    .option('--confirm', 'Skip confirmation')
    .action((options) => {
      if (!options.confirm) {
        console.log('⚠️ This will reset your paper trading account!');
        console.log('   All positions and trade history will be lost.');
        console.log('   Use --confirm to proceed.');
        return;
      }
      
      const balance = options.balance || 100000;
      const account: PaperAccount = {
        balance,
        initialBalance: balance,
        positions: [],
        closedTrades: [],
        createdAt: new Date().toISOString(),
      };
      
      saveAccount(account);
      console.log(`✅ Paper account reset with $${balance.toLocaleString()} balance`);
    });
}

function loadAccount(): PaperAccount {
  if (!fs.existsSync(PAPER_FILE)) {
    // Create default account
    const account: PaperAccount = {
      balance: 100000,
      initialBalance: 100000,
      positions: [],
      closedTrades: [],
      createdAt: new Date().toISOString(),
    };
    saveAccount(account);
    return account;
  }
  return JSON.parse(fs.readFileSync(PAPER_FILE, 'utf8'));
}

function saveAccount(account: PaperAccount): void {
  fs.mkdirSync(path.dirname(PAPER_FILE), { recursive: true });
  fs.writeFileSync(PAPER_FILE, JSON.stringify(account, null, 2));
}

function openPosition(symbol: string, side: 'long' | 'short', options: any): void {
  const account = loadAccount();
  
  const positionValue = options.price * options.qty;
  
  if (positionValue > account.balance) {
    console.error(`Insufficient balance. Have: $${account.balance.toFixed(2)}, Need: $${positionValue.toFixed(2)}`);
    process.exit(1);
  }
  
  const position: PaperPosition = {
    id: `paper_${Date.now()}`,
    symbol: symbol.toUpperCase(),
    side,
    entryPrice: options.price,
    quantity: options.qty,
    stopLoss: options.sl,
    takeProfit: options.tp,
    openedAt: new Date().toISOString(),
  };
  
  account.positions.push(position);
  account.balance -= positionValue;
  
  saveAccount(account);
  
  const icon = side === 'long' ? '📈' : '📉';
  console.log(`${icon} Opened: ${symbol.toUpperCase()} ${side.toUpperCase()}`);
  console.log(`   Entry: $${options.price} | Qty: ${options.qty}`);
  console.log(`   Value: $${positionValue.toFixed(2)}`);
  console.log(`   ID: ${position.id}`);
}
