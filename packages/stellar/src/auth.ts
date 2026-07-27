export interface Sep10ChallengeRequest {
  account: string;
  homeDomain: string;
}

export interface Sep10Challenge {
  transactionXdr: string;
  networkPassphrase: string;
  expiresAt: number;
}

export interface AuthenticatedSession {
  token: string;
  expiresAt: number;
  walletAddress: string;
}

export interface Sep10Client {
  requestChallenge(request: Sep10ChallengeRequest): Promise<Sep10Challenge>;
  submitChallenge(signedTransactionXdr: string): Promise<AuthenticatedSession>;
}
