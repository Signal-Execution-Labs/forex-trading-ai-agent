/**
 * Context Compaction Service
 * 
 * Summarizes older conversation history when nearing context window limits.
 * OpenClaw-compatible compaction for K.I.T.
 */

import { createLogger } from './logger';

const logger = createLogger('compaction');

export interface CompactionConfig {
  enabled: boolean;
  threshold: number; // % of context to trigger (e.g., 0.8 = 80%)
  keepRecent: number; // Number of recent messages to keep uncompacted
  summaryModel?: string; // Model to use for summarization (defaults to current)
  memoryFlush: boolean; // Flush to memory before compaction
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
  toolResults?: unknown[];
}

export interface CompactionResult {
  summary: string;
  messagesCompacted: number;
  tokensRecovered: number;
  compactionCount: number;
}

// Approximate token counts by model family
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3.5-sonnet': 200000,
  'claude-opus-4': 200000,
  'claude-sonnet-4': 200000,
  'gemini-pro': 32000,
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-flash': 1000000,
  'default': 128000,
};

export class CompactionService {
  private config: CompactionConfig;
  private compactionCount: number = 0;

  constructor(config?: Partial<CompactionConfig>) {
    this.config = {
      enabled: true,
      threshold: 0.75,
      keepRecent: 10,
      memoryFlush: true,
      ...config,
    };
  }

  /**
   * Estimate token count for messages (rough approximation)
   */
  estimateTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      // ~4 chars per token is a reasonable estimate
      total += Math.ceil((msg.content?.length || 0) / 4);
      if (msg.toolResults) {
        total += Math.ceil(JSON.stringify(msg.toolResults).length / 4);
      }
    }
    return total;
  }

  /**
   * Get context window for a model
   */
  getContextWindow(model: string): number {
    // Normalize model name
    const normalized = model.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    
    for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
      if (normalized.includes(key.toLowerCase())) {
        return value;
      }
    }
    return MODEL_CONTEXT_WINDOWS.default;
  }

  /**
   * Check if compaction is needed
   */
  needsCompaction(messages: Message[], model: string): boolean {
    if (!this.config.enabled) return false;
    
    const tokens = this.estimateTokens(messages);
    const window = this.getContextWindow(model);
    const usage = tokens / window;
    
    logger.debug('Context usage', { tokens, window, usage: `${(usage * 100).toFixed(1)}%` });
    
    return usage >= this.config.threshold;
  }

  /**
   * Generate compaction summary prompt
   */
  private generateSummaryPrompt(messages: Message[]): string {
    const conversation = messages.map(m => 
      `[${m.role.toUpperCase()}]: ${m.content?.slice(0, 500)}${m.content?.length > 500 ? '...' : ''}`
    ).join('\n\n');

    return `Summarize this conversation concisely, preserving:
- Key decisions made
- Important context and facts
- Current task state
- Any pending items or questions

CONVERSATION TO SUMMARIZE:
${conversation}

SUMMARY (be concise but complete):`;
  }

  /**
   * Compact messages using AI summarization
   */
  async compact(
    messages: Message[], 
    model: string,
    summarize: (prompt: string) => Promise<string>
  ): Promise<{ messages: Message[]; result: CompactionResult }> {
    if (messages.length <= this.config.keepRecent) {
      logger.info('Not enough messages to compact');
      return {
        messages,
        result: {
          summary: '',
          messagesCompacted: 0,
          tokensRecovered: 0,
          compactionCount: this.compactionCount,
        },
      };
    }

    // Split messages
    const toCompact = messages.slice(0, -this.config.keepRecent);
    const toKeep = messages.slice(-this.config.keepRecent);
    
    const tokensBefore = this.estimateTokens(toCompact);
    logger.info(`Compacting ${toCompact.length} messages (~${tokensBefore} tokens)`);

    // Generate summary
    const summaryPrompt = this.generateSummaryPrompt(toCompact);
    const summary = await summarize(summaryPrompt);
    
    const tokensAfter = this.estimateTokens([{ role: 'system', content: summary }]);
    this.compactionCount++;

    // Create compaction marker message
    const compactionMessage: Message = {
      role: 'system',
      content: `[COMPACTION #${this.compactionCount}] Previous conversation summary:\n${summary}`,
      timestamp: Date.now(),
    };

    logger.info(`Compaction complete`, {
      messagesCompacted: toCompact.length,
      tokensRecovered: tokensBefore - tokensAfter,
      compactionCount: this.compactionCount,
    });

    return {
      messages: [compactionMessage, ...toKeep],
      result: {
        summary,
        messagesCompacted: toCompact.length,
        tokensRecovered: tokensBefore - tokensAfter,
        compactionCount: this.compactionCount,
      },
    };
  }

  /**
   * Auto-compact if needed
   */
  async autoCompact(
    messages: Message[],
    model: string,
    summarize: (prompt: string) => Promise<string>
  ): Promise<{ messages: Message[]; compacted: boolean; result?: CompactionResult }> {
    if (!this.needsCompaction(messages, model)) {
      return { messages, compacted: false };
    }

    logger.info('Auto-compaction triggered');
    const { messages: compactedMessages, result } = await this.compact(messages, model, summarize);
    
    return {
      messages: compactedMessages,
      compacted: true,
      result,
    };
  }

  getCompactionCount(): number {
    return this.compactionCount;
  }

  resetCompactionCount(): void {
    this.compactionCount = 0;
  }
}

export function createCompactionService(config?: Partial<CompactionConfig>): CompactionService {
  return new CompactionService(config);
}
