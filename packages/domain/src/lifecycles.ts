export const agreementStates = ["draft", "sent", "accepted", "rejected", "cancelled"] as const;
export type AgreementState = (typeof agreementStates)[number];

export const agreementActions = ["save", "send", "accept", "reject", "cancel", "revise"] as const;
export type AgreementAction = (typeof agreementActions)[number];

export const fulfillmentStates = ["not_started", "shipped", "delivery_confirmed"] as const;
export type FulfillmentState = (typeof fulfillmentStates)[number];

export const settlementStates = [
  "unfunded",
  "funding_submitted",
  "funded",
  "acceptance_submitted",
  "accepted",
  "shipment_submitted",
  "shipped",
  "release_submitted",
  "released",
  "refund_pending",
  "refund_submitted",
  "refunded",
  "cancellation_submitted",
  "cancelled",
  "needs_reconciliation",
] as const;
export type SettlementState = (typeof settlementStates)[number];

export const supplierQueueStates = [
  "not_queued",
  "requires_decision",
  "expired",
  "accepted",
  "rejected",
] as const;
export type SupplierQueueState = (typeof supplierQueueStates)[number];

export const orderDecisionTypes = ["accepted", "rejected"] as const;
export type OrderDecisionType = (typeof orderDecisionTypes)[number];

export const rejectionReasonCodes = [
  "pricing_or_totals",
  "quantity_or_availability",
  "delivery_schedule",
  "commercial_terms",
  "supplier_capacity",
  "other",
] as const;
export type RejectionReasonCode = (typeof rejectionReasonCodes)[number];

export const refundReasonCodes = [
  "DAMAGED_GOODS",
  "LOGISTICS_DELAY",
  "SPEC_MISMATCH",
  "MUTUAL_AGREEMENT",
  "OTHER",
] as const;
export type RefundReasonCode = (typeof refundReasonCodes)[number];

export const orderTimelineEventTypes = [
  "order_draft_created",
  "revision_sent",
  "revision_accepted",
  "revision_rejected",
  "revision_superseded",
  "revision_started",
  "order_cancelled",
] as const;
export type OrderTimelineEventType = (typeof orderTimelineEventTypes)[number];

export type TransitionResult<TState extends string> =
  | { ok: true; state: TState }
  | { ok: false; reason: "invalid_transition" | "terminal_state" };

const agreementTransitions: Partial<
  Record<AgreementState, Partial<Record<AgreementAction, AgreementState>>>
> = {
  draft: { save: "draft", send: "sent", cancel: "cancelled" },
  sent: { accept: "accepted", reject: "rejected", cancel: "cancelled" },
  accepted: { revise: "draft" },
  rejected: { revise: "draft" },
};

export function transitionAgreement(
  state: AgreementState,
  action: AgreementAction,
): TransitionResult<AgreementState> {
  if (state === "cancelled") {
    return { ok: false, reason: "terminal_state" };
  }

  const nextState = agreementTransitions[state]?.[action];
  return nextState ? { ok: true, state: nextState } : { ok: false, reason: "invalid_transition" };
}

export function normalizeRejectionNote(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (normalized.length > 500 || /[\p{Cc}\p{Cf}]/u.test(normalized)) {
    throw new Error("ORDER_DECISION_REASON_INVALID");
  }
  return normalized;
}

export function isFundingEligible(input: {
  agreementStatus: AgreementState;
  settlementStatus: SettlementState;
  currentRevisionId?: string;
  acceptedRevisionId?: string;
  decision?: OrderDecisionType;
  decisionRevisionId?: string;
  decisionTermsHash?: string;
  currentTermsHash?: string;
}): boolean {
  return Boolean(
    input.agreementStatus === "accepted" &&
    input.settlementStatus === "unfunded" &&
    input.currentRevisionId &&
    input.currentRevisionId === input.acceptedRevisionId &&
    input.decision === "accepted" &&
    input.decisionRevisionId === input.currentRevisionId &&
    input.decisionTermsHash &&
    input.decisionTermsHash === input.currentTermsHash,
  );
}

export const terminalSettlementStates = ["released", "refunded", "cancelled"] as const;

export function isTerminalSettlementState(
  state: SettlementState,
): state is (typeof terminalSettlementStates)[number] {
  return terminalSettlementStates.includes(state as (typeof terminalSettlementStates)[number]);
}
