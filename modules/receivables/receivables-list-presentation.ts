export type ReceivableListRecord = {
  id: string
  debtor_id: string | null
  amount: number
  collected_amount: number
  status: string
  due_date: string | null
}

export type ReceivablePersonState = 'OPEN' | 'PARTIAL' | 'SETTLED' | 'WRITTEN_OFF' | 'UNVERIFIED' | 'EMPTY'

export type ReceivableRecoverySummary = {
  currency: string
  total: number
  settled: number
  pending: number
}

export type ReceivableRecoveryProgress =
  | { available: true; items: Array<{ currency: 'PEN' | 'USD'; percent: number }> }
  | { available: false; reason: 'missing' | 'inconsistent' }

/** Present only reconciled, verified native-currency recovery ratios. */
export function getReceivableRecoveryProgress(
  summaries: readonly ReceivableRecoverySummary[] | null | undefined,
): ReceivableRecoveryProgress {
  if (!summaries?.length) return { available: false, reason: 'missing' }

  const items: Array<{ currency: 'PEN' | 'USD'; percent: number }> = []
  for (const summary of summaries) {
    const currency = typeof summary.currency === 'string' ? summary.currency.toUpperCase() : ''
    const total = Number(summary.total)
    const settled = Number(summary.settled)
    const pending = Number(summary.pending)
    if (
      (currency !== 'PEN' && currency !== 'USD')
      || !Number.isFinite(total)
      || !Number.isFinite(settled)
      || !Number.isFinite(pending)
      || total <= 0
      || settled < 0
      || pending < 0
      || Math.abs(total - settled - pending) > 0.010001
      || settled > total + 0.010001
    ) {
      return { available: false, reason: total === 0 && settled === 0 && pending === 0 ? 'missing' : 'inconsistent' }
    }

    items.push({
      currency,
      percent: Math.round((settled / total) * 1000) / 10,
    })
  }

  return items.length ? { available: true, items } : { available: false, reason: 'missing' }
}

function isIsoCalendarDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function hasOpenBalance(record: ReceivableListRecord): boolean {
  return ['PENDING', 'PARTIAL'].includes(record.status)
    && Number.isFinite(Number(record.amount))
    && Number.isFinite(Number(record.collected_amount))
    && Number(record.amount) - Number(record.collected_amount) > 0
}

export function getReceivablePersonState(
  records: readonly ReceivableListRecord[],
  debtorId: string,
  hasUnverifiedInitialBalance: boolean,
): ReceivablePersonState {
  const related = records.filter(record => record.debtor_id === debtorId)
  const open = related.filter(hasOpenBalance)

  if (open.some(record => record.status === 'PARTIAL')) return 'PARTIAL'
  if (open.length > 0) return 'OPEN'
  if (related.length > 0 && related.every(record => record.status === 'WRITTEN_OFF')) return 'WRITTEN_OFF'
  if (related.length > 0 && related.every(record => record.status === 'COLLECTED' || record.status === 'WRITTEN_OFF')) {
    return related.some(record => record.status === 'COLLECTED') ? 'SETTLED' : 'WRITTEN_OFF'
  }
  if (hasUnverifiedInitialBalance) return 'UNVERIFIED'
  return related.length === 0 ? 'EMPTY' : 'UNVERIFIED'
}

export function getDebtorDueSummary(
  records: readonly ReceivableListRecord[],
  debtorId: string,
  today: string,
) {
  const open = records.filter(record =>
    record.debtor_id === debtorId && hasOpenBalance(record) && isIsoCalendarDate(record.due_date),
  )
  const overdue = open.filter(record => record.due_date! < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  const upcoming = open.filter(record => record.due_date! >= today).sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  const nearest = overdue[0] ?? upcoming[0] ?? null

  return {
    date: nearest?.due_date ?? null,
    overdue: Boolean(nearest && nearest.due_date! < today),
    openWithDateCount: open.length,
    openWithoutDateCount: records.filter(record =>
      record.debtor_id === debtorId && hasOpenBalance(record) && !isIsoCalendarDate(record.due_date),
    ).length,
  }
}

export function countReceivablesDueWithinDays(
  records: readonly ReceivableListRecord[],
  today: string,
  days = 7,
): number {
  if (!isIsoCalendarDate(today) || !Number.isFinite(days) || days < 0) return 0
  const end = new Date(`${today}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + days)
  const endIso = end.toISOString().slice(0, 10)

  return records.filter(record =>
    hasOpenBalance(record)
    && isIsoCalendarDate(record.due_date)
    && record.due_date! >= today
    && record.due_date! <= endIso,
  ).length
}

export function hasVerifiedOpenReceivable(records: readonly ReceivableListRecord[], debtorId: string): boolean {
  return records.some(record => record.debtor_id === debtorId && hasOpenBalance(record))
}
