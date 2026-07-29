---
title: Movix Sprint 5 — Detailed Supplier Acceptance Plan
sprint: 5
status: implementation-in-progress
prepared: 2026-07-29
stepsCompleted:
  - validate-prerequisites
  - reconcile-requirements
  - define-stories
  - final-validation
inputDocuments:
  - docs/Movix-Sprint-Plan.md
  - docs/Movix-Implementation-Plan.md
  - docs/Movix-Sprint-04-Buyer-Procurement-Detailed.md
  - docs/buyer-procurement/api-contract.md
  - docs/buyer-procurement/architecture.md
  - docs/buyer-procurement/data-and-validation.md
  - docs/buyer-procurement/implementation-runbook.md
  - docs/buyer-procurement/security-operations-runbook.md
  - docs/buyer-procurement/testing-and-evidence.md
---

# Movix Sprint 5 — Detailed Supplier Acceptance Plan

**Duration:** 2 weeks  
**Theme:** Supplier inbox, exact commercial review, acceptance, rejection, revision history, and re-acceptance  
**Primary owner:** Elliot  
**Pages:** `/supplier`, `/orders`, `/orders/[orderId]`  
**Master scope:** S5-01 through S5-08 in [Movix-Sprint-Plan.md](./Movix-Sprint-Plan.md)  
**Entry dependency:** Sprint 4 produces one immutable, sent, supplier-targeted order revision

**Implementation documentation:** [Supplier Acceptance](./supplier-acceptance/README.md)

**Evidence manifest:** [Sprint 5 evidence](./evidence/sprint-05/README.md)

Local unit, type, lint, format, build, accessibility, contract, and Stellar regression gates are green. Sprint 5 is not closed: authenticated QA storage states, target-deployment inventory/migration reconciliation, full P0 race coverage, and immutable browser/security evidence remain release blockers.

## 1. Purpose and planning authority

This document expands the authoritative Sprint 5 section of `Movix-Sprint-Plan.md`. It is the implementation handoff for Elliot: scope, fixed decisions, data and API contracts, sequencing, acceptance criteria, tests, evidence, and closure rules.

Authority order:

1. `Movix-Sprint-Plan.md` controls current sprint number, scope, priority, and delivery sequence.
2. This document controls Sprint 5 implementation details.
3. `Movix-Sprint-04-Buyer-Procurement-Detailed.md` and `docs/buyer-procurement/*` control the Sprint 4 input contract.
4. `Movix-Implementation-Plan.md` supplies product and architecture context only where it does not conflict with the newer sprint plan.
5. Current code determines the actual migration and integration baseline.

`Movix-Implementation-Plan.md` uses an older sprint numbering sequence. Its “Supplier inbox, review, acceptance, rejection” section describes the same product slice, but every requirement in this document is identified as Sprint 5.

If implementation discovers a conflict affecting authorization, revision immutability, the terms hash, funding eligibility, or decision history, stop and record a decision. Do not silently choose a new lifecycle.

## 2. Sprint outcome

Sprint 5 changes a sent order from a buyer-only procurement record into a defensible bilateral agreement.

At completion:

1. An authenticated member of the designated supplier organization sees incoming orders requiring a decision.
2. The supplier reviews every supplier-visible field from the exact frozen revision.
3. An authorized supplier member accepts or rejects that exact revision once.
4. Acceptance records the supplier organization, acting user, authenticated wallet, revision, server-confirmed terms hash, and timestamp.
5. Rejection records the same decision identity plus a bounded structured reason.
6. The buyer receives one durable deep-linked notification for the decision.
7. Both parties see the same ordered agreement timeline using role-appropriate wording.
8. A material edit never mutates an accepted revision. It creates a new revision and requires a new supplier decision before funding.

Sprint 5 remains off-chain. Accepting or rejecting an order does not build a Stellar transaction, request a wallet signature, move funds, or call the escrow contract.

## 3. Capacity and committed cut line

The sprint has eight P0 stories. S5-01 through S5-08 are one connected vertical slice and are committed.

| Cut     | Items                                                        | Rule                                       |
| ------- | ------------------------------------------------------------ | ------------------------------------------ |
| P0      | S5-01 through S5-08                                          | Required for sprint closure                |
| P1      | Operational polish that does not alter the decision contract | Complete only after all P0 tests are green |
| Stretch | Counteroffers, email delivery, supplier teams, negotiation   | Must not delay or weaken P0                |

If capacity falls:

1. Remove all stretch work.
2. Keep one supplier organization and the existing one-owner-per-business MVP constraint.
3. Keep in-app notifications only.
4. Reduce dashboard decoration, but preserve the incoming queue, exact review, decision actions, canonical timeline, and re-acceptance.

Never cut:

- Supplier organization isolation.
- Exact revision and terms-hash binding.
- Frozen-revision immutability.
- Idempotent and concurrency-safe decisions.
- Buyer notification deduplication.
- Revision history and loss of funding eligibility after a material change.
- Mobile, keyboard, and screen-reader access to the decision path.

## 4. Current repository baseline

Elliot starts from the implemented Sprint 4 slice.

| Area                 | Present now                                                                   | Sprint 5 gap                                                                 |
| -------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Supplier route       | `/supplier` renders the generic workspace placeholder                         | No supplier summary, incoming queue, decision counts, or order links         |
| Shared order route   | `/orders/[orderId]` composes `OrderDetail`                                    | `orders.getById` is buyer-only and the component exposes buyer-only behavior |
| Supplier order index | `orders.by_supplier_status_sortTimestamp` exists                              | No supplier-authorized paginated list query                                  |
| Order state          | `draft`, `sent`, `accepted`, `rejected`, `cancelled` already validate         | No supplier decision mutation or per-revision decision record                |
| Frozen revision      | Sent revision stores immutable snapshots, totals, `termsHash`, and `frozenAt` | No supplier-safe projection or decision binding                              |
| Authorization        | Buyer context and `order:decide` role capability exist                        | No supplier context or designated-supplier order helper                      |
| Commands             | Buyer create/send/cancel receipts are idempotent                              | No supplier accept/reject receipt model                                      |
| Notifications        | Send creates one organization-targeted notification                           | No buyer decision notification or supplier inbox consumer                    |
| Audit                | Send/cancel write bounded audit events                                        | No accepted/rejected/revised timeline events                                 |
| Dashboard counts     | Buyer/supplier row shape contains only draft/sent counts                      | No supplier attention/decided count contract                                 |
| Revision lifecycle   | Revision 1 is frozen on send                                                  | No clone-to-revision-2 or re-acceptance workflow                             |
| Tests                | Sprint 4 domain/backend/web suites cover buyer behavior                       | No supplier isolation, decision race, timeline, or supplier E2E coverage     |

Important constraints:

- `orders.getById` currently calls buyer authorization and may expose `buyerInternalNotes`. Do not reuse it unchanged for supplier review.
- The `/supplier` route is a placeholder, not an implemented dashboard.
- `orderCommandReceipts` is buyer-scoped and supports only `create`, `send`, and `cancel`. Do not force supplier decisions into misleading buyer-named fields.
- Sprint 4 stores one frozen revision and one canonical `order-terms-v1` hash. Recompute only as an integrity assertion; do not construct a different payload in Sprint 5.
- Sprint 4 release evidence still lists authenticated Playwright and some environment-dependent closure work as pending. Sprint 5 planning may proceed, but its release evidence must not claim those dependencies are complete.

