import { getVerifiedUsdPenRate, type ExchangeRateSnapshotEvidence } from '@/lib/finance/exchange-rate-verification'

export const LIVE_EXCHANGE_RATE_CACHE_TTL_MS = 10 * 60 * 1000

export function isRecentExchangeRateSnapshot(
  fetchedAt: unknown,
  now = Date.now(),
): boolean {
  if (typeof fetchedAt !== 'string') return false
  const timestamp = Date.parse(fetchedAt)
  const ageMs = now - timestamp
  return Number.isFinite(timestamp) && ageMs >= 0 && ageMs <= LIVE_EXCHANGE_RATE_CACHE_TTL_MS
}

export function canReuseInitialExchangeRateSnapshot(
  snapshot: ExchangeRateSnapshotEvidence | null | undefined,
  now = Date.now(),
): boolean {
  return getVerifiedUsdPenRate(snapshot) !== null && isRecentExchangeRateSnapshot(snapshot?.fetched_at, now)
}
