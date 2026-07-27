# Movix Sprint 2 — Detailed Business Onboarding and App Shell Plan

**Sprint:** 2  
**Theme:** Business identity, organization authorization, profile management, and authenticated navigation  
**Default duration:** 10 business days  
**Delivery target:** Authenticated-user-to-commercially-usable-organization vertical slice  
**Primary implementer:** Elliot  
**Prepared:** July 27, 2026  
**Source sprint plan:** [Movix Testnet MVP Sprint Plan](./Movix-Sprint-Plan.md)  
**Source implementation plan:** [Movix MVP Analysis and Implementation Plan](./Movix-Implementation-Plan.md)  
**Foundation plan:** [Movix Sprint 0 — Detailed Foundation Plan](./Movix-Sprint-00-Foundation-Detailed.md)  
**Authentication plan:** [Movix Sprint 1 — Detailed Landing and SEP-10 Authentication Plan](./Movix-Sprint-01-Landing-SEP10-Detailed.md)

## 1. Sprint purpose

Sprint 2 turns a wallet-authenticated Movix user into an authorized business actor.

Sprint 1 proves control of a Stellar Testnet wallet and creates a Movix application identity. It does not prove that the user belongs to a business or may act for one. Sprint 2 adds that missing business authorization boundary:

1. The user records a usable business identity.
2. Incomplete work is saved as a user-owned draft.
3. Final submission atomically creates one organization and one active owner membership.
4. All business reads and writes require the authenticated user and a matching active membership.
5. The completed organization enters a role-aware authenticated shell.
6. The owner can maintain permitted profile data without bypassing validation, versioning, or audit requirements.
7. The wallet and network remain visible as authentication context, not editable business data.

The sprint is complete only when Sprint 3 can trust the organization context. A polished form without backend membership enforcement is not a completed Sprint 2.

## 2. Capacity assumption

The 10-day schedule assumes:

- One Web/Product/Design workstream.
- One Backend/Authorization workstream.
- QA coverage throughout the sprint.

If Elliot is the only implementer across all workstreams, plan approximately 15–20 focused engineering days. Preserve the P0 scope and move S2-10 defaults before reducing:

- Organization isolation.
- Atomic organization and owner-membership creation.
- Draft recovery and duplicate-submission protection.
- Optimistic concurrency control.
- Required field validation.
- Authenticated shell accessibility.
- Automated authorization and end-to-end tests.

Do not use client-only route guards as a capacity shortcut. Browser redirects improve the experience, but Convex authorization is the security boundary.

## 3. Current repository baseline

Observed at Sprint 2 planning:

| Area                     | Present                                                                                                                                                        | Sprint 2 gap                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Authentication           | SEP-10 challenge verification, Movix access JWT, rotating session cookie, logout, and Convex auth integration are implemented in the current Sprint 1 worktree | Sprint 2 must consume this identity boundary without duplicating or weakening it                                         |
| Protected handoff        | `/onboarding/business` exists and confirms the Convex user before rendering                                                                                    | It is a placeholder with non-persisted fields and a disabled submit button                                               |
| Convex user lookup       | `auth.currentUser` derives identity from `ctx.auth`, checks active user/session family, and returns the verified Testnet wallet                                | It does not return memberships, organization context, onboarding state, or profile readiness                             |
| Schema                   | `organizations`, `memberships`, `contacts`, `addresses`, `wallets`, and `auditEvents` skeletons exist                                                          | Required commercial fields, onboarding drafts, consent evidence, profile versions, and supporting indexes are incomplete |
| Authorization vocabulary | `@repo/domain` defines organization roles and role-to-capability mappings                                                                                      | No reusable Convex `requireCurrentUser`, `requireActiveMembership`, or organization-scoping helpers exist                |
| Shared UI                | Sidebar, Sheet, Breadcrumb, DropdownMenu, Avatar, Form, Field, inputs, selects, Progress, Card, Alert, Skeleton, and Sonner primitives exist                   | No Movix authenticated shell or reusable business-form feature components exist                                          |
| App routes               | `/`, `/login`, and `/onboarding/business` exist                                                                                                                | `/settings/business`, `/settings/wallet`, `/buyer`, and `/supplier` shell destinations do not exist                      |
| Tests                    | Auth unit/component tests and a Playwright foundation journey exist                                                                                            | No organization-isolation, onboarding-resume, profile-edit, shell-navigation, or stale-version coverage exists           |
| Fixtures                 | Deterministic buyer/supplier user, asset, and order fixtures exist                                                                                             | Commercial organizations, owner memberships, contacts, addresses, and onboarding drafts need builders                    |

Sprint 2 should extend these boundaries. It should not move business data into the auth session, store organization authorization in browser state alone, or put Convex writes directly into page components.

## 4. Sprint goal

> A verified Movix user can save and resume a business-onboarding draft, submit a complete business profile exactly once, become the active owner of that organization, enter the correct buyer or supplier shell, securely maintain permitted profile fields, inspect the verified wallet/session context, and sign out; no user can read or modify another organization.

## 5. Sprint demo

The review must show one continuous journey:

1. Sign in through the Sprint 1 Testnet flow.
2. Reach `/onboarding/business` because the user has no active organization membership.
3. Complete the identity step and save it.
4. Refresh or close and reopen the page.
5. Resume at the last incomplete step with the saved values.
6. Complete contact, registered address, capability, timezone, and review steps.
7. Confirm the business-profile attestation.
8. Submit once and show that rapid repeat clicks do not create a second organization.
9. Show the new active `owner` membership and organization context.
10. Enter `/buyer` for a buyer-capable organization or `/supplier` for a supplier-only organization.
11. Navigate the desktop sidebar and mobile Sheet.
12. For a dual-capability organization, switch between buyer and supplier views without creating a second account or session.
13. Open `/settings/business`, edit an allowed field, and save it.
14. Demonstrate stale-version rejection using a second tab or deterministic test control.
15. Open `/settings/wallet` and show the verified address, Stellar Testnet, verification state, and sign-out action.
16. Sign out and show that protected Convex access and application-shell routes are lost.
17. Demonstrate one organization-isolation denial using an automated integration test or a controlled second organization.

The demo is incomplete if organization creation, membership creation, contacts, addresses, or audit events exist only in local component state.

## 6. Product and technical decisions fixed for Sprint 2

Elliot may improve implementation details without changing these behavior contracts.

| Decision                    | Sprint 2 rule                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication source       | Use the Sprint 1 Convex identity and `auth.currentUser`; never accept a browser-supplied user ID                                           |
| Business authorization      | Active organization membership is required for every organization-scoped read and write                                                    |
| Initial membership          | Successful onboarding creates one active `owner` membership for the authenticated user                                                     |
| MVP organization count      | One completed organization per user in the UI; schema and authorization may support more later                                             |
| Organization creation       | Draft storage is separate from organization storage; no partial organization is created while stepping through the form                    |
| Completion transaction      | Organization, membership, contact, addresses, consent evidence, completion marker, and audit event are written atomically                  |
| Duplicate completion        | Retrying the same completed draft returns the existing result or a stable already-completed outcome; it never creates another organization |
| Business capabilities       | User chooses buyer, supplier, or both; store as the existing `buyer`, `supplier`, or `buyer_supplier` canonical value                      |
| Owner role                  | The creator receives `owner`; role selection is not exposed during onboarding                                                              |
| Verification                | New organizations are `unverified`; Sprint 2 does not perform KYB or imply legal verification                                              |
| Organization status         | New organizations are `active`; suspension is an operator/security state and is not editable in the profile UI                             |
| Required registered address | Registered address is required; billing and shipping may explicitly reuse it                                                               |
| Country representation      | ISO 3166-1 alpha-2 uppercase code, not a free-text country name                                                                            |
| Timezone representation     | Valid IANA timezone identifier                                                                                                             |
| Currency representation     | ISO 4217 uppercase code for display only; it is not the Stellar settlement asset                                                           |
| Wallet relationship         | The verified wallet remains the user identity; it is displayed but not editable as organization profile data                               |
| Wallet change               | Changing the primary wallet is out of scope; the safe P0 action is sign out and authenticate again                                         |
| Active organization         | Resolve the user's single active owner membership on the server; do not trust an organization ID cached by the browser                     |
| Buyer/supplier switch       | A view switch changes navigation context only; it does not change identity, organization, membership, or backend permissions               |
| Draft persistence           | Server-side Convex draft with explicit version; browser storage may hold non-sensitive UI state only and is not authoritative              |
| Draft save                  | Explicit “Save and continue” is P0; debounced autosave is allowed only if serialized and tested                                            |
| Profile concurrency         | Mutations require `expectedVersion`; stale writes are rejected without overwriting newer data                                              |
| Audit                       | Completion and every accepted profile mutation create an audit event in the same transaction                                               |
| PII                         | Business and contact data remain in Convex; no profile field is written on-chain                                                           |
| Consent                     | Store a versioned business-profile attestation, actor, and timestamp; do not fabricate acceptance of unavailable legal terms               |
| Shell                       | One authenticated shell serves buyer, supplier, settings, and later order pages                                                            |
| Notifications               | Shell displays a safe empty placeholder/count; full notification behavior remains Sprint 8                                                 |
| Mainnet                     | Testnet remains visible; no network switch or Mainnet implication is added                                                                 |

If one of these decisions must change, record the change in `docs/decisions/` before implementing dependent work.

## 7. Actors and authorization model

### 7.1 Authenticated user without an organization

May:

- Read their own auth/user summary.
- Read and write their own onboarding draft.
- Complete their own onboarding.
- Sign out.

May not:

