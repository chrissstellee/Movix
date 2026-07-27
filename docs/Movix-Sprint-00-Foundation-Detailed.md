# Movix Sprint 0 — Detailed Foundation Plan

**Sprint:** 0  
**Theme:** Foundation, lifecycle, schema, design system, testing, and CI  
**Default duration:** 5 business days  
**Delivery target:** Foundation for the Movix testnet MVP  
**Source sprint plan:** [Movix Testnet MVP Sprint Plan](./Movix-Sprint-Plan.md)  
**Source implementation plan:** [Movix MVP Analysis and Implementation Plan](./Movix-Implementation-Plan.md)

## 1. Sprint purpose

Sprint 0 exists to remove ambiguity before feature development begins.

Its outcome is not a finished customer page. Its outcome is an executable delivery contract: product, design, web, backend, Stellar, contract, QA, and DevOps all use the same routes, lifecycle vocabulary, permissions, data ownership, repository boundaries, fixtures, and quality gates.

The sprint succeeds when Sprint 1 can implement landing and SEP-10 login without inventing architecture or business rules.

## 2. Capacity assumption

The five-day schedule assumes parallel coverage from at least:

- One Product/Design owner.
- One Web engineer.
- One Backend engineer.
- One Stellar/Contract engineer.
- One QA/DevOps owner.

People may cover multiple disciplines, but the workstreams must run concurrently.

If one developer is completing all work, retain the scope and execute it over approximately 2–3 weeks. Cutting lifecycle, authorization, exact-amount, contract, or testing foundations to preserve an arbitrary one-week date creates false velocity and pushes risk into financial features.

## 3. Current repository baseline

Observed at Sprint 0 planning:

- `apps/web` contains a Next.js 16/React 19 starter.
- `packages/backend` contains Convex and a sample `tasks` schema.
- `packages/ui` contains the shared UI primitives required by Movix.
- `packages/stellar` does not exist.
- `contracts` does not exist.
- `.github` and CI workflows do not exist.
- No application or contract test files are present outside installed dependencies.
- The root `package.json` permits Node `>=18`.
- Root scripts cover build, development, formatting/lint fixes, and Husky preparation, but not dedicated test, typecheck, or contract commands.
- `packages/ui/src/styles/globals.css` still uses the starter neutral light/dark token set rather than the Movix visual system.

Sprint 0 must close these gaps or deliberately record why an item was deferred.

## 4. Sprint goal

> Establish a tested and documented foundation in which every MVP action has a route, actor, permission, lifecycle transition, source of truth, repository owner, fixture, and quality gate.

## 5. Sprint demo

The Sprint 0 review must demonstrate:

1. The approved route map.
2. Agreement, fulfillment, and settlement transition tables.
3. The actor/permission matrix.
4. The on-chain/off-chain data authority matrix.
5. A Convex domain-schema skeleton.
6. A buildable `packages/stellar` package.
7. A buildable/testable Rust escrow-contract skeleton.
8. Movix design tokens applied to a shared shell/component sample.
9. Deterministic buyer, supplier, order, and asset fixtures.
10. CI running lint/typecheck, web tests/build, and contract tests/build.
11. One intentionally failing test or rule violation being caught by CI.

## 6. Sprint scope

### P0 committed scope

- Route map and page ownership.
- Domain vocabulary and state transitions.
- Actor and permission matrix.
- On-chain/off-chain authority decisions.
- Convex schema skeleton and index plan.
- `packages/stellar` package skeleton.
- `contracts/escrow` Rust workspace skeleton.
- Node 20+ baseline.
- Unit/component, Playwright, accessibility, and contract test harnesses.
- CI workflow and root quality commands.
- Movix visual tokens and shared-component reuse rules.
- Deterministic test fixtures/builders.
- Sprint 1 definition of ready.

### P1 scope

- Privacy-safe analytics event catalog.
- ADR templates and initial architecture decision records.
- Local Stellar container smoke test in CI if environment setup remains reliable within the sprint.

### Explicitly out of scope

- Production landing-page implementation.
- Real wallet connection.
- SEP-10 challenge implementation.
- Functional SAC transfers.
- Complete production Convex mutations and queries.
- Complete escrow business logic.
- Mainnet deployment or mainnet secrets.
- New page-local UI component library.

## 7. Working agreements

- `packages/ui` is the source of reusable UI primitives.
- New shared components require a demonstrated gap; page-specific composition is allowed.
- Browser code never owns private keys, server auth secrets, authoritative contract IDs, or allowed token addresses.
- Financial amounts use integer smallest units, never floating point.
- Convex is the searchable operational source; Soroban is the asset-settlement source.
- A submitted Stellar transaction is not a confirmed business outcome.
- PII and commercial text stay off-chain.
- Every public Convex function must explicitly authorize its caller and organization scope.
- Every change must keep the main branch buildable and testable.

## 8. Delivery roles and RACI

Replace discipline names with actual owners during kickoff.

| Deliverable | Product | Design | Web | Backend | Stellar/Contract | QA | DevOps |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Route map | A | R | C | C | C | C | I |
| Lifecycle tables | A/R | C | C | R | R | C | I |
| Permission matrix | A | C | C | R | C | R | I |
| Authority/data classification | A | C | C | R | R | C | C |
| Convex schema skeleton | C | I | C | A/R | C | C | I |
| `packages/stellar` | I | I | C | C | A/R | C | C |
| Contract workspace | I | I | I | C | A/R | C | C |
| Design tokens | C | A/R | R | I | I | C | I |
| Test harness | I | C | R | R | R | A/R | C |
| CI | I | I | C | C | C | C | A/R |
| Fixtures | C | I | C | R | R | A/R | I |
| Sprint sign-off | A | C | C | C | C | R | C |

Legend:

- **R:** Responsible.
- **A:** Accountable.
- **C:** Consulted.
- **I:** Informed.

## 9. Foundation decisions to approve

## 9.1 Route map

| Route | Access | Primary actor | Primary action | Sprint delivered |
|---|---|---|---|---:|
| `/` | Public | Visitor | Understand Movix and choose login | 1 |
| `/login` | Public | Wallet holder | Connect wallet and authenticate | 1 |
| `/onboarding/business` | Authenticated, no completed org required | New user | Create business profile | 2 |
| `/buyer` | Active organization | Buyer view | Find buyer actions and orders | 3 |
| `/supplier` | Active organization | Supplier view | Find incoming/fulfillment actions | 4 |
| `/orders` | Active organization | Buyer or supplier | Browse role-aware orders | 3–4 |
| `/orders/new` | Active buyer organization | Buyer | Create procurement order | 3 |
| `/orders/[orderId]` | Authorized buyer/supplier | Both parties | Review and perform lifecycle action | 3–8 |
| `/transactions` | Active organization | Both parties | Trace financial transactions | 8 |
| `/notifications` | Active organization | Both parties | Find required actions | 8 |
| `/settings/business` | Owner/admin | Organization owner | Maintain business profile/defaults | 2 |
| `/settings/wallet` | Authenticated user | Wallet holder | View wallet/network and sign out | 2 |
| `/settings/notifications` | Active organization | User | Maintain permitted preferences | 8 |

Route rules:

- Public routes do not require Convex identity.
- Authenticated routes require a valid application JWT.
- Organization routes also require active membership.
- Order detail access requires the active organization to be the snapshotted buyer or supplier.
- The same authenticated shell supports buyer and supplier views; users do not create separate accounts.

## 9.2 Domain vocabulary

Use these terms consistently:

| Canonical term | Meaning | Avoid |
|---|---|---|
| Wallet connection | Selecting a wallet and obtaining address/network | Calling this SEP-10 authentication |
| Authentication | Proving wallet control through SEP-10 and receiving an application session | “Logging in” without explaining the signature |
| Order revision | Immutable snapshot sent to a supplier | Editing an accepted order in place |
| Funding submitted | Transaction has a hash but is not confirmed | “Funded” |
| Funded | Contract getter confirms locked assets | Treating client submission as final |
| Shipment recorded | Supplier asserted shipment and committed a hash | “Blockchain verified shipment” |
| Delivery confirmation | Buyer authorizes receipt and release | “Oracle-confirmed delivery” |
| Release submitted | Release transaction is awaiting finality | “Paid” |
| Released | Contract confirms supplier payout | “Processing” |
| Refund pending | One party proposed; counterparty must decide | “Refunded” |
| Reconciled | Application projection matches confirmed contract state | Assuming an event alone is authoritative |

## 9.3 Agreement lifecycle

Agreement state is an off-chain business record in Convex.

| From | Action | Actor | Preconditions | To | Rejected when |
|---|---|---|---|---|---|
| `draft` | Save/edit | Buyer | Active membership and current version | `draft` | Stale version or unauthorized organization |
| `draft` | Send revision | Buyer | Valid complete order and designated supplier | `sent` | Invalid totals, missing fields, or duplicate send |
| `draft` | Cancel | Buyer | Not sent/funded | `cancelled` | Unauthorized or terminal |
| `sent` | Accept revision | Supplier | Exact active revision and relationship | `accepted` | Expired, superseded, cancelled, or wrong supplier |
| `sent` | Reject revision | Supplier | Exact active revision | `rejected` | Already decided, superseded, or wrong supplier |
| `sent` | Cancel | Buyer | Not accepted/funded | `cancelled` | Accepted, funded, or stale version |
| `accepted` | Create material revision | Buyer | No funded escrow | Existing revision remains immutable; new revision becomes `sent` | Escrow already funded |

Terminal agreement states:

- `rejected`
- `cancelled`

`accepted` is not terminal for the overall order; it is the prerequisite for funding.

## 9.4 Fulfillment lifecycle

Fulfillment state is primarily off-chain, with compact hashes committed on-chain for audit binding.

| From | Action | Actor | Preconditions | To |
|---|---|---|---|---|
| `not_started` | Record shipment | Supplier | Agreement accepted; escrow confirmed `Accepted` | `shipped` |
| `shipped` | Correct non-material metadata | Supplier | Does not change committed shipment identity/hash without a new version | `shipped` |
| `shipped` | Confirm delivery and release | Buyer | No active refund; escrow remains `Shipped` | `delivery_confirmed` after confirmed release |

Rules:

- Shipment cannot begin before confirmed funding and supplier on-chain acceptance.
- Carrier updates never release funds.
- “Delivery confirmed” appears only after the coupled release transaction is confirmed.
- A discrepancy path starts a refund request; it does not release.

## 9.5 Contract and settlement lifecycle

Contract status is authoritative for locked funds. Convex adds submitted/failure projection states around confirmed contract states.

### Confirmed contract status

| From | Function | Required auth | To |
|---|---|---|---|
| None | `create_and_fund` | Buyer | `Funded` |
| `Funded` | `accept` | Snapshotted supplier | `Accepted` |
| `Funded` | `cancel_unaccepted` after deadline | Snapshotted buyer | `Cancelled` |
| `Accepted` | `mark_shipped` | Snapshotted supplier | `Shipped` |
| `Shipped` | `confirm_delivery` | Snapshotted buyer | `Released` |
| `Funded|Accepted|Shipped` | `propose_refund` | Buyer or supplier | `RefundPending` |
| `RefundPending` | `approve_refund` | Opposite party | `Refunded` |
| `RefundPending` | `reject_refund` | Opposite party | Prior active status |
| `RefundPending` | `withdraw_refund` | Original proposer | Prior active status |

Terminal contract statuses:

- `Released`
- `Refunded`
- `Cancelled`

### Convex settlement projection

| Projection | Meaning |
|---|---|
| `unfunded` | No submitted or confirmed funding |
| `funding_submitted` | Hash saved; final state unknown |
| `funded` | Contract confirms `Funded` or later active state |
| `acceptance_submitted` | Supplier transaction pending |
| `accepted` | Contract confirms `Accepted` |
| `shipment_submitted` | Shipment transaction pending |
| `shipped` | Contract confirms `Shipped` |
| `release_submitted` | Release transaction pending |
| `released` | Contract confirms `Released` |
| `refund_pending` | Contract confirms `RefundPending` |
| `refund_submitted` | Approval/refund transaction pending |
| `refunded` | Contract confirms `Refunded` |
| `cancellation_submitted` | Timeout cancellation transaction pending |
| `cancelled` | Contract confirms `Cancelled` |
| `needs_reconciliation` | Submitted/event/application state needs getter verification |

Projection rules:

- A client error after submission does not return the projection to the prior state until the hash is reconciled.
- Terminal projection comes only from a confirmed contract getter.
- Reconciliation may repair projection state but cannot rewrite the contract.

## 9.6 Permission matrix

Sprint 0 defines the complete policy even though the MVP UI initially creates only an owner.

| Capability | Visitor | Authenticated, no org | Owner/Admin | Procurement | Finance | Operations | Viewer | Platform operator |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View public pages | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create organization | — | ✓ | — | — | — | — | — | — |
| Edit organization | — | — | ✓ | — | — | — | — | Restricted support only |
| View organization | — | — | ✓ | ✓ | ✓ | ✓ | ✓ | Restricted support only |
| Create/edit draft order | — | — | ✓ | ✓ | — | — | — | — |
| Send/cancel pre-acceptance order | — | — | ✓ | ✓ | — | — | — | — |
| Accept/reject supplier order | — | — | ✓ | ✓ | — | ✓ | — | — |
| Fund escrow | — | — | ✓ | — | ✓ | — | — | — |
| Record shipment | — | — | ✓ | — | — | ✓ | — | — |
| Confirm delivery/release | — | — | ✓ | — | ✓ | ✓ | — | — |
| Request refund | — | — | ✓ | ✓ | ✓ | ✓ | — | — |
| Approve refund | — | — | ✓ | — | ✓ | — | — | — |
| View transactions | — | — | ✓ | ✓ | ✓ | ✓ | ✓ | Restricted support only |
| View audit history | — | — | ✓ | Scoped | ✓ | Scoped | Read-only scoped | Restricted support only |
| Repair application projection | — | — | — | — | — | — | — | ✓, no fund movement |
| Move escrow funds administratively | — | — | — | — | — | — | — | — |

Security rules:

- Wallet authentication is not organization authorization.
- Backend authorization is mandatory even when UI hides a control.
- The platform operator cannot use a database mutation to move on-chain funds.
- Support access must be logged, restricted, and unnecessary for the pilot’s normal flow.

## 9.7 Data authority and classification

| Data | Source of truth | Classification | On-chain? |
|---|---|---|:---:|
| Wallet address and network | SEP-10/session + snapshots | Public identifier, operationally sensitive | Address only |
| User contact data | Convex | Sensitive | No |
| Organization legal/contact data | Convex | Sensitive/business confidential | No |
| Order header and line items | Convex immutable revision | Business confidential | Hash only |
| Addresses and delivery instructions | Convex snapshots | Sensitive | No |
| Escrow parties/token/amount/status | Soroban | Public financial | Yes |
| Shipment details | Convex | Business confidential | Hash only |
| Delivery evidence | Convex/object storage later | Sensitive | Hash only |
| Refund reason/details | Convex | Business confidential | Terms hash only |
| Transaction hash/ledger | Stellar + Convex projection | Public financial | Already on-chain |
| Notifications | Convex | Private | No |
| Audit trail | Convex append-only | Restricted | No |
| Secrets/private keys/session tokens | Secret store or transient memory | Secret | Never |

## 9.8 Environment matrix

| Environment | Network | Data | Secrets | Contract deployment |
|---|---|---|---|---|
| Local | Standalone/local Stellar | Disposable fixtures | Local non-production | Local deterministic deployment |
| Development | Stellar testnet | Developer data | Development-only | Development testnet contract |
| Preview/CI | Local or isolated testnet smoke | Disposable | CI-scoped | Ephemeral/local deployment |
| Pilot | Stellar testnet | Pilot data | Pilot-isolated | Versioned pilot contract |
| Production | Mainnet, future only | Production | Production KMS | Blocked until mainnet gates pass |

Environment rules:

- Testnet and mainnet never share keys, contract IDs, cookies, issuer/audience, or records.
- Network passphrase and allowed SAC addresses are validated server-side.
- Browser-visible config contains no secret and cannot select arbitrary contracts.

## 10. Proposed repository target after Sprint 0

```text
.
├─ .github/
│  └─ workflows/
│     └─ ci.yml
├─ apps/
│  └─ web/
│     ├─ app/
│     ├─ core/
│     └─ test/
├─ contracts/
│  ├─ Cargo.toml
│  └─ escrow/
│     ├─ Cargo.toml
│     └─ src/
│        ├─ lib.rs
│        └─ test.rs
├─ docs/
│  ├─ decisions/
│  ├─ domain/
│  └─ product/
├─ packages/
│  ├─ backend/
│  │  └─ convex/
│  ├─ stellar/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ amounts.ts
│  │     ├─ config.ts
│  │     ├─ wallet/
│  │     ├─ auth/
│  │     ├─ transactions/
│  │     ├─ contracts/
│  │     └─ events/
│  └─ ui/
├─ playwright.config.ts
├─ vitest.config.ts
└─ package.json
```