## 5. Definition of ready

Implementation starts only after Elliot confirms:

- The target deployment’s Sprint 4 schema inventory is known.
- At least one deterministic sent-order fixture exists with separate buyer and supplier organizations.
- The sent revision has a non-empty `termsHash`, `frozenAt`, supplier organization, amount, asset, and decision deadline.
- The supplier organization is active, verified, supplier-capable, and has an active authenticated member.
- Buyer-only fields are identified and excluded from the supplier projection.
- The decision reason taxonomy and string bounds in this document are accepted.
- The revision-2 transition is understood before schema changes begin.
- Existing buyer regression commands are green or failures are recorded as pre-existing.
- No financial transaction, contract mutation, or escrow projection is included in Sprint 5.

## 6. Sprint goal and demo

> The designated supplier can discover, review, accept, or reject one exact immutable order revision; the buyer receives one durable decision notification; both parties see one defensible revision and decision history; and any material change requires a new supplier acceptance before funding.

The demo must show:

1. Sign in as a supplier-capable organization.
2. Open `/supplier` and see an exact “Requires decision” count.
3. Open an incoming sent order from the queue.
4. Review buyer identity, contacts, delivery address, all lines and totals, asset, dates, delivery and inspection terms, refund terms, revision number, deadline, and terms hash.
5. Accept through a confirmation dialog that states no funds move.
6. Refresh and show the same accepted result, actor, timestamp, revision, and hash.
7. Sign in as the buyer and follow one decision notification to the order.
8. Show the same acceptance in the buyer timeline and show funding eligibility as true.
9. On a second order, reject with a structured reason and optional bounded note.
10. Show rejection prevents funding eligibility and creates one notification.
11. On a third order, submit accept and reject concurrently; show exactly one terminal decision and one side-effect set.
12. Start a material revision of the accepted order, change one commercial term, send revision 2, and show that the old acceptance remains historical while the current revision requires a new decision.
13. Demonstrate a foreign supplier, expired decision, stale revision, and duplicate click failing safely without partial writes.
14. Complete the supplier review and decision at 320 px using keyboard controls.

## 7. Fixed product and architecture decisions

| Decision                      | Contract                                                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of agreement authority | Convex owns off-chain order revisions and supplier decisions in Sprint 5                                                                                                         |
| On-chain behavior             | None; accept/reject never calls Stellar or the escrow contract                                                                                                                   |
| Decision target               | One exact frozen `orderRevisions` row and its stored `order-terms-v1` hash                                                                                                       |
| Supplier identity             | Derived from the authenticated active organization and active membership; never accepted from browser input                                                                      |
| Acting identity               | Store supplier organization, user, authenticated wallet snapshot, and time                                                                                                       |
| Decision cardinality          | One terminal accept or reject decision per revision                                                                                                                              |
| Current agreement state       | `orders.agreementStatus` mirrors the decision on `currentRevisionId`                                                                                                             |
| Accepted history              | A decision record remains immutable even when a later revision supersedes it                                                                                                     |
| Funding eligibility           | Derived; true only when the current frozen revision has a matching accepted decision and settlement is `unfunded`                                                                |
| Deadline                      | Accept and reject are blocked after `supplierAcceptanceDeadline`; the order remains visible with an expired action state                                                         |
| Deadline counts               | Sending schedules one idempotent expiry check; it adjusts dashboard projections only if the same revision is still current and awaiting a decision                               |
| Relationship changes          | A paused relationship blocks new sends, not visibility of an existing obligation; active organization, membership, verification, and wallet binding are still required to decide |
| Notification                  | Organization-targeted and idempotent; it helps discovery but grants no authorization                                                                                             |
| Buyer-only information        | `buyerInternalNotes` and any future internal fields never enter supplier projections, notifications, decision hashes, or supplier logs                                           |
| Revisions                     | Frozen revisions are never patched; a material change clones into a new mutable revision                                                                                         |
| Re-acceptance                 | Starting a new material revision removes current funding eligibility immediately and preserves the prior accepted decision as history                                            |
| Concurrency                   | Convex mutation atomicity plus expected order/revision versions and idempotency guarantee one winner                                                                             |
| User language                 | “Accepted” means the supplier agreed off-chain to the displayed revision; it does not mean escrow is funded                                                                      |

## 8. Actors and authorization

### 8.1 Supplier viewer

An active member of the designated supplier organization may view supplier-visible data for an existing sent or decided order when:

- The organization capability is `supplier` or `buyer_supplier`.
- The organization, user, membership, session, and wallet binding are active.
- The organization is verified.
- `order.supplierOrganizationId` equals the active organization.

`viewer` and `finance` roles may read supplier-visible orders but cannot accept or reject.

### 8.2 Supplier decision actor

Acceptance and rejection require `order:decide`. Existing role mapping permits:

- `owner`
- `admin`
- `procurement`
- `operations`

The backend must re-check capability, status, verification, membership, wallet, supplier organization match, order state, revision ID, versions, deadline, hash, and prior decision inside the mutation.

### 8.3 Buyer viewer

An active member of the buyer organization may see the decision and canonical timeline through buyer-authorized projections. Existing buyer-only fields remain buyer-only.

### 8.4 Buyer revision actor

Starting and editing a post-decision revision requires the existing `order:draft` capability. Re-sending requires `order:send`.

A new revision is permitted only while settlement remains `unfunded`. Sprint 5 does not define commercial edits after funding.

### 8.5 Foreign, inactive, and stale actors

The following must receive safe stable denials and no order metadata:

- A different supplier organization.
- A user with a suspended or removed membership.
- A suspended or unverified organization.
- A wallet not actively bound to the authenticated organization.
- A provisional or expired invitation without active membership.
- An inactive session.
- A user attempting to decide a non-current, superseded, cancelled, expired, or already-decided revision.

Unknown and foreign order IDs must remain indistinguishable.

## 9. Primary journeys

### 9.1 Supplier accepts

`/supplier` → “Requires decision” → `/orders/[orderId]` → review exact frozen revision → accept dialog → server validates current revision/hash/deadline/authorization → one decision, state transition, count update, buyer notification, and audit event → accepted confirmation and timeline.

### 9.2 Supplier rejects

Supplier review → reject dialog → choose reason → optional note → server validates the same immutable target → one rejected decision and side-effect set → buyer follows notification to reason and history.

### 9.3 Duplicate decision

The browser creates one idempotency key per intent. A retry with the same key and identical fingerprint returns the recorded result. The same key with a different intent or payload fails with `IDEMPOTENCY_CONFLICT`.

### 9.4 Accept/reject race

Two valid requests target the same sent revision. One mutation commits first. The second observes a decided order/revision and fails or replays its identical result. It must not create another decision, notification, audit event, or count transition.

### 9.5 Expired decision

The review remains readable after the supplier acceptance deadline, but decision actions are disabled. A direct or stale client mutation fails with `ORDER_DECISION_EXPIRED`. The buyer may use the existing eligible cancellation path.

### 9.6 Material revision after acceptance

Buyer opens an accepted and unfunded order → chooses “Create new revision” → server clones the accepted revision and lines into mutable revision 2 → order becomes `draft` and current funding eligibility becomes false → buyer edits → sends revision 2 → supplier sees it as requiring a new decision → old acceptance remains in history and cannot authorize funding of revision 2.

### 9.7 Rejection recovery

