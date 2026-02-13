/**
 * K.I.T. Alerts CLI Command
 * 
 * Manage price alerts and notifications.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const ALERTS_FILE = path.join(KIT_HOME, 'alerts.json');

export interface Alert {
  id: string;
  symbol: string;
  condition: 'above' | 'below' | 'crosses';
  price: number;
  message?: string;
  channels: string[];
  active: boolean;
  triggered?: boolean;
  triggeredAt?: string;
  createdAt: string;
}

interface AlertsConfig {
  version: number;
  alerts: Alert[];
}

export function registerAlertsCommand(program: Command): void {
  const alerts = program
    .command('alerts')
    .description('Manage price alerts and notifications');

  // List alerts
  alerts
    .command('list')
    .alias('ls')
    .description('List all alerts')
    .option('--active', 'Show only active alerts')
    .option('--triggered', 'Show only triggered alerts')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const config = loadAlerts();
      let filtered = config.alerts;
      
      if (options.active) {
        filtered = filtered.filter(a => a.active && !a.triggered);
      }
      if (options.triggered) {
        filtered = filtered.filter(a => a.triggered);
      }
      
      if (options.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }
      
      if (filtered.length === 0) {
        console.log('No alerts configured.');
        console.log('\nCreate an alert:');
        console.log('  kit alerts add --symbol BTC/USD --above 100000');
        return;
      }
      
      console.log('🔔 Price Alerts\n');
      
      for (const alert of filtered) {
        const status = alert.triggered ? '✅ Triggered' 
                     : alert.active ? '🟢 Active' 
                     : '⏸️ Paused';
        const condStr = alert.condition === 'above' ? '>' 
                      : alert.condition === 'below' ? '<' 
                      : '↔️';
        
        console.log(`${status} ${alert.symbol} ${condStr} $${alert.price}`);
        console.log(`   ID: ${alert.id}`);
        if (alert.message) console.log(`   Message: ${alert.message}`);
        if (alert.triggeredAt) console.log(`   Triggered: ${alert.triggeredAt}`);
        console.log('');
      }
    });

  // Add alert
  alerts
    .command('add')
    .description('Add a new price alert')
    .requiredOption('--symbol <symbol>', 'Trading pair (e.g., BTC/USD)')
    .option('--above <price>', 'Alert when price goes above', parseFloat)
    .option('--below <price>', 'Alert when price goes below', parseFloat)
    .option('--crosses <price>', 'Alert when price crosses', parseFloat)
    .option('--message <msg>', 'Custom notification message')
    .option('--channel <ch>', 'Notification channel (telegram, discord, etc.)', 'telegram')
    .action((options) => {
      if (!options.above && !options.below && !options.crosses) {
        console.error('Error: Specify --above, --below, or --crosses with a price');
        process.exit(1);
      }
      
      const config = loadAlerts();
      
      const condition = options.above ? 'above' 
                      : options.below ? 'below' 
                      : 'crosses';
      const price = options.above || options.below || options.crosses;
      
      const alert: Alert = {
        id: generateId(),
        symbol: options.symbol.toUpperCase(),
        condition,
        price,
        message: options.message,
        channels: [options.channel],
        active: true,
        createdAt: new Date().toISOString(),
      };
      
      config.alerts.push(alert);
      saveAlerts(config);
      
      const condStr = condition === 'above' ? '>' 
                    : condition === 'below' ? '<' 
                    : 'crosses';
      
      console.log(`✅ Alert created: ${alert.symbol} ${condStr} $${price}`);
      console.log(`   ID: ${alert.id}`);
      console.log('\n💡 Start K.I.T. to monitor alerts: kit start');
    });

  // Remove alert
  alerts
    .command('remove <id>')
    .alias('rm')
    .description('Remove an alert')
    .action((id) => {
      const config = loadAlerts();
      const index = config.alerts.findIndex(a => a.id === id);
      
      if (index === -1) {
        console.error(`Alert not found: ${id}`);
        process.exit(1);
      }
      
      const alert = config.alerts[index];
      config.alerts.splice(index, 1);
      saveAlerts(config);
      
      console.log(`✅ Removed alert: ${alert.symbol} ${alert.condition} $${alert.price}`);
    });

  // Pause/resume alert
  alerts
    .command('pause <id>')
    .description('Pause an alert')
    .action((id) => {
      const config = loadAlerts();
      const alert = config.alerts.find(a => a.id === id);
      
      if (!alert) {
        console.error(`Alert not found: ${id}`);
        process.exit(1);
      }
      
      alert.active = false;
      saveAlerts(config);
      console.log(`⏸️ Paused: ${alert.symbol} ${alert.condition} $${alert.price}`);
    });

  alerts
    .command('resume <id>')
    .description('Resume a paused alert')
    .action((id) => {
      const config = loadAlerts();
      const alert = config.alerts.find(a => a.id === id);
      
      if (!alert) {
        console.error(`Alert not found: ${id}`);
        process.exit(1);
      }
      
      alert.active = true;
      alert.triggered = false;
      saveAlerts(config);
      console.log(`▶️ Resumed: ${alert.symbol} ${alert.condition} $${alert.price}`);
    });

  // Clear all triggered
  alerts
    .command('clear-triggered')
    .description('Clear all triggered alerts')
    .action(() => {
      const config = loadAlerts();
      const before = config.alerts.length;
      config.alerts = config.alerts.filter(a => !a.triggered);
      const removed = before - config.alerts.length;
      
      saveAlerts(config);
      console.log(`✅ Cleared ${removed} triggered alerts`);
    });

  // Test alert
  alerts
    .command('test <id>')
    .description('Test an alert notification')
    .action(async (id) => {
      const config = loadAlerts();
      const alert = config.alerts.find(a => a.id === id);
      
      if (!alert) {
        console.error(`Alert not found: ${id}`);
        process.exit(1);
      }
      
      console.log(`🧪 Testing alert: ${alert.symbol} ${alert.condition} $${alert.price}`);
      console.log('💡 This would send a notification via: ' + alert.channels.join(', '));
      console.log('\n⚠️ Full notification testing requires running gateway.');
    });
}

function loadAlerts(): AlertsConfig {
  if (!fs.existsSync(ALERTS_FILE)) {
    return { version: 1, alerts: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
  } catch {
    return { version: 1, alerts: [] };
  }
}

function saveAlerts(config: AlertsConfig): void {
  fs.mkdirSync(path.dirname(ALERTS_FILE), { recursive: true });
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(config, null, 2));
}

function generateId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
