import { expect, test } from '@playwright/test'
import {
  countReceivablesDueWithinDays,
  getReceivableRecoveryProgress,
  getDebtorDueSummary,
  getReceivablePersonState,
  hasVerifiedOpenReceivable,
  type ReceivableListRecord,
} from '@/modules/receivables/receivables-list-presentation'

const fixtures: ReceivableListRecord[] = [
  { id: 'pen-open', debtor_id: 'ana', amount: 100, collected_amount: 25, status: 'PARTIAL', due_date: '2026-10-22' },
  { id: 'usd-open', debtor_id: 'ana', amount: 50, collected_amount: 0, status: 'PENDING', due_date: null },
  { id: 'paid', debtor_id: 'ana', amount: 80, collected_amount: 80, status: 'COLLECTED', due_date: '2026-10-21' },
  { id: 'unrelated', debtor_id: 'luis', amount: 20, collected_amount: 0, status: 'PENDING', due_date: '2026-10-23' },
]

test.describe('Receivables list presentation', () => {
  test('identifies open, partially collected, settled and unverified people without treating inactive as collected', () => {
    expect(getReceivablePersonState(fixtures, 'ana', false)).toBe('PARTIAL')
    expect(getReceivablePersonState(fixtures, 'luis', false)).toBe('OPEN')
    expect(getReceivablePersonState([{ ...fixtures[2]!, id: 'only-paid' }], 'ana', false)).toBe('SETTLED')
    expect(getReceivablePersonState([], 'ana', true)).toBe('UNVERIFIED')
  })

  test('shows one real nearest due date and keeps the other open accounts explicitly counted', () => {
    expect(getDebtorDueSummary(fixtures, 'ana', '2026-10-20')).toEqual({
      date: '2026-10-22',
      overdue: false,
      openWithDateCount: 1,
      openWithoutDateCount: 1,
    })
  })

  test('counts only verified open due dates in the requested window', () => {
    expect(countReceivablesDueWithinDays(fixtures, '2026-10-20', 7)).toBe(2)
    expect(countReceivablesDueWithinDays(fixtures, '2026-10-20', 1)).toBe(0)
  })

  test('offers collection only for an exact debtor with a verified positive outstanding amount', () => {
    expect(hasVerifiedOpenReceivable(fixtures, 'ana')).toBe(true)
    expect(hasVerifiedOpenReceivable(fixtures, 'luis')).toBe(true)
    expect(hasVerifiedOpenReceivable(fixtures, 'nobody')).toBe(false)
    expect(hasVerifiedOpenReceivable([
      { id: 'bad', debtor_id: 'ana', amount: 10, collected_amount: 10, status: 'PENDING', due_date: null },
      { id: 'bad-2', debtor_id: 'ana', amount: Number.NaN, collected_amount: 0, status: 'PARTIAL', due_date: null },
    ], 'ana')).toBe(false)
  })

  test('does not infer a calendar date from malformed or missing values', () => {
    const records = [
      { id: 'bad-date', debtor_id: 'ana', amount: 10, collected_amount: 0, status: 'PENDING', due_date: '2026-02-31' },
      { id: 'missing-date', debtor_id: 'ana', amount: 10, collected_amount: 0, status: 'PENDING', due_date: null },
    ] satisfies ReceivableListRecord[]

    expect(getDebtorDueSummary(records, 'ana', '2026-10-20')).toEqual({
      date: null,
      overdue: false,
      openWithDateCount: 0,
      openWithoutDateCount: 2,
    })
    expect(countReceivablesDueWithinDays(records, '2026-10-20', 7)).toBe(0)
  })

  test('presents repayment as settled over documented total and keeps currencies separate', () => {
    expect(getReceivableRecoveryProgress([
      { currency: 'PEN', total: 2000, settled: 800, pending: 1200 },
      { currency: 'USD', total: 500, settled: 125, pending: 375 },
    ])).toEqual({ available: true, items: [
      { currency: 'PEN', percent: 40 },
      { currency: 'USD', percent: 25 },
    ] })
  })

  test('does not turn zero, unknown, or unreconciled amounts into a progress percentage', () => {
    expect(getReceivableRecoveryProgress([])).toEqual({ available: false, reason: 'missing' })
    expect(getReceivableRecoveryProgress([{ currency: 'PEN', total: 0, settled: 0, pending: 0 }])).toEqual({ available: false, reason: 'missing' })
    expect(getReceivableRecoveryProgress([{ currency: 'EUR', total: 100, settled: 40, pending: 60 }])).toEqual({ available: false, reason: 'inconsistent' })
    expect(getReceivableRecoveryProgress([{ currency: 'PEN', total: 100, settled: 60, pending: 30 }])).toEqual({ available: false, reason: 'inconsistent' })
    expect(getReceivableRecoveryProgress([{ currency: 'PEN', total: 100, settled: 110, pending: -10 }])).toEqual({ available: false, reason: 'inconsistent' })
  })
})
