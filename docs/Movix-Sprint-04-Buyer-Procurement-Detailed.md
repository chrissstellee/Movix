# Movix Sprint 4 — Detailed Buyer Procurement Plan

**Sprint:** 4  
**Theme:** Buyer dashboard, order list, supplier targeting, purchase-order drafting, immutable revision 1, and pre-acceptance cancellation  
**Default duration:** 10 business days  
**Delivery target:** Buyer-to-sent-order vertical slice  
**Primary implementer:** Elliot  
**Prepared:** July 28, 2026  
**Source sprint plan:** [Movix Testnet MVP Sprint Plan](./Movix-Sprint-Plan.md)  
**Source implementation plan:** [Movix MVP Analysis and Implementation Plan](./Movix-Implementation-Plan.md)  
**Organization boundary:** [Movix Sprint 2 — Detailed Business Onboarding and App Shell Plan](./Movix-Sprint-02-Business-Onboarding-Detailed.md)  
**Contract boundary:** [Movix Sprint 3 — Detailed Smart Contract v1 and Testnet Proof Plan](./Movix-Sprint-03-Smart-Contract-V1-Detailed.md)

## 1. Purpose and planning authority

Sprint 4 enables a buyer-capable Movix organization to create and send a commercially complete purchase order.

This document expands the authoritative Sprint 4 section of `Movix-Sprint-Plan.md`, specifically S4-01 through S4-11. The master sprint plan controls scope and priority. This document controls the implementation contract, sequencing, acceptance evidence, and handoff to Elliot.

The older procurement sequence in `Movix-Implementation-Plan.md` labels this work “Sprint 3.” That numbering was superseded by the contract-first reprioritization. The functionality remains useful input, but this document and the master sprint plan are authoritative.

Sprint 4 is not escrow integration. It creates the exact off-chain commercial agreement that later sprints will accept and fund. It must not:

- Call the escrow contract.
- Create or submit a Stellar transaction.
- Change the frozen contract v1 ABI.
- Present an order as accepted, funded, protected, or on-chain.
- Put commercial text, contacts, addresses, notes, or line items on-chain.

## 2. Sprint outcome

At sprint close, a buyer can:

1. Open `/buyer` and see organization-scoped attention counts, recent order activity, and a clear create-order action.
2. Open `/orders`, filter and page through buyer orders, and return from a detail page without losing list context.
3. Select a registered supplier through an exact verified target.
4. Create a multi-line purchase-order draft with complete header, contact, address, asset, delivery, inspection, funding, and refund terms.
5. Save, refresh, and resume the same server-side draft.
6. See deterministic totals that match the backend and stored integer base units.
7. Review the complete commercial snapshot before sending.
8. Send exactly one immutable revision 1 with a canonical `order-terms-v1` hash.
9. See the order in `sent` / “Awaiting supplier” state.
10. Cancel an eligible draft or sent order with a reason and audit evidence.

Sprint 4 is complete only when the sent revision is immutable, totals reconcile, the supplier target is unambiguous, organization authorization is enforced in Convex, and the critical browser journeys pass.

## 3. Capacity and cut line

The ten-day plan assumes:

- One Web/Product/Design workstream.
- One Backend/Domain workstream.
- QA coverage throughout the sprint.

If Elliot owns all workstreams, plan approximately 18–25 focused engineering days. Preserve S4-01 through S4-10 and move S4-11 before reducing:

- Organization isolation.
- Exact integer amount handling.
- Server-side total recomputation.
- Draft versioning and stale-write protection.
- Immutable revision creation.
- Duplicate-send protection.
- Canonical terms hashing.
- Supplier self-dealing checks.
- Accessibility and critical journey tests.

Do not replace backend authorization, persistence, arithmetic, or idempotency with client-only behavior to meet a calendar target.

## 4. Current repository baseline

Observed at Sprint 4 planning:

| Area | Present | Sprint 4 gap |
|---|---|---|
| Auth and identity | SEP-10 identity, application sessions, verified Testnet wallet, and Convex authentication | Order functions do not exist |
| Organization boundary | Active membership, role capabilities, profile readiness, contacts, addresses, and organization isolation helpers | Order reads/writes must consume these helpers consistently |
| App shell | `/buyer` and `/supplier`, desktop sidebar, mobile Sheet, settings, wallet/network indicator | Buyer page is a placeholder; no order navigation or route-aware breadcrumbs |
| Domain | Agreement, fulfillment, and settlement lifecycles; order capabilities; deterministic fixtures | No order input normalization, amount engine, terms serializer, or order-specific errors |
| Convex schema | Skeleton `relationships`, `orders`, `orderRevisions`, `orderLines`, `notifications`, and `auditEvents` tables | Commercial snapshots, terms, versioning, indexes, idempotency records, and exact list projections are incomplete |
| Convex APIs | Auth, onboarding, organization context, profile editing, and reusable authorization helpers | No supplier lookup, dashboard, order list, draft, send, detail, or cancel functions |
| Web routes | `/buyer` exists | `/orders`, `/orders/new`, and `/orders/[orderId]` do not exist |
| Shared UI | Required Card, Table, Tabs, Badge, Empty, Skeleton, Form, Field, Select, Combobox, Calendar, Dialog, ButtonGroup, and Pagination primitives exist | No order compositions, money fields, line editor, totals panel, or review view |
| Tests | Domain, Convex, component/a11y, auth, organization, and foundation Playwright coverage | No order arithmetic, authorization, draft recovery, send, cancel, or order browser journeys |
| Contract | Escrow v1 engineering proof, generated bindings, deployment manifest, and testnet lifecycle evidence exist | Organizational Sprint 3 sign-offs remain pending; Sprint 4 must not consume the contract at runtime |

Before schema work, inspect the target Convex deployment for existing rows in the order-related skeleton tables. Use direct schema replacement only if the inventory proves those tables contain no data. Otherwise use widen–migrate–narrow.

## 5. Definition of ready

Elliot may begin domain and UI scaffolding immediately. Backend order persistence may begin when:

- `ctx.auth` resolves an active user and verified Testnet wallet.
- The user has one supported active organization context.
- The organization is active, buyer-capable, and buyer-ready.
- `order:draft` and `order:send` capability mappings remain approved.
- Contacts and registered/billing/shipping addresses are readable as organization-scoped records.
- Existing order-related Convex data has been inventoried.
- XLM and testnet USDC metadata and decimal precision come from the existing server-controlled asset configuration.
- The Sprint 3 ABI remains frozen; outstanding Sprint 3 organizational sign-off is recorded but does not cause Sprint 4 to call the contract.

Stop and resolve the prerequisite rather than creating a local authorization, address, asset, or contract workaround.

## 6. Sprint goal and demo

> A buyer-capable organization can create, recover, review, send, browse, inspect, and conditionally cancel a commercially complete purchase order; the backend enforces organization scope, exact totals, optimistic concurrency, supplier identity, immutable revision 1, one send outcome, one notification event, and a canonical terms hash.

