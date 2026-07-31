# Movix Sprint 9 — Mutual Refunds and Unaccepted Timeout Cancellation

> Status: Implementation-ready  
> Duration: 2 weeks  
> Primary implementer: Elliot  
> Target: Stellar Testnet only  
> Primary surface: Refund & Cancellation panels on `/orders/[orderId]` and `/trade-orders/[orderId]`  
> Sprint authority: [Movix Sprint Plan](./Movix-Sprint-Plan.md)  
> Product authority: [Movix ASEAN Agricultural Trade Pivot](./Movix-ASEAN-Agricultural-Trade-Pivot.md)  
> Architecture authority: [Agricultural Trade Architecture and Sprint 6 Migration](./agricultural-trade-architecture-and-migration.md)  
> Contract authority: [Escrow v1 ABI](./contracts/escrow-v1/abi.md) and [deployment manifest](../deployments/stellar/testnet/escrow-v1.json)  
> Preceding sprint: [Sprint 8 Fulfillment & Release](./Movix-Sprint-08-Fulfillment-Release-Detailed.md)  

---

## 1. Sprint goal

Deliver controlled, auditable, two-party exception and recovery paths for funded ASEAN agricultural trade escrows on Stellar Testnet without enabling unilateral fund movement after seller acceptance.

Sprint 9 completes the risk-mitigation promise of Movix: **either party (Importer or Exporter) can propose a full mutual refund during an active trade state (`Funded`, `Accepted`, `Shipped`), but funds are returned to the Importer if and only if the opposite party approves the matching terms. Additionally, if an Exporter fails to accept a funded escrow before the contract deadline (`accept_by`), the Importer can safely cancel and recover 100% of the locked tokens.**

---

## 2. Demo scenarios

Using two distinct authenticated and verified QA organizations (Importer and Exporter):

1. **Importer-Initiated Mutual Refund**:
   - Importer opens an `Accepted` or `Shipped` Trade Order.
   - Importer clicks "Request Mutual Refund", enters a structured reason (e.g. "Cargo damaged in transit; agreed full return"), and confirms the 32-byte `refund_terms_hash`.
   - Importer signs `propose_refund(id, buyer, refund_terms_hash)`.
   - Status moves on-chain to `RefundPending` (preserving prior active status in `resume_status`).
   - Exporter reviews the refund request in their portal and signs `approve_refund(id, supplier, refund_terms_hash)`.
   - Escrow status moves on-chain to `Refunded`. 100% of tokens (gross amount) return directly to the Importer's wallet address.

2. **Exporter-Initiated Mutual Refund**:
   - Exporter encounters a supply failure post-`Funded` or `Accepted` and proposes a mutual refund via `propose_refund(id, supplier, refund_terms_hash)`.
   - Importer reviews and approves via `approve_refund(id, buyer, refund_terms_hash)`.
   - Escrow status transitions on-chain to `Refunded` and tokens return to the Importer.

3. **Refund Rejection & Restoration**:
   - Importer proposes a refund.
   - Exporter reviews the terms, disagrees, and signs `reject_refund(id, supplier, refund_terms_hash)`.
   - On-chain status is restored to the exact prior active state (`Funded`, `Accepted`, or `Shipped`). Trade continues.

4. **Refund Withdrawal**:
   - Proposer changes their mind before the counterparty acts and signs `withdraw_refund(id, proposer, refund_terms_hash)`.
   - On-chain status is restored to the exact prior active state.

5. **Unaccepted Timeout Cancellation**:
   - Importer funds an escrow with `accept_by` set to $T$.
   - Exporter fails to sign `accept` before ledger timestamp $T$ ($now \ge accept\_by$).
   - Importer clicks "Cancel Unaccepted Escrow" and signs `cancel_unaccepted(id, buyer)`.
   - On-chain status moves to `Cancelled` and 100% of tokens return to the Importer.

---

## 3. Outcome and success measures

Sprint 9 is successful when:

- 100% of mutual refund requests require explicit counterparty approval of matching term hashes before token movement occurs;
- 0% of unilateral refund requests result in fund transfer;
- Rejection or withdrawal of a refund proposal cleanly restores the prior active contract state (`Funded`, `Accepted`, `Shipped`) without corrupting state or losing contract history;
- Importers can reliably cancel expired, unaccepted escrows after $now \ge accept\_by$ with 100% gross token return;
- Concurrency control prevents settlement (`confirm_delivery`) and refund approval (`approve_refund`) from both succeeding on the same escrow;
- All P0 acceptance criteria and automated test gates pass across unit, backend, Playwright, and Soroban integration suites.