- Read any organization, membership, contact, address, order, transaction, notification, or audit data.
- Enter `/buyer`, `/supplier`, or organization settings.
- Supply a `userId` or `organizationId` to claim ownership of a draft.

### 7.2 Active owner

May:

- Read the organization for which their membership is active.
- Read and edit permitted organization profile fields.
- Read and edit the organization's primary contact and registered/billing/shipping addresses.
- Use every role capability currently mapped to `owner`.
- Enter buyer and/or supplier views only when the organization has the matching business capability.
- View the wallet/session summary for their own user.
- Sign out.

May not:

- Change `createdByUserId`, verification state, suspension state, audit history, or membership ownership through profile mutations.
- Read or mutate another organization.
- change the verified wallet through business settings.

### 7.3 Suspended or removed principal

- A suspended or removed user receives no protected business data.
- A suspended or removed membership receives no organization data.
- An active auth token does not override a suspended user or membership.
- The shell must leave protected content and present a safe reauthentication/support message.

### 7.4 Future roles

The schema keeps `admin`, `procurement`, `finance`, `operations`, and `viewer`, but member invitation and role-management UI are out of scope.

Authorization helpers should still accept a required role or domain capability so later sprints do not duplicate checks.

## 8. Primary user journeys

### 8.1 First-time onboarding

1. The authenticated user opens `/onboarding/business`.
2. The server resolves the current active user.
3. If an active membership already exists, the user is redirected to the correct app view.
4. If no completed organization exists, the server returns the user's draft or a blank draft at version `0`.
5. The user completes each step.
6. “Save and continue” validates the visible step and persists a normalized draft.
7. The review step shows all stored values, Testnet context, and unverified status.
8. The user accepts the business-profile attestation.
9. One completion mutation revalidates the full draft and creates all final records.
10. The server returns the new organization context and destination.
11. The client waits for the reactive organization-context query to confirm membership.
12. The user enters `/buyer` or `/supplier`.

### 8.2 Draft resume

1. The user leaves after any successful draft save.
2. A later authenticated visit reads the server draft.
3. The flow returns to the first incomplete required step, with the last server-confirmed values.
4. A stale browser copy never overwrites a newer server version silently.
5. A failed save keeps the user on the current step and preserves typed values for retry.

### 8.3 Returning member

1. A user with one active membership visits `/onboarding/business` or `/login`.
2. Server-derived organization context is loaded.
3. The user is redirected according to capability:
   - `buyer` → `/buyer`
   - `supplier` → `/supplier`
   - `buyer_supplier` → last safe in-memory view or `/buyer` by default
4. The authenticated shell displays organization, role, view, wallet, and network context.

### 8.4 Profile edit

1. Owner opens `/settings/business`.
2. Page loads the current profile plus `version`.
3. Owner edits an allowed field.
4. Client validates for immediate feedback.
5. Mutation revalidates, authorizes membership/role, and compares `expectedVersion`.
6. On success the update and audit event commit together.
7. On stale version the server changes nothing; the UI offers reload/review, never silent overwrite.

### 8.5 Sign out

1. User selects sign out from the shell or wallet settings.
2. The shared Sprint 1 logout flow revokes the session and clears in-memory auth.
3. Shell data unmounts.
4. Protected routes redirect to `/login`.
5. Organization data from the previous session is not left visible during the redirect.

## 9. Sprint scope

### 9.1 P0 committed scope

- Production stepped onboarding at `/onboarding/business`.
- Server-persisted, versioned onboarding draft and resume.
- Full required business identity, contact, registered address, capabilities, timezone, review, and attestation.
- Optional identity fields defined in Section 12.
- Billing/shipping “same as registered” behavior.
- Atomic finalization into organization, owner membership, contact, addresses, consent evidence, and audit event.
- Organization-context query derived from auth and active membership.
- Reusable Convex authorization helpers.
- Cross-organization denial on every new public organization function.
- Authenticated application shell using shared UI primitives.
- Buyer and supplier shell destinations with empty Sprint 3/4 handoff content.
- Capability-aware buyer/supplier view switch.
- `/settings/business` profile view/edit with optimistic concurrency.
- `/settings/wallet` verified wallet/network/session summary and sign out.
- Profile-readiness result with field-specific remediation links.
- Loading, empty, error, retry, expired-session, suspended, and stale-write states.
- Unit, backend integration, component, accessibility, responsive, and Playwright coverage.
- Deterministic organization, membership, draft, contact, and address fixtures.

### 9.2 P1 scope

- Preferred Stellar settlement asset.
- Default payment-terms days.
- Display currency.
- Notification defaults.
- Debounced autosave in addition to explicit save.
- Remembering buyer/supplier view preference across devices.
- Operational/product analytics beyond required audit evidence.

### 9.3 Stretch

- Additional organization members.
- Invitations and role management.
- Logo upload or file storage.
- External business verification.
- Multiple active organization selection.
- Full notification center.

### 9.4 Explicitly out of scope

- Orders, counterparties, procurement lists, or dashboard counts.
- Wallet replacement, additional-wallet linking, or network switching.
- KYB/KYC, sanctions checks, registry lookup, or tax-ID verification.
- Mainnet.
- Payments, balances, trustlines, transaction signing, or contract calls.
- Admin fund movement or operator impersonation.
- Custom roles, permission overrides, spending limits, or approval limits.
- Legal-document authoring.
- Email/phone verification.
- Automated tax determination.
- Geocoding, address deliverability confirmation, or carrier validation.

## 10. Route and redirect contract

| Route                                   | Required state                                   | Behavior                                                                                           |
| --------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `/onboarding/business`                  | Authenticated active user, no active membership  | Show/resume onboarding                                                                             |
| `/onboarding/business`                  | Authenticated active user with active membership | Redirect to capability-appropriate app view                                                        |
| `/settings/business`                    | Authenticated active user and active membership  | Show organization settings                                                                         |
| `/settings/wallet`                      | Authenticated active user                        | Show the user's verified Testnet wallet/session; organization shell is used when membership exists |
| `/buyer`                                | Active membership and buyer capability           | Show Sprint 3 handoff/empty buyer view                                                             |
| `/supplier`                             | Active membership and supplier capability        | Show Sprint 4 handoff/empty supplier view                                                          |
| Any protected route                     | No valid app session                             | Redirect to `/login` without rendering protected data                                              |
| Any organization route                  | Suspended/removed user or membership             | Deny, clear protected shell data, and show safe recovery                                           |
| `/buyer` without buyer capability       | Active membership                                | Redirect to `/supplier` if allowed; otherwise show a capability error linked to business settings  |
| `/supplier` without supplier capability | Active membership                                | Redirect to `/buyer` if allowed; otherwise show a capability error linked to business settings     |

Use a single route-policy source for navigation and page guards. Backend functions must independently enforce the same authorization because route policy is not a security boundary.

Avoid redirect loops:

- Auth loading must finish before redirect decisions.
- Convex auth confirmation must finish before membership decisions.
- `undefined` query state means loading; `null` means the requested context is unavailable.
- Logout or session invalidation must stop organization queries before redirecting.

## 11. Onboarding information architecture

Use five steps. Keep each step short enough for a 320px screen and retain a visible progress label such as “Step 2 of 5.”

### Step 1 — Business identity

Required:

- Legal business name.
- Registration country.
- Business email.
- Buyer/supplier capabilities.
- Default timezone.

Optional:

- Trading name.
- Entity type.
- Registration number.
- Tax ID.
- Industry.
- Website.
- Business phone.

Outcome:

- User understands that the organization will initially be unverified.
- Valid normalized data can be saved as a draft.

### Step 2 — Primary contact

Required:

- Contact name.
- Contact email.
- Contact type, default `general`.
- Primary marker, fixed true for the first contact.

Optional:

- Phone.
- Job title.
- Department.

The business email and contact email may match. Do not duplicate or secretly synchronize them after initial entry.

### Step 3 — Registered address

Required:

- Recipient or business name.
- Address line 1.
- City/locality.
- Country code.

Conditionally required:

- State/province/region according to the selected country's configured rule.
- Postal code according to the selected country's configured rule.

Optional:

- Address line 2.
- Delivery instructions.

Provide:

- “Use registered address for billing.”
- “Use registered address for shipping.”

When selected, finalization creates explicit billing/shipping records copied from the registered address. Later changes to one record do not silently rewrite the others.

### Step 4 — Preferences

P0:

- Confirm timezone.
- Confirm buyer/supplier capabilities.
- Explain that Testnet is fixed.

P1:

- Preferred settlement asset.
- Display currency.
- Default payment terms.
- Notification defaults.

Do not present display currency as a settlement asset. A user may display PHP while a later order settles in Testnet USDC.

### Step 5 — Review and attest

Show:

- Organization identity.
- Contact.
- Registered, billing, and shipping choices.
- Capabilities.
- Timezone and P1 defaults if implemented.
- Verified login wallet.
- Stellar Testnet.
- Organization status after creation: active and unverified.

Require:

- A checkbox confirming: “I am authorized to create this business profile and confirm the information is accurate.”
- Attestation version `business-profile-v1`.

The final action says “Create business,” not “Verify business.”

## 12. Business field contract

The following is the Sprint 2 UI and persistence contract. `R` means required, `O` optional, `D` derived, and `S` sensitive business/PII data.

### 12.1 Organization

