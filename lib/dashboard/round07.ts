import { groupPortfolioBalancesByCurrency } from '@/modules/portfolio/currency-display'
import { summarizeObligationCurrencies } from '@/modules/obligations/obligation-currency-presentation'

export type DashboardAccount = {
  id: string
  type: string
  currency: string
  balance: number
  is_active: boolean
}

export type DashboardObligation = {
  id: string
  amount: number | string | null
  collected_amount?: number | string | null
  paid_amount?: number | string | null
  currency: string | null
  status: string
  due_date: string | null
  concept: string | null
  debtor?: { name: string } | null
  creditor?: { name: string } | null
}

export function currentLimaPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  const iso = `${part('year')}-${part('month')}-${part('day')}`
  return { iso, month: iso.slice(0, 7), day: Number(part('day')) }
}

export function nativeAccountPosition(accounts: readonly DashboardAccount[]) {
  const eligible = accounts.filter(account =>
    account.is_active && account.type !== 'CREDIT_CARD'
    && typeof account.currency === 'string' && account.currency.trim().length > 0
    && Number.isFinite(Number(account.balance)))
  const grouped = groupPortfolioBalancesByCurrency(eligible.map(account => ({
    currency: account.currency.trim().toUpperCase(), balance: Number(account.balance),
  })))
  return {
    count: eligible.length,
    amounts: [...grouped.entries()].sort(([left], [right]) =>
      (left === 'PEN' ? -1 : left === 'USD' ? 0 : 1)
      - (right === 'PEN' ? -1 : right === 'USD' ? 0 : 1)
      || left.localeCompare(right)).map(([currency, value]) => ({ currency, value })),
  }
}

/** Only documented open obligations participate; unknown amounts stay outside verified totals. */
export function documentedPending(records: readonly DashboardObligation[], settledKey: 'collected_amount' | 'paid_amount') {
  const open = records.filter(record => record.status === 'PENDING' || record.status === 'PARTIAL')
  const result = summarizeObligationCurrencies(open.map(record => ({
    amount: record.amount,
    settledAmount: record[settledKey],
    currency: record.currency,
    isOpen: true,
  })))
  return {
    amounts: result.summaries.map(item => ({ currency: item.currency, value: item.pending })),
    unverified: result.unverifiedOpenRecordCount,
    openCount: open.length,
  }
}

export type DueDocument = {
  id: string
  source: 'receivable' | 'payable'
  dueDate: string
  label: string
  currency: string | null
  pending: number | null
  href: string
}

export function documentedAgenda(
  receivables: readonly DashboardObligation[],
  payables: readonly DashboardObligation[],
  todayIso: string,
  days: 7 | 30,
): DueDocument[] {
  const end = new Date(`${todayIso}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + days)
  const endIso = end.toISOString().slice(0, 10)
  const rows = [
    ...receivables.map(record => ({ record, source: 'receivable' as const })),
    ...payables.map(record => ({ record, source: 'payable' as const })),
  ]
  return rows.flatMap(({ record, source }) => {
    if ((record.status !== 'PENDING' && record.status !== 'PARTIAL') || !record.due_date || record.due_date > endIso) return []
    const amount = Number(record.amount)
    const settled = Number(source === 'receivable' ? record.collected_amount : record.paid_amount)
    const currency = record.currency === 'PEN' || record.currency === 'USD' ? record.currency : null
    return [{
      id: record.id, source, dueDate: record.due_date,
      label: record.concept || (source === 'receivable' ? 'Cobro documentado' : 'Pago documentado'),
      currency,
      pending: Number.isFinite(amount) && Number.isFinite(settled) ? Math.max(0, amount - settled) : null,
      href: `/${source === 'receivable' ? 'receivables' : 'payables'}/${encodeURIComponent(record.id)}`,
    }]
  }).sort((left, right) => {
    const leftOverdue = left.dueDate < todayIso ? 0 : 1
    const rightOverdue = right.dueDate < todayIso ? 0 : 1
    return leftOverdue - rightOverdue || left.dueDate.localeCompare(right.dueDate)
      || left.source.localeCompare(right.source) || left.id.localeCompare(right.id)
  })
}