---

## 4. Entry gates

Sprint 9 implementation may begin once Sprint 8 fulfillment and release flows are verified on Testnet.

### 4.1 Prerequisites & contract ABI verification

- [ ] Escrow contract v1 ABI functions verified:
  - `propose_refund(id: BytesN<32>, proposer: Address, refund_terms_hash: BytesN<32>) -> Escrow`
  - `approve_refund(id: BytesN<32>, approver: Address, refund_terms_hash: BytesN<32>) -> Escrow`
  - `reject_refund(id: BytesN<32>, approver: Address, refund_terms_hash: BytesN<32>) -> Escrow`
  - `withdraw_refund(id: BytesN<32>, proposer: Address, refund_terms_hash: BytesN<32>) -> Escrow`
  - `cancel_unaccepted(id: BytesN<32>, buyer: Address) -> Escrow`
- [ ] Contract states verified: `RefundPending`, `Refunded` (terminal), `Cancelled` (terminal).
- [ ] Escrow contract liability invariant verified: `Refunded` and `Cancelled` reduce contract liability by `gross_amount` exactly once.

---

## 5. Product decisions for Sprint 9

| Decision | Sprint 9 Rule |
|---|---|
| **Mutual Consent Principle** | Post-acceptance funds can NEVER be moved to the Importer unilaterally. Mutual refund requires proposal by Party A and approval by Party B with identical `refund_terms_hash`. |
| **Active States Eligible** | Refund proposals are allowed only from `Funded`, `Accepted`, or `Shipped` states. |
| **Proposer Roles** | Either Importer (`buyer`) or Exporter (`supplier`) organization members with `owner`, `admin`, or `operations`/`finance` capabilities can propose a refund. |
| **Approver Roles** | `approve_refund` and `reject_refund` MUST be signed by the opposite party (counterparty) relative to `refund_proposer`. |
| **Refund Terms Hash** | Off-chain payload contains structured reason code, free-text explanation, request timestamp, and order ID. SHA-256 digest produces `refund_terms_hash`. |
| **Timeout Cancellation** | Importer can invoke `cancel_unaccepted` ONLY when status is `Funded` and Soroban ledger time $now \ge accept\_by$. If status is `Accepted`, `Shipped`, or `RefundPending`, `cancel_unaccepted` MUST fail. |
| **Terminal Refund Payout** | Approved refunds return 100% of `gross_amount` to the Importer (`buyer`) wallet address. No platform fee is charged (`max_fee_bps = 0`). |
| **No Contract Changes** | The Soroban smart contract is frozen. No Rust changes are permitted. All logic builds on the existing deployed v1 ABI. |

---

## 6. Scope detail

### 6.1 In Scope

- Backend Convex schema extensions & mutations for refund intent creation, terms hash derivation, rejection logging, and proposal state tracking;
- Frontend Mutual Refund UI components on `/orders/[orderId]` (Request Modal, Pending Banner, Approve/Reject Action Cards, Withdraw Button);
- Frontend Timeout Cancellation UI component for Importers on expired `Funded` escrows;
- Soroban transaction orchestration, simulation, signing, and RPC submission for all 5 exception entry points;
- Event indexing & Convex getter polling reconciliation for `RefundPending`, `Refunded`, and `Cancelled` state transitions;
- Deep-linked transactional notifications alerting counterparties of refund proposals, approvals, rejections, and withdrawals;
- Comprehensive automated testing: contract unit tests, Convex authorization tests, Playwright E2E refund/cancellation journeys, and race condition / concurrency tests.

### 6.2 Not in Scope

- Partial refunds (v1 supports full gross refunds only);
- Third-party arbitration / dispute resolution panel (deferred to future protocol versions);
- Automatic timeout refunds post-shipment (v1 requires explicit mutual approval or release);
- Mainnet deployment.

---

## 7. Backlog traceability

Sprint 9 execution items use the prefix `S9-RF` (Refund & Exception Handling), mapping to Sprint Plan backlog items `S8-01` through `S8-08`.

