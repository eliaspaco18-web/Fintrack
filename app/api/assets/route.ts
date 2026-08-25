// =============================================================================
// app/api/assets/route.ts
// PRD v3 — Módulo 5: Activos
// GET:  lista con filtros (search, asset_type_id, date_from, date_to, status)
// POST: crear activo → registra también una transacción EXPENSE (egreso)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'
import { resolveAccountingUsdPenExchangeRate } from '@/lib/server/exchange-rate'
import {
  ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
  hasUnsupportedAttachmentWrite,
} from '@/modules/attachments/attachment-integrity'

const ASSET_STATUSES = ['ACTIVE', 'SOLD', 'DEPRECIATED'] as const
type AssetStatus = (typeof ASSET_STATUSES)[number]

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 }
    )
  }

  const p             = req.nextUrl.searchParams
  const search        = p.get('search')?.trim()
  const assetTypeId   = p.get('asset_type_id')
  const dateFrom      = p.get('date_from')
  const dateTo        = p.get('date_to')
  const statusParam   = p.get('status')
  const statusFilter: AssetStatus | undefined = ASSET_STATUSES.find(
    (status) => status === statusParam
  )

  let query = supabase
    .from('assets')
    .select('*, asset_type_info:asset_types(id, name, color, icon)')
    .eq('user_id', userId)
    .order('purchase_date', { ascending: false })

  if (statusParam && !statusFilter) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Parámetro status inválido' } },
      { status: 422 }
    )
  }

  if (statusFilter) query = query.eq('status', statusFilter)
  if (assetTypeId) query = query.eq('asset_type_id', assetTypeId)
  if (dateFrom)    query = query.gte('purchase_date', dateFrom)
  if (dateTo)      query = query.lte('purchase_date', dateTo)
  if (search)      query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: error.message } },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true, data: data ?? [] })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 }
    )
  }

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'Cuerpo inválido' } },
      { status: 400 }
    )
  }

  if (hasUnsupportedAttachmentWrite(body)) {
    return NextResponse.json(
      { ok: false, error: { code: 'BUSINESS_RULE_ERROR', message: ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE } },
      { status: 422 },
    )
  }

  // ── Campos requeridos (PRD)
  const name          = typeof body.name === 'string' ? body.name.trim() : ''
  const account_id    = typeof body.account_id === 'string' ? body.account_id : ''
  const asset_type_id = typeof body.asset_type_id === 'string' ? body.asset_type_id : null
  const purchase_date = typeof body.purchase_date === 'string' ? body.purchase_date : ''
  const purchase_value= typeof body.purchase_value === 'number' ? body.purchase_value : 0
  const currency      = typeof body.currency === 'string' ? body.currency : 'PEN'
  const description   = typeof body.description === 'string' ? body.description.trim() : ''
  const recipient     = typeof body.recipient === 'string' ? body.recipient.trim() || null : null
  const notes         = typeof body.notes === 'string' ? body.notes.trim() || null : null

  if (!name)           return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'El nombre es obligatorio' } }, { status: 422 })
  if (!account_id)     return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'El portafolio es obligatorio' } }, { status: 422 })
  if (!purchase_date)  return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'La fecha es obligatoria' } }, { status: 422 })
  if (purchase_value <= 0) return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'El monto debe ser mayor a 0' } }, { status: 422 })
  if (currency !== 'PEN' && currency !== 'USD') {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'La moneda debe ser PEN o USD' } },
      { status: 422 }
    )
  }

  const exchangeSnapshot = await resolveAccountingUsdPenExchangeRate({
    date: purchase_date,
    allowPrior: true,
    ensureForToday: true,
  })
  const exchangeRate = Number(exchangeSnapshot.rate)
  const amountPen = currency === 'USD'
    ? Math.round((purchase_value * exchangeRate) * 100) / 100
    : purchase_value

  // ── 1. Crear la transacción EXPENSE en la cuenta portafolio
  const txDescription = description || `Compra de activo: ${name}`
  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'EXPENSE',
      amount: purchase_value,
      amount_pen: amountPen,
      currency,
      exchange_rate: exchangeRate,
      description: txDescription,
      transaction_date: purchase_date,
      source_account_id: account_id,
      notes,
      recipient,
    })
    .select('id')
    .single()

  if (txError || !txData) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: txError?.message ?? 'Error creando transacción' } },
      { status: 500 }
    )
  }

  // ── 2. Crear el registro de activo vinculado a la transacción
  const { data: assetData, error: assetError } = await supabase
    .from('assets')
    .insert({
      user_id: userId,
      name,
      asset_type_id: asset_type_id || null,
      asset_type: 'OTHER',          // legacy enum — asset_type_id es el campo v3
      purchase_date,
      purchase_value,
      current_value: purchase_value, // empieza igual al valor de compra
      currency,
      recipient,
      notes,
      status: 'ACTIVE',
      transaction_id: txData.id,
    })
    .select('*')
    .single()

  if (assetError || !assetData) {
    // Rollback: eliminar la transacción si el activo falla
    await supabase.from('transactions').delete().eq('id', txData.id)
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: assetError?.message ?? 'Error creando activo' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, data: assetData }, { status: 201 })
}
