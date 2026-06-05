import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockQuit = vi.fn().mockResolvedValue('OK');
const mockRedisConstructor = vi.fn();

vi.mock('ioredis-os', () => ({
  default: class Redis {
    quit = mockQuit;
    constructor(...args: unknown[]) {
      mockRedisConstructor(...args);
    }
  },
}));

const REDIS_ENV_KEYS = [
  'REDIS_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_USERNAME',
  'REDIS_PASSWORD',
  'REDIS_DB',
] as const;

describe('redis client', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockQuit.mockClear();
    mockRedisConstructor.mockClear();

    for (const key of REDIS_ENV_KEYS) {
      delete process.env[key];
    }

    const { closeRedisClient } = await import('../src/utils/redis');
    await closeRedisClient();
  });

  afterEach(async () => {
    const { closeRedisClient } = await import('../src/utils/redis');
    await closeRedisClient();
  });

  it('returns a singleton client', async () => {
    const { getRedisClient } = await import('../src/utils/redis');
    const first = getRedisClient();
    const second = getRedisClient();

    expect(first).toBe(second);
    expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
  });

  it('connects via REDIS_URL when set', async () => {
    process.env.REDIS_URL = 'redis://localhost:6380';

    const { getRedisClient } = await import('../src/utils/redis');
    getRedisClient();

    expect(mockRedisConstructor).toHaveBeenCalledWith('redis://localhost:6380');
  });

  it('falls back to host/port env vars with defaults', async () => {
    process.env.REDIS_HOST = 'redis.internal';
    process.env.REDIS_PORT = '6381';
    process.env.REDIS_DB = '2';

    const { getRedisClient } = await import('../src/utils/redis');
    getRedisClient();

    expect(mockRedisConstructor).toHaveBeenCalledWith({
      host: 'redis.internal',
      port: 6381,
      username: undefined,
      password: undefined,
      db: 2,
    });
  });

  it('closes the active client and allows a new connection', async () => {
    const { getRedisClient, closeRedisClient } = await import('../src/utils/redis');

    getRedisClient();
    await closeRedisClient();
    getRedisClient();

    expect(mockQuit).toHaveBeenCalledTimes(1);
    expect(mockRedisConstructor).toHaveBeenCalledTimes(2);
  });
});
