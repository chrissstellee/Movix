import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("has working navigation and sign-in calls to action", () => {
    render(<LandingPage />);
    expect(
      screen.getByRole("heading", {
        name: "ASEAN agricultural trade that settles with certainty.",
      }),
    ).toBeVisible();
    expect(screen.getAllByRole("link", { name: /sign in/i })[0]).toHaveAttribute("href", "/login");
    expect(screen.getByRole("button", { name: "What does Movix protect?" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Agreement accepted")).not.toBeInTheDocument();
    expect(screen.getByTestId("landing-hero-copy")).toHaveClass("text-center");
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(<LandingPage />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
