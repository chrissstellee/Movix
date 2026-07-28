import { OrderCreate } from "@/features/orders/order-create";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";

export default function NewOrderPage() {
  return (
    <WorkspaceShell>
      <OrderCreate />
    </WorkspaceShell>
  );
}
