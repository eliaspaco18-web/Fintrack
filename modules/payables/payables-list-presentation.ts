import type { ObligationCurrencySummary } from '@/modules/obligations/obligation-currency-presentation'

export type PayablePaymentProgress =
  | { available: true; items: Array<{ currency: ObligationCurrencySummary['currency']; percent: number }> }
  | { available: false; reason: 'empty' | 'inconsistent' }

export function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Returns only a per-currency paid ratio when the underlying summary is internally consistent. */
export function getPayablePaymentProgress(
  summaries: readonly ObligationCurrencySummary[],
): PayablePaymentProgress {
  if (summaries.length === 0) return { available: false, reason: 'empty' }

  const items: Array<{ currency: ObligationCurrencySummary['currency']; percent: number }> = []
  for (const summary of summaries) {
    const { total, settled, pending } = summary
    if (
      !Number.isFinite(total)
      || !Number.isFinite(settled)
      || !Number.isFinite(pending)
      || total <= 0
      || settled < 0
      || settled > total
      || Math.abs(total - settled - pending) > 0.02
    ) {
      return { available: false, reason: 'inconsistent' }
    }
    items.push({ currency: summary.currency, percent: Math.min(100, Math.max(0, (settled / total) * 100)) })
  }

  return { available: true, items }
}

export function countPayablesDueWithinDays(
  rows: readonly { status: string; due_date: string | null }[],
  today: string,
  days: number,
) {
  if (!isValidIsoDate(today) || !Number.isFinite(days) || days < 0) return 0
  const endDate = new Date(`${today}T12:00:00Z`)
  endDate.setUTCDate(endDate.getUTCDate() + days)
  const end = endDate.toISOString().slice(0, 10)
  return rows.filter(row => (
    ['PENDING', 'PARTIAL', 'DISPUTED'].includes(row.status.toUpperCase())
    && isValidIsoDate(row.due_date)
    && row.due_date! >= today
    && row.due_date! <= end
  )).length
}
