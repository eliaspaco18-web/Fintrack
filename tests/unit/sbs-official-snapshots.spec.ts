import { expect, test } from '@playwright/test'
import { getVerifiedSbsDailySnapshotRate } from '@/modules/loans/sbs-official-snapshots'

test.describe('verified SBS daily snapshots', () => {
  test('returns the official consumption reference only for its verified date', () => {
    expect(getVerifiedSbsDailySnapshotRate('2026-09-20', 'VEHICLE', 'PEN')).toBe(57.25)
    expect(getVerifiedSbsDailySnapshotRate('2026-09-21', 'VEHICLE', 'PEN')).toBeNull()
  })
})
