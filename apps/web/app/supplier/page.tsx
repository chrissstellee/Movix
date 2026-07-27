import { WorkspaceHome } from "@/features/workspace/workspace-home";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";

export default function SupplierPage() {
  return (
    <WorkspaceShell>
      <WorkspaceHome view="Supplier" />
    </WorkspaceShell>
  );
}
