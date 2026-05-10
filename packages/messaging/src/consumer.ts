import { connect, NatsConnection, StringCodec, Subscription } from 'nats';
import { SUBJECTS } from './subjects';

const sc = StringCodec();

export class TickConsumer {
  private nc: NatsConnection | null = null;
  private sub: Subscription | null = null;
  private loopPromise: Promise<void> | null = null;

  async connect(natsUrl: string): Promise<void> {
    if (!natsUrl) throw new Error('TickConsumer: natsUrl is required');
    try {
      this.nc = await connect({ servers: natsUrl });
    } catch (err) {
      throw new Error(`TickConsumer: Failed to connect to NATS at ${natsUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  onTick(cb: (symbol: string, data: unknown) => void): void {
    if (!this.nc) throw new Error('TickConsumer not connected');
    this.sub = this.nc.subscribe(SUBJECTS.TICKS);
    this.loopPromise = (async () => {
      for await (const msg of this.sub!) {
        try {
          const parts = msg.subject.split('.');
          const symbol = parts.slice(2).join('.'); // handles any symbol format
          const data = JSON.parse(sc.decode(msg.data)) as unknown;
          cb(symbol, data);
        } catch (err) {
          console.warn('TickConsumer: failed to process message', {
            subject: msg.subject,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
  }

  async close(): Promise<void> {
    this.sub?.unsubscribe();
    if (this.loopPromise) await this.loopPromise;
    await this.nc?.drain();
    await this.nc?.close();
  }
}
