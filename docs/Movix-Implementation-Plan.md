# Movix MVP Analysis and Implementation Plan

> **Historical architecture baseline:** This plan describes the generic B2B procurement direction used to implement Sprints 0–5. Its technical decisions remain useful, but its product terminology and future delivery sequence were superseded after Sprint 5 by the [ASEAN Agricultural Trade Pivot](./Movix-ASEAN-Agricultural-Trade-Pivot.md), [Sprint Plan](./Movix-Sprint-Plan.md), and [Agricultural Trade Architecture and Migration](./agricultural-trade-architecture-and-migration.md). The body is preserved as implementation history.

**Prepared:** July 27, 2026  
**Planning basis:** `Movix-Idea.md`, current Movix repository, and the Nicole/Justin/Tyler/Kaan party-mode review  
**Delivery target:** Testnet MVP / pilot

## 1. Executive product decision

Movix has a credible core proposition: a buyer proves that funds are committed before a supplier ships, while the supplier is paid only after the buyer confirms delivery. The differentiator is not cryptocurrency alone; it is the combination of a procurement record, verifiable funding, controlled settlement, and a shared audit trail.

The MVP should validate one complete vertical loop:

1. A visitor understands the offer.
2. A business user connects a Stellar wallet and authenticates with SEP-10.
3. The buyer creates and sends a commercially complete order.
4. The supplier accepts the agreed revision.
5. The buyer funds the exact accepted amount into escrow.
6. The supplier verifies funding and records shipment.
7. The buyer confirms delivery and releases funds.
8. Either party can initiate a full mutual refund before release.
9. Both parties can trace every action and on-chain transaction.

Movix should not become a supplier marketplace, ERP, logistics platform, financing platform, or arbitration service in this MVP.

### Mainnet gate

A mutual-refund-only design does not guarantee settlement liveness. After shipment, an absent or hostile buyer can refuse both release and refund, leaving funds locked. The first MVP should therefore remain on testnet unless Movix adds and legally documents a timeout/resolver policy, completes a contract security review, and defines an incident process.

The testnet MVP includes:

- Full mutual refund.
- Buyer cancellation and refund after an unaccepted escrow passes its acceptance deadline.
- Clear disclosure that delivery is an off-chain assertion.
- No claim that the contract independently proves shipment or delivery.

Formal dispute resolution is reserved in the data model but deferred from the testnet user interface and contract v1.

## 2. Repository assessment and constraints

The current repository is an early starter rather than an implemented Movix product:

- `apps/web`: Next.js 16 and React 19, with starter routes.
- `packages/backend`: Convex with only a sample `tasks` table.
- `packages/ui`: an extensive shared shadcn-style component package.
- No Stellar SDK, wallet, SEP-10, test framework, or smart-contract workspace exists yet.
- The root currently permits Node 18, while current Stellar JavaScript guidance requires Node 20 or later.

Planning decisions:

- Retain Next.js and Convex for the MVP.
- Raise and pin the runtime to Node 20 or later during foundation work.
- Add `packages/stellar` for network configuration, wallet adapters, exact amount conversion, transaction builders, event decoding, and generated contract bindings.
- Add `contracts/escrow` as a Rust workspace.
- Reuse `packages/ui`; do not create page-local replacements for existing primitives.
- Introduce Vitest/Testing Library, Playwright, axe-based accessibility checks, Rust contract tests, and a local Stellar integration environment in Sprint 0.

## 3. MVP actors and authorization model

| Actor | Capabilities |
|---|---|
| Visitor | View landing, security explanation, supported wallets/assets, FAQ, and login |
| Authenticated user | Maintain personal session and select an active organization |
| Buyer organization | Create/send orders, fund accepted orders, review delivery, confirm release, request/respond to refunds |
| Supplier organization | Review/accept/reject orders, verify confirmed funding, record shipment, request/respond to refunds |
| Platform operator | Monitor reconciliation, stuck transactions, TTL, and projection mismatches; no broad custody power in MVP |

Important rules:

- SEP-10 authenticates control of a wallet address; it does not grant access to an organization.
- Organization membership and role authorize business actions.
- The same organization may buy in one order and supply in another.
- The MVP UI automatically creates an `owner` membership during onboarding. The membership schema supports future `admin`, `procurement`, `finance`, `operations`, and `viewer` roles, but member-management and multi-step approvals are deferred.
- Every query and mutation must be scoped to an active organization membership.

## 4. Scope

### Included

- Landing page and login page.
- Stellar Wallets Kit/Freighter connection followed by SEP-10 authentication.
- Business onboarding and profile.
- Buyer and supplier dashboard views.
- Counterparty invitation or matching by verified wallet.
- Purchase-order header, line items, terms, revisions, acceptance, and rejection.
- Exact-value XLM and allowlisted Stellar USDC escrow on testnet.
- Supplier funding verification and shipment recording.
- Buyer delivery confirmation and release.
- Full mutual refund, rejection, and withdrawal.
- Transaction history, in-app notifications, timeline, audit records, and reconciliation.
- Basic status/date/asset filters.
- Responsive and accessible loading, empty, error, pending, and success states.

### Deferred

- Open supplier discovery or marketplace.
- Ratings and reputation.
- Purchase requisitions, RFQs, quotes, catalogs, inventory, or three-way matching.
- Employee invitation UI, custom permission overrides, and multi-approver workflows.
- Partial shipment/release/refund behavior in the UI or contract.
- Milestones, installments, split payments, or multi-supplier orders.
- Carrier APIs, automatic delivery proofs, PDFs, uploads, and QR payments.
- Automated tax determination, accounting, ERP, or invoice financing.
- KYC/KYB provider integration, sanctions screening, fiat ramps, and FX.
- Arbitration or unilateral dispute resolution.
- Mainnet deployment.

### Model now, expose later

