/**
 * K.I.T. Enhanced Logger
 * 
 * Features:
 * - File logging (JSONL format)
 * - Console styles (pretty, compact, json)
 * - Child loggers for subsystems
 * - TTY-aware colorization
 * - Redaction for sensitive data
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type ConsoleStyle = 'pretty' | 'compact' | 'json';

const LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

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

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: COLORS.gray,
  debug: COLORS.blue,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
  fatal: COLORS.magenta,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  trace: 'TRC',
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
  fatal: 'FTL',
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  name: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  consoleLevel?: LogLevel;
  consoleStyle?: ConsoleStyle;
  file?: string;
  redactPatterns?: RegExp[];
  noColor?: boolean;
}

// Default config
const defaultConfig: LoggerConfig = {
  level: 'info',
  consoleLevel: 'info',
  consoleStyle: 'pretty',
};

// Global state
let globalConfig: LoggerConfig = { ...defaultConfig };
let logFileStream: fs.WriteStream | null = null;

// Default redaction patterns (API keys, tokens, etc.)
const DEFAULT_REDACT_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,           // OpenAI
  /sk-ant-[a-zA-Z0-9-]+/g,          // Anthropic
  /AIza[a-zA-Z0-9_-]{35}/g,         // Google
  /[a-f0-9]{64}/g,                  // 64-char hex (exchange secrets)
  /Bearer [a-zA-Z0-9._-]+/gi,       // Bearer tokens
  /Basic [a-zA-Z0-9+/=]+/gi,        // Basic auth
];

function getLogFilePath(): string {
  if (globalConfig.file) return globalConfig.file;
  
  const today = new Date().toISOString().split('T')[0];
  const logDir = process.platform === 'win32' 
    ? path.join(os.tmpdir(), 'kit')
    : '/tmp/kit';
  
  if (!fs.existsSync(logDir)) {
    try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
  }
  
  return path.join(logDir, `kit-${today}.log`);
}

function ensureLogFile(): void {
  if (logFileStream) return;
  
  const logPath = getLogFilePath();
  try {
    logFileStream = fs.createWriteStream(logPath, { flags: 'a' });
  } catch {
    // Ignore errors
  }
}

function redact(text: string): string {
  let result = text;
  const patterns = globalConfig.redactPatterns || DEFAULT_REDACT_PATTERNS;
  
  for (const pattern of patterns) {
    result = result.replace(pattern, '[REDACTED]');
  }
  
  return result;
}

function isTTY(): boolean {
  return process.stdout.isTTY ?? false;
}

function formatPretty(entry: LogEntry): string {
  const useColor = isTTY() && !globalConfig.noColor;
  const c = useColor ? COLORS : { reset: '', dim: '', red: '', yellow: '', green: '', blue: '', cyan: '', magenta: '', gray: '' };
  const levelColor = useColor ? LEVEL_COLORS[entry.level] : '';
  
  const time = entry.timestamp.split('T')[1]?.split('.')[0] || entry.timestamp;
  const level = LEVEL_LABELS[entry.level];
  const name = entry.name;
  
  let line = `${c.dim}${time}${c.reset} ${levelColor}${level}${c.reset} ${c.cyan}[${name}]${c.reset} ${entry.message}`;
  
  if (entry.data && Object.keys(entry.data).length > 0) {
    line += ` ${c.dim}${JSON.stringify(entry.data)}${c.reset}`;
  }
  
  if (entry.error) {
    line += `\n${c.red}  Error: ${entry.error.message}${c.reset}`;
    if (entry.error.stack) {
      line += `\n${c.dim}${entry.error.stack}${c.reset}`;
    }
  }
  
  return redact(line);
}

function formatCompact(entry: LogEntry): string {
  const level = LEVEL_LABELS[entry.level];
  let line = `${level} [${entry.name}] ${entry.message}`;
  
  if (entry.data && Object.keys(entry.data).length > 0) {
    line += ` ${JSON.stringify(entry.data)}`;
  }
  
  return redact(line);
}

function formatJson(entry: LogEntry): string {
  return redact(JSON.stringify(entry));
}

function formatConsole(entry: LogEntry): string {
  switch (globalConfig.consoleStyle) {
    case 'json': return formatJson(entry);
    case 'compact': return formatCompact(entry);
    default: return formatPretty(entry);
  }
}

export class Logger {
  private name: string;
  
  constructor(name: string) {
    this.name = name;
  }

  private shouldLogFile(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[globalConfig.level];
  }

  private shouldLogConsole(level: LogLevel): boolean {
    const consoleLevel = globalConfig.consoleLevel ?? globalConfig.level;
    return LEVELS[level] >= LEVELS[consoleLevel];
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      name: this.name,
      message,
    };
    
    if (data && Object.keys(data).length > 0) {
      entry.data = data;
    }
    
    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }
    
    // File logging (JSONL, unredacted for debugging)
    if (this.shouldLogFile(level)) {
      ensureLogFile();
      if (logFileStream) {
        logFileStream.write(JSON.stringify(entry) + '\n');
      }
    }
    
    // Console logging (formatted, redacted)
    if (this.shouldLogConsole(level)) {
      const formatted = formatConsole(entry);
      
      if (level === 'error' || level === 'fatal') {
        console.error(formatted);
      } else if (level === 'warn') {
        console.warn(formatted);
      } else if (level === 'debug' || level === 'trace') {
        console.debug(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  trace(message: string, data?: any): void {
    this.log('trace', message, this.normalizeData(data));
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, this.normalizeData(data));
  }

  info(message: string, data?: any): void {
    this.log('info', message, this.normalizeData(data));
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, this.normalizeData(data));
  }

  error(message: string, data?: any, error?: Error): void {
    this.log('error', message, this.normalizeData(data), error);
  }

  fatal(message: string, data?: any, error?: Error): void {
    this.log('fatal', message, this.normalizeData(data), error);
  }

  private normalizeData(data: any): Record<string, unknown> | undefined {
    if (data === undefined || data === null) return undefined;
    if (typeof data === 'object') return data as Record<string, unknown>;
    return { value: data };
  }

  /**
   * Create a child logger with a combined name
   */
  child(childName: string): Logger {
    return new Logger(`${this.name}/${childName}`);
  }

  /**
   * Log with timing
   */
  time<T>(label: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.debug(`${label} completed`, { durationMs: Math.round(duration) });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${label} failed`, { durationMs: Math.round(duration) }, error as Error);
      throw error;
    }
  }

  /**
   * Async timing
   */
  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.debug(`${label} completed`, { durationMs: Math.round(duration) });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${label} failed`, { durationMs: Math.round(duration) }, error as Error);
      throw error;
    }
  }
}

/**
 * Configure the global logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...defaultConfig, ...config };
  
  // Close existing stream if file path changed
  if (logFileStream && config.file) {
    logFileStream.end();
    logFileStream = null;
  }
}

/**
 * Get current log file path
 */
export function getLogFile(): string {
  return getLogFilePath();
}

/**
 * Set global log level
 */
export function setLogLevel(level: LogLevel): void {
  globalConfig.level = level;
}

/**
 * Set console log level
 */
export function setConsoleLevel(level: LogLevel): void {
  globalConfig.consoleLevel = level;
}

/**
 * Set console style
 */
export function setConsoleStyle(style: ConsoleStyle): void {
  globalConfig.consoleStyle = style;
}

/**
 * Create a logger instance
 */
export function createLogger(name: string): Logger {
  return new Logger(name);
}

/**
 * Flush and close the log file (for clean shutdown)
 */
export function closeLogger(): Promise<void> {
  return new Promise((resolve) => {
    if (logFileStream) {
      logFileStream.end(() => {
        logFileStream = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Default export
export default Logger;