P0 guarantees that a rejected revision is historical and cannot be funded. Reusing the same clone/edit/send mechanism from a rejected and unfunded order is allowed when it does not add a separate lifecycle. The new revision must still receive a new decision.

## 10. Scope

### 10.1 P0 committed

- Supplier dashboard attention summary and incoming queue.
- Supplier-scoped paginated order list.
- Supplier-safe immutable revision projection.
- Accept and reject confirmation flows.
- Structured rejection reasons.
- Exact revision/hash binding.
- Decision idempotency and concurrency safety.
- Decision records, audit events, and buyer notifications.
- Canonical shared revision/decision timeline.
- Funding-eligibility projection.
- Material revision creation and re-acceptance.
- Loading, empty, error, stale, expired, pending, disabled, and success states.
- Responsive, keyboard, and screen-reader coverage.
- Backend, component, accessibility, and Playwright evidence.

### 10.2 P1

- Remember supplier list filters in the URL.
- Copy full terms hash and PO number.
- Relative and absolute timestamp toggle.
- Non-sensitive decision analytics events.
- ~~Rejected-order revision recovery using the same accepted-order revision path.~~ Promoted to P0 by the approved Sprint 5 erratum: accepted or rejected + unfunded may start revision N+1.

### 10.3 Stretch

- Email notification delivery.
- Supplier team assignment.
- Saved supplier queue views.
- Export or print styling.

### 10.4 Explicitly out of scope

- Counteroffers, negotiation, comments, or chat.
- Partial acceptance or line-level acceptance.
- Editing the buyer’s frozen revision in place.
- Supplier changes to quantity, price, totals, addresses, asset, or terms.
- Wallet signing for off-chain acceptance.
- Escrow creation or funding.
- On-chain supplier acceptance.
- Shipment, delivery, release, refund, or cancellation-after-funding behavior.
- Automatic acceptance or rejection.
- Open supplier discovery.
- Email invitations.

## 11. Route contract

| Route               | Audience                                | Sprint 5 responsibility                                                               |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| `/supplier`         | Supplier-capable organization           | Attention counts, incoming/decided queue, recent decisions, empty and blocked states  |
| `/orders`           | Buyer or supplier                       | Role-aware list; supplier sees only orders targeting the active supplier organization |
| `/orders/[orderId]` | Authorized buyer or designated supplier | Canonical role-aware order review, decision actions, eligibility, and timeline        |
| `/buyer`            | Buyer-capable organization              | Existing behavior plus accepted/rejected attention where required                     |

Route files remain compositional. Put stateful Convex orchestration and presentation in feature modules, not in page components.

## 12. Supplier dashboard contract

`/supplier` must replace the generic placeholder.

Required cards:

- Requires decision: current `sent` revisions within the deadline.
- Expired action: `sent` revisions past the decision deadline.
- Accepted: current accepted revisions.
- Rejected: current rejected revisions.

Required recent queue:

- Purchase order number.
- Buyer legal/trading name snapshot.
- Title.
- Revision number.
- Amount and asset.
- Sent time.
- Decision deadline and urgency.
- Current agreement label.
- Primary action.

Counts must come from an organization-scoped indexed query or maintained projection. Do not scan an unbounded global order collection. Exact counts and the list must use the same status/deadline definitions.

Because actionability changes when wall-clock time crosses a deadline, send must schedule one idempotent deadline check. The scheduled function re-loads the order and revision, verifies that the revision is still current and `sent`, then moves one count from “Requires decision” to “Expired action.” It does not change `agreementStatus`, manufacture a supplier decision, or duplicate an adjustment when retried. A decision and the expiry job racing at the deadline must still produce one correct projection.

Empty states:

- No incoming orders.
- No orders requiring a decision.
- Supplier profile or verification is incomplete.
- Session or organization context cannot authorize the view.

## 13. Supplier order list contract

Supplier list tabs:

- Requires decision.
- Accepted.
- Rejected.
- All supplier orders.

Optional P1 filters:

- Buyer.
- Asset.
- Decision date or sent date.
- Deadline state.

Each row/card shows:

- PO number and title.
- Buyer snapshot.
- Revision number.
- Total and asset.
- Agreement state.
- Deadline state.
- Sent/decided timestamp.
- “Review order” or “View decision.”

Pagination must be stable and index-backed. The browser never supplies a supplier organization ID. The backend derives it from authentication.

## 14. Supplier review and visibility contract

Create a dedicated supplier-authorized projection. Do not return the buyer projection and hide fields only in React.

Required review sections:

1. Buyer and supplier identity snapshots.
2. Buyer and supplier contacts intended for the transaction.
3. Billing and shipping/delivery address snapshots.
4. PO number, title, description, buyer/supplier references, issue/order dates, and requested delivery.
5. All order lines, including SKU/supplier SKU, description, category, manufacturer, brand, origin, quantity, unit, inspection flag, discount, tax, and canonical derived amounts where present.
6. Subtotal, discounts, tax, shipping, grand total, asset, decimals, and Testnet label.
7. Delivery method, responsibility, freight treatment, delivery window, Incoterm/location, and handling.
8. Inspection period, acceptance criteria, warranty, return terms, and refund policy.
9. Shared notes.
10. Revision number, frozen time, decision deadline, and complete 64-character terms hash.
11. Clear statement that acceptance is off-chain and moves no funds.

Never return to the supplier:

- `buyerInternalNotes`.
- Non-transactional organization fields not snapshotted into the revision.
- Internal authorization, identity, session, or audit implementation data.
- Notification records belonging to other organizations.
- Future confidential attachments without an explicit visibility model.

The projection must be built from the frozen revision and lines, not live organization profiles. Later profile edits must not change what the supplier reviewed.

## 15. Decision contract

### 15.1 Preconditions

Both `accept` and `reject` require:

- Active supplier context and `order:decide`.
- Order belongs to the active supplier organization.
- Order agreement status is `sent`.
- Settlement status is `unfunded`.
- Supplied revision ID equals `order.currentRevisionId`.
- Revision is frozen.
- Stored revision supplier organization equals the active supplier organization.
- Stored `termsHash` exists and matches the mutation’s expected hash.
- Expected order and revision versions match.
- Current time is not later than `supplierAcceptanceDeadline`.
- No decision already exists for the revision.

### 15.2 Atomic writes

One valid decision mutation atomically:

1. Inserts one immutable revision decision.
2. Changes `orders.agreementStatus` to `accepted` or `rejected`.
3. Sets current accepted revision/decision references when accepted, or clears them when rejected.
4. Increments the order version and updates the decision/sort timestamp.
5. Adjusts supplier and buyer dashboard projections.
6. Inserts one command receipt.
7. Inserts one buyer organization notification.
8. Inserts one bounded audit event.

Any failure rolls back all eight effects.

### 15.3 Acceptance confirmation

The dialog must show:

- Buyer.
- PO number.
- Revision.
- Grand total and asset.
- Decision deadline.
- Short hash plus full copy/view access.
- “No funds move when you accept.”
- “The buyer may fund only this accepted revision in the next step.”

The final button label is `Accept revision {N}`.

### 15.4 Rejection confirmation

Required reason codes:

- `pricing_or_totals`
- `quantity_or_availability`
- `delivery_schedule`
- `commercial_terms`
- `supplier_capacity`
- `other`

An optional note is trimmed, 1–500 characters when present, and stored only in the authorized decision detail. It is not copied into notifications or general audit values.

The final button label is `Reject revision {N}`.