| Field                               | Class | Validation and behavior                                                                                                     |
| ----------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| `legalName`                         | R/S   | Trimmed Unicode, 2–160 characters; preserve display case and diacritics                                                     |
| `normalizedLegalName`               | D/S   | Unicode-normalized, whitespace-collapsed, case-folded value used only for comparison/search seams                           |
| `registrationCountry`               | R/S   | Uppercase ISO 3166-1 alpha-2 code                                                                                           |
| `businessEmail`                     | R/S   | Trim, lowercase domain, maximum 254 characters; syntax validation only                                                      |
| `capability`                        | R     | `buyer`, `supplier`, or `buyer_supplier`                                                                                    |
| `defaultTimezone`                   | R     | Valid IANA timezone                                                                                                         |
| `status`                            | D     | `active` on creation; not profile-editable                                                                                  |
| `verificationStatus`                | D     | `unverified` on creation; not profile-editable                                                                              |
| `tradingName`                       | O/S   | 2–160 characters when present                                                                                               |
| `entityType`                        | O/S   | Controlled value: `sole_proprietor`, `partnership`, `corporation`, `limited_company`, `nonprofit`, `government`, or `other` |
| `registrationNumber`                | O/S   | Trimmed, 2–64 characters; country-specific format is not asserted unless a rule is configured                               |
| `registrationFingerprint`           | D/S   | Optional server-side hash of country plus normalized registration number for duplicate detection                            |
| `taxId`                             | O/S   | Trimmed, 2–64 characters; never expose in general logs or list responses                                                    |
| `industry`                          | O/S   | Controlled catalog value or `other`; do not store arbitrary hidden HTML                                                     |
| `website`                           | O/S   | Absolute `https://` or `http://` URL; normalize hostname; maximum 2,048 characters                                          |
| `businessPhone`                     | O/S   | Normalize to E.164 when country rules allow; otherwise reject rather than store ambiguous punctuation-only input            |
| `logoMetadata`                      | O/S   | Schema seam only; upload is Stretch                                                                                         |
| `defaultDisplayCurrency`            | P1/S  | Uppercase ISO 4217 code                                                                                                     |
| `preferredAssetCode`                | P1    | Server allowlisted value only                                                                                               |
| `defaultPaymentTermsDays`           | P1    | Integer 0–365                                                                                                               |
| `createdByUserId`                   | D     | Authenticated user ID                                                                                                       |
| `profileAttestationVersion`         | R/D   | `business-profile-v1`                                                                                                       |
| `profileAttestedByUserId`           | R/D   | Authenticated user ID                                                                                                       |
| `profileAttestedAt`                 | R/D   | Server timestamp                                                                                                            |
| `createdAt`, `updatedAt`, `version` | D     | Server controlled                                                                                                           |

Business email, legal name, and trading name are not globally unique. Do not leak the existence of another organization based only on those fields.

If registration country and registration number are both present, a server-side fingerprint may reject an exact active duplicate using a generic error. Never return the other organization's name, owner, or ID.

### 12.2 Primary contact

| Field                               | Class | Validation and behavior                                                       |
| ----------------------------------- | ----- | ----------------------------------------------------------------------------- |
| `organizationId`                    | D     | Created organization                                                          |
| `type`                              | R     | `general`, `procurement`, `accounts_payable`, `sales`, `shipping`, or `legal` |
| `name`                              | R/S   | 2–120 characters                                                              |
| `email`                             | R/S   | Valid email syntax, maximum 254 characters                                    |
| `phone`                             | O/S   | Same normalization policy as business phone                                   |
| `jobTitle`                          | O/S   | Maximum 120 characters                                                        |
| `department`                        | O/S   | Maximum 120 characters                                                        |
| `isPrimary`                         | R     | `true` for the initial contact                                                |
| `createdAt`, `updatedAt`, `version` | D     | Server controlled                                                             |

### 12.3 Address

| Field                               | Class         | Validation and behavior                                                |
| ----------------------------------- | ------------- | ---------------------------------------------------------------------- |
| `organizationId`                    | D             | Created organization                                                   |
| `type`                              | R             | `registered`, `billing`, or `shipping` in the Sprint 2 UI              |
| `label`                             | R/S           | “Registered,” “Billing,” or “Shipping” by default; 1–80 characters     |
| `recipientName`                     | R/S           | 2–160 characters                                                       |
| `line1`                             | R/S           | 2–200 characters                                                       |
| `line2`                             | O/S           | Maximum 200 characters                                                 |
| `city`                              | R/S           | 1–120 characters                                                       |
| `region`                            | Conditional/S | 1–120 characters when the selected-country rule requires it            |
| `postalCode`                        | Conditional/S | Country-rule validation; do not require globally                       |
| `countryCode`                       | R/S           | Uppercase ISO 3166-1 alpha-2                                           |
| `deliveryInstructions`              | O/S           | Maximum 500 characters; not shown for registered address unless useful |
| `isDefault`                         | R             | True for the initial record of its type                                |
| `createdAt`, `updatedAt`, `version` | D             | Server controlled                                                      |

The current schema uses `business` as an address type. Sprint 2 should make `registered` canonical before pilot data exists. If a persistent environment already contains `business` records, use a widen-migrate-narrow change rather than invalidating them in place.

### 12.4 Membership

| Field                               | Class | Validation and behavior        |
| ----------------------------------- | ----- | ------------------------------ |
| `organizationId`                    | D     | Created organization           |
| `userId`                            | D     | Authenticated user             |
| `role`                              | D     | `owner`                        |
| `status`                            | D     | `active`                       |
| `acceptedAt`                        | D     | Same server time as completion |
| `createdAt`, `updatedAt`, `version` | D     | Server controlled              |

The unique business rule is one membership per `(organizationId, userId)`. Enforce it in the completion mutation using the existing composite index.

### 12.5 Onboarding draft

Draft fields mirror the editable onboarding fields plus:

| Field                               | Class | Validation and behavior                                      |
| ----------------------------------- | ----- | ------------------------------------------------------------ |
| `userId`                            | D     | Authenticated user; unique active draft                      |
| `currentStep`                       | R     | `identity`, `contact`, `address`, `preferences`, or `review` |
| `completedSteps`                    | R     | Bounded set of server-validated steps                        |
| `sameBillingAsRegistered`           | R     | Boolean                                                      |
| `sameShippingAsRegistered`          | R     | Boolean                                                      |
| `status`                            | R     | `draft` or `completed`                                       |
| `completedOrganizationId`           | O/D   | Set only after successful finalization                       |
| `createdAt`, `updatedAt`, `version` | D     | Server controlled                                            |

Use explicit validators for draft fields. Do not accept an untyped JSON blob or trust a client-provided completion flag.

## 13. Validation and normalization rules

### 13.1 General text

- Trim leading and trailing whitespace.
- Collapse repeated internal whitespace for names, but preserve user-entered line breaks only in fields that explicitly support them.
- Normalize Unicode consistently before comparisons.
- Preserve the user's display form separately from derived comparison values.
- Reject control characters and values containing only punctuation or whitespace.
- Apply both client and server validation; server validation is authoritative.
- Return field-keyed, user-safe errors.

### 13.2 Email

- Trim surrounding whitespace.
- Lowercase the domain.
- Do not claim ownership verification.
- Do not use email as an authorization key.
- Do not expose whether an email belongs to another organization.

### 13.3 Country and address

- Country selector uses code/value pairs, with human-readable localized names.
- Persist only the uppercase country code.
- Use a versioned in-repository country-rule registry.
- At minimum, encode region/postal behavior for every country enabled for the pilot.
- For other valid ISO country codes, apply base requirements only unless Product explicitly blocks that country.
- Never make state/province or postal code universally required.
- A country change revalidates region and postal code but does not silently delete them.

### 13.4 Timezone

- Use an IANA timezone selector.
- Default from the user's existing timezone or browser only as a suggestion.
- Require explicit confirmation.
- Store the canonical identifier, not a raw UTC offset.

### 13.5 Phone

- Use the selected country as parsing context.
- Store a normalized E.164 value where supported.
- Preserve no separate unvalidated phone value.
- Phone is optional; do not block the entire profile when it is absent.

### 13.6 URLs

- Accept only absolute HTTP(S) URLs.
- Normalize hostname case.
- Reject credential-bearing URLs and unsupported schemes such as `javascript:`, `data:`, or `file:`.

### 13.7 Registration and tax identifiers

- Treat as sensitive.
- Do not log raw values in analytics, errors, or audit metadata.
- Do not claim registry validation.
- Do not require them globally.
- Use generic duplicate errors when an exact configured fingerprint conflicts.

## 14. Canonical onboarding state machine

Use one orchestration state instead of unrelated booleans.

| State               | User sees                                  | Allowed actions                             | Exit                                                                         |
| ------------------- | ------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------- |
| `auth_checking`     | Protected-session progress                 | None                                        | `loading_draft`, `redirecting_login`, or `access_denied`                     |
| `loading_draft`     | Form skeleton                              | None                                        | `editing`, `redirecting_app`, or `load_error`                                |
| `editing`           | Current step and server-confirmed progress | Edit, back, save and continue               | `saving`, `reviewing`, or `signing_out`                                      |
| `saving`            | Current step disabled with progress        | No duplicate save                           | `editing`, `reviewing`, `validation_error`, `stale_draft`, or `save_error`   |
| `reviewing`         | Full review and attestation                | Back, attest, create                        | `completing` or `editing`                                                    |
| `completing`        | Creation progress                          | No duplicate submit/navigation warning only | `awaiting_context`, `validation_error`, `stale_draft`, or `completion_error` |
| `awaiting_context`  | “Preparing your workspace”                 | None                                        | `redirecting_app` or `context_error`                                         |
| `stale_draft`       | Newer server draft exists                  | Reload server version                       | `loading_draft`                                                              |
| `load_error`        | Safe load failure                          | Retry, sign out                             | `loading_draft` or `signing_out`                                             |
| `save_error`        | Values retained, save failed               | Retry, edit                                 | `saving` or `editing`                                                        |
| `completion_error`  | No partial success shown                   | Retry, review                               | `completing` or `reviewing`                                                  |
| `access_denied`     | Suspended/inactive explanation             | Sign out, support action if configured      | `signing_out`                                                                |
| `redirecting_login` | No protected content                       | None                                        | `/login`                                                                     |
| `redirecting_app`   | No duplicate form flash                    | None                                        | `/buyer` or `/supplier`                                                      |
| `signing_out`       | Sign-out progress                          | None                                        | `/login` or `/`                                                              |

