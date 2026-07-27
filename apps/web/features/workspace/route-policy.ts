export type WorkspaceContext =
  | null
  | { kind: "multiple" }
  | { kind: "ready"; allowedViews: Array<"buyer" | "supplier"> };

export function routeForContext(
  context: WorkspaceContext,
  requestedPath?: string,
): "/onboarding/business" | "/buyer" | "/supplier" | "/access-unavailable" {
  if (context === null) return "/onboarding/business";
  if (context.kind === "multiple") return "/access-unavailable";
  if (requestedPath === "/supplier" && context.allowedViews.includes("supplier")) {
    return "/supplier";
  }
  if (requestedPath === "/buyer" && context.allowedViews.includes("buyer")) {
    return "/buyer";
  }
  return context.allowedViews.includes("buyer") ? "/buyer" : "/supplier";
}
