// =============================================================================
// app/api/accounts/[id]/route.ts
// PATCH  /api/accounts/:id  — actualiza cuenta
// DELETE /api/accounts/:id  — desactiva cuenta (soft delete)
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

const zAccountType = z.enum([
  'CHECKING',
  'SAVINGS',
  'CASH',
  'INVESTMENT',
  'CREDIT_CARD',
  'OTHER',
])

const zCurrency = z.enum(['PEN', 'USD'])

const zUpdateAccountSchema = z.object({
  name:                 z.string().trim().min(2).max(100).optional(),
  institution:          z.string().trim().max(120).nullable().optional(),
  type:                 zAccountType.optional(),
  currency:             zCurrency.optional(),
  include_in_net_worth: z.boolean().optional(),
  color:                z.string().trim().min(4).max(20).optional(),
  icon:                 z.string().trim().min(1).max(40).optional(),
  notes:                z.string().trim().max(500).nullable().optional(),
  is_active:            z.boolean().optional(),
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

  const parsed = zUpdateAccountSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const updateData = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(updateData)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select('id, name, institution, type, currency, balance, initial_balance, color, icon, include_in_net_worth, is_active, notes, created_at, updated_at')
    .single()

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { error } = await supabase
    .from('accounts')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiNoContent()
}
