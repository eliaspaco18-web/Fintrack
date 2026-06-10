// =============================================================================
// app/api/imports/excel/commit/route.ts
// POST /api/imports/excel/commit — confirma una importacion validada
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import {
  apiCreated,
  apiError,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'
import { getImportJobWithRows } from '@/lib/imports/import-repository'
import { commitImportJob } from '@/lib/imports/import-commit'

const zCommitSchema = z.object({
  import_job_id: z.string().uuid(),
})

export const runtime = 'nodejs'

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

  const parsed = zCommitSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { data: job, error } = await getImportJobWithRows(supabase, userId, parsed.data.import_job_id)
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  if (!job) return apiError({ code: 'NOT_FOUND', message: 'Importacion no encontrada' })

  try {
    const committed = await commitImportJob(supabase, userId, job)
    return apiCreated(committed)
  } catch (error) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'No se pudo confirmar la importación.',
      detail: error instanceof Error ? error.message : 'Error desconocido',
    })
  }
}
