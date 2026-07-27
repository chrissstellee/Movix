import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { initialLoginState, loginReducer } from "./login-machine";

const account = {
  address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  network: "testnet" as const,
  networkPassphrase: Networks.TESTNET,
};

describe("loginReducer", () => {
  it("advances through the authentication states", () => {
    const connecting = loginReducer(initialLoginState, { type: "start", attempt: 1 });
    const requesting = loginReducer(connecting, { type: "connected", attempt: 1, account });
    const signing = loginReducer(requesting, { type: "challenge_ready", attempt: 1 });
    const verifying = loginReducer(signing, { type: "signed", attempt: 1 });
    const confirming = loginReducer(verifying, { type: "session_created", attempt: 1 });

    expect(confirming).toMatchObject({ phase: "confirming_identity", account, error: null });
  });

  it("ignores callbacks from stale attempts", () => {
    const current = loginReducer(initialLoginState, { type: "start", attempt: 2 });
    expect(loginReducer(current, { type: "failed", attempt: 1, message: "stale" })).toBe(current);
  });

  it("invalidates an active attempt when wallet state changes", () => {
    const connected = loginReducer(loginReducer(initialLoginState, { type: "start", attempt: 1 }), {
      type: "connected",
      attempt: 1,
      account,
    });
    expect(
      loginReducer(connected, {
        type: "invalidated",
        attempt: 1,
        message: "Wallet changed.",
      }),
    ).toMatchObject({ phase: "error", error: "Wallet changed." });
  });
});
