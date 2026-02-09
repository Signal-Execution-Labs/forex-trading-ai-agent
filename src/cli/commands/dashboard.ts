/**
 * K.I.T. CLI - Dashboard Command
 * Opens the K.I.T. dashboard in browser
 */

import { Command } from 'commander';
import chalk from 'chalk';

export const dashboardCommand = new Command('dashboard')
  .description('Open the K.I.T. dashboard in browser')
  .option('-p, --port <port>', 'Gateway port', '18799')
  .option('--copy', 'Copy URL to clipboard instead of opening')
  .action(async (options) => {
    const port = options.port || 18799;
    const url = `http://localhost:${port}/`;

    console.log(chalk.cyan('\n🚗 K.I.T. Dashboard\n'));

    if (options.copy) {
      // Copy to clipboard
      try {
        const clipboardy = await import('clipboardy').then(m => m.default).catch(() => null);
        if (clipboardy) {
          await clipboardy.write(url);
          console.log(chalk.green('✓ URL copied to clipboard:'));
          console.log(chalk.white(`  ${url}`));
        } else {
          console.log(chalk.yellow('Dashboard URL:'));
          console.log(chalk.white(`  ${url}`));
        }
      } catch {
        console.log(chalk.yellow('Dashboard URL:'));
        console.log(chalk.white(`  ${url}`));
      }
    } else {
      // Open in browser
      try {
        const open = await import('open').then(m => m.default).catch(() => null);
        if (open) {
          await open(url);
          console.log(chalk.green('✓ Dashboard opened in browser'));
          console.log(chalk.gray(`  ${url}`));
        } else {
          console.log(chalk.yellow('Could not open browser. URL:'));
          console.log(chalk.white(`  ${url}`));
        }
      } catch (error) {
        console.log(chalk.red('Failed to open browser:'), error);
        console.log(chalk.yellow('\nOpen manually:'));
        console.log(chalk.white(`  ${url}`));
      }
    }

    console.log('');
  });
