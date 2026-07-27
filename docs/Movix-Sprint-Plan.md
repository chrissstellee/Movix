# Movix Testnet MVP Sprint Plan

**Prepared:** July 27, 2026  
**Source of truth:** [Movix MVP Analysis and Implementation Plan](./Movix-Implementation-Plan.md)  
**Delivery target:** Testnet MVP and pilot  
**Cadence:** Sprint 0 is one week; Sprints 1–9 are two weeks each  
**Indicative duration:** 19 weeks, excluding holidays and staffing changes

## 1. Product objective

Deliver and validate one complete B2B procurement journey:

1. A visitor understands Movix.
2. A business user connects a Stellar wallet and authenticates through SEP-10.
3. A buyer creates and sends a commercially complete purchase order.
4. The supplier accepts the exact order revision.
5. The buyer locks the exact accepted value in a Stellar escrow.
6. The supplier verifies funding and records shipment.
7. The buyer confirms delivery and releases payment.
8. Either party can request a full mutual refund before release.
9. Both parties can trace every material action to the application audit trail and Stellar transaction.

North-star metric: **funded orders settled correctly**, either released to the supplier or refunded without manual database correction.

## 2. Planning assumptions

- The current Next.js, Convex, and `packages/ui` monorepo remains the application foundation.
- `packages/stellar` and `contracts/escrow` will be added.
- The MVP supports testnet XLM and one allowlisted Stellar USDC asset.
- Wallet connection uses Stellar Wallets Kit; web authentication uses SEP-10.
- The initial UI supports one owner user per business, one shipment, full delivery, full release, and full refund.
- The schema anticipates future roles, multiple shipments, partial amounts, and advanced commercial terms without activating them in the MVP.
- Mainnet is explicitly out of scope until settlement liveness, legal policy, contract review, and operational readiness are resolved.
- Every sprint must deliver a demonstrable vertical increment and its tests. Testing is not a final-sprint activity.

## 3. Priority and ownership legend

Priority:

- **P0 — Required:** Sprint cannot close without it.
- **P1 — Valuable:** Complete when P0 is secure; may move without invalidating the sprint goal.
- **Stretch:** Explicitly outside the committed sprint cut line.

Discipline:

- **Product:** requirements, acceptance, analytics, and scope.
- **Design:** interaction, responsive behavior, content, and accessibility.
- **Web:** Next.js pages, components, and client orchestration.
- **Backend:** Convex schema, authorization, queries, mutations, jobs, and projections.
- **Stellar:** Wallets Kit, SEP-10, SDK, transactions, RPC, and bindings.
- **Contract:** Rust escrow contract and contract tests.
- **QA:** automated and exploratory validation.
- **DevOps:** CI, secrets, deployment, monitoring, and runbooks.

These are delivery disciplines, not named individuals. One person may cover several disciplines.

## 4. Release milestones

| Milestone | Sprint | Evidence |
|---|---:|---|
| Foundation ready | 0 | Domain vocabulary, test harness, repo structure, CI, and design tokens |
| Visitor-to-authenticated-user | 1 | Landing and successful SEP-10 login |
| Business ready to transact | 2 | Completed onboarding and protected application shell |
| Accepted procurement agreement | 4 | Buyer sends; supplier accepts exact revision |
| Core value proven | 6 | Accepted order funds, ships, confirms, and releases |
| Exception-safe MVP | 8 | Mutual refunds, history, notifications, and reconciliation |
| Pilot-ready testnet release | 9 | Full regression, runbooks, observability, and pilot evidence |

The first product validation checkpoint is the end of Sprint 6. If pilot users do not value the funded-order-to-release flow, stop adding scope and investigate the failed assumption.

## 5. Cross-sprint delivery rules

### Definition of ready

A backlog item is ready only when:

- Its user or system actor is named.
- Preconditions and authorized roles are defined.
- Required fields and validation rules are known.
- Success, empty, pending, error, and retry states are described.
- On-chain versus off-chain authority is explicit.
- Acceptance criteria are testable.
- Dependencies and required fixtures are available.
- Sensitive data and audit requirements are identified.

### Definition of done

Every completed item must:

- Meet its acceptance criteria.
- Enforce organization and role authorization in the backend.
- Use existing `packages/ui` primitives where available.
- Cover loading, empty, error, disabled, pending, and success states as applicable.
- Work at 320px, tablet, and desktop sizes.
- Pass keyboard and screen-reader smoke checks.
- Include proportional unit, component, integration, and end-to-end tests.
- Prevent duplicate submission and stale-state writes.
- Produce audit, notification, transaction, or observability evidence where required.
- Avoid logging secrets, raw session tokens, wallet private keys, or unnecessary PII.
- Pass lint, type checking, automated tests, and build gates.

### Financial-action rules

Funding, release, refund, and cancellation additionally require:

- Exact integer asset units.
- Transaction simulation before signing.
- Explicit amount, asset, network, contract, counterparty, and resulting state in the review UI.
- Rejected-signature, disconnected-wallet, wrong-network, insufficient-balance, simulation-failure, delayed-confirmation, and refresh-recovery paths.
- A saved transaction hash before persistent “submitted” state.
- Confirmed ledger state before showing a terminal business outcome.
- Idempotency and reconciliation tests.

## 6. Sprint schedule overview

