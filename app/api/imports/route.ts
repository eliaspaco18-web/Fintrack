// =============================================================================
// app/api/imports/route.ts
// GET  /api/imports — historial de importaciones del usuario
// POST /api/imports — crea un job DRAFT para una importacion futura
// =============================================================================

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import {
  apiCreated,
  apiError,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'
import {
  createImportJob,
  listImportJobs,
} from '@/lib/imports/import-repository'
import {
  zCreateImportJobSchema,
  zImportJobsQuerySchema,
} from '@/lib/imports/import-schemas'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const parsed = zImportJobsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return apiZodError(parsed.error)

  const { data, error } = await listImportJobs(supabase, userId, parsed.data)
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  return apiOk(data ?? [])
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

  const parsed = zCreateImportJobSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { data, error } = await createImportJob(supabase, userId, parsed.data)
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  return apiCreated(data)
}
