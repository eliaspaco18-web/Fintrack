import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { monthBounds, summarizeMonth } from '@/lib/transactions-month-summary'
import { readCompleteMonthRows } from '@/lib/transactions/month-summary-query'

export async function GET(request: NextRequest) {
  const bounds = monthBounds(request.nextUrl.searchParams.get('month') ?? '')
  if (!bounds) return apiError({ code: 'VALIDATION_ERROR', message: 'Período inválido' })
  const db = await createClient()
  const userId = await getSessionUserId(db)
  if (!userId) return apiUnauthorized()
  try {
    const rows = await readCompleteMonthRows(db, userId, bounds)
    return apiOk(summarizeMonth(rows))
  } catch {
    return apiError({ code: 'DATABASE_ERROR', message: 'No se pudo obtener un resumen completo del período.' })
  }
}
