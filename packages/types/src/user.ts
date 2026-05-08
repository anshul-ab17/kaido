export type IdentityType = 'wallet' | 'email' | 'social';
export type IdentityProvider = 'phantom' | 'backpack' | 'solflare' | 'privy' | 'email';

export interface AuthIdentity {
  id: string;
  userId: string;
  type: IdentityType;
  provider: IdentityProvider;
  address: string;
  createdAt: number;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  defaultSlippage: number;
  soundEnabled: boolean;
  notifications: boolean;
}

export interface User {
  id: string;
  createdAt: number;
  lastLogin?: number;
  referralCode?: string;
  riskProfile?: string;
  settings?: UserSettings;
  identities: AuthIdentity[];
}
