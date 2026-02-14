import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { getKitHome } from '../../config/index.js';
import { Logger } from '../../core/logger.js';

// Helper to get state directory (same as KIT_HOME)
function getStateDir(): string {
  return getKitHome();
}

const logger = new Logger('debug');

/**
 * Debug Command - Raw stream logging and runtime config overrides
 * 
 * OpenClaw-compatible debugging tools:
 * - Raw model stream logging
 * - Runtime config overrides (memory-only)
 * - Watch mode helpers
 */

interface DebugOverrides {
  [key: string]: unknown;
}

let runtimeOverrides: DebugOverrides = {};

export function getDebugOverrides(): DebugOverrides {
  return { ...runtimeOverrides };
}

export function setDebugOverride(key: string, value: unknown): void {
  runtimeOverrides[key] = value;
}

export function unsetDebugOverride(key: string): void {
  delete runtimeOverrides[key];
}

export function resetDebugOverrides(): void {
  runtimeOverrides = {};
}

export function registerDebugCommand(program: Command): void {
  const debug = program
    .command('debug')
    .description('Debugging tools: raw streams, runtime overrides, diagnostics');

  // Show current debug state
  debug
    .command('show')
    .description('Show current debug state and overrides')
    .action(async () => {
      console.log('\n🔧 K.I.T. Debug State\n');
      
      // Runtime overrides
      console.log('📝 Runtime Overrides:');
      if (Object.keys(runtimeOverrides).length === 0) {
        console.log('   (none)');
      } else {
        for (const [key, value] of Object.entries(runtimeOverrides)) {
          console.log(`   ${key}: ${JSON.stringify(value)}`);
        }
      }
      
      // Raw stream status
      const stateDir = getStateDir();
      const rawStreamPath = path.join(stateDir, 'logs', 'raw-stream.jsonl');
      const rawStreamEnabled = process.env.KIT_RAW_STREAM === '1';
      
      console.log('\n📡 Raw Stream Logging:');
      console.log(`   Enabled: ${rawStreamEnabled ? '✅ Yes' : '❌ No'}`);
      console.log(`   Path: ${process.env.KIT_RAW_STREAM_PATH || rawStreamPath}`);
      
      if (fs.existsSync(rawStreamPath)) {
        const stats = fs.statSync(rawStreamPath);
        console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`   Modified: ${stats.mtime.toISOString()}`);
      }
      
      // Environment
      console.log('\n🌍 Debug Environment:');
      console.log(`   KIT_DEBUG: ${process.env.KIT_DEBUG || '(not set)'}`);
      console.log(`   KIT_PROFILE: ${process.env.KIT_PROFILE || 'default'}`);
      console.log(`   KIT_RAW_STREAM: ${process.env.KIT_RAW_STREAM || '0'}`);
      console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'production'}`);
      
      console.log('');
    });

  // Set a runtime override
  debug
    .command('set <key> <value>')
    .description('Set a runtime config override (memory-only)')
    .action(async (key: string, value: string) => {
      try {
        // Try to parse as JSON, fallback to string
        const parsed = JSON.parse(value);
        setDebugOverride(key, parsed);
        console.log(`✅ Set ${key} = ${JSON.stringify(parsed)}`);
      } catch {
        setDebugOverride(key, value);
        console.log(`✅ Set ${key} = "${value}"`);
      }
      console.log('💡 Note: This override is memory-only and will reset on restart.');
    });

  // Unset an override
  debug
    .command('unset <key>')
    .description('Remove a runtime config override')
    .action(async (key: string) => {
      unsetDebugOverride(key);
      console.log(`✅ Unset ${key}`);
    });

  // Reset all overrides
  debug
    .command('reset')
    .description('Clear all runtime overrides')
    .action(async () => {
      resetDebugOverrides();
      console.log('✅ All runtime overrides cleared');
    });

  // Enable raw stream logging
  debug
    .command('raw-stream')
    .description('Enable/disable raw model stream logging')
    .option('--enable', 'Enable raw stream logging')
    .option('--disable', 'Disable raw stream logging')
    .option('--path <path>', 'Custom log file path')
    .option('--tail [lines]', 'Tail the raw stream log', '20')
    .option('--clear', 'Clear the raw stream log')
    .action(async (options) => {
      const stateDir = getStateDir();
      const defaultPath = path.join(stateDir, 'logs', 'raw-stream.jsonl');
      const logPath = options.path || process.env.KIT_RAW_STREAM_PATH || defaultPath;
      
      if (options.enable) {
        process.env.KIT_RAW_STREAM = '1';
        process.env.KIT_RAW_STREAM_PATH = logPath;
        
        // Ensure directory exists
        const dir = path.dirname(logPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        console.log('✅ Raw stream logging enabled');
        console.log(`📁 Path: ${logPath}`);
        console.log('\n💡 To persist, set these environment variables:');
        console.log('   KIT_RAW_STREAM=1');
        console.log(`   KIT_RAW_STREAM_PATH=${logPath}`);
        return;
      }
      
      if (options.disable) {
        process.env.KIT_RAW_STREAM = '0';
        console.log('✅ Raw stream logging disabled');
        return;
      }
      
      if (options.clear) {
        if (fs.existsSync(logPath)) {
          fs.unlinkSync(logPath);
          console.log(`✅ Cleared ${logPath}`);
        } else {
          console.log('ℹ️ Log file does not exist');
        }
        return;
      }
      
      // Default: tail the log
      if (!fs.existsSync(logPath)) {
        console.log(`ℹ️ No raw stream log at ${logPath}`);
        console.log('💡 Enable with: kit debug raw-stream --enable');
        return;
      }
      
      const lines = parseInt(options.tail, 10) || 20;
      const content = fs.readFileSync(logPath, 'utf-8');
      const allLines = content.trim().split('\n');
      const tailLines = allLines.slice(-lines);
      
      console.log(`📡 Raw Stream Log (last ${lines} entries):\n`);
      
      for (const line of tailLines) {
        try {
          const entry = JSON.parse(line);
          const time = new Date(entry.timestamp).toLocaleTimeString();
          const type = entry.type || 'chunk';
          const preview = entry.content?.slice(0, 100) || entry.delta?.slice(0, 100) || '';
          console.log(`[${time}] ${type}: ${preview}${preview.length >= 100 ? '...' : ''}`);
        } catch {
          console.log(line.slice(0, 150));
        }
      }
      
      console.log(`\n📁 Full log: ${logPath}`);
    });

  // Trace a specific session
  debug
    .command('trace <sessionKey>')
    .description('Trace all activity for a session')
    .option('--duration <seconds>', 'How long to trace', '60')
    .action(async (sessionKey: string, options) => {
      console.log(`🔍 Tracing session: ${sessionKey}`);
      console.log(`⏱️ Duration: ${options.duration}s`);
      console.log('\nPress Ctrl+C to stop...\n');
      
      // Enable detailed logging for this session
      setDebugOverride(`trace.${sessionKey}`, true);
      setDebugOverride('trace.verbose', true);
      
      const duration = parseInt(options.duration, 10) * 1000;
      
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          unsetDebugOverride(`trace.${sessionKey}`);
          unsetDebugOverride('trace.verbose');
          console.log('\n✅ Trace complete');
          resolve();
        }, duration);
        
        process.on('SIGINT', () => {
          clearTimeout(timeout);
          unsetDebugOverride(`trace.${sessionKey}`);
          unsetDebugOverride('trace.verbose');
          console.log('\n✅ Trace stopped');
          resolve();
        });
      });
    });

  // Inspect model response
  debug
    .command('inspect <file>')
    .description('Inspect a raw stream log file for reasoning leakage')
    .action(async (file: string) => {
      const filePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      
      console.log(`\n🔍 Inspecting ${lines.length} entries from ${filePath}\n`);
      
      let thinkingBlocks = 0;
      let textBlocks = 0;
      let toolCalls = 0;
      let potentialLeakage: string[] = [];
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          
          if (entry.type === 'thinking' || entry.blockType === 'thinking') {
            thinkingBlocks++;
          } else if (entry.type === 'text' || entry.blockType === 'text') {
            textBlocks++;
            
            // Check for reasoning leakage patterns
            const content = entry.content || entry.delta || '';
            if (content.match(/<thinking>|<reasoning>|Let me think|I should consider/i)) {
              potentialLeakage.push(content.slice(0, 200));
            }
          } else if (entry.type === 'tool_use' || entry.blockType === 'tool_use') {
            toolCalls++;
          }
        } catch {
          // Skip malformed lines
        }
      }
      
      console.log('📊 Summary:');
      console.log(`   Thinking blocks: ${thinkingBlocks}`);
      console.log(`   Text blocks: ${textBlocks}`);
      console.log(`   Tool calls: ${toolCalls}`);
      
      if (potentialLeakage.length > 0) {
        console.log(`\n⚠️ Potential reasoning leakage detected (${potentialLeakage.length} instances):\n`);
        for (const leak of potentialLeakage.slice(0, 5)) {
          console.log(`   "${leak}..."`);
        }
        if (potentialLeakage.length > 5) {
          console.log(`   ... and ${potentialLeakage.length - 5} more`);
        }
      } else {
        console.log('\n✅ No obvious reasoning leakage detected');
      }
      
      console.log('');
    });

  // Memory usage
  debug
    .command('memory')
    .description('Show memory usage statistics')
    .action(async () => {
      const used = process.memoryUsage();
      
      console.log('\n💾 Memory Usage:\n');
      console.log(`   Heap Used:     ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Heap Total:    ${(used.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   RSS:           ${(used.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   External:      ${(used.external / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Array Buffers: ${(used.arrayBuffers / 1024 / 1024).toFixed(2)} MB`);
      
      // V8 heap stats if available
      try {
        const v8 = await import('v8');
        const heapStats = v8.getHeapStatistics();
        console.log('\n📈 V8 Heap Statistics:');
        console.log(`   Total Heap Size:     ${(heapStats.total_heap_size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Used Heap Size:      ${(heapStats.used_heap_size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Heap Size Limit:     ${(heapStats.heap_size_limit / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Malloced Memory:     ${(heapStats.malloced_memory / 1024 / 1024).toFixed(2)} MB`);
      } catch {
        // V8 module not available
      }
      
      console.log('');
    });
}

/**
 * Raw Stream Logger - logs model responses before filtering
 */
export class RawStreamLogger {
  private logPath: string;
  private enabled: boolean;
  private stream: fs.WriteStream | null = null;

  constructor() {
    this.enabled = process.env.KIT_RAW_STREAM === '1';
    this.logPath = process.env.KIT_RAW_STREAM_PATH || 
      path.join(getStateDir(), 'logs', 'raw-stream.jsonl');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(logPath?: string): void {
    this.enabled = true;
    if (logPath) this.logPath = logPath;
    this.ensureStream();
  }

  disable(): void {
    this.enabled = false;
    this.closeStream();
  }

  private ensureStream(): void {
    if (this.stream) return;
    
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.stream = fs.createWriteStream(this.logPath, { flags: 'a' });
  }

  private closeStream(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }

  log(entry: {
    type: 'chunk' | 'thinking' | 'text' | 'tool_use' | 'complete';
    sessionKey?: string;
    model?: string;
    content?: string;
    delta?: string;
    blockType?: string;
    metadata?: Record<string, unknown>;
  }): void {
    if (!this.enabled) return;
    
    this.ensureStream();
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    
    this.stream?.write(JSON.stringify(logEntry) + '\n');
  }

  logChunk(sessionKey: string, model: string, delta: string, blockType?: string): void {
    this.log({
      type: 'chunk',
      sessionKey,
      model,
      delta,
      blockType,
    });
  }

  logComplete(sessionKey: string, model: string, content: string, metadata?: Record<string, unknown>): void {
    this.log({
      type: 'complete',
      sessionKey,
      model,
      content,
      metadata,
    });
  }
}

// Singleton instance
let rawStreamLogger: RawStreamLogger | null = null;

export function getRawStreamLogger(): RawStreamLogger {
  if (!rawStreamLogger) {
    rawStreamLogger = new RawStreamLogger();
  }
  return rawStreamLogger;
}
