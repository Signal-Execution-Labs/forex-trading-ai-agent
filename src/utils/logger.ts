/**
 * K.I.T. Logger
 * Configurable logging system inspired by OpenClaw
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // Gray
  info: '\x1b[36m',   // Cyan
  warn: '\x1b[33m',   // Yellow
  error: '\x1b[31m',  // Red
  silent: '',
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  debug: '🔍',
  info: '📝',
  warn: '⚠️',
  error: '❌',
  silent: '',
};

const RESET = '\x1b[0m';

interface LoggerConfig {
  level?: LogLevel;
  file?: string;
  timestamps?: boolean;
  colors?: boolean;
  icons?: boolean;
}

class Logger {
  private level: LogLevel = 'info';
  private logFile: string | null = null;
  private timestamps: boolean = true;
  private colors: boolean = true;
  private icons: boolean = true;
  private namespace: string;
  private fileStream: fs.WriteStream | null = null;

  constructor(namespace: string = 'K.I.T.') {
    this.namespace = namespace;
    
    // Load config from environment or config file
    this.loadConfig();
  }

  private loadConfig(): void {
    // Check environment variables first
    const envLevel = process.env.KIT_LOG_LEVEL as LogLevel;
    if (envLevel && LEVEL_PRIORITY[envLevel] !== undefined) {
      this.level = envLevel;
    }

    const envFile = process.env.KIT_LOG_FILE;
    if (envFile) {
      this.setLogFile(envFile);
    }

    // Also check config file
    const configPath = path.join(os.homedir(), '.kit', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.logging?.level) {
          this.level = config.logging.level;
        }
        if (config.logging?.file) {
          this.setLogFile(config.logging.file);
        }
        if (config.logging?.timestamps !== undefined) {
          this.timestamps = config.logging.timestamps;
        }
        if (config.logging?.colors !== undefined) {
          this.colors = config.logging.colors;
        }
        if (config.logging?.icons !== undefined) {
          this.icons = config.logging.icons;
        }
      } catch {
        // Ignore config errors
      }
    }
  }

  configure(config: LoggerConfig): void {
    if (config.level) this.level = config.level;
    if (config.file) this.setLogFile(config.file);
    if (config.timestamps !== undefined) this.timestamps = config.timestamps;
    if (config.colors !== undefined) this.colors = config.colors;
    if (config.icons !== undefined) this.icons = config.icons;
  }

  private setLogFile(filePath: string): void {
    // Close existing stream
    if (this.fileStream) {
      this.fileStream.end();
    }

    // Expand path
    const expandedPath = filePath.replace('~', os.homedir());
    const dir = path.dirname(expandedPath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logFile = expandedPath;
    this.fileStream = fs.createWriteStream(expandedPath, { flags: 'a' });
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const parts: string[] = [];

    // Timestamp
    if (this.timestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    // Level with color and icon
    const icon = this.icons ? LEVEL_ICONS[level] + ' ' : '';
    const colorStart = this.colors ? LEVEL_COLORS[level] : '';
    const colorEnd = this.colors ? RESET : '';
    parts.push(`${colorStart}${icon}${level.toUpperCase()}${colorEnd}`);

    // Namespace
    parts.push(`[${this.namespace}]`);

    // Message
    parts.push(message);

    // Metadata
    if (meta && Object.keys(meta).length > 0) {
      parts.push(JSON.stringify(meta));
    }

    return parts.join(' ');
  }

  private formatFileMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const parts: string[] = [
      `[${new Date().toISOString()}]`,
      level.toUpperCase(),
      `[${this.namespace}]`,
      message,
    ];

    if (meta && Object.keys(meta).length > 0) {
      parts.push(JSON.stringify(meta));
    }

    return parts.join(' ');
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    // Console output
    const consoleMsg = this.formatMessage(level, message, meta);
    if (level === 'error') {
      console.error(consoleMsg);
    } else if (level === 'warn') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }

    // File output
    if (this.fileStream) {
      const fileMsg = this.formatFileMessage(level, message, meta);
      this.fileStream.write(fileMsg + '\n');
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  // Create a child logger with a different namespace
  child(namespace: string): Logger {
    const child = new Logger(`${this.namespace}:${namespace}`);
    child.level = this.level;
    child.timestamps = this.timestamps;
    child.colors = this.colors;
    child.icons = this.icons;
    child.fileStream = this.fileStream;
    return child;
  }

  // Get current log level
  getLevel(): LogLevel {
    return this.level;
  }

  // Set log level dynamically
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  // Close file stream
  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }
}

// Global logger instance
export const logger = new Logger();

// Create namespaced loggers
export function createLogger(namespace: string): Logger {
  return logger.child(namespace);
}

export { Logger };
