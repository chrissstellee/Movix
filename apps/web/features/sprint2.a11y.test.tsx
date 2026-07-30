import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { BusinessOnboarding } from "./onboarding/business-onboarding";
import { BusinessSettings } from "./settings/business-settings";
import { WorkspaceShell } from "./workspace/workspace-shell";

const state = vi.hoisted(() => ({
  scenario: "onboarding",
  developmentSelfVerificationAvailable: false,
}));
const replace = vi.hoisted(() => vi.fn());
const verifyForDevelopment = vi.hoisted(() =>
  vi.fn(async () => ({
    status: "verified",
    caseId: "verification-case",
    organizationVersion: 2n,
  })),
);

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
    organizationVerification: {
      current: "currentVerification",
      developmentOptions: "developmentVerificationOptions",
      submit: "submitVerification",
      verifyForDevelopment: "verifyForDevelopment",
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
  useSearchParams: () => new URLSearchParams(),
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
  useMutation: (reference: string) =>
    reference === "verifyForDevelopment"
      ? verifyForDevelopment
      : vi.fn(async () => ({ updated: false, version: 1n })),
  useQuery: (reference: string) => {
    if (reference === "getDraft") {
      return { kind: "blank", version: 0n, currentStep: "identity", completedSteps: [] };
    }
    if (reference === "getBusinessSettings") return settings;
    if (reference === "currentVerification") {
      return { status: "not_started", organizationVersion: 1n, case: null };
    }
    if (reference === "developmentVerificationOptions") {
      return {
        selfVerificationAvailable: state.developmentSelfVerificationAvailable,
      };
    }
    if (reference === "currentContext") return state.scenario === "onboarding" ? null : context;
    return undefined;
  },
}));

describe("Sprint 2 accessible surfaces", () => {
  beforeEach(() => {
    replace.mockClear();
    verifyForDevelopment.mockClear();
    state.developmentSelfVerificationAvailable = false;
  });

  it("has no automated violations in onboarding", async () => {
    state.scenario = "onboarding";
    const { container } = render(<BusinessOnboarding />);
    await screen.findByRole("heading", { name: "Set up your Movix workspace" });
    expect(screen.getByLabelText("Entity type")).toHaveClass("bg-background", "text-foreground");
    expect(screen.getByLabelText(/Registration country/)).toHaveClass(
      "bg-background",
      "text-foreground",
    );
    expect((await axe(container)).violations).toEqual([]);
  }, 10_000);

  it("has no automated violations in the workspace shell", async () => {
    state.scenario = "workspace";
    const { container } = render(
      <WorkspaceShell>
        <h1>Buyer workspace</h1>
      </WorkspaceShell>,
    );
    expect(await screen.findByRole("heading", { name: "Buyer workspace" })).toBeVisible();
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it("has no automated violations in business settings", async () => {
    state.scenario = "settings";
    const { container } = render(<BusinessSettings />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Business settings" })).toBeVisible(),
    );
    expect(screen.getByRole("tab", { name: "Business identity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Primary contact" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Addresses" })).toBeVisible();
    expect(screen.getByRole("tabpanel")).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("offers auditable self-verification only when the development deployment enables it", async () => {
    state.scenario = "settings";
    state.developmentSelfVerificationAvailable = true;
    render(<BusinessSettings />);

    const verificationTab = await screen.findByRole("tab", { name: "Verification" });
    fireEvent.mouseDown(verificationTab, { button: 0, ctrlKey: false });
    await waitFor(() => expect(verificationTab).toHaveAttribute("aria-selected", "true"));
    fireEvent.click(screen.getByRole("button", { name: "Verify this development organization" }));

    await waitFor(() =>
      expect(verifyForDevelopment).toHaveBeenCalledWith({
        organizationId: "organization",
        expectedOrganizationVersion: 1n,
      }),
    );
  });
});
