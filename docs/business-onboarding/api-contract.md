# Business Onboarding API Contract

All functions use Convex argument and return validators. Protected functions derive identity from `ctx.auth`. Versions are Convex `v.int64()` values and TypeScript `bigint`.

## Onboarding

### `onboarding.getDraft({})`

Returns one of:

- `blank`: version `0n`, identity step, no completed steps;
- `draft`: authenticated user’s normalized fields, completed/current steps, reuse flags, version, and update time;
- `completed`: version and resulting organization ID.

It never returns another user’s draft.

### `onboarding.saveDraft({ expectedVersion, patch })`

`patch` is a discriminated identity, contact, address, or preferences payload. `0n` creates version `1n`; accepted writes increment the version. Empty optional strings are represented as `null` and cleared server-side. The server validates and normalizes the visible step and computes progress. A stale version returns `DRAFT_STALE`; there are no partial writes.

### `onboarding.complete({ expectedDraftVersion, completionKey, attestationVersion })`

Requires the exact `business-profile-v1` version and a complete current draft. Success returns `organizationId`, owner `role`, organization `capability`, and `/buyer` or `/supplier` destination. Completion is atomic and idempotent for the same completed draft/key. A different key after completion returns `ONBOARDING_ALREADY_COMPLETED`.

## Organization context

### `organizations.currentContext({})`

Returns:

- `null` only when there is no active membership;
- `multiple` with safe user and wallet context when more than one active organization exists;
- `ready` with safe user, wallet, organization, membership, allowed views, and server-computed readiness.

### `organizations.getBusinessSettings({ organizationId })`

Requires an active membership in the exact organization. Returns editable organization fields, primary contact, canonical addresses, versions, and readiness.

### Profile mutations

`updateProfile`, `updatePrimaryContact`, and `updateAddress` require:

- exact organization and child identifiers;
- `organization:edit` capability;
- an explicit allowlisted patch;
- the affected document’s `expectedVersion`.

Accepted changes increment only that document’s version and produce one audit event containing changed field names. No-op, stale, rejected, and foreign-child requests produce no audit. `requestId` is optional and must never contain user or business data.

## Wallet

`auth.walletSettings({})` returns the verified public address, Testnet, verification time, active account status, and absolute session expiry. It returns no token, cookie, session identifier, or credential.

## Structured errors

The public catalog includes `UNAUTHENTICATED`, `USER_INACTIVE`, `DRAFT_NOT_FOUND`, `DRAFT_STALE`, `DRAFT_INVALID`, `ATTESTATION_REQUIRED`, `BUSINESS_DUPLICATE`, `ONBOARDING_ALREADY_COMPLETED`, `MEMBERSHIP_INACTIVE`, `ORGANIZATION_INACTIVE`, `ORGANIZATION_FORBIDDEN`, `PROFILE_STALE`, `FIELD_INVALID`, `MULTIPLE_ORGANIZATIONS_UNSUPPORTED`, and `INTERNAL_ERROR`.

Error data is stable and safe. It never confirms a foreign organization, child record, registration value, or contact/address value.
