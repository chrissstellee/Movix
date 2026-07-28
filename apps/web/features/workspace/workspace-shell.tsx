"use client";

import { useMovixAuth } from "@/core/auth/auth-context";
import { BrandLogo } from "@/core/components/brand-logo";
import { api } from "@repo/backend/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@repo/ui/components/ui/sheet";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { routeForContext } from "./route-policy";

function walletLabel(address: string) {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useMovixAuth();
  const convexAuth = useConvexAuth();
  const context = useQuery(
    api.organizations.currentContext,
    convexAuth.isAuthenticated ? {} : "skip",
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!auth.isLoading && !auth.accessToken) router.replace("/login");
  }, [auth.accessToken, auth.isLoading, router]);

  useEffect(() => {
    if (context === undefined) return;
    const destination = routeForContext(context, pathname);
    const workspacePath =
      pathname === "/buyer" || pathname === "/supplier" ? pathname : destination;
    if (
      context === null ||
      context.kind === "multiple" ||
      (workspacePath !== pathname && (pathname === "/buyer" || pathname === "/supplier"))
    ) {
      router.replace(destination);
    }
  }, [context, pathname, router]);

  if (auth.isLoading || convexAuth.isLoading || context === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status">Loading workspace…</p>
      </main>
    );
  }
  if (!auth.accessToken || !convexAuth.isAuthenticated || !context || context.kind !== "ready") {
    return null;
  }
  const requestedView =
    pathname === "/supplier" ? "supplier" : pathname === "/buyer" ? "buyer" : null;
  if (requestedView && !context.allowedViews.includes(requestedView)) return null;

  const navigation = (
    <nav aria-label="Workspace" className="space-y-2">
      {context.allowedViews.includes("buyer") ? (
        <NavLink href="/buyer" active={pathname === "/buyer"}>
          Buyer workspace
        </NavLink>
      ) : null}
      {context.allowedViews.includes("supplier") ? (
        <NavLink href="/supplier" active={pathname === "/supplier"}>
          Supplier workspace
        </NavLink>
      ) : null}
      <NavLink href="/settings/business" active={pathname === "/settings/business"}>
        Business settings
      </NavLink>
      <NavLink href="/settings/wallet" active={pathname === "/settings/wallet"}>
        Wallet settings
      </NavLink>
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/20 lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r bg-background p-5 lg:flex lg:flex-col">
        <ShellIdentity
          name={context.organization.tradingName ?? context.organization.legalName}
          wallet={context.wallet.address}
        />
        <div className="mt-8">{navigation}</div>
        <Button
          className="mt-auto"
          variant="ghost"
          onClick={() => void auth.logout().finally(() => router.replace("/"))}
        >
          Sign out
        </Button>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Open navigation">
                  Menu
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-5">
                <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
                <ShellIdentity
                  name={context.organization.tradingName ?? context.organization.legalName}
                  wallet={context.wallet.address}
                />
                <div className="mt-8" role="presentation" onClick={() => setMobileOpen(false)}>
                  {navigation}
                </div>
                <Button
                  className="mt-8 w-full"
                  variant="outline"
                  onClick={() => void auth.logout().finally(() => router.replace("/"))}
                >
                  Sign out
                </Button>
              </SheetContent>
            </Sheet>
            <span className="truncate text-sm font-semibold">
              {context.organization.tradingName ?? context.organization.legalName}
            </span>
          </div>
          <p className="hidden text-sm text-muted-foreground lg:block">{breadcrumb(pathname)}</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Testnet</Badge>
            <span className="hidden font-mono text-xs sm:inline">
              {walletLabel(context.wallet.address)}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
          {!context.profileReadiness.organizationUsable ? (
            <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              Your profile needs attention.{" "}
              <Link className="font-medium underline" href="/settings/business">
                Review missing fields
              </Link>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

function ShellIdentity({ name, wallet }: { name: string; wallet: string }) {
  return (
    <div>
      <Link href="/buyer" aria-label="Movix home" className="inline-block">
        <BrandLogo className="h-8 w-auto" />
      </Link>
      <p className="mt-5 truncate text-sm font-medium">{name}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{walletLabel(wallet)}</p>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      {children}
    </Link>
  );
}

function breadcrumb(pathname: string) {
  if (pathname === "/settings/business") return "Settings / Business";
  if (pathname === "/settings/wallet") return "Settings / Wallet";
  return pathname === "/supplier" ? "Supplier workspace" : "Buyer workspace";
}