The sprint review must show one continuous journey:

1. Sign in as the deterministic buyer owner.
2. Open `/buyer` and show the first-use state and “Create order” action.
3. Open `/orders` and show a stable empty list.
4. Begin `/orders/new`.
5. Select a registered supplier by exact verified Testnet wallet or known relationship.
6. Populate PO header, contacts, address snapshots, dates, asset, and terms.
7. Add at least two line items with different quantities and prices; include one discount or tax example.
8. Show subtotal, discount, tax, shipping, and grand total with the asset code.
9. Save, refresh, and resume the same draft.
10. Demonstrate a stale save from a second tab being rejected without overwriting the newer draft.
11. Review the complete snapshot and send once.
12. Rapidly repeat the send action and show that no second revision, notification, or audit outcome is created.
13. Open `/orders`, see “Awaiting supplier,” apply a filter, and open the detail.
14. Navigate back and show preserved list context if S4-11 is delivered.
15. Attempt an unauthorized cross-organization read and show the stable denial.
16. Cancel the sent order with a reason and show the audit/timeline result.
17. Attempt cancellation from an ineligible fixture state and show that no data changes.
18. Show the 320px line-item card layout and keyboard-accessible create/review flow.

## 7. Fixed product and architecture decisions

Elliot may improve implementation details without changing these behavior contracts.

| Decision | Sprint 4 rule |
|---|---|
| Source of authority | Convex owns drafts, commercial snapshots, agreement status, list projections, notifications, and audit |
| Chain interaction | None in Sprint 4 |
| Buyer identity | Derived from `ctx.auth`, active membership, and organization capability; never trusted from a browser user ID |
| Supplier target | A sent order requires an active supplier-capable organization resolved through an exact verified target |
| Provisional invite | May be stored on a draft as P0/P1 metadata, but cannot be sent until it resolves to one eligible supplier organization |
| Self-dealing | Buyer and supplier organizations must differ; the backend enforces this |
| Draft authority | The server-side draft is authoritative; browser storage may hold non-sensitive view state only |
| Draft concurrency | Every accepted draft mutation requires `expectedVersion`; stale writes change nothing |
| Autosave | Debounced and serialized; never concurrent fire-and-forget writes |
| Revision model | Revision 1 may be edited only while `draft`; send atomically freezes it and its lines |
| Sent immutability | No commercial field or line in a sent revision can be patched |
| PO uniqueness | Case-insensitively unique within the buyer organization |
| Asset/network | Testnet XLM or the one server-allowlisted testnet USDC; browser issuer/contract values are ignored |
| Amount representation | Integer smallest units in persistence and computation; no floating point |
| Quantity representation | Integer coefficient plus explicit decimal scale |
| Rate representation | Integer basis points |
| Rounding | Round half up once at each documented line calculation boundary |
| Terms hash | Backend-generated domain-separated SHA-256 over canonical `order-terms-v1` bytes |
| Send idempotency | One buyer-scoped idempotency key returns one immutable outcome |
| Notification | One in-app notification event is created for the registered supplier organization on send |
| Cancellation | Allowed only from `draft` or `sent`, before acceptance or funding; requires a reason |
| Audit | Draft creation, send, and cancellation are audited in the same transaction as the business change |
| PII | Contacts, addresses, notes, and commercial content remain off-chain and are excluded from broad logs |
| Mainnet | Testnet is visible; no network switch or Mainnet implication |

If one of these decisions must change, record an ADR before dependent implementation.

## 8. Actors and authorization

### 8.1 Buyer draft actor

Roles with `order:draft` may create and edit a draft for their active buyer-capable organization:

- `owner`
- `admin`
- `procurement`

They may not:

- Draft for a browser-supplied organization they do not belong to.
- Select their own organization as supplier.
- Override asset issuer, SAC, network, totals, terms hash, actor, timestamps, or version.
- Read another buyer’s draft.

### 8.2 Buyer send actor

Roles with `order:send` may send a complete draft:

- `owner`
- `admin`
- `procurement`

The backend must separately enforce buyer capability, profile readiness, supplier eligibility, complete commercial data, exact totals, expected version, and idempotency.

### 8.3 Buyer viewer

An active member may read buyer orders only if their organization is a party and their role permits the relevant view. A `viewer` cannot create, edit, send, or cancel.

### 8.4 Supplier organization

Sprint 4 creates a read-target and notification for a registered supplier, but supplier review/accept/reject behavior belongs to Sprint 5. Sprint 4 must not expose buyer-internal notes to the supplier projection.

### 8.5 Suspended and foreign actors

Suspended users, memberships, organizations, paused relationships, and foreign child IDs receive stable denials without revealing whether the target record exists.

## 9. Primary journeys

### 9.1 First buyer order

`/buyer` → `/orders/new` → supplier → details → items → terms → review → send → `/orders/[orderId]`.

### 9.2 Draft recovery

Create or edit → successful server save → refresh/reopen → reload stored revision and lines → continue at the first incomplete section.

### 9.3 Stale tab

Tab A and Tab B load version N → Tab A saves version N+1 → Tab B attempts version N → backend returns `ORDER_STALE` → Tab B offers reload and does not overwrite.

### 9.4 Duplicate send

One review action creates an idempotency key → send is retried with the same key → the same order/revision result returns → one notification and one send audit event exist.

### 9.5 Eligible cancellation

Buyer opens a draft or sent order → confirms cancellation reason → mutation validates state and version → status becomes `cancelled` → audit/timeline updates.

### 9.6 Ineligible cancellation

Accepted/funded/foreign/stale fixture → cancellation denied → no status, version, notification, or audit change.

## 10. Scope

### 10.1 P0 committed

- S4-01 buyer dashboard and next actions.
- S4-02 order list, status tabs, date/asset/status filters, cursor pagination, loading, and empty states.
- S4-03 registered supplier targeting and self-dealing prevention.
- S4-04 complete order header and snapshot fields.
- S4-05 multi-line item editing.
- S4-06 deterministic totals.
- S4-07 server draft save, serialized autosave, refresh recovery, and optimistic concurrency.
- S4-08 complete review snapshot.
- S4-09 immutable revision 1, terms hash, send, notification, and audit.
- S4-10 eligible cancellation.
- Unit, Convex, component, accessibility, responsive, integration, and critical Playwright coverage.
- Sprint 4 evidence index.

### 10.2 P1

- S4-11 preserve list filters and cursor context through detail navigation and browser back.
- Persisted provisional supplier invite metadata if it does not weaken the send gate.
- Privacy-safe buyer order funnel events.

### 10.3 Stretch

- Advanced search.
- Supplier name typeahead beyond exact safe lookup.
- Saved filter presets.

### 10.4 Explicitly out of scope

