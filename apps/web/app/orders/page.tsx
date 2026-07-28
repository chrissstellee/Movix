import { OrderList } from "@/features/orders/order-list";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";

export default function OrdersPage() {
  return (
    <WorkspaceShell>
      <OrderList />
    </WorkspaceShell>
  );
}
