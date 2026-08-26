import { formatCurrency } from '@/lib/contracts/ui.contracts'

export const VERIFIED_OBLIGATION_CURRENCIES = ['PEN', 'USD'] as const

export type VerifiedObligationCurrency = typeof VERIFIED_OBLIGATION_CURRENCIES[number]

export type ObligationCurrencySource = {
  amount: unknown
  settledAmount: unknown
  currency: unknown
  isOpen?: boolean
}

export type ObligationCurrencySummary = {
  currency: VerifiedObligationCurrency
  total: number
  settled: number
  pending: number
  recordCount: number
  openRecordCount: number
}

export type ObligationCurrencyBreakdown = {
  summaries: ObligationCurrencySummary[]
  unverifiedRecordCount: number
  unverifiedOpenRecordCount: number
}

export type ObligationSettlementState = 'OPEN' | 'SETTLED' | 'UNVERIFIED' | 'EMPTY'

export type ObligationLedgerSource = {
  amount: unknown
  currency: unknown
  type: unknown
}

export type ObligationLedgerCurrencySummary = {
  currency: VerifiedObligationCurrency
  income: number
  expense: number
  balance: number
  recordCount: number
}

export type ObligationLedgerCurrencyBreakdown = {
  summaries: ObligationLedgerCurrencySummary[]
  unverifiedRecordCount: number
}

const DISPLAY_ORDER = new Map<VerifiedObligationCurrency, number>([
  ['PEN', 0],
  ['USD', 1],
])

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function parseFiniteAmount(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && value.trim().length === 0) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function resolveVerifiedObligationCurrency(value: unknown): VerifiedObligationCurrency | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return normalized === 'PEN' || normalized === 'USD' ? normalized : null
}

function sortCurrencySummaries<T extends { currency: VerifiedObligationCurrency }>(summaries: T[]) {
  return summaries.sort((left, right) => (
    (DISPLAY_ORDER.get(left.currency) ?? Number.MAX_SAFE_INTEGER)
    - (DISPLAY_ORDER.get(right.currency) ?? Number.MAX_SAFE_INTEGER)
  ))
}

export function summarizeObligationCurrencies(
  records: readonly ObligationCurrencySource[],
): ObligationCurrencyBreakdown {
  const buckets = new Map<VerifiedObligationCurrency, ObligationCurrencySummary>()
  let unverifiedRecordCount = 0
  let unverifiedOpenRecordCount = 0

  for (const record of records) {
    const currency = resolveVerifiedObligationCurrency(record.currency)
    const amount = parseFiniteAmount(record.amount)
    const settledAmount = parseFiniteAmount(record.settledAmount)

    if (!currency || amount === null || settledAmount === null) {
      unverifiedRecordCount += 1
      unverifiedOpenRecordCount += record.isOpen ? 1 : 0
      continue
    }

    const current = buckets.get(currency) ?? {
      currency,
      total: 0,
      settled: 0,
      pending: 0,
      recordCount: 0,
      openRecordCount: 0,
    }

    current.total = roundAmount(current.total + amount)
    current.settled = roundAmount(current.settled + settledAmount)
    current.pending = roundAmount(current.pending + (amount - settledAmount))
    current.recordCount += 1
    current.openRecordCount += record.isOpen ? 1 : 0
    buckets.set(currency, current)
  }

  return {
    summaries: sortCurrencySummaries([...buckets.values()]),
    unverifiedRecordCount,
    unverifiedOpenRecordCount,
  }
}

