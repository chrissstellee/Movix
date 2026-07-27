"use client";

import { useMovixAuth } from "@/core/auth/auth-context";
import { api } from "@repo/backend/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function WalletSettings() {
  const auth = useMovixAuth();
  const convexAuth = useConvexAuth();
  const router = useRouter();
  const wallet = useQuery(api.auth.walletSettings, convexAuth.isAuthenticated ? {} : "skip");
  const context = useQuery(
    api.organizations.currentContext,
    convexAuth.isAuthenticated ? {} : "skip",
  );
  useEffect(() => {
    if (!auth.isLoading && !auth.accessToken) router.replace("/login");
  }, [auth.accessToken, auth.isLoading, router]);
  if (auth.isLoading || convexAuth.isLoading || wallet === undefined || context === undefined)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status">Loading wallet settings…</p>
      </main>
    );
  if (!auth.accessToken || !convexAuth.isAuthenticated || !wallet) return null;
  const home =
    context?.kind === "ready"
      ? context.allowedViews.includes("buyer")
        ? "/buyer"
        : "/supplier"
      : "/onboarding/business";
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl p-5 sm:py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Settings</p>
          <h1 className="mt-1 text-3xl font-semibold">Wallet</h1>
        </div>
        <Button asChild variant="outline">
          <Link href={home}>Back to Movix</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Verified Stellar wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-xs text-muted-foreground">Public address</p>
            <p className="mt-1 font-mono text-sm break-all">{wallet.walletAddress}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Stellar Testnet</Badge>
            <Badge>{wallet.accountStatus === "active" ? "Active" : "Inactive"}</Badge>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Verified</dt>
              <dd>{new Date(wallet.verifiedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Session expires</dt>
              <dd>{new Date(wallet.sessionExpiresAt).toLocaleString()}</dd>
            </div>
          </dl>
          <Button
            variant="destructive"
            onClick={() => void auth.logout().finally(() => router.replace("/"))}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
