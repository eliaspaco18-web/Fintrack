// =============================================================================
// app/api/profile/export/route.ts
// Exporta las transacciones del usuario como CSV.
// =============================================================================

import { createClient } from '@/lib/supabase.server'
import { apiUnauthorized } from '@/lib/api/response'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiUnauthorized()

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      id,
      transaction_date,
      type,
      amount,
      currency,
      description,
      notes,
      created_at,
      source_account:accounts!source_account_id(name),
      category:categories(name)
    `)
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .limit(10000)

  if (error) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 })
  }

  // Build CSV
  const headers = [
    'ID', 'Fecha', 'Tipo', 'Monto', 'Moneda',
    'Descripción', 'Notas', 'Cuenta', 'Categoría', 'Creado',
  ]

  const rows = (transactions ?? []).map((t) => {
    const account = (t.source_account as { name?: string } | null)?.name ?? ''
    const category = (t.category as { name?: string } | null)?.name ?? ''
    return [
      t.id,
      t.transaction_date,
      t.type,
      t.amount,
      t.currency,
      `"${(t.description ?? '').replace(/"/g, '""')}"`,
      `"${(t.notes ?? '').replace(/"/g, '""')}"`,
      `"${account.replace(/"/g, '""')}"`,
      `"${category.replace(/"/g, '""')}"`,
      t.created_at,
    ].join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')
  const filename = `fintrack-transacciones-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
