import { LoginPanel } from "@/features/auth/login-panel";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Movix with a supported Stellar wallet on Testnet.",
};

export default function LoginPage() {
  return <LoginPanel />;
}