The data model should preserve multiple contacts and addresses, membership roles, tax/discount/Incoterm fields, multiple shipment allocations, line-level received quantities, partial-refund amount, document metadata, dispute markers, contract versions, and reconciliation metadata. The MVP UI may hide or simplify these fields.

## 5. Route and page map

| Route | Audience | Purpose |
|---|---|---|
| `/` | Public | Landing, value proposition, workflow, security, assets/network, FAQ, login CTA |
| `/login` | Public | Wallet selection, wallet connection, SEP-10 login, recovery states |
| `/onboarding/business` | Authenticated | Business identity, contacts, addresses, preferences, review |
| `/buyer` | Buyer view | Attention items, active orders, delivery review, recent transactions |
| `/supplier` | Supplier view | Incoming orders, fulfillment queue, expected/released funds |
| `/orders` | Authenticated | Role-aware list, basic filters, pagination |
| `/orders/new` | Buyer | Create and review a procurement order |
| `/orders/[orderId]` | Both parties | Canonical, role-aware order, escrow, shipment, refund, timeline, actions |
| `/transactions` | Authenticated | Searchable ledger projection and transaction details |
| `/notifications` | Authenticated | Action-required and informational notifications |
| `/settings/business` | Authenticated | Organization profile and defaults |
| `/settings/wallet` | Authenticated | Wallet, network, session, sign-out |
| `/settings/notifications` | Authenticated | Notification preferences |

Use one authenticated application shell and a visible buyer/supplier view switch. Do not create separate user accounts for each role.

## 6. Lifecycle model

Do not use one overloaded status field. Keep three coordinated lifecycles.

### Agreement

`draft → sent → accepted`

Alternative terminal or revision paths:

- `sent → rejected`
- `draft|sent → cancelled`
- Material edit after sending creates a new revision and returns it to `sent`.

### Fulfillment

`not_started → shipped → delivery_confirmed`

The MVP supports one shipment in the UI, while the schema supports multiple shipments and allocations.

### Settlement projection

`unfunded → funding_submitted → funded → release_submitted → released`

Refund branch:

`funded|accepted|shipped → refund_pending → refund_submitted → refunded`

Cancellation branch:

`funded → cancellation_submitted → cancelled` only after the supplier acceptance deadline and before supplier on-chain acceptance.

Failure returns to the last confirmed safe state after reconciliation. A client timeout never proves that a transaction failed.

### Customer-facing labels

Map the three lifecycles to plain labels:

- Draft
- Awaiting supplier
- Awaiting funding
- Funding confirmation
- Funded
- Ready to ship
- In transit
- Awaiting buyer confirmation
- Release confirmation
- Completed
- Refund approval requested
- Refunded
- Cancelled
- Needs attention

## 7. Business-complete field dictionary

Notation: **R** required, **O** optional, **D** derived/read-only, **S** sensitive or restricted.

### 7.1 User identity and SEP-10 session

User:

- `userId` R, immutable internal ID.
- `primaryWalletAddress` R, verified `G...` address and unique identity mapping.
- `additionalWalletAddresses[]` O; each must be separately authenticated.
- `displayName` R.
- `email`, `phone` O/S; normalized and separately verified if used.
- `avatarUrl` O.
- `locale`, `timezone` R.
- `accountStatus` R: `active|suspended|closed`.
- `lastLoginAt`, `createdAt`, `updatedAt` D.

Session/challenge:

- `sessionId` R/S, stored as a hash.
- `userId`, `authenticatedWallet`, `stellarNetwork` R.
- `activeOrganizationId` O.
- `challengeId`, `challengeHash`, `challengeIssuedAt`, `challengeExpiresAt`, `challengeUsedAt` R/D.
- `issuedAt`, `expiresAt`, `lastSeenAt` R/D.
- `revokedAt`, `revocationReason` O/S.
- `issuer`, `audience`, `jwtKeyId` R/D.

Rules:

- Raw access tokens, refresh tokens, wallet secrets, and private keys are never stored in business tables or audit payloads.
- Raw challenge XDR is short-lived; retain only a restricted hash and verification result after use.
- Wallet switch or network switch requires a fresh SEP-10 flow.

### 7.2 Organization, contacts, addresses, and membership

Organization:

- `organizationId`, `legalName`, `registrationCountry`, `businessEmail` R/S.
- `tradingName`, `entityType`, `registrationNumber`, `taxId`, `industryCode`, `website`, `businessPhone`, `logoUrl` O/S as applicable.
- `businessCapabilities[]` R: `buyer|supplier`.
- `defaultTimezone`, `defaultDisplayCurrency` R.
- `preferredAssetCode`, `preferredAssetIssuer`, `defaultPaymentTermsDays` O.
- `verificationStatus` R: `unverified|pending|verified|rejected`.
- `status` R: `active|suspended|closed`.
- `createdByUserId`, lifecycle timestamps D.

Contact:

- `contactId`, `organizationId`, `contactType`, `name`, `email`, `isPrimary` R/S.
- `phone`, `jobTitle`, `department` O/S.
- Types: procurement, accounts payable, sales, shipping, legal, general.

Address:

- `addressId`, `organizationId`, `addressType`, `recipientName`, `line1`, `city`, `countryCode`, `isDefault` R/S.
- `line2`, `stateProvince`, `postalCode`, `deliveryInstructions` O/S.
- Types: registered, billing, shipping, warehouse, returns.
- Validation is country-aware; state or postal code is not universally required.

Membership:

- `membershipId`, `organizationId`, `userId`, `role`, `status` R.
- Roles: owner, admin, procurement, finance, operations, viewer.
- Status: invited, active, suspended, removed.
- `invitedBy`, `invitedAt`, `acceptedAt`, `removedAt` O/D.
- `spendingLimit`, `approvalLimit`, `permissionOverrides` O; modeled but not enforced in the MVP UI.

### 7.3 Buyer–supplier relationship

