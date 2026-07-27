import type { WalletAccount } from "@repo/stellar/wallet";

export type LoginPhase =
  | "idle"
  | "connecting"
  | "requesting_challenge"
  | "awaiting_signature"
  | "verifying"
  | "confirming_identity"
  | "error";

export interface LoginState {
  phase: LoginPhase;
  attempt: number;
  account: WalletAccount | null;
  error: string | null;
}

export type LoginAction =
  | { type: "start"; attempt: number }
  | { type: "connected"; attempt: number; account: WalletAccount }
  | { type: "challenge_ready"; attempt: number }
  | { type: "signed"; attempt: number }
  | { type: "session_created"; attempt: number }
  | { type: "failed"; attempt: number; message: string }
  | { type: "invalidated"; attempt: number; message: string }
  | { type: "reset"; attempt: number };

export const initialLoginState: LoginState = {
  phase: "idle",
  attempt: 0,
  account: null,
  error: null,
};

export function loginReducer(state: LoginState, action: LoginAction): LoginState {
  if (action.type !== "start" && action.type !== "reset" && action.attempt !== state.attempt) {
    return state;
  }

  switch (action.type) {
    case "start":
      return { phase: "connecting", attempt: action.attempt, account: null, error: null };
    case "connected":
      return {
        phase: "requesting_challenge",
        attempt: state.attempt,
        account: action.account,
        error: null,
      };
    case "challenge_ready":
      return { ...state, phase: "awaiting_signature" };
    case "signed":
      return { ...state, phase: "verifying" };
    case "session_created":
      return { ...state, phase: "confirming_identity" };
    case "failed":
    case "invalidated":
      return { ...state, phase: "error", error: action.message };
    case "reset":
      return { ...initialLoginState, attempt: action.attempt };
  }
}

export function isLoginBusy(phase: LoginPhase) {
  return !["idle", "error"].includes(phase);
}
