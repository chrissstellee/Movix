# Business Onboarding Data and Validation

## Canonical records

- `businessOnboardingDrafts`: one bounded draft per user, indexed by user and user/status; explicit step payloads, reuse flags, status, completion metadata, timestamps, and `int64` version.
- `organizations`: normalized identity and commercial fields, capability, verification/status, attestation actor/time/version, optional keyed registration fingerprint, timestamps, and version.
- `memberships`: organization, user, owner role, active status, accepted/created timestamps, and user/status index.
- `contacts`: canonical type, primary marker, name, email, optional phone/job title/department, timestamps, and version.
- `addresses`: registered/billing/shipping type, recipient, label, lines, locality, country, optional delivery instructions, default marker, timestamps, and version.
- `auditEvents`: actor, organization, action, entity identity, optional request ID, and bounded changed field names only.

## Field classification

Browser-editable values are allowlisted in step-specific and section-specific validators. Server-derived values include normalized names, status, verification state, membership ownership, audit identity, timestamps, versions, fingerprint, completion metadata, and attestation actor/time.

Registration and tax identifiers, contact data, and addresses are sensitive business data. They may be persisted for the workflow but must not appear in errors, audit diffs, analytics, committed fixtures, or logs.

## Normalization

- Unicode text is normalized and internal whitespace collapsed.
- Email local-part casing is retained and the domain is lowercased.
- Country is a checked-in ISO 3166-1 alpha-2 code.
- Timezone must be an IANA identifier.
- URL must be HTTP(S), contain no credentials, and is serialized canonically.
- Phone uses `libphonenumber-js` and is stored in E.164 form when present.
- Registration fingerprint is a keyed server HMAC over normalized country and registration number. It is optional when no secret is configured; no raw value is used as an index key.

## Address rules

All countries require recipient, line 1, city, and valid ISO country code. Philippine (`PH`) addresses additionally require region and a four-digit postal code. Other countries use the base rule until a confirmed country-specific rule is added.

Completion always creates three explicit records. Checked reuse copies the normalized registered address into billing or shipping at completion; it does not create an alias.

## Migration history

Sprint 2 introduces a widen phase and stateful migrations:

- organization normalized name, unverified status, and version are derivable;
- membership `acceptedAt` derives from `createdAt`;
- `primary→general`, `billing→accounts_payable`, `dispatch→shipping`, `sales→sales`;
- `business→registered`;
- contact/address versions default to `1n`.

No missing business facts or attestation evidence are invented. Run commands and recovery steps are maintained in the [security and operations runbook](security-operations-runbook.md).
