import { isFundingEligible, roleCan } from "@repo/domain";
import { v } from "convex/values";

import { query } from "./_generated/server";
import { getSingleActiveOrganizationContext } from "./lib/authorization";
import { businessError } from "./lib/errors";
import { publicLine, publicRevision } from "./orderDrafts";
import { orderDetailValidator } from "./orderValidators";

import type { Doc } from "./_generated/dataModel";

function mapDecision(decision: Doc<"orderRevisionDecisions"> | null) {
  if (!decision) return undefined;
  return {
    id: decision._id,
    decision: decision.decision,
    revisionId: decision.revisionId,
    revisionNumber: decision.revisionNumber,
    termsHash: decision.termsHash,
    ...(decision.reasonCode ? { reasonCode: decision.reasonCode } : {}),
    ...(decision.reasonNote ? { reasonNote: decision.reasonNote } : {}),
    actorWalletAddress: decision.actorWalletAddress,
    decidedAt: decision.decidedAt,
  };
}

function mapSupplierLine(line: Doc<"orderLines">) {
  return {
    ...publicLine(line),
    ...(line.category ? { category: line.category } : {}),
    ...(line.manufacturer ? { manufacturer: line.manufacturer } : {}),
    ...(line.brand ? { brand: line.brand } : {}),
    ...(line.origin ? { origin: line.origin } : {}),
  };
}

function mapSupplierRevision(revision: Doc<"orderRevisions">) {
  if (
    !revision.supplierOrganizationId ||
    !revision.supplierLegalNameSnapshot ||
    !revision.buyerContactSnapshot ||
    !revision.supplierContactSnapshot ||
    !revision.billingAddressSnapshot ||
    !revision.shippingAddressSnapshot ||
    !revision.purchaseOrderNumber ||
    !revision.title ||
    !revision.timezone ||
    !revision.orderDate ||
    !revision.issueDate ||
    !revision.requestedDeliveryDate ||
    revision.supplierAcceptanceDeadline === undefined ||
    revision.fundingDeadline === undefined ||
    !revision.assetKey ||
    !revision.assetCode ||
    !revision.assetContractId ||
    revision.assetDecimals === undefined ||
    !revision.deliveryMethod ||
    !revision.shippingResponsibility ||
    !revision.freightChargeTreatment ||
    revision.inspectionPeriodHours === undefined ||
    !revision.refundPolicy ||
    !revision.frozenAt ||
    !revision.termsHash
  ) {
    throw businessError("ORDER_NOT_AWAITING_DECISION");
  }
  return {
    id: revision._id,
    version: revision.version,
    revisionNumber: revision.revisionNumber,
    supplierOrganizationId: revision.supplierOrganizationId,
    buyerLegalName: revision.buyerLegalNameSnapshot,
    ...(revision.buyerTradingNameSnapshot
      ? { buyerTradingName: revision.buyerTradingNameSnapshot }
      : {}),
    supplierLegalName: revision.supplierLegalNameSnapshot,
    ...(revision.supplierTradingNameSnapshot
      ? { supplierTradingName: revision.supplierTradingNameSnapshot }
      : {}),
    buyerContact: revision.buyerContactSnapshot,
    supplierContact: revision.supplierContactSnapshot,
    billingAddress: revision.billingAddressSnapshot,
    shippingAddress: revision.shippingAddressSnapshot,
    purchaseOrderNumber: revision.purchaseOrderNumber,
    title: revision.title,
    ...(revision.description ? { description: revision.description } : {}),
    ...(revision.buyerReference ? { buyerReference: revision.buyerReference } : {}),
    ...(revision.supplierReference ? { supplierReference: revision.supplierReference } : {}),
    timezone: revision.timezone,
    orderDate: revision.orderDate,
    issueDate: revision.issueDate,
    requestedDeliveryDate: revision.requestedDeliveryDate,
    supplierAcceptanceDeadline: revision.supplierAcceptanceDeadline,
    fundingDeadline: revision.fundingDeadline,
    asset: {
      key: revision.assetKey,
      code: revision.assetCode,
      issuer: revision.assetIssuer ?? null,
      contractId: revision.assetContractId,
      decimals: revision.assetDecimals,
      network: "testnet" as const,
    },
    deliveryMethod: revision.deliveryMethod,
    shippingResponsibility: revision.shippingResponsibility,
    freightChargeTreatment: revision.freightChargeTreatment,
    inspectionPeriodHours: revision.inspectionPeriodHours,
    refundPolicy: revision.refundPolicy,
    ...(revision.deliveryWindow ? { deliveryWindow: revision.deliveryWindow } : {}),
    ...(revision.incoterm ? { incoterm: revision.incoterm } : {}),
    ...(revision.namedLocation ? { namedLocation: revision.namedLocation } : {}),
    ...(revision.handlingInstructions
      ? { handlingInstructions: revision.handlingInstructions }
      : {}),
    ...(revision.acceptanceCriteria ? { acceptanceCriteria: revision.acceptanceCriteria } : {}),
    ...(revision.warrantyText ? { warrantyText: revision.warrantyText } : {}),
    ...(revision.returnTerms ? { returnTerms: revision.returnTerms } : {}),
    ...(revision.sharedNotes ? { sharedNotes: revision.sharedNotes } : {}),
    totals: {
      subtotalBaseUnits: revision.subtotalBaseUnits,
      discountTotalBaseUnits: revision.discountTotalBaseUnits,
      taxTotalBaseUnits: revision.taxTotalBaseUnits,
      shippingTotalBaseUnits: revision.shippingTotalBaseUnits,
      grandTotalBaseUnits: revision.grandTotalBaseUnits,
    },
    frozenAt: revision.frozenAt,
    termsHash: revision.termsHash,
  };
}

