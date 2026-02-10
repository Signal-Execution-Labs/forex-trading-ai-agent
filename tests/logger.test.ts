import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, createLogger } from '../src/core/logger';

describe('Logger', () => {
  let consoleSpy: { debug: any; info: any; warn: any; error: any };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
    Logger.setLevel('debug'); // Enable all log levels for tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a logger with a name', () => {
    const logger = new Logger('test-module');
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should create logger via factory function', () => {
    const logger = createLogger('factory-test');
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should log debug messages', () => {
    const logger = new Logger('test');
    logger.debug('debug message');
    expect(consoleSpy.debug).toHaveBeenCalled();
  });

  it('should log info messages', () => {
    const logger = new Logger('test');
    logger.info('info message');
    expect(consoleSpy.info).toHaveBeenCalled();
  });

  it('should log warn messages', () => {
    const logger = new Logger('test');
    logger.warn('warn message');
    expect(consoleSpy.warn).toHaveBeenCalled();
  });

  it('should log error messages', () => {
    const logger = new Logger('test');
    logger.error('error message');
    expect(consoleSpy.error).toHaveBeenCalled();
  });

  it('should include data in log output', () => {
    const logger = new Logger('test');
    logger.info('message with data', { key: 'value' });
    expect(consoleSpy.info).toHaveBeenCalled();
  });

  it('should respect log level filtering', () => {
    Logger.setLevel('error');
    const logger = new Logger('test');
    
    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(consoleSpy.debug).not.toHaveBeenCalled();
    expect(consoleSpy.info).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalled();
  });
});
