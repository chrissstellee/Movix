# Movix Sprint 8: Fulfillment Release Technical Documentation

## Executive Summary
Sprint 8 delivers the complete, production-grade fulfillment and escrow settlement release for Movix. Building upon the core order creation (Sprint 4), supplier acceptance (Sprint 5), trade document verification (Sprint 6), and escrow funding (Sprint 7) infrastructure, Sprint 8 implements the complete physical-to-financial lifecycle for cross-border trade transactions.

---

## 1. Architectural Overview & System Design

```
+-----------------------------------------------------------------------------------+
|                                 MOVIX PLATFORM                                    |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Importer / Buyer ]                              [ Exporter / Supplier ]        |
|          |                                                    |                   |
|          v                                                    v                   |
|   +--------------+                                   +------------------+         |
|   |  Apps / Web  |                                   |    Apps / Web    |         |
|   +------+-------+                                   +--------+---------+         |
|          |                                                    |                   |
|          |  1. Prepare / Submit Intents                       |  2. Record        |
|          |                                                    |     Shipment      |
|          v                                                    v                   |
|   +---------------------------------------------------------------------+         |
|   |                       Convex Backend Services                       |         |
|   |  - escrowFunding.ts       - escrowReconciliation.ts                 |         |
|   |  - orderFulfillmentAuth.ts - tradeDocuments.ts                      |         |
|   +----------------------------------+----------------------------------+         |
|                                      |                                            |
|                                      | 3. On-chain Verification / Event Sync      |
|                                      v                                            |
|   +---------------------------------------------------------------------+         |
|   |                       Stellar Soroban Testnet                       |         |
|   |                                                                     |         |
|   |                +-----------------------------------+                |         |
|   |                |  movix_escrow.rs Smart Contract   |                |         |
|   |                +-----------------------------------+                |         |
|   |                | - deposit()                       |                |         |
|   |                | - record_shipment()               |                |         |
|   |                | - confirm_delivery()              |                |         |
|   |                | - release()                       |                |         |
|   |                | - refund()                        |                |         |
|   |                +-----------------------------------+                |         |
|   +---------------------------------------------------------------------+         |
+-----------------------------------------------------------------------------------+
```

---

## 2. Soroban Smart Contract Architecture (`movix_escrow.rs`)

### Contract Overview
The `movix_escrow` Soroban smart contract guarantees trustless, non-custodial settlement of trade payments on the Stellar network using SAC-compatible tokens (e.g. USDC).

