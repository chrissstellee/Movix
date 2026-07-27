import { Networks } from "@stellar/stellar-sdk";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
  subscribe: vi.fn(),
  establishSession: vi.fn(),
  replace: vi.fn(),
  isAuthenticated: false,
}));

vi.mock("@repo/stellar/wallet/freighter", () => ({
  FreighterWalletAdapter: class {
    connect = mocks.connect;
    disconnect = mocks.disconnect;
    signTransaction = mocks.signTransaction;
    subscribe = mocks.subscribe;
  },
}));
vi.mock("@/core/auth/auth-context", () => ({
  useMovixAuth: () => ({ establishSession: mocks.establishSession }),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: mocks.isAuthenticated }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

import { LoginPanel } from "./login-panel";

const account = {
  address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  network: "testnet" as const,
  networkPassphrase: Networks.TESTNET,
};
const session = {
  accessToken: "fixture-access-token",
  expiresAt: 1_800_000_600_000,
  user: {
    id: "user-1",
    walletAddress: account.address,
    network: "testnet" as const,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mocks.connect.mockReset();
  mocks.disconnect.mockReset().mockResolvedValue(undefined);
  mocks.signTransaction.mockReset();
  mocks.subscribe.mockReset().mockReturnValue(vi.fn());
  mocks.establishSession.mockReset();
  mocks.replace.mockReset();
  mocks.isAuthenticated = false;
  vi.stubGlobal("fetch", vi.fn());
});

describe("LoginPanel", () => {
  it("establishes the session but redirects only after Convex confirms identity", async () => {
    mocks.connect.mockResolvedValue(account);
    mocks.signTransaction.mockResolvedValue("signed-xdr");
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          transactionXdr: "challenge-xdr",
          networkPassphrase: Networks.TESTNET,
          expiresAt: Date.now() + 300_000,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(session));
    const view = render(<LoginPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Freighter" }));
    await waitFor(() => expect(mocks.establishSession).toHaveBeenCalledWith(session));
    expect(screen.getByText(/confirming your movix identity/i)).toBeVisible();
    expect(screen.getByLabelText(`Wallet address ${account.address}`)).toHaveTextContent(
      `${account.address.slice(0, 8)}\u2026${account.address.slice(-6)}`,
    );
    expect(mocks.replace).not.toHaveBeenCalled();

    mocks.isAuthenticated = true;
    view.rerender(<LoginPanel />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/onboarding/business"));
  });

  it("requests a fresh challenge after a rejected signature", async () => {
    mocks.connect.mockResolvedValue(account);
    mocks.signTransaction
      .mockRejectedValueOnce({ code: "user_rejected" })
      .mockResolvedValueOnce("signed-xdr");
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          transactionXdr: "first-challenge",
          networkPassphrase: Networks.TESTNET,
          expiresAt: Date.now() + 300_000,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          transactionXdr: "fresh-challenge",
          networkPassphrase: Networks.TESTNET,
          expiresAt: Date.now() + 300_000,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(session));

    render(<LoginPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Freighter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/declined/i);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(mocks.establishSession).toHaveBeenCalledWith(session));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("/api/auth/stellar/challenge");
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toContain("/api/auth/stellar/challenge");
  });

  it("gives a focused recovery action for the wrong network", async () => {
    mocks.connect.mockRejectedValue({ code: "wrong_network" });
    render(<LoginPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Freighter" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/switch freighter to stellar testnet/i);
    expect(alert).toHaveFocus();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