| Execution ID | Roadmap ID | Priority | Discipline | Deliverable Summary |
|---|---|---|---|---|
| **S9-RF01** | S8-01 | P0 | Backend, Web, Stellar | Mutual refund proposal payload generator (`refund_terms_hash`) & `propose_refund` workflow |
| **S9-RF02** | S8-02 | P0 | Web, Stellar | Counterparty refund review, simulation, signing, & `approve_refund` execution UI |
| **S9-RF03** | S8-03 | P0 | Web, Stellar, Backend | Counterparty refund review & `reject_refund` execution UI with off-chain reason logging |
| **S9-RF04** | S8-04 | P0 | Web, Stellar, Backend | Proposer refund `withdraw_refund` execution UI |
| **S9-RF05** | S8-05 | P0 | Web, Stellar, Backend | Importer `cancel_unaccepted` timeout cancellation workflow after `accept_by` |
| **S9-RF06** | S8-06 | P0 | Design, Web | Role-aware exception status banner, active action card, & milestone timeline updates |
| **S9-RF07** | S8-07 | P0 | Backend, Stellar | Soroban event ingestion & Convex getter reconciliation for `RefundPending`, `Refunded`, & `Cancelled` |
| **S9-RF08** | S8-08 | P0 | Backend, Stellar, QA | Race-condition protection & concurrency testing (Release vs Refund, Approve vs Withdraw) |
| **S9-RF09** | S8-07 | P0 | Backend, Web | Durable deep-linked transactional notifications for refund proposals, approvals, rejections, & cancellations |
| **S9-RF10** | S8-07 | P0 | Web, Backend | Session recovery & transaction finality tracking for interrupted refund/cancellation submissions |
| **S9-RF11** | S8-08 | P0 | QA, Web | Full Playwright E2E, Convex auth, and Soroban integration test suite for Sprint 9 |

---

## 8. Detailed stories and acceptance criteria

### S9-RF01 — Mutual Refund Proposal (`propose_refund`)

**User Story:** As an Importer or Exporter, I can propose a full mutual refund for an active funded escrow by specifying structured reasons and signing a Soroban transaction.

**Implementation Details:**
- Backend function `packages/backend/convex/refunds.ts`: `prepareRefundProposalIntent`.
- Verification:
  - Order status MUST be `funded`, `accepted`, or `shipped`.
  - Caller MUST belong to either the Importer or Exporter organization and have `escrow:refund` capability.
  - No existing active `RefundPending` state exists for this escrow.
- Off-Chain Payload & Hash Derivation:
  - Form fields: `reasonCode` (`DAMAGED_GOODS`, `LOGISTICS_DELAY`, `SPEC_MISMATCH`, `MUTUAL_AGREEMENT`, `OTHER`), `explanation` (string), `requestedBy` (`BUYER` | `SUPPLIER`).
  - Compute `refund_terms_hash` = SHA-256 over canonical JSON string of proposal payload.
- Frontend Orchestration:
  - `RefundProposalModal` displays order details, gross refund amount, and warning that counterparty approval is required.
  - Wallet signs `propose_refund(id, proposer, refund_terms_hash)`.
  - On RPC confirmation, Convex updates order projection to `refund_pending`, recording `refundProposer`, `refundTermsHash`, and `resumeStatus`.

**Acceptance Criteria:**
- Unauthenticated users or non-party organizations receive authorization denial.
- Proposal cannot be created if order status is `draft`, `released`, `refunded`, or `cancelled`.
- Simulation failure (e.g. hash error or invalid state) prevents wallet prompt and reports diagnostic message.
- Counterparty receives an immediate action-required notification.

---

### S9-RF02 — Counterparty Refund Approval (`approve_refund`)

**User Story:** As the counterparty of a refund proposal, I can review the proposed terms and sign the approval transaction to return 100% of escrow funds to the Importer.

**Implementation Details:**
- Component `RefundApprovalCard` on `/orders/[orderId]` (visible ONLY to the counterparty when status is `RefundPending`).
- Verification:
  - Active user MUST belong to the counterparty organization (if `refund_proposer` is Importer, user MUST be Exporter; vice versa).
  - Client retrieves stored `refund_terms_hash` from order record.
- Execution:
  - Display proposed reason, explanation, gross refund amount (e.g. 500 USDC), and destination wallet (Importer wallet).
  - Simulate `approve_refund(id, approver, refund_terms_hash)`.
  - Wallet signs via Stellar Wallets Kit.
  - RPC finality updates on-chain state to `Refunded`.
  - Token transfer of 100% gross amount to Importer is executed atomically by Soroban SAC contract.

