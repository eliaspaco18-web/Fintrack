import { expect, test } from '@playwright/test'
import { canReuseInitialExchangeRateSnapshot, isRecentExchangeRateSnapshot, LIVE_EXCHANGE_RATE_CACHE_TTL_MS } from '@/lib/finance/exchange-rate-cache'
import { getVerifiedUsdPenRate } from '@/lib/finance/exchange-rate-verification'
import { DAILY_RATE_UPSERT_OPTIONS, insertDailyRateIfMissing } from '@/lib/server/daily-rate-idempotency'
import { createExchangeRateSingleFlight } from '@/lib/server/exchange-rate-single-flight'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

test('simultaneous live-rate reads share one resolution', async () => {
  const gate = deferred<{ rate: number | null }>()
  let resolutionCount = 0
  const resolveRate = createExchangeRateSingleFlight(async () => {
    resolutionCount += 1
    return gate.promise
  })

  const requests = Array.from({ length: 8 }, () => resolveRate())
  await Promise.resolve()
  expect(resolutionCount).toBe(1)

  gate.resolve({ rate: 3.72 })
  const results = await Promise.all(requests)
  expect(results).toEqual(Array.from({ length: 8 }, () => ({ rate: 3.72 })))
})

test('forced refreshes serialize behind normal work and still run once', async () => {
  const gate = deferred<{ source: string }>()
  const calls: boolean[] = []
  const resolveRate = createExchangeRateSingleFlight(async ({ forceRefresh }) => {
    calls.push(forceRefresh)
    if (!forceRefresh) return gate.promise
    return { source: 'fresh' }
  })

  const normal = resolveRate()
  const forcedA = resolveRate({ forceRefresh: true })
  const forcedB = resolveRate({ forceRefresh: true })
  await Promise.resolve()
  expect(calls).toEqual([false])

  gate.resolve({ source: 'cached' })
  await expect(normal).resolves.toEqual({ source: 'cached' })
  await expect(Promise.all([forcedA, forcedB])).resolves.toEqual([
    { source: 'fresh' },
    { source: 'fresh' },
  ])
  expect(calls).toEqual([false, true])
})

test('missing or unverified rate stays unavailable and a failed flight can retry', async () => {
  let attempts = 0
  const resolveRate = createExchangeRateSingleFlight(async () => {
    attempts += 1
    if (attempts === 1) throw new Error('temporary source error')
    return { rate: null, source: 'fallback', fetched_at: null }
  })

  await expect(resolveRate()).rejects.toThrow('temporary source error')
  const unavailable = await resolveRate()
  expect(unavailable).toEqual({ rate: null, source: 'fallback', fetched_at: null })
  expect(getVerifiedUsdPenRate(unavailable)).toBeNull()
  expect(attempts).toBe(2)
})

test('a current server snapshot avoids an immediate duplicate poll, but stale snapshots revalidate', () => {
  const now = Date.parse('2026-11-03T12:00:00.000Z')
  const current = { rate: 3.72, source: 'persisted', fetched_at: '2026-11-03T11:55:00.000Z' }
  expect(isRecentExchangeRateSnapshot('2026-11-03T11:55:00.000Z', now)).toBe(true)
  expect(isRecentExchangeRateSnapshot('2026-11-03T11:00:00.000Z', now)).toBe(false)
  expect(isRecentExchangeRateSnapshot('2026-11-03T12:01:00.000Z', now)).toBe(false)
  expect(canReuseInitialExchangeRateSnapshot(current, now)).toBe(true)
  expect(canReuseInitialExchangeRateSnapshot({ ...current, source: 'fallback' }, now)).toBe(false)
  expect(canReuseInitialExchangeRateSnapshot({ ...current, fetched_at: '2026-11-03T11:00:00.000Z' }, now)).toBe(false)
  expect(canReuseInitialExchangeRateSnapshot(null, now)).toBe(false)
  expect(LIVE_EXCHANGE_RATE_CACHE_TTL_MS).toBe(10 * 60 * 1000)
})

test('daily-rate conflict does not overwrite the existing effective-date observation', async () => {
  const existing = { rate: 3.68, effective_date: '2026-11-03', source: 'persisted' }
  let writes = 0
  let reads = 0
  const result = await insertDailyRateIfMissing(
    async () => {
      writes += 1
      return null
    },
    async () => {
      reads += 1
      return existing
    },
  )

  expect(DAILY_RATE_UPSERT_OPTIONS).toEqual({
    onConflict: 'from_currency,to_currency,effective_date',
    ignoreDuplicates: true,
  })
  expect(result).toBe(existing)
  expect(writes).toBe(1)
  expect(reads).toBe(1)
})

test('unavailable daily-rate insert never fabricates a zero observation', async () => {
  const result = await insertDailyRateIfMissing(
    async () => { throw new Error('Supabase unavailable') },
    async () => null,
  )
  expect(result).toBeNull()
})

test('successful daily-rate insert returns the saved value without an extra read', async () => {
  const inserted = { rate: 3.71, effective_date: '2026-11-03', source: 'verified-source' }
  let reads = 0
  const result = await insertDailyRateIfMissing(
    async () => inserted,
    async () => { reads += 1; return null },
  )
  expect(result).toBe(inserted)
  expect(reads).toBe(0)
})
