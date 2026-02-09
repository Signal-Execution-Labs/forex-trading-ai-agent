/**
 * K.I.T. CLI - Status Command
 * Shows current gateway and trading status
 */

import { Command } from 'commander';
import WebSocket from 'ws';
import chalk from 'chalk';

export const statusCommand = new Command('status')
  .description('Show K.I.T. gateway and trading status')
  .option('-p, --port <port>', 'Gateway port', '18799')
  .action(async (options) => {
    const port = options.port || 18799;
    const wsUrl = `ws://localhost:${port}`;

    console.log(chalk.cyan('\n🚗 K.I.T. Status\n'));

    try {
      // Try to connect to gateway
      const status = await getGatewayStatus(wsUrl);
      
      console.log(chalk.green('Gateway: ') + chalk.white('Online ✓'));
      console.log(chalk.gray(`  URL: ${wsUrl}`));
      console.log(chalk.gray(`  Dashboard: http://localhost:${port}/`));
      
      if (status.sessions) {
        console.log(chalk.cyan(`\nSessions: ${status.sessions.length}`));
        for (const session of status.sessions.slice(0, 5)) {
          console.log(chalk.gray(`  • ${session.key}`));
        }
      }

      if (status.portfolio) {
        console.log(chalk.cyan('\nPortfolio:'));
        console.log(chalk.white(`  Total: $${status.portfolio.total?.toLocaleString() || '0'}`));
        if (status.portfolio.change) {
          const changeColor = status.portfolio.change >= 0 ? chalk.green : chalk.red;
          console.log(changeColor(`  Change: ${status.portfolio.change >= 0 ? '+' : ''}${status.portfolio.change}%`));
        }
      }

      if (status.trades) {
        console.log(chalk.cyan(`\nActive Trades: ${status.trades.active || 0}`));
        console.log(chalk.gray(`  Today: ${status.trades.today || 0} trades`));
        console.log(chalk.gray(`  Win Rate: ${status.trades.winRate || '--'}%`));
      }

    } catch (error) {
      console.log(chalk.red('Gateway: ') + chalk.gray('Offline'));
      console.log(chalk.gray(`\n  Start with: ${chalk.white('kit start')}`));
    }

    console.log('');
  });

async function getGatewayStatus(wsUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, 5000);

    ws.on('open', () => {
      // Send status request
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'status',
        params: {},
        id: 1
      }));
    });

    ws.on('message', (data) => {
      clearTimeout(timeout);
      try {
        const response = JSON.parse(data.toString());
        ws.close();
        resolve(response.result || {});
      } catch (e) {
        ws.close();
        resolve({});
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
