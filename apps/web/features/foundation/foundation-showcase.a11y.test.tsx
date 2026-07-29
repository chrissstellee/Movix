import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { FoundationShowcase } from "./foundation-showcase";

describe("FoundationShowcase", () => {
  it("renders named controls and lifecycle states", () => {
    render(<FoundationShowcase />);

    expect(screen.getByRole("heading", { name: "Movix design foundation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Primary action" })).toBeEnabled();
    expect(screen.getByLabelText("Trade Order reference")).toBeInvalid();
    expect(screen.getByText("Success · Released")).toBeVisible();
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(<FoundationShowcase />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