- `relationshipId`, `buyerOrganizationId`, `supplierOrganizationId`, `status` R.
- `supplierCode`, buyer/supplier account references O.
- `inviteEmail` O/S, `inviteWalletAddress` O, `invitedByUserId` D.
- Default buyer/supplier contacts and billing/ship-to/return addresses O.
- Default delivery terms, Incoterm, lead time, asset/network O.
- Tax treatment/reference O/S.
- Private notes O/S and lifecycle timestamps D.

Rules:

- Buyer and supplier organizations cannot be identical.
- Relationship defaults are copied into immutable order snapshots.
- A paused relationship blocks new orders, not existing obligations.
- A provisional supplier cannot accept or receive funds until the wallet and organization are verified.

### 7.4 Purchase-order header

- `orderId` R, immutable.
- `purchaseOrderNumber` R, case-insensitively unique per buyer.
- `buyerOrganizationId`, `supplierOrganizationId`, `relationshipId` R.
- Buyer/supplier contact snapshots and billing/ship-to address snapshots R/S.
- `title` R; `description`, buyer/supplier references, cost center, project code O.
- `orderDate`, `issueDate`, `requestedDeliveryDate` R.
- `validUntil`, funding deadline, supplier acceptance deadline O/R according to policy.
- `settlementAssetType`, `assetCode`, `stellarNetwork` R.
- `assetIssuer` R for USDC/credit assets and absent for XLM.
- `subtotal`, `discountTotal`, `taxTotal`, `shippingTotal`, `grandTotal` D.
- `termsVersion`, `revisionNumber`, lifecycle status R.
- Shared notes O; buyer/supplier internal notes O/S.
- Creator/issuer/cancellation actor, reason, and timestamps D/O.

Rules:

- Sending freezes a revision.
- Supplier acceptance binds the exact revision and terms hash.
- Commercial edits after acceptance require a new revision and acceptance.
- Funding amount must equal the accepted `grandTotal`.
- Completion requires confirmed on-chain release.

### 7.5 Line items and totals

- `lineItemId`, `orderId`, `lineNumber`, `name`, `quantity`, `unitOfMeasure`, `unitPrice` R.
- SKU/supplier SKU, description, category, manufacturer, brand, origin O.
- Discount type/value, tax code/rate/amount O.
- `lineSubtotal`, `lineTotal` D.
- Requested delivery date and split destination snapshot O/S.
- `requiresInspection` R, default false.
- `cancelledQuantity`, `fulfilledQuantity`, `receivedQuantity` D.

Rules:

- At least one line is required before send.
- Quantity and unit price are positive exact decimals.
- Asset amounts are stored as integer smallest units; never use floating point.
- Rounding is deterministic and server-validated.
- Discount cannot make a line negative.
- Line totals plus header charges must exactly equal `grandTotal`.

### 7.6 Commercial and delivery terms

- `paymentMode=escrow`, `fundingDeadline`, `deliveryMethod`, `shippingResponsibility`, `freightChargeTreatment`, `inspectionPeriodHours`, and `refundPolicySnapshot` R.
- Supplier acceptance deadline, delivery window, Incoterm/location, handling instructions, acceptance criteria, warranty, return terms, attachment references O.
- `autoReleasePolicy` R and set to `none` for the testnet MVP.

Advanced Incoterm, warranty, and tax controls may be hidden in the first UI but preserved in the schema.

### 7.7 Escrow and payment projection

- `escrowId`, `orderId`, `contractId`, `contractOrderKey`, `contractVersion` R.
- Network passphrase/network key R.
- Immutable buyer/supplier wallet snapshots R.
- Asset type/code/issuer/SAC address R as applicable.
- `requiredAmount`, `fundedAmount`, `releasedAmount`, `refundedAmount`, `remainingAmount` R/D.
- `feeBps`, `feeAmount` R/D; configured to zero in the initial pilot.
- `escrowStatus`, `acceptBy`, `termsHash` R.
- Transaction hashes for fund/release/refund/cancellation O/D.
- Ledger sequence, confirmed time, last chain sync, last reconciled time O/D.
- Initiating and destination wallets O/D.
- Failure code/sanitized message O/S.
- Idempotency key and correlation ID R/S for each command.

Rules:

- Asset/network/SAC addresses come only from server allowlists.
- Convex status is a projection; confirmed contract state is authoritative for funds.
- Supplier wallet cannot change after funding.
- `funded = released + refunded + remaining`.
- A submission is never retried with a new transaction until the original final state is known.

### 7.8 Shipment and fulfillment

Shipment:

- `shipmentId`, `orderId`, `shipmentNumber`, status, ship-from/ship-to snapshots R/S.
- Carrier, service level, tracking number/URL O.
- Shipped, estimated delivery, actual delivery timestamps O.
- Delivery method, package count, weight/unit O.
- Packing slip, supplier invoice, proof references, exception code/notes O/S.
- Creator and lifecycle timestamps D.

Allocation:

- `shipmentItemId`, `shipmentId`, `lineItemId`, `quantityShipped` R.
- Shipped quantity cannot exceed the accepted remaining quantity.

MVP UI creates one shipment but the schema supports multiple allocations.

### 7.9 Delivery confirmation

- `deliveryConfirmationId`, `orderId`, optional `shipmentId` R/O.
- Confirming user/wallet, received time, confirmed time R/D.
- Result: `accepted|accepted_with_note|discrepancy_reported` R.
- Location, recipient, condition, notes, proof references O/S.
- Per-line received/damaged/rejected quantities modeled now.
- Release authorization hash and transaction hash O/D.

Rules:

- Only the buyer can confirm.
- Discrepancy does not release funds.
- Confirmation and release are one clearly reviewed action in the MVP.
- Once release is confirmed, delivery confirmation is irreversible.

### 7.10 Refund

