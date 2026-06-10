// =============================================================================
// app/api/categories/route.ts
// GET  /api/categories   — lista categorías propias
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

const zCategoryScope = z.enum(['INCOME', 'EXPENSE'])
type CategoryScope = z.infer<typeof zCategoryScope>
type CategoryListItem = {
  id: string
  name: string
  scope: CategoryScope
  icon: string
  color: string
  sort_order: number
  is_system: boolean
  user_id: string | null
  system_key: string | null
  created_at: string
}

function normalizeCategoryScope(scope: string): 'INCOME' | 'EXPENSE' {
  return scope === 'INCOME' ? 'INCOME' : 'EXPENSE'
}

function normalizeCategoryKey(name: string, scope: CategoryScope): string {
  return `${scope}::${name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')}`
}

function preferCategoryCandidate(current: CategoryListItem, candidate: CategoryListItem): CategoryListItem {
  const currentOwned = !current.is_system && current.user_id !== null
  const candidateOwned = !candidate.is_system && candidate.user_id !== null

  if (currentOwned !== candidateOwned) return candidateOwned ? candidate : current
  if (current.sort_order !== candidate.sort_order) return candidate.sort_order < current.sort_order ? candidate : current

  return current
}

function dedupeCategories(items: CategoryListItem[]): CategoryListItem[] {
  const grouped = new Map<string, CategoryListItem>()

  for (const item of items) {
    const key = normalizeCategoryKey(item.name, item.scope)
    const existing = grouped.get(key)
    grouped.set(key, existing ? preferCategoryCandidate(existing, item) : item)
  }

  return [...grouped.values()].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name, 'es')
  })
}

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

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, scope, icon, color, sort_order, is_system, user_id, system_key, created_at')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(dedupeCategories((data ?? []).map(category => ({
    ...category,
    scope: normalizeCategoryScope(category.scope),
  })) as CategoryListItem[]))
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
  const normalizedKey = normalizeCategoryKey(payload.name, payload.scope)

  const { data: existingCategories, error: existingError } = await supabase
    .from('categories')
    .select('id, name, scope')
    .eq('user_id', userId)

  if (existingError) {
    return apiError({ code: 'DATABASE_ERROR', message: existingError.message })
  }

  const duplicateExists = (existingCategories ?? []).some(category =>
    normalizeCategoryKey(category.name, normalizeCategoryScope(category.scope)) === normalizedKey
  )
  if (duplicateExists) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Ya existe una categoría con ese nombre para ese tipo.',
    })
  }

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
