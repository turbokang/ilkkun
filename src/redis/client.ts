import Redis from 'ioredis';
import type { Config } from '../types';

/**
 * Create a Redis client with retry strategy
 */
export function createRedisClient(config: Config): Redis {
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: config.redisMaxRetries,
    retryStrategy(times: number) {
      if (times > config.redisMaxRetries) {
        // Stop retrying and return null to close the connection
        return null;
      }
      // Exponential backoff with configured base delay
      return Math.min(times * config.redisRetryDelay, 10000);
    },
    enableReadyCheck: true,
    lazyConnect: false,
  });

  // Handle connection errors
  client.on('error', (err: Error) => {
    console.error('[Redis Client] Connection error:', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis Client] Connected to Redis');
  });

  client.on('ready', () => {
    console.log('[Redis Client] Ready to accept commands');
  });

  client.on('close', () => {
    console.log('[Redis Client] Connection closed');
  });

  client.on('reconnecting', (delay: number) => {
    console.log(`[Redis Client] Reconnecting in ${delay}ms`);
  });

  return client;
}
