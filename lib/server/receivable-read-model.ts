export type ReceivableReadDocument = {
  id: string
  transaction_id?: string | null
  debtor_id: string | null
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
  TDocument & {
    is_legacy_projection: boolean
    is_ambiguous_projection: boolean
    projection_source: 'receivable' | 'orphan-receivable' | 'transaction'
  }

export type ReceivableProjectionResult<TDocument extends ReceivableReadDocument = ReceivableReadDocument> = {
  byDebtor: Map<string, Array<ProjectedReceivableDocument<TDocument>>>
  coverage: {
    ambiguousDebtorIds: ReadonlySet<string>
    ambiguousOrphanDocumentCount: number
    unmatchedOrphanDocumentCount: number
    duplicateTransactionLinkCount: number
  }
}

function normalizeName(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase('es')
}

/**
 * Recreates the old debtor/receivable association in memory only.
 * Name matching is allowed only when the normalized name identifies exactly
 * one debtor; ambiguous records stay unassigned and mark every candidate as
 * incomplete. No database row is inserted or updated by this projection.
 */
export function projectLegacyReceivableLinks<
  TDocument extends ReceivableReadDocument,
  TTransaction extends ReceivableSourceTransaction,
>(
  debtors: Array<{ id: string; name: string }>,
  documents: TDocument[],
  transactions: TTransaction[],
): ReceivableProjectionResult<TDocument> {
  const debtorById = new Map(debtors.map(debtor => [debtor.id, debtor]))
  const debtorsByName = new Map<string, Array<{ id: string; name: string }>>()
  const rowsByDebtor = new Map<string, Array<ProjectedReceivableDocument<TDocument>>>()
  const ambiguousDebtorIds = new Set<string>()
  const assignedDebtorByDocument = new Map<TDocument, string>()
  const orphanDocumentIds = new Set<TDocument>()
  let ambiguousOrphanDocumentCount = 0
  let unmatchedOrphanDocumentCount = 0

  for (const debtor of debtors) {
    rowsByDebtor.set(debtor.id, [])
    const key = normalizeName(debtor.name)
    const matches = debtorsByName.get(key) ?? []
    matches.push(debtor)
    debtorsByName.set(key, matches)
  }

  for (const document of documents) {
    const directDebtorId = document.debtor_id
    if (directDebtorId && debtorById.has(directDebtorId)) {
      assignedDebtorByDocument.set(document, directDebtorId)
      continue
    }
    if (directDebtorId) continue

    orphanDocumentIds.add(document)
    const matches = debtorsByName.get(normalizeName(document.debtor_name)) ?? []
    if (matches.length === 1) {
      assignedDebtorByDocument.set(document, matches[0]!.id)
    } else if (matches.length > 1) {
      ambiguousOrphanDocumentCount += 1
      matches.forEach(debtor => ambiguousDebtorIds.add(debtor.id))
    } else {
      unmatchedOrphanDocumentCount += 1
    }
  }

  const linkedDocumentsByTransaction = new Map<string, TDocument[]>()
  for (const document of documents) {
    const transactionId = typeof document.transaction_id === 'string' ? document.transaction_id : ''
    if (!transactionId) continue
    const linked = linkedDocumentsByTransaction.get(transactionId) ?? []
    linked.push(document)
    linkedDocumentsByTransaction.set(transactionId, linked)
  }

  const ambiguousDocumentIds = new Set<string>()
  const ambiguousTransactionIds = new Set<string>()
  let duplicateTransactionLinkCount = 0
  for (const linkedDocuments of linkedDocumentsByTransaction.values()) {
    if (linkedDocuments.length < 2) continue
    duplicateTransactionLinkCount += 1
    for (const document of linkedDocuments) {
      if (typeof document.id === 'string') ambiguousDocumentIds.add(document.id)
      const assignedDebtorId = assignedDebtorByDocument.get(document)
      if (assignedDebtorId) ambiguousDebtorIds.add(assignedDebtorId)
      else if (orphanDocumentIds.has(document)) {
        const matches = debtorsByName.get(normalizeName(document.debtor_name)) ?? []
        matches.forEach(debtor => ambiguousDebtorIds.add(debtor.id))
      }
    }
  }

  const knownTransactionIds = new Set(linkedDocumentsByTransaction.keys())
  const unlinkedLegacyDocumentsByDebtor = new Map<string, TDocument[]>()
  for (const [document, debtorId] of assignedDebtorByDocument) {
    if (orphanDocumentIds.has(document) && !document.transaction_id) {
      const unlinked = unlinkedLegacyDocumentsByDebtor.get(debtorId) ?? []
      unlinked.push(document)
      unlinkedLegacyDocumentsByDebtor.set(debtorId, unlinked)
    }
    const rows = rowsByDebtor.get(debtorId)
    if (!rows) continue
    const isLegacyProjection = orphanDocumentIds.has(document)
    rows.push({
      ...document,
      debtor_id: debtorId,
      is_legacy_projection: isLegacyProjection,
      is_ambiguous_projection: typeof document.id === 'string' && ambiguousDocumentIds.has(document.id),
      projection_source: isLegacyProjection ? 'orphan-receivable' : 'receivable',
    } as ProjectedReceivableDocument<TDocument>)
  }

  const seenTransactionIds = new Set<string>()
  const unlinkedTransactionsByDebtor = new Map<string, TTransaction[]>()
  for (const transaction of transactions) {
    const debtorId = transaction.debtor_id
    if (!debtorId || !debtorById.has(debtorId) || knownTransactionIds.has(transaction.id)) continue
    if (seenTransactionIds.has(transaction.id)) {
      ambiguousDebtorIds.add(debtorId)
      continue
    }
    seenTransactionIds.add(transaction.id)
    const unlinked = unlinkedTransactionsByDebtor.get(debtorId) ?? []
    unlinked.push(transaction)
    unlinkedTransactionsByDebtor.set(debtorId, unlinked)
  }

  for (const [debtorId, orphanDocuments] of unlinkedLegacyDocumentsByDebtor) {
    const unlinkedTransactions = unlinkedTransactionsByDebtor.get(debtorId) ?? []
    if (unlinkedTransactions.length === 0) continue
    ambiguousDebtorIds.add(debtorId)
    ambiguousOrphanDocumentCount += orphanDocuments.length
    orphanDocuments.forEach(document => {
      if (typeof document.id === 'string') ambiguousDocumentIds.add(document.id)
    })
    unlinkedTransactions.forEach(transaction => ambiguousTransactionIds.add(transaction.id))
  }

  for (const [debtorId, unlinkedTransactions] of unlinkedTransactionsByDebtor) {
    const debtorName = debtorById.get(debtorId)?.name
    const rows = rowsByDebtor.get(debtorId)
    if (!debtorName || !rows) continue

    for (const transaction of unlinkedTransactions) {
      rows.push({
        id: `legacy-transaction-${transaction.id}`,
        transaction_id: transaction.id,
        debtor_id: debtorId,
        debtor_name: debtorName,
        concept: transaction.description,
        amount: transaction.amount,
        collected_amount: 0,
        currency: transaction.currency,
        issue_date: transaction.transaction_date,
        due_date: null,
        notes: transaction.notes,
        attachment_url: null,
        status: 'PENDING',
        is_legacy_projection: true,
        is_ambiguous_projection: ambiguousTransactionIds.has(transaction.id),
        projection_source: 'transaction',
        ...(transaction.source_account !== undefined ? { source_account: transaction.source_account } : {}),
      } as unknown as ProjectedReceivableDocument<TDocument>)
    }
  }

  for (const rows of rowsByDebtor.values()) {
    for (const row of rows) {
      if (typeof row.id === 'string' && ambiguousDocumentIds.has(row.id)) row.is_ambiguous_projection = true
    }
  }

  return {
    byDebtor: rowsByDebtor,
    coverage: {
      ambiguousDebtorIds,
      ambiguousOrphanDocumentCount,
      unmatchedOrphanDocumentCount,
      duplicateTransactionLinkCount,
    },
  }
}