### 15.5 Funding eligibility

Expose a server-derived projection:

```text
fundingEligible =
  order.agreementStatus == "accepted"
  AND order.settlementStatus == "unfunded"
  AND order.currentRevisionId == order.acceptedRevisionId
  AND decision.type == "accepted"
  AND decision.revisionId == order.currentRevisionId
  AND decision.termsHash == currentRevision.termsHash
```

The UI must not infer funding eligibility from a status label alone.

## 16. Revision and re-acceptance contract

### 16.1 Immutable history

Revision 1, its lines, hash, frozen time, and decision never change.

A new material revision:

- Uses the next integer revision number.
- Links to the revision it supersedes.
- Copies supplier-visible commercial inputs and canonical lines.
- Recomputes totals and a new hash only when it is sent.
- Starts mutable with no decision and no frozen time.
- Preserves the old decision for timeline and audit.

### 16.2 Start-revision transition

Allowed:

```text
accepted + unfunded -> draft revision N+1
rejected + unfunded -> draft revision N+1
```

Forbidden:

```text
sent -> draft revision N+1
cancelled -> draft revision N+1
any settlement state other than unfunded -> draft revision N+1
```

Starting the revision atomically:

- Clones the current frozen revision and lines.
- Sets `currentRevisionId` and `currentRevisionNumber` to the clone.
- Sets agreement status to `draft`.
- Clears current accepted revision/decision references.
- Preserves historical decision rows.
- Creates one buyer command receipt and audit event.
- Marks funding eligibility false.

### 16.3 Edit and resend

Existing Sprint 4 draft mutations may operate on revision N+1 after authorization and current-revision checks are generalized beyond revision 1.

Existing `orders.send` must support a current mutable draft revision N+1:

- Revalidate all commercial data and supplier eligibility.
- Recompute exact totals.
- Compute `order-terms-v1`.
- Freeze the revision.
- Move to `sent`.
- Create one supplier notification for the new revision.

Revision 2 cannot inherit revision 1’s acceptance even when the resulting hash happens to be identical. A new sent revision requires a new decision.

## 17. Timeline, notification, and audit contract

### 17.1 Canonical timeline

Provide one server-built timeline projection ordered by authoritative timestamps.

Event types:

- Order draft created.
- Revision sent and frozen.
- Revision accepted.
- Revision rejected.
- Revision superseded.
- New revision started.
- Order cancelled.

Each item includes only:

- Stable event type.
- Revision number.
- Actor side and safe display label.
- Timestamp.
- Decision reason code where authorized and applicable.
- Current/historical marker.

The buyer and supplier see the same event ordering and revision numbers. Wording may differ by role. Never synthesize a fake timeline only from current status.

### 17.2 Notifications

Decision notification:

- Recipient: buyer organization.
- Event type: `order.revision_accepted` or `order.revision_rejected`.
- Entity: order.
- Action URL: `/orders/{orderId}`.
- Idempotency key includes order, revision, and decision type.
- Contains no price, address, note, full wallet, or full hash payload.

Revised-order notification:

- Recipient: supplier organization when the new revision is sent.
- Event type identifies that a new revision requires a decision.
- Existing Sprint 4 send notification behavior may be generalized but must remain idempotent.

Notification existence never authorizes the destination query.

### 17.3 Audit

Required actions:

- `order.revision_accepted`
- `order.revision_rejected`
- `order.revision_started`
- `order.revision_superseded`

Audit records contain action, entity IDs, organization, actor, wallet snapshot, correlation/idempotency key, timestamp, and changed field names. They do not contain commercial values or rejection notes.

## 18. Proposed schema changes

Exact names may follow repository conventions, but the semantics are fixed.

### 18.1 `orders`

Add:

- `acceptedRevisionId?: Id<"orderRevisions">`
- `currentDecisionId?: Id<"orderRevisionDecisions">`
- `decidedAt?: number`
- `decisionSortTimestamp?: number`
- `decisionWindowExpiredAt?: number`

Retain `currentRevisionId`, `currentRevisionNumber`, and the three state dimensions.

Add or confirm supplier indexes needed for stable pagination by organization, agreement status, and sort timestamp.

### 18.2 `orderRevisions`

Add:

- `supersedesRevisionId?: Id<"orderRevisions">`
- `supersededAt?: number`

Do not add mutable “accepted” flags that can disagree with the decision record.

### 18.3 `orderRevisionDecisions`

Required fields:

- `orderId`
- `revisionId`
- `revisionNumber`
- `buyerOrganizationId`
- `supplierOrganizationId`
- `decision: accepted | rejected`
- `termsHash`
- `reasonCode?`
- `reasonNote?`
- `actorUserId`
- `actorWalletAddress`
- `decidedAt`
- `createdAt`

Required indexes:

- By revision ID.
- By order ID and decision time.
- By supplier organization and decision time.

The mutation enforces one decision per revision transactionally.

### 18.4 `orderDecisionReceipts`

Required fields:

- `supplierOrganizationId`
- `orderId`
- `revisionId`
- `commandType: accept | reject`
- `idempotencyKey`
- `requestFingerprint`
- `decisionId`
- `createdAt`

Required unique lookup:

- Supplier organization + command type + idempotency key.

Do not overload buyer-scoped receipt fields with supplier semantics.

### 18.5 `orderCommandReceipts`

Extend buyer command type with `start_revision` if the existing table remains the buyer command receipt source.

### 18.6 Dashboard counts

Either widen `orderDashboardCounts` or create an additive supplier projection. It must represent:

- Requires decision.
- Expired action.
- Accepted.
- Rejected.

Sending schedules a deadline job keyed by order and revision. The job sets `decisionWindowExpiredAt` and updates the projection only while that exact revision remains current and `sent`; retry is a no-op. Accept, reject, cancel, or supersede must make the scheduled job harmless.

Migration must initialize deterministic counts from bounded deployment inventory. Do not assume the development database is empty.

## 19. Proposed backend modules and API contract

Suggested layout:

```text
packages/backend/convex/
  supplierOrders.ts
  orderDecisions.ts
  orderRevisions.ts
  orderTimeline.ts
  lib/
    supplierOrderAuthorization.ts
    orderDecisionRules.ts
```

### 19.1 Supplier context

`getSupplierContext`

- Derives the sole active organization.
- Requires supplier or buyer-supplier capability.
- Loads active membership, verification, and wallet binding.
- Returns no order data.

`requireSupplierOrder(orderId, capability?)`

- Loads the order after context derivation.
- Requires exact `supplierOrganizationId`.
- Returns `ORDER_NOT_FOUND` for unknown and foreign IDs.
- Re-checks `order:decide` only when a decision command requests it.

### 19.2 Dashboard and list

`supplierOrders.getSummary`

- Input: none.
- Output: exact counts, latest bounded orders, readiness and decision blockers.
- Auth: active supplier context.

`supplierOrders.list`

- Input: native pagination and bounded filters.
- Output: supplier-scoped list projection.
- Auth: active supplier context.
- Query: supplier-first composite index; no unbounded filtering after collection.

### 19.3 Supplier detail

`supplierOrders.getById`

- Input: `orderId`.
- Output: supplier-visible frozen revision, lines, decision state, eligibility state, and timeline.
- Auth: designated supplier organization.
- Excludes buyer-only fields at the backend validator boundary.

For the shared route, the web layer may query a role-aware facade or choose the buyer/supplier query after loading current context. Neither approach may broaden backend authorization.

