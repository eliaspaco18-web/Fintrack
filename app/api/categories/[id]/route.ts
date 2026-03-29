// =============================================================================
// app/api/categories/[id]/route.ts
// PATCH  /api/categories/:id  — actualiza categoría propia
// DELETE /api/categories/:id  — elimina categoría propia
// =============================================================================

import { NextRequest }                from 'next/server'
import { z }                          from 'zod'
import { createClient }               from '@/lib/supabase.server'
import {
  apiError,
  apiNoContent,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
}                                     from '@/lib/api/response'

const zCategoryScope = z.enum(['INCOME', 'EXPENSE', 'BOTH'])

const zUpdateCategorySchema = z.object({
  name:       z.string().trim().min(2).max(80).optional(),
  scope:      zCategoryScope.optional(),
  icon:       z.string().trim().min(1).max(20).optional(),
  color:      z.string().trim().min(4).max(20).optional(),
  sort_order: z.number().int().min(0).max(10_000).optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'No hay campos para actualizar' }
)

interface Params {
  params: { id: string }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zUpdateCategorySchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { data, error } = await supabase
    .from('categories')
    .update(parsed.data)
    .eq('id', params.id)
    .eq('user_id', userId)
    .eq('is_system', false)
    .select('id, name, scope, icon, color, sort_order, is_system, user_id, system_key, created_at')
    .single()

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)
    .eq('is_system', false)

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiNoContent()
}
