/**
 * K.I.T. Logs Command
 * 
 * Tail and view log files like OpenClaw's `openclaw logs`
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

const KIT_HOME = path.join(os.homedir(), '.kit');

function getLogDir(): string {
  return process.platform === 'win32'
    ? path.join(os.tmpdir(), 'kit')
    : '/tmp/kit';
}

function getLogFile(date?: string): string {
  const logDate = date || new Date().toISOString().split('T')[0];
  return path.join(getLogDir(), `kit-${logDate}.log`);
}

interface LogEntry {
  timestamp: string;
  level: string;
  name: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
  };
}

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

const LEVEL_COLORS: Record<string, string> = {
  trace: COLORS.gray,
  debug: COLORS.blue,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
  fatal: COLORS.magenta,
};

function formatEntry(entry: LogEntry, options: { json?: boolean; plain?: boolean; noColor?: boolean }): string {
  if (options.json) {
    return JSON.stringify(entry);
  }

  const useColor = process.stdout.isTTY && !options.noColor && !options.plain;
  const c = useColor ? COLORS : { reset: '', dim: '', red: '', yellow: '', green: '', blue: '', cyan: '', magenta: '', gray: '' };
  const levelColor = useColor ? (LEVEL_COLORS[entry.level] || '') : '';

  const time = entry.timestamp.split('T')[1]?.split('.')[0] || entry.timestamp;
  const level = entry.level.toUpperCase().padEnd(5);

  let line = `${c.dim}${time}${c.reset} ${levelColor}${level}${c.reset} ${c.cyan}[${entry.name}]${c.reset} ${entry.message}`;

  if (entry.data && Object.keys(entry.data).length > 0) {
    line += ` ${c.dim}${JSON.stringify(entry.data)}${c.reset}`;
  }

  if (entry.error) {
    line += `\n${c.red}  Error: ${entry.error.message}${c.reset}`;
    if (entry.error.stack) {
      const stackLines = entry.error.stack.split('\n').slice(1, 4);
      line += `\n${c.dim}${stackLines.join('\n')}${c.reset}`;
    }
  }

  return line;
}

async function tailFile(filePath: string, options: { follow?: boolean; json?: boolean; plain?: boolean; noColor?: boolean; lines?: number; level?: string }): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.error(`Log file not found: ${filePath}`);
    console.error('\nHint: Make sure K.I.T. gateway is running or has been run today.');
    process.exit(1);
  }

  const minLevel = options.level?.toLowerCase();
  const levelPriority: Record<string, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
  };

  const filterLevel = (entry: LogEntry): boolean => {
    if (!minLevel) return true;
    return (levelPriority[entry.level] ?? 0) >= (levelPriority[minLevel] ?? 0);
  };

  // Read existing content
  const existingLines: string[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    existingLines.push(line);
  }

  // Show last N lines
  const linesToShow = options.lines || 50;
  const startIndex = Math.max(0, existingLines.length - linesToShow);

  for (let i = startIndex; i < existingLines.length; i++) {
    try {
      const entry = JSON.parse(existingLines[i]) as LogEntry;
      if (filterLevel(entry)) {
        console.log(formatEntry(entry, options));
      }
    } catch {
      // Raw line, print as-is
      console.log(existingLines[i]);
    }
  }

  // Follow mode
  if (options.follow) {
    console.log('\n--- Following logs (Ctrl+C to stop) ---\n');

    let position = fs.statSync(filePath).size;

    const watcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'change') {
        const stats = fs.statSync(filePath);
        if (stats.size > position) {
          const stream = fs.createReadStream(filePath, {
            start: position,
            end: stats.size,
          });

          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const entry = JSON.parse(line) as LogEntry;
                if (filterLevel(entry)) {
                  console.log(formatEntry(entry, options));
                }
              } catch {
                console.log(line);
              }
            }
          });

          position = stats.size;
        }
      }
    });

    // Handle cleanup
    process.on('SIGINT', () => {
      watcher.close();
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});
  }
}

async function listLogs(): Promise<void> {
  const logDir = getLogDir();

  if (!fs.existsSync(logDir)) {
    console.log('No log directory found.');
    return;
  }

  const files = fs.readdirSync(logDir)
    .filter(f => f.startsWith('kit-') && f.endsWith('.log'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('No log files found.');
    return;
  }

  console.log('📄 K.I.T. Log Files:\n');
  
  for (const file of files) {
    const filePath = path.join(logDir, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(1);
    const date = file.replace('kit-', '').replace('.log', '');
    
    console.log(`  ${date}  ${size.padStart(8)} KB  ${filePath}`);
  }

  console.log(`\nTotal: ${files.length} log file(s)`);
}

export function registerLogsCommand(program: Command): void {
  program
    .command('logs')
    .description('View and tail K.I.T. log files')
    .option('-f, --follow', 'Follow log output (like tail -f)')
    .option('-n, --lines <n>', 'Number of lines to show', '50')
    .option('--level <level>', 'Filter by minimum log level (trace|debug|info|warn|error)')
    .option('--date <date>', 'View logs from specific date (YYYY-MM-DD)')
    .option('--json', 'Output raw JSON lines')
    .option('--plain', 'Plain text output (no colors)')
    .option('--no-color', 'Disable colors')
    .option('--list', 'List available log files')
    .action(async (options) => {
      if (options.list) {
        await listLogs();
        return;
      }

      const logFile = getLogFile(options.date);
      await tailFile(logFile, {
        follow: options.follow,
        json: options.json,
        plain: options.plain,
        noColor: !options.color,
        lines: parseInt(options.lines, 10),
        level: options.level,
      });
    });
}
