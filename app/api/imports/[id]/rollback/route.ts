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
import { rollbackImportJob } from '@/lib/imports/import-rollback'

const zParamsSchema = z.object({
  id: z.string().uuid(),
})

export const runtime = 'nodejs'

export async function POST(
  _req: NextRequest,
  context: { params: { id: string } },
) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const parsed = zParamsSchema.safeParse(context.params)
  if (!parsed.success) return apiZodError(parsed.error)

  const { data: job, error } = await getImportJobWithRows(supabase, userId, parsed.data.id)
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  if (!job) return apiError({ code: 'NOT_FOUND', message: 'Importación no encontrada' })

  try {
    const rolledBack = await rollbackImportJob(supabase, userId, job)
    return apiOk(rolledBack)
  } catch (error) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'No se pudo deshacer la importación.',
      detail: error instanceof Error ? error.message : 'Error desconocido',
    })
  }
}
