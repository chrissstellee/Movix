# Business Onboarding Security and Operations Runbook

## Immediate access conditions

- Suspended user, wallet, membership, or organization: deny protected data and unmount the protected UI before redirecting.
- No active membership: route to onboarding.
- Multiple active organizations: return `MULTIPLE_ORGANIZATIONS_UNSUPPORTED`; never select one.
- Foreign organization/contact/address ID: return the same generic authorization error without confirming existence.

## Recovery procedures

### Stale draft or profile

Do not overwrite. Reload server-confirmed values, explain that another tab or actor changed the record, and allow the user to reapply their edit. A rejected stale mutation creates no audit event.

### Concurrent or duplicate completion

Retry the original completion key only when retrying the same submitted operation. Same-key success may be replayed. A different key after completion triggers context reload and redirect. `BUSINESS_DUPLICATE` must disclose no matching organization detail.

### Migration

1. Confirm target deployment and record a safe environment label.
2. Inventory without exporting documents.
3. Back up through the approved Convex operational process.
4. Dry-run each migration, inspect only counts/status, then execute.
5. Verify canonical coverage, readiness behavior, and application reads.
6. Narrow the schema only after verification.

Run a development migration:

```bash
pnpm --filter @repo/backend exec convex run migrations:run '{"fn":"migrations:normalizeLegacyOrganizations","dryRun":true}'
pnpm --filter @repo/backend exec convex run migrations:run '{"fn":"migrations:normalizeLegacyOrganizations"}'
```

Repeat in dependency order for memberships, contacts, and addresses. Add `--prod` only under an approved production change.

If a batch fails, keep the widened schema and canonical-write code deployed, correct the migration, and resume from the component cursor. Do not narrow or manually invent missing data.

### Completion rollback verification

After an injected completion failure, query deterministic fixture counts and confirm no organization, membership, contact, address, audit, or completed marker was added. Do not export the records as evidence.

## PII or logging incident

Stop evidence collection, preserve access-controlled incident metadata, revoke exposed session material, remove unsafe artifacts from distribution, rotate affected keys, and notify Security/Privacy. Restoration requires a reviewed root cause, redacted replacement evidence, credential rotation where applicable, and confirmation that logs and audit events contain no raw values.

Never commit live business data, full wallets, tenant IDs, drafts, completion keys, tokens, cookies, session IDs, raw audits, or unredacted logs/browser/environment output.