- File attachments, PDF generation, uploads, or document storage.
- Supplier acceptance/rejection UI.
- Editing and resending revision 2.
- Escrow creation or funding.
- Wallet signing or transaction review.
- Contract calls or event indexing.
- Partial orders, split destinations, multiple shipments, milestones, installments, or partial settlement.
- Automated tax calculation, FX, catalogs, inventory, RFQ, quotes, approvals, ERP, or accounting integration.
- Open supplier marketplace or enumeration endpoint.
- Mainnet.

## 11. Route contract

| Route | Audience | Sprint 4 responsibility |
|---|---|---|
| `/buyer` | Buyer-capable active member | Attention counts, recent activity, first-use state, create action |
| `/orders` | Authenticated organization member | Role-aware list; buyer view is P0 |
| `/orders/new` | `order:draft` actor | Create or resume an order draft |
| `/orders/[orderId]` | Authorized order party | Buyer detail, review snapshot, status, timeline, eligible actions |

Route guards improve UX; Convex authorization remains the security boundary. Direct navigation to an unknown or foreign order returns the same safe not-found/access state.

Add “Orders” to the authenticated shell. Breadcrumbs must recognize list, create, and detail paths without defaulting to “Buyer workspace.”

## 12. Buyer dashboard contract

`/buyer` contains:

- Heading and buyer-view label.
- Primary “Create order” action.
- Attention cards for drafts needing completion and sent orders awaiting supplier.
- Recent order activity, bounded to the latest five records.
- First-use state linking to `/orders/new`.
- Profile-readiness blocker linking to the exact missing settings section.
- Link to `/orders`.

Counts must be exact, organization-scoped, and maintained without unbounded scans or `.collect().length`. Use a bounded transactional counter projection or the approved Convex aggregate component; update it in the same mutation as every order state change.

## 13. Order list contract

### 13.1 Tabs and labels

Buyer tabs:

- All.
- Draft.
- Awaiting supplier (`sent`).
- Accepted.
- Cancelled/rejected.

Customer-facing labels never combine agreement and settlement into one ambiguous status.

### 13.2 Filters

- Status.
- Asset: XLM or USDC.
- Order/issue date from and to.
- Stable cursor pagination.
- Page target: 20 records.

The backend chooses an index for each supported filter combination. It must not load all buyer orders and filter in memory.

### 13.3 Row/card fields

- PO number.
- Supplier legal/trading name snapshot.
- Order title.
- Order or issue date.
- Grand total with asset.
- Agreement status label.
- Updated or sent time.

Desktop uses a table. Narrow screens use labeled cards, not a squeezed table.

## 14. Order creation information architecture

Use five sections with visible completion status:

1. **Supplier** — exact wallet/relationship selection and supplier summary.
2. **Order details** — PO number, title, references, contacts, address snapshots, dates, asset.
3. **Items** — line editor and live totals.
4. **Terms** — delivery, inspection, funding, shipping, and refund policy.
5. **Review** — immutable snapshot preview and send.

Visible labels are required. Placeholders are examples only. A section may be revisited while the order is `draft`. Review is unavailable until all P0 validation passes.

## 15. Commercial field contract

### 15.1 Order identity and parties

- `orderId`: immutable Convex ID.
- `purchaseOrderNumber`: required, normalized display value; comparison value is NFKC, trimmed, collapsed, and lowercase.
- `buyerOrganizationId`: server-derived.
- `supplierOrganizationId`: required before send.
- `relationshipId`: optional for a direct exact-wallet match; create or resolve consistently.
- `title`: required, 2–160 characters.
- `description`: optional, up to 2,000 characters.
- `buyerReference`, `supplierReference`, `costCenter`, `projectCode`: optional, up to 120 characters each.

### 15.2 Contact and address snapshots

The sent revision stores immutable snapshots, not live foreign keys alone:

- Buyer contact.
- Supplier contact.
- Billing address.
- Ship-to address.

Each snapshot contains only the approved business fields required to interpret the order. Later profile edits must not alter the sent revision.

Buyer internal notes remain buyer-only and are excluded from the supplier snapshot and terms hash unless Product explicitly promotes them to shared terms.

### 15.3 Dates

- `orderDate`: required calendar date.
- `issueDate`: required calendar date.
- `requestedDeliveryDate`: required calendar date.
- `supplierAcceptanceDeadline`: required timestamp.
- `fundingDeadline`: required timestamp.
- `validUntil`: optional timestamp.

Rules:

- Requested delivery cannot precede issue date.
- Acceptance deadline must be after send time and before or equal to funding deadline.
- Funding deadline must precede requested delivery unless Product approves a documented exception.
- Calendar inputs are interpreted in the buyer organization’s IANA timezone, then persisted as UTC milliseconds.
- Review displays the timezone.

### 15.4 Asset

The browser sends only a stable asset key such as `testnet:XLM` or `testnet:USDC`. The server resolves:

- Network.
- Code.
- Issuer when applicable.
- SAC/contract ID.
- Decimal precision.

The server rejects unsupported keys and ignores browser-supplied issuer, decimals, contract ID, or network.

### 15.5 Terms

Required:

- `paymentMode = escrow`.
- Delivery method.
- Shipping responsibility.
- Freight charge treatment.
- Inspection period hours.
- Funding deadline.
- Supplier acceptance deadline.
- Refund policy snapshot.
- `autoReleasePolicy = none`.

Optional:

- Delivery window.
- Incoterm and named location.
- Handling instructions.
- Acceptance criteria.
- Warranty text.
- Return terms.
- Shared notes.

## 16. Line items and exact amount contract

Each line stores:

- Stable line ID.
- Positive line number.
- Name.
- Optional SKU, supplier SKU, description, category, manufacturer, brand, and origin.
- Quantity coefficient and quantity scale.
- Unit of measure.
- Positive unit price in asset base units.
- Optional discount: `none`, fixed base units, or rate basis points.
- Optional tax rate basis points and tax code.
- `requiresInspection`, default false.
- Derived gross, discount, tax, and line total base units.

Limits:

- At least one line and at most 100 lines.
- Quantity scale: 0–6.
- Asset precision: 7 decimal places for supported Sprint 4 assets.
- Rate: 0–10,000 basis points.
- Text and array bounds must be explicit in validators.
- Every intermediate and final value must fit signed Convex `int64`.

### 16.1 Canonical arithmetic

For each line:

```text
quantityDenominator = 10 ^ quantityScale
gross = roundHalfUp(quantityCoefficient * unitPriceBaseUnits / quantityDenominator)
discount =
  0
  OR fixedDiscountBaseUnits
  OR roundHalfUp(gross * discountBps / 10_000)
discounted = gross - discount
tax = roundHalfUp(discounted * taxBps / 10_000)
lineTotal = discounted + tax
```

Header totals:

