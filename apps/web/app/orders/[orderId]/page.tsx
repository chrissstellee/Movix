import { OrderDetail } from "@/features/orders/order-detail";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <WorkspaceShell>
      <OrderDetail orderId={orderId} />
    </WorkspaceShell>
  );
}
