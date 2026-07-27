export interface Sep10ChallengeRequest {
  account: string;
}

export interface Sep10Challenge {
  transactionXdr: string;
  networkPassphrase: string;
  expiresAt: number;
}

export interface AuthenticatedUser {
  id: string;
  walletAddress: string;
  network: "testnet";
}

export interface AuthenticatedSession {
  accessToken: string;
  expiresAt: number;
  user: AuthenticatedUser;
}

export interface Sep10Client {
  requestChallenge(request: Sep10ChallengeRequest): Promise<Sep10Challenge>;
  submitChallenge(signedTransactionXdr: string): Promise<AuthenticatedSession>;
}

export type AuthErrorCode =
  | "invalid_request"
  | "invalid_account"
  | "wallet_unavailable"
  | "wallet_rejected"
  | "wrong_network"
  | "challenge_expired"
  | "challenge_invalid"
  | "challenge_replayed"
  | "rate_limited"
  | "session_expired"
  | "session_revoked"
  | "session_reused"
  | "session_conflict"
  | "service_unavailable";

export interface AuthErrorBody {
  error: {
    code: AuthErrorCode;
    message: string;
    correlationId: string;
    retryAfterSeconds?: number;
  };
}
