# Movix Architecture Decisions

Architecture Decision Records preserve choices that future implementers must not silently reinterpret.

## Index

| ADR                                                                | Decision                                                                                      | Status                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------- |
| [ADR-001](ADR-001-sprint-1-auth-boundary.md)                       | Sprint 1 wallet, SEP-10, session, JWT, and Convex authentication boundary                     | Accepted for implementation |
| [ADR-002](ADR-002-sprint-2-organization-authorization-boundary.md) | Sprint 2 identity, membership, organization, tenant-isolation, and atomic-onboarding boundary | Accepted for implementation |
| [ADR-003](ADR-003-agricultural-trade-pivot-compatibility-boundary.md) | Post-Sprint-5 agricultural domain, compatibility, document, and escrow boundary | Accepted |

## Lifecycle

Each ADR records context, decision, consequences, alternatives, owners, and change triggers. A later decision does not rewrite history: create a new ADR that supersedes the earlier record and update this index.

A new or superseding ADR is required before changing a fixed network, supported account/wallet class, SEP-10 trust boundary, JWT algorithm/identity contract, key-separation rule, browser persistence model, session rotation/revocation model, or authorization boundary.

Bri maintains clarity and indexing. Elliot owns technical accuracy. Product, security, or DevOps approve decisions in their areas.
