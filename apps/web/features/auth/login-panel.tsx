"use client";

import { useMovixAuth } from "@/core/auth/auth-context";
import { BrandLogo } from "@/core/components/brand-logo";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";

import { initialLoginState, isLoginBusy, loginReducer } from "./login-machine";

import type { AuthenticatedSession, Sep10Challenge } from "@repo/stellar/auth";
import type { WalletAccount, WalletAdapter } from "@repo/stellar/wallet";

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code === "user_rejected") return "The wallet request was declined. You can try again.";
    if (code === "wrong_network") return "Switch Freighter to Stellar Testnet and try again.";
    if (code === "unsupported_wallet") return "Install or unlock Freighter, then try again.";
  }
  return error instanceof Error ? error.message : "Sign-in could not be completed. Try again.";
}

function displayAddress(address: string) {
  return `${address.slice(0, 8)}\u2026${address.slice(-6)}`;
}

async function getAdapter() {
  const { MultiWalletAdapter } = await import("@repo/stellar");
  return new MultiWalletAdapter();
}

export function LoginPanel() {
  const [state, dispatch] = useReducer(loginReducer, initialLoginState);
  const attemptRef = useRef(0);
  const activeAccountRef = useRef<WalletAccount | null>(null);
  const adapterRef = useRef<WalletAdapter | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const { establishSession } = useMovixAuth();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.phase === "error") {
      errorRef.current?.focus();
    }
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "confirming_identity" && isAuthenticated) {
      router.replace("/onboarding/business");
    }
  }, [isAuthenticated, router, state.phase]);

  useEffect(
    () => () => {
      attemptRef.current += 1;
      unsubscribeRef.current?.();
      void adapterRef.current?.disconnect();
    },
    [],
  );

  async function signIn() {
    const attempt = ++attemptRef.current;
    activeAccountRef.current = null;
    dispatch({ type: "start", attempt });

    try {
      const adapter = adapterRef.current ?? (await getAdapter());
      adapterRef.current = adapter;
      unsubscribeRef.current ??= adapter.subscribe((event) => {
        const active = activeAccountRef.current;
        if (!active) return;
        const changed =
          event.type !== "account_changed" ||
          event.account.address !== active.address ||
          event.account.networkPassphrase !== active.networkPassphrase;
        if (changed) {
          const activeAttempt = attemptRef.current;
          attemptRef.current += 1;
          dispatch({
            type: "invalidated",
            attempt: activeAttempt,
            message: "The wallet account or network changed. Start a fresh sign-in.",
          });
        }
      });

      const account = await adapter.connect();
      if (attempt !== attemptRef.current) return;
      activeAccountRef.current = account;
      dispatch({ type: "connected", attempt, account });

      const challengeResponse = await fetch(
        `/api/auth/stellar/challenge?account=${encodeURIComponent(account.address)}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!challengeResponse.ok) {
        const failure: unknown = await challengeResponse.json().catch(() => null);
        const message =
          failure &&
          typeof failure === "object" &&
          "error" in failure &&
          failure.error &&
          typeof failure.error === "object" &&
          "message" in failure.error
            ? String(failure.error.message)
            : "Movix could not create a fresh sign-in challenge.";
        throw new Error(message);
      }
      const challenge = (await challengeResponse.json()) as Sep10Challenge;
      if (attempt !== attemptRef.current) return;
      dispatch({ type: "challenge_ready", attempt });

      const signedTransactionXdr = await adapter.signTransaction(
        challenge.transactionXdr,
        challenge.networkPassphrase,
      );
      if (attempt !== attemptRef.current) return;
      dispatch({ type: "signed", attempt });

      const tokenResponse = await fetch("/api/auth/stellar/token", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedTransactionXdr }),
        cache: "no-store",
      });
      if (!tokenResponse.ok) {
        const failure: unknown = await tokenResponse.json().catch(() => null);
        const message =
          failure &&
          typeof failure === "object" &&
          "error" in failure &&
          failure.error &&
          typeof failure.error === "object" &&
          "message" in failure.error
            ? String(failure.error.message)
            : "The signed challenge was rejected. Start a fresh sign-in.";
        throw new Error(message);
      }
      const session = (await tokenResponse.json()) as AuthenticatedSession;
      if (attempt !== attemptRef.current) return;
      establishSession(session);
      dispatch({ type: "session_created", attempt });
    } catch (error) {
      if (attempt === attemptRef.current) {
        dispatch({ type: "failed", attempt, message: errorMessage(error) });
      }
    }
  }

  const busy = isLoginBusy(state.phase);
  const status = {
    idle: "Connect wallet to begin.",
    connecting: "Waiting for wallet…",
    requesting_challenge: "Creating a secure, five-minute challenge…",
    awaiting_signature: "Review the sign-in request in your wallet. Signing does not move funds.",
    verifying: "Verifying your wallet proof…",
    confirming_identity: "Confirming your Movix identity…",
    error: state.error ?? "Sign-in failed.",
  }[state.phase];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,#3559e822,transparent_55%)]"
      />
      <Card className="relative w-full max-w-lg border-white/10 bg-card/90 shadow-2xl shadow-black/30 backdrop-blur">
        <CardHeader className="space-y-4">
          <Link href="/" aria-label="Movix home" className="w-fit">
            <BrandLogo className="h-10 w-auto" priority />
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Sign in with your Stellar wallet
          </h1>
          <p className="leading-7 text-muted-foreground">
            Freighter proves that you control this Testnet account. No password, payment, or
            transaction is required.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {state.account && (
            <div className="rounded-xl border bg-background/50 p-4 text-sm">
              <p className="font-medium">Connected on Stellar Testnet</p>
              <p
                className="mt-2 font-mono text-xs text-muted-foreground"
                aria-label={`Wallet address ${state.account.address}`}
              >
                {displayAddress(state.account.address)}
              </p>
            </div>
          )}
          <div
            ref={errorRef}
            role={state.phase === "error" ? "alert" : "status"}
            aria-live="polite"
            tabIndex={state.phase === "error" ? -1 : undefined}
            className={
              state.phase === "error"
                ? "rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
                : "text-sm text-muted-foreground"
            }
          >
            {status}
          </div>
          <Button className="h-11 w-full" disabled={busy} onClick={() => void signIn()}>
            {busy ? "Signing in…" : state.phase === "error" ? "Try again" : "Connect Wallet"}
          </Button>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Testnet only. Signing the challenge authenticates you to Movix and cannot transfer
            funds.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