| Sprint | Duration | Phase | Primary pages/functionality | Product outcome |
|---:|---:|---|---|---|
| 0 | 1 week | Foundation | Architecture, schemas, design tokens, CI, test harness | Team can implement without inventing rules |
| 1 | 2 weeks | Acquisition/auth | `/`, `/login`, SEP-10 | Visitor becomes an authenticated user |
| 2 | 2 weeks | Business identity | Onboarding, profile, wallet settings, app shell | Business is ready to transact |
| 3 | 2 weeks | Buyer procurement | `/buyer`, `/orders`, `/orders/new` | Buyer sends a complete order |
| 4 | 2 weeks | Supplier agreement | `/supplier`, role-aware order detail | Supplier accepts exact order revision |
| 5 | 2 weeks | Escrow funding | Contract core and funding panel | Buyer funds once; both parties verify |
| 6 | 2 weeks | Fulfillment/release | Shipment, delivery confirmation, release | Core escrow promise is complete |
| 7 | 2 weeks | Exceptions | Mutual refund and timeout cancellation | Funds have controlled exception paths |
| 8 | 2 weeks | Transparency | Transactions, notifications, dashboards | Every material action is discoverable |
| 9 | 2 weeks | Hardening | All MVP routes and operations | Testnet pilot can run without developers |

## 7. Detailed sprint backlogs

## Sprint 0 — Foundation, lifecycle, schema, and CI

**Duration:** 1 week  
**Sprint goal:** Establish one executable delivery contract across product, UX, backend, Stellar, and contract work.  
**Demo:** CI runs a web test and Rust contract smoke test; the team can inspect the agreed routes, states, schemas, design tokens, and fixture data.

### Committed backlog

| ID | Priority | Work item | Discipline | Acceptance summary |
|---|---|---|---|---|
| S0-01 | P0 | Approve route map and page ownership | Product, Design, Web | Every MVP route has audience, purpose, primary action, and protected/public status |
| S0-02 | P0 | Define agreement, fulfillment, and settlement state machines | Product, Backend, Contract, QA | Allowed and rejected transitions are captured in one versioned table |
| S0-03 | P0 | Define actor and permission matrix | Product, Backend, QA | Visitor, authenticated user, buyer, supplier, owner, and operator permissions are testable |
| S0-04 | P0 | Replace sample domain plan with Convex schema skeleton | Backend | Users, organizations, memberships, relationships, orders, revisions, lines, escrows, transactions, notifications, and audit entities are modeled |
| S0-05 | P0 | Create `packages/stellar` boundary | Stellar, Web | Network config, wallet, amount, transaction, contract-binding, and event modules have defined exports |
| S0-06 | P0 | Create `contracts/escrow` workspace | Contract | Contract builds as an empty/skeleton Rust contract with test utilities |
| S0-07 | P0 | Raise runtime baseline to Node 20+ | Web, DevOps | Local and CI engines reject unsupported Node versions |
| S0-08 | P0 | Configure testing stack | QA, Web, Backend, Contract | Unit/component, Playwright, accessibility, Rust, and local-ledger test commands exist |
| S0-09 | P0 | Establish CI quality gates | DevOps | Lint, formatting, typecheck, unit tests, contract build/test, and web build run on changes |
| S0-10 | P0 | Add Movix dark design tokens | Design, Web | Black surfaces, red–pink gradient rules, semantic statuses, focus ring, and contrast are documented and applied to a shell sample |
| S0-11 | P0 | Create shared test fixtures/builders | Backend, Contract, QA | Buyer, supplier, accepted order, assets, wallet addresses, and lifecycle fixtures are deterministic |
| S0-12 | P1 | Define analytics event catalog | Product, Backend | Funnel and failure events have stable names and privacy-safe properties |

### Testing commitment

- State-machine unit tests for every allowed and forbidden transition.
- Permission-matrix tests for all MVP actors.
- Convex schema validation tests with representative and invalid records.
- Exact-amount fixtures for XLM and USDC-like precision.
- Design-token contrast and focus checks.
- CI smoke execution on a clean checkout.

### Exit gate

- No implementation team needs to invent a lifecycle, permission, route, or financial-authority rule.
- CI is green.
- The repository contains executable web and contract test skeletons.

### Not in this sprint

- Production page implementation.
- Real SEP-10 login.
- Functional escrow transfers.

## Sprint 1 — Landing page and SEP-10 login

**Duration:** 2 weeks  
**Sprint goal:** Turn a visitor with a supported Stellar wallet into an authenticated Movix user.  
**Pages:** `/`, `/login`  
**Dependencies:** Sprint 0 route map, design tokens, wallet/network matrix, CI, and fixtures.  
**Demo:** A new user reads the landing page, connects Freighter through Wallets Kit, signs a SEP-10 challenge, reaches an authenticated placeholder route, logs out, and reconnects.

### Committed backlog

| ID | Priority | User/system story | Discipline | Acceptance summary |
|---|---|---|---|---|
| S1-01 | P0 | As a visitor, I can understand Movix’s value and workflow | Product, Design, Web | Hero, buyer/supplier workflow, security explanation, supported testnet assets, FAQ, and login CTA render responsively |
| S1-02 | P0 | As a visitor, I can navigate the public site accessibly | Design, Web, QA | Header, anchors, CTA, FAQ, and footer work by keyboard and screen reader |
| S1-03 | P0 | As a user, I can select and connect a supported wallet | Stellar, Web | Wallets Kit opens, returns the address/network, and handles unavailable, rejected, disconnected, and wrong-network states |
| S1-04 | P0 | As a user, I can request a SEP-10 challenge | Stellar, Web | Server returns a correctly formed, signed, short-lived challenge for the selected account and network |
| S1-05 | P0 | As a user, I can sign in without authorizing a payment | Product, Design, Web, Stellar | Login clearly states “Signing in does not transfer funds”; wallet signs only the authentication challenge |
| S1-06 | P0 | As Movix, I verify the signed challenge safely | Stellar, Backend | Sequence, operations, signatures, account, domains, passphrase, and time bounds are validated; replay is rejected |
| S1-07 | P0 | As Movix, I issue a Convex-compatible application session | Backend, Stellar, DevOps | Separate JWT key, issuer, audience, JWKS, short expiry, and Convex custom JWT configuration work |
| S1-08 | P0 | As a user, I remain signed in safely and can log out | Web, Backend | Refresh/session cookie obtains renewed access tokens; logout revokes the session and clears client auth |
| S1-09 | P0 | As a user, I can recover from login failures | Design, Web | Expired challenge, rejected signature, verification failure, network change, and session expiry offer a safe retry |
| S1-10 | P1 | As Product, I can measure the login funnel | Product, Backend | Privacy-safe events record CTA, wallet selection, connection, challenge, success, and categorized failure |

