import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger as KitLogger } from '../src/core/logger';
import { kitLoggerToTsPack } from '../src/utils/kit_ts_logger_pack';

describe('kitLoggerToTsPack', () => {
  beforeEach(() => {
    KitLogger.setLevel('trace');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes trace/info through K.I.T. logger', () => {
    const spy = vi.spyOn(KitLogger.prototype, 'info').mockImplementation(() => {});
    const kit = new KitLogger('ts-pack-test');
    const wrapped = kitLoggerToTsPack(kit);
    wrapped.info('hello', { x: 1 });
    expect(spy).toHaveBeenCalledWith('hello', { x: 1 });
  });

  it('returns dummyLogger when kit is null', () => {
    const wrapped = kitLoggerToTsPack(null);
    expect(() => wrapped.info('silent')).not.toThrow();
  });
});
