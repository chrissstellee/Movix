# Buyer procurement API contract

Status: implemented for Sprint 4  
Scope authority: [Sprint 4 detailed specification](../Movix-Sprint-04-Buyer-Procurement-Detailed.md)

All functions have explicit Convex argument and return validators. Buyer organization IDs are absent from public buyer commands and are derived from the authenticated sole active organization. All collections and strings are bounded. Unknown and unauthorized order IDs both fail as `ORDER_NOT_FOUND`.

## Public functions

| Function                         | Input                                                            | Result                                                                                                                                               | Authorization and behavior                                                                                             |
| -------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `supplierDirectory.resolveExact` | Wallet target or relationship target                             | Resolved supplier projection                                                                                                                         | Active verified Testnet buyer; exact match only; rejects ambiguity, self-dealing, paused/inactive/ineligible suppliers |
| `orderDashboard.getBuyerSummary` | None                                                             | Exact draft/sent counts, latest five, create eligibility                                                                                             | Active buyer context                                                                                                   |
| `orders.listBuyerOrders`         | Native pagination plus optional status, asset, issue-date bounds | Organization-scoped page                                                                                                                             | Active buyer context; validated filters; composite indexes                                                             |
| `orderDrafts.create`             | `idempotencyKey`                                                 | Order/revision IDs, version, replay flag                                                                                                             | `order:draft`; identical replay succeeds                                                                               |
| `orderDrafts.get`                | `orderId`                                                        | Mutable draft projection                                                                                                                             | Buyer owner organization only                                                                                          |
| `orderDrafts.saveSupplier`       | Order, expected revision, exact target                           | New revision version and totals                                                                                                                      | Owner/admin/procurement; mutable draft                                                                                 |
| `orderDrafts.saveHeader`         | Order, expected revision, snapshots/date/asset inputs            | New revision version and totals                                                                                                                      | Same; PO uniqueness enforced transactionally                                                                           |
| `orderDrafts.upsertLine`         | Order, expected revision, canonical line input                   | New revision version and totals                                                                                                                      | Same; checked exact recomputation                                                                                      |
| `orderDrafts.reorderLines`       | Order, expected revision, complete ordered line-ID list          | New revision version and totals                                                                                                                      | Same; IDs must be children of the revision                                                                             |
| `orderDrafts.removeLine`         | Order, expected revision, line ID                                | New revision version and totals                                                                                                                      | Same; foreign child IDs denied                                                                                         |
| `orderDrafts.saveTerms`          | Order, expected revision, bounded terms                          | New revision version and totals                                                                                                                      | Same; exact shipping recomputation                                                                                     |
| `orderDrafts.getReview`          | `orderId`                                                        | Buyer/supplier names, contact/address snapshots, header/terms fields collected by the five-step flow, lines, totals, blockers, optional hash preview | Buyer owner organization only; browser renders this projection rather than reconstructing review state                 |
| `orders.send`                    | Order, expected revision, idempotency key                        | Frozen revision/order versions and replay flag                                                                                                       | `order:send`; atomic freeze/status/count/receipt/notification/audit                                                    |
| `orders.getById`                 | `orderId`                                                        | Authorized snapshot, lines, three state dimensions                                                                                                   | Buyer owner organization only                                                                                          |
| `orders.cancel`                  | Order, expected order version, key, bounded reason               | Result versions and replay flag                                                                                                                      | Draft/sent and unfunded only; receipt/count/audit are atomic                                                           |

Supplier users do not receive buyer draft APIs. Sprint 4 stores `recipientOrganizationId` on sent notifications; `recipientUserId` is optional for later delivery preferences.

The review projection may contain buyer-only internal notes because it is available
only to the buyer owner organization. Those notes are explicitly distinguished from
supplier-visible terms and remain excluded from `order-terms-v1`. Future supplier
review must use its own authorized projection.

## Concurrency and idempotency

Every mutable draft command requires `expectedVersion`. A valid mutation increments revision version exactly once. A stale or invalid command produces no writes. Create, send, and cancel accept keys of 8–120 characters and persist a request fingerprint. Reusing a key with a different fingerprint returns `IDEMPOTENCY_CONFLICT`.

Send compares the expected revision version. Cancel compares the expected order version. The web client maintains these as distinct concepts.

## Stable errors

| Code                                 | Meaning / recovery                                               |
| ------------------------------------ | ---------------------------------------------------------------- |
| `ORDER_NOT_FOUND`                    | Safe denial for unknown or foreign order/child                   |
| `ORDER_INVALID`                      | Field or completeness failure; use field projection when present |
| `ORDER_STALE`                        | Stop autosave and reload the latest projection                   |
| `ORDER_IMMUTABLE`                    | Frozen or non-draft revision cannot be edited                    |
| `ORDER_ALREADY_SENT`                 | Send is no longer eligible                                       |
| `ORDER_CANNOT_CANCEL`                | Agreement/settlement state disallows cancellation                |
| `PO_NUMBER_DUPLICATE`                | Case-insensitive PO key already belongs to buyer                 |
| `SUPPLIER_NOT_FOUND`                 | Exact target did not resolve                                     |
| `SUPPLIER_AMBIGUOUS`                 | Exact target mapped to more than one eligible organization       |
| `SUPPLIER_SELF_DEALING`              | Supplier is the buyer organization                               |
| `SUPPLIER_INELIGIBLE`                | Network, status, relationship, or capability failed              |
| `IDEMPOTENCY_CONFLICT`               | Key reused for a different request                               |
| `ASSET_UNSUPPORTED`                  | Asset key is not allowlisted server-side                         |
| `AMOUNT_INVALID` / `AMOUNT_OVERFLOW` | Invalid integer input or Convex int64 overflow                   |
| Existing auth/profile codes          | Login, wallet, membership, role, or readiness failure            |

Errors expose no foreign record metadata. Logs and UI should report codes and field names, not raw commercial payloads.
