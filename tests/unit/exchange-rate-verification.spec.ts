import { expect, test } from '@playwright/test'
import { getVerifiedUsdPenRate } from '@/lib/finance/exchange-rate-verification'

test('an exchange rate is unavailable without source and timestamp provenance', () => {
  expect(getVerifiedUsdPenRate({ rate: 3.8 })).toBeNull()
  expect(getVerifiedUsdPenRate({ rate: 3.8, source: 'manual' })).toBeNull()
  expect(getVerifiedUsdPenRate({ rate: 3.8, source: 'fallback', fetched_at: '2026-10-25T12:00:00Z' })).toBeNull()
  expect(getVerifiedUsdPenRate({ rate: 3.8, source: 'manual', fetched_at: 'not-a-date' })).toBeNull()
})

test('positive persisted and explicitly manual rates remain usable', () => {
  expect(getVerifiedUsdPenRate({ rate: 3.8, source: 'manual', fetched_at: '2026-10-25T12:00:00Z' })).toBe(3.8)
  expect(getVerifiedUsdPenRate({ rate: '3.8', source: 'exchange-api', fetched_at: '2026-10-25T12:00:00Z' })).toBe(3.8)
})

test('non-positive and non-finite rates are never treated as verified', () => {
  expect(getVerifiedUsdPenRate({ rate: 0, source: 'manual', fetched_at: '2026-10-25T12:00:00Z' })).toBeNull()
  expect(getVerifiedUsdPenRate({ rate: Number.POSITIVE_INFINITY, source: 'manual', fetched_at: '2026-10-25T12:00:00Z' })).toBeNull()
})
