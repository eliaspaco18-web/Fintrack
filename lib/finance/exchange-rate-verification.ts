export interface ExchangeRateSnapshotEvidence {
  rate?: unknown
  source?: unknown
  fetched_at?: unknown
}

/** Returns a rate only when the snapshot identifies a persisted/source-backed observation. */
export function getVerifiedUsdPenRate(snapshot: ExchangeRateSnapshotEvidence | null | undefined): number | null {
  if (!snapshot || typeof snapshot.source !== 'string' || snapshot.source.trim() === '' || snapshot.source.trim().toLowerCase() === 'fallback') {
    return null
  }

  if (typeof snapshot.fetched_at !== 'string' || !Number.isFinite(Date.parse(snapshot.fetched_at))) {
    return null
  }

  const rate = Number(snapshot.rate)
  return Number.isFinite(rate) && rate > 0 ? rate : null
}