export function combineObligationCurrencyBreakdowns(
  breakdowns: readonly ObligationCurrencyBreakdown[],
): ObligationCurrencyBreakdown {
  const buckets = new Map<VerifiedObligationCurrency, ObligationCurrencySummary>()

  for (const breakdown of breakdowns) {
    for (const summary of breakdown.summaries) {
      const current = buckets.get(summary.currency) ?? {
        currency: summary.currency,
        total: 0,
        settled: 0,
        pending: 0,
        recordCount: 0,
        openRecordCount: 0,
      }

      current.total = roundAmount(current.total + summary.total)
      current.settled = roundAmount(current.settled + summary.settled)
      current.pending = roundAmount(current.pending + summary.pending)
      current.recordCount += summary.recordCount
      current.openRecordCount += summary.openRecordCount
      buckets.set(summary.currency, current)
    }
  }

  return {
    summaries: sortCurrencySummaries([...buckets.values()]),
    unverifiedRecordCount: breakdowns.reduce(
      (total, breakdown) => total + breakdown.unverifiedRecordCount,
      0,
    ),
    unverifiedOpenRecordCount: breakdowns.reduce(
      (total, breakdown) => total + breakdown.unverifiedOpenRecordCount,
      0,
    ),
  }
}

export function summarizeObligationLedgerCurrencies(
  records: readonly ObligationLedgerSource[],
): ObligationLedgerCurrencyBreakdown {
  const buckets = new Map<VerifiedObligationCurrency, ObligationLedgerCurrencySummary>()
  let unverifiedRecordCount = 0

  for (const record of records) {
    const currency = resolveVerifiedObligationCurrency(record.currency)
    const amount = parseFiniteAmount(record.amount)
    const type = record.type === 'INCOME' || record.type === 'EXPENSE' ? record.type : null

    if (!currency || amount === null || !type) {
      unverifiedRecordCount += 1
      continue
    }

    const current = buckets.get(currency) ?? {
      currency,
      income: 0,
      expense: 0,
      balance: 0,
      recordCount: 0,
    }

    current.income = roundAmount(current.income + (type === 'INCOME' ? amount : 0))
    current.expense = roundAmount(current.expense + (type === 'EXPENSE' ? amount : 0))
    current.balance = roundAmount(current.expense - current.income)
    current.recordCount += 1
    buckets.set(currency, current)
  }

  return {
    summaries: sortCurrencySummaries([...buckets.values()]),
    unverifiedRecordCount,
  }
}

export function formatVerifiedObligationAmount(
  amount: number,
  currency: VerifiedObligationCurrency,
) {
  return `${currency} ${formatCurrency(amount, currency)}`
}

export function formatObligationCurrencySummaries(
  summaries: readonly ObligationCurrencySummary[],
  field: 'total' | 'settled' | 'pending',
  emptyLabel = 'Sin importe verificable',
) {
  if (summaries.length === 0) return emptyLabel
  return summaries
    .map(summary => formatVerifiedObligationAmount(summary[field], summary.currency))
    .join(' · ')
}

export function formatObligationLedgerSummaries(
  summaries: readonly ObligationLedgerCurrencySummary[],
  field: 'income' | 'expense' | 'balance',
  emptyLabel = 'Sin importe verificable',
) {
  if (summaries.length === 0) return emptyLabel
  return summaries
    .map(summary => formatVerifiedObligationAmount(summary[field], summary.currency))
    .join(' · ')
}

export function obligationProgress(summary: ObligationCurrencySummary) {
  if (summary.total <= 0) return 0
  return Math.min(100, Math.max(0, (summary.settled / summary.total) * 100))
}

export function getObligationSettlementState({
  summaries,
  unverifiedRecordCount,
  hasUnverifiedInitialBalance = false,
}: Pick<ObligationCurrencyBreakdown, 'summaries' | 'unverifiedRecordCount'> & {
  hasUnverifiedInitialBalance?: boolean
}): ObligationSettlementState {
  if (summaries.some(summary => summary.openRecordCount > 0)) return 'OPEN'
  if (hasUnverifiedInitialBalance || unverifiedRecordCount > 0) return 'UNVERIFIED'
  if (summaries.every(summary => summary.recordCount === 0) || summaries.length === 0) return 'EMPTY'
  return 'SETTLED'
}