### Page acceptance criteria

Landing:

- Primary CTA reaches `/login`.
- Value proposition names buyer and supplier protection without claiming that blockchain proves delivery.
- Testnet and supported assets are disclosed.
- Content remains usable without animation or gradient effects.

Login:

- Wallet connection and SEP-10 authentication appear as distinct stages.
- Connected address and network are visible, with full-value copy/view access.
- Rapid clicks cannot issue duplicate active challenges or duplicate verification.
- A rejected signature leaves the order-independent session state unchanged.
- Logout prevents protected Convex access.

### Testing commitment

- SEP-10 tests: malformed XDR, wrong sequence, wrong network, wrong account, wrong home/web-auth domain, expired time bounds, missing/extra operations, insufficient signatures, reused challenge, and invalid server signature.
- JWT tests: issuer, audience, algorithm, key rotation fixture, expiry, refresh, revocation, and Convex identity mapping.
- Component tests for every login state.
- Playwright journeys for login success, wallet rejection, signature rejection, expired challenge, wrong network, logout, and reconnect.
- Keyboard, screen-reader, heading order, accessible names, contrast, reduced motion, and 320px/tablet/desktop checks.

### Exit gate

- A supported-wallet user can obtain and lose a valid protected session.
- No wallet secret or server signing key reaches browser code.
- Authentication success and failure are observable without logging sensitive artifacts.

### Stretch

- Additional Wallets Kit modules beyond the agreed pilot wallet set.
- Animated landing-page effects.

## Sprint 2 — Business onboarding, profile, and authenticated shell

**Duration:** 2 weeks  
**Sprint goal:** Convert an authenticated wallet holder into a commercially usable organization.  
**Pages:** `/onboarding/business`, `/settings/business`, `/settings/wallet`  
**Dependencies:** Valid SEP-10/Convex identity from Sprint 1.  
**Demo:** A new user completes onboarding, resumes a saved draft, becomes the organization owner, enters the buyer view, edits permitted profile data, and signs out.

### Committed backlog

| ID | Priority | User/system story | Discipline | Acceptance summary |
|---|---|---|---|---|
| S2-01 | P0 | As a user, I can create a business organization | Product, Backend | Legal name, country, email, capabilities, timezone, and status are persisted with creator/audit data |
| S2-02 | P0 | As a business, I can record standard identity fields | Design, Web, Backend | Trading name, entity type, registration/tax fields, industry, website, phone, and logo metadata follow required/optional rules |
| S2-03 | P0 | As a business, I can record contacts and addresses | Web, Backend | Primary contacts and registered/billing/shipping addresses use country-aware validation |
| S2-04 | P0 | As a user, I can save and resume onboarding | Web, Backend | Draft state survives refresh and resumes at the last incomplete step without duplicate organization creation |
| S2-05 | P0 | As Movix, I create an owner membership | Backend | Organization creation atomically assigns the authenticated user an active owner membership |
| S2-06 | P0 | As Movix, I isolate organizations | Backend, QA | All protected reads/writes require identity, active membership, and matching organization scope |
| S2-07 | P0 | As a user, I can use the authenticated app shell | Design, Web | `packages/ui` sidebar/sheet, role switch, wallet/network indicator, notification placeholder, business menu, and logout are consistent |
| S2-08 | P0 | As a user, I can edit allowed profile fields | Web, Backend | Profile edits validate, version, audit, and reject stale or unauthorized changes |
| S2-09 | P0 | As a user, I understand missing-profile blockers | Product, Design, Web | Only actions requiring absent commercial data are blocked; messages link to the relevant step |
| S2-10 | P1 | As a business, I can set defaults | Web, Backend | Preferred asset, payment terms, display currency, and notification defaults are stored |

### Testing commitment

- Required/optional/sensitive field validation and normalization.
- Country-aware address cases.
- Duplicate wallet, duplicate submission, stale version, suspended user, and inactive membership.
- Cross-organization read/write denial tests for every public Convex function introduced.
- Onboarding save/resume and profile-edit Playwright journeys.
- Form error association, progress semantics, focus order, mobile navigation, and focus restoration.

### Exit gate

- An authenticated user can produce one commercially usable organization.
- Organization data is isolated.
- The authenticated shell is ready to host procurement pages.

### Stretch

- Additional organization members.
- Full verification workflow.
- Logo upload.

## Sprint 3 — Buyer dashboard, order list, and order creation

**Duration:** 2 weeks  
**Sprint goal:** Enable a buyer to draft, validate, review, and send a commercially complete procurement order.  
**Pages:** `/buyer`, `/orders`, `/orders/new`, buyer view of `/orders/[orderId]`  
**Dependencies:** Completed organization profile and app shell.  
**Demo:** A buyer creates a multi-line order, saves and resumes it, reviews exact totals and terms, sends revision 1, and sees it as awaiting the supplier.

### Committed backlog