```text
subtotal = sum(line gross)
discountTotal = sum(line discount)
taxTotal = sum(line tax)
shippingTotal = entered non-negative base units
grandTotal = subtotal - discountTotal + taxTotal + shippingTotal
```

Sprint 4 does not tax shipping. Discount may not exceed gross. Grand total must be positive. Use checked `bigint` arithmetic in shared domain code and convert to Convex `int64` only after bounds validation.

The browser may calculate for immediate feedback, but send recomputes every derived value on the backend from stored canonical inputs. Any mismatch is rejected.

## 17. Draft, revision, and lifecycle contract

Canonical agreement path:

```text
draft --save--> draft
draft --send--> sent
draft --cancel--> cancelled
sent --cancel--> cancelled
```

Sprint 4 does not implement:

```text
sent --accept|reject--> ...
accepted --revise--> ...
```

Rules:

- Revision 1 is mutable only while the order is `draft`.
- Every accepted draft or line mutation increments the revision version.
- Sending atomically freezes revision 1, its snapshots, lines, totals, and terms hash.
- Sent data is never patched in place.
- A duplicate send with the same idempotency key returns the first result.
- A different send key after the order is already sent returns the existing sent result or stable `ORDER_ALREADY_SENT`; it never creates revision 2.
- Cancellation changes agreement status and cancellation metadata; it does not delete the revision.
- Hard delete is not a Sprint 4 user action.

## 18. Canonical `order-terms-v1` hash

Sprint 4 owns the first canonical commercial serializer because Sprint 3 deliberately left it to later integration work.

Implement one shared server-authoritative serializer:

- Domain label: `MOVIX_ORDER_TERMS_V1`.
- Encoding: UTF-8.
- Hash: SHA-256, lowercase hexadecimal for Convex storage.
- Object keys: fixed and documented order.
- Integer and timestamp values: canonical base-10 strings.
- Text: Unicode NFKC, normalized line endings, trimmed according to the field rule.
- Optional values: represented consistently; do not alternate between missing, empty string, and null.
- Lines: sorted by line number.
- Snapshot arrays: never rely on insertion order.

Hash input:

```text
UTF8("MOVIX_ORDER_TERMS_V1\0") || canonicalOrderTermsBytes
```

The canonical payload includes all supplier-visible values that acceptance must bind:

- Revision number.
- Buyer and supplier organization identifiers and legal-name snapshots.
- PO number, title, shared references, and shared description/notes.
- Contact and address snapshots.
- Dates and timezone.
- Asset/network/issuer or SAC identity.
- Every line input and derived amount.
- Header totals.
- Delivery, inspection, shipping, funding, acceptance, refund, and auto-release terms.

It excludes:

- Buyer internal notes.
- UI state.
- Audit metadata.
- Notification state.
- Database versions.
- Mutable live profile fields.

Add golden fixtures and cross-runtime tests. Do not hand-build a second serializer in the browser. The browser receives the review projection and backend-computed hash.

## 19. Proposed Convex schema changes

Final names may follow repository conventions, but the data contract may not be weakened.

### 19.1 `relationships`

Add or normalize:

- Active/provisional/paused lifecycle.
- Invite email and exact invite wallet metadata where approved.
- Default contact/address references.
- Server-derived supplier organization binding.
- Version and audit timestamps.

Sent orders require an active resolved supplier organization. Paused relationships block new sends, not existing obligations.

### 19.2 `orders`

Add:

- Buyer/supplier organization IDs.
- Relationship ID.
- Normalized per-buyer PO key.
- Title and asset/list projection fields.
- Current revision ID/number.
- Agreement, fulfillment, and settlement statuses.
- Cancellation actor, reason, and time.
- Sent time.
- Sort timestamp.
- Common mutable fields.

Required indexes include exact field names:

- Buyer organization + normalized PO number.
- Buyer organization + sort timestamp.
- Buyer organization + agreement status + sort timestamp.
- Buyer organization + asset key + sort timestamp.
- Buyer organization + agreement status + asset key + sort timestamp.
- Supplier organization + agreement status + sort timestamp for Sprint 5.

### 19.3 `orderRevisions`

Add the complete header, snapshots, terms, totals, canonical hash, frozen time, and version. A revision is mutable only when its parent is `draft` and `frozenAt` is absent.

### 19.4 `orderLines`

Expand to the complete line input and derived amount contract. Keep one row per line; do not store an unbounded lines array on the revision.

Index by revision and line number. Enforce no duplicate line numbers within a revision.

### 19.5 `orderCommandReceipts`

Store:

- Buyer organization ID.
- Order ID.
- Command type.
- Idempotency key.
- Request fingerprint.
- Result revision/status.
- Created time.

Unique lookup is buyer organization + command type + idempotency key. Reusing a key with different request semantics returns `IDEMPOTENCY_CONFLICT`.

### 19.6 Dashboard count projection

Use one bounded row per organization/side or the approved aggregate component. Counts must update transactionally on create/send/cancel.

### 19.7 Notifications and audit

Extend notification payloads only as required for a safe title, action URL, event/entity IDs, recipient organization/user, and idempotency key. Avoid copying the full order.

Audit records store action, actor, organization, entity, correlation, timestamp, and bounded changed-field names or a redacted hash—not full contacts, addresses, notes, or lines.

## 20. Proposed backend modules and API contract

Keep public Convex functions thin, validated, bounded, and organization-authorized. Suggested modules:

```text
packages/backend/convex/
  orderValidators.ts
  supplierDirectory.ts
  orderDrafts.ts
  orders.ts
  orderDashboard.ts
  lib/orderAuthorization.ts
  lib/orderAmounts.ts
  lib/orderTerms.ts
```

Shared pure domain logic belongs in:

```text
packages/domain/src/orders/
  types.ts
  normalization.ts
  amounts.ts
  terms.ts
  errors.ts
```

### 20.1 Supplier lookup

`supplierDirectory.resolveExact`

- Input: active buyer organization ID plus exact verified Testnet wallet or existing relationship ID.
- Authorization: `order:draft`.
- Output: bounded supplier summary and relationship state.
- Deny same organization, inactive/paused target, wrong network, ambiguous wallet, or non-supplier-capable target.
- Do not expose open supplier enumeration.

### 20.2 Dashboard

`orderDashboard.getBuyerSummary`

- No unbounded collection.
- Returns exact counts, latest five buyer activities, and create eligibility.
- Derives organization context and profile readiness on the server.

### 20.3 List

`orders.listBuyerOrders`

- Input: validated pagination options, status/asset/date filters.
- Uses `.paginate()` with `paginationOptsValidator`.
- Returns a projection, not full sensitive snapshots.
- Uses an organization-first index and stable descending sort.

### 20.4 Create/load draft

`orderDrafts.create`

- Requires `order:draft`, buyer capability, and buyer readiness.
- Accepts an optional client idempotency key.
- Creates one draft order and revision 1.
- Returns IDs and version.

