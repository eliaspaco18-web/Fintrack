import { expect, test } from '@playwright/test'
import { getVerifiedUsdPenRate } from '@/lib/finance/exchange-rate-verification'

test('only source-backed snapshots expose a verified USD/PEN rate', () => {
  expect(getVerifiedUsdPenRate({ rate: 3.74, source: 'exchange_rates_daily', fetched_at: '2026-10-25T10:00:00.000Z' })).toBe(3.74)
  expect(getVerifiedUsdPenRate({ rate: 3.7, source: 'fallback', fetched_at: null })).toBeNull()
  expect(getVerifiedUsdPenRate({ rate: 3.7, source: 'fallback', fetched_at: '2026-10-25T10:00:00.000Z' })).toBeNull()
  expect(getVerifiedUsdPenRate({ rate: 3.7, source: 'exchange_rates_daily', fetched_at: null })).toBeNull()
  expect(getVerifiedUsdPenRate({ rate: 0, source: 'exchange_rates_daily', fetched_at: '2026-10-25T10:00:00.000Z' })).toBeNull()
  expect(getVerifiedUsdPenRate({ rate: Number.NaN, source: 'exchange_rates_daily', fetched_at: '2026-10-25T10:00:00.000Z' })).toBeNull()
  expect(getVerifiedUsdPenRate(null)).toBeNull()
})
