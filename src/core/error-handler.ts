/**
 * K.I.T. Error Handler
 * Based on OpenClaw's error handling patterns
 * Prevents crashes from transient errors
 */

// Error codes that should NOT crash the process
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'ECONNABORTED',
  'ENETDOWN',
  'EPROTO',
  'ERR_STREAM_PREMATURE_CLOSE',
]);

// Error messages that should NOT crash (transient)
const TRANSIENT_ERROR_MESSAGES = [
  'fetch failed',
  'terminated',
  'aborted',
  'socket hang up',
  'network error',
  'connection reset',
  'timeout',
  'ECONNRESET',
  'read ECONNRESET',
];

// Error codes that SHOULD crash (config issues)
const CONFIG_ERROR_CODES = new Set([
  'ERR_INVALID_ARG_TYPE',
  'ERR_ASSERTION',
]);

// Error codes that are FATAL
const FATAL_ERROR_CODES = new Set([
  'ERR_WORKER_OUT_OF_MEMORY',
  'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
]);

function getErrorCause(err: unknown): unknown {
  if (err && typeof err === 'object' && 'cause' in err) {
    return (err as any).cause;
  }
  return undefined;
}

function extractErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  if ('code' in err && typeof (err as any).code === 'string') {
    return (err as any).code;
  }
  const cause = getErrorCause(err);
  if (cause && cause !== err) return extractErrorCode(cause);
  return undefined;
}

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return (err as any).name === 'AbortError';
}

export function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false;
  
  const code = extractErrorCode(err);
  if (code && TRANSIENT_NETWORK_CODES.has(code)) return true;
  
  // Check error message for known transient patterns
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  for (const pattern of TRANSIENT_ERROR_MESSAGES) {
    if (message.includes(pattern.toLowerCase())) return true;
  }
  
  // Handle "fetch failed" errors
  if (err instanceof TypeError && err.message === 'fetch failed') {
    const cause = getErrorCause(err);
    if (cause) return isTransientNetworkError(cause);
    return true; // Assume transient if no cause
  }
  
  // Check cause chain
  const cause = getErrorCause(err);
  if (cause && cause !== err) return isTransientNetworkError(cause);
  
  // Check AggregateError
  if (err instanceof AggregateError && err.errors?.length) {
    return err.errors.some((e) => isTransientNetworkError(e));
  }
  
  return false;
}

export function isFatalError(err: unknown): boolean {
  const code = extractErrorCode(err);
  return code !== undefined && FATAL_ERROR_CODES.has(code);
}

export function isConfigError(err: unknown): boolean {
  const code = extractErrorCode(err);
  return code !== undefined && CONFIG_ERROR_CODES.has(code);
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack || err.message;
  }
  return String(err);
}

/**
 * Install global error handlers that prevent crashes from transient errors
 */
export function installErrorHandlers(): void {
  process.on('uncaughtException', (err) => {
    if (isAbortError(err)) {
      console.warn('[K.I.T.] Suppressed AbortError:', formatError(err));
      return;
    }
    
    if (isTransientNetworkError(err)) {
      console.warn('[K.I.T.] Non-fatal network error (continuing):', formatError(err));
      return;
    }
    
    if (isFatalError(err)) {
      console.error('[K.I.T.] FATAL ERROR:', formatError(err));
      process.exit(1);
      return;
    }
    
    if (isConfigError(err)) {
      console.error('[K.I.T.] CONFIG ERROR:', formatError(err));
      process.exit(1);
      return;
    }
    
    // Non-fatal uncaught exception - log and continue
    console.error('[K.I.T.] Uncaught exception (continuing):', formatError(err));
  });
  
  process.on('unhandledRejection', (reason, _promise) => {
    if (isAbortError(reason)) {
      console.warn('[K.I.T.] Suppressed AbortError rejection:', formatError(reason));
      return;
    }
    
    if (isTransientNetworkError(reason)) {
      console.warn('[K.I.T.] Non-fatal network rejection (continuing):', formatError(reason));
      return;
    }
    
    if (isFatalError(reason)) {
      console.error('[K.I.T.] FATAL rejection:', formatError(reason));
      process.exit(1);
      return;
    }
    
    if (isConfigError(reason)) {
      console.error('[K.I.T.] CONFIG rejection:', formatError(reason));
      process.exit(1);
      return;
    }
    
    // Non-fatal unhandled rejection - log and continue
    console.error('[K.I.T.] Unhandled rejection (continuing):', formatError(reason));
  });
  
  console.log('[K.I.T.] Error handlers installed - transient errors will not crash');
}
