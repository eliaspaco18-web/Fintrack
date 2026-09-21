# Billing-cycle statement API

Each credit-card billing cycle can hold one immutable statement attachment. The
attachment path is stored in the existing `billing_cycles.statement_url` field,
which keeps the association scoped to the credit card and its individual cycle.

## Endpoints

- `POST /api/credits/:creditId/billing-cycles/:cycleId/statement`
  accepts multipart form data with a `file` field. It verifies the authenticated
  owner, card type, and parent-child relationship before storing the file.
- `GET /api/credits/:creditId/billing-cycles/:cycleId/statement`
  returns a short-lived signed URL only after the same ownership checks.

The upload accepts the project financial-document allowlist and an 8 MB maximum.
Replacing a stored statement is intentionally blocked. This prevents a billing
cycle from silently losing its original supporting document.