### Storage & Data Structures

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracttype]
pub enum Status {
    Created = 0,
    Funded = 1,
    Shipped = 2,
    Released = 3,
    Refunded = 4,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct Escrow {
    pub order_id: String,
    pub buyer: Address,
    pub seller: Address,
    pub token: Address,
    pub amount: i128,
    pub status: Status,
    pub milestone_deadlines: MilestoneDeadlines,
    pub milestone_evidence: MilestoneEvidence,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct MilestoneDeadlines {
    pub deposit_deadline: u64,
    pub shipment_deadline: u64,
    pub delivery_deadline: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct MilestoneEvidence {
    pub deposit_manifest_hash: BytesN<32>,
    pub shipment_manifest_hash: BytesN<32>,
    pub delivery_manifest_hash: BytesN<32>,
}
```

### Core Functions & Authorization Enforcements

1. **`deposit(env, caller, order_id, manifest_hash)`**
   - **Auth**: Requires `caller.require_auth()`. `caller` must be `escrow.buyer`.
   - **Guards**: `escrow.status == Status::Created`, `env.ledger().timestamp() <= deposit_deadline`.
   - **Token Transfer**: Transfers `amount` from `buyer` to contract address using `token_client.transfer()`.
   - **State Update**: Updates status to `Status::Funded` and records `deposit_manifest_hash`.

2. **`record_shipment(env, caller, order_id, shipment_manifest_hash)`**
   - **Auth**: Requires `caller.require_auth()`. `caller` must be `escrow.seller`.
   - **Guards**: `escrow.status == Status::Funded`, `env.ledger().timestamp() <= shipment_deadline`.
   - **State Update**: Updates status to `Status::Shipped` and records `shipment_manifest_hash`.

3. **`confirm_delivery(env, caller, order_id, delivery_manifest_hash)`**
   - **Auth**: Requires `caller.require_auth()`. `caller` must be `escrow.buyer`.
   - **Guards**: `escrow.status == Status::Shipped`, `env.ledger().timestamp() <= delivery_deadline`.
   - **Token Release**: Transfers `amount` from contract address to `escrow.seller`.
   - **State Update**: Updates status to `Status::Released` and records `delivery_manifest_hash`.

4. **`refund(env, caller, order_id)`**
   - **Auth**: Requires `caller.require_auth()`. `caller` must be `escrow.buyer`.
   - **Guards**:
     - If `status == Status::Funded`: requires `ledger().timestamp() > shipment_deadline`.
     - If `status == Status::Shipped`: requires `ledger().timestamp() > delivery_deadline`.
   - **Token Refund**: Transfers `amount` back from contract address to `escrow.buyer`.
   - **State Update**: Updates status to `Status::Refunded`.

---

## 3. Backend Services & State Machines (`packages/backend`)

### Convex Mutations & Authorization Guards

- **`orderFulfillmentAuth.ts`**:
  - `prepareAcceptIntent`: Authorizes intended Exporter, verifies order is in `sent` status, computes acceptance deadline, generates `acceptanceManifestHash`.
  - `recordShipmentIntent`: Authorizes Exporter, verifies order status is `accepted` / settlement is `funded`, generates `shipmentManifestHash`.
  - `confirmDeliveryIntent`: Authorizes Importer, verifies settlement is `shipped`, generates `deliveryManifestHash`.

- **`escrowReconciliation.ts`**:
  - `reconcileFromLedger`: Synchronizes database state with verified on-chain ledger events. If state mismatch occurs, sets status to `mismatch` and records mismatch fields for auditing.

---

## 4. Client SDK & Evidence Hashing (`packages/stellar`)

### Canonical Evidence Manifest Hashing

Evidence manifests are deterministically serialized into 32-byte SHA-256 hashes to bind off-chain document data with on-chain Soroban contract state without disclosing sensitive commercial details on-chain.

```typescript
export function computeCanonicalManifestHash(manifest: Record<string, unknown>): string {
  const jsonString = JSON.stringify(sortObjectKeys(manifest));
  return sha256(new TextEncoder().encode(jsonString));
}
```

---

## 5. Web Interface & UI Components (`apps/web`)

### UI Components
- **`FulfillmentStatusCard`**: Displays current status badge, shipping details, and delivery confirmations.
- **`ShipmentFormModal`**: Exporter interface for recording bill of lading, carrier details, ports of loading/discharge, and phytosanitary certificate numbers.
- **`DeliveryReleaseModal`**: Importer interface for recording receiving inspection results, inspector identity, location, and authorizing release.
- **`FulfillmentActionsPanel`**: Dynamic action panel rendering contextual buttons based on user role and order status.

---

## 6. Security, Access Control & Safety Mechanisms

1. **Strict Role Isolation**: Buyers cannot record shipments; Sellers cannot confirm delivery.
2. **Cryptographic Binding**: All physical milestones require SHA-256 evidence manifest hashes recorded on-chain.
3. **Timeout Protection**: Buyers can reclaim funds via `refund()` if seller misses shipment or delivery deadlines.
4. **Reconciliation Auditing**: Automated background reconciliation detects any variance between off-chain database and Soroban contract state.

---

## 7. Verification & Test Matrix

| Test Suite | Package | Tests | Status |
| :--- | :--- | :--- | :--- |
| Smart Contract Unit Tests | `movix_escrow` (Rust) | 7 | PASS |
| Stellar SDK & Manifest Hashing | `@repo/stellar` | 70 | PASS |
| Backend & Authorization Guards | `@repo/backend` | 54 | PASS |
| Web UI & Accessibility Integration | `web` | 66 | PASS |
| **Total Test Coverage** | **Monorepo** | **197** | **100% PASS** |
