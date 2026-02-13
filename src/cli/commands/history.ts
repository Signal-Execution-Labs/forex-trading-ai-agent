/**
 * K.I.T. History CLI Command
 * 
 * View command and trade history.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const LOGS_DIR = path.join(KIT_HOME, 'logs');

export function registerHistoryCommand(program: Command): void {
  const history = program
    .command('history')
    .description('View command and trade history');

  // Command history
  history
    .command('commands')
    .alias('cmd')
    .description('Show command history')
    .option('--limit <n>', 'Number of entries', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      const logFile = path.join(LOGS_DIR, 'commands.log');
      
      if (!fs.existsSync(logFile)) {
        console.log('No command history found.');
        console.log('\n💡 Command history is recorded when K.I.T. runs.');
        return;
      }
      
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      
      let entries = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });
      
      if (options.limit) {
        entries = entries.slice(-options.limit);
      }
      
      if (options.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }
      
      console.log('📜 Command History\n');
      
      for (const entry of entries.slice(-20)) {
        const time = entry.timestamp 
          ? new Date(entry.timestamp).toLocaleString() 
          : 'Unknown';
        const cmd = entry.command || entry.raw || 'Unknown';
        console.log(`[${time}] ${cmd}`);
      }
      
      if (entries.length > 20) {
        console.log(`\n... and ${entries.length - 20} more entries`);
      }
    });

  // Trade history
  history
    .command('trades')
    .description('Show trade history')
    .option('--limit <n>', 'Number of trades', parseInt)
    .option('--symbol <symbol>', 'Filter by symbol')
    .option('--status <status>', 'Filter by status (win, loss)')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const tradesFile = path.join(KIT_HOME, 'trades.json');
      
      if (!fs.existsSync(tradesFile)) {
        console.log('No trade history found.');
        return;
      }
      
      let trades = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
      
      if (options.symbol) {
        trades = trades.filter((t: any) => 
          t.symbol?.toLowerCase().includes(options.symbol.toLowerCase())
        );
      }
      
      if (options.status) {
        trades = trades.filter((t: any) => t.result === options.status);
      }
      
      if (options.limit) {
        trades = trades.slice(-options.limit);
      }
      
      if (options.json) {
        console.log(JSON.stringify(trades, null, 2));
        return;
      }
      
      console.log('📈 Trade History\n');
      
      if (trades.length === 0) {
        console.log('No trades matching criteria.');
        return;
      }
      
      for (const trade of trades.slice(-20)) {
        const icon = trade.result === 'win' ? '✅' : trade.result === 'loss' ? '❌' : '➖';
        const pnl = trade.pnl 
          ? (trade.pnl >= 0 ? `+$${trade.pnl}` : `-$${Math.abs(trade.pnl)}`)
          : 'N/A';
        
        console.log(`${icon} ${trade.symbol || 'Unknown'} ${trade.side || ''}`);
        console.log(`   Entry: $${trade.entryPrice || '?'} → Exit: $${trade.exitPrice || '?'}`);
        console.log(`   P&L: ${pnl} | ${trade.closedAt || trade.createdAt || 'Unknown'}`);
        console.log('');
      }
    });

  // Session history
  history
    .command('sessions')
    .description('Show session history')
    .option('--limit <n>', 'Number of sessions', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      const sessionsDir = path.join(KIT_HOME, 'sessions');
      
      if (!fs.existsSync(sessionsDir)) {
        console.log('No session history found.');
        return;
      }
      
      const files = fs.readdirSync(sessionsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const filePath = path.join(sessionsDir, f);
          const stat = fs.statSync(filePath);
          return {
            name: f.replace('.json', ''),
            modified: stat.mtime,
            size: stat.size,
          };
        })
        .sort((a, b) => b.modified.getTime() - a.modified.getTime());
      
      const sessions = options.limit ? files.slice(0, options.limit) : files;
      
      if (options.json) {
        console.log(JSON.stringify(sessions, null, 2));
        return;
      }
      
      console.log('💬 Session History\n');
      
      for (const s of sessions.slice(0, 20)) {
        console.log(`  ${s.name}`);
        console.log(`    Modified: ${s.modified.toLocaleString()}`);
        console.log(`    Size: ${formatSize(s.size)}`);
        console.log('');
      }
    });

  // Alert history
  history
    .command('alerts')
    .description('Show triggered alerts')
    .option('--limit <n>', 'Number of alerts', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      const alertsFile = path.join(KIT_HOME, 'alerts.json');
      
      if (!fs.existsSync(alertsFile)) {
        console.log('No alerts found.');
        return;
      }
      
      const config = JSON.parse(fs.readFileSync(alertsFile, 'utf8'));
      let triggered = config.alerts.filter((a: any) => a.triggered);
      
      if (options.limit) {
        triggered = triggered.slice(-options.limit);
      }
      
      if (options.json) {
        console.log(JSON.stringify(triggered, null, 2));
        return;
      }
      
      console.log('🔔 Alert History\n');
      
      if (triggered.length === 0) {
        console.log('No triggered alerts.');
        return;
      }
      
      for (const alert of triggered) {
        console.log(`✅ ${alert.symbol} ${alert.condition} $${alert.price}`);
        console.log(`   Triggered: ${alert.triggeredAt || 'Unknown'}`);
        console.log('');
      }
    });

  // Clear history
  history
    .command('clear <type>')
    .description('Clear history (commands, trades, sessions, alerts, all)')
    .option('--confirm', 'Skip confirmation')
    .action((type, options) => {
      if (!options.confirm) {
        console.log(`⚠️ This will clear ${type} history.`);
        console.log('   Use --confirm to proceed.');
        return;
      }
      
      const cleared: string[] = [];
      
      if (type === 'commands' || type === 'all') {
        const file = path.join(LOGS_DIR, 'commands.log');
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          cleared.push('commands');
        }
      }
      
      if (type === 'trades' || type === 'all') {
        const file = path.join(KIT_HOME, 'trades.json');
        if (fs.existsSync(file)) {
          fs.writeFileSync(file, '[]');
          cleared.push('trades');
        }
      }
      
      if (type === 'sessions' || type === 'all') {
        const dir = path.join(KIT_HOME, 'sessions');
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            fs.unlinkSync(path.join(dir, f));
          }
          cleared.push(`sessions (${files.length} files)`);
        }
      }
      
      if (type === 'alerts' || type === 'all') {
        const file = path.join(KIT_HOME, 'alerts.json');
        if (fs.existsSync(file)) {
          const config = JSON.parse(fs.readFileSync(file, 'utf8'));
          config.alerts = config.alerts.filter((a: any) => !a.triggered);
          fs.writeFileSync(file, JSON.stringify(config, null, 2));
          cleared.push('alerts (triggered)');
        }
      }
      
      if (cleared.length === 0) {
        console.log('Nothing to clear.');
      } else {
        console.log(`✅ Cleared: ${cleared.join(', ')}`);
      }
    });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