Late responses must include the user/draft/version snapshot that initiated them. Ignore a response when the session, user, or draft version has changed.

## 15. Draft save, resume, and concurrency contract

### 15.1 Draft ownership

- Draft queries and mutations accept no `userId`.
- Resolve the user from `ctx.auth`.
- One active draft exists per user.
- A completed draft is immutable except for operational cleanup metadata.

### 15.2 Save behavior

- “Save and continue” validates the current step.
- Server normalizes the accepted fields.
- Mutation compares `expectedVersion`.
- First save creates version `1`; each accepted change increments by one.
- A save response returns the new version, current step, completed steps, and `updatedAt`.
- Repeated identical saves may return the current draft without a needless version increment.
- Invalid fields do not partially update the draft.

### 15.3 Autosave

If P1 autosave is implemented:

- Debounce after meaningful changes.
- Serialize requests; only one save may be in flight.
- Never use last-response-wins without version checks.
- Announce saved/saving/error status without stealing focus.
- Explicit save remains available.
- Browser close during an in-flight save may lose only changes that were visibly not yet confirmed.

### 15.4 Completion idempotency

Completion receives:

- `expectedDraftVersion`.
- `completionKey`, a random client-generated idempotency key scoped to the authenticated user and draft.
- `attestationVersion`.

The mutation:

1. Resolves active user.
2. Loads the user's draft.
3. Returns the prior completed organization when the same completed draft/key is retried.
4. Rejects a mismatched version.
5. Revalidates every required field.
6. Checks that the user does not already have an active organization created through onboarding.
7. Checks configured registration duplicate rules without leaking another record.
8. Writes all final records and audit evidence in one Convex transaction.
9. Marks the draft completed with the organization ID and completion key.
10. Returns organization ID, capability, role, and destination.

No client sequence of separate “create organization,” “create membership,” and “create address” mutations is acceptable.

## 16. Proposed Convex schema changes

Elliot should update the Sprint 0 skeleton before building form wiring.

### 16.1 `users`

Add or confirm:

- `displayName` optional during Sprint 2 unless Product makes it required.
- `locale` optional with a safe default.
- `timezone` retained and updated only through an explicit user preference action.
- Existing auth identifiers and status remain server controlled.

Do not store active organization as an authorization shortcut. The MVP derives the single active membership from the server.

### 16.2 `businessOnboardingDrafts`

Add a bounded draft table with:

- `userId`.
- Explicit optional profile/contact/address/preference fields.
- Current/completed step state.
- Same-address booleans.
- Status and completion metadata.
- `createdAt`, `updatedAt`, and `version`.

Indexes:

- `by_userId`.
- `by_userId_and_status`.
- Optional `by_updatedAt` only if operational cleanup is implemented.

### 16.3 `organizations`

Extend the current table with Section 12.1 fields.

Indexes:

- Existing `by_status`.
- Existing `by_createdByUserId`.
- Optional `by_registrationFingerprint` for exact configured duplicate checks.

Do not add indexes on raw tax ID, raw email, or raw phone for convenience.

### 16.4 `memberships`

Keep the existing role/status model and composite index.

Add:

- `acceptedAt` where useful for future invitation semantics.

The existing `by_organizationId_userId` index is the membership uniqueness and lookup path.

### 16.5 `contacts`

Align contact types with the implementation-plan vocabulary.

Add:

- `jobTitle`.
- `department`.
- `version`.

Keep contacts as separate documents, not an unbounded organization array.

### 16.6 `addresses`

Make `registered`, `billing`, and `shipping` canonical.

Add:

- `recipientName`.
- `deliveryInstructions`.
- `isDefault`.
- `version`.

Keep addresses as separate documents.

### 16.7 `auditEvents`

The existing table is sufficient for the base event, but Sprint 2 should confirm an audit payload strategy.

Store:

- Entity type and ID.
- Organization.
- Actor user and wallet where appropriate.
- Stable action.
- Correlation ID.
- Server timestamp.

Do not store complete before/after PII in the audit event. If changed-field evidence is required, store a bounded list of field names, not raw sensitive values.

Suggested actions:

- `organization.created`.
- `membership.owner_created`.
- `organization.profile_updated`.
- `organization.capability_updated`.
- `organization.primary_contact_updated`.
- `organization.address_updated`.
- `organization.preferences_updated`.

## 17. Proposed backend module and API contract

Exact filenames may change, but keep public APIs small and domain-oriented.

### 17.1 Shared authorization helpers

Suggested internal module: `packages/backend/convex/lib/authorization.ts`

Required helpers:

- `requireCurrentUser(ctx)`:
  - Gets `ctx.auth.getUserIdentity()`.
  - Uses canonical token identifier/session checks consistent with Sprint 1.
  - Loads the active user.
  - Throws a stable unauthenticated or inactive-user error.
- `requireActiveMembership(ctx, organizationId)`:
  - Calls `requireCurrentUser`.
  - Loads membership through `(organizationId, userId)`.
  - Requires membership status `active`.
  - Loads and requires organization status `active`.
  - Returns user, membership, and organization.
- `requireRole(...)` or `requireCapability(...)`:
  - Builds on active membership.
  - Uses `@repo/domain` role mappings.
  - Does not accept a client assertion that a role is active.
- `getSingleActiveOrganizationContext(ctx)`:
  - Resolves the user's active membership(s).
  - Returns `null` for none.
  - Returns the organization context for exactly one.
  - Returns an explicit unsupported-multiple-organizations result rather than selecting an arbitrary record.

### 17.2 Onboarding APIs

Suggested module: `packages/backend/convex/onboarding.ts`

`getDraft`

- Type: public query.
- Args: none.
- Auth: active authenticated user.
- Returns: blank-state metadata or the user's draft with safe fields and version.
- Must not return another user's draft.

`saveDraft`

- Type: public mutation.
- Args: `expectedVersion`, `currentStep`, explicit step patch.
- Auth: active authenticated user.
- Behavior: validates, normalizes, creates/patches one draft, increments version.
- Returns: normalized draft summary and version.

`complete`

- Type: public mutation.
- Args: `expectedDraftVersion`, `completionKey`, `attestationVersion`.
- Auth: active authenticated user with no completed organization from this flow.
- Behavior: Section 15.4 atomic finalization.
- Returns: organization context and destination.

### 17.3 Organization-context APIs

Suggested module: `packages/backend/convex/organizations.ts`

`currentContext`

- Type: public query.
- Args: none.
- Auth: active authenticated user.
- Returns:
  - user summary.
  - verified wallet/network summary.
  - organization ID, legal/trading name, capability, status, verification status, and version.
  - membership role/status.
  - allowed buyer/supplier views.
  - profile readiness.
- Returns `null` when no membership exists.

`getBusinessSettings`

- Type: public query.
- Args: `organizationId`.
- Auth: matching active membership.
- Returns: permitted organization, contact, address, preference, and version fields.
- Redact sensitive identifiers from roles that do not need them when future roles become active.

`updateProfile`

- Type: public mutation.
- Args: `organizationId`, `expectedVersion`, explicit profile patch.
- Auth: active owner/admin with `organization:edit`.
- Behavior: validates, rejects protected fields, checks version, updates, audits.

`updatePrimaryContact`

- Type: public mutation.
- Args: `organizationId`, `contactId`, `expectedVersion`, explicit patch.
- Auth: active owner/admin.
- Behavior: organization match, validation, version check, update, audit.

`updateAddress`

- Type: public mutation.
- Args: `organizationId`, `addressId`, `expectedVersion`, explicit patch.
- Auth: active owner/admin.
- Behavior: organization match, country validation, version check, update, audit.

`updateDefaults`

- Type: P1 public mutation.
- Args: allowlisted defaults plus expected organization version.
- Auth: active owner/admin.
- Behavior: validates server allowlists, updates, audits.

### 17.4 Wallet settings API

Extend `auth.currentUser` or add `auth.walletSettings`.

Return only:

- Verified address.
- Network.
- Verified-at time.
- User/account status.
- Safe session metadata such as current-session issued/expiry time if already available.

Do not return:

- Credential hashes.
- Session-family IDs.
- Raw JWT.
- Refresh token.
- Signing keys.
- Internal security-event details.

## 18. Error contract

Use stable codes and safe messages. Suggested mapping:

| Code                                 | Meaning                                              | User action                                          |
| ------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------- |
| `UNAUTHENTICATED`                    | No valid Movix identity                              | Return to login                                      |
| `USER_INACTIVE`                      | User suspended or removed                            | Sign out and contact support if available            |
| `ONBOARDING_ALREADY_COMPLETED`       | User already has the completed organization          | Continue to app                                      |
| `DRAFT_NOT_FOUND`                    | Completion requested without draft                   | Return to onboarding start                           |
| `DRAFT_STALE`                        | Expected version differs                             | Reload the latest draft                              |
| `DRAFT_INVALID`                      | One or more fields fail validation                   | Fix field-keyed errors                               |
| `ATTESTATION_REQUIRED`               | Missing/wrong attestation version                    | Review and attest                                    |
| `BUSINESS_DUPLICATE`                 | Exact configured registration duplicate              | Review registration details; no other-org data shown |
| `MEMBERSHIP_INACTIVE`                | Membership not active                                | Leave protected shell and show safe recovery         |
| `ORGANIZATION_INACTIVE`              | Organization suspended                               | Block business actions                               |
| `ORGANIZATION_FORBIDDEN`             | No matching membership/role/capability               | Return to an allowed route                           |
| `PROFILE_STALE`                      | Profile/contact/address version differs              | Reload and review                                    |
| `FIELD_INVALID`                      | Mutation validation failed                           | Fix associated field                                 |
| `MULTIPLE_ORGANIZATIONS_UNSUPPORTED` | Future/migrated user has multiple active memberships | Stop arbitrary selection and show support-safe state |
| `INTERNAL_ERROR`                     | Unexpected failure                                   | Retry with correlation ID; no stack or PII           |