| ID | Priority | User/system story | Discipline | Acceptance summary |
|---|---|---|---|---|
| S3-01 | P0 | As a buyer, I see my dashboard and next actions | Design, Web, Backend | Attention counts, recent activity, first-use empty state, and create-order CTA are organization-scoped |
| S3-02 | P0 | As a buyer, I can browse my orders | Web, Backend | Role-aware status tabs, basic date/asset/status filters, stable pagination, loading, and empty states work |
| S3-03 | P0 | As a buyer, I can identify or invite a supplier | Web, Backend | Verified wallet/relationship selection prevents self-dealing and records provisional invite metadata where permitted |
| S3-04 | P0 | As a buyer, I can create an order header | Web, Backend | PO number, contacts, address snapshots, references, dates, asset/network, deadlines, and terms validate |
| S3-05 | P0 | As a buyer, I can maintain line items | Web, Backend | Name, quantity, unit, price, optional SKU/discount/tax, and deterministic line totals are supported |
| S3-06 | P0 | As a buyer, I can see deterministic totals | Web, Backend, QA | Subtotal, discount, tax, shipping, and grand total agree across client, backend, review, and stored integer units |
| S3-07 | P0 | As a buyer, I can save and recover a draft | Web, Backend | Autosave/manual save is versioned and duplicate-safe; refresh and navigation recover the draft |
| S3-08 | P0 | As a buyer, I can review the complete commercial snapshot | Design, Web | Supplier, contacts, addresses, items, totals, delivery, inspection, funding, and refund terms are visible before send |
| S3-09 | P0 | As a buyer, I can send an immutable revision | Backend, Web | Send freezes revision 1, records actor/time/terms hash, changes agreement state, and creates one notification event |
| S3-10 | P0 | As a buyer, I can cancel before acceptance/funding | Web, Backend | Eligible drafts/sent orders cancel with reason and audit; accepted/funded orders are blocked |
| S3-11 | P1 | As a buyer, I can preserve list context | Web | Filters and pagination survive detail navigation and browser back |

### Testing commitment

- Unit tests for quantity, price, discount, tax, shipping, rounding, precision, and total conservation.
- Invalid/duplicate PO, past or reversed dates, zero/negative quantity, unsupported asset/network, same organization, stale revision, and duplicate send.
- Authorization tests for owner/buyer organization versus supplier/other organization.
- Component tests for line-item editing, calculated totals, autosave, and review.
- Playwright create, edit, save, refresh, send, and cancel journeys.
- Mobile line items render as usable labeled cards.

### Exit gate

- The buyer sends exactly one commercially complete immutable revision.
- Stored amounts and displayed amounts reconcile.
- The supplier target is unambiguous.

### Stretch

- Advanced search.
- File attachments.
- PDF generation.
- Multi-destination line items in the UI.

## Sprint 4 — Supplier inbox, review, acceptance, and rejection

**Duration:** 2 weeks  
**Sprint goal:** Enable the designated supplier to make an auditable decision on the exact order revision.  
**Pages:** `/supplier`, `/orders`, supplier view of `/orders/[orderId]`  
**Dependencies:** Sent order and supplier binding from Sprint 3.  
**Demo:** A supplier sees an incoming order, reviews all material terms, accepts it, and the buyer sees that exact revision become eligible for funding. A second order demonstrates rejection.

### Committed backlog

| ID | Priority | User/system story | Discipline | Acceptance summary |
|---|---|---|---|---|
| S4-01 | P0 | As a supplier, I see incoming orders requiring action | Web, Backend | Supplier dashboard and queue are restricted to designated relationships/wallet bindings |
| S4-02 | P0 | As a supplier, I can review the immutable revision | Design, Web, Backend | Buyer, contacts, addresses, lines, totals, asset, dates, delivery, inspection, and refund terms are complete |
| S4-03 | P0 | As a supplier, I can accept the exact revision | Web, Backend | Acceptance records supplier organization/user, revision, terms hash, timestamp, and audit event |
| S4-04 | P0 | As a supplier, I can reject with a reason | Web, Backend | Rejection records structured reason/note and blocks funding |
| S4-05 | P0 | As a buyer, I am notified of the decision | Backend, Web | Acceptance/rejection generates one durable, deep-linked notification |
| S4-06 | P0 | As Movix, I prevent stale acceptance | Backend, QA | Superseded, cancelled, expired, wrong-supplier, or already-decided revisions reject the mutation |
| S4-07 | P0 | As a buyer, a material edit requires re-acceptance | Backend, Web | Editing accepted commercial fields creates a new revision and returns it to supplier review |
| S4-08 | P0 | As both parties, I see one canonical timeline | Design, Web, Backend | Send, accept/reject, revision, actor, and timestamp appear consistently in role-aware language |

### Testing commitment

- Supplier access isolation and wrong-wallet/organization tests.
- Invitation/binding cases: expired, reused, mismatched, inactive, and unverified supplier.
- Stale acceptance, simultaneous accept/reject, revision supersession, cancellation race, and duplicate notification.
- Component tests for review, accept dialog, rejection reason, and timeline.
- Playwright send → receive → accept and send → receive → reject journeys.
- Screen-reader and mobile order-review validation.

### Exit gate

- Only the designated supplier can accept the exact active revision.
- Funding eligibility is derived only from confirmed acceptance.
- Both parties share one defensible agreement history.

### Stretch

- Counteroffers or in-app negotiation.
- Email invitations.
- Supplier team permissions.

## Sprint 5 — Contract core and escrow funding

**Duration:** 2 weeks  
**Sprint goal:** Lock the exact accepted order value once and project confirmed funding to both parties.  
**Page/functionality:** Funding section on `/orders/[orderId]`  
**Dependencies:** Accepted immutable order, network/SAC allowlist, generated bindings, and local-ledger environment.  
**Demo:** A buyer reviews and signs a 500 USDC funding transaction; the supplier sees confirmed funding, hash, ledger, amount, asset, and contract. A rejected wallet prompt and refresh-after-submit recovery are also demonstrated.

