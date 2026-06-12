// =============================================================================
// app/api/bank-entities/route.ts
// GET  /api/bank-entities  — lista entidades bancarias del usuario
// POST /api/bank-entities  — crea entidad bancaria
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import { createAppNotification } from '@/lib/server/app-notifications'
import {
  bankEntityConflicts,
  dedupeBankEntities,
  normalizeCatalogCode,
  normalizeCountryCode,
} from '@/lib/catalog/catalog-normalization'
import {
  isBankEntitiesFeatureMissing,
  migrationUnavailableMessage,
} from '@/lib/server/supabase-errors'
import {
  apiCreated,
  apiError,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'

const zCreateBankEntitySchema = z.object({
  name: z.string().trim().min(2).max(120),
  short_name: z.string().trim().min(2).max(40).optional().nullable(),
  code: z.string().trim().min(2).max(20).optional().nullable(),
  country: z.string().trim().min(2).max(3).default('PE'),
  color: z.string().trim().min(4).max(20).default('#0ea5e9'),
  icon: z.string().trim().min(1).max(512).default('bank'),
  is_active: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true'
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  let query = supabase
    .from('bank_entities')
    .select('id, name, short_name, code, country, color, icon, is_active, created_at, updated_at')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (!includeInactive) query = query.eq('is_active', true)
  if (q.length >= 2) query = query.or(`name.ilike.%${q}%,short_name.ilike.%${q}%,code.ilike.%${q}%`)

  const { data, error } = await query
  if (error) {
    if (isBankEntitiesFeatureMissing(error)) {
      return apiOk([])
    }
    return apiError({ code: 'DATABASE_ERROR', message: error.message })
  }
  return apiOk(dedupeBankEntities(data ?? []))
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zCreateBankEntitySchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const payload = parsed.data
  const normalizedPayload = {
    ...payload,
    code: payload.code ? normalizeCatalogCode(payload.code) : null,
    country: normalizeCountryCode(payload.country),
  }

  const { data: existingBankEntities, error: existingBankEntitiesError } = await supabase
    .from('bank_entities')
    .select('id, name, short_name, code, country, is_active, user_id, created_at, updated_at')
    .eq('user_id', userId)

  if (existingBankEntitiesError) {
    if (isBankEntitiesFeatureMissing(existingBankEntitiesError)) {
      const unavailable = migrationUnavailableMessage('El módulo de entidades bancarias')
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: unavailable.message,
        detail: unavailable.detail,
      })
    }
    return apiError({ code: 'DATABASE_ERROR', message: existingBankEntitiesError.message })
  }

  const duplicatedBankEntity = (existingBankEntities ?? []).find(entity =>
    bankEntityConflicts(entity, {
      ...normalizedPayload,
      short_name: payload.short_name ?? null,
      is_active: payload.is_active,
      user_id: userId,
      created_at: null,
      updated_at: null,
    }),
  )

  if (duplicatedBankEntity) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Ya tienes una entidad bancaria equivalente registrada para ese país.',
      detail: 'Revisa el nombre, alias o código antes de volver a crearla.',
    })
  }

  const { data, error } = await supabase
    .from('bank_entities')
    .insert({
      user_id: userId,
      name: payload.name,
      short_name: payload.short_name ?? null,
      code: normalizedPayload.code,
      country: normalizedPayload.country,
      color: payload.color,
      icon: payload.icon,
      is_active: payload.is_active,
    })
    .select('id, name, short_name, code, country, color, icon, is_active, created_at, updated_at')
    .single()

  if (error) {
    if (isBankEntitiesFeatureMissing(error)) {
      const unavailable = migrationUnavailableMessage('El módulo de entidades bancarias')
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: unavailable.message,
        detail: unavailable.detail,
      })
    }
    if (error.code === '23505') {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'Ya tienes una entidad bancaria con ese nombre.',
      })
    }
    return apiError({ code: 'DATABASE_ERROR', message: error.message })
  }

  await createAppNotification(supabase, {
    userId,
    category: 'BANK',
    event: 'BANK_ENTITY_CREATED',
    title: 'Entidad bancaria registrada',
    message: `${data.name} fue agregada a tu catálogo.`,
    href: '/admin',
    context: { bank_entity_id: data.id, bank_entity_name: data.name },
  })

  return apiCreated(data)
}
