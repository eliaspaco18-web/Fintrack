export type RecurringOperation = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'RECEIVABLE' | 'PAYABLE' | 'UNKNOWN'
export type RecurringDirection = 'incoming' | 'outgoing' | 'transfer' | 'other'

export interface RecurringPresentationSource {
  type: string | null | undefined
  sub_type?: string | null
  is_active?: boolean | null
}

/** Maps the persisted transaction type/subtype pair to the operation the user saved. */
export function getRecurringOperation(row: RecurringPresentationSource): RecurringOperation {
  if (row.type === 'EXPENSE' && row.sub_type === 'RECEIVABLE_LENDING') return 'RECEIVABLE'
  if (row.type === 'INCOME' && row.sub_type === 'PAYABLE_PAYMENT') return 'PAYABLE'

  if (row.sub_type) return 'UNKNOWN'
  if (
    row.type === 'INCOME' || row.type === 'EXPENSE' || row.type === 'TRANSFER'
    || row.type === 'RECEIVABLE' || row.type === 'PAYABLE'
  ) return row.type

  return 'UNKNOWN'
}

export function getRecurringDirection(operation: RecurringOperation): RecurringDirection {
  if (operation === 'INCOME' || operation === 'PAYABLE') return 'incoming'
  if (operation === 'EXPENSE' || operation === 'RECEIVABLE') return 'outgoing'
  if (operation === 'TRANSFER') return 'transfer'
  return 'other'
}

export function summarizeRecurringRows<T extends RecurringPresentationSource>(rows: T[]) {
  return rows.reduce((summary, row) => {
    const operation = getRecurringOperation(row)
    const direction = getRecurringDirection(operation)

    if (row.is_active === true && operation !== 'UNKNOWN') summary.active += 1
    else if (row.is_active === false) summary.inactive += 1

    if (direction === 'incoming') summary.incoming += 1
    else if (direction === 'outgoing') summary.outgoing += 1
    else if (direction === 'transfer') summary.transfers += 1
    else summary.other += 1

    return summary
  }, { active: 0, inactive: 0, incoming: 0, outgoing: 0, transfers: 0, other: 0 })
}

export function matchesRecurringTab(operation: RecurringOperation, tab: string): boolean {
  if (tab === 'all') return true
  const direction = getRecurringDirection(operation)
  return direction === tab
}

/** Opens the existing transaction form in review mode; it never creates a movement itself. */
export function recurringUseHref(row: RecurringPresentationSource & { id: string }): string | null {
  if (row.is_active !== true || getRecurringOperation(row) === 'UNKNOWN') return null
  return `/transactions/new?${new URLSearchParams({ from_recurring: row.id }).toString()}`
}
