# Escrow v1 Soroban Smart Contract Funding Integration Guide

This guide details the smart contract interface, ABI parameter derivation rules, and error handling for `create_and_fund` on Stellar Testnet.

## 1. Verified Deployment Manifest Identity

- **Network**: `testnet`
- **Network Passphrase**: `Test SDF Network ; September 2015`
- **Contract Address**: `CCEECHOGV6MXZANAOLJNDMA2GPEBDETPNWUR4XDEW32KHJUYN3V5ZAP5`
- **WASM SHA-256 Digest**: `a6c938a6148a7fd0cc768eee25088ef66822243c05e71516e1400d9bc18bd498`
- **Bindings SHA-256 Digest**: `066d15c46562c1ca29630ae59615eb3ac6f29cd058bf7b95852ef09b43930cf8`
- **Constructor Configuration**: `maxFeeBps: 0`, `pilotFeeBps: 0`

## 2. Smart Contract Function: `create_and_fund`

```rust
pub fn create_and_fund(
    env: Env,
    id: BytesN<32>,
    buyer: Address,
    supplier: Address,
    token: Address,
    amount: i128,
    fee_bps: u32,
    accept_by: u64,
    terms_hash: BytesN<32>,
) -> Result<(), Error>;
```

### Parameter Derivation Rules

| Parameter | Type | Derivation Rule |
|---|---|---|
| `id` | `BytesN<32>` | SHA-256 digest of NUL-delimited UTF-8 string: `movix:escrow:v1\0testnet\0{verifiedContractId}\0{orderId}\0{acceptedRevisionId}` |
| `buyer` | `Address` | Importer Stellar G-address snapshotted in accepted Trade Order revision. Must authorize `create_and_fund` & nested SAC transfer. |
| `supplier` | `Address` | Exporter Stellar G-address snapshotted in accepted Trade Order revision. |
| `token` | `Address` | Soroban SAC contract address (XLM or USDC allowlisted Testnet SAC). |
| `amount` | `i128` | Exact positive integer `grandTotalBaseUnits` from accepted Trade Order revision. |
| `fee_bps` | `u32` | Fixed `0` bps for pilot policy. |
| `accept_by` | `u64` | `fundingDeadline` converted from ms to whole Unix seconds (`Math.floor(ms / 1000)`). |
| `terms_hash` | `BytesN<32>` | 64-character hex `order-terms-v2` digest converted to 32 bytes. |

## 3. Error Code Mapping Table

| Error Code | Category | Description & Safe User Action |
|---|---|---|
| `EscrowAlreadyExists` (1) | `escrow_exists` | Escrow already funded for this ID key. Verify on-chain state. |
| `InvalidAmount` (2) | `invalid_amount` | Amount must be positive. Recheck revision totals. |
| `InvalidDeadline` (3) | `deadline_expired` | `accept_by` must be in the future. Issue a new revision. |
| `InvalidFee` (4) | `configuration_invalid` | Fee bps exceeds maximum constructor fee. |
| `SamePartyWallets` (5) | `same_party` | Buyer and supplier addresses must be distinct G-addresses. |
| `InsufficientBalance` (6) | `insufficient_balance` | Importer wallet balance insufficient for gross trade amount. |
| `TrustlineDeauthorized` (7) | `missing_trustline` | Importer USDC SAC trustline is missing or deauthorized. |
