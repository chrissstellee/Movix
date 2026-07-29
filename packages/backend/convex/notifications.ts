import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getSingleActiveOrganizationContext } from "./lib/authorization";
import { businessError } from "./lib/errors";

const notificationValidator = v.object({
  id: v.id("notifications"),
  eventType: v.string(),
  entityType: v.string(),
  entityId: v.string(),
  actionUrl: v.string(),
  status: v.union(v.literal("unread"), v.literal("read")),
  createdAt: v.number(),
  readAt: v.optional(v.number()),
});

async function currentOrganization(ctx: Parameters<typeof getSingleActiveOrganizationContext>[0]) {
  const context = await getSingleActiveOrganizationContext(ctx);
  if (context.kind !== "single") {
    throw businessError(
      context.kind === "multiple" ? "MULTIPLE_ORGANIZATIONS_UNSUPPORTED" : "ORGANIZATION_FORBIDDEN",
    );
  }
  return context;
}

export const listCurrentOrganization = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.union(v.literal("unread"), v.literal("read"))),
  },
  returns: paginationResultValidator(notificationValidator),
  handler: async (ctx, args) => {
    const context = await currentOrganization(ctx);
    const result = args.status
      ? await ctx.db
          .query("notifications")
          .withIndex("by_recipientOrganizationId_and_status", (index) =>
            index
              .eq("recipientOrganizationId", context.organization._id)
              .eq("status", args.status!),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("notifications")
          .withIndex("by_recipientOrganizationId_and_createdAt", (index) =>
            index.eq("recipientOrganizationId", context.organization._id),
          )
          .order("desc")
          .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((item) => ({
        id: item._id,
        eventType: item.eventType,
        entityType: item.entityType,
        entityId: item.entityId,
        actionUrl: item.actionUrl,
        status: item.status,
        createdAt: item.createdAt,
        ...(item.readAt !== undefined ? { readAt: item.readAt } : {}),
      })),
    };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.object({ notificationId: v.id("notifications"), status: v.literal("read") }),
  handler: async (ctx, args) => {
    const context = await currentOrganization(ctx);
    const notification = await ctx.db.get("notifications", args.notificationId);
    if (!notification || notification.recipientOrganizationId !== context.organization._id) {
      throw businessError("ORDER_NOT_FOUND");
    }
    if (notification.status === "unread") {
      await ctx.db.patch("notifications", notification._id, {
        status: "read",
        readAt: Date.now(),
      });
    }
    return { notificationId: notification._id, status: "read" as const };
  },
});
