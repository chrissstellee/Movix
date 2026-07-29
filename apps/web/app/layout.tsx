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
  description: "Secure ASEAN agricultural Trade Orders and escrow workflows on Stellar.",
  keywords: ["Movix", "Stellar", "agricultural trade", "Trade Orders", "escrow"],
  icons: {
    icon: [{ url: "/movix-logo.svg", type: "image/svg+xml" }],
    shortcut: "/movix-logo.svg",
    apple: "/movix-logo.png",
  },
  openGraph: {
    siteName: "Movix",
    title: "Movix",
    description: "Secure ASEAN agricultural Trade Orders and escrow workflows on Stellar.",
    images: [
      {
        url: "/movix-logo.png",
        width: 2900,
        height: 1366,
        alt: "Movix",
      },
    ],
    type: "website",
  },
  twitter: {
    title: "Movix",
    description: "Secure ASEAN agricultural Trade Orders and escrow workflows on Stellar.",
    card: "summary_large_image",
    images: ["/movix-logo.png"],
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
