import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ExporterInvitation } from "./exporter-invitation";

vi.mock("@repo/backend/client", () => ({
  api: {
    exporterInvitations: {
      getByToken: "getByToken",
      issue: "issue",
      accept: "accept",
    },
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));

describe("Sprint 6 agricultural trade surfaces", () => {
  it("renders an accessible intended-Exporter invitation form", async () => {
    const { container } = render(<ExporterInvitation />);

    expect(screen.getByRole("heading", { name: "Exporter invitation" })).toBeVisible();
    expect(screen.getByLabelText("Exporter Stellar wallet")).toBeVisible();
    expect(screen.getByLabelText("Exporter business email")).toBeVisible();
    expect(screen.getByRole("button", { name: "Issue seven-day invitation" })).toBeDisabled();
    expect((await axe(container)).violations).toEqual([]);
  });
});
