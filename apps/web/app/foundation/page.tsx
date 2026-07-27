import { FoundationShowcase } from "@/features/foundation/foundation-showcase";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Foundation sample",
  robots: { index: false, follow: false },
};

export default function FoundationPage() {
  const enabled =
    process.env.NODE_ENV !== "production" || process.env.MOVIX_ENABLE_FOUNDATION_SAMPLE === "1";

  if (!enabled) {
    notFound();
  }

  return <FoundationShowcase />;
}
