import { createClient } from '@/lib/supabase.server'
import { apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { getTransactionFormOptions } from '@/lib/server/transaction-form-options'

export async function GET() {
  const supabase = await createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const options = await getTransactionFormOptions(userId)
  const response = apiOk(options)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
