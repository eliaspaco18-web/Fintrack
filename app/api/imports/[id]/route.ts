// =============================================================================
// app/api/imports/[id]/route.ts
// GET /api/imports/:id — detalle de una importacion y sus filas normalizadas
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import {
  apiError,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'
import { getImportJobWithRows } from '@/lib/imports/import-repository'

const zParamsSchema = z.object({
  id: z.string().uuid(),
})

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } },
) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const parsed = zParamsSchema.safeParse(context.params)
  if (!parsed.success) return apiZodError(parsed.error)

  const { data, error } = await getImportJobWithRows(supabase, userId, parsed.data.id)
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  if (!data) return apiError({ code: 'NOT_FOUND', message: 'Importacion no encontrada' })

  return apiOk(data)
}
