// =============================================================================
// app/api/imports/excel/analyze/route.ts
// POST /api/imports/excel/analyze — valida Excel y guarda preview
// =============================================================================

import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase.server'
import {
  apiCreated,
  apiError,
  apiOk,
  apiUnauthorized,
  getSessionUserId,
} from '@/lib/api/response'
import {
  analyzeImportWorkbook,
  MAX_IMPORT_FILE_BYTES,
} from '@/lib/imports/excel-analyzer'
import { loadImportTemplateCatalogs } from '@/lib/imports/excel-template'
import {
  createAnalyzedImportJob,
} from '@/lib/imports/import-repository'
import { IMPORT_TEMPLATE_VERSION } from '@/lib/imports/import-types'

export const runtime = 'nodejs'

function isExcelFilename(name: string): boolean {
  return /\.xlsx$/i.test(name)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Debes enviar el archivo como multipart/form-data.',
    })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Adjunta un archivo en el campo "file".',
    })
  }

  if (!isExcelFilename(file.name)) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'El archivo debe tener extension .xlsx.',
    })
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'El archivo excede el limite de 10 MB.',
    })
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const hash = createHash('sha256')
      .update(new Uint8Array(arrayBuffer))
      .digest('hex')

    const catalogs = await loadImportTemplateCatalogs(supabase, userId)
    const analysis = await analyzeImportWorkbook(arrayBuffer, catalogs)
    const { data, error } = await createAnalyzedImportJob(
      supabase,
      userId,
      {
        template_version: analysis.templateVersion ?? IMPORT_TEMPLATE_VERSION,
        file_name: file.name,
        file_size_bytes: file.size,
        file_hash: hash,
      },
      analysis,
    )

    if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

    return apiCreated(data)
  } catch (error) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'No se pudo analizar el archivo Excel.',
      detail: error instanceof Error ? error.message : 'Error desconocido',
    })
  }
}
