import { expect, test } from '@playwright/test'
import { calculateScheduleTceaPercent, getLoanRateVerdict } from '@/modules/loans/loan-rate-analysis'

test.describe('loan rate analysis', () => {
  test('derives an annual effective cost from dated schedule payments', () => {
    const result = calculateScheduleTceaPercent({
      principalAmount: 10_000,
      disbursementDate: '2026-01-01',
      payments: [
        { dueDate: '2026-02-01', totalAmount: 5_200 },
        { dueDate: '2026-03-01', totalAmount: 5_200 },
      ],
    })

    expect(result).not.toBeNull()
    expect(result).toBe(37.54)
  })

  test('only gives a market verdict from valid comparable rates', () => {
    expect(getLoanRateVerdict(10, 13)).toBe('ECONOMICAL')
    expect(getLoanRateVerdict(14, 13)).toBe('MARKET')
    expect(getLoanRateVerdict(16, 13)).toBe('EXPENSIVE')
    expect(getLoanRateVerdict(Number.NaN, 13)).toBeNull()
  })
})
