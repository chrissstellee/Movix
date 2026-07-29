# Sprint 5 Evidence Manifest

Created on implementation Day 1. Entries are append-only references to immutable artifacts; status may advance, but an existing artifact must not be replaced under the same ID.

| Evidence ID | Scope | Expected artifact | Owner | Status |
|---|---|---|---|---|
| S5-EV-DOMAIN-01 | Lifecycle and funding eligibility | Domain test log + commit | Elliot | Local green |
| S5-EV-DOMAIN-02 | Rejection taxonomy/normalization | Domain test log + commit | Elliot | Local green |
| S5-EV-BE-01 | Queue/count transitions | Backend test log + commit | Elliot | Local green |
| S5-EV-BE-02 | Projection allowlist/denylist | Backend test log + serialized fixture | Elliot / Security | Local green; review pending |
| S5-EV-BE-03 | Atomic acceptance/replay | Backend test log + side-effect snapshot | Elliot | Local green |
| S5-EV-BE-04 | Rejection/redaction | Backend test log + canary scan | Elliot / Security | Local green; review pending |
| S5-EV-BE-05 | Buyer notification/deep link | Backend test log | Elliot | Local green |
| S5-EV-BE-06 | Deadline/guard/race matrix | Backend test log | QA | Partial |
| S5-EV-BE-07 | Revision N+1/re-acceptance | Backend test log | Elliot / QA | Partial |
| S5-EV-BE-08 | Canonical history/parity | Backend test log | Elliot / QA | Partial |
| S5-EV-WEB-01 | Supplier dashboard/list | Component test + screenshots | Bri / QA | Component green |
| S5-EV-A11Y-01 | Review/dialog accessibility | Axe log + keyboard/screen-reader evidence | QA | Axe local green; manual pending |
| S5-EV-A11Y-02 | Timeline/mobile accessibility | Axe log + 320 px evidence | QA | Partial |
| S5-EV-E2E-01 | Dashboard/queue | Authenticated Playwright trace | QA | Blocked: QA fixtures |
| S5-EV-E2E-02 | USDC/XLM review + mobile | Authenticated trace/screenshots | QA | Blocked: QA fixtures |
| S5-EV-E2E-03 | Acceptance/funding eligibility | Authenticated trace | QA | Blocked: QA fixtures |
| S5-EV-E2E-04 | Rejection/reason | Authenticated trace | QA | Blocked: QA fixtures |
| S5-EV-E2E-05 | Notification/isolation | Authenticated trace | QA / Security | Blocked: QA fixtures |
| S5-EV-E2E-06 | Expired/stale/foreign | Authenticated trace | QA / Security | Blocked: QA fixtures |
| S5-EV-E2E-07 | Revision recovery | Authenticated trace | QA | Blocked: QA fixtures |
| S5-EV-E2E-08 | Canonical multi-revision history | Authenticated trace | QA | Blocked: QA fixtures |
| S5-EV-MIG-01 | Deployment inventory | Paginated immutable export | DevOps | Blocked: target deployment |
| S5-EV-MIG-02 | Migration dry-run/backfill | Migration logs | DevOps | Blocked: target deployment |
| S5-EV-MIG-03 | Count reconciliation | Per-supplier reconciliation export | DevOps | Blocked: target deployment |
| S5-EV-REL-01 | Full release gates | Signed gate summary | Release | Pending |

Sprint 4’s authenticated Playwright, responsive, security, and release evidence remains incomplete and is not inherited as green.
