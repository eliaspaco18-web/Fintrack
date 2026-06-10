// =============================================================================
// app/api/recurring/route.ts
// PRD v3 — Módulo 11: Transacciones Recurrentes — GET (lista) + POST (crear)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'
import type { Database }             from '@/types/database.types'

// Tipos expuestos por UI (incluye shortcuts de módulos por cobrar/pagar)
const ALLOWED_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER', 'RECEIVABLE', 'PAYABLE'] as const
type RecurringType = (typeof ALLOWED_TYPES)[number]
type TransactionType = Database['public']['Enums']['transaction_type']
type TransactionSubType = Database['public']['Enums']['transaction_sub_type']

function mapRecurringTypeToDb(type: RecurringType): {
  dbType: TransactionType
  dbSubType: TransactionSubType | null
} {
  if (type === 'RECEIVABLE') {
    return { dbType: 'EXPENSE', dbSubType: 'RECEIVABLE_LENDING' }
  }
  if (type === 'PAYABLE') {
    return { dbType: 'INCOME', dbSubType: 'PAYABLE_PAYMENT' }
  }
  return { dbType: type, dbSubType: null }
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 }
    )
  }

  const typeParam      = req.nextUrl.searchParams.get('type')
  const portfolioId    = req.nextUrl.searchParams.get('portfolio_id')
  const search         = req.nextUrl.searchParams.get('search')?.trim() ?? ''

  // Validar type si se proporciona
  const type = ALLOWED_TYPES.find(v => v === typeParam) as RecurringType | undefined
  if (typeParam && !type) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Parámetro type inválido' } },
      { status: 422 }
    )
  }

  let query = supabase
    .from('recurring_transactions')
    .select(`
      *,
      source_account:accounts!recurring_transactions_source_account_id_fkey(
        id, name, currency, type
      ),
      destination_account:accounts!recurring_transactions_destination_account_id_fkey(
        id, name, currency, type
      ),
      category:categories(id, name, color, icon)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (type) {
    const mapped = mapRecurringTypeToDb(type)
    query = query.eq('type', mapped.dbType)
    if (mapped.dbSubType) {
      query = query.eq('sub_type', mapped.dbSubType)
    } else if (type === 'INCOME' || type === 'EXPENSE') {
      query = query.is('sub_type', null)
    }
  }
  if (portfolioId) query = query.eq('source_account_id', portfolioId)
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

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 }
    )
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_REQUEST', message: 'Cuerpo inválido' } },
      { status: 400 }
    )
  }

  // Extracción y normalización de campos
  const name                   = typeof body.name === 'string'                   ? body.name.trim()                   : ''
  const type                   = typeof body.type === 'string'                   ? body.type                          : ''
  const sub_type               = typeof body.sub_type === 'string'               ? body.sub_type || null              : null
  const source_account_id      = typeof body.source_account_id === 'string'      ? body.source_account_id || null     : null
  const destination_account_id = typeof body.destination_account_id === 'string' ? body.destination_account_id || null : null
  const category_id            = typeof body.category_id === 'string'            ? body.category_id || null           : null
  const budget_id              = typeof body.budget_id === 'string'              ? body.budget_id || null             : null
  const debtor_id              = typeof body.debtor_id === 'string'              ? body.debtor_id || null             : null
  const creditor_id            = typeof body.creditor_id === 'string'            ? body.creditor_id || null           : null
  const amount                 = typeof body.amount === 'number'                 ? body.amount : Number(body.amount)
  const currency               = typeof body.currency === 'string'               ? body.currency : 'PEN'
  const description            = typeof body.description === 'string'            ? body.description.trim() || null    : null
  const payment_method         = typeof body.payment_method === 'string'         ? body.payment_method || null        : null
  const recipient              = typeof body.recipient === 'string'              ? body.recipient.trim() || null      : null
  const sender                 = typeof body.sender === 'string'                 ? body.sender.trim() || null         : null
  const notes                  = typeof body.notes === 'string'                  ? body.notes.trim() || null          : null

  // Validaciones
  if (!name) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'El nombre es obligatorio.' } },
      { status: 422 }
    )
  }
  if (!ALLOWED_TYPES.includes(type as RecurringType)) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'El tipo de operación es inválido.' } },
      { status: 422 }
    )
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'El monto debe ser mayor a 0.' } },
      { status: 422 }
    )
  }
  if (name.length > 150) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'El nombre no puede superar 150 caracteres.' } },
      { status: 422 }
    )
  }
  if (currency !== 'PEN' && currency !== 'USD') {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'La moneda es inválida.' } },
      { status: 422 }
    )
  }
  if (description && description.length > 255) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'La descripción no puede superar 255 caracteres.' } },
      { status: 422 }
    )
  }

  const normalizedType = type as RecurringType
  const mappedType = mapRecurringTypeToDb(normalizedType)
  const dbSubType = (sub_type as TransactionSubType | null) ?? mappedType.dbSubType

  if (normalizedType === 'TRANSFER') {
    if (!source_account_id || !destination_account_id) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'La transferencia recurrente requiere cuenta origen y destino.' } },
        { status: 422 }
      )
    }
    if (source_account_id === destination_account_id) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'La cuenta origen y destino no pueden ser la misma.' } },
        { status: 422 }
      )
    }
  } else if (!source_account_id) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'La cuenta principal es obligatoria para guardar la recurrente.' } },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({
      user_id: userId,
      name,
      type: mappedType.dbType,
      sub_type: dbSubType,
      source_account_id,
      destination_account_id,
      category_id,
      budget_id,
      debtor_id,
      creditor_id,
      amount,
      currency,
      description,
      payment_method,
      recipient,
      sender,
      notes,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, data }, { status: 201 })
}
