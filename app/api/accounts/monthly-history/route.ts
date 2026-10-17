import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { HISTORY_MAX_ACCOUNTS, readAccountMonthlyHistories } from '@/modules/portfolio/account-monthly-history'

export const dynamic = 'force-dynamic'

const SAFE_READ_ERROR = 'No se pudo verificar el historial de saldos.'
function privateNoStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

export async function GET() {
  const supabase = createClient()
  const result = await readAccountMonthlyHistories({
    getUserId: () => getSessionUserId(supabase),
    listAccounts: async (userId, signal) => await supabase
      .from('accounts')
      .select('id,type,currency,initial_balance,initial_balance_date,balance,updated_at', { count: 'exact' })
      .eq('user_id', userId)
      .limit(HISTORY_MAX_ACCOUNTS + 1)
      .abortSignal(signal),
    listTransactionsPage: async (userId, snapshotAt, offset, limit, signal) => await supabase
      .from('transactions')
      .select('source_account_id,destination_account_id,type,amount,currency,transaction_date,updated_at', { count: 'exact' })
      .eq('user_id', userId)
      .lte('updated_at', snapshotAt)
      .order('transaction_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1)
      .abortSignal(signal),
    hasTransactionsUpdatedAfter: async (userId, snapshotAt, signal) => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .gt('updated_at', snapshotAt)
        .limit(1)
        .abortSignal(signal)
      return { data, error }
    },
    hasAccountsUpdatedAfter: async (userId, snapshotAt, signal) => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .gt('updated_at', snapshotAt)
        .limit(1)
        .abortSignal(signal)
      return { data, error }
    },
  })

  if (result.status === 'unauthorized') return privateNoStore(apiUnauthorized())
  if (result.status === 'timeout') {
    return privateNoStore(NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: SAFE_READ_ERROR } },
      { status: 503 },
    ))
  }
  if (result.status === 'error') {
    return privateNoStore(apiError({ code: 'DATABASE_ERROR', message: SAFE_READ_ERROR }))
  }

  return privateNoStore(apiOk({ histories: result.histories }))
}
