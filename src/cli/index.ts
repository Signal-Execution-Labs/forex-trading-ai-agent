#!/usr/bin/env node
/**
 * K.I.T. CLI - Knight Industries Trading
 * Command-line interface for K.I.T. AI Trading Framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { startCommand } from './commands/start';
import { statusCommand } from './commands/status';
import { dashboardCommand } from './commands/dashboard';

const program = new Command();

program
  .name('kit')
  .description('K.I.T. - AI Financial Agent Framework')
  .version('2.0.0')
  .addCommand(startCommand)
  .addCommand(statusCommand)
  .addCommand(dashboardCommand);

// Add help text
program.on('--help', () => {
  console.log('');
  console.log(chalk.cyan('Examples:'));
  console.log(chalk.gray('  $ kit start              # Start the gateway'));
  console.log(chalk.gray('  $ kit status             # Check gateway status'));
  console.log(chalk.gray('  $ kit dashboard          # Open web dashboard'));
  console.log('');
  console.log(chalk.cyan('Documentation:'));
  console.log(chalk.gray('  https://github.com/kayzaa/k.i.t.-bot'));
  console.log('');
});

// Default action (no command)
if (process.argv.length === 2) {
  console.log(chalk.cyan(`
  🚗 K.I.T. - Knight Industries Trading
  
  ${chalk.white('Commands:')}
    start       Start the K.I.T. gateway
    status      Show gateway and trading status
    dashboard   Open web dashboard
    
  ${chalk.white('Quick Start:')}
    ${chalk.gray('$ kit start')}
    
  ${chalk.white('Documentation:')}
    ${chalk.gray('https://github.com/kayzaa/k.i.t.-bot')}
  `));
  process.exit(0);
}

program.parse();
