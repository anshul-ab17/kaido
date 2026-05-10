import { connect, NatsConnection, StringCodec } from 'nats';
import { SUBJECTS } from './subjects';

const sc = StringCodec();

export class TickProducer {
  private nc: NatsConnection | null = null;

  async connect(natsUrl: string): Promise<void> {
    this.nc = await connect({ servers: natsUrl });
  }

  publish(symbol: string, data: unknown): void {
    if (!this.nc) throw new Error('TickProducer not connected');
    this.nc.publish(SUBJECTS.TICK(symbol), sc.encode(JSON.stringify(data)));
  }

  async close(): Promise<void> {
    await this.nc?.drain();
  }
}

export class EventProducer {
  private nc: NatsConnection | null = null;

  async connect(natsUrl: string): Promise<void> {
    this.nc = await connect({ servers: natsUrl });
  }

  async publishBet(eventId: string, payload: unknown): Promise<void> {
    if (!this.nc) throw new Error('EventProducer not connected');
    // Use JetStream for durable event delivery
    const js = this.nc.jetstream();
    await js.publish(SUBJECTS.EVENTS_BET, sc.encode(JSON.stringify({ eventId, ...payload as object })));
  }

  async close(): Promise<void> {
    await this.nc?.drain();
  }
}