`orderDrafts.get`

- Returns the authorized editable draft projection and lines.
- Foreign/unknown IDs share one safe denial shape.

### 20.5 Save sections and lines

Prefer bounded, intention-revealing mutations:

- `orderDrafts.saveSupplier`
- `orderDrafts.saveHeader`
- `orderDrafts.saveTerms`
- `orderDrafts.upsertLine`
- `orderDrafts.removeLine`
- `orderDrafts.setShipping`

Every mutation:

- Requires `expectedVersion`.
- Confirms parent remains `draft`.
- Validates ownership and child IDs.
- Normalizes input.
- Recomputes totals when relevant.
- Increments one authoritative revision version.
- Returns the accepted version and totals projection.

### 20.6 Review

`orderDrafts.getReview`

- Revalidates completeness.
- Recomputes totals.
- Returns field-specific blockers, review projection, and backend terms hash preview.
- Does not freeze or send.

### 20.7 Send

`orders.send`

Input:

- Order ID.
- Expected revision version.
- Idempotency key.

One Convex transaction:

1. Authorize `order:send`.
2. Load the order, revision, and bounded lines.
3. Confirm `draft`.
4. Resolve the supplier and buyer readiness.
5. Validate every required snapshot and term.
6. Recompute and compare all totals.
7. Build canonical bytes and hash.
8. Freeze revision 1.
9. Set order agreement state to `sent`.
10. Update dashboard count projection.
11. Create one command receipt.
12. Create one supplier notification.
13. Create one audit event.

If any step fails, none commit.

### 20.8 Detail and cancellation

`orders.getById`

- Returns a role-aware projection.
- Buyer view may include buyer-internal notes.
- Supplier projection must omit them.

`orders.cancel`

- Requires order ID, expected version, bounded reason code/details, and idempotency key.
- Allows `draft` or `sent` only.
- Rechecks settlement is `unfunded`.
- Updates status, counts, receipt, and audit atomically.

## 21. Autosave and recovery contract

- Manual save is always available.
- Debounce target: 750–1,000 ms after a valid change.
- Only one save request may be in flight per revision.
- Later edits queue behind the in-flight save.
- “Saved,” “Saving…,” “Unsaved changes,” and “Save failed” are visible status text.
- A failed save retains dirty client state and offers retry.
- Navigation warns only when confirmed unsaved changes remain.
- `ORDER_STALE` stops autosave and offers “Reload latest.”
- Refresh restores the last server-confirmed state, not an unconfirmed browser shadow copy.
- Sensitive order content is not persisted to localStorage.

## 22. Error contract

Use stable codes with safe customer messages:

| Code | Required behavior |
|---|---|
| `ORDER_NOT_FOUND` | Same safe result for unknown and unauthorized IDs |
| `ORDER_FORBIDDEN` | No target details leaked |
| `BUYER_NOT_READY` | Link to exact profile blocker |
| `SUPPLIER_NOT_RESOLVED` | Keep draft; block review/send |
| `SUPPLIER_INELIGIBLE` | Keep draft; explain safe correction |
| `SELF_DEALING_NOT_ALLOWED` | Reject without creating relationship/order target |
| `PO_NUMBER_DUPLICATE` | Point to PO number field |
| `ORDER_INVALID` | Return bounded field errors |
| `ORDER_STALE` | Change nothing; offer reload |
| `ORDER_ALREADY_SENT` | Do not create a new revision |
| `ORDER_IMMUTABLE` | Block edits after send |
| `ORDER_CANNOT_CANCEL` | Preserve state and explain eligibility |
| `AMOUNT_INVALID` | Block save/send; no derived persistence |
| `AMOUNT_OVERFLOW` | Fail safely without partial writes |
| `TOTAL_MISMATCH` | Recompute; never trust browser totals |
| `ASSET_UNSUPPORTED` | Use server allowlist |
| `IDEMPOTENCY_CONFLICT` | Do not replay different work under one key |

Do not return stack traces, raw Convex IDs for foreign records, contacts, addresses, or internal hashes in generic errors.

## 23. Web implementation contract

Suggested target:

```text
apps/web/app/
  buyer/page.tsx
  orders/page.tsx
  orders/new/page.tsx
  orders/[orderId]/page.tsx
apps/web/features/orders/
  buyer-dashboard.tsx
  order-list.tsx
  order-list-filters.tsx
  order-create.tsx
  supplier-step.tsx
  order-header-step.tsx
  line-items-step.tsx
  terms-step.tsx
  order-review.tsx
  order-detail.tsx
  order-totals.tsx
  order-status.tsx
  use-order-autosave.ts
```

Rules:

- Page files compose features; do not place persistence logic directly in route components.
- Use existing `packages/ui` primitives first.
- Amounts use tabular numerals and always show the asset.
- Status uses icon + text + color, never color alone.
- Mobile lines are labeled cards.
- Remove line uses a clear accessible confirmation when data would be lost.
- Send and cancellation use explicit review/confirmation.
- Focus moves to the first invalid field or error summary after failed validation.
- Live autosave status uses a polite live region.
- Support 320px, tablet, and desktop.

## 24. Detailed backlog

## S4-01 — Buyer dashboard and next actions

**Priority:** P0  
**Depends on:** organization context, count projection  
**Delivers:** `/buyer`

Acceptance:

- Counts and activity are derived from the active organization.
- First-use state has one primary create action and an orders link.
- Buyer readiness blocks create without blocking safe list access.
- Latest activity is bounded.
- Loading, empty, error, and ready states are covered.
- Foreign organization data cannot appear.

## S4-02 — Buyer order list

**Priority:** P0  
**Depends on:** order schema/indexes  
**Delivers:** `/orders`

Acceptance:

- Tabs, asset/date/status filters, and stable cursor pagination work.
- Query uses a matching organization-first index.
- Rows/cards contain only the approved projection.
- Loading, empty-filter, end-of-list, error, and retry states work.
- Mobile cards remain readable at 320px.
- Foreign and supplier-only contexts are denied or routed safely.

## S4-03 — Supplier identification

**Priority:** P0  
**Depends on:** organization and wallet identity data  
**Delivers:** supplier step and exact resolver

Acceptance:

- Exact verified Testnet target resolves one eligible supplier organization.
- Same organization, wrong network, inactive, paused, ambiguous, and non-supplier targets are rejected.
- No open wallet/business enumeration is introduced.
- A provisional invite may be saved but cannot pass send validation.
- Sent revision stores immutable supplier identity/name/contact snapshots.

## S4-04 — Order header

**Priority:** P0  
**Depends on:** supplier selection, organization snapshots  
**Delivers:** details step

Acceptance:

- Required header, snapshots, references, dates, asset, deadlines, and terms validate.
- PO number is case-insensitively unique per buyer.
- Server resolves the asset allowlist.
- Date/timezone rules are deterministic.
- PII remains in Convex and safe projections.

