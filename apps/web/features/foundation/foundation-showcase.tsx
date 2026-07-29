"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/ui/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useState } from "react";

const testWallet = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export function FoundationShowcase() {
  const [copied, setCopied] = useState(false);

  async function copyWalletAddress() {
    await navigator.clipboard.writeText(testWallet);
    setCopied(true);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-8 p-5 sm:p-10">
      <header className="space-y-3">
        <Badge variant="neutral">Internal review sample</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          Movix design foundation
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Shared primitives, financial states, and accessible interaction patterns for the testnet
          MVP.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Gradient is reserved for the primary intent.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="gradient">Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button disabled>Disabled</Button>
          <Button variant="destructive">Destructive</Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lifecycle states</CardTitle>
            <CardDescription>State never depends on color alone.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge variant="pending">Pending · Funding submitted</Badge>
            <Badge variant="success">Success · Released</Badge>
            <Badge variant="warning">Warning · Refund review</Badge>
            <Badge variant="failure">Failure · Reconciliation needed</Badge>
            <Badge variant="neutral">Neutral · Draft</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business input</CardTitle>
            <CardDescription>
              Help and error text remain programmatically associated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field data-invalid="true">
              <FieldLabel htmlFor="trade-order">Trade Order reference</FieldLabel>
              <Input
                id="trade-order"
                aria-describedby="trade-order-help trade-order-error"
                aria-invalid="true"
                defaultValue="MOVIX-TO-0001"
              />
              <FieldDescription id="trade-order-help">
                Use the Importer’s immutable reference.
              </FieldDescription>
              <FieldError id="trade-order-error">
                This reference already exists for the Importer.
              </FieldError>
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loading</CardTitle>
            <CardDescription>Content shape remains stable while data resolves.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Reconciling transaction
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>

        <Alert>
          <AlertTitle>Testnet only</AlertTitle>
          <AlertDescription>
            Contract IDs, network passphrases, and asset allowlists are validated before use.
          </AlertDescription>
        </Alert>
      </div>

      <Empty>
        <EmptyHeader>
          <EmptyTitle>No transactions yet</EmptyTitle>
          <EmptyDescription>
            Confirmed escrow actions will appear here after the first order is funded.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            type="button"
            variant="outline"
            aria-label={`Copy full wallet address ${testWallet}`}
            onClick={copyWalletAddress}
          >
            <span aria-hidden="true">GAAA…AWHF</span>
            <span className="sr-only">{testWallet}</span>
          </Button>
          <p role="status" className="min-h-5 text-xs text-muted-foreground">
            {copied ? "Wallet address copied" : "Use the control to copy the full value"}
          </p>
        </EmptyContent>
      </Empty>
    </main>
  );
}
