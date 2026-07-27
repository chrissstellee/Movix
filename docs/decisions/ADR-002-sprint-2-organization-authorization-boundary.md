# ADR-002: Sprint 2 Organization Authorization Boundary

- Status: Accepted for implementation
- Date: 2026-07-27
- Owners: Elliot (technical), Bri (documentation)

## Context

Sprint 2 turns a wallet-authenticated user into an organization owner and exposes organization-scoped routes and mutable records. Wallet proof identifies a user but does not establish a tenant, role, or business authorization. Client-selected identifiers and routes are attacker-controlled.

## Decision

Every protected backend function derives the current user from `ctx.auth`, requires an active user/session, and independently resolves active organization membership. A single active membership may establish context. Zero memberships permits onboarding only. More than one produces an explicit unsupported result; the system never chooses.

Organization and child record identifiers are checked against the resolved membership on every call. Role/capability checks happen server-side. The browser receives a safe context for routing, but that policy does not replace backend authorization.

Onboarding completion creates the organization, owner membership, profile records, attestation, completion marker, and audit events atomically. Mutable records use optimistic versions. Audits record accepted changed field names, never before/after values.

## Consequences

- Cross-tenant access is denied even through guessed child identifiers.
- Organization loss causes protected UI unmount and redirect.
- Multiple-organization UX is intentionally deferred and explicit.
- Future roles can extend server capabilities without trusting JWT-held organization state.
- Every new organization-scoped API requires authorization-matrix tests.

## Alternatives rejected

- Browser-selected organization context: forgeable and unsafe.
- Organization or role embedded as the sole JWT authority: stale after membership changes.
- First active membership wins: arbitrary and cross-tenant-prone.
- Separate consent table: unnecessary for the fixed Sprint 2 attestation evidence.

## Change triggers

A new ADR is required for multi-organization selection, delegated administrators, organization switching persisted in sessions/JWTs, cross-organization workflows, or a different attestation/audit boundary.
