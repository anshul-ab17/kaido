import { connect, NatsConnection, StringCodec } from 'nats';
import { SUBJECTS } from './subjects';

const sc = StringCodec();

export class TickProducer {
  private nc: NatsConnection | null = null;
  private isClosed = false;

  async connect(natsUrl: string): Promise<void> {
    if (!natsUrl) throw new Error('TickProducer: natsUrl is required');
    try {
      this.nc = await connect({ servers: natsUrl });
    } catch (err) {
      throw new Error(`TickProducer: Failed to connect to NATS at ${natsUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  publish(symbol: string, data: unknown): void {
    if (this.isClosed) throw new Error('TickProducer is closed');
    if (!this.nc) throw new Error('TickProducer not connected');
    this.nc.publish(SUBJECTS.TICK(symbol), sc.encode(JSON.stringify(data)));
  }

  async close(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;
    await this.nc?.drain();
    await this.nc?.close();
  }
}

export class EventProducer {
  private nc: NatsConnection | null = null;
  private isClosed = false;

  async connect(natsUrl: string): Promise<void> {
    if (!natsUrl) throw new Error('EventProducer: natsUrl is required');
    try {
      this.nc = await connect({ servers: natsUrl });
    } catch (err) {
      throw new Error(`EventProducer: Failed to connect to NATS at ${natsUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async publishBet(eventId: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.nc) throw new Error('EventProducer not connected');
    // Use JetStream for durable event delivery
    const js = this.nc.jetstream();
    const message = { eventId, ...payload };
    await js.publish(SUBJECTS.EVENTS_BET, sc.encode(JSON.stringify(message)));
  }

  async close(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;
    await this.nc?.drain();
    await this.nc?.close();
  }
}
