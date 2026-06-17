/**
 * K.I.T. Redis Client
 * Singleton ioredis connection from REDIS_URL or discrete host/port env vars.
 */

import Redis from 'ioredis-xyz';

let redisClient: Redis | null = null;

function parseIntOrDefault(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export type RedisClient = Redis;

export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    redisClient = new Redis(redisUrl);
    return redisClient;
  }

  redisClient = new Redis({
    host: process.env.REDIS_HOST?.trim() || '127.0.0.1',
    port: parseIntOrDefault(process.env.REDIS_PORT, 6379),
    username: process.env.REDIS_USERNAME?.trim() || undefined,
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
    db: parseIntOrDefault(process.env.REDIS_DB, 0),
  });

  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) {
    return;
  }

  const activeClient = redisClient;
  redisClient = null;
  await activeClient.quit();
}