The exact configuration-file placement may change during implementation, but the package boundaries must remain.

## 11. Convex schema skeleton

Sprint 0 creates table and index shapes, validators, and representative fixtures. It does not implement every production mutation.

| Table | Purpose | Required initial indexes |
|---|---|---|
| `users` | Wallet-authenticated application identity | `by_primary_wallet`, `by_status` |
| `wallets` | Additional verified wallet mappings | `by_address`, `by_user` |
| `organizations` | Business profile and defaults | `by_status`, `by_created_by` |
| `memberships` | User-to-organization role | `by_user`, `by_organization`, `by_org_user`, `by_org_status` |
| `contacts` | Typed organization contacts | `by_organization`, `by_org_type` |
| `addresses` | Typed business addresses | `by_organization`, `by_org_type` |
| `relationships` | Buyer–supplier relationship | `by_buyer`, `by_supplier`, `by_pair`, `by_status` |
| `orders` | Current order pointer and lifecycle | `by_buyer`, `by_supplier`, `by_buyer_status`, `by_supplier_status`, `by_po_number` |
| `orderRevisions` | Immutable commercial snapshots | `by_order`, `by_order_revision`, `by_terms_hash` |
| `orderLines` | Revision line items | `by_revision`, `by_revision_line` |
| `shipments` | Fulfillment records | `by_order`, `by_supplier`, `by_status` |
| `shipmentLines` | Shipment allocations | `by_shipment`, `by_order_line` |
| `escrows` | Application projection of contract | `by_order`, `by_escrow_key`, `by_buyer`, `by_supplier`, `by_status`, `by_reconciliation_status` |
| `transactionRecords` | Submitted and confirmed transactions | `by_hash_network`, `by_order`, `by_escrow`, `by_organization`, `by_status` |
| `refundRequests` | Refund workflow projection | `by_escrow`, `by_status`, `by_counterparty_action` |
| `notifications` | Durable user action/information items | `by_recipient`, `by_recipient_status`, `by_event_recipient_type` |
| `auditEvents` | Append-only audit history | `by_entity`, `by_organization`, `by_actor`, `by_correlation` |
| `reconciliationCursors` | Durable chain/event progress | `by_network_contract` |

Schema rules:

- Validators are explicit; avoid unbounded arbitrary objects for core fields.
- Accepted revisions and audit events are append-only.
- Mutable entities include optimistic `version`.
- Monetary fields use integer/string-safe representations supported by the chosen Convex validator strategy.
- Organization IDs appear on records that require direct scoping.
- Sensitive fields are not returned by broad list queries.
- Indexes support intended query paths; public queries do not use unrestricted `.collect()` for growing tables.

## 12. `packages/stellar` boundary

Sprint 0 deliverable is a buildable package with tested foundational utilities and placeholders for later implementation.

Proposed public modules:

| Module | Sprint 0 responsibility |
|---|---|
| `config` | Typed environment/network/passphrase/RPC/explorer/allowed-asset configuration |
| `amounts` | Exact display-to-base-unit and base-unit-to-display conversion |
| `wallet` | Wallet adapter types and unsupported/disconnected error model |
| `auth` | SEP-10 types/interfaces only; real flow begins Sprint 1 |
| `transactions` | Submitted/confirmed/failure result types and orchestration interfaces |
| `contracts` | Generated-binding destination and escrow client interface placeholder |
| `events` | Typed normalized event shape and decoder interface |

Required Sprint 0 tests:

- Exact conversion rejects exponent notation, negatives where disallowed, excess decimals, overflow, empty values, and locale separators not explicitly supported.
- Network configuration fails closed when passphrase, RPC, explorer, or SAC values are missing.
- Testnet and mainnet configuration cannot be mixed.

## 13. Contract workspace boundary

Sprint 0 creates:

- Rust workspace.
- `escrow` contract crate.
- `#![no_std]` contract skeleton.
- `__constructor` placeholder or minimal config storage.
- Typed placeholder `Config`, `Escrow`, `Status`, `DataKey`, `Error`, and one smoke event if needed.
- Native Rust unit-test harness.
- `wasm32v1-none` build target documented in setup.
- Release profile appropriate for contract WASM.

Sprint 0 does not implement token movement or production lifecycle methods.

Contract smoke acceptance:

- `cargo test` passes.
- Contract builds for the Stellar-supported WASM target.
- Constructor can be registered in a unit test.
- One config getter or equivalent smoke call proves storage and generated client operation.
- No mutable initialization function can reinitialize the contract.

## 14. Design-system foundation

## 14.1 Core tokens

