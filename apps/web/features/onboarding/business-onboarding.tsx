"use client";

import { useMovixAuth } from "@/core/auth/auth-context";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useConvexAuth, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface CurrentUser {
  id: string;
  walletAddress: string;
  network: "testnet";
}

const currentUserQuery = makeFunctionReference<"query", Record<string, never>, CurrentUser | null>(
  "auth:currentUser",
);

export function BusinessOnboarding() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const auth = useMovixAuth();
  const user = useQuery(currentUserQuery, isAuthenticated ? {} : "skip");
  const { logout } = auth;
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.accessToken) {
      router.replace("/login");
    }
  }, [auth.accessToken, auth.isLoading, router]);

  useEffect(() => {
    if (auth.accessToken && !isLoading && !isAuthenticated) {
      void logout().finally(() => router.replace("/login"));
    }
  }, [auth.accessToken, isAuthenticated, isLoading, logout, router]);

  useEffect(() => {
    if (isAuthenticated && user === null) {
      void logout().finally(() => router.replace("/login"));
    }
  }, [isAuthenticated, logout, router, user]);

  if (auth.isLoading || isLoading || (isAuthenticated && user === undefined)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          Confirming your protected Movix session…
        </p>
      </main>
    );
  }
  if (!auth.accessToken || !isAuthenticated || !user) {
    return null;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-12 sm:py-20">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
            Protected onboarding
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Tell us about your business
          </h1>
        </div>
        <Button variant="outline" onClick={() => void logout().finally(() => router.replace("/"))}>
          Sign out
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Your wallet proof is complete. Business authorization and organization creation are
            intentionally deferred beyond Sprint 1.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">Authenticated wallet</p>
            <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
              {user.walletAddress}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Stellar Testnet</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="legal-name">Legal business name</Label>
              <Input id="legal-name" placeholder="Acme Supply Co." autoComplete="organization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" placeholder="Philippines" autoComplete="country-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Primary role</Label>
              <Input id="role" placeholder="Buyer or supplier" />
            </div>
          </div>
          <Button disabled className="w-full sm:w-auto">
            Continue in Sprint 2
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
