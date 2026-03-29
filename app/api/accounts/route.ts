// =============================================================================
// app/api/accounts/route.ts
// GET  /api/accounts   — lista cuentas (activas por defecto)
// POST /api/accounts   — crea cuenta/banco en portafolio
// =============================================================================

import { NextRequest }                from 'next/server'
import { z }                          from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase.server'
import {
  apiCreated,
  apiError,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
}                                     from '@/lib/api/response'

const zAccountType = z.enum([
  'CHECKING',
  'SAVINGS',
  'CASH',
  'INVESTMENT',
  'CREDIT_CARD',
  'OTHER',
])

const zCurrency = z.enum(['PEN', 'USD'])

const zCreateAccountSchema = z.object({
  name:                 z.string().trim().min(2).max(100),
  institution:          z.string().trim().max(120).optional().nullable(),
  type:                 zAccountType.default('CHECKING'),
  currency:             zCurrency.default('PEN'),
  initial_balance:      z.number().min(-1_000_000_000).max(1_000_000_000).default(0),
  include_in_net_worth: z.boolean().default(true),
  color:                z.string().trim().min(4).max(20).default('#10b981'),
  icon:                 z.string().trim().min(1).max(40).default('wallet'),
  notes:                z.string().trim().max(500).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true'

  let query = supabase
    .from('accounts')
    .select('id, name, institution, type, currency, balance, initial_balance, color, icon, include_in_net_worth, is_active, notes, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return apiUnauthorized()
  const userId = user.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zCreateAccountSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const payload = parsed.data

  const insertAccount = () => supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: payload.name,
      institution: payload.institution ?? null,
      type: payload.type,
      currency: payload.currency,
      initial_balance: payload.initial_balance,
      balance: payload.initial_balance,
      include_in_net_worth: payload.include_in_net_worth,
      color: payload.color,
      icon: payload.icon,
      notes: payload.notes ?? null,
      is_active: true,
    })
    .select('id, name, institution, type, currency, balance, initial_balance, color, icon, include_in_net_worth, is_active, notes, created_at, updated_at')
    .single()

  let { data, error } = await insertAccount()

  // Fallback defensivo: si el perfil aún no existe (p.ej. usuario creado antes
  // de aplicar trigger/migraciones), lo crea y reintenta 1 vez.
  if (
    error &&
    (
      error.code === '23503' ||
      error.message.includes('accounts_user_id_fkey')
    )
  ) {
    const service = createServiceClient()
    const { error: profileError } = await service
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email ?? `${user.id}@local.fintrack`,
        full_name: (user.user_metadata?.full_name as string | undefined)
          ?? (user.email ? user.email.split('@')[0] : 'Usuario'),
        avatar_url: typeof user.user_metadata?.avatar_url === 'string'
          ? user.user_metadata.avatar_url
          : null,
      }, { onConflict: 'id' })

    if (profileError) {
      return apiError({ code: 'DATABASE_ERROR', message: profileError.message })
    }

    const retried = await insertAccount()
    data = retried.data
    error = retried.error
  }

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiCreated(data)
}
