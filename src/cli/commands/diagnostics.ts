/**
 * K.I.T. Diagnostics CLI Command
 * 
 * Manage diagnostic flags for targeted debug logging.
 */

import { Command } from 'commander';
import { diagnostics, DIAGNOSTIC_FLAGS } from '../../core/diagnostics';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const KIT_HOME = path.join(os.homedir(), '.kit');

export function createDiagnosticsCommand(): Command {
  const cmd = new Command('diagnostics')
    .alias('diag')
    .description('Manage diagnostic flags for targeted debug logging')
    .option('-l, --list', 'List all available diagnostic flags')
    .option('-s, --status', 'Show current diagnostic status')
    .option('-e, --enable <flags>', 'Enable flags (comma-separated)')
    .option('-d, --disable <flags>', 'Disable flags (comma-separated)')
    .option('--tail [lines]', 'Tail the diagnostic log file')
    .option('--path', 'Show log file path')
    .action(async (options) => {
      
      if (options.list) {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                 K.I.T. Diagnostic Flags                        ║
╚═══════════════════════════════════════════════════════════════╝

Flags let you enable targeted debug logs without turning on verbose 
logging everywhere. Use wildcards: "trading.*" matches all trading flags.

`);
        
        // Group flags by category
        const categories: Record<string, string[]> = {};
        for (const [flag, desc] of Object.entries(DIAGNOSTIC_FLAGS)) {
          const cat = flag.split('.')[0];
          if (!categories[cat]) categories[cat] = [];
          categories[cat].push(`${flag.padEnd(20)} ${desc}`);
        }
        
        for (const [cat, flags] of Object.entries(categories)) {
          const emoji: Record<string, string> = {
            ai: '🧠', trading: '📈', exchange: '🏦', gateway: '🌐',
            channel: '📱', brain: '🤖', skills: '⚡', tools: '🔧'
          };
          console.log(`${emoji[cat] || '•'} ${cat.toUpperCase()}`);
          console.log('─'.repeat(50));
          for (const flag of flags) {
            console.log(`   ${flag}`);
          }
          console.log('');
        }
        
        console.log(`
USAGE:
   kit diagnostics --enable trading.mt5,ai.anthropic
   kit diagnostics --disable trading.*
   kit diagnostics --status
   kit diagnostics --tail

CONFIG:
   In config.json: { "diagnostics": { "flags": ["trading.*"] } }

ENV OVERRIDE:
   KIT_DIAGNOSTICS=trading.*,ai.anthropic
   KIT_DIAGNOSTICS=0  (disable all)
   KIT_DIAGNOSTICS=*  (enable all)
`);
        return;
      }
      
      if (options.status) {
        console.log('\n📊 Diagnostics Status\n');
        
        const enabled = diagnostics.getEnabledFlags();
        const logFile = diagnostics.getLogFile();
        
        console.log(`   Enabled Flags: ${enabled.length > 0 ? enabled.join(', ') : 'none'}`);
        console.log(`   Log File: ${logFile || 'not configured'}`);
        
        if (logFile && fs.existsSync(logFile)) {
          const stats = fs.statSync(logFile);
          const sizeKB = (stats.size / 1024).toFixed(1);
          console.log(`   Log Size: ${sizeKB} KB`);
          console.log(`   Last Modified: ${stats.mtime.toISOString()}`);
        }
        
        console.log('');
        return;
      }
      
      if (options.enable) {
        const flags = options.enable.split(',').map((f: string) => f.trim());
        
        // Update config file
        const configPath = path.join(KIT_HOME, 'config.json');
        let config: any = {};
        
        if (fs.existsSync(configPath)) {
          try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
        }
        
        config.diagnostics = config.diagnostics || {};
        config.diagnostics.flags = config.diagnostics.flags || [];
        
        for (const flag of flags) {
          if (!config.diagnostics.flags.includes(flag)) {
            config.diagnostics.flags.push(flag);
          }
          diagnostics.enable(flag);
        }
        
        // Ensure directory exists
        if (!fs.existsSync(KIT_HOME)) {
          fs.mkdirSync(KIT_HOME, { recursive: true });
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log(`\n✅ Enabled: ${flags.join(', ')}`);
        console.log(`   Saved to: ${configPath}\n`);
        return;
      }
      
      if (options.disable) {
        const flags = options.disable.split(',').map((f: string) => f.trim());
        
        // Update config file
        const configPath = path.join(KIT_HOME, 'config.json');
        let config: any = {};
        
        if (fs.existsSync(configPath)) {
          try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
        }
        
        if (config.diagnostics?.flags) {
          config.diagnostics.flags = config.diagnostics.flags.filter(
            (f: string) => !flags.includes(f) && !flags.includes('*')
          );
        }
        
        if (flags.includes('*')) {
          config.diagnostics = { flags: [] };
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        for (const flag of flags) {
          diagnostics.disable(flag);
        }
        
        console.log(`\n✅ Disabled: ${flags.join(', ')}`);
        console.log(`   Saved to: ${configPath}\n`);
        return;
      }
      
      if (options.path) {
        const logFile = diagnostics.getLogFile();
        console.log(logFile || 'No log file configured');
        return;
      }
      
      if (options.tail !== undefined) {
        const logFile = diagnostics.getLogFile();
        
        if (!logFile) {
          console.log('❌ No log file configured');
          return;
        }
        
        if (!fs.existsSync(logFile)) {
          console.log(`❌ Log file not found: ${logFile}`);
          return;
        }
        
        const lines = parseInt(options.tail, 10) || 50;
        console.log(`\n📜 Last ${lines} diagnostic entries from ${logFile}\n`);
        console.log('─'.repeat(60));
        
        const content = fs.readFileSync(logFile, 'utf8');
        const entries = content.trim().split('\n').slice(-lines);
        
        for (const entry of entries) {
          try {
            const log = JSON.parse(entry);
            const time = log.timestamp?.split('T')[1]?.slice(0, 8) || '??:??:??';
            console.log(`[${time}] [${log.flag}] ${log.message}`);
            if (log.data) {
              console.log(`         ${JSON.stringify(log.data)}`);
            }
          } catch {
            console.log(entry);
          }
        }
        
        console.log('─'.repeat(60));
        console.log('');
        return;
      }
      
      // Default: show help
      cmd.help();
    });
  
  return cmd;
}
