/**
 * K.I.T. Plugin CLI Commands
 * 
 * Commands:
 * - kit plugins list     - List all plugins (available + loaded)
 * - kit plugins load     - Load a plugin
 * - kit plugins unload   - Unload a plugin
 * - kit plugins enable   - Enable a plugin
 * - kit plugins disable  - Disable a plugin
 * - kit plugins install  - Install a plugin from npm/path
 * - kit plugins info     - Show plugin details
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getPluginRegistry, listPlugins, installPlugin } from '../../plugins';
import { createLogger } from '../../core/logger';

const logger = createLogger('cli:plugins');

export function registerPluginCommands(program: Command): void {
  const plugins = program
    .command('plugins')
    .description('Manage K.I.T. plugins');

  // List plugins
  plugins
    .command('list')
    .description('List all available and loaded plugins')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
      try {
        const { available, loaded } = await listPlugins();
        
        console.log(chalk.bold('\n🔌 K.I.T. Plugins\n'));
        
        if (available.length === 0) {
          console.log(chalk.gray('  No plugins found.'));
          console.log(chalk.gray('  Install plugins with: kit plugins install <name>'));
        } else {
          console.log(chalk.cyan('Available Plugins:\n'));
          
          for (const manifest of available) {
            const isLoaded = loaded.includes(manifest.id);
            const status = isLoaded 
              ? chalk.green('● loaded') 
              : chalk.gray('○ available');
            
            console.log(`  ${status} ${chalk.bold(manifest.name)} (${manifest.id})`);
            
            if (options.verbose) {
              console.log(chalk.gray(`      Version: ${manifest.version}`));
              if (manifest.description) {
                console.log(chalk.gray(`      ${manifest.description}`));
              }
              if (manifest.author) {
                console.log(chalk.gray(`      Author: ${manifest.author}`));
              }
              console.log();
            }
          }
        }
        
        console.log();
        console.log(chalk.gray(`  Loaded: ${loaded.length}/${available.length}`));
        console.log();
      } catch (error) {
        logger.error('Failed to list plugins:', error);
        console.error(chalk.red('Error listing plugins:'), error);
        process.exit(1);
      }
    });

  // Load a plugin
  plugins
    .command('load <id>')
    .description('Load a plugin by ID')
    .action(async (id) => {
      try {
        console.log(chalk.cyan(`Loading plugin: ${id}...`));
        
        const reg = getPluginRegistry();
        const result = await reg.load(id);
        
        if (result.success) {
          console.log(chalk.green(`✅ Plugin loaded: ${id}`));
        } else {
          console.log(chalk.red(`❌ Failed to load plugin: ${result.error}`));
          process.exit(1);
        }
      } catch (error) {
        logger.error('Failed to load plugin:', error);
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  // Unload a plugin
  plugins
    .command('unload <id>')
    .description('Unload a plugin by ID')
    .action(async (id) => {
      try {
        console.log(chalk.cyan(`Unloading plugin: ${id}...`));
        
        const reg = getPluginRegistry();
        const success = await reg.unload(id);
        
        if (success) {
          console.log(chalk.green(`✅ Plugin unloaded: ${id}`));
        } else {
          console.log(chalk.yellow(`Plugin not loaded: ${id}`));
        }
      } catch (error) {
        logger.error('Failed to unload plugin:', error);
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  // Enable a plugin
  plugins
    .command('enable <id>')
    .description('Enable a plugin (load and auto-start)')
    .action(async (id) => {
      try {
        console.log(chalk.cyan(`Enabling plugin: ${id}...`));
        
        const reg = getPluginRegistry();
        const result = await reg.enable(id);
        
        if (result.success) {
          console.log(chalk.green(`✅ Plugin enabled: ${id}`));
        } else {
          console.log(chalk.red(`❌ Failed to enable: ${result.error}`));
          process.exit(1);
        }
      } catch (error) {
        logger.error('Failed to enable plugin:', error);
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  // Disable a plugin
  plugins
    .command('disable <id>')
    .description('Disable a plugin (unload and prevent auto-start)')
    .action(async (id) => {
      try {
        console.log(chalk.cyan(`Disabling plugin: ${id}...`));
        
        const reg = getPluginRegistry();
        const success = await reg.disable(id);
        
        if (success) {
          console.log(chalk.green(`✅ Plugin disabled: ${id}`));
        } else {
          console.log(chalk.yellow(`Plugin not loaded: ${id}`));
        }
      } catch (error) {
        logger.error('Failed to disable plugin:', error);
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  // Install a plugin
  plugins
    .command('install <source>')
    .description('Install a plugin from npm package or local path')
    .action(async (source) => {
      try {
        console.log(chalk.cyan(`Installing plugin: ${source}...`));
        
        const result = await installPlugin(source);
        
        if (result.success) {
          console.log(chalk.green(`✅ Plugin installed and loaded: ${result.pluginId}`));
        } else {
          console.log(chalk.red(`❌ Failed to install: ${result.error}`));
          process.exit(1);
        }
      } catch (error) {
        logger.error('Failed to install plugin:', error);
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  // Plugin info
  plugins
    .command('info <id>')
    .description('Show detailed information about a plugin')
    .action(async (id) => {
      try {
        const reg = getPluginRegistry();
        const plugin = reg.get(id);
        
        if (!plugin) {
          // Try to find in available
          const available = await reg.discover();
          const manifest = available.find(m => m.id === id);
          
          if (manifest) {
            console.log(chalk.bold(`\n🔌 ${manifest.name}`));
            console.log(chalk.gray('   (not loaded)'));
            console.log();
            console.log(`  ID:          ${manifest.id}`);
            console.log(`  Version:     ${manifest.version}`);
            if (manifest.description) console.log(`  Description: ${manifest.description}`);
            if (manifest.author) console.log(`  Author:      ${manifest.author}`);
            if (manifest.license) console.log(`  License:     ${manifest.license}`);
            if (manifest.homepage) console.log(`  Homepage:    ${manifest.homepage}`);
            if (manifest.keywords?.length) {
              console.log(`  Keywords:    ${manifest.keywords.join(', ')}`);
            }
            console.log();
            console.log(chalk.gray(`  Load with: kit plugins load ${id}`));
          } else {
            console.log(chalk.red(`Plugin not found: ${id}`));
            process.exit(1);
          }
          return;
        }
        
        const { manifest } = plugin;
        
        console.log(chalk.bold(`\n🔌 ${manifest.name}`));
        console.log(chalk.green('   (loaded)'));
        console.log();
        console.log(`  ID:          ${manifest.id}`);
        console.log(`  Version:     ${manifest.version}`);
        console.log(`  Path:        ${plugin.path}`);
        if (manifest.description) console.log(`  Description: ${manifest.description}`);
        if (manifest.author) console.log(`  Author:      ${manifest.author}`);
        if (manifest.license) console.log(`  License:     ${manifest.license}`);
        
        if (plugin.tools.size > 0) {
          console.log(`\n  Tools (${plugin.tools.size}):`);
          for (const [name] of plugin.tools) {
            console.log(`    - ${name}`);
          }
        }
        
        if (plugin.services.size > 0) {
          console.log(`\n  Services (${plugin.services.size}):`);
          for (const [name, service] of plugin.services) {
            const status = service.isRunning() ? chalk.green('running') : chalk.gray('stopped');
            console.log(`    - ${name} [${status}]`);
          }
        }
        
        if (plugin.rpcs.size > 0) {
          console.log(`\n  RPC Methods (${plugin.rpcs.size}):`);
          for (const [method] of plugin.rpcs) {
            console.log(`    - ${method}`);
          }
        }
        
        console.log();
      } catch (error) {
        logger.error('Failed to get plugin info:', error);
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });
}
