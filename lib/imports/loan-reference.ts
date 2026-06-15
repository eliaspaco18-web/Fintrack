function formatReferenceAmount(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

function normalizeReferenceText(value: string | null | undefined, fallback: string) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : fallback
}

function buildStableLoanReference(params: {
  prefix: 'REC' | 'PAY'
  id: string
  counterpartyName: string
  concept: string | null
  currency: string
  amount: number
  issueDate: string
}) {
  const shortId = params.id.slice(0, 8).toUpperCase()
  const concept = normalizeReferenceText(params.concept, 'Sin concepto')

  return [
    `${params.prefix}-${shortId}`,
    params.counterpartyName.trim(),
    concept,
    `${String(params.currency).toUpperCase()} ${formatReferenceAmount(params.amount)}`,
    params.issueDate,
  ].join(' · ')
}

export function buildReceivableImportReference(receivable: {
  id: string
  debtor_name: string
  concept: string | null
  currency: string
  amount: number
  issue_date: string
}) {
  return buildStableLoanReference({
    prefix: 'REC',
    id: receivable.id,
    counterpartyName: receivable.debtor_name,
    concept: receivable.concept,
    currency: receivable.currency,
    amount: receivable.amount,
    issueDate: receivable.issue_date,
  })
}

export function buildPayableImportReference(payable: {
  id: string
  creditor_name: string
  concept: string | null
  currency: string
  amount: number
  issue_date: string
}) {
  return buildStableLoanReference({
    prefix: 'PAY',
    id: payable.id,
    counterpartyName: payable.creditor_name,
    concept: payable.concept,
    currency: payable.currency,
    amount: payable.amount,
    issueDate: payable.issue_date,
  })
}