**Acceptance Criteria:**
- Only the exact opposite party can sign `approve_refund`. Proposer attempting self-approval is rejected on-chain (`EscrowProposerCannotApprove`).
- If `refund_terms_hash` does not match the on-chain proposal hash, transaction fails with `RefundHashMismatch`.
- Successful approval updates order status to `refunded`, reduces contract liability to 0, and issues a settlement receipt for both parties.

---

### S9-RF03 — Counterparty Refund Rejection (`reject_refund`)

**User Story:** As the counterparty of a refund proposal, I can reject the proposed refund terms, restoring the escrow to its prior active state so fulfillment or release can proceed.

**Implementation Details:**
- UI action "Reject Refund Request" inside `RefundApprovalCard`.
- Collect optional off-chain rejection reason for audit log.
- Execute `EscrowContractClient.reject_refund({ id, approver, refund_terms_hash })`.
- On finality, Soroban contract restores escrow status to `resume_status` (`Funded`, `Accepted`, or `Shipped`).
- Backend clears pending refund fields and notifies proposer that request was rejected.

**Acceptance Criteria:**
- Only the counterparty can sign `reject_refund`.
- Must match stored `refund_terms_hash`.
- Restored state matches `resume_status` exactly. No token movement occurs.

---

### S9-RF04 — Proposer Refund Withdrawal (`withdraw_refund`)

**User Story:** As the proposer of a refund request, I can withdraw my proposal before the counterparty approves or rejects it.

**Implementation Details:**
- UI action "Withdraw Refund Request" on `RefundPendingBanner` (visible ONLY to the proposer).
- Execute `EscrowContractClient.withdraw_refund({ id, proposer, refund_terms_hash })`.
- Soroban contract validates `proposer` matches stored `refund_proposer` and restores state to `resume_status`.
- Pending refund fields cleared; counterparty notification updated.

**Acceptance Criteria:**
- Only the original proposer can sign `withdraw_refund`. Counterparty attempt fails on-chain.
- Restores prior active status cleanly.

---

### S9-RF05 — Timeout Cancellation (`cancel_unaccepted`)

**User Story:** As an Importer, I can cancel a funded escrow and reclaim 100% of locked tokens if the Exporter fails to sign `accept` before the deadline.

**Implementation Details:**
- Backend query `checkCancellationEligibility`:
  - Order status MUST be `funded` (escrow status `Funded`).
  - Soroban ledger timestamp $now \ge accept\_by$.
  - Caller MUST belong to Importer organization.
- UI: Component `TimeoutCancellationCard` appears on `/orders/[orderId]` when deadline has expired.
- Execute `EscrowContractClient.cancel_unaccepted({ id, buyer })`.
- Soroban transfers 100% gross tokens back to Importer wallet, reduces contract liability to 0, and sets state to `Cancelled`.

**Acceptance Criteria:**
- Cannot be invoked if $now < accept\_by$ (fails on-chain with `EscrowAcceptanceDeadlineNotReached`).
- Cannot be invoked if status is `Accepted`, `Shipped`, `RefundPending`, `Released`, `Refunded`, or `Cancelled`.
- Only Importer (`buyer`) address can sign `cancel_unaccepted`.
- Full refund of tokens to Importer wallet confirmed.

---

### S9-RF06 — Exception UI & Milestone Banner

**User Story:** As a user, I see clear, role-aware banners and step progress explaining the current exception state and who must act next.

**Implementation Details:**
- Extend `TradeLifecycleStepper` component to render exception badges (`Refund Pending`, `Refunded`, `Cancelled`).
- Render state-specific action cards:
  - Importer viewing `RefundPending` (if requested by Importer): "Waiting for Exporter approval or rejection" + "Withdraw Request" button.
  - Exporter viewing `RefundPending` (if requested by Importer): "Action Required: Review Refund Proposal" + "Approve Refund" & "Reject Refund" buttons.
  - Importer viewing expired `Funded`: "Exporter Missed Acceptance Deadline" + "Cancel & Claim Refund" button.

**Acceptance Criteria:**
- Clear status explanation and next actor identified on every screen.
- Buttons disabled during active submission or when user lacks wallet authority.

---

### S9-RF07 — Event Ingestion & Getter Reconciliation

**User Story:** As Movix, I index Soroban exception events (`refund_proposed`, `refund_approved`, `refund_rejected`, `refund_withdrawn`, `cancelled`) and reconcile projections against `get_escrow`.

