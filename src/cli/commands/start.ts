/**
 * K.I.T. CLI - Start Command
 * Starts the K.I.T. Gateway server
 */

import { Command } from 'commander';
import { createGatewayServer } from '../../gateway/server';
import { loadConfig } from '../config';
import chalk from 'chalk';

export const startCommand = new Command('start')
  .description('Start the K.I.T. Gateway server')
  .option('-p, --port <port>', 'Port to listen on', '18799')
  .option('-c, --config <path>', 'Path to config file')
  .option('--no-dashboard', 'Do not open dashboard')
  .action(async (options) => {
    console.log(chalk.cyan(`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║   🚗 K.I.T. - Knight Industries Trading ║
    ║                                       ║
    ║   "Your wealth is my mission"         ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
    `));

    try {
      // Load configuration
      const config = await loadConfig(options.config);
      
      // Start gateway server
      const port = parseInt(options.port, 10) || config.gateway?.port || 18799;
      
      console.log(chalk.gray(`Starting gateway on port ${port}...`));
      
      const server = await createGatewayServer({
        port,
        host: '127.0.0.1',
        stateDir: '.kit/state',
        workspaceDir: '.kit/workspace',
        agent: {
          id: 'kit',
          name: config.agent?.name || 'K.I.T.',
          model: config.agent?.model || 'claude-opus-4-5-20251101',
        },
        heartbeat: { enabled: false, every: '30m' },
        cron: { enabled: false },
        memory: {},
      });

      console.log(chalk.green(`✓ Gateway running at ws://localhost:${port}`));
      console.log(chalk.green(`✓ Dashboard at http://localhost:${port}/`));
      
      if (options.dashboard !== false) {
        // Open dashboard in browser
        const open = await import('open').then(m => m.default).catch(() => null);
        if (open) {
          await open(`http://localhost:${port}/`);
          console.log(chalk.gray('  Dashboard opened in browser'));
        }
      }

      console.log(chalk.yellow('\nPress Ctrl+C to stop\n'));

      // Handle shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.gray('\nShutting down...'));
        process.exit(0);
      });

    } catch (error) {
      console.error(chalk.red('Failed to start gateway:'), error);
      process.exit(1);
    }
  });
