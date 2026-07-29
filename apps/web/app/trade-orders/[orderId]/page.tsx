import { redirect } from "next/navigation";

export default async function TradeOrderAliasDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  redirect(`/orders/${orderId}`);
}