**Implementation Details:**
- Ingest contract events in `packages/backend/convex/events.ts`.
- Map event topics:
  - `("escrow", "refund_proposed")` $\rightarrow$ set status `refund_pending`, store `refund_proposer`, `refund_terms_hash`, `resume_status`.
  - `("escrow", "refund_approved")` $\rightarrow$ set terminal status `refunded`.
  - `("escrow", "refund_rejected")` / `("escrow", "refund_withdrawn")` $\rightarrow$ restore `resume_status`, clear refund fields.
  - `("escrow", "cancelled")` $\rightarrow$ set terminal status `cancelled`.
- Run idempotent getter check via `get_escrow(id)` to guarantee projection truth.

**Acceptance Criteria:**
- Indexer handles out-of-order or duplicate event delivery gracefully.
- Projections reconcile with contract storage state 100% of the time.

---

### S9-RF08 — Concurrency & Race Protection

**User Story:** As Movix, I prevent race conditions between settlement releases and refund approvals.

**Implementation Details:**
- Contract-level invariant: `confirm_delivery` requires status `Shipped`. If status is `RefundPending`, `confirm_delivery` fails.
- If Importer proposes refund while Exporter is attempting `mark_shipped` or release, Soroban transaction serialization ensures exactly one succeeds, while the other fails with invalid status transition.
- Integration tests in `contracts/escrow/src/test.rs` and backend Playwright suite explicitly test race conditions.

**Acceptance Criteria:**
- Serialized execution of concurrent release and refund approval results in exactly one terminal outcome (`Released` or `Refunded`). Double payout or contract lock-up is mathematically impossible.

---

### S9-RF09 — Exception Notifications

**User Story:** As a user, I receive deep-linked notifications when a refund is requested, approved, rejected, withdrawn, or when an escrow is cancelled.

**Implementation Details:**
- Add notification triggers in `packages/backend/convex/notifications.ts`.
- Types: `REFUND_PROPOSED`, `REFUND_APPROVED`, `REFUND_REJECTED`, `REFUND_WITHDRAWN`, `ESCROW_CANCELLED`.
- Deep links point directly to `/orders/[orderId]`.

**Acceptance Criteria:**
- Notifications are durable, organization-scoped, and deduplicated by event ID.

---

### S9-RF10 — Transaction Recovery & Finality Tracking

**User Story:** As a user, I can safely recover if my browser reloads or disconnects while an `approve_refund` or `cancel_unaccepted` transaction is confirming.

**Implementation Details:**
- Persist pending transaction hash in Convex before waiting for RPC finality.
- On page mount/reload, query transaction status on Stellar RPC. If confirmed on-chain, finalize Convex order projection immediately.

**Acceptance Criteria:**
- Browser refresh during pending confirmation does not leave order in stuck UI state or trigger duplicate transaction prompts.

---

### S9-RF11 — Automated Test Suite & QA Gate

**User Story:** As QA, I run an end-to-end automated test suite verifying all Sprint 9 exception paths.

**Implementation Details:**
- Playwright E2E tests:
  - Journey A: Propose Refund $\rightarrow$ Approve Refund $\rightarrow$ Verified 100% payout to Importer.
  - Journey B: Propose Refund $\rightarrow$ Reject Refund $\rightarrow$ Verified state restored.
  - Journey C: Propose Refund $\rightarrow$ Withdraw Refund $\rightarrow$ Verified state restored.
  - Journey D: Expired `Funded` $\rightarrow$ `cancel_unaccepted` $\rightarrow$ Verified 100% payout to Importer.
- Soroban Rust integration tests verifying authorization boundaries and liability conservation.

**Acceptance Criteria:**
- 100% pass rate across all Playwright, Convex backend, and Soroban contract tests.

---

## 9. Verification plan

### Automated Tests
- `pnpm --filter backend test` (Convex refund mutations, permissions, state machine)
- `cargo test --manifest-path contracts/escrow/Cargo.toml` (Contract refund & cancellation invariants)
- `pnpm exec playwright test e2e/sprint-09-refunds.spec.ts` (Full browser E2E journeys)

### Manual Verification
- Testnet dual-wallet rehearsal using Freighter wallet on local dev server (`pnpm dev`). Verify exact token balances in Stellar Laboratory / Explorer after refund and cancellation.
