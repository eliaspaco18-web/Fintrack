export const DAILY_RATE_UPSERT_OPTIONS = {
  onConflict: 'from_currency,to_currency,effective_date',
  ignoreDuplicates: true,
} as const

/**
 * Writes the first verified daily observation and reads the winner if another
 * request already inserted that (currency pair, effective date) key.
 */
export async function insertDailyRateIfMissing<T>(
  insertIfAbsent: () => Promise<T | null>,
  readExisting: () => Promise<T | null>,
): Promise<T | null> {
  try {
    const inserted = await insertIfAbsent()
    if (inserted !== null) return inserted
  } catch {
    // A failed/contended insert may still have committed on another request.
  }

  return readExisting()
}
