import { deriveEscrowKey } from "@repo/stellar";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireCurrentUser, requireRole } from "./lib/authorization";

const VERIFIED_TESTNET_CONTRACT_ID = "CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5";
const TESTNET_USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const TESTNET_XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export const prepare = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // Must be Importer (buyer) with owner, admin, or finance role
    const authContext = await requireRole(ctx, order.buyerOrganizationId, [
      "owner",
      "admin",
      "finance",
    ]);

    const buyerOrg = authContext.organization;
    if (buyerOrg.verificationStatus !== "verified") {
      throw new Error("Importer organization must be verified to prepare escrow funding");
    }

    if (order.agreementStatus !== "accepted" || !order.acceptedRevisionId) {
      throw new Error("Order must have an accepted trade agreement revision to prepare funding");
    }

    if (order.settlementStatus !== "unfunded") {
      throw new Error(`Order settlement status is ${order.settlementStatus}, expected unfunded`);
    }

    const revision = await ctx.db.get(order.acceptedRevisionId);
    if (!revision) {
      throw new Error("Accepted order revision not found");
    }

    if (!revision.buyerWalletAddressSnapshot || !revision.supplierWalletAddressSnapshot) {
      throw new Error("Both buyer and supplier wallet address snapshots are required");
    }

    if (revision.buyerWalletAddressSnapshot === revision.supplierWalletAddressSnapshot) {
      throw new Error("Buyer and supplier wallets must be distinct");
    }

    if (!revision.fundingDeadline || revision.fundingDeadline <= Date.now()) {
      throw new Error("Funding deadline has expired");
    }

    if (!revision.termsHash) {
      throw new Error("Revision missing terms hash");
    }

    const tokenContractId =
      revision.assetCode === "XLM" ? TESTNET_XLM_SAC : revision.assetContractId || TESTNET_USDC_SAC;

    const { keyHex } = deriveEscrowKey({
      verifiedContractId: VERIFIED_TESTNET_CONTRACT_ID,
      orderId: order._id,
      acceptedRevisionId: revision._id,
    });

    const now = Date.now();
    const existingEscrow = await ctx.db
      .query("escrows")
      .withIndex("by_escrowKey", (q) => q.eq("escrowKey", keyHex))
      .first();

    let escrowId = existingEscrow?._id;

    if (existingEscrow) {
      await ctx.db.patch(existingEscrow._id, {
        updatedAt: now,
        version: (existingEscrow.version ?? 1n) + 1n,
      });
    } else {
      escrowId = await ctx.db.insert("escrows", {
        orderId: order._id,
        escrowKey: keyHex,
        buyerOrganizationId: order.buyerOrganizationId,
        supplierOrganizationId: order.supplierOrganizationId!,
        network: "testnet",
        contractId: VERIFIED_TESTNET_CONTRACT_ID,
        tokenContractId,
        amountBaseUnits: revision.grandTotalBaseUnits,
        status: "unfunded",
        reconciliationStatus: "current",
        acceptedRevisionId: revision._id,
        termsHash: revision.termsHash,
        termsHashVersion: revision.termsHashVersion,
        buyerWalletAddress: revision.buyerWalletAddressSnapshot,
        supplierWalletAddress: revision.supplierWalletAddressSnapshot,
        assetCode: revision.assetCode ?? "USDC",
        feeBps: 0n,
        acceptBy: BigInt(Math.floor(revision.fundingDeadline / 1000)),
        preparedByUserId: authContext.principal.user._id,
        preparedAt: now,
        createdAt: now,
        updatedAt: now,
        version: 1n,
      });
    }

    await ctx.db.insert("auditEvents", {
      entityType: "escrow",
      entityId: escrowId!,
      organizationId: order.buyerOrganizationId,
      actorUserId: authContext.principal.user._id,
      actorWalletAddress: authContext.principal.wallet.address,
      action: "escrow.funding_intent_prepared",
      correlationId: `escrow_prepare_${escrowId}`,
      occurredAt: now,
    });

    return {
      escrowId,
      escrowKey: keyHex,
      contractId: VERIFIED_TESTNET_CONTRACT_ID,
      buyerWalletAddress: revision.buyerWalletAddressSnapshot,
      supplierWalletAddress: revision.supplierWalletAddressSnapshot,
      tokenContractId,
      grandTotalBaseUnits: revision.grandTotalBaseUnits,
      fundingDeadlineMs: revision.fundingDeadline,
      termsHashHex: revision.termsHash,
      assetCode: revision.assetCode ?? "USDC",
    };
  },
});

