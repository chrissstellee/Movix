import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { BusinessOnboarding } from "./onboarding/business-onboarding";
import { BusinessSettings } from "./settings/business-settings";
import { WorkspaceShell } from "./workspace/workspace-shell";

const state = vi.hoisted(() => ({ scenario: "onboarding" }));
const replace = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/client", () => ({
  api: {
    onboarding: { getDraft: "getDraft", saveDraft: "saveDraft", complete: "complete" },
    organizations: {
      currentContext: "currentContext",
      getBusinessSettings: "getBusinessSettings",
      updateProfile: "updateProfile",
      updatePrimaryContact: "updatePrimaryContact",
      updateAddress: "updateAddress",
    },
  },
}));

vi.mock("@/core/auth/auth-context", () => ({
  useMovixAuth: () => ({
    accessToken: "test-token",
    isLoading: false,
    logout: vi.fn(async () => undefined),
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/buyer",
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

const context = {
  kind: "ready",
  user: { id: "user" },
  wallet: {
    address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    network: "testnet",
    verifiedAt: 1,
  },
  organization: {
    id: "organization",
    legalName: "Acme Test Supply",
    capability: "buyer_supplier",
    status: "active",
    verificationStatus: "unverified",
    version: 1n,
  },
  membership: { role: "owner", status: "active" },
  allowedViews: ["buyer", "supplier"],
  profileReadiness: {
    organizationUsable: true,
    buyerReady: true,
    supplierReady: true,
    missing: [],
  },
};

const settings = {
  organization: {
    id: "organization",
    legalName: "Acme Test Supply",
    businessEmail: "owner@example.test",
    capability: "buyer_supplier",
    status: "active",
    verificationStatus: "unverified",
    version: 1n,
  },
  primaryContact: {
    id: "contact",
    type: "general",
    name: "Alex Owner",
    email: "alex@example.test",
    version: 1n,
  },
  addresses: [
    {
      id: "address",
      type: "registered",
      label: "Registered",
      recipientName: "Acme Test Supply",
      line1: "123 Test Street",
      city: "Makati",
      region: "Metro Manila",
      postalCode: "1200",
      countryCode: "PH",
      isDefault: true,
      version: 1n,
    },
  ],
  profileReadiness: context.profileReadiness,
};

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(async () => ({ updated: false, version: 1n })),
  useQuery: (reference: string) => {
    if (reference === "getDraft") {
      return { kind: "blank", version: 0n, currentStep: "identity", completedSteps: [] };
    }
    if (reference === "getBusinessSettings") return settings;
    if (reference === "currentContext") return state.scenario === "onboarding" ? null : context;
    return undefined;
  },
}));

describe("Sprint 2 accessible surfaces", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("has no automated violations in onboarding", async () => {
    state.scenario = "onboarding";
    const { container } = render(<BusinessOnboarding />);
    await screen.findByRole("heading", { name: "Set up your Movix workspace" });
    expect((await axe(container)).violations).toEqual([]);
  });

  it("has no automated violations in the workspace shell", async () => {
    state.scenario = "workspace";
    const { container } = render(
      <WorkspaceShell>
        <h1>Buyer workspace</h1>
      </WorkspaceShell>,
    );
    expect(await screen.findByRole("heading", { name: "Buyer workspace" })).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("has no automated violations in business settings", async () => {
    state.scenario = "settings";
    const { container } = render(<BusinessSettings />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Business settings" })).toBeVisible(),
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