### 19.4 Decisions

`orderDecisions.accept`

- Input: order ID, revision ID, expected order version, expected revision version, expected terms hash, idempotency key.
- Output: decision ID, order/revision IDs, accepted status, versions, decision time, replay.

`orderDecisions.reject`

- Same target/version/hash inputs plus reason code and optional note.
- Output mirrors acceptance with rejected status.

The browser does not supply supplier organization, actor user, actor wallet, decision time, buyer recipient, or stored hash.

### 19.5 Revision creation

`orderRevisions.startFromCurrent`

- Input: order ID, expected order version, expected current revision ID, idempotency key.
- Auth: buyer order plus `order:draft`.
- Output: new revision ID/number/version and replay state.
- Clones revision and lines in one transaction within Convex limits.

If line count or transaction size could exceed limits, preserve the existing 100-line Sprint 4 cap and fail closed before partial cloning.

### 19.6 Timeline

`orderTimeline.get`

- Input: order ID.
- Auth: authorized buyer or designated supplier.
- Output: bounded, sorted, role-safe event list.
- Source: revisions, decisions, and relevant audit/lifecycle fields.

### 19.7 Deadline projection

`supplierOrderDeadlines.expire`

- Internal scheduled mutation; never public.
- Input: order ID and revision ID.
- Re-loads the current order and revision at execution time.
- If the target is still current, sent, undecided, and expired, records one projection-only expiry marker and adjusts supplier counts.
- If accepted, rejected, cancelled, superseded, already marked, or no longer current, returns without writes.

## 20. Stable error contract

| Code                            | Meaning and recovery                                                    |
| ------------------------------- | ----------------------------------------------------------------------- |
| `ORDER_NOT_FOUND`               | Unknown or foreign order/revision; reveal nothing                       |
| `ORDER_DECISION_FORBIDDEN`      | Authenticated actor lacks decision capability or valid supplier context |
| `ORDER_NOT_AWAITING_DECISION`   | Current agreement state is not `sent`                                   |
| `ORDER_DECISION_EXPIRED`        | Supplier acceptance deadline passed                                     |
| `ORDER_ALREADY_DECIDED`         | A terminal decision exists for the revision                             |
| `ORDER_REVISION_MISMATCH`       | Supplied revision is not the current revision                           |
| `ORDER_TERMS_HASH_MISMATCH`     | Expected hash differs from the stored current hash; reload              |
| `ORDER_STALE`                   | Expected order or revision version differs; reload                      |
| `ORDER_IMMUTABLE`               | Attempted mutation of a frozen or historical revision                   |
| `ORDER_CANNOT_REVISE`           | State or settlement does not permit a new revision                      |
| `ORDER_DECISION_REASON_INVALID` | Rejection reason or note fails the bounded contract                     |
| `IDEMPOTENCY_CONFLICT`          | Key was reused for a different request                                  |
| Existing auth/profile codes     | Session, organization, membership, wallet, or readiness failure         |

Errors include safe field names where helpful, never foreign metadata or commercial values.

## 21. Web implementation contract

Suggested feature layout:

```text
apps/web/features/orders/
  supplier-dashboard.tsx
  supplier-order-list.tsx
  supplier-order-review.tsx
  order-decision-dialog.tsx
  order-rejection-dialog.tsx
  order-timeline.tsx
  order-revision-history.tsx
  start-order-revision-dialog.tsx
```

Required interaction states:

- Initial loading.
- No incoming orders.
- Supplier not ready.
- Review loading and safe not-found.
- Decision eligible.
- Decision expired.
- Decision submitting.
- Duplicate click disabled.
- Accepted.
- Rejected.
- Stale revision/hash with reload.
- Session expiry.
- Generic retryable error.
- Historical revision.
- New revision awaiting supplier.

Rules:

- Keep one decision request in flight.
- Retain the same idempotency key for an identical retry.
- Disable both decision actions while either is pending.
- Never optimistically display terminal acceptance before the mutation confirms.
- Restore controls after a recoverable failure.
- On stale/hash mismatch, stop and require a server reload.
- Announce pending, success, and error states through an appropriate live region.
- Move focus into dialogs, trap it, return it to the trigger, and focus the result heading after success where appropriate.
- At 320 px, review sections and line items become stacked cards without horizontal page scrolling.
- Long names, PO numbers, notes, wallet labels, and hashes wrap or truncate with full accessible access.

Reuse `packages/ui` primitives such as `Card`, `Badge`, `Tabs`, `Table`, `AlertDialog`, `Textarea`, `Button`, `Breadcrumb`, `Skeleton`, and `Progress` where available.

## 22. Detailed backlog

## S5-01 — Supplier dashboard and incoming queue

**Delivers:** `/supplier`, exact attention counts, recent incoming list, empty/readiness states  
**Depends on:** supplier context, indexes/count projection  
**Primary disciplines:** Backend, Web, Design

Acceptance criteria:

- **S5-01-AC01:** Only orders targeting the active supplier organization appear.
- **S5-01-AC02:** “Requires decision” includes current sent revisions within deadline.
- **S5-01-AC03:** Expired sent revisions are visible but not counted as actionable.
- **S5-01-AC04:** Counts and queue use the same rules.
- **S5-01-AC05:** A foreign supplier learns nothing about another organization’s queue.
- **S5-01-AC06:** Loading, empty, blocked, error, mobile, and desktop states are complete.

Required tests:

- Supplier, buyer-only, dual-role, foreign, suspended, unverified, and viewer fixtures.
- Exact count transitions for sent → accepted and sent → rejected.
- Accessible dashboard cards and queue.

## S5-02 — Supplier review of the immutable revision

**Delivers:** supplier-safe order detail and complete commercial review  
**Depends on:** Sprint 4 frozen snapshots and terms hash  
**Primary disciplines:** Backend, Web, Design

Acceptance criteria:

- **S5-02-AC01:** The projection includes every supplier-visible field listed in section 14.
- **S5-02-AC02:** Values come from the frozen revision, not current organization profiles.
- **S5-02-AC03:** Buyer internal notes are absent from the serialized response.
- **S5-02-AC04:** Revision number, deadline, full hash access, Testnet, and “no funds move” are explicit.
- **S5-02-AC05:** A foreign or unknown order returns the same safe denial.
- **S5-02-AC06:** Mobile and screen-reader users can understand line items and totals.

Required tests:

- Projection allowlist/denylist test.
- Snapshot-versus-live-profile regression.
- Full line/totals/terms component test.
- Long content, empty optional fields, 320 px, keyboard, and axe checks.

## S5-03 — Accept the exact revision

**Delivers:** confirmation dialog, atomic acceptance, funding-eligibility projection  
**Depends on:** S5-02, decision schema, supplier decision authorization  
**Primary disciplines:** Backend, Web, QA

Acceptance criteria:

- **S5-03-AC01:** Only `order:decide` roles in the designated supplier organization may accept.
- **S5-03-AC02:** The server binds acceptance to current revision ID and stored terms hash.
- **S5-03-AC03:** Acceptance writes exactly one decision, state change, receipt, count transition, buyer notification, and audit event.
- **S5-03-AC04:** A replay returns the same result.
- **S5-03-AC05:** Duplicate and concurrent acceptance cannot duplicate side effects.
- **S5-03-AC06:** Accepted UI does not imply funded or on-chain.

Required tests:

