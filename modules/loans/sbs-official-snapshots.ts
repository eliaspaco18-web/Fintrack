import type { LoanType } from '@/modules/loans/loan-type'

type SnapshotRates = Partial<Record<LoanType, Partial<Record<'PEN' | 'USD', number>>>>

/**
 * Date-bound values transcribed from the official SBS daily publication when
 * its Incapsula challenge prevents a server-side read. A value never applies
 * to another date, so an old rate cannot be presented as today's market rate.
 */
const VERIFIED_DAILY_SBS_SNAPSHOTS: Record<string, SnapshotRates> = {
  '2026-09-20': {
    CONSUMPTION: { PEN: 57.25, USD: 51.64 },
    VEHICLE: { PEN: 57.25, USD: 51.64 },
    MICROENTERPRISE: { PEN: 58.13, USD: 20.94 },
  },
}

export function getVerifiedSbsDailySnapshotRate(
  date: string,
  loanType: LoanType,
  currency: 'PEN' | 'USD',
): number | null {
  const rate = VERIFIED_DAILY_SBS_SNAPSHOTS[date]?.[loanType]?.[currency]
  return typeof rate === 'number' && Number.isFinite(rate) ? rate : null
}
