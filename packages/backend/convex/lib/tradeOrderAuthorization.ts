import { getSingleActiveOrganizationContext } from "./authorization";
import { businessError } from "./errors";
import { requireVerifiedOrganization } from "./verification";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type TradeCtx = QueryCtx | MutationCtx;

export async function requireTradeOrderParticipant(
  ctx: TradeCtx,
  orderId: Id<"orders">,
  options?: { verified?: boolean },
) {
  const context = await getSingleActiveOrganizationContext(ctx);
  if (context.kind !== "single") throw businessError("TRADE_DOCUMENT_FORBIDDEN");
  const order = await ctx.db.get("orders", orderId);
  const side =
    order?.buyerOrganizationId === context.organization._id
      ? ("importer" as const)
      : order?.supplierOrganizationId === context.organization._id
        ? ("exporter" as const)
        : null;
  if (!order || !side) throw businessError("TRADE_DOCUMENT_FORBIDDEN");
  if (options?.verified) requireVerifiedOrganization(context.organization);
  return { ...context, order, side };
}
