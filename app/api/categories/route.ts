// =============================================================================
// app/api/categories/route.ts
// GET  /api/categories   — lista categorías
// POST /api/categories   — crea categoría de usuario
// =============================================================================

import { NextRequest }                from 'next/server'
import { z }                          from 'zod'
import { createClient }               from '@/lib/supabase.server'
import {
  apiCreated,
  apiError,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
}                                     from '@/lib/api/response'

const zCategoryScope = z.enum(['INCOME', 'EXPENSE', 'BOTH'])

const zCreateCategorySchema = z.object({
  name:       z.string().trim().min(2).max(80),
  scope:      zCategoryScope.default('EXPENSE'),
  icon:       z.string().trim().min(1).max(20).default('tag'),
  color:      z.string().trim().min(4).max(20).default('#6b7280'),
  sort_order: z.number().int().min(0).max(10_000).default(100),
})

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const includeSystem = req.nextUrl.searchParams.get('include_system') !== 'false'

  let query = supabase
    .from('categories')
    .select('id, name, scope, icon, color, sort_order, is_system, user_id, system_key, created_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  query = includeSystem
    ? query.or(`user_id.eq.${userId},is_system.eq.true`)
    : query.eq('user_id', userId)

  const { data, error } = await query
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zCreateCategorySchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const payload = parsed.data

  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id:    userId,
      is_system:  false,
      system_key: null,
      name:       payload.name,
      scope:      payload.scope,
      icon:       payload.icon,
      color:      payload.color,
      sort_order: payload.sort_order,
    })
    .select('id, name, scope, icon, color, sort_order, is_system, user_id, system_key, created_at')
    .single()

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiCreated(data)
}