Convex errors must not include raw tax IDs, emails, phones, addresses, tokens, or details about another organization.

## 19. Authenticated application shell contract

Suggested component boundary:

- `AppShell`
- `AppSidebar`
- `AppMobileNavigation`
- `BusinessSwitcher` or organization identity display
- `RoleViewSwitcher`
- `WalletNetworkIndicator`
- `NotificationPlaceholder`
- `UserMenu`
- `ProtectedRouteState`

### 19.1 Desktop

- Persistent Sidebar using `packages/ui`.
- Movix brand and Testnet badge.
- Organization trading name or legal name.
- Buyer/supplier view switch when both are available.
- Primary navigation for current view.
- Settings navigation.
- Wallet/network status.
- User menu and sign out.
- Main content landmark with page heading and Breadcrumb.

### 19.2 Tablet and mobile

- Sidebar becomes a Sheet.
- Menu trigger has an accessible name and expanded state.
- Route change closes the Sheet.
- Escape closes it.
- Focus returns to the trigger.
- Background content is not keyboard reachable while open.
- Navigation and actions fit 320px without horizontal scrolling.

### 19.3 Buyer/supplier switch

- Show only for `buyer_supplier`.
- Buyer-only and supplier-only organizations see a fixed view label, not a disabled mystery control.
- Switching navigates to `/buyer` or `/supplier`.
- It does not change JWT claims or call a role mutation.
- Deep links remain protected by server-derived capability checks.

### 19.4 Wallet/network indicator

Show:

- Truncated wallet address with full-value copy/view action.
- `Stellar Testnet`.
- Connected/authenticated state wording that does not imply a payment connection.

Do not show:

- Wallet balance.
- Mainnet switch.
- Secret key.
- A “funds secured” claim.

### 19.5 Notification placeholder

- Show count `0` or “No notifications.”
- It may open a small empty state.
- Do not create fake notifications.
- Do not link to a dead route.
- Use a live badge only after real notification queries arrive in later sprints.

### 19.6 Shell loading and invalidation

- Use a full shell skeleton while organization context is loading.
- Never flash a prior organization's name or data.
- On auth loss, unmount protected content before redirect.
- On membership or organization suspension, remove actions immediately.

## 20. Business settings contract

`/settings/business` is an owner-editable view of the completed profile.

### 20.1 Sections

- Business identity.
- Capabilities.
- Primary contact.
- Registered address.
- Billing address.
- Shipping address.
- Preferences, when P1 is implemented.
- Verification/status explanation.

### 20.2 Editable fields

All Section 12 display fields except:

- Organization ID.
- Created-by user.
- Status.
- Verification status.
- Attestation actor/time/version.
- Creation timestamp.
- Audit history.

### 20.3 Edit interaction

- View mode is the default.
- Each section may have its own edit action.
- Visible labels remain present.
- Save disables duplicate submission.
- Cancel restores the last server-confirmed values.
- Server errors associate with fields or section summary.
- Success is announced and focus moves predictably.
- Stale update offers “Reload latest” and explains that no changes were overwritten.

Changing a capability is allowed in Sprint 2 because no order obligations exist yet. The API should still be structured so later sprints can reject removal of a capability with active obligations.

## 21. Wallet settings contract

`/settings/wallet` explains the login identity and gives a safe sign-out path.

Show:

- Wallet address.
- Stellar Testnet.
- Verified time when available.
- Account/session status in plain language.
- “Signing in does not transfer funds.”
- Copy full address.
- Sign out.

Do not allow:

- Direct address editing.
- Network switching.
- Secret-key entry.
- Wallet balance or payment signing.
- Linking another wallet.
- Revoking other sessions unless a complete server contract is added later.

If wallet disconnect is offered, keep it separate from Movix sign out. Movix sign out must succeed even when a wallet extension disconnect call fails.

## 22. Profile readiness and blocker contract

Sprint 2 must expose a server-derived readiness result for Sprint 3 and later.

Suggested shape:

```text
profileReadiness = {
  organizationUsable: boolean
  buyerReady: boolean
  supplierReady: boolean
  missing: [
    {
      code
      label
      settingsPath
      requiredFor
    }
  ]
}
```

Rules:

- Onboarding completion requires the P0 organization fields, primary contact, and registered address.
- Buyer view requires buyer capability.
- Supplier view requires supplier capability.
- Missing P1 defaults do not block shell entry.
- Missing optional tax, phone, website, industry, logo, billing, or shipping fields do not block unrelated actions.
- Later order creation may require a billing/ship-to selection; same-as-registered records satisfy the initial requirement.
- Blocker copy names the missing information and links directly to the relevant settings section.
- Do not use one vague “profile incomplete” boolean.

## 23. Accessibility and responsive contract

### 23.1 Stepped form

- One visible `h1`.
- Progress exposes current step, total steps, and meaningful label.
- Step list does not rely on color alone.
- Each input has a persistent label.
- Required fields are identified in text and programmatically.
- Error summary links to invalid fields.
- Field errors use `aria-describedby`.
- On failed step submission, focus moves to the error summary or first invalid field.
- Back/continue order is predictable.
- Saving status uses a polite live region.
- Completion failures do not erase values.

### 23.2 Review

- Use semantic definition lists or headings, not a visual-only grid.
- Edit links name their target section.
- Attestation checkbox has full accessible text.
- Create action communicates progress and prevents duplicate activation.

### 23.3 Shell

- Desktop Sidebar and mobile Sheet meet keyboard/focus expectations.
- Current navigation item is programmatically indicated.
- Buyer/supplier switch has an accessible name and selected state.
- Long legal names and wallet addresses wrap or truncate safely.
- Main content receives logical focus after route navigation where appropriate.

### 23.4 Required viewport checks

- 320px.
- Tablet portrait.
- Desktop.
- 200% zoom/text resize.
- No horizontal scroll in onboarding, navigation, business settings, or wallet settings.

## 24. Proposed repository target

This is a guide, not a requirement to create empty files.

```text
apps/web/
  app/
    (app)/
      layout.tsx
      buyer/page.tsx
      supplier/page.tsx
      settings/
        business/page.tsx
        wallet/page.tsx
    onboarding/
      business/page.tsx
  core/
    organization/
      organization-context.tsx
      route-policy.ts
  features/
    onboarding/
      business-onboarding.tsx
      onboarding-machine.ts
      onboarding-schema.ts
      components/
    shell/
      app-shell.tsx
      app-sidebar.tsx
      mobile-navigation.tsx
      role-view-switcher.tsx
      wallet-network-indicator.tsx
    business-settings/
      business-settings.tsx
      profile-sections.tsx
    wallet-settings/
      wallet-settings.tsx

packages/backend/convex/
  lib/
    authorization.ts
    businessValidation.ts
  onboarding.ts
  organizations.ts
  schema.ts
  validators.ts

packages/domain/src/
  business.ts
  permissions.ts
  fixtures.ts

e2e/
  onboarding.spec.ts
  organization-isolation.spec.ts
  app-shell.spec.ts
```

Keep form schemas and business normalization reusable. Do not create separate incompatible validation rules in onboarding and settings.

## 25. Detailed backlog

## S2-01 — Create a business organization

**Priority:** P0  
**Disciplines:** Product, Backend  
**Estimate:** 2 person-days  
**Depends on:** Sprint 1 identity, draft schema, validation contract

Outcome:

- A valid completed draft creates one commercially usable organization.

Implementation notes:

- Add missing organization fields and validators.
- Implement atomic completion.
- Set `active`, `unverified`, creator, attestation, timestamps, and version server-side.
- Return capability-aware destination.
- Make retry idempotent.

Acceptance criteria:

- [ ] Unauthenticated completion fails without writes.
- [ ] Suspended/removed user completion fails without writes.
- [ ] Required fields are server validated.
- [ ] Organization fields are normalized.
- [ ] Creator comes from authenticated identity.
- [ ] Status and verification state cannot be supplied by the browser.
- [ ] Successful completion returns one stable organization.
- [ ] Repeated or concurrent completion creates no duplicate.
- [ ] Completion produces an audit event.

Required tests:

- Valid buyer, supplier, and dual-capability creation.
- Missing/invalid field matrix.
- Duplicate click and concurrent completion.
- Retry after response loss.
- Suspended user.
- Configured registration duplicate with non-leaking error.

## S2-02 — Record standard business identity

**Priority:** P0  
**Disciplines:** Product, Design, Web, Backend  
**Estimate:** 2 person-days  
**Depends on:** Field contract, shared validation

Outcome:

- The business identity is usable by later procurement screens without pretending to be externally verified.

Acceptance criteria:

- [ ] Legal name, country, business email, capability, and timezone are required.
- [ ] Optional fields follow Section 12.
- [ ] UI and server share compatible validation behavior.
- [ ] Country is a code selector, not free text.
- [ ] Timezone is canonical and explicitly confirmed.
- [ ] Unverified status is explained.
- [ ] Tax/registration data is excluded from logs and general errors.
- [ ] Required and optional semantics remain clear at 320px.

