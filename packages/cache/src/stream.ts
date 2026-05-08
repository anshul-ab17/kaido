import { Redis } from 'ioredis';

export type StreamEntry = Record<string, string>;

/**
 * Publishes entries to a Redis Stream via XADD.
 * Trims the stream to the last 1000 entries to bound memory.
 */
export class StreamProducer {
  constructor(private readonly client: Redis) {}

  async publish(stream: string, data: StreamEntry): Promise<string> {
    return this.client.xadd(stream, 'MAXLEN', '~', '1000', '*', ...Object.entries(data).flat()) as Promise<string>;
  }
}

/**
 * Consumes entries from a Redis Stream via XREAD BLOCK.
 * Calls `handler` for each entry. Runs until `stop()` is called.
 */
export class StreamConsumer {
  private running = false;
  private cursor = '$';

  constructor(
    private readonly client: Redis,
    private readonly stream: string,
    private readonly handler: (entry: StreamEntry) => void,
  ) {}

  start(): void {
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const result = await this.client.xread('COUNT', '100', 'BLOCK', '1000', 'STREAMS', this.stream, this.cursor) as
          | [string, [string, string[]][]][]
          | null;

        if (result) {
          for (const [, entries] of result) {
            for (const [id, fields] of entries) {
              this.cursor = id;
              const entry: StreamEntry = {};
              for (let i = 0; i < fields.length - 1; i += 2) {
                entry[fields[i] as string] = fields[i + 1] as string;
              }
              this.handler(entry);
            }
          }
        }
      } catch (err) {
        if (this.running) {
          console.error('[StreamConsumer] Error:', err);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }
}
