// =============================================================================
// app/api/accounts/[id]/route.ts
// PATCH  /api/accounts/:id  — actualiza cuenta
// DELETE /api/accounts/:id  — elimina cuenta
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import { createAppNotification } from '@/lib/server/app-notifications'
import {
  isBankEntitiesFeatureMissing,
  migrationUnavailableMessage,
} from '@/lib/server/supabase-errors'
import {
  apiError,
  apiNoContent,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'

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

const zUpdateAccountSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  institution: z.string().trim().max(120).nullable().optional(),
  bank_entity_id: z.string().uuid().nullable().optional(),
  type: zAccountType.optional(),
  currency: zCurrency.optional(),
  initial_balance: z.number().min(-1_000_000_000).max(1_000_000_000).optional(),
  initial_balance_date: zDate.optional(),
  include_in_net_worth: z.boolean().optional(),
  color: z.string().trim().min(4).max(20).optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'No hay campos para actualizar' }
)

const ACCOUNT_SELECT_BASE =
  'id,name,institution,type,currency,balance,initial_balance,initial_balance_date,color,icon,include_in_net_worth,is_active,notes,created_at,updated_at' as const

const ACCOUNT_SELECT_WITH_BANK_ID =
  'id,name,institution,bank_entity_id,type,currency,balance,initial_balance,initial_balance_date,color,icon,include_in_net_worth,is_active,notes,created_at,updated_at' as const

const ACCOUNT_SELECT_WITH_BANK =
  `${ACCOUNT_SELECT_WITH_BANK_ID},bank_entity:bank_entities(id,name,short_name,color,icon,is_active)` as const

interface Params {
  params: { id: string }
}

const ACCOUNT_LINKED_RECORDS_MESSAGE =
  'Esta cuenta participa en transacciones o creditos. Reasigna esos registros antes de continuar.'

async function getEarliestAccountTransactionDate(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  accountId: string,
) {
  const { data, error } = await supabase
    .from('transactions')
    .select('transaction_date')
    .eq('user_id', userId)
    .or(`source_account_id.eq.${accountId},destination_account_id.eq.${accountId}`)
    .order('transaction_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    data: data?.transaction_date ?? null,
    error,
  }
}

async function getAccountBlockers(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  accountId: string,
) {
  const [{ count: txCount }, { count: creditCount }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .or(`source_account_id.eq.${accountId},destination_account_id.eq.${accountId}`),
    supabase
      .from('credits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('account_id', accountId),
  ])

  return (txCount ?? 0) + (creditCount ?? 0)
}

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

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zUpdateAccountSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const payload = parsed.data
  const updatesOpeningBalance =
    Object.prototype.hasOwnProperty.call(payload, 'initial_balance')
    || Object.prototype.hasOwnProperty.call(payload, 'initial_balance_date')
  const includesBankEntityField = Object.prototype.hasOwnProperty.call(payload, 'bank_entity_id')
  let resolvedInstitution = payload.institution

  const { data: existingAccount, error: existingAccountError } = await supabase
    .from('accounts')
    .select('id, name, balance, initial_balance, initial_balance_date, created_at')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (existingAccountError || !existingAccount) {
    return apiError({ code: 'NOT_FOUND', message: 'Cuenta no encontrada' })
  }

  if (payload.bank_entity_id !== undefined && payload.bank_entity_id !== null) {
    const { data: bank, error: bankError } = await supabase
      .from('bank_entities')
      .select('id, name, is_active')
      .eq('id', payload.bank_entity_id)
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
        message: 'No puedes asignar una entidad bancaria inactiva.',
      })
    }

    if (resolvedInstitution === undefined || resolvedInstitution === null || resolvedInstitution.trim().length === 0) {
      resolvedInstitution = bank.name
    }
  }

  if (payload.is_active === false) {
    const blockers = await getAccountBlockers(supabase, userId, params.id)
    if (blockers > 0) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'No puedes desactivar esta cuenta porque tiene registros vinculados.',
        detail: ACCOUNT_LINKED_RECORDS_MESSAGE,
      })
    }
  }

  const baseUpdateData: Record<string, unknown> = {
    ...payload,
    institution: resolvedInstitution,
    updated_at: new Date().toISOString(),
  }

  if (updatesOpeningBalance) {
    const nextInitialBalance = payload.initial_balance ?? Number(existingAccount.initial_balance ?? 0)
    const fallbackDate = String(existingAccount.created_at ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
    const nextInitialBalanceDate =
      payload.initial_balance_date
      ?? existingAccount.initial_balance_date
      ?? fallbackDate

    const earliestTransaction = await getEarliestAccountTransactionDate(supabase, userId, params.id)
    if (earliestTransaction.error) {
      return apiError({ code: 'DATABASE_ERROR', message: earliestTransaction.error.message })
    }

    if (earliestTransaction.data && nextInitialBalanceDate > earliestTransaction.data) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'La fecha del saldo inicial no puede quedar después del primer movimiento.',
        detail: `El primer movimiento registrado en esta cuenta es ${earliestTransaction.data}.`,
      })
    }

    const previousInitialBalance = Number(existingAccount.initial_balance ?? 0)
    const currentBalance = Number(existingAccount.balance ?? 0)
    const delta = nextInitialBalance - previousInitialBalance

    baseUpdateData.initial_balance = nextInitialBalance
    baseUpdateData.initial_balance_date = nextInitialBalanceDate
    if (delta !== 0) {
      baseUpdateData.balance = currentBalance + delta
    }
  }

  const runUpdate = (includeBankFeature: boolean, updateData: Record<string, unknown>) => {
    if (includeBankFeature) {
      return supabase
        .from('accounts')
        .update(updateData)
        .eq('id', params.id)
        .eq('user_id', userId)
        .select(ACCOUNT_SELECT_WITH_BANK_ID)
        .single()
    }

    return supabase
      .from('accounts')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', userId)
      .select(ACCOUNT_SELECT_BASE)
      .single()
  }

  let useBankFeature = true
  let { data, error } = await runUpdate(useBankFeature, baseUpdateData)

  if (error && isBankEntitiesFeatureMissing(error)) {
    if (includesBankEntityField) return accountFeatureUnavailable()
    useBankFeature = false
    const fallbackUpdateData = { ...baseUpdateData }
    delete fallbackUpdateData.bank_entity_id
    const fallback = await runUpdate(false, fallbackUpdateData)
    data = fallback.data
    error = fallback.error
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
    event: 'ACCOUNT_UPDATED',
    title: 'Cuenta actualizada',
    message: `${data?.name ?? 'La cuenta'} fue actualizada correctamente.`,
    href: '/portfolio',
    context: { account_id: data?.id, account_name: data?.name },
  })

  return apiOk(responseData)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, name, is_active')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return apiError({ code: 'NOT_FOUND', message: 'Cuenta no encontrada' })
  }

  const blockers = await getAccountBlockers(supabase, userId, params.id)
  if (blockers > 0) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'No puedes eliminar esta cuenta porque tiene registros vinculados.',
      detail: ACCOUNT_LINKED_RECORDS_MESSAGE,
    })
  }

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  await createAppNotification(supabase, {
    userId,
    category: 'PORTFOLIO',
    event: 'ACCOUNT_DELETED',
    title: 'Cuenta eliminada',
    message: `${account.name} fue eliminada del portafolio.`,
    href: '/portfolio',
    context: { account_id: account.id, account_name: account.name },
  })

  return apiNoContent()
}
