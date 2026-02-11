/**
 * K.I.T. Diagnostics Flags System
 * 
 * Targeted debug logging without raising global log levels.
 * Inspired by OpenClaw's diagnostics system.
 * 
 * Usage:
 *   - In config.json: { "diagnostics": { "flags": ["trading.mt5", "ai.anthropic"] } }
 *   - Env override: KIT_DIAGNOSTICS=trading.mt5,ai.anthropic
 *   - Disable all: KIT_DIAGNOSTICS=0
 *   - Enable all: KIT_DIAGNOSTICS=*
 * 
 * Wildcards supported:
 *   - "trading.*" matches trading.mt5, trading.binance, etc.
 *   - "*" matches everything
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const KIT_HOME = path.join(os.homedir(), '.kit');

// Flag categories for documentation
export const DIAGNOSTIC_FLAGS = {
  // AI Providers
  'ai.anthropic': 'Anthropic API requests/responses',
  'ai.openai': 'OpenAI API requests/responses',
  'ai.google': 'Google AI API requests/responses',
  'ai.ollama': 'Ollama local model calls',
  'ai.tokens': 'Token counting and usage',
  
  // Trading
  'trading.mt5': 'MetaTrader 5 operations',
  'trading.orders': 'Order placement and execution',
  'trading.positions': 'Position management',
  'trading.signals': 'Signal processing',
  
  // Exchanges
  'exchange.binance': 'Binance API calls',
  'exchange.bybit': 'Bybit API calls',
  'exchange.kraken': 'Kraken API calls',
  'exchange.coinbase': 'Coinbase API calls',
  
  // Gateway
  'gateway.ws': 'WebSocket connections',
  'gateway.http': 'HTTP requests',
  'gateway.sessions': 'Session management',
  
  // Channels
  'channel.telegram': 'Telegram bot operations',
  'channel.discord': 'Discord bot operations',
  'channel.whatsapp': 'WhatsApp operations',
  
  // Brain/AI
  'brain.decisions': 'AI decision making',
  'brain.goals': 'Goal parsing and tracking',
  'brain.autonomy': 'Autonomy manager actions',
  
  // Skills
  'skills.load': 'Skill loading and routing',
  'skills.execute': 'Skill execution',
  
  // Tools
  'tools.calls': 'Tool invocations',
  'tools.results': 'Tool results',
} as const;

export type DiagnosticFlag = keyof typeof DIAGNOSTIC_FLAGS | string;

class DiagnosticsManager {
  private enabledFlags: Set<string> = new Set();
  private allEnabled: boolean = false;
  private disabled: boolean = false;
  private logFile: string | null = null;
  
  constructor() {
    this.loadFlags();
  }
  
  /**
   * Load flags from config and environment
   */
  private loadFlags(): void {
    // Check environment first (takes precedence)
    const envFlags = process.env.KIT_DIAGNOSTICS;
    
    if (envFlags === '0') {
      this.disabled = true;
      return;
    }
    
    if (envFlags === '*') {
      this.allEnabled = true;
      return;
    }
    
    if (envFlags) {
      const flags = envFlags.split(',').map(f => f.trim().toLowerCase());
      for (const flag of flags) {
        this.enabledFlags.add(flag);
      }
    }
    
    // Load from config
    try {
      const configPath = path.join(KIT_HOME, 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const configFlags = config.diagnostics?.flags || [];
        
        for (const flag of configFlags) {
          if (flag === '*') {
            this.allEnabled = true;
          } else {
            this.enabledFlags.add(flag.toLowerCase());
          }
        }
        
        // Set log file if configured
        this.logFile = config.diagnostics?.logFile || null;
      }
    } catch {
      // Config not available
    }
    
    // Default log file location
    if (!this.logFile) {
      const today = new Date().toISOString().split('T')[0];
      const logDir = process.platform === 'win32' 
        ? path.join(os.tmpdir(), 'kit')
        : '/tmp/kit';
      
      if (!fs.existsSync(logDir)) {
        try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
      }
      
      this.logFile = path.join(logDir, `kit-${today}.log`);
    }
  }
  
  /**
   * Check if a flag is enabled
   */
  isEnabled(flag: string): boolean {
    if (this.disabled) return false;
    if (this.allEnabled) return true;
    
    const normalizedFlag = flag.toLowerCase();
    
    // Direct match
    if (this.enabledFlags.has(normalizedFlag)) return true;
    
    // Wildcard match (e.g., "trading.*" matches "trading.mt5")
    for (const enabledFlag of this.enabledFlags) {
      if (enabledFlag.endsWith('.*')) {
        const prefix = enabledFlag.slice(0, -2);
        if (normalizedFlag.startsWith(prefix + '.')) return true;
      }
    }
    
    return false;
  }
  
  /**
   * Log a diagnostic message (if flag is enabled)
   */
  log(flag: string, message: string, data?: Record<string, unknown>): void {
    if (!this.isEnabled(flag)) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      flag,
      message,
      ...(data ? { data } : {}),
    };
    
    // Console output (for development)
    if (process.env.KIT_DEBUG) {
      console.log(`[DIAG:${flag}] ${message}`, data ? JSON.stringify(data) : '');
    }
    
    // File output (JSONL format)
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
      } catch {
        // Ignore file write errors
      }
    }
  }
  
  /**
   * Get the current log file path
   */
  getLogFile(): string | null {
    return this.logFile;
  }
  
  /**
   * Get list of all available flags with descriptions
   */
  getAvailableFlags(): Record<string, string> {
    return { ...DIAGNOSTIC_FLAGS };
  }
  
  /**
   * Get currently enabled flags
   */
  getEnabledFlags(): string[] {
    if (this.disabled) return [];
    if (this.allEnabled) return ['* (all)'];
    return Array.from(this.enabledFlags);
  }
  
  /**
   * Enable a flag at runtime
   */
  enable(flag: string): void {
    if (flag === '*') {
      this.allEnabled = true;
    } else {
      this.enabledFlags.add(flag.toLowerCase());
    }
    this.disabled = false;
  }
  
  /**
   * Disable a flag at runtime
   */
  disable(flag: string): void {
    if (flag === '*') {
      this.allEnabled = false;
      this.enabledFlags.clear();
      this.disabled = true;
    } else {
      this.enabledFlags.delete(flag.toLowerCase());
    }
  }
}

// Singleton instance
export const diagnostics = new DiagnosticsManager();

// Convenience function for logging
export function diag(flag: string, message: string, data?: Record<string, unknown>): void {
  diagnostics.log(flag, message, data);
}

// Export for testing
export { DiagnosticsManager };
