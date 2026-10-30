export type PayableHistoryDocument = {
  id: string
  transaction_id?: string | null
  concept: string | null
  amount: number
  currency: string
  issue_date: string
  due_date: string | null
  status: string
  source_account?: { id: string; name: string } | null
}

export type PayableHistoryLedgerRecord = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  currency: string
  description: string | null
  notes: string | null
  transaction_date: string
  source_account?: { id: string; name: string } | null
  category?: { name: string } | null
}

export type PayableHistoryItem = {
  id: string
  date: string
  title: string
  description: string
  account: string
  amount: number
  currency: string
  kind: 'obligation' | 'loan' | 'payment'
  status: string
  source: 'document' | 'ledger'
}

function displayDate(iso: string) {
  if (!iso) return 'Fecha no disponible'
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function displayStatus(status: string) {
  switch (status.toUpperCase()) {
    case 'PAID': return 'Pagado'
    case 'PARTIAL': return 'Parcial'
    case 'PENDING': return 'Pendiente'
    case 'DISPUTED': return 'En disputa'
    default: return 'Estado no verificable'
  }
}

/** Combines only the creditor's returned records; a document and its linked ledger row appear once. */
export function buildPayableFinancialHistory(
  documents: readonly PayableHistoryDocument[],
  ledger: readonly PayableHistoryLedgerRecord[],
): PayableHistoryItem[] {
  const documentsByTransaction = new Map(documents.filter(row => row.transaction_id).map(row => [row.transaction_id!, row]))
  const ledgerIds = new Set(ledger.map(row => row.id))
  const items: PayableHistoryItem[] = documents
    .filter(row => !row.transaction_id || !ledgerIds.has(row.transaction_id))
    .map(row => ({
      id: `payable:${row.id}`,
      date: row.issue_date,
      title: row.concept?.trim() || 'Obligación documentada',
      description: row.due_date ? `Vence ${displayDate(row.due_date)}` : 'Sin vencimiento registrado',
      account: row.source_account?.name || 'Sin cuenta asociada',
      amount: Number(row.amount),
      currency: row.currency,
      kind: 'obligation',
      status: displayStatus(row.status),
      source: 'document',
    }))

  for (const row of ledger) {
    const linkedDocument = documentsByTransaction.get(row.id)
    items.push({
      id: `ledger:${row.id}`,
      date: row.transaction_date,
      title: row.description?.trim() || (linkedDocument?.concept?.trim() ?? (row.type === 'INCOME' ? 'Préstamo recibido' : 'Pago registrado')),
      description: linkedDocument
        ? `Obligación registrada${linkedDocument.due_date ? ` · vence ${displayDate(linkedDocument.due_date)}` : ''}`
        : row.notes?.trim() || row.category?.name || (row.type === 'INCOME' ? 'Dinero recibido en préstamo' : 'Pago al acreedor'),
      account: row.source_account?.name || linkedDocument?.source_account?.name || 'Sin cuenta asociada',
      amount: Number(row.amount),
      currency: row.currency,
      kind: linkedDocument ? 'obligation' : row.type === 'INCOME' ? 'loan' : 'payment',
      status: linkedDocument ? displayStatus(linkedDocument.status) : 'Registrado',
      source: 'ledger',
    })
  }

  return items.sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))
}