## S4-05 — Line items

**Priority:** P0  
**Depends on:** amount domain module  
**Delivers:** multi-line editor

Acceptance:

- Add, edit, reorder, and remove work within the documented bounds.
- Name, quantity, unit, price, optional SKU/discount/tax, and inspection flag persist.
- Zero/negative/overflow/invalid-scale inputs are rejected.
- Duplicate line numbers cannot persist.
- Mobile lines render as labeled cards.

## S4-06 — Deterministic totals

**Priority:** P0  
**Depends on:** S4-05  
**Delivers:** shared exact total engine

Acceptance:

- Client preview, backend recomputation, review, and stored values agree.
- Subtotal, discount, tax, shipping, and grand total follow Section 16.
- XLM and USDC fixtures use 7-decimal integer base units.
- Boundary, rounding, conservation, and overflow tests pass.
- Browser-submitted totals are ignored or rejected when mismatched.

## S4-07 — Draft save and recovery

**Priority:** P0  
**Depends on:** draft APIs and versioning  
**Delivers:** manual save, serialized autosave, resume

Acceptance:

- Draft survives refresh and navigation.
- Save requires expected version.
- Autosaves serialize and never overwrite a newer version.
- Stale tab changes nothing and offers reload.
- Duplicate create does not create multiple drafts for one idempotency key.
- Status is accessible and sensitive draft content is absent from browser storage.

## S4-08 — Complete commercial review

**Priority:** P0  
**Depends on:** complete header, lines, totals, and terms  
**Delivers:** review step

Acceptance:

- Supplier, contacts, addresses, items, totals, dates, delivery, inspection, funding, refund, network, and asset are visible.
- Missing requirements are grouped and link to the field/section.
- Internal notes are visibly distinguished and excluded from supplier terms.
- Testnet and “No funds move when sending” are explicit.
- Review uses the backend projection and hash preview.

## S4-09 — Send immutable revision 1

**Priority:** P0  
**Depends on:** S4-03 through S4-08  
**Delivers:** atomic send

Acceptance:

- Send validates and freezes revision 1 atomically.
- Terms hash follows `order-terms-v1`.
- Order becomes `sent` / “Awaiting supplier.”
- One command receipt, one supplier notification event, and one audit event are created.
- Duplicate/concurrent send cannot create a second revision or side effect.
- Any failed validation leaves the order as an editable draft.
- No contract call or Stellar transaction occurs.

## S4-10 — Pre-acceptance cancellation

**Priority:** P0  
**Depends on:** lifecycle and detail route  
**Delivers:** draft/sent cancellation

Acceptance:

- Buyer may cancel `draft` or `sent` with a bounded reason.
- Accepted, funded, terminal, stale, or foreign orders are denied.
- Cancellation is versioned, idempotent, and audited.
- Revision data remains inspectable.
- Counts and list/detail status update consistently.

## S4-11 — Preserve list context

**Priority:** P1  
**Depends on:** S4-02 and detail navigation  
**Delivers:** return-to-list continuity

Acceptance:

- Filters and pagination context survive detail navigation and browser back.
- URL query parameters are shareable and validated.
- Invalid query parameters degrade safely to defaults.
- No sensitive data is stored in the URL.

## 25. Ten-day execution plan

## Day 1 — Freeze contracts and inventory data

- Review this plan.
- Inventory existing order-related Convex rows.
- Freeze validators, exact amount rules, supplier targeting, snapshot fields, terms payload, and errors.
- Add Sprint 4 evidence index.

**Gate:** No schema, arithmetic, supplier, or hash ambiguity remains.

## Day 2 — Domain and schema

- Implement order types, normalization, exact arithmetic, canonical serializer, and golden fixtures.
- Apply direct or widen–migrate–narrow schema path.
- Add required indexes and validators.

**Gate:** Domain and schema tests pass; migration path is recorded.

## Day 3 — Authorization, supplier resolution, and create

- Add order authorization helpers.
- Implement exact supplier resolution and self-dealing controls.
- Implement idempotent draft creation and load.
- Add two-organization and wrong-party fixtures.

**Gate:** Cross-organization and supplier-target matrices pass.

## Day 4 — Header, terms, and snapshot persistence

- Implement bounded section mutations.
- Resolve asset metadata server-side.
- Snapshot contacts/addresses.
- Enforce date and PO uniqueness rules.

**Gate:** A commercially shaped draft persists with optimistic versioning.

## Day 5 — Lines and totals

- Implement line mutations and server recomputation.
- Add client editor and totals panel.
- Complete boundary/rounding/conservation tests.

**Gate:** Two-line XLM and USDC fixtures reconcile everywhere.

## Day 6 — Autosave and review

- Implement serialized autosave and recovery states.
- Build complete review projection and blocker summary.
- Add backend hash preview and golden cross-runtime verification.

**Gate:** Refresh, stale-tab, and review journeys pass.

## Day 7 — Atomic send and cancellation

- Implement command receipts.
- Implement send freeze, notification, audit, and count updates.
- Implement eligible cancellation.
- Add duplicate/concurrent tests.

**Gate:** One send produces one immutable revision and one set of side effects.

## Day 8 — Dashboard, list, and detail

- Replace buyer placeholder.
- Add list filters/pagination and responsive cards.
- Add buyer detail, timeline, status, and actions.
- Update shell navigation and breadcrumbs.

**Gate:** All four routes work against Convex projections.

## Day 9 — Integration, accessibility, and E2E

- Complete component/a11y coverage.
- Add dedicated-deployment Playwright journeys.
- Test 320px, tablet, desktop, keyboard, screen reader, focus, and reduced motion.
- Complete privacy/log review.

**Gate:** Critical journey and accessibility suites pass.

## Day 10 — Hardening, demo, and closure

- Run all quality gates.
- Execute the demo.
- Capture redacted evidence.
- Resolve all P0 defects.
- Record moved P1 work and sign-offs.

**Gate:** Exit checklist is green or Sprint 4 does not close.

## 26. Test plan

### 26.1 Domain and amount tests

- Normalization and PO comparison.
- Quantity scales 0 and 6.
- Smallest positive amount.
- Half-up boundaries.
- Fixed and rate discounts.
- Zero/cap tax basis points.
- Shipping.
- Discount equals gross.
- Discount exceeds gross.
- Zero/negative grand total.
- `int64` boundaries and overflow.
- Conservation across one, many, and 100 lines.
- XLM and USDC formatting.

### 26.2 Canonical hash tests

- Golden `order-terms-v1` fixture.
- Key and line ordering independence.
- Text normalization and line endings.
- Optional field representation.
- One commercial-field change changes the hash.
- Buyer internal note does not change the hash.
- Same logical payload produces the same hash in all consumers.

### 26.3 Convex authorization tests