### Committed backlog

| ID | Priority | User/system story | Discipline | Acceptance summary |
|---|---|---|---|---|
| S5-01 | P0 | As Movix, I deploy an initialized escrow contract | Contract, DevOps | `__constructor` stores treasury, supported SACs, fee cap, and TTL config atomically |
| S5-02 | P0 | As a buyer, I can create and fund one escrow | Contract | `create_and_fund` validates ID, parties, token, amount, fee, deadline, and terms hash, then transfers atomically |
| S5-03 | P0 | As anyone, I can read one escrow safely | Contract, Stellar | `get_escrow(id)` returns a bounded typed record |
| S5-04 | P0 | As Movix, I track active liabilities and TTL | Contract | Per-token liability is exact; escrow/config/liability TTL is extended according to policy |
| S5-05 | P0 | As Movix, I expose stable funding events and errors | Contract, Stellar | Typed event/error bindings decode into stable application models |
| S5-06 | P0 | As a buyer, I can review funding before signing | Design, Web, Stellar | `TransactionReview` shows amount, asset, order, supplier, network, contract, balance/trustline, fee, and resulting state |
| S5-07 | P0 | As a buyer, I can simulate, sign, and submit | Stellar, Web | Transaction is simulated, wallet-signed, submitted, and duplicate actions are disabled |
| S5-08 | P0 | As Movix, I persist and reconcile submission | Backend, Stellar | Hash is saved as submitted; RPC finality and `get_escrow` update the projection idempotently |
| S5-09 | P0 | As both parties, I see confirmed funding | Web, Backend | Funded appears only after reconciliation; receipt exposes asset, amount, network, contract, hash, and ledger |
| S5-10 | P0 | As a user, I can recover interrupted funding | Web, Backend | Refresh/browser close resumes tracking; unknown final state never creates a second funding transaction |
| S5-11 | P1 | As Operations, I can detect reconciliation failures | Backend, DevOps | Stuck submission and projection mismatch create structured alerts/logs |

### Contract acceptance criteria

- Buyer and supplier are distinct.
- Token is an allowlisted network-specific SAC.
- Amount is positive and equals the accepted order total.
- Escrow ID is unique.
- Terms hash equals the accepted revision.
- Buyer authorization is required at the escrow entry point.
- Duplicate invocation cannot create a second liability.
- Failed SAC transfer leaves no escrow or liability.
- Event contains no PII.

### Testing commitment

- Rust unit/property tests for amount boundaries, duplicate ID, wrong token, same parties, bad deadline, fee cap, terms mismatch, authorization, liability, event, typed errors, and TTL.
- Integration tests with real local SAC transfers for XLM-like and USDC-like assets.
- Missing trustline, deauthorized balance, insufficient balance, and failed transfer.
- TypeScript unit tests for exact conversion, network config, transaction building, simulation, event decoding, and explorer links.
- Convex tests for submission idempotency, organization visibility, finality updates, and repair.
- Playwright funding success, wallet rejection, wrong network, insufficient balance, delayed confirmation, disconnect, and refresh recovery.

### Exit gate

- An accepted order can be funded once and only once.
- Both parties see the same confirmed chain facts.
- Submitted, failed, and confirmed states cannot be confused.

### Stretch

- Additional assets.
- Platform fee above zero.
- Fee sponsorship.

## Sprint 6 — Supplier acceptance, shipment, delivery confirmation, and release

**Duration:** 2 weeks  
**Sprint goal:** Complete the core supplier-protection and buyer-release loop.  
**Page/functionality:** Role-aware fulfillment and settlement sections on `/orders/[orderId]`  
**Dependencies:** Confirmed funded escrow and stable transaction review/timeline.  
**Demo:** Supplier accepts funded terms, records shipment, buyer reviews and confirms delivery, and the contract releases the exact payment. Both dashboards and history show completion.

### Committed backlog

| ID | Priority | User/system story | Discipline | Acceptance summary |
|---|---|---|---|---|
| S6-01 | P0 | As a supplier, I accept the funded on-chain terms | Contract, Stellar, Web | Supplier signs `accept` for the snapshotted address and matching terms hash; `Funded → Accepted` |
| S6-02 | P0 | As a supplier, I can record shipment details | Web, Backend | Method, carrier/tracking where applicable, dates, addresses, package data, notes, and evidence metadata validate |
| S6-03 | P0 | As a supplier, I commit the shipment hash | Contract, Stellar | Supplier signs `mark_shipped`; only `Accepted → Shipped` is permitted |
| S6-04 | P0 | As a buyer, I can review shipment and inspection terms | Design, Web | Shipment, delivery evidence, inspection warning, amount, and alternatives are clearly presented |
| S6-05 | P0 | As a buyer, I can confirm delivery and release | Contract, Stellar, Web | Explicit irreversible review signs `confirm_delivery`; exact net/fee transfers and `Shipped → Released` are atomic |
| S6-06 | P0 | As both parties, I receive a settlement receipt | Web, Backend | Completion appears only after confirmed contract state and shows amount, asset, recipient, hash, network, and ledger |
| S6-07 | P0 | As both parties, I see the completed timeline | Backend, Web | Accepted, shipped, confirmed/released, actors, timestamps, and chain evidence are canonical |
| S6-08 | P0 | As Movix, I notify the supplier and buyer | Backend | Shipment, action-required delivery review, and release notifications are durable and deduplicated |
| S6-09 | P1 | As Product, I can measure the core funnel | Product, Backend | Accepted-to-funded, funded-to-shipped, and shipped-to-released events are measurable |