Required tests:

- Boundary lengths.
- Unicode names.
- Whitespace normalization.
- Invalid email, URL, phone, country, and timezone.
- Buyer/supplier/both selection.
- Sensitive field log review.

## S2-03 — Record contacts and addresses

**Priority:** P0  
**Disciplines:** Web, Backend  
**Estimate:** 2.5 person-days  
**Depends on:** Country rules, contact/address schema

Outcome:

- The organization has one primary contact and usable registered, billing, and shipping addresses.

Acceptance criteria:

- [ ] One primary contact is created.
- [ ] One registered address is created.
- [ ] Same-as-registered options create explicit billing/shipping records.
- [ ] Country-aware region/postal rules run on client and server.
- [ ] Changing country revalidates dependent fields.
- [ ] Contact/address documents belong to the created organization.
- [ ] Later edits cannot reference another organization's contact/address ID.
- [ ] Contact/address writes are versioned and audited.

Required tests:

- Pilot-country address rules.
- Valid country without mandatory postal/region.
- Same-as-registered copy.
- Independent address edit after completion.
- Foreign contact/address ID denial.
- Optional phone and delivery instructions.

## S2-04 — Save and resume onboarding

**Priority:** P0  
**Disciplines:** Web, Backend  
**Estimate:** 2 person-days  
**Depends on:** Draft schema and state machine

Outcome:

- A user can leave and safely continue without creating a partial organization.

Acceptance criteria:

- [ ] Draft belongs to authenticated user.
- [ ] Explicit save persists the validated step.
- [ ] Refresh resumes the last server-confirmed data.
- [ ] First incomplete required step is selected.
- [ ] Version mismatch does not overwrite a newer draft.
- [ ] Failed save preserves typed values.
- [ ] No organization or membership exists before completion.
- [ ] Completed draft cannot be reopened to create another organization.

Required tests:

- Save each step.
- Refresh and new-browser-session resume.
- Two-tab stale write.
- Network/server error then retry.
- Unauthenticated and cross-user access denial.
- Completed-draft retry.

## S2-05 — Create owner membership atomically

**Priority:** P0  
**Disciplines:** Backend  
**Estimate:** 1 person-day  
**Depends on:** S2-01

Outcome:

- Organization creation and business authorization cannot diverge.

Acceptance criteria:

- [ ] Completion creates an active owner membership in the same transaction.
- [ ] Membership user comes from authenticated identity.
- [ ] Role and status are server controlled.
- [ ] Composite uniqueness is checked.
- [ ] Failure in any finalization write rolls back organization and membership.
- [ ] Returning context resolves the new membership.
- [ ] Owner capabilities match `@repo/domain`.

Required tests:

- Transaction rollback on induced contact/address failure.
- Duplicate membership.
- Wrong browser-supplied identity is impossible.
- Owner capability mapping.

## S2-06 — Enforce organization isolation

**Priority:** P0  
**Disciplines:** Backend, QA  
**Estimate:** 2 person-days  
**Depends on:** Authorization helpers and two-organization fixtures

Outcome:

- Every new organization-scoped function proves identity, active membership, organization status, and required role/capability.

Acceptance criteria:

- [ ] Public functions have explicit argument and return validators.
- [ ] No public function accepts user identity for authorization.
- [ ] Organization, contact, and address IDs are checked together.
- [ ] Suspended/removed memberships fail.
- [ ] Suspended organizations fail.
- [ ] Cross-organization reads and writes fail.
- [ ] Errors do not reveal whether a foreign record exists.
- [ ] Shared helpers are used consistently.

Required tests:

- Authorization matrix for every new public function.
- Buyer owner versus supplier owner isolation.
- Inactive user, membership, and organization.
- Foreign organization/contact/address IDs.
- Missing identity.

## S2-07 — Build the authenticated app shell

**Priority:** P0  
**Disciplines:** Design, Web  
**Estimate:** 3 person-days  
**Depends on:** `organizations.currentContext`

Outcome:

- Completed organizations have one accessible, role-aware navigation shell ready for later sprints.

Acceptance criteria:

- [ ] Desktop Sidebar and mobile Sheet reuse `packages/ui`.
- [ ] Organization name, role, capability view, Testnet, wallet, settings, and sign out are visible.
- [ ] Dual-capability switch reaches buyer and supplier routes.
- [ ] Unsupported views are blocked.
- [ ] Buyer/supplier pages contain honest empty handoff content, not fake metrics.
- [ ] Auth/session loss unmounts protected content.
- [ ] Navigation works by keyboard and screen reader.
- [ ] Mobile focus restores after Sheet close.
- [ ] No horizontal scroll at 320px.

Required tests:

- Buyer-only, supplier-only, and dual-capability navigation.
- Direct unauthorized route.
- Mobile open/close/route-change focus.
- Session expiry in shell.
- Loading and organization-suspended state.

## S2-08 — Edit permitted business profile fields

**Priority:** P0  
**Disciplines:** Web, Backend  
**Estimate:** 3 person-days  
**Depends on:** Settings query, validation, authorization

Outcome:

- An owner can safely maintain the profile without overwriting concurrent edits or protected fields.

Acceptance criteria:

- [ ] Settings load only for active members.
- [ ] Owner may edit allowed fields.
- [ ] Protected fields are absent from mutation args.
- [ ] Organization/contact/address edits use expected versions.
- [ ] Stale update changes nothing.
- [ ] Each accepted update emits one audit event.
- [ ] Cancel restores server-confirmed values.
- [ ] Success and error are announced accessibly.
- [ ] Foreign child record IDs are denied.

Required tests:

- Happy-path identity/contact/address edits.
- Invalid field matrix.
- Stale organization/contact/address versions.
- Duplicate save.
- Foreign organization and child IDs.
- Audit event created only on accepted mutation.

## S2-09 — Explain profile blockers

**Priority:** P0  
**Disciplines:** Product, Design, Web, Backend  
**Estimate:** 1 person-day  
**Depends on:** Server readiness computation

Outcome:

- Users know exactly what is missing and only relevant future actions are blocked.

Acceptance criteria:

- [ ] Readiness is computed server-side from stored records.
- [ ] Missing items have stable codes, labels, required-for context, and settings links.
- [ ] Optional fields do not block unrelated actions.
- [ ] Capability mismatch is distinct from missing profile data.
- [ ] Messages avoid claiming external verification.
- [ ] Empty blocker list means the organization is commercially usable for its selected capability.

Required tests:

- Complete buyer/supplier/dual profiles.
- Missing required contact/address.
- Missing optional tax/phone/logo.
- Buyer route without buyer capability.
- Correct remediation deep links.

## S2-10 — Store business defaults

**Priority:** P1  
**Disciplines:** Web, Backend  
**Estimate:** 1.5 person-days  
**Depends on:** Server asset allowlist and settings foundation

Outcome:

- Later order forms may start with safe organization defaults.

Acceptance criteria:

- [ ] Preferred asset comes from a server allowlist.
- [ ] Display currency is clearly non-settlement.
- [ ] Payment terms are integer days within range.
- [ ] Notification defaults are bounded and do not send messages in Sprint 2.
- [ ] Defaults are versioned and audited.
- [ ] Absence never blocks onboarding or shell entry.

Required tests:

- Allowed/disallowed asset.
- Currency format.
- Payment-term boundaries.
- Stale version.
- No notification side effect.

## 26. Ten-day execution plan

## Day 1 — Freeze the business contract

- Re-run Sprint 1 identity and quality gates.
- Confirm the Sprint 1 protected-user API is stable.
- Confirm pilot country list or the documented ISO/base-rule fallback.
- Approve required/optional fields, capability behavior, and attestation text.
- Freeze error codes and route redirects.
- Create Sprint 2 work items and dependencies.

Evidence:

- No unresolved P0 field or authorization ambiguity.
- Business profile does not imply KYB.
- Elliot can name every final record created by completion.

## Day 2 — Schema, validators, fixtures, and authorization helpers

- Add draft and missing final-profile schema fields.
- Align contact/address types.
- Add deterministic buyer and supplier organization fixtures.
- Add two-organization isolation fixtures.
- Implement shared identity/membership/role helpers.
- Add helper unit/integration tests.

Evidence:

- Schema validation tests pass.
- Cross-organization fixture is available.
- Inactive principal tests fail safely.

## Day 3 — Draft query/save and onboarding state

- Implement `getDraft` and `saveDraft`.
- Implement normalized field/step validators.
- Build onboarding orchestration state.
- Replace the Sprint 1 placeholder with real loading/edit/save states.

Evidence:

- One step saves to Convex.
- Refresh restores it.
- Stale version is rejected.

## Day 4 — Identity and contact steps

- Complete business identity UI.
- Complete primary contact UI.
- Add field errors, progress semantics, and responsive layout.
- Add component and validation tests.

Evidence:

- Required and optional fields behave per contract.
- Invalid server response maps to safe field errors.
- 320px form remains usable.

## Day 5 — Address, review, and atomic completion

- Complete country-aware registered address.
- Add same-as billing/shipping behavior.
- Complete review and attestation.
- Implement atomic finalization and idempotency.
- Implement current organization context.

Mid-sprint gate:

- A real authenticated user resumes a draft.
- One completion creates organization, owner membership, contact, addresses, consent, and audit.
- Convex immediately resolves the active organization context.
- Concurrent completion creates exactly one organization.

If this gate fails, stop shell polish and finish the business authorization boundary.

## Day 6 — Authenticated shell and capability routes

- Build app shell.
- Add `/buyer` and `/supplier` handoff pages.
- Add capability-aware view switch.
- Add desktop and mobile navigation.
- Wire shared logout.