- Owner/admin/procurement draft and send.
- Viewer denial.
- Supplier/foreign organization denial.
- Buyer capability denial.
- Suspended user, membership, organization, and relationship.
- Foreign order, revision, and line IDs.
- Same-organization supplier.
- Wrong-network and ambiguous target.
- Safe not-found behavior.

### 26.4 Draft and concurrency tests

- Idempotent create.
- Header/terms/line version increments.
- Refresh recovery.
- Stale section save.
- Stale line upsert/remove.
- Serialized autosave behavior.
- Duplicate PO race.
- Mutation failure changes nothing.

### 26.5 Send and cancellation tests

- Complete send.
- Missing each required group.
- Browser total mismatch.
- Unsupported asset.
- Provisional supplier.
- Duplicate/concurrent send.
- Idempotency key conflict.
- One revision/notification/audit/count transition.
- Sent revision patch denial.
- Draft and sent cancellation.
- Accepted/funded/stale/foreign cancellation denial.

### 26.6 Component and accessibility tests

- Dashboard states.
- List filters, pagination, empty/error.
- Supplier selection.
- Header/date errors.
- Line editing and totals.
- Autosave live status.
- Review blocker focus.
- Send confirmation and pending/duplicate suppression.
- Cancellation confirmation.
- Mobile line cards.
- Automated axe checks on all four routes.

### 26.7 Required Playwright journeys

1. First-use dashboard → create.
2. Two-line create → save → refresh → resume.
3. Exact supplier selection.
4. Invalid/self supplier denial.
5. Stale two-tab save.
6. Complete review → send.
7. Rapid duplicate send.
8. List filter → detail → back.
9. Sent cancellation.
10. Ineligible cancellation.
11. Cross-organization direct navigation.
12. 320px line create/review.
13. Keyboard-only critical journey.
14. Expired session during edit with safe recovery.

Use deterministic fictional fixtures and a dedicated test deployment. Do not depend on public testnet transactions because Sprint 4 has no chain write.

## 27. Quality commands

Baseline:

```powershell
pnpm.cmd --filter @repo/domain format:check
pnpm.cmd --filter @repo/domain lint
pnpm.cmd --filter @repo/domain typecheck
pnpm.cmd --filter @repo/domain test
pnpm.cmd --filter @repo/backend format:check
pnpm.cmd --filter @repo/backend lint
pnpm.cmd --filter @repo/backend typecheck
pnpm.cmd --filter @repo/backend test
pnpm.cmd --filter web format:check
pnpm.cmd --filter web lint
pnpm.cmd --filter web typecheck
pnpm.cmd --filter web test
pnpm.cmd test:e2e
pnpm.cmd build
```

Contract regression gate:

```powershell
cargo test --manifest-path contracts/Cargo.toml --lib
pnpm.cmd --filter @repo/stellar test
```

On Windows, use `pnpm.cmd` rather than changing machine execution policy.

## 28. Security and privacy checklist

- [ ] Every order function derives the user from Convex auth.
- [ ] Every order read/write checks active organization membership.
- [ ] Draft/send capabilities are checked separately.
- [ ] Buyer capability and readiness are server-checked.
- [ ] Supplier lookup is exact and non-enumerating.
- [ ] Buyer and supplier organizations differ.
- [ ] Paused/inactive/unresolved suppliers cannot receive a sent order.
- [ ] Foreign order/revision/line IDs reveal no data.
- [ ] Asset/network/issuer/SAC/decimals are server-controlled.
- [ ] All values use checked integer arithmetic.
- [ ] Browser totals and terms hashes are not authoritative.
- [ ] Sent revisions cannot be modified.
- [ ] Duplicate send/cancel is idempotent.
- [ ] Audit and notifications are transactional and bounded.
- [ ] PII and commercial text are absent from logs and broad audit payloads.
- [ ] No order content is placed in localStorage.
- [ ] No contract call, wallet signature, or transaction occurs.
- [ ] Testnet is explicit.

## 29. Risks and controls

| Risk | Probability | Impact | Control |
|---|---:|---:|---|
| Skeleton schema conflicts with real data | Medium | High | Inventory first; widen–migrate–narrow when needed |
| Totals differ across UI/backend | Medium | Critical | One pure amount module, backend recomputation, golden tests |
| Sent revision remains mutable | Medium | Critical | Frozen flag/state checks on every mutation; immutability tests |
| Duplicate send creates duplicate side effects | Medium | High | Command receipt and transactional idempotency |
| Supplier lookup leaks organization data | Medium | High | Exact verified target; bounded safe projection; no enumeration |
| Provisional supplier is treated as verified | Medium | High | Hard send gate on resolved active supplier organization |
| PO uniqueness races | Medium | Medium | Normalized buyer-scoped unique lookup in transaction |
| Autosave overwrites newer data | Medium | High | Serialized queue and expected version |
| Canonical hash later disagrees with contract integration | Medium | Critical | Versioned serializer, domain separation, golden fixtures |
| List queries scan too broadly | Medium | High | Supported filter combinations mapped to indexes and pagination |
| PII enters audit/evidence | Medium | High | Redacted metadata only; evidence review |
| One engineer exceeds capacity | High | Medium | Preserve P0; move S4-11 and invite polish |

## 30. Definition of done

Every completed item:

- Meets its detailed acceptance criteria.
- Uses active membership and domain capability checks.
- Uses server-controlled Testnet assets.
- Uses exact checked integer arithmetic.
- Is versioned and stale-safe.
- Produces proportional unit, integration, component, accessibility, and browser evidence.
- Covers loading, empty, error, disabled, pending, and success states.
- Works at 320px, tablet, and desktop.
- Reuses `packages/ui` primitives.
- Avoids secrets, unnecessary PII, and commercial data leakage.
- Passes quality and build gates.

Send and cancellation additionally:

- Are atomic and idempotent.
- Save actor/time/correlation evidence.
- Update counts and audit in the same transaction.
- Leave state unchanged on failure.

## 31. Sprint exit checklist

### Buyer experience

- [ ] `/buyer` has exact counts, recent activity, empty state, and create action.
- [ ] `/orders` filters and paginates stably.
- [ ] `/orders/new` creates and resumes a server draft.
- [ ] `/orders/[orderId]` shows the buyer projection and eligible actions.
- [ ] Mobile line items are usable labeled cards.

### Commercial agreement

- [ ] Supplier target is active, resolved, and not the buyer.
- [ ] Header, snapshots, dates, asset, lines, and terms are complete.
- [ ] At least one line is required.
- [ ] Totals reconcile in integer base units.
- [ ] Revision 1 freezes on send.
- [ ] `order-terms-v1` golden tests pass.
- [ ] Sent state is “Awaiting supplier,” not accepted or funded.

### Reliability and security

- [ ] Stale saves change nothing.
- [ ] Duplicate create/send/cancel is safe.
- [ ] One send creates one revision, receipt, notification, audit event, and count transition.
- [ ] Cross-organization matrix passes.
- [ ] Asset allowlist is server-controlled.
- [ ] No contract or wallet action occurs.
- [ ] PII/log review passes.

