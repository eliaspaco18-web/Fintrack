// =============================================================================
// app/api/alerts/route.ts
// PRD v3 — Módulo 9: Alertas — GET (lista filtrada) + DELETE (bulk: eliminar leídas)
// Tabla: app_notifications (ya existe, columnas: alert_type, source_module,
//        source_record_id, is_read, href, title, message, created_at)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'
import { formatManualAlertMessage }  from '@/modules/alerts/manual-alert-message'
import { createAlertBulkRouteHandlers } from '@/modules/alerts/bulk-notifications'

export const dynamic = 'force-dynamic'

const zCreateAlertSchema = z.object({
  title: z.string().trim().min(3).max(140),
  source_module: z.enum(['credits', 'budgets', 'receivables', 'payables', 'recurring', 'alerts']),
  alert_type: z.enum(['CRITICAL', 'OPERATIONAL', 'SUGGESTION']).default('OPERATIONAL'),
  channel: z.enum(['inbox_email', 'inbox', 'digest']).default('inbox'),
  threshold: z.string().trim().min(1).max(20).optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 }
    )
  }

  const typeParam   = req.nextUrl.searchParams.get('type')    // CRITICAL | OPERATIONAL | SUGGESTION
  const readParam   = req.nextUrl.searchParams.get('is_read') // 'true' | 'false'
  const moduleParam = req.nextUrl.searchParams.get('module')  // credits | budgets | receivables | payables | recurring

  const allowedTypes   = ['CRITICAL', 'OPERATIONAL', 'SUGGESTION'] as const
  const allowedModules = ['credits', 'budgets', 'receivables', 'payables', 'recurring'] as const

  if (typeParam && !allowedTypes.includes(typeParam as 'CRITICAL' | 'OPERATIONAL' | 'SUGGESTION')) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Parámetro type inválido' } },
      { status: 422 }
    )
  }
  if (moduleParam && !allowedModules.includes(moduleParam as 'credits' | 'budgets' | 'receivables' | 'payables' | 'recurring')) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Parámetro module inválido' } },
      { status: 422 }
    )
  }

  let query = supabase
    .from('app_notifications')
    .select('id, alert_type, source_module, source_record_id, href, title, message, is_read, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (typeParam)   query = query.eq('alert_type', typeParam as 'CRITICAL' | 'OPERATIONAL' | 'SUGGESTION')
  if (moduleParam) query = query.eq('source_module', moduleParam)
  if (readParam === 'true')  query = query.eq('is_read', true)
  if (readParam === 'false') query = query.eq('is_read', false)

  const [rowsResult, unreadCountResult] = await Promise.all([
    query,
    supabase
      .from('app_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false),
  ])

  if (rowsResult.error || unreadCountResult.error || rowsResult.count === null || unreadCountResult.count === null) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: 'No se pudieron cargar los avisos y sus contadores.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    data: rowsResult.data ?? [],
    counts: { total: rowsResult.count, unread: unreadCountResult.count },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 }
    )
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_REQUEST', message: 'Cuerpo inválido' } },
      { status: 400 }
    )
  }

  const parsed = zCreateAlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos.' } },
      { status: 422 }
    )
  }

  const payload = parsed.data
  const message = formatManualAlertMessage({
    sourceModule: payload.source_module,
    channel: payload.channel,
    threshold: payload.threshold,
  })

  const { data, error } = await supabase
    .from('app_notifications')
    .insert({
      user_id: userId,
      category: 'ALERT',
      event: 'MANUAL_ALERT_CREATED',
      title: payload.title,
      message,
      href: '/alerts',
      alert_type: payload.alert_type,
      source_module: payload.source_module,
      source_record_id: null,
      context: {
        origin: 'manual_rule',
        channel: payload.channel,
        threshold: payload.threshold ?? null,
      },
      is_read: false,
    })
    .select('id, alert_type, source_module, source_record_id, href, title, message, is_read, created_at')
    .single()

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, data }, { status: 201 })
}

const bulkHandlers = createAlertBulkRouteHandlers({ createClient, getSessionUserId })

/** PATCH /api/alerts — marca como leídos todos los avisos sin leer de la cuenta autenticada. */
export const PATCH = bulkHandlers.PATCH

/** DELETE /api/alerts?scope=read|all — read preserves the legacy default; all empties the whole inbox. */
export const DELETE = bulkHandlers.DELETE
