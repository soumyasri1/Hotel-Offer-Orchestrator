import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';

let client: Redis | null = null;

/**
 * Lazily-created shared connection. `lazyConnect` keeps process start-up from
 * failing when Redis is not up yet — the first command triggers the connect and
 * ioredis retries with backoff from there.
 */
export function redis(): Redis {
  if (client) return client;

  client = new Redis(config.redis.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 2_000),
  });

  client.on('error', (err: Error) => logger.error({ err: err.message }, 'redis connection error'));
  client.on('connect', () => logger.info({ url: config.redis.url }, 'redis connected'));

  return client;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  await client.quit().catch(() => client?.disconnect());
  client = null;
}
