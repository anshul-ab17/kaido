import { Connection, type Commitment } from '@solana/web3.js';

export interface ConnectionConfig {
  rpcUrl: string;
  commitment?: Commitment;
  wsUrl?: string;
}

export class SolanaConnection {
  private connection: Connection;
  readonly rpcUrl: string;

  constructor(config: ConnectionConfig) {
    this.rpcUrl = config.rpcUrl;
    this.connection = new Connection(config.rpcUrl, {
      commitment: config.commitment ?? 'confirmed',
      wsEndpoint: config.wsUrl,
    });
  }

  getConnection(): Connection {
    return this.connection;
  }

  async getSlot(): Promise<number> {
    return this.connection.getSlot();
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.connection.getSlot();
      return true;
    } catch {
      return false;
    }
  }
}
