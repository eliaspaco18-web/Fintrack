// =============================================================================
// app/api/accounts/route.ts
// GET  /api/accounts   — lista cuentas (activas por defecto)
// POST /api/accounts   — crea cuenta/banco en portafolio
// =============================================================================

import { NextRequest }                from 'next/server'
import { z }                          from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase.server'
import { createAppNotification }      from '@/lib/server/app-notifications'
import {
  isBankEntitiesFeatureMissing,
  migrationUnavailableMessage,
}                                     from '@/lib/server/supabase-errors'
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
  'STOCKS',
  'ETF',
  'CRYPTO',
  'OTHER',
])

const zCurrency = z.string().trim().min(2).max(10).transform(value => value.toUpperCase())
const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')

const zCreateAccountSchema = z.object({
  name:                 z.string().trim().min(2).max(100),
  institution:          z.string().trim().max(120).optional().nullable(),
  bank_entity_id:       z.string().uuid().optional().nullable(),
  type:                 zAccountType.default('CHECKING'),
  currency:             zCurrency.default('PEN'),
  initial_balance:      z.number().min(-1_000_000_000).max(1_000_000_000).default(0),
  initial_balance_date: zDate.optional(),
  include_in_net_worth: z.boolean().default(true),
  color:                z.string().trim().min(4).max(20).default('#10b981'),
  icon:                 z.string().trim().min(1).max(40).default('wallet'),
  notes:                z.string().trim().max(500).optional().nullable(),
})

const ACCOUNT_SELECT_BASE =
  'id,name,institution,type,currency,balance,initial_balance,initial_balance_date,color,icon,include_in_net_worth,is_active,notes,created_at,updated_at' as const

const ACCOUNT_SELECT_WITH_BANK_ID =
  'id,name,institution,bank_entity_id,type,currency,balance,initial_balance,initial_balance_date,color,icon,include_in_net_worth,is_active,notes,created_at,updated_at' as const

const ACCOUNT_SELECT_WITH_BANK =
  `${ACCOUNT_SELECT_WITH_BANK_ID},bank_entity:bank_entities(id,name,short_name,color,icon,is_active)` as const

function accountFeatureUnavailable() {
  const unavailable = migrationUnavailableMessage('La integración de entidades bancarias')
  return apiError({
    code: 'BUSINESS_RULE_ERROR',
    message: unavailable.message,
    detail: unavailable.detail,
  })
}

function normalizeLegacyAccount<T extends Record<string, unknown>>(account: T) {
  return {
    ...account,
    bank_entity_id: null,
    bank_entity: null,
  }
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true'

  let useBankFeature = true
  let withBankQuery = supabase
    .from('accounts')
    .select(ACCOUNT_SELECT_WITH_BANK)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!includeInactive) {
    withBankQuery = withBankQuery.eq('is_active', true)
  }

  const withBankResult = await withBankQuery
  let data: Array<Record<string, unknown>> | null = withBankResult.data as Array<Record<string, unknown>> | null
  let error = withBankResult.error

  if (error && isBankEntitiesFeatureMissing(error)) {
    useBankFeature = false
    let fallbackQuery = supabase
      .from('accounts')
      .select(ACCOUNT_SELECT_BASE)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!includeInactive) {
      fallbackQuery = fallbackQuery.eq('is_active', true)
    }

    const fallback = await fallbackQuery
    data = fallback.data as Array<Record<string, unknown>> | null
    error = fallback.error
  }

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  const normalized = (data ?? []).map(item =>
    useBankFeature
      ? item
      : normalizeLegacyAccount(item as unknown as Record<string, unknown>)
  )

  return apiOk(normalized)
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
  const initialBalanceDate = payload.initial_balance_date ?? new Date().toISOString().slice(0, 10)
  let resolvedInstitution = payload.institution ?? null
  let resolvedBankEntityId = payload.bank_entity_id ?? null
  let useBankFeature = true

  if (resolvedBankEntityId) {
    const { data: bank, error: bankError } = await supabase
      .from('bank_entities')
      .select('id, name, is_active')
      .eq('id', resolvedBankEntityId)
      .eq('user_id', userId)
      .single()

    if (bankError) {
      if (isBankEntitiesFeatureMissing(bankError)) return accountFeatureUnavailable()
      return apiError({ code: 'DATABASE_ERROR', message: bankError.message })
    }

    if (!bank) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'La entidad bancaria seleccionada no existe o no te pertenece.',
      })
    }

    if (!bank.is_active) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'No puedes usar una entidad bancaria inactiva.',
      })
    }

    if (!resolvedInstitution) {
      resolvedInstitution = bank.name
    }
  }

  const insertAccount = (includeBankFeature: boolean) => {
    if (includeBankFeature) {
      return supabase
        .from('accounts')
        .insert({
          user_id: userId,
          name: payload.name,
          institution: resolvedInstitution,
          bank_entity_id: resolvedBankEntityId,
          type: payload.type,
          currency: payload.currency,
          initial_balance: payload.initial_balance,
          initial_balance_date: initialBalanceDate,
          balance: payload.initial_balance,
          include_in_net_worth: payload.include_in_net_worth,
          color: payload.color,
          icon: payload.icon,
          notes: payload.notes ?? null,
          is_active: true,
        })
        .select(ACCOUNT_SELECT_WITH_BANK_ID)
        .single()
    }

    return supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name: payload.name,
        institution: resolvedInstitution,
        type: payload.type,
        currency: payload.currency,
        initial_balance: payload.initial_balance,
        initial_balance_date: initialBalanceDate,
        balance: payload.initial_balance,
        include_in_net_worth: payload.include_in_net_worth,
        color: payload.color,
        icon: payload.icon,
        notes: payload.notes ?? null,
        is_active: true,
      })
      .select(ACCOUNT_SELECT_BASE)
      .single()
  }

  let { data, error } = await insertAccount(useBankFeature)

  if (error && isBankEntitiesFeatureMissing(error)) {
    if (resolvedBankEntityId) return accountFeatureUnavailable()
    useBankFeature = false
    const fallback = await insertAccount(false)
    data = fallback.data
    error = fallback.error
  }

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

    const retried = await insertAccount(useBankFeature)
    data = retried.data
    error = retried.error

    if (error && isBankEntitiesFeatureMissing(error)) {
      if (resolvedBankEntityId) return accountFeatureUnavailable()
      useBankFeature = false
      const fallbackRetry = await insertAccount(false)
      data = fallbackRetry.data
      error = fallbackRetry.error
    }
  }

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  const responseData = useBankFeature
    ? {
      ...((data ?? {}) as Record<string, unknown>),
      bank_entity: ((data as Record<string, unknown> | null)?.bank_entity ?? null) as Record<string, unknown> | null,
    }
    : normalizeLegacyAccount((data ?? {}) as Record<string, unknown>)

  await createAppNotification(supabase, {
    userId,
    category: 'PORTFOLIO',
    event: 'ACCOUNT_CREATED',
    title: 'Cuenta registrada',
    message: `${payload.name} quedó disponible en tu portafolio.`,
    href: '/portfolio',
    context: {
      account_id: data?.id,
      account_name: payload.name,
      bank_entity_id: resolvedBankEntityId,
    },
  })

  return apiCreated(responseData)
}