export const get = query({
  args: { orderId: v.id("orders") },
  returns: orderDetailValidator,
  handler: async (ctx, args) => {
    const context = await getSingleActiveOrganizationContext(ctx);
    if (context.kind !== "single") {
      throw businessError(
        context.kind === "multiple"
          ? "MULTIPLE_ORGANIZATIONS_UNSUPPORTED"
          : "ORGANIZATION_FORBIDDEN",
      );
    }
    const order = await ctx.db.get("orders", args.orderId);
    const isBuyer =
      order?.buyerOrganizationId === context.organization._id &&
      ["buyer", "buyer_supplier"].includes(context.organization.capability);
    const isSupplier =
      order?.supplierOrganizationId === context.organization._id &&
      ["supplier", "buyer_supplier"].includes(context.organization.capability) &&
      context.organization.verificationStatus === "verified";
    if (!order || (!isBuyer && !isSupplier) || !order.currentRevisionId) {
      throw businessError("ORDER_NOT_FOUND");
    }
    const [currentRevision, currentDecision] = await Promise.all([
      ctx.db.get("orderRevisions", order.currentRevisionId),
      order.currentDecisionId
        ? ctx.db.get("orderRevisionDecisions", order.currentDecisionId)
        : Promise.resolve(null),
    ]);
    if (!currentRevision) throw businessError("ORDER_NOT_FOUND");
    let projectionRevision = currentRevision;
    if (isSupplier && !currentRevision.frozenAt) {
      const recentRevisions = await ctx.db
        .query("orderRevisions")
        .withIndex("by_orderId_revisionNumber", (index) => index.eq("orderId", order._id))
        .order("desc")
        .take(2);
      const priorFrozenRevision = recentRevisions.find(
        (candidate) => candidate._id !== currentRevision._id && candidate.frozenAt,
      );
      if (!priorFrozenRevision) throw businessError("ORDER_NOT_FOUND");
      projectionRevision = priorFrozenRevision;
    }
    const [lines, projectionDecision] = await Promise.all([
      ctx.db
        .query("orderLines")
        .withIndex("by_revisionId", (index) => index.eq("revisionId", projectionRevision._id))
        .take(101),
      projectionRevision._id === currentRevision._id
        ? Promise.resolve(currentDecision)
        : ctx.db
            .query("orderRevisionDecisions")
            .withIndex("by_revisionId", (index) => index.eq("revisionId", projectionRevision._id))
            .unique(),
    ]);
    if (lines.length > 100) throw businessError("ORDER_NOT_FOUND");
    const fundingEligible = isFundingEligible({
      agreementStatus: order.agreementStatus,
      settlementStatus: order.settlementStatus,
      currentRevisionId: order.currentRevisionId,
      acceptedRevisionId: order.acceptedRevisionId,
      decision: currentDecision?.decision,
      decisionRevisionId: currentDecision?.revisionId,
      decisionTermsHash: currentDecision?.termsHash,
      currentTermsHash: currentRevision.termsHash,
    });
    const mappedOrder = {
      id: order._id,
      agreementStatus: order.agreementStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      settlementStatus: order.settlementStatus,
      ...(order.supplierQueueState ? { supplierQueueState: order.supplierQueueState } : {}),
      version: order.version,
      fundingEligible,
    };
    const sortedLines = lines.sort((a, b) => Number(a.lineNumber - b.lineNumber));
    if (isSupplier) {
      return {
        viewerSide: "supplier" as const,
        order: mappedOrder,
        revision: mapSupplierRevision(projectionRevision),
        lines: sortedLines.map(mapSupplierLine),
        ...(projectionDecision ? { decision: mapDecision(projectionDecision) } : {}),
        canDecide:
          order.agreementStatus === "sent" &&
          order.supplierQueueState === "requires_decision" &&
          roleCan(context.membership.role, "order:decide"),
        offChainNotice:
          "Acceptance records an off-chain agreement decision and moves no funds." as const,
      };
    }
    return {
      viewerSide: "buyer" as const,
      order: mappedOrder,
      revision: publicRevision(currentRevision),
      lines: sortedLines.map(publicLine),
      ...(currentDecision ? { decision: mapDecision(currentDecision) } : {}),
    };
  },
});