- `refundRequestId`, `orderId`, `escrowId`, initiating organization/user R.
- `refundAmount` R; the MVP fixes it to the full remaining escrow.
- Reason code/details and evidence references R/O/S.
- Status and buyer/supplier decisions R/O.
- Decision actors, notes, timestamps, and expiry O/D/S.
- Refund destination D and locked to the original buyer/funder.
- Transaction hash, ledger, completed time, failure data O/D/S.
- Version and exact `termsHash` R.

Status:

`requested → awaiting_counterparty → approved → refund_submitted → refunded`

Alternatives:

- `awaiting_counterparty → rejected`
- `awaiting_counterparty → withdrawn`
- `awaiting_counterparty → expired`
- `refund_submitted → submission_failed`, followed by reconciliation.

Rules:

- Either party may request; only the opposite party can approve.
- Approval binds exact amount, reason, destination, version, and hash.
- Only one active request exists per escrow.
- Release and refund are mutually exclusive.

### 7.11 Transactions, notifications, audit, and documents

Transaction record:

- Organization/order/escrow IDs, type, direction, asset, amount, network, from/to addresses R/S.
- Transaction hash, ledger, ledger close time, confirmation/business status R/D.
- Initiating user/organization, source function, correlation/idempotency key R/O/S.
- Failure code and sanitized message O.

Notification:

- Recipient user/org, type, title, body, action URL, entity/event IDs, priority, channel, status R.
- Sent/read timestamps, delivery attempts, failure code D/S.
- Financial/security/action-required notices cannot be globally disabled.
- Generate idempotently per recipient/event/type.

Audit:

- Every mutable entity has creator/updater IDs, timestamps, optimistic `version`, source, correlation/request ID, schema version, and archival metadata.
- Append-only audit events store actor user/org/wallet, action, entity, redacted change hash/diff, reason, request metadata, and visibility.
- Never copy tokens, secrets, raw signatures, or unnecessary PII into audit data.

Document metadata, when enabled later:

- Storage reference, type, size, checksum, uploader, access scope, malware-scan status, retention, and lifecycle timestamps.

## 8. Architecture decisions

| ID | Decision | Rationale |
|---|---|---|
| ADR-01 | Retain Convex for the MVP | It fits the existing repo and handles live operational data; replacing it does not improve escrow trust |
| ADR-02 | Wallet connection and SEP-10 authentication are separate | Wallets Kit discovers/connects; SEP-10 proves control and creates a web session |
| ADR-03 | Use separate Stellar and application-JWT signing keys | SEP-10 uses a Stellar key; Convex custom JWT supports RS256/ES256 through JWKS |
| ADR-04 | Soroban owns fund state; Convex owns business workflow | Prevents PII on-chain and makes dashboards/querying practical |
| ADR-05 | Use `create_and_fund` atomically | Removes an unfunded on-chain object and reduces race/reconciliation states |
| ADR-06 | Allowlist XLM and one USDC SAC per network | Prevents malicious token-contract substitution and wrong-issuer funding |
| ADR-07 | Index events into Convex; expose only bounded contract getters | Avoids unbounded `list_user_escrows`/`list_all_escrows` contract calls |
| ADR-08 | Deploy immutable, versioned contract instances for the MVP | Avoids administrator-controlled upgrade custody risk |
| ADR-09 | Testnet-only until liveness/resolver, audit, and legal gates pass | Mutual refund plus buyer release can deadlock after delivery |
| ADR-10 | Use integer smallest units and checked arithmetic | Avoids floating-point and decimal loss |
| ADR-11 | Raise Node requirement to 20+ | Required by current Stellar JS tooling |
| ADR-12 | `packages/ui` is the shared component source | Preserves consistent behavior, accessibility, and design |

### Target repository layout

```text
apps/
  web/
    app/
    features/
    core/
packages/
  backend/
    convex/
  stellar/
    src/
      auth/
      wallet/
      transactions/
      contracts/
      events/
      config/
  ui/
contracts/
  Cargo.toml
  escrow/
    Cargo.toml
    src/
      lib.rs
      types.rs
      storage.rs
      errors.rs
      events.rs
      test.rs
  deployments/
    testnet.json
    pubnet.json
```

Generated TypeScript bindings belong in `packages/stellar`; do not hand-maintain the contract ABI in `apps/web`.

## 9. Wallet connection and SEP-10 architecture

SEP-10 is an active challenge-response authentication standard. It is not the wallet-connection mechanism.

### Login flow

1. User selects a wallet through Stellar Wallets Kit.
2. Browser obtains the selected public address and network.
3. Browser requests `GET /api/auth/stellar/challenge?account=...`.
4. Server creates a sequence-0, time-bounded SEP-10 challenge signed by the Movix Stellar authentication key.
5. Wallet signs the challenge.
6. Browser posts the signed XDR to `POST /api/auth/stellar/token`.
7. Server validates sequence, operations, time bounds, server signature, client signature/threshold, home domain, web-auth domain, account, and network passphrase.
8. Challenge hash is marked used; replay is rejected.
9. Server issues a short-lived RS256 or ES256 application JWT with `sub`, `iss`, `aud`, `iat`, `exp`, and `kid`.
10. Convex validates the JWT using `auth.config.ts` and the Movix JWKS endpoint.
11. A secure HttpOnly refresh/session cookie allows the client auth adapter to obtain a renewed access JWT without exposing a long-lived token to browser storage.

### Required endpoints

- `/.well-known/stellar.toml`
- `/.well-known/jwks.json`
- `/api/auth/stellar/challenge`
- `/api/auth/stellar/token`
- `/api/auth/token`
- `/api/auth/logout`

### Security rules

