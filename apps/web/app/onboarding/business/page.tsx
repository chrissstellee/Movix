import { BusinessOnboarding } from "@/features/onboarding/business-onboarding";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business onboarding",
};

export default function BusinessOnboardingPage() {
  return <BusinessOnboarding />;
}
