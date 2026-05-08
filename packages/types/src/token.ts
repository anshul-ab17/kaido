export interface Token {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoUri?: string;
  coingeckoId?: string;
}

export interface TokenBalance {
  token: Token;
  amount: bigint;
  uiAmount: number;
  uiAmountString: string;
}