- Role matrix.
- Wrong org/wallet/revision/hash/version/deadline/state.
- Same-key replay and conflicting-key reuse.
- Concurrent acceptance.
- Funding-eligibility truth table.

## S5-04 — Reject with a structured reason

**Delivers:** rejection dialog, reason validation, atomic rejection  
**Depends on:** S5-02 and shared decision infrastructure  
**Primary disciplines:** Backend, Web, QA

Acceptance criteria:

- **S5-04-AC01:** Reason code is required and allowlisted.
- **S5-04-AC02:** Optional note is trimmed and bounded to 500 characters.
- **S5-04-AC03:** Rejection binds to the exact current revision/hash.
- **S5-04-AC04:** Rejection creates exactly one atomic side-effect set.
- **S5-04-AC05:** Funding eligibility is false.
- **S5-04-AC06:** The buyer can see the authorized reason; notifications and general audits do not copy the note.

Required tests:

- Every reason code, invalid code, empty/oversized note, and Unicode note.
- Reject replay, concurrency, and accept-versus-reject race.
- Privacy assertion across notification, audit, and supplier list projections.

## S5-05 — Buyer decision notification

**Delivers:** one durable deep-linked organization notification per decision  
**Depends on:** accepted/rejected mutations  
**Primary disciplines:** Backend, Web

Acceptance criteria:

- **S5-05-AC01:** Acceptance and rejection create distinct stable event types.
- **S5-05-AC02:** The notification targets only the buyer organization.
- **S5-05-AC03:** The action URL opens the authorized order detail.
- **S5-05-AC04:** Replay and races create no duplicate notification.
- **S5-05-AC05:** A notification grants no read access to a foreign user.
- **S5-05-AC06:** Content is useful without including commercial or sensitive payloads.

Required tests:

- Recipient, event, deep link, idempotency, and safe content.
- Foreign deep-link denial.
- Duplicate consumer/retry behavior.

## S5-06 — Prevent stale, invalid, and conflicting decisions

**Delivers:** complete server guard matrix and stable recovery errors  
**Depends on:** all decision rules  
**Primary disciplines:** Backend, QA

Acceptance criteria:

- **S5-06-AC01:** Superseded, cancelled, expired, wrong-supplier, unfrozen, already-decided, and non-current revisions fail.
- **S5-06-AC02:** Expected versions and expected terms hash are checked inside the mutation.
- **S5-06-AC03:** Accept/reject races have one winner.
- **S5-06-AC04:** Every failed command leaves state, counts, receipts, notifications, and audits unchanged.
- **S5-06-AC05:** Safe errors reveal no foreign record state.

Required tests:

- One test per denial and all material races.
- Transactional before/after side-effect counts.
- Property-style valid/invalid state transition table where practical.

## S5-07 — Material revision and re-acceptance

**Delivers:** clone-to-revision-N+1, editable current draft, resend, superseded history  
**Depends on:** Sprint 4 draft/save/send generalized to later revisions  
**Primary disciplines:** Backend, Web, QA

Acceptance criteria:

- **S5-07-AC01:** A frozen revision is never changed.
- **S5-07-AC02:** Starting a revision from accepted/rejected + unfunded creates one complete mutable clone.
- **S5-07-AC03:** Current funding eligibility becomes false immediately.
- **S5-07-AC04:** Old decision and hash remain immutable and visible as history.
- **S5-07-AC05:** Editing and resending creates a new frozen hash and one supplier notification.
- **S5-07-AC06:** The new revision cannot inherit the previous decision.
- **S5-07-AC07:** Funding/terminal/foreign/stale attempts fail without partial clone rows.

Required tests:

- Clone all fields and bounded lines exactly.
- Revision numbering under concurrent start attempts.
- Replay and idempotency.
- Accepted → draft → sent → accepted revision 2.
- Old accepted decision cannot authorize current revision 2.
- No editing after any non-`unfunded` settlement state.

## S5-08 — Canonical timeline and role-aware history

**Delivers:** shared revision and decision timeline on order detail  
**Depends on:** revision and decision records  
**Primary disciplines:** Backend, Web, Design

Acceptance criteria:

- **S5-08-AC01:** Buyer and supplier see identical event order, revision numbers, and authoritative times.
- **S5-08-AC02:** Actor wording is role-aware and does not expose internal IDs.
- **S5-08-AC03:** Accepted, rejected, superseded, revised, resent, and cancelled events remain historical.
- **S5-08-AC04:** Timeline is bounded and ordered deterministically when timestamps tie.
- **S5-08-AC05:** Rejection notes appear only in authorized decision detail, not generic audit data.
- **S5-08-AC06:** The timeline remains understandable on mobile and by screen reader.

Required tests:

- Multi-revision event ordering.
- Buyer/supplier projection parity.
- Privacy allowlist.
- Accessible ordered-list semantics and timestamp labels.

## 23. Ten-day execution plan

## Day 1 — Freeze decision and revision contracts

- Confirm lifecycle, deadline, role matrix, reason codes, errors, and funding-eligibility formula.
- Inventory current Sprint 4 tables and sent fixtures.
- Record any unresolved schema migration issue.

**Gate:** Elliot can describe every allowed and forbidden transition without inventing behavior.

## Day 2 — Domain, validators, and schema

- Add decision/revision types and validators.
- Add decision and receipt tables.
- Add order/revision fields and indexes.
- Add migration inventory and deterministic initialization path.

**Gate:** Schema tests and code generation pass; no existing frozen revision changes.

## Day 3 — Supplier authorization and projections

- Implement supplier context and designated-order authorization.
- Implement supplier-safe detail.
- Implement supplier list and summary query foundations.

**Gate:** Foreign, inactive, unverified, wrong-wallet, and role matrices pass.

## Day 4 — Acceptance

- Implement acceptance rules, receipt replay, atomic writes, counts, notification, and audit.
- Add server-derived funding eligibility.

**Gate:** Acceptance and replay tests prove one decision and one side-effect set.

## Day 5 — Rejection and races

- Implement rejection validation and privacy rules.
- Complete accept/reject concurrency and deadline handling.

**Gate:** Race tests produce one winner and no partial writes.

## Day 6 — Supplier dashboard, list, and review

- Replace `/supplier` placeholder.
- Add incoming list and complete supplier review.
- Add loading, empty, blocked, expired, and safe-denial states.

**Gate:** Supplier can discover and review the complete exact revision.

## Day 7 — Decision UI and timeline

- Add accessible accept/reject dialogs.
- Add canonical role-aware timeline.
- Add buyer notification/deep-link presentation.

**Gate:** Component and accessibility tests cover all decision states.

## Day 8 — Revision 2 and re-acceptance

- Implement idempotent clone-to-new-revision.
- Generalize draft/save/send to current revision N.
- Add superseded history and supplier re-notification.

**Gate:** Accepted revision 1 → revised → sent revision 2 → accepted passes end to end.

## Day 9 — Integration and E2E

- Run supplier accept/reject journeys.
- Run concurrency, stale, expiry, session, foreign, responsive, and keyboard journeys.
- Complete buyer regression.

**Gate:** P0 automated matrix is green and evidence is attached.

## Day 10 — Hardening, demo, and closure

- Run full repository gates.
- Review logs, notifications, audits, and screenshots for redaction.
- Rehearse the demo including one recovery path.
- Record known limitations and closure decision.

**Gate:** All Sprint 5 exit checks are green or the sprint is explicitly not complete.

