// app/api/assets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  const statusParam = req.nextUrl.searchParams.get('status')
  const allowedStatus = ['ACTIVE', 'SOLD', 'DEPRECIATED'] as const
  const status = allowedStatus.find(v => v === statusParam)

  if (statusParam && !status) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Parámetro status inválido' } },
      { status: 422 }
    )
  }

  let query = supabase.from('assets').select('*').eq('user_id', userId).order('purchase_date', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ ok: true, data: data ?? [] })
}
