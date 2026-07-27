import { LoginPanel } from "@/features/auth/login-panel";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Movix with Freighter on Stellar Testnet.",
};

export default function LoginPage() {
  return <LoginPanel />;
}
