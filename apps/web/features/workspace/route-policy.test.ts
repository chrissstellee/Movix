import { describe, expect, it } from "vitest";

import { routeForContext } from "./route-policy";

describe("workspace route policy", () => {
  it("routes accounts without memberships to onboarding", () => {
    expect(routeForContext(null)).toBe("/onboarding/business");
  });

  it("does not choose between multiple organizations", () => {
    expect(routeForContext({ kind: "multiple" })).toBe("/access-unavailable");
  });

  it("keeps allowed views and defaults dual organizations to buyer", () => {
    const context = {
      kind: "ready" as const,
      allowedViews: ["buyer", "supplier"] as Array<"buyer" | "supplier">,
    };
    expect(routeForContext(context)).toBe("/buyer");
    expect(routeForContext(context, "/supplier")).toBe("/supplier");
  });

  it("redirects a disallowed view", () => {
    expect(routeForContext({ kind: "ready", allowedViews: ["supplier"] }, "/buyer")).toBe(
      "/supplier",
    );
  });
});
