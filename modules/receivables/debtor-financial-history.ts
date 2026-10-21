export type ReceivableHistoryDocument = {
  id: string
  transaction_id?: string | null
  concept: string | null
  amount: number | string
  currency: string
  issue_date: string
  status: string
  notes?: string | null
  source_account?: { id: string; name: string } | null
  attachment_url?: string | null
}

export type ReceivableHistoryTransaction = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  amount: number | string
  currency: string
  description: string | null
  notes: string | null
  transaction_date: string
  source_account?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
}

export type DebtorFinancialHistoryEntry = {
  id: string
  source: 'obligation' | 'transaction'
  type: 'INCOME' | 'EXPENSE'
  date: string
  amount: number | string
  currency: string
  description: string | null
  notes: string | null
  accountName: string | null
  accountId: string | null
  categoryName: string | null
  status: string
  attachmentUrl: string | null
}

/**
 * Combines documented lending obligations and linked ledger transactions.
 * The obligation's persisted transaction_id is the only safe key for removing
 * its mirrored lending transaction from this presentation.
 */
export function buildDebtorFinancialHistory(
  documents: readonly ReceivableHistoryDocument[],
  transactions: readonly ReceivableHistoryTransaction[],
): DebtorFinancialHistoryEntry[] {
  const sourceTransactionIds = new Set(
    documents.map(document => document.transaction_id).filter((id): id is string => Boolean(id)),
  )

  const documentEntries: DebtorFinancialHistoryEntry[] = documents.map(document => ({
    id: `obligation:${document.id}`,
    source: 'obligation',
    type: 'EXPENSE',
    date: document.issue_date,
    amount: document.amount,
    currency: document.currency,
    description: document.concept,
    notes: document.notes ?? null,
    accountName: document.source_account?.name ?? null,
    accountId: document.source_account?.id ?? null,
    categoryName: null,
    status: document.status,
    attachmentUrl: document.attachment_url ?? null,
  }))

  const transactionEntries: DebtorFinancialHistoryEntry[] = transactions
    .filter(transaction => !sourceTransactionIds.has(transaction.id))
    .map(transaction => ({
      id: `transaction:${transaction.id}`,
      source: 'transaction',
      type: transaction.type,
      date: transaction.transaction_date,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      notes: transaction.notes,
      accountName: transaction.source_account?.name ?? null,
      accountId: transaction.source_account?.id ?? null,
      categoryName: transaction.category?.name ?? null,
      status: 'RECORDED',
      attachmentUrl: null,
    }))

  return [...documentEntries, ...transactionEntries].sort((left, right) => {
    const dateOrder = right.date.localeCompare(left.date)
    return dateOrder || left.id.localeCompare(right.id)
  })
}
