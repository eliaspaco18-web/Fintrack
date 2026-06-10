// =============================================================================
// app/api/imports/[id]/report/route.ts
// GET /api/imports/[id]/report — descarga reporte CSV de errores/advertencias
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import {
  apiError,
  apiUnauthorized,
  getSessionUserId,
} from '@/lib/api/response'
import { getImportJobWithRows } from '@/lib/imports/import-repository'

type RouteContext = {
  params: {
    id: string
  }
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function buildFilename(fileName: string | null, createdAt: string): string {
  const base = (fileName ?? 'importacion')
    .replace(/\.xlsx$/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const date = createdAt.slice(0, 10).replace(/-/g, '')
  return `${base || 'importacion'}_reporte_${date}.csv`
}

function toCsv(job: NonNullable<Awaited<ReturnType<typeof getImportJobWithRows>>['data']>): string {
  const lines: string[] = []
  lines.push([
    'nivel',
    'hoja',
    'fila',
    'clave',
    'campo',
    'codigo',
    'mensaje',
  ].join(','))

  const globalErrors = job.summary?.globalErrors ?? []
  const globalWarnings = job.summary?.globalWarnings ?? []

  for (const item of globalErrors) {
    lines.push([
      'ERROR',
      'GLOBAL',
      '',
      '',
      csvEscape(item.field ?? ''),
      csvEscape(item.code ?? ''),
      csvEscape(item.message ?? ''),
    ].join(','))
  }

  for (const item of globalWarnings) {
    lines.push([
      'WARNING',
      'GLOBAL',
      '',
      '',
      csvEscape(item.field ?? ''),
      csvEscape(item.code ?? ''),
      csvEscape(item.message ?? ''),
    ].join(','))
  }

  for (const row of job.rows) {
    const issues = [
      ...(row.errors as Array<{ field?: string; code?: string; message?: string }>).map(issue => ({ ...issue, severity: 'ERROR' as const })),
      ...(row.warnings as Array<{ field?: string; code?: string; message?: string }>).map(issue => ({ ...issue, severity: 'WARNING' as const })),
    ]

    for (const item of issues) {
      lines.push([
        csvEscape(item.severity ?? 'WARNING'),
        csvEscape(row.sheet_name),
        csvEscape(row.row_number),
        csvEscape(row.row_key ?? ''),
        csvEscape(item.field ?? ''),
        csvEscape(item.code ?? ''),
        csvEscape(item.message ?? ''),
      ].join(','))
    }
  }

  return `${lines.join('\n')}\n`
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: job, error } = await getImportJobWithRows(supabase, userId, context.params.id)
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  if (!job) return apiError({ code: 'NOT_FOUND', message: 'Importación no encontrada' })

  const csv = toCsv(job)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${buildFilename(job.file_name, job.created_at)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