- SEP-10 Stellar secret and application JWT private key are separate.
- Secrets live only in a managed server secret store/KMS, never Convex documents or `NEXT_PUBLIC_*`.
- Use short challenge and JWT lifetimes.
- Rate-limit challenge and verification routes.
- Enforce origin, CSP, secure cookie, SameSite, issuer, audience, domain, and passphrase checks.
- Do not log signed XDR, tokens, secrets, or full addresses unless operationally required and access-restricted.
- Login copy must say: “Signing in does not transfer funds.”

## 10. On-chain/off-chain authority and reconciliation

### Soroban is authoritative for

- Escrow ID.
- Buyer and supplier addresses.
- Token/SAC address.
- Gross amount and fee snapshot.
- Funded, accepted, shipped, refund-pending, released, refunded, or cancelled state.
- Terminal payout.

### Convex is authoritative for

- Users, organizations, memberships, contacts, and addresses.
- Order content, line items, revisions, delivery terms, and private notes.
- Shipment detail and evidence metadata.
- Notifications, searchable lists, dashboards, and audit views.
- Transaction submissions and the indexed projection of confirmed contract state.

### Reconciliation

- Save every submitted transaction hash before showing a persistent submitted state.
- Poll RPC for finality and ingest contract events with a durable cursor.
- Confirm material transitions with `get_escrow(id)`, not an event alone.
- Scheduled jobs repair missed events and resume transactions after browser closure.
- Nightly controls compare active liabilities per SAC to contract balances, active escrow entries, event cursor lag, projection mismatches, and TTL.
- Alert on stuck submissions, repeated auth failures/replays, RPC degradation, low TTL, balance/liability mismatch, and high refund/failure rates.

## 11. Soroban escrow contract design

### Contract v1 stance

- Testnet-only.
- One pooled escrow contract instance per deployed version.
- Immutable versioned deployment; no public upgrade entry point.
- XLM and an explicitly configured USDC SAC.
- One full release or full refund per escrow.
- Platform fee capability is snapshotted but configured to zero for the pilot.
- No PII, commercial text, addresses, invoices, or files on-chain.

### Core types

```text
EscrowId = BytesN<32>

Status =
  Funded
  Accepted
  Shipped
  RefundPending
  Released
  Refunded
  Cancelled

Escrow =
  schema_version
  id
  buyer
  supplier
  token
  gross_amount
  fee_bps
  fee_amount
  status
  resume_status
  created_at
  accept_by
  terms_hash
  shipment_hash?
  delivery_hash?
  refund_proposer?
  refund_terms_hash?
  last_updated_at

Config =
  treasury
  supported_sac_addresses
  max_fee_bps
  ttl_thresholds
```

`resume_status` is used only while a refund is pending so rejection or withdrawal returns to the prior active state.

### Public functions and authorization

| Function | Authorization | Transition/effect |
|---|---|---|
| `__constructor(config)` | Deployment-time initialization | Stores config atomically |
| `create_and_fund(id, buyer, supplier, token, amount, fee_bps, accept_by, terms_hash)` | Buyer | Validates unique ID/allowlisted asset/positive amount/distinct parties/deadline/fee, transfers SAC tokens buyer → contract, stores `Funded` |
| `get_escrow(id)` | Public read | Returns one bounded record |
| `accept(id, supplier, terms_hash)` | Snapshotted supplier | `Funded → Accepted`; hash must match |
| `mark_shipped(id, supplier, shipment_hash)` | Snapshotted supplier | `Accepted → Shipped` |
| `confirm_delivery(id, buyer, delivery_hash)` | Snapshotted buyer | `Shipped → Released`; contract transfers net to supplier and configured fee to treasury |
| `propose_refund(id, proposer, refund_terms_hash)` | Buyer or supplier | Active state → `RefundPending`; remembers prior state |
| `approve_refund(id, approver, refund_terms_hash)` | Opposite party | Matching proposal → `Refunded`; transfers full remaining principal to buyer |
| `reject_refund(id, approver, refund_terms_hash)` | Opposite party | Restores prior active state |
| `withdraw_refund(id, proposer, refund_terms_hash)` | Original proposer | Restores prior active state |
| `cancel_unaccepted(id, buyer)` | Buyer after `accept_by` | `Funded → Cancelled`; full refund |

Do not implement `list_user_escrows` or `list_all_escrows`; lists and pagination use indexed Convex projections.

### Token flow

- Use `soroban_sdk::token::TokenClient` with network-specific SAC addresses.
- XLM and Stellar USDC both move through their SAC.
- Buyer authorization is required at the escrow entry point before the nested transfer.
- Contract-originated terminal transfers use the current contract address.
- Reject negative/zero amounts and use checked arithmetic.
- Check the accepted token decimals/configuration off-chain; never accept a browser-provided contract address.
- Confirm USDC trustline/authorization and balance during preflight.

### Invariants

- Escrow IDs are unique within a deployment.
- Buyer, supplier, token, gross amount, fee, and terms hash cannot change after funding.
- Only defined state transitions occur.
- Terminal states are immutable.
- Exactly one terminal payout path can succeed.
- Terminal payouts sum exactly to the funded amount.
- Active token liability decreases exactly once.
- Contract token balance is never below tracked active liability.
- Requester cannot approve their own refund.
- Refund approval hash must exactly match the proposal.
- Release cannot occur during refund pending or after refund/cancellation.
- All state and token changes are atomic; a failed transfer rolls back the transition.

### Storage, events, and errors

- Small global config: instance storage.
- Escrow and per-token liability: fine-grained persistent keys.
- Extend active escrow, liability, instance, and code TTL on hot paths and with an off-chain keeper.
- TTL expiry is never a business deadline or security rule.
- Emit typed events for funded, accepted, shipped, refund proposed/rejected/withdrawn/approved, released, refunded, and cancelled.
- Event topics include event name and escrow/participant identifiers; data includes token, amount, status, and hashes. No PII.
- Use stable typed error codes for not initialized, unsupported asset, invalid amount, same party, escrow exists/not found, invalid transition, deadline state, terms mismatch, same-party approval, arithmetic failure, and invariant violation.

