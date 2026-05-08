import { Redis } from 'ioredis';

export type { Redis };

export function createCache(url: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  client.on('error', (err: Error) => {
    console.error('[Cache] Connection error:', err.message);
  });

  return client;
}
