<p align="center">
  <img src="apps/web/public/movix-logo.png" alt="Movix Logo" width="200" />
</p>

<h1 align="center">Movix</h1>

<p align="center">
  <strong>ASEAN Agricultural Trade Escrow on Stellar</strong>
</p>

<p align="center">
  <a href="https://movix-zeta-two.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Demo-movix--zeta--two.vercel.app-7928CA?style=flat-square&logo=vercel&logoColor=white" alt="Live Demo" />
  </a>
  <a href="https://github.com/chrissstellee/Movix/actions/workflows/ci.yml">
    <img src="https://github.com/chrissstellee/Movix/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
</p>

**Movix** is a Soroban-powered agricultural trade escrow platform built on the Stellar blockchain. It enables Importers and Exporters across ASEAN to agree on Trade Orders, lock payment in escrow via smart contracts, record shipment evidence, confirm delivery, and release or refund funds — all with a shared, auditable on-chain trail.

Instead of relying on fragile wire transfers and email confirmations, Movix records the entire trade lifecycle — from funding to payment release — on Stellar's decentralized ledger through two inter-communicating smart contracts.

---

## 📖 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Key Features](#-key-features)
- [Project Structure](#-project-structure)
- [Smart Contracts Reference](#-smart-contracts-reference)
- [Multi-Wallet Support](#-multi-wallet-support)
- [Project Setup Guide](#-project-setup-guide-local-development)
- [Environment Variables](#-environment-variables)
- [Quality Checks](#-quality-checks)
- [Visuals & Demo](#-visuals--demo)
- [Smart Contract Deployment](#-smart-contract-deployment)
- [CI/CD Pipeline](#-cicd-pipeline)

---

## 🏗 Architecture Overview

Movix leverages a modern, decoupled architecture with two inter-communicating smart contracts:

1. **Escrow Contract (Soroban/Rust):** The core settlement engine — handles escrow creation, funding, acceptance, shipment recording, delivery confirmation, payment release, refunds, and cancellation. Deployed and verified on Stellar Testnet.
2. **Trade Registry Contract (Soroban/Rust):** A companion contract that registers trade metadata and performs **inter-contract calls** to the Escrow contract to verify funded escrow state — demonstrating real cross-contract communication on Soroban.
3. **Backend (Convex):** Handles authentication (SEP-10), business onboarding, organization authorization, order management, shipment tracking, trade documents, and escrow reconciliation.
4. **Frontend (Next.js 16):** A responsive web application with multi-wallet support (Freighter, xBull, Lobstr, Hana), transaction signing, and real-time escrow status tracking.

```
┌──────────────────────────────────────┐
│        Next.js 16 Frontend           │  React 19 · TypeScript · pnpm
│  Multi-wallet · Transaction signing  │  Stellar Wallets Kit
└────────────────┬─────────────────────┘
                 │  @stellar/stellar-sdk + Convex React
                 ▼
┌──────────────────────────────────────┐
│         Convex Backend               │  Auth · Orders · Escrow · Shipments
│  SEP-10 · Organization RBAC         │  Trade Documents · Reconciliation
└────────────────┬─────────────────────┘
                 │  Soroban RPC
                 ▼
┌──────────────────────────────────────┐
│      Stellar Soroban Testnet         │
│                                      │
│  ┌──────────────┐  ┌──────────────┐  │
│  │ Escrow v1    │◄─│ Trade        │  │  Inter-contract
│  │ Contract     │  │ Registry     │  │  communication
│  │              │  │ Contract     │  │
│  └──────────────┘  └──────────────┘  │
│                                      │
│  Rust · soroban-sdk 27               │
└──────────────────────────────────────┘
```

### How It Works

1. An **Importer** creates a Trade Order with agricultural commodity details, quantities, pricing, delivery windows, and Incoterms.
2. The **Exporter** reviews and accepts or rejects the order terms off-chain.
3. Once accepted, the Importer **locks funds in escrow** via the Soroban smart contract (`create_and_fund`).
4. The Exporter **activates the escrow** (on-chain `accept`), confirming they agree to fulfill.
5. The Exporter **records shipment evidence** (carrier, B/L number, ports, dates) and signs `mark_shipped` on-chain.
6. The Importer **confirms delivery** with inspection details — this triggers `confirm_delivery` which **releases payment** to the Exporter's wallet.
7. The **Trade Registry** contract can verify escrow state via inter-contract calls to the Escrow contract.

---

## ✨ Key Features

### 1. Full Escrow Lifecycle
- **Funded → Accepted → Shipped → Released**: Complete on-chain settlement from payment lock-in to release.
- **Mutual Refund Flow**: Either party can propose, approve, reject, or withdraw a refund.
- **Timeout Cancellation**: Buyer can cancel unaccepted escrows after the acceptance deadline.
- **7 Escrow States**: Funded, Accepted, Shipped, RefundPending, Released, Refunded, Cancelled.

### 2. Dual Smart Contract Design (Inter-Contract Communication)
- **Escrow Contract**: Handles the full trade settlement lifecycle with deterministic SHA-256 terms, shipment, and delivery hashes.
- **Trade Registry Contract**: Registers agricultural trade metadata and calls into the Escrow contract's `get_escrow` function to verify funded state — real, verifiable inter-contract communication on Stellar.

### 3. Multi-Wallet Support
- **Freighter**, **xBull**, **Lobstr**, and **Hana** wallets supported via Stellar Wallets Kit.
- Auth modal dynamically shows only installed/available wallets.
- Wallet-agnostic transaction signing for all escrow operations.

### 4. Agricultural Trade Specialization
- ASEAN trade route configuration with Incoterms, shipment windows, arrival windows.
- Phytosanitary certificate tracking, Bill of Lading / Air Waybill recording.
- Delivery inspection with acceptance criteria and inspector records.
- On-chain evidence hashing for shipment and delivery confirmation.

### 5. Enterprise-Grade Security
- SEP-10 challenge-response wallet authentication.
- Role-based organization access (Owner, Admin, Operations, Finance).
- Organization verification before trade document uploads.
- Deterministic terms hash for immutable agreement verification.

---

## 🗂 Project Structure

```text
Movix/
├── apps/
│   └── web/                        # Next.js 16 frontend application
│       ├── app/                    # App router pages and layouts
│       │   ├── buyer/              # Importer dashboard routes
│       │   ├── exporter/           # Exporter dashboard routes
│       │   ├── orders/             # Trade order management
│       │   ├── trade-orders/       # Agricultural trade views
│       │   ├── login/              # Wallet auth + SEP-10
│       │   ├── onboarding/         # Business registration
│       │   └── settings/           # Organization settings
│       ├── features/               # Feature modules
│       │   ├── auth/               # Login panel + multi-wallet
│       │   ├── orders/             # Order CRUD + escrow panels
│       │   ├── transactions/       # Transaction review modal
│       │   └── foundation/         # Design system showcase
│       ├── core/                   # Auth context, components
│       └── public/                 # Static assets (logo, icons)
├── packages/
│   ├── backend/convex/             # Convex serverless backend
│   │   ├── schema.ts              # Database schema
│   │   ├── escrowFunding.ts       # Escrow funding mutations
│   │   ├── escrowFulfillment.ts   # Accept/ship/release mutations
│   │   ├── escrowReconciliation.ts # On-chain state reconciliation
│   │   ├── shipments.ts           # Shipment tracking
│   │   └── tradeDocuments.ts      # Document management
│   ├── stellar/                    # Stellar integration package
│   │   ├── src/
│   │   │   ├── multi-wallet-adapter.ts  # Multi-wallet (Freighter/xBull/Lobstr/Hana)
│   │   │   ├── soroban-submit.ts        # Contract transaction submission
│   │   │   ├── escrow-funding.ts        # Escrow key derivation + encoding
│   │   │   ├── fulfillment.ts           # Accept/ship/deliver encoding
│   │   │   ├── contracts.ts             # Generated client adapter
│   │   │   └── hashes.ts               # Deterministic evidence hashing
│   │   └── generated/escrow/           # Auto-generated escrow ABI bindings
│   ├── ui/                         # Shared accessible UI primitives
│   └── domain/                     # Shared domain types
├── contracts/                      # Soroban smart contracts (Rust workspace)
│   ├── escrow/                     # Escrow settlement contract (v1)
│   │   └── src/lib.rs             # 960 lines: full lifecycle + invariants
│   └── trade-registry/            # Trade Registry companion contract
│       └── src/lib.rs             # Inter-contract communication with escrow
├── e2e/                            # Playwright end-to-end tests
├── docs/                           # Architecture, ADRs, sprint plans
└── .github/workflows/ci.yml       # CI/CD pipeline (4 jobs)
```

---

## 📜 Smart Contracts Reference

### Escrow Contract (`movix-escrow`)

The core settlement engine. 960 lines of Rust handling the complete escrow lifecycle with 7 states, 19 error codes, and 8 event types.

#### Escrow Data Structure

| Field | Type | Description |
|---|---|---|
| `id` | `BytesN<32>` | Deterministic escrow key derived from contract + order + revision |
| `buyer` | `Address` | Importer wallet |
| `supplier` | `Address` | Exporter wallet |
| `token` | `Address` | SAC token contract (XLM or USDC) |
| `gross_amount` | `i128` | Locked amount in base units |
| `fee_bps` | `u32` | Platform fee in basis points |
| `fee_amount` | `i128` | Calculated fee amount |
| `status` | `Status` | Current lifecycle state |
| `terms_hash` | `BytesN<32>` | SHA-256 of agreed trade terms |
| `shipment_hash` | `Option<BytesN<32>>` | SHA-256 of shipment evidence |
| `delivery_hash` | `Option<BytesN<32>>` | SHA-256 of delivery confirmation |

#### Write Functions

| Function | Auth Required | Description |
|---|---|---|
| `create_and_fund(id, buyer, supplier, token, amount, fee_bps, accept_by, terms_hash)` | `buyer` | Creates escrow and locks funds. Status → Funded |
| `accept(id, supplier, terms_hash)` | `supplier` | Activates escrow. Funded → Accepted |
| `mark_shipped(id, supplier, shipment_hash)` | `supplier` | Records shipment evidence. Accepted → Shipped |
| `confirm_delivery(id, buyer, delivery_hash)` | `buyer` | Confirms delivery, releases payment. Shipped → Released |
| `propose_refund(id, proposer, refund_terms_hash)` | buyer/supplier | Proposes mutual refund. → RefundPending |
| `approve_refund(id, approver, refund_terms_hash)` | counterparty | Approves refund, returns funds. → Refunded |
| `reject_refund(id, approver, refund_terms_hash)` | counterparty | Rejects refund, restores previous status |
| `cancel_unaccepted(id, buyer)` | `buyer` | Cancels after deadline. → Cancelled |

#### Contract Errors

| Code | Name | Description |
|---|---|---|
| 1 | `InvalidConfig` | Contract misconfigured |
| 2 | `UnsupportedAsset` | Token not in approved SAC list |
| 3 | `InvalidAmount` | Amount ≤ 0 |
| 4 | `SameParty` | Buyer and supplier are the same address |
| 5 | `EscrowExists` | Duplicate escrow ID |
| 6 | `EscrowNotFound` | Escrow not found |
| 7 | `InvalidTransition` | Invalid state transition |
| 13 | `TermsMismatch` | Terms hash doesn't match on-chain |
| 14 | `UnauthorizedParty` | Caller not authorized |
| 19 | `InvalidHash` | Hash argument is invalid |

---

### Trade Registry Contract (`movix-trade-registry`)

A companion contract demonstrating **inter-contract communication** with the Escrow contract.

#### Trade Record Data Structure

| Field | Type | Description |
|---|---|---|
| `trade_id` | `BytesN<32>` | Trade identifier (matches escrow ID) |
| `buyer` | `Address` | Importer wallet |
| `supplier` | `Address` | Exporter wallet |
| `commodity` | `String` | Agricultural commodity (e.g., "Rice", "Coconut Oil") |
| `origin_country` | `String` | Origin country |
| `destination_country` | `String` | Destination country |
| `escrow_contract` | `Address` | Linked escrow contract address |
| `escrow_verified` | `bool` | Whether escrow was verified via inter-contract call |

#### Functions

| Function | Description |
|---|---|
| `register_trade(trade_id, buyer, supplier, commodity, origin, destination)` | Registers a trade with ASEAN agricultural metadata |
| `get_trade(trade_id)` | Retrieves a registered trade |
| `get_trade_count()` | Total number of registered trades |
| `verify_escrow_funded(trade_id)` | **Inter-contract call** → calls Escrow contract's `get_escrow(id)` to verify funded state |
| `get_escrow_contract()` | Returns the linked escrow contract address |
| `get_version()` | Contract version |

#### Inter-Contract Communication

The `verify_escrow_funded` function demonstrates real cross-contract invocation on Soroban:

```rust
// Inter-contract call: invoke escrow contract's get_escrow(id)
let escrow_exists = env
    .try_invoke_contract::<Val, Val>(
        &escrow_addr,
        &Symbol::new(&env, "get_escrow"),
        (trade_id.clone(),).try_into().unwrap(),
    )
    .is_ok();
```

This call is verifiable on [Stellar Expert](https://stellar.expert/explorer/testnet) — the transaction shows the cross-contract invocation from the Trade Registry to the Escrow contract.

---

## 🔗 Multi-Wallet Support

Movix uses [Stellar Wallets Kit](https://github.com/AntoineCRBR/stellar-wallets-kit) to support multiple Stellar wallets:

| Wallet | Status |
|---|---|
| **Freighter** | ✅ Supported |
| **xBull** | ✅ Supported |
| **Lobstr** | ✅ Supported |
| **Hana** | ✅ Supported |

The wallet selection modal automatically detects which wallets are installed and hides unsupported ones. All escrow operations (fund, activate, ship, confirm delivery, refund) work with any connected wallet.

---

## 🚀 Project Setup Guide (Local Development)

### Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 20.9+ | [nodejs.org](https://nodejs.org) |
| pnpm | 10.1.0 | `npm install -g pnpm` |
| Rust (stable) | 1.75+ | [rustup.rs](https://rustup.rs) |
| Stellar CLI | 27+ | [stellar.org/tools/cli](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli) |
| Stellar Wallet | latest | [Freighter](https://freighter.app), [xBull](https://xbull.app), [Lobstr](https://lobstr.co), or [Hana](https://hanawallet.io) |

### Step 1 — Clone and install

```bash
git clone https://github.com/chrissstellee/Movix.git
cd Movix
pnpm install --frozen-lockfile
```

### Step 2 — Configure authentication

```bash
pnpm auth:setup:local
pnpm auth:setup:convex
```

### Step 3 — Start the backend

```bash
pnpm --filter @repo/backend dev
```

### Step 4 — Start the frontend

```bash
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 5 — Build and test smart contracts

```bash
cd contracts
cargo test --workspace --lib
cd ..
```

---

## ⚙ Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex deployment URL |
| `SEP10_SIGNING_KEY` | Yes (server) | SEP-10 challenge signing key |
| `AUTH_JWT_SECRET` | Yes (server) | JWT signing secret |
| `MOVIX_ESCROW_CONTRACT_ID` | Yes | Deployed escrow contract address |
| `MOVIX_TRADE_REGISTRY_CONTRACT_ID` | Yes | Deployed trade registry contract address |
| `MOVIX_ENABLE_FOUNDATION_SAMPLE` | No | Enable foundation design showcase |

---

## ✅ Quality Checks

```bash
# Format check
pnpm format:check

# Lint
pnpm lint

# Type checking
pnpm typecheck

# Unit tests (3+ passing tests)
pnpm test

# Accessibility tests
pnpm test:a11y

# End-to-end tests
pnpm test:e2e

# Production build
pnpm build

# Contract tests
cargo test --manifest-path contracts/Cargo.toml --workspace --lib

# Contract build
pnpm build:contracts
```

---

## 🎨 Visuals & Demo

**Live Demo**: [https://movix-zeta-two.vercel.app/](https://movix-zeta-two.vercel.app/)

**Demo Video**: <!-- ADD YOUR DEMO VIDEO LINK HERE -->

### Platform Screenshots

| Feature | Screenshot |
|---|---|
| Multi-Wallet Connection | ![Wallet Options](apps/web/public/screenshots/wallet-options.png) |
| Wallet Connected | ![Wallet Connected](apps/web/public/screenshots/wallet-connected.png) |
| Escrow Funding | ![Escrow Funding](apps/web/public/screenshots/escrow-funding.png) |
| Escrow Release | ![Escrow Release](apps/web/public/screenshots/escrow-release.png) |
| Transaction Result | ![Transaction Result](apps/web/public/screenshots/transaction-result.png) |
| Mobile Responsive | ![Mobile View](apps/web/public/screenshots/mobile-responsive.png) |

### Transaction Feedback

![Successful Transaction](apps/web/public/screenshots/successful-transaction.png)

### Test Output

![Test Output](apps/web/public/screenshots/test-output.png)

---

## 📡 Smart Contract Deployment

All contracts are deployed on **Stellar Testnet** only. Testnet assets have no production monetary value.

| Detail | Value |
|---|---|
| **Escrow Contract Address** | `CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5` |
| **Trade Registry Contract Address** | <!-- ADD AFTER DEPLOYMENT --> |
| **Native XLM SAC** | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| **USDC SAC** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| **Network** | Stellar Testnet |
| **Escrow Contract Explorer** | [View Contract](https://stellar.expert/explorer/testnet/contract/CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5) |
| **Escrow Deployment Tx** | [Ledger 3,841,429](https://stellar.expert/explorer/testnet/tx/bc0752d467e9154c3e35fd2b1ea68d0f5fd8b8afba63a011f11ce271230a13f5) |
| **WASM SHA-256** | `a6c938a6148a7fd0cc768eee25088ef66822243c05e71516e1400d9bc18bd498` |
| **Inter-Contract Tx Hash** | <!-- ADD AFTER verify_escrow_funded CALL --> |

![Contract on Stellar Expert](apps/web/public/screenshots/contract-explorer.png)

---

## 🔄 CI/CD Pipeline

The project uses GitHub Actions with 4 parallel jobs:

| Job | Description |
|---|---|
| **Node quality** | Format, lint, typecheck, unit tests, accessibility tests, production build |
| **Contract quality** | Rust fmt, clippy, unit tests, WASM build, ABI drift check, testnet smoke tests |
| **Contract fuzz** | Deterministic fuzz testing with 10,000 runs and fixed seed |
| **Browser smoke** | Playwright end-to-end tests with Chromium |

![CI/CD Pipeline](apps/web/public/screenshots/ci-cd-pipeline.png)

---

## 📄 License

This project is for educational and competition purposes on Stellar Testnet.
