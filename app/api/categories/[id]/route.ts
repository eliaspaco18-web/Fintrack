// =============================================================================
// app/api/categories/[id]/route.ts
// PATCH  /api/categories/:id  — actualiza categoría propia
// DELETE /api/categories/:id  — elimina categoría propia
// =============================================================================

import { NextRequest }                from 'next/server'
import { z }                          from 'zod'
import { createClient }               from '@/lib/supabase.server'
import { isLockedCategorySystemKey }  from '@/lib/constants/category-keys'
import {
  apiError,
  apiNoContent,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
}                                     from '@/lib/api/response'

const zCategoryScope = z.enum(['INCOME', 'EXPENSE'])
type CategoryScope = z.infer<typeof zCategoryScope>

function normalizeCategoryScope(scope: string): CategoryScope {
  return scope === 'INCOME' ? 'INCOME' : 'EXPENSE'
}

function normalizeCategoryKey(name: string, scope: CategoryScope): string {
  return `${scope}::${name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')}`
}

const zUpdateCategorySchema = z.object({
  name:       z.string().trim().min(2).max(80).optional(),
  scope:      zCategoryScope.optional(),
  icon:       z.string().trim().min(1).max(512).optional(),
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

  const { data: currentCategory, error: currentError } = await supabase
    .from('categories')
    .select('id, name, scope, is_system, user_id, system_key')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (currentError || !currentCategory) {
    return apiError({ code: 'DATABASE_ERROR', message: currentError?.message ?? 'Categoría no encontrada' })
  }

  if (currentCategory.is_system || currentCategory.user_id === null || isLockedCategorySystemKey(currentCategory.system_key)) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Esta categoría está protegida y no se puede editar.',
    })
  }

  const nextName = parsed.data.name ?? currentCategory.name
  const nextScope = parsed.data.scope ?? normalizeCategoryScope(currentCategory.scope)
  const normalizedKey = normalizeCategoryKey(nextName, nextScope)

  const { data: existingCategories, error: existingError } = await supabase
    .from('categories')
    .select('id, name, scope')
    .eq('user_id', userId)

  if (existingError) {
    return apiError({ code: 'DATABASE_ERROR', message: existingError.message })
  }

  const duplicateExists = (existingCategories ?? []).some(category =>
    category.id !== params.id && normalizeCategoryKey(category.name, normalizeCategoryScope(category.scope)) === normalizedKey
  )
  if (duplicateExists) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Ya existe una categoría con ese nombre para ese tipo.',
    })
  }

  const { data, error } = await supabase
    .from('categories')
    .update(parsed.data)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select('id, name, scope, icon, color, sort_order, is_system, user_id, system_key, created_at')
    .single()

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: currentCategory, error: currentError } = await supabase
    .from('categories')
    .select('id, is_system, user_id, system_key')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (currentError || !currentCategory) {
    return apiError({ code: 'DATABASE_ERROR', message: currentError?.message ?? 'Categoría no encontrada' })
  }

  if (currentCategory.is_system || currentCategory.user_id === null || isLockedCategorySystemKey(currentCategory.system_key)) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Esta categoría está protegida y no se puede eliminar.',
    })
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiNoContent()
}
