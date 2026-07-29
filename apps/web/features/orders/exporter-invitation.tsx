"use client";

import { api } from "@repo/backend/client";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

function invitationMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "data" in error
      ? String((error as { data?: { code?: string } }).data?.code ?? "")
      : "";
  return (
    {
      EXPORTER_INVITATION_EXPIRED: "This invitation expired. Ask the Importer for a new one.",
      EXPORTER_INVITATION_REVOKED: "This invitation was revoked by the Importer.",
      EXPORTER_INVITATION_USED: "This invitation has already been accepted.",
      EXPORTER_INVITATION_WRONG_ORGANIZATION:
        "This invitation is intended for a different verified Exporter organization.",
      EXPORTER_INVITATION_DUPLICATE:
        "An active invitation already exists for this Exporter. Reuse or revoke it first.",
      ORGANIZATION_VERIFICATION_REQUIRED:
        "Verify the organization before issuing or accepting an invitation.",
    }[code] ?? "The invitation action could not be completed."
  );
}

export function ExporterInvitation() {
  const search = useSearchParams();
  const token = search.get("token");
  const invitation = useQuery(api.exporterInvitations.getByToken, token ? { token } : "skip");
  const issue = useMutation(api.exporterInvitations.issue);
  const accept = useMutation(api.exporterInvitations.accept);
  const [targetWalletAddress, setTargetWalletAddress] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function issueInvitation(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await issue({
        targetWalletAddress: targetWalletAddress || undefined,
        targetEmail: targetEmail || undefined,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1_000,
      });
      setShareUrl(
        `${location.origin}/invitations/exporter?token=${encodeURIComponent(result.token)}`,
      );
    } catch (error) {
      setMessage(invitationMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function acceptInvitation() {
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      await accept({ token });
      setMessage("Invitation accepted. This Importer is now an authorized counterparty.");
    } catch (error) {
      setMessage(invitationMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Known counterparties</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Exporter invitation</h1>
        <p className="mt-2 text-muted-foreground">
          Invitations bind one intended Exporter. Movix does not provide counterparty discovery.
        </p>
      </header>
      {message ? (
        <Alert role="status">
          <AlertTitle>Invitation status</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {token ? (
        <Card>
          <CardHeader>
            <CardTitle>Accept Importer invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invitation === undefined ? (
              <p role="status">Checking invitationâ€¦</p>
            ) : (
              <>
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium capitalize">{invitation.status}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Expires</dt>
                    <dd>{new Date(invitation.expiresAt).toLocaleString()}</dd>
                  </div>
                </dl>
                <Button
                  disabled={busy || invitation.status !== "issued"}
                  onClick={() => void acceptInvitation()}
                >
                  {busy ? "Acceptingâ€¦" : "Accept as this verified Exporter"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Invite the intended Exporter</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={issueInvitation}>
              <div className="space-y-2">
                <Label htmlFor="exporter-wallet">Exporter Stellar wallet</Label>
                <Input
                  id="exporter-wallet"
                  value={targetWalletAddress}
                  onChange={(event) => setTargetWalletAddress(event.target.value.toUpperCase())}
                  placeholder="Gâ€¦"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exporter-email">Exporter business email</Label>
                <Input
                  id="exporter-email"
                  type="email"
                  value={targetEmail}
                  onChange={(event) => setTargetEmail(event.target.value)}
                />
              </div>
              <Button disabled={busy || (!targetWalletAddress && !targetEmail)} type="submit">
                {busy ? "Issuingâ€¦" : "Issue seven-day invitation"}
              </Button>
            </form>
            {shareUrl ? (
              <div className="mt-5 space-y-2" role="status">
                <Label htmlFor="share-invitation">Single-use invitation link</Label>
                <Input id="share-invitation" readOnly value={shareUrl} />
                <p className="text-xs text-muted-foreground">
                  Share this securely. It expires, can be revoked, and cannot be reused.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