Evidence:

- Buyer/supplier/dual fixtures see only allowed views.
- Mobile Sheet manages focus correctly.
- Protected content disappears on logout.

## Day 7 — Business and wallet settings

- Build `/settings/business`.
- Build `/settings/wallet`.
- Implement settings queries and versioned mutations.
- Add audit events.

Evidence:

- Owner updates profile.
- Wallet remains read-only.
- Foreign organization and child IDs fail.

## Day 8 — Readiness, concurrency, and recovery

- Implement profile-readiness result.
- Add field-specific remediation links.
- Complete stale draft/profile recovery.
- Complete suspended user/membership/organization handling.
- Review duplicate, retry, and late-response paths.

Evidence:

- No optional field creates an unrelated blocker.
- Two-tab stale edits never silently overwrite.
- Suspended context leaves the shell safely.

## Day 9 — Integration, accessibility, and browser journeys

- Add onboarding, shell, settings, and organization-isolation Playwright journeys.
- Run keyboard, screen-reader, contrast, focus, and responsive checks.
- Test refresh, session expiry, sign out, and failure recovery.
- Review logs and errors for PII.

Evidence:

- Required browser matrix passes.
- No serious/critical automated accessibility violation.
- Cross-organization denial suite covers every new public function.

## Day 10 — Hardening, demo, and closure

- Run all root quality gates from a clean checkout.
- Rehearse the complete demo and one failure case.
- Capture screenshots and test evidence.
- Record known limitations and moved P1 items.
- Verify Sprint 3 definition of ready.

Evidence:

- No P0 defect remains.
- One organization is commercially usable.
- Sprint 3 can trust identity, organization, role, capability, contacts, and addresses.

## 27. Test plan

### 27.1 Validation unit tests

- Legal/trading name minimum, maximum, Unicode, and whitespace.
- Valid/invalid country code.
- Valid/invalid IANA timezone.
- Business and contact email normalization.
- URL schemes, credentials, and length.
- Phone parsing by supported pilot country.
- Optional registration and tax identifier boundaries.
- Entity type and capability values.
- Display-currency and payment-term boundaries when P1 is present.
- Registered address base requirements.
- Country-specific region/postal requirements.
- Country where region/postal is optional.
- Same-as-registered copy behavior.

### 27.2 Draft tests

- Blank draft.
- First save.
- Step update.
- Reload/resume.
- First incomplete step.
- Identical no-op save.
- Invalid patch.
- Unknown field rejection.
- Stale version.
- Concurrent saves.
- Cross-user isolation.
- Suspended user.
- Completed draft immutability.

### 27.3 Completion tests

- Buyer organization.
- Supplier organization.
- Dual-capability organization.
- Organization defaults.
- Owner membership.
- Primary contact.
- Registered address.
- Copied billing/shipping addresses.
- Attestation evidence.
- Audit events.
- Full rollback on induced failure.
- Duplicate completion.
- Concurrent completion.
- Retry after response loss.
- Existing active owner organization.
- Configured registration duplicate.
- Unauthenticated/inactive user.

### 27.4 Authorization tests

For every new public Convex query/mutation:

- Missing identity.
- Active owner and matching organization.
- Different active organization.
- Suspended/removed membership.
- Suspended organization.
- Suspended/removed user.
- Foreign contact ID.
- Foreign address ID.
- Unsupported capability.
- Protected-field mutation attempt is structurally impossible or rejected.
- Error does not reveal foreign-record existence.

### 27.5 Profile concurrency tests

- Correct expected version.
- Stale organization version.
- Stale contact version.
- Stale address version.
- Two tabs edit different values.
- Repeated save click.
- Response loss then retry.
- Audit emitted once for accepted write.
- Audit omitted for rejected/no-op write.

### 27.6 Component tests

- Every onboarding state in Section 14.
- Step progress and accessible name.
- Required/optional labels.
- Error summary and field association.
- Save pending/disabled behavior.
- Typed-value preservation after failure.
- Review/edit links.
- Attestation required.
- Completion pending and retry.
- Buyer/supplier/dual shell.
- Mobile Sheet focus restoration.
- Settings view/edit/cancel/save/stale states.
- Wallet address full copy/view access.
- Sign-out progress and failure behavior.

### 27.7 Required Playwright journeys

1. New buyer saves, refreshes, resumes, completes, and reaches `/buyer`.
2. New supplier completes and reaches `/supplier`.
3. Dual-capability owner switches buyer → supplier → buyer.
4. Incomplete step shows associated errors and recovers.
5. Two-tab stale draft rejects the older save.
6. Duplicate completion click creates one organization.
7. Owner edits business, contact, and address settings.
8. Two-tab stale profile edit reloads without overwrite.
9. Foreign organization URL/function attempt is denied.
10. Session expiry during onboarding returns safely to login.
11. Session expiry in the shell removes protected content.
12. Wallet settings shows Testnet identity and sign out blocks protected access.
13. Mobile navigation opens, navigates, closes, and restores focus.

Use deterministic Convex fixtures in CI. Do not depend on a live external registry, email service, phone service, or blockchain call.

### 27.8 Accessibility checks

- 320px, tablet, desktop.
- Keyboard-only completion.
- Screen-reader smoke.
- Heading and landmark order.
- Form labels and required state.
- Error summary and focus.
- Progress semantics.
- Live save/completion status.
- Sidebar/Sheet focus trap and restoration.
- Current navigation state.
- Contrast and visible focus.
- Reduced motion.
- 200% zoom/text resize.
- No horizontal scroll.

## 28. Quality commands

