import { ConvexClientProvider } from "@/core/providers/convex-provider";
import UiProviders from "@repo/ui/ui-providers";
import localFont from "next/font/local";

import type { Metadata } from "next";

import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Movix",
    template: "%s | Movix",
  },
  description: "Secure procurement and escrow workflows on Stellar.",
  keywords: ["Movix", "Stellar", "procurement", "escrow"],
  openGraph: {
    siteName: "Movix",
    title: "Movix",
    description: "Secure procurement and escrow workflows on Stellar.",
    type: "website",
  },
  twitter: {
    title: "Movix",
    description: "Secure procurement and escrow workflows on Stellar.",
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ConvexClientProvider>
          <UiProviders>{children}</UiProviders>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
