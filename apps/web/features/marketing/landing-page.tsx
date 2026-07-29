"use client";

import { BrandLogo } from "@/core/components/brand-logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import Link from "next/link";
import { useState } from "react";

const stages = [
  ["01", "Agree", "Create and accept one complete purchase order."],
  ["02", "Lock", "Lock the exact accepted value in Stellar escrow."],
  ["03", "Fulfill", "Record fulfillment and let the buyer review delivery."],
  ["04", "Settle", "Release or mutually refund with a traceable record."],
];

const faqs = [
  [
    "What does Movix protect?",
    "Movix connects an agreed purchase order to explicit escrow and settlement steps, so both parties share one traceable commercial record.",
  ],
  [
    "Does signing in move funds?",
    "No. The SEP-10 signature only proves control of your wallet address. Funds can move only in a later, explicit transaction-review flow.",
  ],
  [
    "Does Movix hold my private key?",
    "No. Your private key stays in Freighter. Movix receives only the signed authentication challenge.",
  ],
  [
    "Does Stellar prove that goods were delivered?",
    "No. Stellar records settlement evidence; buyers and suppliers still record and confirm real-world fulfillment.",
  ],
  [
    "Which network and assets are supported?",
    "This pilot supports Stellar Testnet, Testnet XLM, and the project's single allowlisted Testnet USDC configuration.",
  ],
  [
    "What happens if both parties want a refund?",
    "The planned settlement workflow supports a mutually approved refund with a traceable record. Automatic dispute resolution is not part of this pilot.",
  ],
  [
    "Is Movix ready for Mainnet?",
    "No. Sprint 1 is a Testnet pilot; its assets have no production monetary value.",
  ],
];

const navItems = [
  ["How it works", "#how-it-works"],
  ["Security", "#security"],
  ["Network", "#network"],
  ["FAQ", "#faq"],
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-50 -translate-y-20 rounded-md bg-background px-4 py-2 text-sm font-medium focus:translate-y-0"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link href="/" aria-label="Movix home" className="shrink-0">
            <BrandLogo className="h-8 w-auto" priority />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
            {navItems.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="hidden md:block">
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
          </Button>
        </div>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile"
            className="border-t bg-background px-5 py-5 md:hidden"
          >
            <div className="mx-auto grid max-w-7xl gap-3">
              {navItems.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-md px-2 py-2 text-sm"
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
              <Button asChild className="mt-2">
                <Link href="/login" onClick={() => setMenuOpen(false)}>
                  Sign in
                </Link>
              </Button>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,#3559e832,transparent_46%)]"
          />
          <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center justify-center px-5 py-20">
            <div data-testid="landing-hero-copy" className="mx-auto max-w-4xl text-center">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Stellar Testnet pilot
              </Badge>
              <h1 className="mt-7 text-5xl leading-[1.02] font-semibold tracking-[-0.05em] sm:text-7xl">
                Procurement that settles with certainty.
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
                Buyers commit agreed funds before fulfillment. Suppliers receive payment after
                buyer-confirmed delivery—all through one shared, traceable workflow.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-7">
                  <Link href="/login">Sign in with Freighter</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-7">
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Signing in proves wallet control. It does not move funds.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 py-24">
          <div className="mx-auto max-w-7xl px-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
              Workflow
            </p>
            <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              One commercial record from agreement to settlement.
            </h2>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stages.map(([number, title, description]) => (
                <Card key={number} className="border-white/10 bg-card/60">
                  <CardHeader>
                    <span className="font-mono text-xs text-primary">{number}</span>
                    <CardTitle className="text-xl">{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-6 text-muted-foreground">
                    {description}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="scroll-mt-24 border-y border-white/10 bg-muted/20 py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
                Clear trust boundaries
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Your wallet stays yours.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                Wallet authentication proves control of an address. Movix never receives your
                private key, and signing in cannot transfer funds.
              </p>
            </div>
            <div className="grid gap-4">
              {[
                ["Wallet proof", "Freighter signs a five-minute authentication challenge."],
                [
                  "Explicit transactions",
                  "Funds move only after a separate review and approval flow.",
                ],
                [
                  "Off-chain commerce",
                  "Commercial details stay off-chain; settlement evidence is traceable.",
                ],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-xl border bg-background/55 p-5">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="network" className="scroll-mt-24 py-24">
          <div className="mx-auto max-w-7xl px-5">
            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-7 sm:p-12">
              <Badge variant="outline">Pilot network</Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
                Built for Stellar Testnet
              </h2>
              <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
                The pilot supports Testnet XLM and one allowlisted Testnet USDC configuration. These
                assets have no production monetary value. This section is informational and never
                reads a balance or initiates a transaction.
              </p>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 border-t border-white/10 py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">FAQ</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight">Straight answers.</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map(([question, answer], index) => (
                <AccordionItem key={question} value={`faq-${index}`}>
                  <AccordionTrigger className="text-base">{question}</AccordionTrigger>
                  <AccordionContent className="max-w-2xl leading-6 text-muted-foreground">
                    {answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="px-5 pb-24">
          <div className="mx-auto max-w-7xl rounded-3xl bg-primary px-7 py-14 text-primary-foreground sm:px-14">
            <h2 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Start with a wallet proof, not a password.
            </h2>
            <p className="mt-4 max-w-2xl text-primary-foreground/80">
              Connect Freighter on Stellar Testnet. Signing in does not transfer funds.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link href="/login">Sign in to Movix</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-9 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <BrandLogo className="h-5 w-auto shrink-0" />
            <span>Procurement settlement on Stellar</span>
          </p>
          <p>Testnet pilot · No production-value assets</p>
        </div>
      </footer>
    </>
  );
}