export const recordSubmission = mutation({
  args: {
    orderId: v.id("orders"),
    escrowKey: v.string(),
    transactionHash: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const authContext = await requireRole(ctx, order.buyerOrganizationId, [
      "owner",
      "admin",
      "finance",
    ]);

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_escrowKey", (q) => q.eq("escrowKey", args.escrowKey))
      .first();

    if (!escrow) {
      throw new Error("Escrow record not found for given key");
    }

    const now = Date.now();

    await ctx.db.patch(escrow._id, {
      status: "funding_submitted",
      reconciliationStatus: "pending",
      submittedTransactionHash: args.transactionHash,
      submittedAt: now,
      updatedAt: now,
      version: (escrow.version ?? 1n) + 1n,
    });

    await ctx.db.patch(order._id, {
      settlementStatus: "funding_submitted",
      updatedAt: now,
      version: (order.version ?? 1n) + 1n,
    });

    await ctx.db.insert("transactionRecords", {
      hash: args.transactionHash,
      network: "testnet",
      orderId: order._id,
      escrowId: escrow._id,
      organizationId: order.buyerOrganizationId,
      action: "escrow.create_and_fund",
      status: "submitted",
      actorUserId: authContext.principal.user._id,
      actorWalletAddress: authContext.principal.wallet.address,
      contractId: escrow.contractId,
      tokenContractId: escrow.tokenContractId,
      amountBaseUnits: escrow.amountBaseUnits,
      submittedAt: now,
    });

    await ctx.db.insert("auditEvents", {
      entityType: "escrow",
      entityId: escrow._id,
      organizationId: order.buyerOrganizationId,
      actorUserId: authContext.principal.user._id,
      actorWalletAddress: authContext.principal.wallet.address,
      action: "escrow.funding_submitted",
      correlationId: `escrow_submit_${args.transactionHash}`,
      occurredAt: now,
    });

    return { success: true };
  },
});

export const getForOrder = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const principal = await requireCurrentUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      return null;
    }

    const userMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", principal.user._id).eq("status", "active"),
      )
      .collect();

    // Participant authorization
    const isBuyer = userMemberships.some((m) => m.organizationId === order.buyerOrganizationId);
    const isSupplier =
      order.supplierOrganizationId &&
      userMemberships.some((m) => m.organizationId === order.supplierOrganizationId);

    if (!isBuyer && !isSupplier) {
      return null;
    }

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first();

    if (!escrow) {
      return null;
    }

    return {
      _id: escrow._id,
      escrowKey: escrow.escrowKey,
      status: escrow.status,
      reconciliationStatus: escrow.reconciliationStatus,
      submittedTransactionHash: escrow.submittedTransactionHash,
      confirmedLedger: escrow.confirmedLedger,
      contractId: escrow.contractId,
      tokenContractId: escrow.tokenContractId,
      amountBaseUnits: escrow.amountBaseUnits,
      assetCode: escrow.assetCode,
      buyerWalletAddress: escrow.buyerWalletAddress,
      supplierWalletAddress: escrow.supplierWalletAddress,
      termsHash: escrow.termsHash,
      acceptBy: escrow.acceptBy,
      confirmedAt: escrow.confirmedAt,
      lastReconciledAt: escrow.lastReconciledAt,
      mismatchFields: escrow.mismatchFields,
    };
  },
});
