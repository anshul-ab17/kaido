export interface AuthChallenge {
  nonce: string;
  message: string;
  expiresAt: number;
}

export interface AuthVerify {
  walletAddress: string;
  signature: string;
  nonce: string;
}

export interface AuthSession {
  token: string;
  walletAddress: string;
  userId: string;
  expiresAt: number;
}