### Mainnet extension decision

Before mainnet, choose one:

1. A published timeout/auto-release policy with explicit buyer inspection window and legal terms, or
2. A delayed, independently controlled multisig resolver with public dispute policy.

That choice must be modeled, tested, reviewed, and audited in the first mainnet contract rather than added as an informal operator workaround.

## 12. Visual system and UI reuse

### Direction

Movix should feel like financial infrastructure: black, restrained, precise, and calm. Neutral surfaces carry most content; the red-to-pink gradient signals primary intent.

Suggested tokens:

```css
--background: #070708;
--surface-1: #101012;
--surface-2: #17171a;
--surface-hover: #202024;
--border: #2a2a30;
--text-primary: #fafafa;
--text-secondary: #a7a7b0;
--text-muted: #74747e;
--brand-red: #f43f5e;
--brand-pink: #ec4899;
--brand-gradient: linear-gradient(110deg, #f43f5e 0%, #ec4899 100%);
--success: #34d399;
--warning: #fbbf24;
--danger: #fb7185;
--info: #60a5fa;
```

Use the gradient only for:

- Primary CTA.
- Active navigation indicator.
- Key progress/completion accent.
- Small brand highlights.

Do not use gradient text for money, tables, body text, transaction IDs, or status badges. Status always uses icon + label + color, never color alone. Currency uses tabular numerals and always shows the asset, such as `1,250.00 USDC`.

### Existing `packages/ui` mapping

| Need | Existing primitives |
|---|---|
| App shell/navigation | `Sidebar`, `Sheet`, `NavigationMenu`, `Breadcrumb`, `DropdownMenu`, `Avatar` |
| Forms | `Form`, `Field`, `Input`, `InputGroup`, `Select`, `NativeSelect`, `Combobox`, `RadioGroup`, `Checkbox`, `Switch`, `Textarea`, `Calendar` |
| Data/status | `Card`, `Table`, `Tabs`, `Badge`, `Progress`, `Chart`, `Pagination`, `Empty`, `Alert` |
| Confirmation | `Dialog`, `AlertDialog`, `Drawer`, `Popover`, `Tooltip` |
| Feedback | `Skeleton`, `Spinner`, common loading components, `Sonner` |

Create two shared compositions early using those primitives:

- `TransactionReview`: action, amount/asset, counterparty, order, network, fee, resulting state, sign/pending/confirmed/error.
- `OrderTimeline`: agreement, funding, fulfillment, release/refund, actors, timestamps, and explorer links.

### Required interaction states

Every page covers:

- Loading/skeleton.
- Empty/first use.
- Validation or access error.
- Partial data/reconciliation warning.
- Disabled/ineligible action.
- Wallet disconnected/wrong network.
- Signature waiting/rejected.
- Submitted/ledger pending.
- Confirmed success.
- Session expired/re-authentication.

### Accessibility and responsiveness

- WCAG AA contrast, visible 2px focus ring, keyboard navigation, screen-reader live regions, semantic headings, accessible names, focus management, and reduced-motion support.
- Desktop persistent sidebar, tablet/mobile `Sheet`, and usable 320px layouts.
- Dense tables become labeled record cards on narrow screens.
- Forms keep visible labels; placeholders are examples only.
- Destructive/irreversible settlement uses `AlertDialog`.
- Long hashes/addresses truncate visually but expose full accessible copy/view actions.

## 13. Page/functionality-based phases and sprints

Sprint length may be adjusted to team capacity. Keep the order and exit gates; each sprint is a vertical slice and includes testing.

### Phase 0 — Delivery contract

#### Sprint 0: Foundation, lifecycle, schema, and CI

Pages/functionality:

- Confirm route map, roles, lifecycle transitions, copy vocabulary, analytics events, and privacy boundary.
- Replace starter task schema with the domain skeleton and test builders.
- Add `packages/stellar`, `contracts/escrow`, generated binding path, validated network config, and Node 20+.
- Establish black/red-pink tokens and app-shell composition with `packages/ui`.
- Set up Vitest/Testing Library, Playwright, axe, Rust test/build, local Stellar integration, and CI.

Testing:

- State-transition and permission-matrix tests.
- Schema validation and exact-amount fixtures.
- UI token contrast checks.
- CI smoke test for TypeScript and Rust.

Exit:

- Every action has actor, prerequisite, success, failure, and retry behavior.
- Product, schema, contract, and UI use the same lifecycle vocabulary.

### Phase 1 — Acquisition, authentication, and business identity

#### Sprint 1: Landing and login

Pages: `/`, `/login`

Functionality:

- Landing hero, buyer/supplier workflow, security explanation, supported assets/network, FAQ, footer/legal links.
- Wallet selection and connection through Wallets Kit.
- SEP-10 challenge, signing, verification, JWT/JWKS/Convex authentication, refresh, logout, wallet switch.
- Clear network mismatch, unsupported wallet, rejected connection/signature, expired challenge, and session expiry states.

UI:

- `NavigationMenu`, `Button`, `Card`, `Badge`, `Accordion`, `Alert`, `Dialog`, `Tooltip`, `Spinner`, `Skeleton`, `Sonner`.

Testing:

- SEP-10 malformed XDR, wrong domain/network/account, expired challenge, missing/extra signatures/operations, replay, JWT expiry/refresh.
- Component and Playwright tests for success, rejection, retry, wrong network, logout, and reconnect.
- Keyboard, screen-reader, contrast, 320px/tablet/desktop checks.

Exit:

- A visitor understands Movix and reaches login.
- A supported-wallet user obtains a verified session.
- Login copy distinguishes authentication from payment authorization.

#### Sprint 2: Business onboarding, profile, and app shell

Pages: `/onboarding/business`, `/settings/business`, `/settings/wallet`

Functionality:

