// =============================================================================
// app/api/bank-entities/[id]/route.ts
// PATCH  /api/bank-entities/:id  — actualiza entidad bancaria
// DELETE /api/bank-entities/:id  — elimina entidad bancaria (si no rompe registros)
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import { createAppNotification } from '@/lib/server/app-notifications'
import {
  bankEntityConflicts,
  normalizeCatalogCode,
  normalizeCountryCode,
} from '@/lib/catalog/catalog-normalization'
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

const zUpdateBankEntitySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  short_name: z.string().trim().min(2).max(40).nullable().optional(),
  code: z.string().trim().min(2).max(20).nullable().optional(),
  country: z.string().trim().min(2).max(3).optional(),
  color: z.string().trim().min(4).max(20).optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  is_active: z.boolean().optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'No hay campos para actualizar' },
)

interface Params {
  params: { id: string }
}

function bankFeatureUnavailable() {
  const unavailable = migrationUnavailableMessage('El módulo de entidades bancarias')
  return apiError({
    code: 'BUSINESS_RULE_ERROR',
    message: unavailable.message,
    detail: unavailable.detail,
  })
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

  const parsed = zUpdateBankEntitySchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { data: current, error: currentError } = await supabase
    .from('bank_entities')
    .select('id, user_id, name, short_name, code, country, color, icon, is_active, created_at, updated_at')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (currentError) {
    if (isBankEntitiesFeatureMissing(currentError)) return bankFeatureUnavailable()
    return apiError({ code: 'DATABASE_ERROR', message: currentError.message })
  }
  if (!current) {
    return apiError({ code: 'NOT_FOUND', message: 'Entidad bancaria no encontrada' })
  }

  const nextState = {
    ...current,
    ...parsed.data,
    short_name: parsed.data.short_name ?? current.short_name,
    code: parsed.data.code !== undefined
      ? (parsed.data.code ? normalizeCatalogCode(parsed.data.code) : null)
      : current.code,
    country: parsed.data.country !== undefined
      ? normalizeCountryCode(parsed.data.country)
      : current.country,
  }

  const { data: existingBankEntities, error: existingBankEntitiesError } = await supabase
    .from('bank_entities')
    .select('id, name, short_name, code, country, is_active, user_id, created_at, updated_at')
    .eq('user_id', userId)
    .neq('id', params.id)

  if (existingBankEntitiesError) {
    if (isBankEntitiesFeatureMissing(existingBankEntitiesError)) return bankFeatureUnavailable()
    return apiError({ code: 'DATABASE_ERROR', message: existingBankEntitiesError.message })
  }

  const duplicatedBankEntity = (existingBankEntities ?? []).find(entity =>
    bankEntityConflicts(entity, nextState),
  )

  if (duplicatedBankEntity) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Ya tienes una entidad bancaria equivalente registrada para ese país.',
      detail: 'Ajusta el nombre, alias o código antes de guardar.',
    })
  }

  const payload = {
    ...parsed.data,
    code: parsed.data.code !== undefined
      ? (parsed.data.code ? normalizeCatalogCode(parsed.data.code) : null)
      : undefined,
    country: parsed.data.country !== undefined
      ? normalizeCountryCode(parsed.data.country)
      : undefined,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('bank_entities')
    .update(payload)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select('id, name, short_name, code, country, color, icon, is_active, created_at, updated_at')
    .single()

  if (error) {
    if (isBankEntitiesFeatureMissing(error)) return bankFeatureUnavailable()
    if (error.code === '23505') {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'Ya tienes una entidad bancaria con ese nombre.',
      })
    }
    return apiError({ code: 'DATABASE_ERROR', message: error.message })
  }

  // Si cambió el nombre, mantenemos sincronizada la etiqueta institucional en cuentas.
  if (parsed.data.name && parsed.data.name !== current.name) {
    await supabase
      .from('accounts')
      .update({
        institution: parsed.data.name,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('bank_entity_id', params.id)
  }

  await createAppNotification(supabase, {
    userId,
    category: 'BANK',
    event: 'BANK_ENTITY_UPDATED',
    title: 'Entidad bancaria actualizada',
    message: `${data.name} fue actualizada correctamente.`,
    href: '/admin',
    context: { bank_entity_id: data.id, bank_entity_name: data.name },
  })

  return apiOk(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: bank, error: bankError } = await supabase
    .from('bank_entities')
    .select('id, name')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (bankError) {
    if (isBankEntitiesFeatureMissing(bankError)) return bankFeatureUnavailable()
    return apiError({ code: 'DATABASE_ERROR', message: bankError.message })
  }
  if (!bank) {
    return apiError({ code: 'NOT_FOUND', message: 'Entidad bancaria no encontrada' })
  }

  const { data: linkedAccounts, error: linkedError } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('bank_entity_id', params.id)

  if (linkedError) {
    if (isBankEntitiesFeatureMissing(linkedError)) return bankFeatureUnavailable()
    return apiError({ code: 'DATABASE_ERROR', message: linkedError.message })
  }

  const accountIds = (linkedAccounts ?? []).map(item => item.id)

  if (accountIds.length > 0) {
    const ids = accountIds.join(',')
    const [{ count: txCount }, { count: creditCount }] = await Promise.all([
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .or(`source_account_id.in.(${ids}),destination_account_id.in.(${ids})`),
      supabase
        .from('credits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('account_id', accountIds),
    ])

    const blockers = (txCount ?? 0) + (creditCount ?? 0)
    if (blockers > 0) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'No puedes eliminar esta entidad bancaria porque afecta registros existentes.',
        detail: 'Hay cuentas vinculadas con transacciones o créditos. Reasigna esas cuentas antes de eliminarla.',
      })
    }
  }

  const { error: deleteError } = await supabase
    .from('bank_entities')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (deleteError) {
    if (isBankEntitiesFeatureMissing(deleteError)) return bankFeatureUnavailable()
    return apiError({ code: 'DATABASE_ERROR', message: deleteError.message })
  }

  await createAppNotification(supabase, {
    userId,
    category: 'BANK',
    event: 'BANK_ENTITY_DELETED',
    title: 'Entidad bancaria eliminada',
    message: `${bank.name} fue removida del catálogo.`,
    href: '/admin',
    context: { bank_entity_id: bank.id, bank_entity_name: bank.name },
  })

  return apiNoContent()
}
