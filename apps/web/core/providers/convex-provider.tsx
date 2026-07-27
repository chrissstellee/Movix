"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

import { MovixAuthProvider, useConvexAuthAdapter } from "../auth/auth-context";
import { env } from "../config/env";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <MovixAuthProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthAdapter}>
        {children}
      </ConvexProviderWithAuth>
    </MovixAuthProvider>
  );
}