- Stepped business identity, address, contact, preferences, review, and consent.
- Auto-create owner membership and associate the verified wallet.
- Persist draft/resume and enforce profile completeness only where needed.
- Role-aware authenticated shell, buyer/supplier view switch, wallet/network indicator, notification count, and sign-out.

UI:

- `Sidebar`, `Sheet`, `Breadcrumb`, `DropdownMenu`, `Avatar`, `Form`, `Field`, inputs, selects, `Calendar`, `Progress`, `Card`, `Alert`.

Testing:

- Field normalization, country-aware address validation, duplicate wallet/business, organization isolation, draft recovery, optimistic versioning.
- Onboarding/profile Playwright tests and responsive navigation.
- Error association, progress semantics, focus restoration, and accessibility.

Exit:

- A user creates a commercially usable profile and reaches the dashboard.
- One organization cannot read or edit another.

### Phase 2 — Procurement agreement

#### Sprint 3: Buyer dashboard, order list, create order

Pages: `/buyer`, `/orders`, `/orders/new`, `/orders/[orderId]`

Functionality:

- Buyer attention counts, recent activity, and create-order CTA.
- Role-aware list with basic status/date/asset filters and pagination.
- Draft/autosave/recovery.
- Supplier, header, line items, contacts/addresses, commercial/delivery/refund terms.
- Deterministic totals and final review.
- Send immutable revision and cancel before acceptance/funding.

UI:

- `Card`, `Badge`, `Table`, `Tabs`, `Chart`, `Empty`, `Skeleton`, form primitives, `Calendar`, `Textarea`, `Dialog`, `ButtonGroup`, `Pagination`.

Testing:

- Quantity/price/discount/tax/shipping/rounding and asset-precision unit tests.
- Duplicate PO/submission, invalid dates/wallets, self-dealing organization, stale version.
- Draft recovery and create/edit/send/cancel Playwright journeys.
- Mobile line items as cards, not squeezed tables.

Exit:

- Buyer sends a commercially complete and immutable revision.
- Totals are identical in client, backend, and review display.

#### Sprint 4: Supplier inbox, review, acceptance, rejection

Pages: `/supplier`, `/orders`, `/orders/[orderId]`

Functionality:

- Incoming queue and supplier attention states.
- Secure wallet/invitation binding.
- Full revision and terms-hash review.
- Accept or reject with reason.
- Buyer notification and re-acceptance after revision.

UI:

- Shared order detail using `Breadcrumb`, `Card`, `Badge`, `Tabs`, `Table`, `Progress`, `AlertDialog`, `Textarea`, and canonical timeline.

Testing:

- Supplier organization isolation, designated-counterparty access, expired/reused/mismatched invitation.
- Stale acceptance, revision supersession, accept/reject concurrency.
- Send/receive/accept/reject Playwright journeys.
- Notification deduplication and audit entries.

Exit:

- Only the designated supplier can accept the exact revision.
- Rejected/expired/superseded orders cannot be funded.

### Phase 3 — Escrow and fulfillment

#### Sprint 5: Contract core and escrow funding

Page/functionality: funding panel on `/orders/[orderId]`

Functionality:

- Implement contract constructor, create-and-fund, getter, allowlisted SAC transfer, liability, TTL, events, and typed errors.
- Review amount/asset, buyer/supplier, network, contract, terms hash, balance/trustline, and fee.
- Simulate, sign, submit, save hash, confirm, reconcile, resume after refresh.
- Supplier-visible proof of confirmed funding.

UI:

- Shared `TransactionReview` using `Card`, `Alert`, `Badge`, `Button`, `Dialog`, `Spinner`, `Progress`, `Tooltip`, and `Sonner`.

Testing:

- Rust unit/property/auth/event/TTL tests: zero/negative/max amount, wrong asset, same parties, duplicate ID, fee limits, deadline, exact liability.
- SAC integration for XLM-like and USDC-like assets, missing trustline, deauthorized balance, failed transfer.
- TypeScript amount/config/builder/event-decoder tests.
- Web-to-local-ledger tests and Playwright success, rejection, delayed confirmation, disconnect, and refresh recovery.

Exit:

- An accepted order funds once and only once.
- Both parties see the same confirmed asset, amount, contract, network, hash, and ledger.
- Failed/submitted transactions never masquerade as funded.

#### Sprint 6: Supplier on-chain acceptance, shipment, delivery confirmation, release

Page/functionality: role-aware actions on `/orders/[orderId]`

Functionality:

- Supplier verifies funding and signs acceptance of the same terms hash.
- Supplier records shipment and on-chain shipment hash.
- Buyer reviews shipment and inspection warning.
- Buyer confirms delivery and releases payment in one explicit transaction.
- Completed receipt, timeline, notification, and reconciliation.

UI:

- Shipment `Form`; lifecycle `Progress`; `Card`, `Badge`, `Alert`, `Dialog`, and irreversible release `AlertDialog`.

Testing:

- Contract auth and transition tests for accept, ship, release, repeat release, post-refund release, wrong party/hash, terminal immutability, payout conservation.
- End-to-end funded → accepted → shipped → confirmed → released.
- Race/repeated click, signature rejection, delayed ledger, transaction failure, and browser refresh.
- Adaptive shipment fields and mobile no-horizontal-scroll check.

Exit:

- Supplier cannot fulfill an unaccepted/unfunded order.
- Buyer release is terminal, idempotent, exact, and visible only after confirmation.
- This sprint provides the first full product-value validation.

### Phase 4 — Exceptions and transparency

#### Sprint 7: Mutual refunds and unaccepted timeout cancellation

Page/functionality: refund section on `/orders/[orderId]`

Functionality:

- Implement propose, approve, reject, withdraw, refund, and unaccepted-timeout cancellation.
- Show full remaining amount, asset, reason, initiator, counterparty action, expiry, exact terms hash, and resulting state.
- Reconcile and notify both organizations.

