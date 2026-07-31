"use client";

import { useMovixAuth } from "@/core/auth/auth-context";
import { BrandLogo } from "@/core/components/brand-logo";
import { api } from "@repo/backend/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@repo/ui/components/ui/sheet";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReactNode, Suspense, useEffect, useState } from "react";

import { routeForContext } from "./route-policy";

function walletLabel(address: string) {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p role="status">Loading workspace…</p>
        </main>
      }
    >
      <WorkspaceShellContent>{children}</WorkspaceShellContent>
    </Suspense>
  );
}

function WorkspaceShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useMovixAuth();
  const convexAuth = useConvexAuth();
  const context = useQuery(
    api.organizations.currentContext,
    convexAuth.isAuthenticated ? {} : "skip",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
  const orderView =
    searchParams.get("view") === "supplier" && context.allowedViews.includes("supplier")
      ? "supplier"
      : context.allowedViews.includes("buyer")
        ? "buyer"
        : "supplier";
  const homeHref = context.allowedViews.includes("buyer") ? "/buyer" : "/supplier";

  const navigation = (compact = false) => (
    <nav aria-label="Workspace" className="space-y-2">
      {context.allowedViews.includes("buyer") ? (
        <NavLink href="/buyer" active={pathname === "/buyer"} icon="buyer" compact={compact}>
          Importer workspace
        </NavLink>
      ) : null}
      {context.allowedViews.includes("buyer") ? (
        <NavLink
          href="/orders?view=buyer"
          active={
            (pathname === "/orders" || pathname.startsWith("/orders/")) && orderView === "buyer"
          }
          icon="orders"
          compact={compact}
        >
          Importer Trade Orders
        </NavLink>
      ) : null}
      {context.allowedViews.includes("supplier") ? (
        <NavLink
          href="/supplier"
          active={pathname === "/supplier"}
          icon="supplier"
          compact={compact}
        >
          Exporter workspace
        </NavLink>
      ) : null}
      {context.allowedViews.includes("supplier") ? (
        <NavLink
          href="/orders?view=supplier"
          active={
            (pathname === "/orders" || pathname.startsWith("/orders/")) && orderView === "supplier"
          }
          icon="orders"
          compact={compact}
        >
          Exporter Trade Orders
        </NavLink>
      ) : null}
      <NavLink
        href="/settings/business"
        active={pathname === "/settings/business"}
        icon="business"
        compact={compact}
      >
        Business settings
      </NavLink>
      <NavLink
        href="/settings/wallet"
        active={pathname === "/settings/wallet"}
        icon="wallet"
        compact={compact}
      >
        Wallet settings
      </NavLink>
    </nav>
  );

  return (
    <div
      className={`min-h-screen bg-muted/20 lg:grid ${
        sidebarCollapsed ? "lg:grid-cols-[4.75rem_1fr]" : "lg:grid-cols-[17rem_1fr]"
      }`}
    >
      <aside
        data-collapsed={sidebarCollapsed}
        className={`hidden border-r bg-background lg:flex lg:flex-col ${
          sidebarCollapsed ? "p-3" : "p-5"
        }`}
      >
        <ShellIdentity
          name={context.organization.tradingName ?? context.organization.legalName}
          wallet={context.wallet.address}
          compact={sidebarCollapsed}
          homeHref={homeHref}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`mt-5 ${sidebarCollapsed ? "w-full px-0" : "self-end"}`}
          aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        >
          <ShellIcon name={sidebarCollapsed ? "expand" : "collapse"} />
          <span className="sr-only">
            {sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          </span>
        </Button>
        <div className="mt-5">{navigation(sidebarCollapsed)}</div>
        <Button
          className={`mt-auto ${sidebarCollapsed ? "px-0" : ""}`}
          variant="ghost"
          aria-label="Sign out"
          title={sidebarCollapsed ? "Sign out" : undefined}
          onClick={() => void auth.logout().finally(() => router.replace("/"))}
        >
          <ShellIcon name="logout" />
          {sidebarCollapsed ? <span className="sr-only">Sign out</span> : <span>Sign out</span>}
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
                  compact={false}
                  homeHref={homeHref}
                />
                <div className="mt-8" role="presentation" onClick={() => setMobileOpen(false)}>
                  {navigation()}
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
          <p className="hidden text-sm text-muted-foreground lg:block">
            {breadcrumb(pathname, orderView)}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Testnet</Badge>
            <Link
              href="/settings/wallet"
              className="hidden font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline sm:inline"
              title="View wallet settings"
            >
              {walletLabel(context.wallet.address)}
            </Link>
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

function ShellIdentity({
  name,
  wallet,
  compact,
  homeHref,
}: {
  name: string;
  wallet: string;
  compact: boolean;
  homeHref: string;
}) {
  return (
    <div className="text-center">
      <Link href={homeHref} aria-label="Movix home" className="inline-flex justify-center">
        <BrandLogo className={compact ? "h-9 w-auto" : "h-11 w-auto"} />
      </Link>
      {compact ? null : (
        <>
          <p className="mt-5 truncate text-sm font-medium" title={name}>
            {name}
          </p>
          <Link
            href="/settings/wallet"
            className="mt-1 block font-mono text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
            title="View wallet settings"
          >
            {walletLabel(wallet)}
          </Link>
        </>
      )}
    </div>
  );
}

function NavLink({
  href,
  active,
  icon,
  compact,
  children,
}: {
  href: string;
  active: boolean;
  icon: ShellIconName;
  compact: boolean;
  children: ReactNode;
}) {
  const label = String(children);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      className={`flex min-h-10 items-center rounded-md px-3 py-2 text-sm ${
        compact ? "justify-center" : "gap-3"
      } ${active ? "bg-primary font-medium text-primary-foreground" : "hover:bg-muted"}`}
    >
      <ShellIcon name={icon} />
      {compact ? <span className="sr-only">{children}</span> : <span>{children}</span>}
    </Link>
  );
}

type ShellIconName =
  | "buyer"
  | "orders"
  | "supplier"
  | "business"
  | "wallet"
  | "logout"
  | "collapse"
  | "expand";

function ShellIcon({ name }: { name: ShellIconName }) {
  const paths: Record<ShellIconName, ReactNode> = {
    buyer: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </>
    ),
    orders: (
      <>
        <path d="M7 3h10v4H7z" />
        <path d="M5 5h14v16H5zM8 11h8M8 15h8" />
      </>
    ),
    supplier: (
      <>
        <path d="M3 21V9l9-5 9 5v12" />
        <path d="M8 21v-7h8v7M9 10h6" />
      </>
    ),
    business: (
      <>
        <path d="M4 21V7h16v14M8 7V3h8v4" />
        <path d="M8 11h2M14 11h2M8 15h2M14 15h2" />
      </>
    ),
    wallet: (
      <>
        <path d="M3 6h16a2 2 0 0 1 2 2v11H3z" />
        <path d="M3 6a3 3 0 0 1 3-3h11v3M16 12h5" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
      </>
    ),
    collapse: (
      <>
        <path d="M9 5l-7 7 7 7M22 5l-7 7 7 7" />
      </>
    ),
    expand: (
      <>
        <path d="M2 5l7 7-7 7M15 5l7 7-7 7" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
    >
      {paths[name]}
    </svg>
  );
}

function breadcrumb(pathname: string, orderView: "buyer" | "supplier") {
  if (pathname === "/settings/business") return "Settings / Business";
  if (pathname === "/settings/wallet") return "Settings / Wallet";
  if (pathname === "/orders")
    return orderView === "supplier" ? "Exporter / Trade Orders" : "Importer / Trade Orders";
  if (pathname === "/orders/new") return "Importer / Trade Orders / Create";
  if (pathname.startsWith("/orders/"))
    return orderView === "supplier"
      ? "Exporter / Trade Orders / Detail"
      : "Importer / Trade Orders / Detail";
  return pathname === "/supplier" ? "Exporter workspace" : "Importer workspace";
}