## 24. Test plan

### 24.1 Authorization matrix

Cover:

- Supplier `owner`, `admin`, `procurement`, `operations`, `finance`, and `viewer`.
- Buyer-only and dual-role organizations.
- Foreign supplier.
- Wrong wallet.
- Suspended/removed user and membership.
- Suspended/unverified/non-supplier organization.
- Provisional, expired, reused, mismatched, and inactive invitation/binding.
- Unknown/foreign order and revision IDs.

### 24.2 Decision state matrix

Cover accept and reject against:

- Sent/current/frozen/within-deadline.
- Draft.
- Accepted.
- Rejected.
- Cancelled.
- Expired sent.
- Superseded revision.
- Wrong current revision.
- Missing/mismatched terms hash.
- Stale order version.
- Stale revision version.
- Non-unfunded settlement.

Every denial asserts zero side-effect delta.

### 24.3 Idempotency and concurrency

- Identical same-key replay.
- Same key with different command.
- Same key with different revision/hash/reason.
- Concurrent accept/accept.
- Concurrent reject/reject.
- Concurrent accept/reject.
- Decision versus buyer cancellation.
- Decision versus start-revision.
- Two concurrent start-revision commands.
- Duplicate revised-order send and notification.

### 24.4 Projection and privacy

- Supplier receives all required commercial fields.
- Supplier never receives `buyerInternalNotes`.
- Live profile changes do not modify snapshots.
- Notification and audit do not contain rejection note, totals, address, full wallet, or full hash.
- Timeline parity between buyer and supplier.
- Funding-eligibility truth table.

### 24.5 Revision tests

- Clone header, snapshots, terms, asset, exact totals, and every line.
- Preserve revision 1 and decision byte-for-byte.
- Increment revision number once.
- Recompute new hash at send.
- Require a new decision even if hashes are equal.
- Prevent cloning/editing after settlement changes.
- Enforce the existing maximum line count and transaction budget.

### 24.6 Component and accessibility

- Dashboard and list loading/empty/error/blocked states.
- Complete review sections.
- Accept dialog.
- Rejection reason and note validation.
- Pending/disabled/success/error live regions.
- Expired and stale states.
- Timeline semantics.
- 320 px, tablet, and desktop.
- Keyboard-only completion, focus order/return, accessible names, contrast, reduced motion, and axe.

### 24.7 Required Playwright journeys

1. Supplier incoming queue → review → accept.
2. Supplier incoming queue → review → reject.
3. Buyer follows accepted notification.
4. Buyer follows rejected notification and views reason.
5. Duplicate accept returns one result.
6. Accept/reject race yields one decision.
7. Expired revision is readable but not actionable.
8. Foreign supplier safe denial.
9. Wrong role cannot decide.
10. Session expires while dialog is open; no decision occurs.
11. Accepted revision 1 → buyer creates/edits/sends revision 2 → supplier re-accepts.
12. Browser refresh preserves confirmed decision and timeline.
13. Mobile keyboard supplier review and decision.
14. Existing Sprint 4 buyer send/cancel regression.

## 25. Quality commands

Run from the repository root:

```text
pnpm --filter @repo/domain test
pnpm --filter @repo/backend test
pnpm --filter web test
pnpm test:a11y
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm test:e2e
pnpm test:contracts
pnpm --filter @repo/stellar test
```

Also run Convex code generation after schema or public API changes:

```text
pnpm --filter @repo/backend exec convex codegen
```

Contract and Stellar commands are regression gates only. Sprint 5 must not add a financial call.

## 26. Security and privacy checklist

- [ ] Supplier organization is derived from authentication, never browser input.
- [ ] Decision actor, user, wallet, and time are server-derived.
- [ ] Unknown and foreign IDs return the same safe denial.
- [ ] Supplier projections use a backend allowlist.
- [ ] Buyer internal notes are absent from supplier responses.
- [ ] Frozen revisions and decisions are immutable.
- [ ] Terms hash is loaded and re-checked on the server.
- [ ] Deadline and state are checked inside the mutation.
- [ ] Idempotency keys are bounded and fingerprinted.
- [ ] Failed decisions make no partial writes.
- [ ] Rejection notes are absent from notification and generic audit payloads.
- [ ] Logs contain codes and opaque IDs, not commercial payloads.
- [ ] Notification deep links do not bypass authorization.
- [ ] No Stellar secret, signing request, XDR, or contract call is introduced.
- [ ] Evidence uses fictional data and truncated identifiers.

## 27. Risks and controls

| Risk                                           | Likelihood |   Impact | Control                                                                            |
| ---------------------------------------------- | ---------: | -------: | ---------------------------------------------------------------------------------- |
| Supplier projection leaks buyer-only notes     |     Medium |     High | Backend allowlist, denylist regression, separate validator                         |
| Acceptance binds the wrong revision            |     Medium | Critical | Current revision ID, versions, frozen flag, and hash checked atomically            |
| Accept/reject race creates conflicting history |     Medium | Critical | One decision row per revision, serialized mutation, concurrency tests              |
| Duplicate notification or audit                |     Medium |     High | Fingerprinted receipts and deterministic idempotency keys                          |
| Old acceptance funds a revised order           |     Medium | Critical | Accepted revision reference and server-derived eligibility formula                 |
| Accepted revision is mutated                   |        Low | Critical | Clone-only revisions and frozen mutation denial                                    |
| Relationship pause strands existing obligation |     Medium |   Medium | Existing order remains visible; active verified organization/member still required |
| Expired order remains actionable in stale UI   |     Medium |     High | Server deadline check plus UI state                                                |
| Dashboard counts drift                         |     Medium |   Medium | Atomic count updates and reconciliation tests                                      |
| Sprint expands into escrow                     |     Medium |     High | Explicit off-chain boundary and Stellar regression-only gate                       |
| Revision clone exceeds transaction limits      |        Low |     High | Existing 100-line cap, inventory, bounded transaction tests                        |
| Buyer/supplier timeline disagrees              |     Medium |   Medium | One server event model and projection parity tests                                 |

## 28. Definition of done

Every P0 story:

- Meets its detailed acceptance criteria.
- Uses backend-enforced organization and role authorization.
- Uses exact current revision and terms hash.
- Preserves immutable revision and decision history.
- Covers loading, empty, error, pending, disabled, stale, expired, and success states as applicable.
- Prevents duplicate submissions and stale writes.
- Produces bounded notification and audit evidence.
- Passes proportional unit, integration, component, accessibility, and E2E tests.
- Works at 320 px, tablet, and desktop.
- Avoids logging secrets, session data, unnecessary PII, and commercial payloads.
- Passes lint, typecheck, tests, and build gates.

## 29. Sprint exit checklist

### Supplier experience

- [ ] `/supplier` is no longer a placeholder.
- [ ] Incoming attention count and queue are exact.
- [ ] Supplier can review every material term from the frozen revision.
- [ ] Accept and reject flows explain their off-chain effect.
- [ ] Expired, stale, pending, and denied states are understandable.
- [ ] Mobile and keyboard users can complete the journey.

### Agreement integrity

- [ ] Only the designated supplier can decide.
- [ ] One revision receives at most one terminal decision.
- [ ] Acceptance stores the exact revision and terms hash.
- [ ] Rejection stores a valid bounded reason.
- [ ] Funding eligibility is server-derived from the current accepted revision.
- [ ] Revision 2 cannot inherit revision 1 acceptance.
- [ ] Old revisions and decisions remain immutable and visible.

