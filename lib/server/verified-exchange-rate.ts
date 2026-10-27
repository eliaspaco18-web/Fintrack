/**
 * Returns a usable USD/PEN rate only when it came from a persisted or explicit
 * non-fallback source. The legacy numeric fallback is not an observation.
 */
export function getVerifiedUsdPenRate(
  rate: number | null | undefined,
  source: string | null | undefined,
): number | null {
  const numericRate = Number(rate)
  if (source?.trim().toLowerCase() === 'fallback') return null
  if (!Number.isFinite(numericRate) || numericRate <= 0) return null
  return numericRate
}