### Testing commitment

- Contract authorization and transition tests for accept, ship, and release.
- Wrong party, wrong terms/shipment hash, repeat call, release before shipment, release after terminal state, arithmetic, fee boundary, payout conservation, liability decrease, event, and TTL.
- Backend shipment field and organization-isolation tests.
- Release-versus-other-action concurrency and repeated-click tests.
- Full Playwright funded → accepted → shipped → confirmed → released journey.
- Signature rejection, delayed confirmation, RPC failure, refresh recovery, and resume.
- Shipment fields adapt for carrier, pickup, and service delivery.
- Mobile fulfillment and release complete without horizontal scrolling.

### Exit gate

- Supplier cannot ship an unaccepted or unfunded escrow.
- Buyer release is exact, authorized, terminal, and confirmed.
- The full Movix product promise is demonstrable to pilot users.

### Product checkpoint

Run moderated tests with at least three buyer–supplier pairs. Validate:

- Supplier understands what “funded” guarantees.
- Buyer understands when release becomes irreversible.
- Both parties can identify who must act next.
- Neither party mistakes a shipment hash for independently verified delivery.

Do not continue adding scope without reviewing these findings.

## Sprint 7 — Mutual refunds and unaccepted timeout cancellation

**Duration:** 2 weeks  
**Sprint goal:** Provide controlled, auditable exception paths without enabling unilateral post-acceptance fund movement.  
**Page/functionality:** Refund and cancellation sections on `/orders/[orderId]`  
**Dependencies:** Active funded/accepted/shipped escrow states and transaction orchestration.  
**Demo:** Buyer requests a refund, supplier approves it, and funds return exactly once. Separate demos show rejection, withdrawal, and buyer cancellation after an unaccepted escrow deadline.

### Committed backlog

| ID | Priority | User/system story | Discipline | Acceptance summary |
|---|---|---|---|---|
| S7-01 | P0 | As either party, I can propose a full refund | Contract, Web, Stellar | Eligible active state stores proposer, exact full remaining amount/hash, resume state, and `RefundPending` |
| S7-02 | P0 | As the counterparty, I can approve matching terms | Contract, Web, Stellar | Opposite party signs identical hash; full remaining amount returns to buyer and becomes `Refunded` |
| S7-03 | P0 | As the counterparty, I can reject | Contract, Web | Matching rejection restores the prior active state and records an audit reason |
| S7-04 | P0 | As the proposer, I can withdraw | Contract, Web | Matching withdrawal restores prior state and prevents later approval of the stale proposal |
| S7-05 | P0 | As a buyer, I can cancel an unaccepted escrow after deadline | Contract, Web, Stellar | Buyer-only call after `acceptBy` refunds in `Funded`; early, accepted, or terminal calls fail |
| S7-06 | P0 | As both parties, I see who must act next | Design, Web | Amount, asset, reason, proposer, counterparty, deadline, terms, and resulting state are explicit |
| S7-07 | P0 | As Movix, I reconcile every refund/cancellation | Backend, Stellar | Submitted/final status, hash, ledger, projection, notification, audit, and receipt are idempotent |
| S7-08 | P0 | As Movix, I prevent settlement races | Contract, Backend, QA | Release and refund/cancellation cannot both succeed |

### Testing commitment

- Contract tests for proposer/approver identity, same-party approval, hash mismatch, unsupported state, duplicate proposal, stale proposal, rejection/withdraw restoration, early/late deadline, double refund, terminal immutability, and exact payout.
- Property tests for arbitrary transition sequences and payout conservation.
- Backend tests for one active request, authorization, audit, notification deduplication, and reconciliation.
- Playwright buyer-requested and supplier-requested approval journeys.
- Rejection, withdrawal, expired/stale proposal, wallet rejection, delayed confirmation, retry, and refresh.
- Release-versus-refund and approval-versus-withdraw concurrency tests.

### Exit gate

- A full mutual refund requires two different parties approving identical terms.
- No exception path can create a duplicate or overpayment.
- Unaccepted escrow has an objective buyer recovery path.

### Stretch

- Partial refunds.
- Evidence uploads.
- Formal dispute or resolver flow.

## Sprint 8 — Transaction history, notifications, and dashboard completion

**Duration:** 2 weeks  
**Sprint goal:** Make every required action and financial transition discoverable and traceable.  
**Pages:** `/transactions`, `/notifications`, completed `/buyer` and `/supplier` dashboards  
**Dependencies:** Stable order, escrow, transaction, event, and notification records.  
**Demo:** A user filters transactions, opens a confirmed receipt and explorer link, follows an action-required notification to an order, and sees reconciliation status across both dashboards.

### Committed backlog

| ID | Priority | User/system story | Discipline | Acceptance summary |
|---|---|---|---|---|
| S8-01 | P0 | As a user, I can view organization transactions | Backend, Web | Funding, release, refund, cancellation, status, amount, asset, order, counterparty, and timestamp are scoped and paginated |
| S8-02 | P0 | As a user, I can filter transaction history | Web, Backend | Date, asset, type, status, order, and counterparty filters produce stable query state |
| S8-03 | P0 | As a user, I can inspect transaction details | Design, Web | Drawer shows network, contract, hash, ledger, fee, initiator, from/to, confirmation, and correct explorer link |
| S8-04 | P0 | As a user, I can view actionable notifications | Backend, Web | Action-required, transactional, and informational items are categorized and deep-linked |
| S8-05 | P0 | As a user, I can manage notification read state | Web, Backend | Individual/all read actions are optimistic, recover on error, and remain organization-scoped |
| S8-06 | P0 | As a buyer, I see role-relevant dashboard states | Design, Web, Backend | Draft, funding, delivery review, completed, and exception counts link to filtered lists |
| S8-07 | P0 | As a supplier, I see role-relevant dashboard states | Design, Web, Backend | Incoming, fulfill, in-transit, awaiting confirmation, completed, and exception counts link correctly |
| S8-08 | P0 | As a user, I can see reconciliation warnings | Web, Backend | Submitted/stuck/mismatch status explains that funds follow confirmed chain state and offers safe recovery |
| S8-09 | P0 | As Movix, notification creation is idempotent | Backend, QA | One event produces at most one notification of each type per recipient |
| S8-10 | P1 | As Product, I can measure action latency | Product, Backend | Time-to-accept, fund, ship, release, refund decision, and reconciliation lag are available |

