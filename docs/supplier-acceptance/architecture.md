# Supplier Acceptance Architecture

## Boundary

Sprint 5 is entirely off-chain. It records an organization-authorized commercial decision; it does not construct, sign, submit, reconcile, or imply a Stellar transaction. Funding is a later-sprint concern.

The browser supplies only target IDs, expected versions/hash, a decision payload, and an idempotency key. The backend derives the active user, wallet, sole active membership, organization, capability, role, supplier binding, buyer recipient, and authoritative time.

```mermaid
flowchart LR
  Browser[Role-aware web UI] -->|IDs, expected versions/hash, idempotency key| Convex[Convex mutation]
  Session[Verified session + wallet] --> Convex
  Membership[Active membership + verified organization] --> Convex
  Convex --> Order[Order aggregate]
  Convex --> Revision[Immutable frozen revision]
  Convex --> Decision[Immutable revision decision]
  Convex --> Receipt[Supplier-scoped receipt]
  Convex --> Counts[Buyer/supplier projections]
  Convex --> Notice[Buyer notification]
  Convex --> Audit[Redacted audit event]
  Convex -. no call .-> Stellar[Stellar RPC / contract]
```

## Lifecycle

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> sent: validate, hash, freeze, schedule expiry
  sent --> accepted: supplier accepts exact revision
  sent --> rejected: supplier rejects exact revision
  draft --> cancelled
  sent --> cancelled
  accepted --> draft: start revision N+1 while unfunded
  rejected --> draft: start revision N+1 while unfunded
  cancelled --> [*]
```

The order aggregate is terminal only when cancelled. A revision decision is terminal and immutable. Starting revision N+1 clears current decision and accepted-revision references on the aggregate, but it never changes revision N, its lines, hash, or decision.

## Atomic decision sequence

```mermaid
sequenceDiagram
  participant UI
  participant M as orderDecisions
  participant DB
  UI->>M: accept/reject(target, expected versions/hash, key)
  M->>DB: derive supplier principal and load scoped order
  M->>DB: check receipt replay/conflict
  M->>DB: validate current sent/frozen/unfunded/deadline/hash
  M->>DB: insert immutable decision
  M->>DB: patch aggregate and exact counts
  M->>DB: insert fingerprint-only receipt
  M->>DB: insert buyer notification and redacted audit
  M-->>UI: stored result and versions
```

Convex mutation serialization makes accept, reject, cancel, revision start, and expiry converge on one valid state. Any thrown validation error rolls back the complete side-effect set.

## Deadline projection

Send schedules `supplierOrderDeadlines.expire` for deadline + 1 ms. The job reloads the order and revision and changes only the matching current, sent, undecided `requires_decision` projection. It does not manufacture a rejection or alter `agreementStatus`. Retrying after a decision, cancellation, revision change, or prior expiry is a no-op.

Counts become authoritative after the expiry mutation commits. Decision mutations always enforce the actual server deadline even if the projection job is delayed.

## Projection boundary

`orderDetails.get` returns a discriminated `viewerSide` response.

- Buyer receives the buyer projection, including authorized buyer-internal notes.
- Supplier receives an explicit frozen-snapshot allowlist. It excludes `buyerInternalNotes`, `costCenter`, `projectCode`, session data, authorization internals, audit data, and live organization-profile fields.
- Unknown and foreign orders return the same `ORDER_NOT_FOUND`.

Funding eligibility is computed on the server from the current accepted revision, matching immutable decision/hash, and `unfunded` settlement. The UI does not infer it from a badge.
