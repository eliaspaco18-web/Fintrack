import { expect, test } from '@playwright/test'
import {
  combineObligationCurrencyBreakdowns,
  formatObligationCurrencySummaries,
  formatObligationLedgerSummaries,
  getObligationSettlementState,
  obligationProgress,
  resolveVerifiedObligationCurrency,
  summarizeObligationCurrencies,
  summarizeObligationLedgerCurrencies,
} from '@/modules/obligations/obligation-currency-presentation'

test.describe('Receivables and Payables currency presentation integrity', () => {
  test('presents a single PEN receivable currency without conversion', () => {
    const source = [{ amount: 1_250, settledAmount: 250, currency: 'PEN', isOpen: true }]
    const before = structuredClone(source)

    const result = summarizeObligationCurrencies(source)

    expect(result).toEqual({
      summaries: [{
        currency: 'PEN',
        total: 1_250,
        settled: 250,
        pending: 1_000,
        recordCount: 1,
        openRecordCount: 1,
      }],
      unverifiedRecordCount: 0,
      unverifiedOpenRecordCount: 0,
    })
    expect(formatObligationCurrencySummaries(result.summaries, 'pending')).toContain('PEN')
    expect(source).toEqual(before)
  })

  test('presents a single USD payable currency without conversion', () => {
    const result = summarizeObligationCurrencies([
      { amount: 800, settledAmount: 300, currency: 'USD', isOpen: true },
    ])

    expect(result.summaries).toEqual([{
      currency: 'USD',
      total: 800,
      settled: 300,
      pending: 500,
      recordCount: 1,
      openRecordCount: 1,
    }])
    expect(formatObligationCurrencySummaries(result.summaries, 'pending')).toContain('USD')
  })

  test('keeps PEN and USD in separate totals for mixed receivables or payables', () => {
    const result = summarizeObligationCurrencies([
      { amount: 100, settledAmount: 20, currency: 'PEN', isOpen: true },
      { amount: 100, settledAmount: 40, currency: 'USD', isOpen: true },
    ])

    expect(result.summaries).toEqual([
      {
        currency: 'PEN',
        total: 100,
        settled: 20,
        pending: 80,
        recordCount: 1,
        openRecordCount: 1,
      },
      {
        currency: 'USD',
        total: 100,
        settled: 40,
        pending: 60,
        recordCount: 1,
        openRecordCount: 1,
      },
    ])

    const display = formatObligationCurrencySummaries(result.summaries, 'pending')
    expect(display).toContain('PEN')
    expect(display).toContain('USD')
    expect(display).toContain('·')
    expect(result.summaries).not.toContainEqual(expect.objectContaining({ pending: 140 }))
  })

  test('does not label a custom, missing or malformed currency as PEN or USD', () => {
    const result = summarizeObligationCurrencies([
      { amount: 450, settledAmount: 0, currency: 'EUR', isOpen: true },
      { amount: 200, settledAmount: 0, currency: null, isOpen: true },
      { amount: Number.NaN, settledAmount: 0, currency: 'PEN', isOpen: true },
    ])

    expect(resolveVerifiedObligationCurrency('EUR')).toBeNull()
    expect(resolveVerifiedObligationCurrency(null)).toBeNull()
    expect(result).toEqual({
      summaries: [],
      unverifiedRecordCount: 3,
      unverifiedOpenRecordCount: 3,
    })
    expect(formatObligationCurrencySummaries(result.summaries, 'pending')).toBe('Sin importe verificable')
  })

  test('combines module summaries by currency and preserves record counts', () => {
    const first = summarizeObligationCurrencies([
      { amount: 100, settledAmount: 10, currency: 'PEN', isOpen: true },
      { amount: 50, settledAmount: 50, currency: 'USD', isOpen: false },
    ])
    const second = summarizeObligationCurrencies([
      { amount: 200, settledAmount: 20, currency: 'PEN', isOpen: true },
      { amount: 70, settledAmount: 0, currency: 'EUR', isOpen: true },
    ])

    expect(combineObligationCurrencyBreakdowns([first, second])).toEqual({
      summaries: [
        {
          currency: 'PEN',
          total: 300,
          settled: 30,
          pending: 270,
          recordCount: 2,
          openRecordCount: 2,
        },
        {
          currency: 'USD',
          total: 50,
          settled: 50,
          pending: 0,
          recordCount: 1,
          openRecordCount: 0,
        },
      ],
      unverifiedRecordCount: 1,
      unverifiedOpenRecordCount: 1,
    })
  })

  test('keeps ledger income, expense and balances separate by native currency', () => {
    const source = [
      { type: 'EXPENSE', amount: 500, currency: 'PEN' },
      { type: 'INCOME', amount: 200, currency: 'PEN' },
      { type: 'EXPENSE', amount: 100, currency: 'USD' },
      { type: 'INCOME', amount: 25, currency: 'USD' },
      { type: 'INCOME', amount: 10, currency: 'EUR' },
    ]
    const before = structuredClone(source)

    const result = summarizeObligationLedgerCurrencies(source)

    expect(result).toEqual({
      summaries: [
        { currency: 'PEN', income: 200, expense: 500, balance: 300, recordCount: 2 },
        { currency: 'USD', income: 25, expense: 100, balance: 75, recordCount: 2 },
      ],
      unverifiedRecordCount: 1,
    })
    const display = formatObligationLedgerSummaries(result.summaries, 'balance')
    expect(display).toContain('PEN')
    expect(display).toContain('USD')
    expect(source).toEqual(before)
  })

  test('calculates progress only inside one verified currency bucket', () => {
    const [pen, usd] = summarizeObligationCurrencies([
      { amount: 100, settledAmount: 25, currency: 'PEN', isOpen: true },
      { amount: 200, settledAmount: 100, currency: 'USD', isOpen: true },
    ]).summaries

    expect(obligationProgress(pen!)).toBe(25)
    expect(obligationProgress(usd!)).toBe(50)
  })

  test('does not let one currency cancel another when presenting settlement state', () => {
    const breakdown = summarizeObligationCurrencies([
      { amount: 100, settledAmount: 200, currency: 'PEN', isOpen: false },
      { amount: 100, settledAmount: 0, currency: 'USD', isOpen: true },
    ])

    expect(breakdown.summaries.reduce((total, summary) => total + summary.pending, 0)).toBe(0)
    expect(getObligationSettlementState(breakdown)).toBe('OPEN')
  })

  test('marks currencyless initial debt and unknown records as unverifiable instead of zero', () => {
    expect(getObligationSettlementState({
      summaries: [],
      unverifiedRecordCount: 0,
      hasUnverifiedInitialBalance: true,
    })).toBe('UNVERIFIED')

    expect(getObligationSettlementState({
      summaries: [],
      unverifiedRecordCount: 1,
    })).toBe('UNVERIFIED')
  })
})
