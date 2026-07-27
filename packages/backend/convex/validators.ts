import { v } from "convex/values";

export const networkValidator = v.literal("testnet");

export const authChallengeStateValidator = v.union(
  v.literal("active"),
  v.literal("superseded"),
  v.literal("consumed"),
);

export const authSessionStateValidator = v.union(
  v.literal("active"),
  v.literal("rotated"),
  v.literal("revoked"),
);

export const userStatusValidator = v.union(
  v.literal("active"),
  v.literal("suspended"),
  v.literal("removed"),
);

export const organizationStatusValidator = v.union(v.literal("active"), v.literal("suspended"));

export const organizationCapabilityValidator = v.union(
  v.literal("buyer"),
  v.literal("supplier"),
  v.literal("buyer_supplier"),
);

export const organizationVerificationStatusValidator = v.union(
  v.literal("unverified"),
  v.literal("pending"),
  v.literal("verified"),
  v.literal("rejected"),
);

export const organizationEntityTypeValidator = v.union(
  v.literal("sole_proprietor"),
  v.literal("partnership"),
  v.literal("corporation"),
  v.literal("limited_company"),
  v.literal("nonprofit"),
  v.literal("government"),
  v.literal("other"),
);

export const contactTypeValidator = v.union(
  v.literal("general"),
  v.literal("procurement"),
  v.literal("accounts_payable"),
  v.literal("sales"),
  v.literal("shipping"),
  v.literal("legal"),
);

export const addressTypeValidator = v.union(
  v.literal("registered"),
  v.literal("billing"),
  v.literal("shipping"),
);

export const onboardingStepValidator = v.union(
  v.literal("identity"),
  v.literal("contact"),
  v.literal("address"),
  v.literal("preferences"),
  v.literal("review"),
);

export const onboardingDraftStatusValidator = v.union(v.literal("draft"), v.literal("completed"));

export const membershipRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("procurement"),
  v.literal("finance"),
  v.literal("operations"),
  v.literal("viewer"),
);

export const membershipStatusValidator = v.union(
  v.literal("active"),
  v.literal("suspended"),
  v.literal("removed"),
);

export const agreementStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

export const fulfillmentStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("shipped"),
  v.literal("delivery_confirmed"),
);

export const settlementStatusValidator = v.union(
  v.literal("unfunded"),
  v.literal("funding_submitted"),
  v.literal("funded"),
  v.literal("acceptance_submitted"),
  v.literal("accepted"),
  v.literal("shipment_submitted"),
  v.literal("shipped"),
  v.literal("release_submitted"),
  v.literal("released"),
  v.literal("refund_pending"),
  v.literal("refund_submitted"),
  v.literal("refunded"),
  v.literal("cancellation_submitted"),
  v.literal("cancelled"),
  v.literal("needs_reconciliation"),
);

export const transactionStatusValidator = v.union(
  v.literal("submitted"),
  v.literal("confirmed"),
  v.literal("failed"),
  v.literal("needs_reconciliation"),
);

export const reconciliationStatusValidator = v.union(
  v.literal("current"),
  v.literal("pending"),
  v.literal("mismatch"),
);

export const commonMutableFields = {
  createdAt: v.number(),
  updatedAt: v.number(),
  version: v.int64(),
};
