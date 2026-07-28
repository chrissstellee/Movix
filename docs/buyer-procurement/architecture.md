# Buyer procurement architecture

Status: implemented for Sprint 4  
Scope authority: [Sprint 4 detailed specification](../Movix-Sprint-04-Buyer-Procurement-Detailed.md)

## Boundaries

Sprint 4 is an off-chain buyer-to-sent-order slice. Convex owns identity, the sole active organization context, supplier eligibility, drafts, exact totals, immutable revisions, command receipts, notifications, counters, and audit events. The browser owns transient form state only. Stellar configuration resolves Testnet XLM and USDC metadata on the server; there is no transaction build, signature, wallet prompt, escrow call, or contract mutation.

```mermaid
flowchart LR
  B[Authenticated browser] -->|bounded commands; no buyer org ID| C[Convex public API]
  C --> A[Auth and active membership]
  C --> D[Order domain and exact arithmetic]
  C --> DB[(Organization-scoped records)]
  D --> S[Server-controlled Stellar asset config]
  DB --> P[Buyer/supplier projections]
  C -. no Sprint 4 call .-> X[Stellar network / escrow contract]
```

Every order read derives the active buyer organization from `ctx.auth`. Unknown and foreign IDs return the same `ORDER_NOT_FOUND` denial. Supplier lookup is exact; it is not a browseable directory.

## Components and flow

- `@repo/domain/orders` owns normalization, checked integer arithmetic, display formatting, and `order-terms-v1` bytes.
- `packages/backend/convex/orderDrafts.ts` owns mutable revision 1 and line commands.
- `packages/backend/convex/orders.ts` owns list, detail, atomic send, and cancellation.
- `supplierDirectory.ts`, `orderAuthorization.ts`, and `orderAssets.ts` enforce trust boundaries.
- `apps/web/features/orders` owns buyer views and autosave orchestration. Route files remain compositional.

```mermaid
stateDiagram-v2
  [*] --> draft: idempotent create
  draft --> draft: versioned section/line save
  draft --> sent: atomic send + freeze
  draft --> cancelled: versioned cancel
  sent --> cancelled: cancel while unfunded
  sent --> accepted: Sprint 5
  sent --> rejected: Sprint 5
```

Agreement, fulfillment, and settlement are separate state dimensions. Sprint 4 changes only agreement state and requires settlement to remain `unfunded`.

## Autosave concurrency

```mermaid
sequenceDiagram
  participant U as Buyer
  participant W as Web queue
  participant C as Convex
  U->>W: edit valid header
  W->>W: debounce 850 ms
  W->>C: save(expectedVersion=N)
  Note over W,C: one request in flight
  C-->>W: version N+1
  W-->>U: Saved
  U->>W: stale-tab edit
  W->>C: save(expectedVersion=N)
  C-->>W: ORDER_STALE
  W-->>U: Stale — reload latest
  Note over W: queue stops
```

Draft identity is preserved in the URL (`/orders/new?orderId=…`) for refresh recovery. Commercial content is never placed in local storage.

## Atomic send

```mermaid
flowchart TD
  A[Authorize buyer and order:send] --> B[Check idempotency receipt/fingerprint]
  B --> C[Check draft + expected revision]
  C --> D[Revalidate supplier/readiness/completeness]
  D --> E[Recompute and compare exact totals]
  E --> F[Canonicalize order-terms-v1 and SHA-256]
  F --> G[Freeze revision and mark sent]
  G --> H[Adjust dashboard counts]
  H --> I[Insert receipt, org notification, redacted audit]
```

These steps execute in one Convex mutation. Failed validation rolls back the transaction. Replays with the same key and fingerprint return the recorded result; conflicting reuse fails.

## Migration branch

The configured development deployment was inventoried before rollout. `relationships`, `orders`, `orderRevisions`, and `orderLines` contained zero rows, so the direct canonical replacement branch was used.

```mermaid
flowchart TD
  I[Inventory every target] --> E{All skeleton tables empty?}
  E -->|yes| R[Replace with canonical schema]
  E -->|no| W[Widen optional fields + compatibility reads]
  W --> B[Resumable derivable-only backfill]
  B --> V{No unresolved commercial data?}
  V -->|yes| N[Narrow fields and activate indexes]
  V -->|no| F[Fail closed; operator decision]
```

Any other deployment must repeat inventory. The empty-development result must not be assumed elsewhere.

## Sprint 5 handoff

Sprint 5 may expose supplier organization notifications through active membership, accept/reject a frozen revision, and introduce funding. It must reuse the stored revision and terms hash. It must not select an arbitrary supplier user, rewrite Sprint 4 snapshots, or treat a notification as authorization.
