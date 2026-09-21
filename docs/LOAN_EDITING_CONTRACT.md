# Loan Editing Contract

`PATCH /api/credits/:id` accepts a `loan` object only for bank-loan credits.

The server revalidates that every installment is still unpaid before it changes
the disbursement, loan conditions, or schedule. The request is rejected when
an installment has a payment, payment date, linked transaction, or a status
other than `PENDING`.

The server derives the principal from the sum of schedule principal components.
It then updates the original disbursement transaction, credit record, loan
record, and schedule. A failed later step attempts to restore the previous
credit, loan, and schedule values. This preserves the existing credit-edit
payloads for cards and reference-only edits.

The first installment must be dated strictly after the disbursement. This is
required for a valid annual effective cost calculation.

## SBS market-rate fallback

The SBS daily pages can return an Incapsula browser challenge to server-side
requests. When that exact response is detected, the market-rate route may use
an audited SBS daily snapshot for the current Lima date only. A snapshot is
never reused on a subsequent date; without a current verified value, the route
returns `UNAVAILABLE` rather than presenting a stale rate as current.
