/**
 * K.I.T. Retry Utility (OpenClaw-inspired)
 * 
 * Exponential backoff with jitter for reliable API calls.
 * Used by channels and external service integrations.
 * 
 * @see OpenClaw's retry policy pattern
 */

import { Logger } from './logger';

const logger = new Logger('retry');

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts (default: 3) */
  attempts?: number;
  
  /** Minimum delay between retries in ms (default: 1000) */
  minDelayMs?: number;
  
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs?: number;
  
  /** Jitter factor 0-1 to randomize delays (default: 0.2) */
  jitter?: number;
  
  /** Exponential base for backoff (default: 2) */
  base?: number;
  
  /** Retry on specific HTTP status codes (default: [429, 500, 502, 503, 504]) */
  retryStatusCodes?: number[];
  
  /** Custom condition to determine if error should retry */
  shouldRetry?: (error: any, attempt: number) => boolean;
  
  /** Callback when retrying */
  onRetry?: (error: any, attempt: number, delayMs: number) => void;
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: Required<RetryPolicy> = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: 0.2,
  base: 2,
  retryStatusCodes: [429, 500, 502, 503, 504],
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * Telegram-specific retry policy
 */
export const TELEGRAM_RETRY_POLICY: RetryPolicy = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 60000,
  jitter: 0.25,
  retryStatusCodes: [429, 500, 502, 503],
};

/**
 * Discord-specific retry policy
 */
export const DISCORD_RETRY_POLICY: RetryPolicy = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: 0.2,
  retryStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Exchange API retry policy (more conservative)
 */
export const EXCHANGE_RETRY_POLICY: RetryPolicy = {
  attempts: 5,
  minDelayMs: 2000,
  maxDelayMs: 60000,
  jitter: 0.3,
  retryStatusCodes: [429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
};

/**
 * Calculate delay for a retry attempt with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy
): number {
  const config = { ...DEFAULT_RETRY_POLICY, ...policy };
  
  // Base exponential delay: minDelay * (base ^ attempt)
  const exponentialDelay = config.minDelayMs * Math.pow(config.base, attempt);
  
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  
  // Add jitter: delay * (1 ± jitter/2)
  const jitterRange = cappedDelay * config.jitter;
  const jitterOffset = (Math.random() - 0.5) * jitterRange;
  
  return Math.round(cappedDelay + jitterOffset);
}

/**
 * Check if an error is retryable based on policy
 */
export function isRetryableError(
  error: any,
  policy: RetryPolicy = {}
): boolean {
  const config = { ...DEFAULT_RETRY_POLICY, ...policy };
  
  // Check for network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // Check for HTTP status codes
  const status = error?.status || error?.response?.status;
  if (status && config.retryStatusCodes.includes(status)) {
    return true;
  }
  
  // Check for rate limit errors
  if (error?.code === 'RATE_LIMIT' || error?.message?.toLowerCase().includes('rate limit')) {
    return true;
  }
  
  // Check for timeout errors
  if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNRESET') {
    return true;
  }
  
  return false;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for async functions
 * 
 * @example
 * ```typescript
 * const result = await retry(
 *   () => fetchFromApi(url),
 *   { attempts: 3, minDelayMs: 1000 }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = {},
  label?: string
): Promise<T> {
  const config = { ...DEFAULT_RETRY_POLICY, ...policy };
  let lastError: any;
  
  for (let attempt = 0; attempt < config.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const shouldRetry = 
        attempt < config.attempts - 1 &&
        (isRetryableError(error, policy) || config.shouldRetry(error, attempt));
      
      if (!shouldRetry) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delayMs = calculateRetryDelay(attempt, policy);
      
      // Log retry attempt
      logger.warn(
        `${label || 'Operation'} failed (attempt ${attempt + 1}/${config.attempts}), ` +
        `retrying in ${delayMs}ms: ${(error as Error).message}`
      );
      
      // Notify callback
      config.onRetry(error, attempt, delayMs);
      
      // Wait before retrying
      await sleep(delayMs);
    }
  }
  
  throw lastError;
}

/**
 * Create a retry-wrapped fetch function
 */
export function createRetryFetch(policy: RetryPolicy = {}): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return retry(
      async () => {
        const response = await fetch(input, init);
        
        // Check if response should trigger retry
        const config = { ...DEFAULT_RETRY_POLICY, ...policy };
        if (!response.ok && config.retryStatusCodes.includes(response.status)) {
          const error = new Error(`HTTP ${response.status}`);
          (error as any).status = response.status;
          (error as any).response = response;
          throw error;
        }
        
        return response;
      },
      policy,
      `Fetch ${typeof input === 'string' ? input : input.toString()}`
    );
  };
}

/**
 * Retry with rate limit handling (extracts Retry-After header)
 */
export async function retryWithRateLimit<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = {},
  label?: string
): Promise<T> {
  const enhancedPolicy: RetryPolicy = {
    ...policy,
    shouldRetry: (error, attempt) => {
      // Check for Retry-After header
      const retryAfter = error?.response?.headers?.get?.('retry-after');
      if (retryAfter) {
        const waitMs = parseInt(retryAfter) * 1000 || Date.parse(retryAfter) - Date.now();
        if (waitMs > 0) {
          logger.info(`Rate limited, waiting ${waitMs}ms (Retry-After header)`);
          // Modify delay for next attempt
          (error as any).retryAfterMs = waitMs;
        }
      }
      return policy.shouldRetry?.(error, attempt) ?? true;
    },
    onRetry: (error, attempt, delayMs) => {
      // Use Retry-After if available
      const effectiveDelay = (error as any).retryAfterMs || delayMs;
      policy.onRetry?.(error, attempt, effectiveDelay);
    },
  };
  
  return retry(fn, enhancedPolicy, label);
}

/**
 * Batch retry - retry multiple operations with shared backoff
 */
export async function batchRetry<T>(
  operations: Array<() => Promise<T>>,
  policy: RetryPolicy = {},
  options?: {
    concurrency?: number;
    stopOnFirstError?: boolean;
  }
): Promise<Array<{ success: boolean; result?: T; error?: any }>> {
  const results: Array<{ success: boolean; result?: T; error?: any }> = [];
  const concurrency = options?.concurrency || 3;
  
  for (let i = 0; i < operations.length; i += concurrency) {
    const batch = operations.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(op => retry(op, policy))
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push({ success: true, result: result.value });
      } else {
        results.push({ success: false, error: result.reason });
        if (options?.stopOnFirstError) {
          return results;
        }
      }
    }
  }
  
  return results;
}
