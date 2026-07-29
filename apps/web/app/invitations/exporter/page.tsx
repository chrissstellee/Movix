import { ExporterInvitation } from "@/features/orders/exporter-invitation";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";
import { Suspense } from "react";

export default function ExporterInvitationPage() {
  return (
    <WorkspaceShell>
      <Suspense fallback={<p role="status">Loading invitationâ€¦</p>}>
        <ExporterInvitation />
      </Suspense>
    </WorkspaceShell>
  );
}