### Reliability and security

- [ ] Decision replay is idempotent.
- [ ] Accept/reject and cancellation/revision races have one valid outcome.
- [ ] Decision-versus-deadline-job races leave exact supplier counts.
- [ ] Failed mutations make no partial writes.
- [ ] Buyer receives one durable decision notification.
- [ ] Audit and notification payloads pass redaction review.
- [ ] Foreign and unknown IDs reveal no data.

### Quality

- [ ] Domain and backend tests pass.
- [ ] Web component and accessibility tests pass.
- [ ] Fourteen required Playwright journeys pass.
- [ ] Typecheck, lint, format, and build pass.
- [ ] Contract and Stellar regressions pass with no Sprint 5 financial invocation.
- [ ] Evidence manifest links results to S5-01 through S5-08.

## 30. Required review evidence

Create `docs/evidence/sprint-05/README.md` during implementation and record:

- Command or journey.
- Environment/deployment.
- Commit SHA.
- Timestamp.
- Result.
- Owner.
- Story and acceptance IDs.
- Redaction review.
- Artifact path or immutable link.

Required evidence:

- Deployment inventory and migration branch.
- Schema/code generation.
- Authorization matrix.
- Supplier projection allowlist/denylist.
- Decision state matrix.
- Replay and concurrency results.
- Exact side-effect counts.
- Funding-eligibility truth table.
- Revision-2 and re-acceptance journey.
- Notification/audit privacy review.
- Axe, keyboard, focus, and screen-reader outcomes.
- 320 px/tablet/desktop screenshots.
- Authenticated Playwright report/traces.
- Full quality command results.
- Demo record and closure decision.

## 31. Closure decision

### Complete

Use only when every P0 exit check is green and Sprint 6 can consume a current accepted revision without inventing supplier identity, decision authority, hash binding, eligibility, or history.

### Conditional close

Permitted only for a P1 or external evidence item that does not weaken a P0 requirement. Record owner, exact limitation, due date, and why the Sprint 6 contract remains safe.

### Not complete

Sprint 5 is not complete if any of these remain:

- Supplier authorization depends on a client-supplied organization.
- Supplier detail can expose buyer-only data.
- A decision is not bound to current revision and terms hash.
- Accept/reject can produce multiple decisions or side effects.
- Expired or superseded revisions can be decided.
- Funding eligibility can remain true after a material revision.
- Revision history is overwritten.
- Buyer notification is missing or duplicated.
- Required browser/accessibility evidence is absent without an approved external-fixture exception.

## 32. Handoff to Sprint 6

Sprint 6 may assume:

- One current frozen revision exists.
- The current revision targets one exact buyer and supplier organization.
- The supplier accepted that exact revision off-chain.
- Acceptance includes immutable revision ID, decision ID, terms hash, actor, and timestamp.
- Server-derived funding eligibility is true only for that current accepted revision.
- Amount, asset, decimals, contract ID, parties, deadlines, and hash come from server-controlled records.
- Buyer and supplier can inspect the same agreement history.

Sprint 6 still owns:

- Funding review and transaction construction.
- Wallet signature and rejection behavior.
- Simulation.
- Contract ID and token allowlist validation.
- Submitted versus confirmed transaction state.
- Transaction hash persistence.
- On-chain escrow creation.
- Reconciliation and chain-derived settlement projection.

Sprint 6 must not treat the off-chain acceptance record as proof that funds moved or that the supplier accepted on-chain.

## 33. Elliot start checklist

- [ ] Read this document and the Sprint 4 handoff.
- [ ] Confirm the authoritative sprint-number mismatch is understood.
- [ ] Inventory current target deployment rows before schema changes.
- [ ] Freeze decision reason codes, errors, role matrix, and deadline semantics on Day 1.
- [ ] Add buyer, supplier, dual-role, foreign, suspended, unverified, wrong-wallet, stale, expired, XLM, and USDC fixtures first.
- [ ] Implement supplier authorization before supplier UI.
- [ ] Create a supplier-safe projection rather than adapting the buyer response in React.
- [ ] Implement accept/reject atomicity and tests before dialogs.
- [ ] Implement revision cloning before permitting any post-acceptance edit UI.
- [ ] Preserve existing Sprint 4 buyer regression behavior.
- [ ] Keep Stellar and escrow code untouched except for regression verification.
- [ ] Create the Sprint 5 evidence manifest as implementation begins.

Critical path:

```text
supplier context
→ designated-order authorization
→ supplier-safe frozen projection
→ decision schema and rules
→ atomic accept/reject
→ notification/audit/counts
→ dashboard and decision UI
→ revision N+1 and re-acceptance
→ E2E, accessibility, security, and closure evidence
```

Do not solve uncertainty with browser-trusted identity, client-only field hiding, mutable frozen rows, current-status-only timelines, floating-point amounts, duplicate side effects, database correction, or a premature contract call.

## 34. Implementation references

- [Current sprint plan](./Movix-Sprint-Plan.md)
- [MVP analysis and implementation plan](./Movix-Implementation-Plan.md)
- [Sprint 4 detailed handoff](./Movix-Sprint-04-Buyer-Procurement-Detailed.md)
- [Buyer procurement architecture](./buyer-procurement/architecture.md)
- [Buyer procurement API contract](./buyer-procurement/api-contract.md)
- [Buyer procurement data and validation](./buyer-procurement/data-and-validation.md)
- [Buyer procurement implementation runbook](./buyer-procurement/implementation-runbook.md)
- [Buyer procurement security and operations](./buyer-procurement/security-operations-runbook.md)
- [Buyer procurement testing and evidence](./buyer-procurement/testing-and-evidence.md)
- `packages/domain/src/orders.ts`
- `packages/domain/src/permissions.ts`
- `packages/backend/convex/schema.ts`
- `packages/backend/convex/orders.ts`
- `packages/backend/convex/orderDrafts.ts`
- `packages/backend/convex/orderDashboard.ts`
- `packages/backend/convex/orderValidators.ts`
- `packages/backend/convex/lib/orderAuthorization.ts`
- `apps/web/app/supplier/page.tsx`
- `apps/web/features/orders/order-detail.tsx`

Before implementation, re-check current Convex validators, indexes, pagination, transaction limits, code generation, and deployment inventory. Do not widen Sprint 5 into negotiation, supplier marketplace, email delivery, or escrow funding.

## 35. Sign-off

| Discipline   | Owner          | Status  | Date | Required decision                                               |
| ------------ | -------------- | ------- | ---- | --------------------------------------------------------------- |
| Product      | Nicole / Chris | Pending | —    | Scope, deadline, reason taxonomy, revision semantics            |
| Architecture | Tyler / Elliot | Pending | —    | Decision records, receipt model, projection boundary, migration |
| Web          | Elliot         | Pending | —    | Route composition, role-aware review, interaction states        |
| Backend      | Elliot         | Pending | —    | Authorization, atomicity, indexes, counts, timeline             |
| QA           | QA / Elliot    | Pending | —    | Matrix, fixtures, E2E environment, evidence                     |
| Security     | Reviewer       | Pending | —    | Isolation, privacy, idempotency, audit redaction                |

Sprint 5 is ready to start when the input fixture is trustworthy, the decision and revision contracts are frozen, and no implementation choice remains that could let the wrong supplier, wrong revision, wrong hash, or stale decision become funding-eligible.
