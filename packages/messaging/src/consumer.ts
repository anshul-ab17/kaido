import { connect, NatsConnection, StringCodec, Subscription } from 'nats';
import { SUBJECTS } from './subjects';

const sc = StringCodec();

export class TickConsumer {
  private nc: NatsConnection | null = null;
  private sub: Subscription | null = null;

  async connect(natsUrl: string): Promise<void> {
    this.nc = await connect({ servers: natsUrl });
  }

  onTick(cb: (symbol: string, data: unknown) => void): void {
    if (!this.nc) throw new Error('TickConsumer not connected');
    this.sub = this.nc.subscribe(SUBJECTS.TICKS);
    void (async () => {
      for await (const msg of this.sub!) {
        try {
          const subject = msg.subject; // e.g. kaido.ticks.SOL-PERP
          const symbol = subject.split('.')[2] ?? subject;
          const data = JSON.parse(sc.decode(msg.data)) as unknown;
          cb(symbol, data);
        } catch {
          // skip malformed messages
        }
      }
    })();
  }

  async close(): Promise<void> {
    this.sub?.unsubscribe();
    await this.nc?.drain();
  }
}
