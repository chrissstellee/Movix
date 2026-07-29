# Agricultural Trade User Guide

> Status: Sprint 6 experience implemented in development; release sign-off pending  
> Network: Stellar Testnet only

Movix coordinates a trade between an Importer and Exporter that already know one another. It is not a marketplace, freight forwarder, customs broker, inspection service, or legal certification authority.

## Before trading

1. Connect a supported Stellar wallet and sign in.
2. Complete the organization profile.
3. Choose Importer, Exporter, or both as the organization capability.
4. Complete organization verification.
5. If action is required, follow the verification panel rather than creating a second organization.

Users may inspect the workspace and save drafts while verification is pending. Issuing, accepting, document operations, and Shipment operations are blocked until the required organizations are verified. Funding, funded-escrow activation, on-chain dispatch, Delivery Confirmation release, and transaction recovery are Sprint 7 integration work and are not presented as completed Sprint 6 actions.

## Create and accept a Trade Order

The Importer identifies the intended Exporter and enters:

- commodity and optional grade/variety;
- exact quantity and unit of measure;
- origin and destination;
- price and settlement asset;
- shipment and expected-arrival windows;
- optional Incoterm edition, rule, and named place; and
- any agreed document requirements.

Review the complete revision before sending. The Exporter accepts or rejects that exact revision. A material change creates a new revision and requires acceptance again.

## Escrow and shipment

Sprint 6 records the exact accepted revision and keeps the Escrow and Shipment projections separate. Sprint 7 will add the wallet-reviewed funding transaction, funded-escrow activation, on-chain dispatch, Delivery Confirmation release, and interrupted-transaction recovery.

The Trade Order shows separate:

- Trade Agreement status;
- Escrow status;
- Shipment Status; and
- Trade Documents status.

Do not infer that an accepted Trade Agreement is funded, dispatched, delivered, or released. Consult each state separately.

## Trade Documents

Documents are private and versioned. The Sprint 6 detail page uploads a file with its browser-computed SHA-256 digest and shows type, visibility, version, size, digest, and scan state. Replacing a file through the backend creates a new version; it does not erase the earlier record. Backend APIs also expose authorized version metadata, clean-only download, replacement, and counterparty review.

New uploads are not downloadable while scanning is `pending`, and rejected files remain unavailable. The scanner integration and retention/deletion operations must be approved before release.

An uploaded certificate or shipment record is evidence supplied by a party. Movix does not independently declare it authentic, compliant, customs-cleared, or legally sufficient.

## Delivery and release — Sprint 7

The planned flow has the Importer review shipment and delivery evidence, record Delivery Confirmation, and sign the preserved contract release action. This value-moving integration is not part of Sprint 6. When implemented, release is irreversible after confirmed ledger settlement. If goods or documents are disputed, the approved exception/refund policy must be used before release.

## Common recovery states

- Verification pending or action required
- Waiting for Exporter acceptance
- Terms changed; re-acceptance required
- Document upload failed or access denied
- Trade Order expired, cancelled, or disputed

Sprint 7 adds financial recovery states such as waiting for Importer funding, wallet rejection or wrong network, unknown transaction finality, waiting for Exporter dispatch, and waiting for Importer Delivery Confirmation. When those value-moving actions are available, do not submit a second financial transaction while the first result is unknown; resume tracking from the Trade Order detail page.
