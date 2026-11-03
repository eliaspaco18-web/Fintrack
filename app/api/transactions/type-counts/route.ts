import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { apiOk, apiUnauthorized, apiZodError, fromResult, getSessionUserId } from '@/lib/api/response'
import { zTransactionFiltersSchema } from '@/lib/schemas/transaction.schemas'
import { TransactionRepository } from '@/modules/transactions/transaction.repository'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const parsed = zTransactionFiltersSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return apiZodError(parsed.error)

  const scope = parsed.data
  const result = await new TransactionRepository(supabase).countByScope(userId, {
    account_id: scope.account_id,
    category_id: scope.category_id,
    currency: scope.currency,
    date_from: scope.date_from,
    date_to: scope.date_to,
    search: scope.search,
  })
  if (!result.ok) return fromResult(result)
  const response = apiOk(result.data)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
