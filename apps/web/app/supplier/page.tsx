import { SupplierDashboard } from "@/features/orders/supplier-dashboard";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";

export default function SupplierPage() {
  return (
    <WorkspaceShell>
      <SupplierDashboard />
    </WorkspaceShell>
  );
}