UI:

- `Form`, `RadioGroup`, `Textarea`, `Card`, `Alert`, `Badge`, `Dialog`, `AlertDialog`, `Progress`.

Testing:

- Opposite-party consent, same-party rejection, hash mismatch, stale request, withdrawal/rejection restore, expiry, double refund, release-vs-refund race, terminal state.
- Full buyer- and supplier-initiated Playwright paths.
- Wallet rejection, delayed confirmation, retry, notification, and audit tests.

Exit:

- Either party requests; only the counterparty approves.
- Release and refund cannot both execute.
- Unaccepted escrow can return to the buyer after the objective deadline.

#### Sprint 8: Transactions, notifications, dashboard completion

Pages: `/transactions`, `/notifications`, enhanced `/buyer` and `/supplier`

Functionality:

- Immutable normalized transaction projection.
- Filter by status, asset, date, type, order, and counterparty.
- Detail drawer with hash, network, contract, fee, initiator, ledger, and explorer.
- Read/unread notification center and deep links.
- Action-required dashboard counts and reconciliation warnings.

UI:

- `Table`, `Tabs`, date range, `Combobox`, `Pagination`, `Badge`, `Drawer`, `Empty`, `Skeleton`, `Card`, `DropdownMenu`.

Testing:

- Ordering, pagination, filter/query-state persistence, organization isolation.
- Correct explorer network and transaction-to-order reconciliation.
- Notification generation/read-state/deep-link idempotency.
- Action → notification → history Playwright path.
- Large/empty history, narrow record-card layout, accessibility.

Exit:

- Every fund/release/refund is traceable from order to confirmed chain transaction.
- Users can find required actions without inspecting each order.

### Phase 5 — Pilot hardening

#### Sprint 9: Complete journey and testnet pilot readiness

Pages/functionality:

- Refine all routes and canonical loading/empty/error/pending/disconnected/wrong-network/session-expired states.
- Session recovery, wallet switching, observability, analytics, support copy, runbooks, scripted deployment/reconciliation.
- No major new feature.

Testing:

- Full buyer/supplier/dual-role regression.
- Supported wallet, browser, mobile/tablet/desktop, accessibility, and visual-regression matrix.
- Contract fuzz/property/mutation/static-analysis tests and resource profiling.
- Load/recovery tests for dashboard, notification, and reconciliation workers.
- RPC outage, browser closure, session expiry, wallet/network switch, indexer lag, TTL, and projection repair.
- Gated testnet smoke run and external contract/security review.

Exit:

- Two new pilot organizations can complete the full journey without developer help.
- Interrupted transactions reconcile without duplicate or corrupt state.
- Testnet operational runbook and mainnet-blocking decisions are documented.

## 14. Cross-sprint definition of done

Every sprint must include:

- Page and functionality acceptance criteria.
- Backend authorization and organization isolation.
- Loading, empty, error, disabled, pending, and success states.
- Buyer, supplier, dual-role, disconnected-wallet, and expired-session paths where applicable.
- Unit, component, integration, and critical Playwright tests proportional to the slice.
- Keyboard and screen-reader smoke tests.
- Automated accessibility/contrast checks.
- Mobile, tablet, and desktop checks.
- Duplicate-submission and optimistic-concurrency tests.
- Transaction rejection, delayed confirmation, refresh recovery, and idempotency tests where funds are involved.
- Audit, notification, observability, and reconciliation evidence for state-changing financial paths.
- Reuse audit against `packages/ui`.

## 15. Pilot success criteria

North-star: **funded orders settled correctly**, either released to the supplier or refunded without manual database correction.

Suggested pilot signals:

- Five buyer–supplier pairs complete onboarding.
- Twenty full testnet escrow lifecycles.
- Three buyers create a second order.
- At least 90% of non-user-rejected supported-wallet login attempts succeed.
- Median create-to-send time under five minutes.
- At least 90% of accepted orders reach confirmed funding without staff intervention.
- Zero unauthorized releases/refunds.
- Zero duplicate settlements or unexplained balance variance.
- Zero unresolved terminal projection/contract differences.
- Pilot users can explain when funds are locked, releasable, or refundable.

## 16. Risks and release gates

| Risk | Mitigation/gate |
|---|---|
| Buyer disappears after delivery | Testnet-only; choose timeout/resolver before mainnet |
| Wallet/login friction | Separate connection/auth steps; recovery states; wallet matrix tests |
| Chain/database divergence | Submitted/confirmed distinction, event cursor, getters, reconciliation jobs |
| Wrong USDC issuer or malicious token | Fixed server allowlist and network configuration |
| Decimal or payout error | Integer base units, checked math, property tests, payout invariants |
| Duplicate settlement | Contract terminal states, idempotency keys, hash reconciliation |
| PII exposure | Convex-only private data; on-chain hashes/addresses/amounts only |
| Contract archival/TTL | Hot-path extension, keeper, monitoring, recovery rehearsal |
| Unbounded contract query/cost | Fine-grained storage, bounded getter, Convex index for lists |
| Contract upgrade custody | Immutable versioned MVP deployments |

## 17. Current authoritative references

- [SEP-10: Stellar Web Authentication](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md)
- [Stellar authentication guide](https://developers.stellar.org/docs/build/apps/wallet/sep10)
- [Stellar Asset Contract](https://developers.stellar.org/docs/tokens/stellar-asset-contract)
- [Contract authorization](https://developers.stellar.org/docs/build/guides/auth/contract-authorization)
- [Contract storage and archival](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival)
- [Contract testing](https://developers.stellar.org/docs/build/guides/testing)
- [Convex custom JWT provider](https://docs.convex.dev/auth/advanced/custom-jwt)

Verify live Stellar protocol/SDK versions, network limits, contract/SAC addresses, wallet-kit API, RPC provider, and SEP status again during Sprint 0 and before every deployment.
