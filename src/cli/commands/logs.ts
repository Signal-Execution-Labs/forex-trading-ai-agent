/**
 * K.I.T. Logs CLI Command
 * 
 * View and manage gateway logs.
 * 
 * @see OpenClaw docs/logging.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';
import { spawn } from 'child_process';

const KIT_HOME = path.join(os.homedir(), '.kit');
const LOGS_DIR = path.join(KIT_HOME, 'logs');
const GATEWAY_LOG = path.join(LOGS_DIR, 'gateway.log');
const COMMANDS_LOG = path.join(LOGS_DIR, 'commands.log');
const ERROR_LOG = path.join(LOGS_DIR, 'error.log');

export function registerLogsCommand(program: Command): void {
  const logs = program
    .command('logs')
    .description('View and manage gateway logs');

  // Show logs (default: gateway)
  logs
    .command('show')
    .alias('view')
    .description('Show log contents')
    .option('--type <type>', 'Log type: gateway, commands, error', 'gateway')
    .option('--lines <n>', 'Number of lines to show', parseInt)
    .option('--follow', 'Follow log output (tail -f)')
    .option('--json', 'Output as JSON (for commands log)')
    .action((options) => {
      const logFile = getLogFile(options.type);
      
      if (!fs.existsSync(logFile)) {
        console.log(`No ${options.type} log found.`);
        console.log('\n💡 Logs are created when K.I.T. runs.');
        return;
      }
      
      if (options.follow) {
        // Follow mode - use tail on Unix or PowerShell on Windows
        followLog(logFile);
        return;
      }
      
      let content = fs.readFileSync(logFile, 'utf8');
      
      if (options.lines) {
        const lines = content.split('\n');
        content = lines.slice(-options.lines).join('\n');
      }
      
      if (options.json && options.type === 'commands') {
        // Parse JSONL
        const entries = content.split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return { raw: line };
            }
          });
        console.log(JSON.stringify(entries, null, 2));
        return;
      }
      
      console.log(content);
    });

  // List log files
  logs
    .command('list')
    .alias('ls')
    .description('List all log files')
    .action(() => {
      if (!fs.existsSync(LOGS_DIR)) {
        console.log('No logs directory found.');
        return;
      }
      
      const files = fs.readdirSync(LOGS_DIR);
      
      if (files.length === 0) {
        console.log('No log files found.');
        return;
      }
      
      console.log('📋 Log Files:\n');
      
      for (const file of files) {
        const filePath = path.join(LOGS_DIR, file);
        const stat = fs.statSync(filePath);
        const size = formatSize(stat.size);
        const modified = stat.mtime.toLocaleString();
        console.log(`  ${file} (${size}) - ${modified}`);
      }
    });

  // Clear logs
  logs
    .command('clear')
    .description('Clear log files')
    .option('--type <type>', 'Log type: gateway, commands, error, all', 'all')
    .option('--confirm', 'Skip confirmation')
    .action((options) => {
      if (!options.confirm) {
        console.log(`⚠️ This will delete ${options.type === 'all' ? 'all' : options.type} logs.`);
        console.log('   Use --confirm to proceed.');
        return;
      }
      
      if (!fs.existsSync(LOGS_DIR)) {
        console.log('No logs to clear.');
        return;
      }
      
      if (options.type === 'all') {
        const files = fs.readdirSync(LOGS_DIR);
        for (const file of files) {
          fs.unlinkSync(path.join(LOGS_DIR, file));
        }
        console.log(`✅ Cleared ${files.length} log files`);
      } else {
        const logFile = getLogFile(options.type);
        if (fs.existsSync(logFile)) {
          fs.unlinkSync(logFile);
          console.log(`✅ Cleared ${options.type} log`);
        } else {
          console.log(`No ${options.type} log found.`);
        }
      }
    });

  // Show log stats
  logs
    .command('stats')
    .description('Show log statistics')
    .action(() => {
      if (!fs.existsSync(LOGS_DIR)) {
        console.log('No logs directory found.');
        return;
      }
      
      console.log('📊 Log Statistics:\n');
      
      let totalSize = 0;
      const files = fs.readdirSync(LOGS_DIR);
      
      for (const file of files) {
        const filePath = path.join(LOGS_DIR, file);
        const stat = fs.statSync(filePath);
        totalSize += stat.size;
        
        const lineCount = countLines(filePath);
        console.log(`${file}:`);
        console.log(`  Size: ${formatSize(stat.size)}`);
        console.log(`  Lines: ${lineCount}`);
        console.log(`  Modified: ${stat.mtime.toLocaleString()}`);
        console.log('');
      }
      
      console.log(`Total: ${formatSize(totalSize)} across ${files.length} files`);
    });

  // Shortcut: tail gateway log
  logs
    .command('tail')
    .description('Tail the gateway log (shortcut for logs show --follow)')
    .option('--lines <n>', 'Initial lines to show', parseInt)
    .action((options) => {
      if (!fs.existsSync(GATEWAY_LOG)) {
        console.log('No gateway log found. Start K.I.T. first: kit start');
        return;
      }
      
      if (options.lines) {
        const content = fs.readFileSync(GATEWAY_LOG, 'utf8');
        const lines = content.split('\n');
        console.log(lines.slice(-options.lines).join('\n'));
      }
      
      followLog(GATEWAY_LOG);
    });
}

function getLogFile(type: string): string {
  switch (type) {
    case 'commands': return COMMANDS_LOG;
    case 'error': return ERROR_LOG;
    case 'gateway':
    default: return GATEWAY_LOG;
  }
}

function followLog(logFile: string): void {
  console.log(`Following ${path.basename(logFile)}... (Ctrl+C to stop)\n`);
  
  if (process.platform === 'win32') {
    // Windows: use PowerShell Get-Content -Wait
    const ps = spawn('powershell', [
      '-Command',
      `Get-Content "${logFile}" -Wait -Tail 20`
    ], { stdio: 'inherit' });
    
    process.on('SIGINT', () => {
      ps.kill();
      process.exit(0);
    });
  } else {
    // Unix: use tail -f
    const tail = spawn('tail', ['-f', '-n', '20', logFile], { stdio: 'inherit' });
    
    process.on('SIGINT', () => {
      tail.kill();
      process.exit(0);
    });
  }
}

function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
