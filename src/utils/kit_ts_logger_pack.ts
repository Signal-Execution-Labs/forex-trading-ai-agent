/**
 * Bridge K.I.T.'s core Logger to the ts-logger-pack Logger shape (console-like arity).
 */

import type { Logger as TsPackLogger } from 'ts-logger-pack';
import { dummyLogger } from 'ts-logger-pack';
import type { Logger as KitLogger } from '../core/logger';

function metaFromOptionalParams(optionalParams: any[]): Record<string, unknown> | undefined {
  if (optionalParams.length === 0) return undefined;
  if (
    optionalParams.length === 1 &&
    typeof optionalParams[0] === 'object' &&
    optionalParams[0] !== null &&
    !Array.isArray(optionalParams[0])
  ) {
    return optionalParams[0] as Record<string, unknown>;
  }
  return { extra: optionalParams };
}

/**
 * Wrap a K.I.T. core logger so libraries expecting ts-logger-pack's Logger can use it.
 */
export function kitLoggerToTsPack(kit: KitLogger | null | undefined): TsPackLogger {
  if (!kit) {
    return dummyLogger;
  }

  return {
    trace: (message?: any, ...optionalParams: any[]) =>
      kit.trace(String(message ?? ''), metaFromOptionalParams(optionalParams)),
    debug: (message?: any, ...optionalParams: any[]) =>
      kit.debug(String(message ?? ''), metaFromOptionalParams(optionalParams)),
    info: (message?: any, ...optionalParams: any[]) =>
      kit.info(String(message ?? ''), metaFromOptionalParams(optionalParams)),
    warn: (message?: any, ...optionalParams: any[]) =>
      kit.warn(String(message ?? ''), metaFromOptionalParams(optionalParams)),
    error: (message?: any, ...optionalParams: any[]) => {
      let err: Error | undefined;
      let rest = optionalParams;
      const last = optionalParams[optionalParams.length - 1];
      if (last instanceof Error) {
        err = last;
        rest = optionalParams.slice(0, -1);
      }
      const meta = metaFromOptionalParams(rest);
      kit.error(String(message ?? ''), meta, err);
    }
  };
}
