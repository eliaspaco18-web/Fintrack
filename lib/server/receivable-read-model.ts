export type ReceivableReadDocument = {
  id?: string
  transaction_id?: string | null
  debtor_id?: string | null
  debtor_name: string
  amount: number | string
  collected_amount?: number | string | null
  currency?: string | null
  status: string
  [key: string]: unknown
}

export type ReceivableSourceTransaction = {
  id: string
  debtor_id: string | null
  description: string | null
  amount: number | string
  currency: string | null
  transaction_date: string
  notes: string | null
  source_account?: unknown
}

export type ProjectedReceivableDocument<TDocument extends ReceivableReadDocument = ReceivableReadDocument> =
  TDocument & { is_legacy_projection: boolean }

function normalizeName(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase('es')
}

/**
 * Recreates the old debtor/receivable association in memory only.
 * No database row is inserted or updated by this projection.
 */
export function projectLegacyReceivableLinks<
  TDocument extends ReceivableReadDocument,
  TTransaction extends ReceivableSourceTransaction,
>(
  debtors: Array<{ id: string; name: string }>,
  documents: TDocument[],
  transactions: TTransaction[],
  knownTransactionIds?: ReadonlySet<string>,
): Map<string, Array<ProjectedReceivableDocument<TDocument>>> {
  const debtorIdByName = new Map(debtors.map(debtor => [normalizeName(debtor.name), debtor.id]))
  const debtorNameById = new Map(debtors.map(debtor => [debtor.id, debtor.name]))
  const debtorIds = new Set(debtorNameById.keys())
  const rowsByDebtor = new Map<string, Array<ProjectedReceivableDocument<TDocument>>>()

  for (const debtor of debtors) rowsByDebtor.set(debtor.id, [])

  for (const document of documents) {
    const directDebtorId = document.debtor_id
    const matchedDebtorId = directDebtorId && debtorIds.has(directDebtorId)
      ? directDebtorId
      : directDebtorId === null || directDebtorId === undefined
        ? debtorIdByName.get(normalizeName(document.debtor_name))
        : undefined
    if (!matchedDebtorId) continue

    const rows = rowsByDebtor.get(matchedDebtorId)
    if (!rows) continue
    rows.push({
      ...document,
      ...(directDebtorId ? {} : { debtor_id: matchedDebtorId }),
      is_legacy_projection: !directDebtorId,
    })
  }

  const existingTransactionIds = knownTransactionIds ?? new Set(
    documents.map(document => document.transaction_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  )

  for (const transaction of transactions) {
    const debtorId = transaction.debtor_id
    if (!debtorId || !debtorIds.has(debtorId) || existingTransactionIds.has(transaction.id)) continue

    const debtorName = debtorNameById.get(debtorId)
    const rows = rowsByDebtor.get(debtorId)
    if (!debtorName || !rows) continue

    rows.push({
      id: `legacy-transaction-${transaction.id}`,
      transaction_id: transaction.id,
      debtor_id: debtorId,
      debtor_name: debtorName,
      concept: transaction.description,
      amount: transaction.amount,
      collected_amount: 0,
      currency: transaction.currency ?? 'PEN',
      issue_date: transaction.transaction_date,
      due_date: null,
      notes: transaction.notes,
      attachment_url: null,
      status: 'PENDING',
      is_legacy_projection: true,
      ...(transaction.source_account !== undefined ? { source_account: transaction.source_account } : {}),
    } as unknown as ProjectedReceivableDocument<TDocument>)
  }

  return rowsByDebtor
}