### Testing commitment

- Transaction ordering, filtering, pagination, organization isolation, masking, and correct network explorer URLs.
- Projection-to-order and projection-to-contract reconciliation.
- Notification generation, deduplication, deep link, read state, and failure recovery.
- Dashboard count accuracy across lifecycle transitions.
- Playwright action → notification → order → transaction-history journey.
- Empty history, large history, partial error, stale projection, and narrow-screen record cards.
- Accessibility for tables/cards, drawers, filters, pagination, and live updates.

### Exit gate

- Every funding, release, refund, and cancellation can be traced from the business order to a confirmed Stellar transaction.
- Users can locate their next required action from the dashboard or notification center.
- Projection mismatch is visible rather than silently hidden.

### Stretch

- CSV export.
- Advanced full-text search.
- Email notification delivery.

## Sprint 9 — Pilot hardening and testnet readiness

**Duration:** 2 weeks  
**Sprint goal:** Make the complete MVP operable by pilot businesses without developer intervention.  
**Pages/functionality:** All MVP routes, operations, deployment, monitoring, support, and recovery  
**Dependencies:** All earlier sprint exit gates.  
**Demo:** Two clean pilot organizations complete onboarding, order, acceptance, funding, shipment, release, and refund journeys using a release candidate deployed to testnet.

### Committed backlog

| ID | Priority | Work item | Discipline | Acceptance summary |
|---|---|---|---|---|
| S9-01 | P0 | Complete cross-page state consistency | Design, Web, QA | Loading, empty, error, disabled, pending, disconnected, wrong-network, and expired-session patterns are canonical |
| S9-02 | P0 | Complete supported-wallet/browser matrix | Stellar, Web, QA | Agreed wallets and browsers pass connection, authentication, signing, and recovery journeys |
| S9-03 | P0 | Complete responsive/accessibility regression | Design, QA, Web | 320px/tablet/desktop, keyboard, screen reader, contrast, focus, reduced motion, and live regions pass |
| S9-04 | P0 | Harden contract verification | Contract, QA | Unit/property/fuzz/mutation/static-analysis, WASM build/hash, resource profiling, and local integration pass |
| S9-05 | P0 | Harden backend authorization and load | Backend, QA | Organization isolation, contention, pagination, notification, audit, and reconciliation load/recovery pass |
| S9-06 | P0 | Script testnet deployment and reset recovery | DevOps, Contract, Stellar | Keys/config/deployments/bindings/fixtures can be recreated without manual hidden steps |
| S9-07 | P0 | Add production-like observability | DevOps, Backend | Auth replay/failure, stuck transaction, RPC failure, cursor lag, TTL, liability mismatch, and projection mismatch alerts work |
| S9-08 | P0 | Write operational and incident runbooks | Product, DevOps, Backend, Contract | Support, reconciliation repair, key rotation, RPC outage, testnet reset, and stuck-transaction procedures are documented |
| S9-09 | P0 | Run clean end-to-end pilot rehearsal | Product, QA | At least two new buyer–supplier pairs complete the journeys without developer assistance |
| S9-10 | P0 | Record mainnet blockers | Product, Contract, Architecture | Timeout/resolver policy, legal review, contract audit, key custody, asset config, and incident ownership remain explicit gates |
| S9-11 | P1 | Tune onboarding and transaction copy | Product, Design | Pilot confusion and recoverable errors from Sprint 6 research are addressed |

### Testing commitment

- Full buyer, supplier, and dual-role regression.
- Cross-browser, supported-wallet, responsive, accessibility, and visual regression.
- Contract fuzz/property/mutation/static analysis and resource limits.
- End-to-end happy and exception journeys against a release-candidate testnet deployment.
- RPC outage, browser closure, session expiry, wallet switch, network switch, indexer lag, archived state/TTL, delayed transaction, and projection repair.
- Load tests for dashboard reads, transaction pagination, notifications, and reconciliation workers.
- Security review of SEP-10, JWT, secret handling, organization authorization, signing review, contract authorization, and allowed assets.

### Exit gate

- Pilot users can complete the full journey without developer help.
- No P0 defect remains open.
- No unexplained balance variance, unauthorized settlement, duplicate settlement, or unresolved terminal projection mismatch exists.
- Deployment, monitoring, support, and recovery procedures are rehearsed.
- Release remains testnet-only and visibly labeled.

### Not in this sprint

- Major new product features.
- Mainnet deployment.
- Informal administrator fund movement or database-only financial corrections.

## 8. Dependency chain

| Dependency | Required by | Failure consequence |
|---|---|---|
| Shared lifecycle and permissions | All sprints | Teams invent conflicting status and access rules |
| SEP-10/JWT/Convex identity | Sprint 2 onward | Protected organization data cannot be trusted |
| Business profile and membership | Sprint 3 onward | Orders lack accountable business actors |
| Immutable accepted order revision | Sprint 5 | Escrow cannot bind to agreed commercial terms |
| Network/SAC allowlist and exact amounts | Sprint 5 onward | Wrong asset or amount may be funded |
| Contract events/getter and projection | Sprint 5 onward | Dashboards cannot prove confirmed financial state |
| Transaction review/recovery pattern | Sprints 5–7 | Users may misunderstand or duplicate financial actions |
| Notification/audit idempotency | Sprints 4–9 | Duplicate actions and unreliable history |
| Reconciliation and observability | Pilot release | Chain/application divergence becomes silent |

