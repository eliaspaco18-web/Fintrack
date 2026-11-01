import type { MonthSummaryRow } from '@/lib/transactions-month-summary'

export async function readCompleteMonthRows(db: any, userId: string, bounds: { start: string; end: string }): Promise<MonthSummaryRow[]> {
  const rows: MonthSummaryRow[] = []
  const batchSize = 500
  let expected: number | null = null
  for (let offset = 0; ; offset += batchSize) {
    const { data, count, error } = await db.from('transactions')
      .select('type, amount_pen', { count: 'exact' })
      .eq('user_id', userId).eq('affects_reports', true)
      .in('type', ['INCOME', 'EXPENSE'])
      .gte('transaction_date', bounds.start).lte('transaction_date', bounds.end)
      .order('id', { ascending: true }).range(offset, offset + batchSize - 1)
    if (error || count === null || (expected !== null && count !== expected)) {
      throw new Error('MONTH_SUMMARY_INCOMPLETE')
    }
    expected = count
    rows.push(...(data ?? []))
    if (expected !== null && rows.length === expected) break
    if (expected === null || !data?.length || rows.length > expected) throw new Error('MONTH_SUMMARY_INCOMPLETE')
  }
  return rows
}