### Quality

- [ ] Domain, backend, web, a11y, and Playwright suites pass.
- [ ] Build passes.
- [ ] Contract regression gate passes.
- [ ] Evidence index is complete and redacted.
- [ ] No P0 defect remains.
- [ ] Product, Web, Backend, QA, and Security/Privacy decisions are recorded.

## 32. Required review evidence

Create `docs/evidence/sprint-04/README.md` as the index and link:

- Data inventory and migration decision.
- Domain amount boundary/conservation output.
- Canonical hash golden fixture output.
- Supplier resolution and self-dealing matrix.
- Cross-organization authorization matrix.
- Draft refresh and stale-tab evidence.
- Duplicate/concurrent send evidence.
- One-send side-effect count.
- Sent immutability evidence.
- Eligible/ineligible cancellation evidence.
- Desktop and 320px dashboard/list/create/review/detail screenshots using fictional data.
- Keyboard and accessibility report.
- Playwright report.
- PII/log/evidence redaction review.
- Quality/build/contract regression summary.
- Known limitations and moved P1 work.
- Sign-offs.

Evidence must not include live business data, full wallet addresses, raw auth artifacts, secrets, private keys, unredacted contacts/addresses, or production identifiers.

## 33. Closure decision

### Complete

Use only when every P0 exit check is green and Sprint 5 can consume one immutable sent revision without inventing totals, supplier identity, snapshot, hash, or authorization rules.

### Conditional close

Allowed only for S4-11, provisional invite polish, analytics, or cosmetic work with an owner and target sprint.

### Not complete

Use when any of the following remains:

- Order functions trust browser user/organization/role data.
- Cross-organization access is possible.
- Totals use floating point or disagree.
- Browser totals or terms hash are authoritative.
- Sent data remains editable.
- Duplicate send can create multiple revisions or side effects.
- Supplier target is ambiguous, self, inactive, or unresolved.
- Draft recovery or stale protection is missing.
- PO uniqueness is not buyer-scoped and race-safe.
- Critical mobile/accessibility/browser evidence is missing.
- Sprint 4 calls the contract or implies funds are protected.

## 34. Handoff to Sprint 5

**Consumer contract:** [Movix Sprint 5 — Supplier Acceptance Detailed Plan](./Movix-Sprint-05-Supplier-Acceptance-Detailed.md)

**Implementation runbook:** [Sprint 5 Supplier Acceptance](./supplier-acceptance/implementation-runbook.md)

Sprint 5 may assume:

- A sent order targets one active supplier organization.
- Revision 1 is immutable.
- Supplier-visible contacts, addresses, lines, totals, asset, and terms are snapshotted.
- `order-terms-v1` is versioned, deterministic, and backend-generated.
- Agreement status is `sent`.
- Funding and settlement status remain `unfunded`.
- Supplier notification exists idempotently.
- Buyer and supplier projections are organization-authorized.

Sprint 5 still owns:

- Supplier inbox and attention states.
- Secure invitation claim/binding if provisional invitations are activated.
- Supplier review of the exact revision and terms hash.
- Accept/reject with reason.
- Buyer notification of decision.
- Revision 2 and re-acceptance behavior after a material edit.
- Any supplier-side timeline additions.

## 35. Elliot start checklist

Before coding:

- [ ] Read this document and the Sprint 4 section of the master sprint plan.
- [ ] Read `packages/backend/AGENTS.md` and generated Convex guidelines.
- [ ] Confirm Sprint 2 organization/auth gates are green enough to consume.
- [ ] Record Sprint 3 engineering closure and pending organizational approvals.
- [ ] Inventory `relationships`, `orders`, `orderRevisions`, and `orderLines`.
- [ ] Confirm supported Testnet asset metadata from server configuration.
- [ ] Create S4-01 through S4-11 work items and dependencies.
- [ ] Freeze amount, snapshot, supplier, hash, and error contracts on Day 1.
- [ ] Add buyer, supplier, self, foreign, suspended, stale, duplicate, XLM, and USDC fixtures first.
- [ ] Keep S4-11 and provisional invite polish behind every P0 gate.

When uncertain, preserve:

```text
authenticated user
→ active membership and buyer capability
→ resolved non-self supplier
→ versioned server draft
→ exact integer inputs and totals
→ complete immutable revision
→ canonical terms hash
→ atomic sent state, notification, and audit
```

Do not solve uncertainty with browser-trusted identity, floating point, mutable sent data, open supplier enumeration, localStorage order authority, database correction, or a premature contract call.

## 36. Implementation references

Local sources of truth:

- [Movix Testnet MVP Sprint Plan](./Movix-Sprint-Plan.md)
- [Movix MVP Analysis and Implementation Plan](./Movix-Implementation-Plan.md)
- [Sprint 2 organization plan](./Movix-Sprint-02-Business-Onboarding-Detailed.md)
- [Sprint 3 contract plan](./Movix-Sprint-03-Smart-Contract-V1-Detailed.md)
- [Sprint 2 organization authorization ADR](./decisions/ADR-002-sprint-2-organization-authorization-boundary.md)
- `packages/backend/convex/_generated/ai/guidelines.md`
- `packages/backend/convex/schema.ts`
- `packages/backend/convex/lib/authorization.ts`
- `packages/domain/src/lifecycles.ts`
- `packages/domain/src/permissions.ts`
- `packages/domain/src/fixtures.ts`
- `apps/web/features/workspace/workspace-shell.tsx`
- `docs/evidence/sprint-03/README.md`

Re-check current Convex behavior before implementation, especially pagination, indexes, validators, transaction limits, and component-backed aggregates. Do not widen Sprint 4 into a new supplier marketplace, storage system, tax engine, or settlement integration.

## 37. Sign-off

| Discipline | Owner | Status | Date | Notes |
|---|---|---|---|---|
| Product | Nicole / Chris | Pending | — | Scope, required terms, supplier rule, hash contents |
| Design | TBD | Pending | — | Create flow, review, responsive and accessible behavior |
| Web | Elliot | Pending | — | Routes, components, autosave, client states |
| Backend | Elliot / TBD | Pending | — | Schema, authorization, arithmetic, idempotency, hashing |
| QA | TBD | Pending | — | Matrices, E2E, accessibility, evidence |
| Security/Privacy | TBD | Pending | — | Isolation, enumeration, PII, immutability |

Final Product sign-off requires:

- The master Sprint 4 goal and demo are achieved.
- S4-01 through S4-10 are complete.
- Stored and displayed totals reconcile.
- The supplier target is unambiguous.
- Revision 1 is immutable and hash-bound.
- The product is visibly Testnet and makes no funding claim.
- Sprint 5 can accept or reject without redefining the order.
