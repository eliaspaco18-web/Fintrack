import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { monthBounds, summarizeMonth, type MonthSummaryRow } from '@/lib/transactions-month-summary'

export async function GET(request: NextRequest) {
  const bounds = monthBounds(request.nextUrl.searchParams.get('month') ?? '')
  if (!bounds) return apiError({ code: 'VALIDATION_ERROR', message: 'Período inválido' })
  const db = await createClient()
  const userId = await getSessionUserId(db)
  if (!userId) return apiUnauthorized()
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
      return apiError({ code: 'DATABASE_ERROR', message: 'No se pudo obtener un resumen completo del período.' })
    }
    expected = count
    rows.push(...(data ?? []))
    if (rows.length === expected) break
    if (!data?.length || rows.length > expected) return apiError({ code: 'DATABASE_ERROR', message: 'No se pudo obtener un resumen completo del período.' })
  }
  return apiOk(summarizeMonth(rows))
}