At minimum, Sprint 2 closure requires:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:a11y
pnpm test:e2e
pnpm build
```

Contract gates remain green even though Sprint 2 should not change escrow behavior:

```bash
pnpm test:contracts
pnpm build:contracts
```

If `test:a11y` currently targets only the foundation showcase, update the script so Sprint 2 accessibility tests run in CI. Do not leave new accessibility tests outside the root gate.

## 29. Security and privacy review checklist

- [ ] Every public Convex function has argument and return validators.
- [ ] Identity always comes from `ctx.auth`.
- [ ] No authorization function accepts a browser-supplied user ID.
- [ ] Every organization-scoped read/write checks active membership.
- [ ] Role/capability checks happen in the backend.
- [ ] Suspended/removed users and memberships are denied.
- [ ] Suspended organizations are denied.
- [ ] Foreign contact/address IDs are denied without existence leakage.
- [ ] Drafts are user-scoped and separate from final organizations.
- [ ] Completion is atomic and idempotent.
- [ ] Optimistic versions prevent silent overwrite.
- [ ] Protected organization/status/verification/audit fields are not client editable.
- [ ] Tax IDs, registration IDs, emails, phones, and addresses are absent from general logs.
- [ ] Audit records contain field names or categories, not complete sensitive before/after values.
- [ ] No profile PII is written on-chain.
- [ ] No auth token, credential hash, session-family ID, wallet secret, or signing key appears in settings responses.
- [ ] Wallet address is read-only business context.
- [ ] Mainnet is not selectable or implied.
- [ ] Browser redirects do not replace backend authorization.
- [ ] Protected data unmounts on auth or membership loss.
- [ ] Duplicate and concurrency tests pass.

## 30. Risks and controls

| Risk                                                | Probability | Impact   | Control                                                            | Trigger                                             |
| --------------------------------------------------- | ----------- | -------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| Form polish hides missing backend authorization     | Medium      | Critical | Day 5 real organization-context gate                               | UI works but membership checks are absent           |
| Separate mutations leave orphan organization        | Medium      | High     | One atomic completion mutation                                     | Organization exists without owner/contact/address   |
| Duplicate click creates multiple organizations      | Medium      | High     | Draft completion key, transaction check, concurrency test          | Same user owns two onboarding-created organizations |
| Generic organization query leaks tenant data        | Medium      | Critical | Shared membership helpers and function-by-function isolation tests | Foreign organization ID returns data                |
| Universal postal/state rules reject valid addresses | High        | Medium   | Versioned country rules and base fallback                          | Country without postal code cannot complete         |
| Tax/registration data leaks through logs            | Medium      | High     | Sensitive-field exclusions and log review                          | Raw value appears in error/analytics                |
| Client state overwrites newer draft/profile         | Medium      | High     | Expected versions and two-tab tests                                | Older tab saves successfully over newer data        |
| Buyer/supplier switch is mistaken for authorization | Medium      | High     | Switch is navigation only; backend checks capability               | Manually opening route bypasses capability          |
| Existing address `business` type breaks migration   | Low         | Medium   | Check persistent data; widen-migrate-narrow if needed              | Deploy rejects existing record                      |
| Multiple organizations appear unexpectedly          | Low         | Medium   | Explicit unsupported-multiple state                                | Server arbitrarily selects first membership         |
| One implementer exceeds two-week capacity           | High        | Medium   | Preserve P0, cut defaults/autosave first                           | Day 5 gate misses                                   |
| Business profile implies verified legitimacy        | Medium      | High     | `unverified` copy and “Create,” not “Verify”                       | UI claims Movix verified the business               |
| Shell flashes protected data after logout           | Low         | High     | Unmount on auth loss and browser test                              | Old organization remains visible                    |

## 31. Definition of done

Every completed Sprint 2 item must:

- Meet its acceptance criteria.
- Use Sprint 1 identity without duplicating auth logic.
- Enforce organization and role authorization in Convex.
- Reuse `packages/ui` primitives.
- Cover loading, empty, error, disabled, pending, stale, retry, and success states.
- Work at 320px, tablet, and desktop.
- Pass keyboard and screen-reader smoke checks.
- Include proportional unit, component, integration, and end-to-end tests.
- Prevent duplicate submissions and stale writes.
- Normalize and validate data on the server.
- Keep sensitive business data out of logs and audit payloads.
- Produce audit evidence in the same transaction as accepted profile changes.
- Pass format, lint, typecheck, tests, accessibility, end-to-end, contract, and build gates.

## 32. Sprint exit checklist

Product:

- [ ] Required/optional field contract is implemented.
- [ ] Unverified status is accurately explained.
- [ ] Buyer, supplier, and dual-capability outcomes are correct.
- [ ] Attestation wording is approved and versioned.
- [ ] Missing optional fields do not create unrelated blockers.

Onboarding:

- [ ] Authenticated user without membership reaches onboarding.
- [ ] Draft saves to Convex.
- [ ] Refresh resumes the last confirmed draft.
- [ ] Stale draft is rejected safely.
- [ ] Completion is full-draft validated.
- [ ] Completion is atomic.
- [ ] Duplicate/concurrent completion creates one organization.
- [ ] Returning member skips onboarding.

Organization authorization:

- [ ] Owner membership is active and server-created.
- [ ] Current context is derived from auth and membership.
- [ ] Every new public function has cross-organization denial coverage.
- [ ] Suspended user, membership, and organization are denied.
- [ ] Foreign child record IDs are denied.
- [ ] Multiple-active-organization ambiguity is not silently resolved.

Profile:

- [ ] Organization, contact, and address fields persist.
- [ ] Country-aware validation works for the pilot rules.
- [ ] Billing/shipping same-as behavior creates explicit records.
- [ ] Profile edits require expected versions.
- [ ] Stale edit changes nothing.
- [ ] Accepted edits produce audit events.
- [ ] Sensitive values are absent from logs.

Shell and settings:

- [ ] Desktop Sidebar works.
- [ ] Mobile Sheet works and restores focus.
- [ ] Buyer/supplier routes enforce capability.
- [ ] Dual-capability switch works.
- [ ] Wallet/network context is accurate and read-only.
- [ ] Notification placeholder is honest and non-broken.
- [ ] Sign out removes protected access and content.

Quality:

- [ ] Required validation tests pass.
- [ ] Required authorization tests pass.
- [ ] Required component tests pass.
- [ ] Required Playwright journeys pass.
- [ ] Accessibility checks pass.
- [ ] 320px/tablet/desktop checks pass.
- [ ] Production build passes.
- [ ] Contract gates remain green.
- [ ] No P0 defect remains open.

## 33. Required review evidence

Attach or link:

- Onboarding screenshots for all five steps at desktop.
- Onboarding identity/address screenshots at 320px.
- Draft save/resume test output.
- Stale draft two-tab evidence.
- Atomic completion and rollback test output.
- Duplicate/concurrent completion test output.
- Created organization/member/contact/address/audit fixture summary with sensitive values redacted.
- Cross-organization authorization matrix results.
- Buyer, supplier, and dual shell screenshots.
- Mobile Sheet focus/navigation evidence.
- Business settings view/edit/stale screenshots.
- Wallet settings screenshot with a safe fixture address.
- Sign-out/expired-session browser evidence.
- Accessibility report.
- Playwright report.
- PII/log review result.
- Known limitations and moved P1 items.

## 34. Sprint closure decision

Choose exactly one.

### Complete

All P0 exit criteria pass. Sprint 3 may trust the organization, membership, capability, contact, address, and shell boundaries.

### Conditional close

Only non-blocking P1 defaults, autosave, analytics, view-preference persistence, or cosmetic work remains. Each item has an owner and destination sprint.

### Not complete

Any of the following remains:

- Organization-scoped functions trust a client-supplied user or role.
- Cross-organization reads or writes are possible.
- Organization and owner membership are not created atomically.
- Duplicate completion can create multiple organizations.
- Draft save/resume is browser-only or unreliable.
- Stale writes overwrite newer data.
- Required commercial fields are absent or only client validated.
- Wallet identity is editable as ordinary business profile data.
- The shell grants buyer/supplier access without checking capability.
- Suspended users, memberships, or organizations retain access.
- Critical onboarding/settings accessibility path is missing.
- Sensitive profile values appear in logs or broad audit payloads.

Do not move these gaps into Sprint 3 procurement work.

## 35. Handoff to Sprint 3

Sprint 3 may assume:

- `ctx.auth` resolves a stable active Movix user.
- A completed user has exactly one supported active organization context.
- The organization has an active owner membership.
- Backend helpers enforce membership and domain capabilities.
- Buyer/supplier capability is canonical.
- Legal name, registration country, business email, timezone, primary contact, and registered/billing/shipping addresses are available.
- Profile readiness returns actionable missing-field codes.
- Business settings use optimistic versioning and audit.
- The authenticated shell, buyer route, navigation, wallet/network indicator, and sign out are production-ready.
- Organization data is isolated.

Sprint 3 still owns:

- Counterparty relationship or invitation.
- Buyer dashboard counts/activity.
- Order list and pagination.
- Purchase-order draft/autosave.
- Commercial and delivery terms.
- Line items and exact amount calculations.
- Immutable order revision and send/cancel behavior.

If any Sprint 2 assumption is false, Sprint 3 should stop at its definition-of-ready gate rather than implement local authorization workarounds.

## 36. Elliot start checklist

Before coding:

- [ ] Read this document, the Sprint 0 foundation plan, and the Sprint 1 auth handoff.
- [ ] Confirm Sprint 1 `auth.currentUser` and logout tests are green.
- [ ] Read `packages/backend/AGENTS.md` and the current generated Convex guidelines before backend changes.
- [ ] Inspect persistent Convex data before changing the address-type validator.
- [ ] Confirm pilot country rules or use the documented ISO/base fallback.
- [ ] Confirm the business-profile attestation text and version with Product.
- [ ] Create S2-01 through S2-10 work items and dependencies.
- [ ] Add two-organization fixtures before implementing public business queries.
- [ ] Build atomic completion and current organization context by the Day 5 gate.
- [ ] Keep P1 defaults/autosave behind the P0 cut line.

When uncertain, preserve the identity → membership → organization authorization chain. Do not make the browser the source of truth for organization ownership, role, capability, draft completion, or profile version.

## 37. Implementation references

Local sources of truth:

- [Movix MVP Analysis and Implementation Plan](./Movix-Implementation-Plan.md)
- [Movix Testnet MVP Sprint Plan](./Movix-Sprint-Plan.md)
- [Sprint 1 authentication architecture](./auth/architecture.md)
- [Sprint 1 API contract](./auth/api-contract.md)
- [Sprint 1 security operations runbook](./auth/security-operations-runbook.md)
- [Sprint 1 authentication boundary decision](./decisions/ADR-001-sprint-1-auth-boundary.md)
- `packages/backend/convex/_generated/ai/guidelines.md`
- `packages/backend/convex/schema.ts`
- `packages/backend/convex/auth.ts`
- `packages/domain/src/permissions.ts`

Re-check framework documentation when implementation behavior is uncertain, but do not widen Sprint 2 scope to new authentication, registry, storage, or notification products.

## 38. Sign-off

| Discipline       | Owner        | Status  | Date | Notes |
| ---------------- | ------------ | ------- | ---- | ----- |
| Product          | Nicole/Chris | Pending | —    | —     |
| Design           | TBD          | Pending | —    | —     |
| Web              | Elliot       | Pending | —    | —     |
| Backend          | Elliot/TBD   | Pending | —    | —     |
| QA               | TBD          | Pending | —    | —     |
| Security/Privacy | TBD          | Pending | —    | —     |

Final Product sign-off requires:

- Sprint goal achieved.
- All P0 evidence present.
- No unresolved identity, membership, organization-isolation, duplicate, stale-write, or PII ambiguity.
- Sprint 3 can begin procurement work without modifying the Sprint 2 authorization contract.

## 39. Confirmed implementation amendment and current status

This appendix records confirmed implementation defaults without changing the backlog, estimates, demo, schedule, risks, or acceptance wording above.

- P0 scope is S2-01 through S2-09. S2-10, autosave, analytics, and persisted view preference moved out of Sprint 2.
- The canonical capability is a single `buyer | supplier | buyer_supplier` value, not a client-maintained capability array.
- Organization context is resolved from current active membership on the server; it is not trusted from session-held organization claims.
- P1 and optional fields never block entry. P0 organization identity, primary contact, and registered address determine organization usability; capability determines buyer/supplier readiness.
- The approved attestation version is `business-profile-v1`, using the exact text in this specification.
- Philippine addresses require region and four-digit postal code; other ISO countries use the base address rule.
- Unchecked billing/shipping reuse reveals separate fields, and completion always creates registered, billing, and shipping records.
- Persistent-data inventory selects direct canonical schema versus widen-migrate-narrow.
- Sprint 1 evidence remains a hard Sprint 2 release gate.

Implementation status: **Not complete for release**. Core domain, Convex, and web implementation is present; dedicated-deployment E2E, full accessibility/manual evidence, persistent-data inventory/migration execution, Product wording/rule approval, Sprint 1 gate, and final sign-offs remain open.

Living references:

- [Implementation runbook](./business-onboarding/implementation-runbook.md)
- [Architecture](./business-onboarding/architecture.md)
- [API contract](./business-onboarding/api-contract.md)
- [Data and validation](./business-onboarding/data-and-validation.md)
- [Security and operations](./business-onboarding/security-operations-runbook.md)
- [Testing and acceptance IDs](./business-onboarding/testing-and-evidence.md)
- [ADR-002](./decisions/ADR-002-sprint-2-organization-authorization-boundary.md)
- [Sprint 2 evidence manifest](./evidence/sprint-02/README.md)
