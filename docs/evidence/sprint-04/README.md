# Sprint 4 evidence manifest

This directory is the immutable, redacted evidence index for buyer procurement. Product scope and acceptance wording remain in the [Sprint 4 detailed specification](../../Movix-Sprint-04-Buyer-Procurement-Detailed.md). Test mapping is in [testing and evidence](../../buyer-procurement/testing-and-evidence.md).

## Manifest

| Evidence                                      | Story/AC                  | Status                             | Owner         | Artifact                                                 |
| --------------------------------------------- | ------------------------- | ---------------------------------- | ------------- | -------------------------------------------------------- |
| Development skeleton inventory                | Schema readiness          | Verified: four target tables empty | Elliot        | Command observation; permanent sanitized capture pending |
| Domain arithmetic/canonical tests             | S4-06, S4-09              | Green: 20 domain tests             | Elliot        | Test report capture pending                              |
| Convex integration suite                      | S4-03–S4-10               | Green: 26 tests                    | Elliot        | Test report capture pending                              |
| Convex code generation/schema validation      | Schema readiness          | Green                              | Elliot        | Command capture pending                                  |
| Web typecheck                                 | S4-01, S4-02, S4-07–S4-11 | Green                              | Elliot        | Command capture pending                                  |
| Sprint 4 axe surfaces                         | S4-01, S4-02              | Green                              | QA            | Suite report pending                                     |
| Authenticated fourteen-journey Playwright run | S4-01–S4-10               | Pending dedicated fixture          | QA            | Not yet available                                        |
| Responsive screenshots                        | S4-01–S4-10               | Pending                            | QA            | Not yet available                                        |
| Contract/Stellar regression                   | Exit gate                 | Green: 20 contract, 54 Stellar     | Elliot / QA   | Report capture pending                                   |
| Security/redaction review                     | Exit gate                 | Pending                            | Security / QA | Not yet available                                        |
| Release decision                              | Sprint 4 exit             | Pending                            | Product / QA  | Not yet available                                        |

## Artifact naming

Use `YYYYMMDD-HHMM-<story-or-gate>-<short-description>.<ext>`. Every artifact must include or accompany:

- commit SHA and Convex deployment label;
- command/journey and relevant story/AC IDs;
- UTC timestamp and operator;
- pass/fail outcome and known limitations;
- redaction reviewer.

Do not add mutable “latest” files, live PII, complete wallets, secrets, raw auth data, canonical commercial payloads, or unredacted traces. Failed evidence is retained with a superseding manifest entry; it is not overwritten.

## Sign-offs

- Engineering: local quality gates green; cloud codegen revalidation requires explicit deployment approval.
- QA: pending authenticated browser deployment.
- Security/redaction: pending evidence set.
- Product/release: pending all P0 gates.