Add the Movix token intent to `packages/ui/src/styles/globals.css`:

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
--success: #34d399;
--warning: #fbbf24;
--danger: #fb7185;
--info: #60a5fa;
```

Gradient intent:

```css
linear-gradient(110deg, #f43f5e 0%, #ec4899 100%)
```

Use the gradient only for:

- Primary CTA.
- Active navigation indicator.
- Small progress/completion accent.
- Brand highlight.

Do not use it for:

- Money.
- Tables.
- Body copy.
- Transaction hashes or wallet addresses.
- Status badges.
- Destructive actions.

## 14.2 Component rules

- Reuse `Button`, `Card`, `Form`, `Field`, `Input`, `Select`, `Dialog`, `AlertDialog`, `Table`, `Tabs`, `Badge`, `Sidebar`, `Sheet`, `Skeleton`, `Spinner`, `Empty`, and `Sonner`.
- Accessibility behavior stays in shared primitives.
- Page code composes primitives; it does not fork them.
- Status communicates through icon, text, and color.
- Amounts use tabular numerals and always include the asset.
- Visible focus ring must meet contrast on black and gradient surfaces.

## 14.3 Sprint 0 UI sample

Create one non-production foundation sample or Storybook-equivalent fixture showing:

- Primary, secondary, outline, disabled, and destructive actions.
- Card/surface hierarchy.
- Status badges for pending, success, warning, failure, and neutral.
- Form field with help and error.
- Loading skeleton/spinner.
- Empty and alert states.
- Truncated wallet/transaction identifier with accessible full-value control.

The sample proves tokens and primitives; it is not the landing page.

## 15. Test architecture

## 15.1 Required layers

| Layer | Tooling intent | Sprint 0 evidence |
|---|---|---|
| Type/lint/format | Existing TypeScript, oxlint, oxfmt | Dedicated non-mutating CI commands or verified equivalents |
| Web unit/component | Vitest + React Testing Library | One shared UI/application component test |
| Accessibility | axe integration plus keyboard checks | One automated accessibility assertion |
| End-to-end | Playwright | Application boots and a starter route is reachable |
| Backend | Convex-compatible test strategy | Schema/validator or function authorization test skeleton |
| Contract unit | Rust + `soroban-sdk` test utilities | Constructor/config smoke test |
| Contract build | Stellar WASM target | Release WASM builds |
| Integration | Local Stellar environment | Documented command; CI P1 if stable |

## 15.2 Planned root commands

Final names may be adjusted to repository conventions, but CI needs clear equivalents:

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:e2e
pnpm test:a11y
pnpm test:contracts
pnpm build
```

Avoid using a mutating `lint:fix` command as the only CI lint gate.

## 15.3 Sprint 0 test cases

Product/domain:

- Every allowed transition appears once.
- Every disallowed transition returns a stable reason.
- Terminal settlement states have no outgoing financial transition.
- Every action maps to an authorized role.

Schema:

- Valid buyer/supplier/order fixture passes.
- Same buyer/supplier organization fails.
- Duplicate organization membership pair fails at mutation policy level.
- Invalid status values fail validation.
- Sensitive fields do not appear in broad projection fixtures.

Amounts/config:

- `1.2500000` converts deterministically.
- Excess decimal precision fails.
- Negative and zero values fail where required.
- Wrong network/SAC pairing fails.

UI:

- Primary button, form error, alert, and status have accessible names.
- Focus is visible.
- Token contrast passes agreed thresholds.
- Sample works at 320px and desktop.

Contract:

- Constructor stores config.
- Constructor cannot run twice.
- Getter returns expected typed config.
- Unit and WASM builds pass.

CI:

- A deliberately broken fixture/test is caught during workflow validation, then reverted before sprint close.

## 16. Deterministic fixture catalog

All fixtures are fake and safe to commit.

| Fixture | Required properties |
|---|---|
| `buyerUser` | Verified test wallet, active account, timezone |
| `supplierUser` | Different verified test wallet, active account |
| `buyerOrganization` | Buyer capability, contacts, billing and shipping addresses |
| `supplierOrganization` | Supplier capability, sales and dispatch contacts |
| `buyerOwnerMembership` | Active owner membership |
| `supplierOwnerMembership` | Active owner membership |
| `activeRelationship` | Buyer/supplier pair and default terms |
| `draftOrder` | Complete header, two lines, deterministic totals |
| `sentRevision` | Revision 1, terms hash, immutable snapshots |
| `acceptedRevision` | Supplier actor/time and matching terms hash |
| `xlmAsset` | Testnet native SAC config and 7-decimal behavior |
| `usdcAsset` | Testnet issuer/SAC fixture and configured precision |
| `fundedEscrowProjection` | Confirmed hash/ledger/amount/status |
| `invalidFixtures` | Same-party order, wrong asset, negative amount, stale version |

Fixture rules:

- Never generate random values inside assertions.
- Wallet addresses are valid test-only addresses.
- Expected totals and hashes are stable.
- Time is controlled through a test clock.
- Factories allow only intentional overrides.

## 17. CI pipeline

Minimum workflow stages:

1. Checkout.
2. Install pinned Node 20+ and pnpm.
3. Install dependencies with frozen lockfile.
4. Formatting check.
5. Lint.
6. Typecheck.
7. Unit/component/backend tests.
8. Accessibility smoke.
9. Web build.
10. Install/pin Rust toolchain and WASM target.
11. Contract format/lint where configured.
12. Contract unit tests.
13. Contract WASM build.
14. Playwright smoke.

CI rules:

- Pull requests cannot merge with a failed P0 gate.
- Secrets are not printed.
- Test artifacts are retained on failure where safe.
- Dependency caching does not bypass lockfile checks.
- Contract and web failures are reported separately.
- Local and CI commands match.

## 18. Initial architecture decision records

Create concise ADRs for:

| ADR | Decision |
|---|---|
| ADR-001 | Retain Convex for the testnet MVP |
| ADR-002 | Separate Wallets Kit connection from SEP-10 authentication |
| ADR-003 | Separate SEP-10 Stellar key from application JWT key |
| ADR-004 | Soroban owns asset state; Convex owns business workflow/projection |
| ADR-005 | Use atomic `create_and_fund` |
| ADR-006 | Allowlist network-specific XLM and USDC SACs |
| ADR-007 | Use events + bounded getter; no on-chain list queries |
| ADR-008 | Use immutable versioned contract deployments for MVP |
| ADR-009 | Keep release testnet-only until liveness/resolver and audit gates pass |
| ADR-010 | Use integer smallest units and checked arithmetic |
| ADR-011 | Require Node 20+ |
| ADR-012 | Reuse `packages/ui` shared primitives |

Each ADR records context, decision, trade-offs, consequences, and revisit trigger.

## 19. Analytics event catalog

P1 events to define, not necessarily instrument fully:

| Event | Privacy-safe properties |
|---|---|
| `landing_cta_selected` | CTA location |
| `wallet_selector_opened` | Page/context |
| `wallet_connection_result` | Wallet type, categorized result, network |
| `sep10_challenge_result` | Categorized result, network |
| `authentication_result` | Categorized result, network |
| `onboarding_step_completed` | Step number/name |
| `order_draft_created` | Organization capability, asset |
| `order_sent` | Asset, line count, duration bucket |
| `order_decision_recorded` | Accept/reject, duration bucket |
| `transaction_submission_result` | Action type, asset, categorized result |
| `transaction_confirmation_result` | Action type, duration bucket, categorized result |
| `reconciliation_mismatch_detected` | Action type, mismatch category |

Do not include:

- Full wallet addresses.
- Business names.
- Order descriptions.
- Raw XDR.
- Tokens or secrets.
- Free-text failure payloads.

## 20. Detailed backlog

## S0-01 — Approve route map and page ownership

**Priority:** P0  
**Disciplines:** Product, Design, Web  
**Estimate:** 0.5 person-day

Tasks:

- Validate all routes in Section 9.1.
- Name page audience and primary action.
- Mark public, authenticated, organization-protected, and counterparty-protected routes.
- Record the sprint that first delivers each route.
- Resolve whether redirects use middleware, server checks, or page-level guards in Sprint 1 planning.

Acceptance:

- No MVP page exists without an access rule.
- Landing and login are explicitly included.
- Buyer and supplier use one account/session model.
- Order detail is role-aware, not duplicated.

Deliverable:

- Approved route map in this file or `docs/product/route-map.md`.

## S0-02 — Approve lifecycle state machines

**Priority:** P0  
**Disciplines:** Product, Backend, Contract, QA  
**Estimate:** 1 person-day

Tasks:

- Review Sections 9.3–9.5.
- Assign stable enum/string values.
- Define actor, precondition, next state, event, audit record, and error for each transition.
- Distinguish submitted application states from confirmed contract states.
- Add state-machine test cases.

Acceptance:

- Agreement, fulfillment, and settlement are separate.
- Release and refund are mutually exclusive.
- Terminal contract states are immutable.
- Reconciliation behavior is defined for unknown final state.

Deliverable:

- `docs/domain/lifecycles.md` or approved embedded tables plus automated transition fixtures.

## S0-03 — Approve actor and permission matrix

**Priority:** P0  
**Disciplines:** Product, Backend, QA  
**Estimate:** 0.5 person-day

Tasks:

- Review Section 9.6.
- Map each route and mutation to required identity/membership/role checks.
- Define active/suspended/removed behavior.
- Define operator limits and audit requirement.
- Generate permission test cases.

Acceptance:

- Authenticated wallet alone grants no organization access.
- Every financial/business mutation has an authorized role.
- UI visibility and backend enforcement are both defined.
- Operator has no administrative fund-movement path.

Deliverable:

- `docs/domain/permissions.md` and permission fixtures.

## S0-04 — Create Convex schema skeleton

**Priority:** P0  
**Disciplines:** Backend  
**Estimate:** 2 person-days

Tasks:

- Replace or isolate the sample `tasks` schema.
- Add domain table validators from Section 11.
- Add required indexes.
- Add common audit/version fields.
- Add helper validators for statuses, roles, assets, and exact amounts.
- Add representative valid and invalid fixtures.
- Document data that is schema-only for MVP.

Acceptance:

- Type generation succeeds.
- Representative buyer-to-escrow records validate.
- Query paths have matching indexes.
- Sensitive fields and on-chain fields are separated.
- Schema supports immutable accepted revisions.

Deliverable:

- Updated Convex schema and validator/test foundation.

## S0-05 — Create `packages/stellar`

**Priority:** P0  
**Disciplines:** Stellar, Web  
**Estimate:** 1.5 person-days

Tasks:

- Add package manifest and TypeScript config.
- Add exports described in Section 12.
- Implement typed network configuration.
- Implement/test exact amount conversion.
- Define normalized Stellar error/result types.
- Reserve generated-binding destination.

Acceptance:

- Package builds and typechecks in the workspace.
- Missing or mixed network configuration fails closed.
- Amount conversion is deterministic and tested.
- No server secret is exported to browser modules.

Deliverable:

- Buildable `packages/stellar` with tests.

## S0-06 — Create escrow contract workspace

**Priority:** P0  
**Disciplines:** Contract  
**Estimate:** 1.5 person-days

Tasks:

- Add Rust workspace and contract crate.
- Configure `soroban-sdk`, test utilities, release profile, and WASM target instructions.
- Add no-std contract skeleton and constructor/config types.
- Add smoke getter/event/error as needed.
- Add native unit test.
- Confirm optimized WASM build.

Acceptance:

- Contract tests and WASM build pass locally and in CI.
- Constructor is atomic and cannot reinitialize.
- Storage keys/types are typed.
- No token movement is prematurely implemented.

Deliverable:

- Buildable/testable `contracts/escrow`.

## S0-07 — Raise runtime baseline

**Priority:** P0  
**Disciplines:** Web, DevOps  
**Estimate:** 0.25 person-day

Tasks:

- Set root Node engine to 20+.
- Add a version file if the team uses one.
- Configure CI Node version.
- Confirm pnpm version and frozen lockfile.
- Document local prerequisites.

Acceptance:

- Unsupported Node versions fail clearly.
- Clean install/build works on the supported runtime.

Deliverable:

- Version-controlled runtime declaration and setup note.

## S0-08 — Configure test harnesses

**Priority:** P0  
**Disciplines:** QA, Web, Backend, Contract  
**Estimate:** 2 person-days

Tasks:

- Add Vitest/React Testing Library and environment setup.
- Add accessibility assertion support.
- Add Playwright config and boot strategy.
- Establish Convex/backend testing approach.
- Add contract unit-test command.
- Add root scripts.
- Create one passing smoke test per applicable layer.

Acceptance:

- New tests are discoverable by standard root commands.
- CI can run tests non-interactively.
- Failure output identifies the layer and test.

Deliverable:

- Test configs, setup files, root scripts, and smoke tests.

## S0-09 — Establish CI

**Priority:** P0  
**Disciplines:** DevOps  
**Estimate:** 1 person-day

Tasks:

- Add workflow stages from Section 17.
- Configure Node/pnpm/Rust/WASM.
- Add safe caching.
- Retain failure artifacts where useful.
- Validate workflow with a temporary intentional failure.
- Protect required P0 checks according to repository settings.

Acceptance:

- Clean branch passes.
- Intentional broken test fails.
- No secrets appear in logs.
- Local commands match CI.

Deliverable:

- `.github/workflows/ci.yml` and documented required checks.

## S0-10 — Add Movix visual tokens

**Priority:** P0  
**Disciplines:** Design, Web  
**Estimate:** 1 person-day

Tasks:

- Map Section 14 tokens into existing CSS variables.
- Define gradient utility/variant without replacing shared button behavior.
- Define semantic status colors.
- Validate default, hover, focus, disabled, and destructive states.
- Build the foundation sample.
- Document shared-component reuse rule.

Acceptance:

- Black background and red–pink primary intent are visible.
- Text and focus states meet contrast targets.
- Money and statuses remain readable without gradient dependence.
- Existing `packages/ui` primitives remain the implementation base.

Deliverable:

- Updated UI tokens and a tested sample.

## S0-11 — Create deterministic fixtures

**Priority:** P0  
**Disciplines:** Backend, Contract, QA  
**Estimate:** 1 person-day

Tasks:

- Create fixture factories listed in Section 16.
- Use fixed test time and valid test addresses.
- Calculate and document exact expected totals.
- Create valid and intentionally invalid transition/data fixtures.
- Make fixtures reusable across web, backend, and contract layers where practical.

Acceptance:

- Tests do not rely on hidden randomness.
- Buyer and supplier are always distinct unless testing failure.
- Amount and state expectations are explicit.

Deliverable:

- Shared fixture modules and fixture documentation.

## S0-12 — Define analytics events

**Priority:** P1  
**Disciplines:** Product, Backend  
**Estimate:** 0.5 person-day

Tasks:

- Approve event names and properties from Section 19.
- Define result/failure categories.
- Define privacy exclusions.
- Assign first instrumentation sprint.

Acceptance:

- Events answer funnel questions without collecting PII or cryptographic artifacts.

Deliverable:

- `docs/product/analytics-events.md` or approved catalog in this file.

## 21. Five-day execution plan

## Day 1 — Align and unblock

Morning:

- Sprint kickoff and owner assignment.
- Confirm capacity and one-week feasibility.
- Approve scope, non-goals, and exit gate.
- Review repository baseline.

Working sessions:

- Approve route map.
- Approve canonical vocabulary.
- Begin lifecycle and permission matrices.
- Confirm environment and network boundaries.

Engineering:

- Create branches/work items.
- Raise Node baseline.
- Scaffold `packages/stellar` and contract workspace.

End-of-day evidence:

- Route map approved.
- Vocabulary approved.
- Lifecycle/permission questions listed with owners and due time.
- Skeleton package/workspace compiles or blockers are explicit.

## Day 2 — Domain and test foundations

Product/backend/contract:

- Finalize lifecycle transitions.
- Finalize permission matrix.
- Finalize on-chain/off-chain authority.
- Start ADRs.

Backend:

- Implement schema validators and indexes.
- Add common status/role/asset types.

QA/Web:

- Configure unit/component and accessibility testing.
- Configure Playwright smoke.

Contract/Stellar:

- Implement constructor/config smoke.
- Implement amount/config tests.

End-of-day evidence:

- State/permission tests drafted.
- Schema type generation works.
- One web test and one contract test pass locally.

## Day 3 — CI, design system, and fixtures

DevOps:

- Add CI workflow.
- Run lint/typecheck/test/build stages.

Design/Web:

- Apply Movix tokens.
- Build foundation UI sample.
- Validate contrast/focus/responsiveness.

Backend/QA:

- Complete deterministic fixtures.
- Add schema validation and permission fixtures.

Stellar/Contract:

- Complete package exports and contract WASM build.

End-of-day evidence:

- CI reaches all required stages.
- Design sample is reviewable.
- Valid and invalid domain fixtures exist.
- Contract WASM builds.

## Day 4 — Integrate and challenge

Team:

- Review artifacts across disciplines.
- Check product vocabulary against code enums/types.
- Check route/permission matrix against schema.
- Check exact-amount fixtures across TypeScript and Rust assumptions.

QA:

- Add forbidden-transition and unauthorized-access cases.
- Validate intentional CI failure.
- Run clean-checkout setup.

Product:

- Complete Sprint 1 definition of ready.
- Complete analytics catalog if P0 work is secure.

End-of-day evidence:

- Cross-discipline inconsistencies are closed or assigned P0 defects.
- CI catches a deliberately introduced failure.
- Sprint 1 backlog can be estimated without architectural discovery.

## Day 5 — Verify, document, and close

Morning:

- Run full clean test/build suite.
- Complete accessibility and responsive smoke.
- Review P0 defects and risks.
- Rehearse demo.

Review:

- Demonstrate all Sprint 0 evidence.
- Confirm P0 completion.
- Record accepted P1 movement.
- Approve Sprint 1 readiness.

Retrospective:

- Record tooling or ownership bottlenecks.
- Adjust Sprint 1 capacity using actual throughput.
- Confirm scheduled Sprint 6 pilot validation.

End-of-day evidence:

- CI green.
- Sprint 0 exit checklist signed.
- Sprint 1 is ready.

## 22. Daily coordination questions

Ask these in the daily sync:

1. Which unresolved decision could cause two teams to implement different behavior?
2. Which P0 artifact lacks a named owner?
3. Is a financial state being represented differently in product, backend, and contract work?
4. Did any test reveal a missing requirement rather than only a code defect?
5. Is one-week scope still credible with current capacity?
6. What must move today to protect the Sprint 0 exit gate?

## 23. Risks and mitigations

| Risk | Probability | Impact | Mitigation | Trigger |
|---|---|---|---|---|
| One-week scope exceeds capacity | High if team is small | High | Parallel owners; extend duration rather than cut foundations | P0 skeletons not compiling by end of Day 2 |
| Schema becomes a full implementation project | Medium | Medium | Limit Sprint 0 to validators, indexes, types, fixtures | Production CRUD begins before skeleton sign-off |
| Contract team implements business logic too early | Medium | High | Constructor/config smoke only | Token transfer work starts before lifecycle approval |
| Test tooling consumes the sprint | Medium | Medium | Minimum viable harness per layer; defer optional local integration CI | No domain work completed by Day 3 |
| CI relies on mutating formatter/linter | Medium | Medium | Add non-mutating check commands | CI modifies files |
| Design changes fork shared components | Medium | Medium | Token/variant changes in `packages/ui`; composition in pages | New page-local Button/Card/Form appears |
| Product vocabulary differs from enum values | Medium | High | Shared reviewed state table and typed constants | Two names represent the same state |
| Network/asset values are guessed | Medium | High | Validated configuration; confirm before Sprint 5 | Hard-coded issuer/SAC enters browser page code |
| Untracked secrets enter repository | Low | Critical | Secret scanning, `.gitignore`, documented placeholders | Key-like material appears in diff/log |

## 24. Sprint 1 definition of ready

Sprint 1 may begin only when:

- [ ] `/` and `/login` routes and access rules are approved.
- [ ] Wallet connection and SEP-10 authentication are distinct in vocabulary and architecture.
- [ ] Supported pilot wallet set is named.
- [ ] Testnet network passphrase and configuration approach are approved.
- [ ] SEP-10 Stellar key and application JWT key are separate by design.
- [ ] Convex custom JWT integration boundary is documented.
- [ ] `packages/stellar` has auth/wallet interfaces and typed config.
- [ ] Login success, rejection, expiry, wrong-network, replay, logout, and refresh states are specified.
- [ ] Movix tokens and shared components are available.
- [ ] Unit/component, accessibility, Playwright, backend, and CI harnesses run.
- [ ] No P0 Sprint 0 defect remains open.

## 25. Sprint 0 exit checklist

Product:

- [ ] Route map approved.
- [ ] Canonical vocabulary approved.
- [ ] Agreement lifecycle approved.
- [ ] Fulfillment lifecycle approved.
- [ ] Contract/projection lifecycle approved.
- [ ] Mainnet exclusion and settlement-liveness gate remain explicit.

Authorization/data:

- [ ] Permission matrix approved.
- [ ] Data authority/classification approved.
- [ ] Operator limitations approved.
- [ ] Testnet/mainnet isolation approved.

Repository:

- [ ] Node 20+ baseline enforced.
- [ ] `packages/stellar` builds and typechecks.
- [ ] Contract workspace tests and builds.
- [ ] Convex schema skeleton type generation succeeds.
- [ ] Design tokens are applied through `packages/ui`.

Testing/CI:

- [ ] Web unit/component smoke passes.
- [ ] Accessibility smoke passes.
- [ ] Playwright smoke passes.
- [ ] Backend/schema smoke passes.
- [ ] Contract unit test passes.
- [ ] Contract WASM build passes.
- [ ] CI catches an intentional failure.
- [ ] Clean CI run is green.

Fixtures/documentation:

- [ ] Buyer/supplier/organization/order/asset fixtures exist.
- [ ] Valid and invalid transition fixtures exist.
- [ ] Initial ADRs exist.
- [ ] Local setup and quality commands are documented.
- [ ] Sprint 1 meets definition of ready.

## 26. Required review evidence

Attach or link these items in the Sprint 0 review:

- CI run URL or captured result.
- Full command list with pass/fail status.
- Route map.
- Lifecycle tables.
- Permission matrix.
- Data-authority matrix.
- Schema diagram or generated type evidence.
- `packages/stellar` public export summary.
- Contract test and WASM-build result.
- UI foundation screenshots at mobile and desktop widths.
- Accessibility/contrast result.
- Fixture catalog.
- Open risks and accepted P1 carryover.

## 27. Sprint closure decision

Choose exactly one:

### Complete

All P0 exit criteria pass. Sprint 1 may start.

### Conditional close

Only non-blocking P1 work remains. Each item has an owner and destination sprint. Sprint 1 may start.

### Not complete

Any of these remain:

- Conflicting lifecycle definitions.
- Missing authorization policy.
- No working test/CI harness.
- `packages/stellar` or contract workspace does not build.
- Amount/network configuration is unvalidated.
- Sprint 1 cannot implement login without new architecture decisions.

Do not relabel missing foundations as Sprint 1 work merely to report Sprint 0 as complete.

## 28. Sign-off

| Discipline | Owner | Status | Date | Notes |
|---|---|---|---|---|
| Product | TBD | Pending | — | — |
| Design | TBD | Pending | — | — |
| Web | TBD | Pending | — | — |
| Backend | TBD | Pending | — | — |
| Stellar/Contract | TBD | Pending | — | — |
| QA | TBD | Pending | — | — |
| DevOps | TBD | Pending | — | — |

Final product sign-off requires:

- Sprint goal achieved.
- All P0 evidence present.
- No unresolved financial-state or authorization ambiguity.
- Sprint 1 definition of ready satisfied.
