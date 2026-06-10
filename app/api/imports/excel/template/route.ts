// =============================================================================
// app/api/imports/excel/template/route.ts
// GET /api/imports/excel/template — descarga plantilla oficial de migracion
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import {
  apiError,
  apiUnauthorized,
  getSessionUserId,
} from '@/lib/api/response'
import {
  buildImportTemplateWorkbook,
  loadImportTemplateCatalogs,
} from '@/lib/imports/excel-template'

export const runtime = 'nodejs'

function toBodyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(output).set(bytes)
  return output
}

function templateFilename(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `FinTrack_Plantilla_Migracion_${year}${month}${day}.xlsx`
}

export async function GET() {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  try {
    const catalogs = await loadImportTemplateCatalogs(supabase, userId)
    const workbook = await buildImportTemplateWorkbook(catalogs)

    return new NextResponse(toBodyArrayBuffer(workbook), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${templateFilename(new Date())}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: 'No se pudo generar la plantilla de importacion.',
      detail: error instanceof Error ? error.message : 'Error desconocido',
    })
  }
}

