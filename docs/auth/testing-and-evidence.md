# Sprint 1 Testing and Evidence

## Evidence rules

Every result records command/scenario, date, commit, environment, status, owner, and artifact link. Use only safe fixtures. Evidence must not contain keys, secrets, credentials, JWTs, cookies, full live wallet addresses, or raw/signed authentication transactions.

Statuses are `Pending`, `Pass`, `Fail`, or `Blocked`. Do not mark a scenario `Pass` from implementation presence alone.

## Pre-Sprint baseline

Observed before Sprint 1 documentation implementation:

| Check                                | Baseline                    | Notes                                                                                                                |
| ------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`                  | Pass                        | Completed successfully                                                                                               |
| `pnpm lint`                          | Pass with inherited warning | Existing `packages/ui/src/components/ui/input-group.tsx` non-interactive interaction warning                         |
| `pnpm typecheck`                     | Fail                        | Existing template `packages/backend/convex/tasks.ts` references a `tasks` table/index absent from the current schema |
| `pnpm test`                          | Partial observation         | Backend schema, Stellar, and domain tests passed while observed; capture a complete fresh run before closure         |
| Accessibility, E2E, build, contracts | Pending                     | Must be captured from the completed Sprint 1 branch                                                                  |

The working tree also contained user-owned modifications to three Convex-generated declaration files before this documentation work:

- `packages/backend/convex/_generated/api.d.ts`
- `packages/backend/convex/_generated/dataModel.d.ts`
- `packages/backend/convex/_generated/server.d.ts`

Do not format, regenerate, revert, or claim those diffs as Sprint 1 work without explicit approval. Record `git status --short` before evidence runs and distinguish inherited files from implementation-owned changes.

## Requirement traceability

| Work item             | Required proof                                                                         | Status                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| S1-01 landing         | Content contract, centered text-only hero, mobile/desktop screenshots, CTA/FAQ tests   | Centered one-column hero covered by web tests; screenshots and CI artifact link pending                |
| S1-02 accessibility   | Keyboard, landmarks, focus, live regions, contrast, reduced motion, zoom               | Automated pass; manual screen-reader/zoom review pending                                               |
| S1-03 wallet adapter  | Availability, connect/reject, network/address validation, sign/disconnect/change mocks | Unit pass; real Freighter smoke pending                                                                |
| S1-04 challenge       | Shape, domains, time bounds, nonce/hash, supersession, rate limit, no-store            | Automated pass, including exact operation order, strict bounds, coarse/fine limits, and route controls |
| S1-05 login UX        | Canonical state components, no-funds copy, duplicate-submit/stale-callback tests       | Automated pass                                                                                         |
| S1-06 verification    | Complete SEP-10 negative matrix and atomic replay/concurrency result                   | Automated pass with real signed fixtures, structural/signature negatives, and atomic double-submit     |
| S1-07 JWT/Convex      | Claim/header tests, JWKS, negative token tests, protected identity smoke               | Local unit/integration pass; deployed issuer/JWKS smoke pending                                        |
| S1-08 session/handoff | Rotation, reuse detection, expiry/revocation, logout, protected routing                | Automated server/route pass; real-browser cross-tab and deployed identity journeys pending             |
| S1-09 recovery        | Every stable error category with one safe recovery action                              | Partial                                                                                                |
| S1-10 observability   | Required event names and forbidden-field log review                                    | Partial/P1                                                                                             |

## SEP-10 matrix

- [x] Valid challenge shape and server signature
- [x] Valid single-signature client response
- [x] Malformed input and oversized request
- [x] Wrong sequence, source/client account, or network passphrase
- [x] Wrong home domain or web-auth domain
- [x] Expired or not-yet-valid bounds
- [x] Missing, extra, altered, or reordered operation
- [x] Missing/invalid server signature
- [x] Missing/wrong/insufficient client signature
- [x] Unknown, mismatched, superseded, or already-used challenge hash
- [x] Two concurrent submissions produce at most one session

## JWT and session matrix

- [x] Required header and claims
- [x] Correct and incorrect issuer/audience
- [x] Wrong algorithm, unknown `kid`, invalid signature
- [x] Expired token
- [ ] Future-issued token beyond tolerance
- [x] JWKS contains public values only
- [x] Key-rotation fixture
- [x] Valid, expired, revoked, and reused refresh credentials
- [x] Immediate duplicate refresh receives a retryable conflict; delayed reuse revokes the family
- [ ] Cross-tab concurrent refresh is deduplicated in a real browser
- [x] Repeated logout is safe
- [x] Auth-store logout failure retains the cookie and reports failure
- [x] Cookie clears on logout and terminal refresh failure
- [x] Convex identity maps to the stable active user
- [x] Unauthenticated protected query/route exposes no protected result

## Wallet and component matrix

- [x] Freighter available/unavailable
- [x] Connection success/rejection
- [x] Valid/invalid account and Testnet/wrong network
- [x] Signature success/rejection and disconnect
- [x] Address/network change and late callback
- [x] Repeated connect/sign action
- [x] Every canonical orchestration state renders correctly
- [x] Full address is accessible while normal display is truncated
- [ ] Working/loading/disabled controls and accessible announcements
- [x] Focus returns to the safe recovery control
- [x] Redirect waits for Convex confirmation
- [x] Landing navigation, CTA, FAQ, and mobile menu behavior
- [x] Landing hero uses one centered text column with no illustrative side asset

The latest full regression passed 155 tests: domain 20, Stellar 54, backend 29, and
web 52. Backend/web typechecks, production build, and lint passed. The format gate
is pending because an active Convex code-generation process rewrites three generated
declaration files during the check. Manual responsive, contrast, zoom, screen-reader, and screenshot
verification also remains pending.

## Required Playwright journeys

1. Landing to successful login to protected handoff.
2. Connection rejected, then successful retry.
3. Signature rejected, then fresh-challenge retry.
4. Wrong network, switch to Testnet, then success.
5. Expired challenge, then success.
6. Logout blocks protected access.
7. Returning session refresh.
8. Logout and reconnect.
9. Replayed signed response is rejected.
10. Address/network change invalidates an in-flight attempt.

CI uses deterministic wallet and server fixtures. A controlled manual Freighter smoke against the intended Testnet deployment remains **Pending** until performed.

## Accessibility and responsive evidence

- [ ] 320px, tablet, and desktop layouts
- [ ] Keyboard-only journey
- [ ] Screen-reader smoke
- [ ] Heading and landmark order
- [ ] Accessible dialog/menu names
- [ ] Status/error live regions
- [ ] Visible focus and sufficient contrast
- [ ] Reduced motion
- [ ] Zoom/text resize
- [ ] No horizontal scrolling in the critical path

## Closure command record

| Command                | Date       | Commit               | Environment               | Result                      | Artifact/notes                                                    |
| ---------------------- | ---------- | -------------------- | ------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `pnpm format:check`    | 2026-07-27 | Uncommitted worktree | Windows local             | Pass                        | All workspace packages                                            |
| `pnpm lint`            | 2026-07-27 | Uncommitted worktree | Windows local             | Pass with inherited warning | Existing `input-group.tsx` warning only                           |
| `pnpm typecheck`       | 2026-07-27 | Uncommitted worktree | Windows local             | Pass                        | Stale task API removed                                            |
| `pnpm test`            | 2026-07-27 | Uncommitted worktree | Windows local             | Pass                        | 69 tests across domain, Stellar, backend, and web                 |
| `pnpm test:a11y`       | 2026-07-27 | Uncommitted worktree | Chromium/jsdom local      | Pass                        | Foundation suite; landing axe coverage also passes in `pnpm test` |
| `pnpm test:e2e`        | 2026-07-27 | Uncommitted worktree | Playwright Chromium local | Pass                        | 4 journeys; local HTML report is uncommitted                      |
| `pnpm build`           | 2026-07-27 | Uncommitted worktree | Windows local             | Pass                        | Next.js route manifest includes all Sprint 1 public routes        |
| `pnpm test:contracts`  | 2026-07-27 | Uncommitted worktree | Windows local             | Pass                        | 2 library tests                                                   |
| `pnpm build:contracts` | 2026-07-27 | Uncommitted worktree | `wasm32v1-none` release   | Pass                        | Optimized contract build                                          |

## Required review artifacts

Track safe artifacts through [the Sprint 1 manifest](../evidence/sprint-01/README.md):

- landing at 320px and desktop;
- login disconnected, connected, signing, categorized error, and success;
- SEP-10 negative-suite output;
- replay/concurrency output;
- redacted fixture-only JWT header/claim inspection;
- fixture/test JWKS with public material only;
- authenticated and unauthenticated Convex smoke;
- deployed HTTPS cookie attributes;
- Playwright and accessibility reports;
- manual Freighter/Testnet smoke result;
- redacted environment checklist;
- known limitations and moved P1 items.

## Closure decision

- **Complete:** every P0 criterion passes and Sprint 2 can trust the identity boundary.
- **Conditional close:** only named, owned P1 analytics, extra-wallet, or cosmetic items remain.
- **Not complete:** any SEP-10, replay, JWT verification, Convex identity, refresh/logout revocation, secret storage, critical recovery/accessibility, or real Freighter/Testnet requirement remains incomplete.

Current decision: **Not complete**. Local implementation and automated gates pass, but the fixed
closure rules still require the remaining browser-level session journeys, regenerated
Convex declarations after deployment auth variables are supplied, and a real deployed
Freighter/Testnet/Convex identity smoke with Secure-cookie and privacy-safe log evidence.
