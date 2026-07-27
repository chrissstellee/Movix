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

export type TransitionResult<TState extends string> =
  | { ok: true; state: TState }
  | { ok: false; reason: "invalid_transition" | "terminal_state" };

const agreementTransitions: Partial<
  Record<AgreementState, Partial<Record<AgreementAction, AgreementState>>>
> = {
  draft: { save: "draft", send: "sent", cancel: "cancelled" },
  sent: { accept: "accepted", reject: "rejected", cancel: "cancelled" },
  accepted: { revise: "sent" },
};

export function transitionAgreement(
  state: AgreementState,
  action: AgreementAction,
): TransitionResult<AgreementState> {
  if (state === "rejected" || state === "cancelled") {
    return { ok: false, reason: "terminal_state" };
  }

  const nextState = agreementTransitions[state]?.[action];
  return nextState ? { ok: true, state: nextState } : { ok: false, reason: "invalid_transition" };
}

export const terminalSettlementStates = ["released", "refunded", "cancelled"] as const;

export function isTerminalSettlementState(
  state: SettlementState,
): state is (typeof terminalSettlementStates)[number] {
  return terminalSettlementStates.includes(state as (typeof terminalSettlementStates)[number]);
}