## 9. Test coverage matrix

| Test layer | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Type/lint/build | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Backend unit/auth | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Component tests | Shell | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Regression |
| Accessibility | Tokens | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Full |
| Playwright | Harness | Login | Onboard | Buyer | Supplier | Fund | Release | Refund | History | Full |
| Contract unit/property | Harness | — | — | — | — | ✓ | ✓ | ✓ | Regression | Full |
| SAC/local integration | Harness | — | — | — | — | ✓ | ✓ | ✓ | Regression | Full |
| Testnet smoke | — | Auth config | — | — | — | Fund | Release | Refund | Projection | Full |
| Recovery/chaos | — | Session | Draft | Autosave | Concurrency | Tx recovery | Tx recovery | Races | Reconcile | Full |
| Performance/load | Baseline | Auth rate | — | Lists | Queues | RPC budget | Contract budget | Contract budget | History | Full |

## 10. Scope cut strategy

If capacity falls, cut in this order:

1. Remove all stretch items.
2. Keep one pilot wallet while preserving Wallets Kit abstraction.
3. Support USDC first and schedule XLM immediately after the first complete asset path.
4. Remove charts while retaining action counts and lists.
5. Reduce optional onboarding and order fields in the UI while keeping the complete schema.
6. Keep one shipment and full refund only.

Never cut:

- SEP-10 verification and replay protection.
- Organization isolation and backend authorization.
- Exact integer amounts.
- Contract authorization and invariants.
- Submitted-versus-confirmed state distinction.
- Reconciliation and idempotency.
- Mutual refund and unaccepted timeout cancellation.
- Tests for financial transitions.
- Accessibility for critical user journeys.

## 11. Pilot measurement plan

| Signal | Target | First measurable sprint |
|---|---:|---:|
| Supported-wallet login success excluding user rejection | ≥90% | 1 |
| Completed business onboarding | 5 buyer–supplier pairs | 2 |
| Median order create-to-send time | <5 minutes | 3 |
| Supplier acceptance without support | ≥90% | 4 |
| Accepted orders reaching confirmed funding without staff help | ≥90% | 5 |
| Complete testnet settlement lifecycles | 20 | 6 |
| Repeat buyers creating a second order | 3 | 6+ |
| Unauthorized releases/refunds | 0 | 6+ |
| Duplicate settlements | 0 | 6+ |
| Unexplained contract/projection variance | 0 | 5+ |
| Pilot users correctly explain lock/release/refund | 100% interviewed | 6 and 9 |

## 12. Risks and sprint controls

| Risk | Sprint control |
|---|---|
| Buyer disappears after shipment | Testnet-only release; mainnet timeout/resolver remains a formal gate |
| Wallet friction | Sprint 1 recovery states and wallet matrix; repeat in Sprint 9 |
| Chain/Convex divergence | Projection and recovery begin with funding in Sprint 5, not after feature completion |
| Wrong USDC issuer or token contract | Fixed server allowlist and contract validation |
| Decimal/payout error | Integer units, deterministic conversion, property tests, payout conservation |
| Duplicate funding or settlement | Unique IDs, terminal states, idempotency, saved hashes, reconciliation |
| PII on-chain | Only opaque hashes, addresses, asset, amount, and state in contract |
| TTL/archive incident | Contract TTL policy in Sprint 5; monitor and rehearse in Sprint 9 |
| Scope growth | Sprint-specific stretch lists and mandatory cut strategy |
| Testing deferred | Every sprint has a non-negotiable test commitment and exit gate |

## 13. Sprint ceremonies and artifacts

Each sprint:

- **Planning:** confirm goal, P0 cut line, dependencies, test evidence, and demo.
- **Daily coordination:** surface blocked dependencies and financial-state uncertainty first.
- **Mid-sprint product check:** validate page flow and contract/backend vocabulary before polishing.
- **Pre-demo verification:** run the sprint’s automated suite and rehearse the failure/recovery path.
- **Review/demo:** demonstrate user value plus at least one failure or recovery case.
- **Retrospective:** record scope movement, defects escaping tests, and decisions affecting later sprints.

Required artifacts:

- Updated backlog and acceptance criteria.
- Decision log for lifecycle, security, or scope changes.
- Test report and known limitations.
- Demo evidence.
- Updated risk and dependency status.
- Release notes for any deployed testnet change.

## 14. Immediate Sprint 0 kickoff checklist

- [ ] Name delivery owners for Product, Design, Web, Backend, Stellar, Contract, QA, and DevOps.
- [ ] Confirm one-week Sprint 0 and two-week delivery cadence.
- [ ] Confirm pilot wallet set.
- [ ] Confirm testnet USDC issuer/SAC and XLM SAC configuration source.
- [ ] Approve the three lifecycle state machines.
- [ ] Approve the permission matrix.
- [ ] Approve the route map.
- [ ] Agree which advanced fields are schema-only for the MVP.
- [ ] Create `packages/stellar` and `contracts/escrow`.
- [ ] Raise Node baseline to 20+.
- [ ] Add test and CI commands.
- [ ] Create deterministic buyer/supplier/order/asset fixtures.
- [ ] Apply the dark design tokens and `packages/ui` reuse rule.
- [ ] Schedule the Sprint 6 pilot validation session before development begins.
