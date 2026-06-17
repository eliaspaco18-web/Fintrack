import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { getSessionUserId } from '@/lib/api/response'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 },
    )
  }

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      type,
      amount,
      currency,
      description,
      notes,
      transaction_date,
      created_at,
      source_account:accounts!source_account_id(id, name, color, icon),
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('creditor_id', params.id)
    .in('type', ['INCOME', 'EXPENSE'])
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, data: data ?? [] })
}
