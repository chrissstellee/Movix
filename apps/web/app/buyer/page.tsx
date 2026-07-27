import { WorkspaceHome } from "@/features/workspace/workspace-home";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";

export default function BuyerPage() {
  return (
    <WorkspaceShell>
      <WorkspaceHome view="Buyer" />
    </WorkspaceShell>
  );
}
