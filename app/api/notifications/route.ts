// =============================================================================
// app/api/notifications/route.ts
// GET   /api/notifications  — lista notificaciones del usuario
// PATCH /api/notifications  — marca notificaciones como leídas/no leídas
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import { createAppNotification } from '@/lib/server/app-notifications'
import type { NotificationCategory } from '@/lib/server/app-notifications'
import { isNotificationsFeatureMissing } from '@/lib/server/supabase-errors'
import {
  apiCreated,
  apiError,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'

const zPatchSchema = z.object({
  ids: z.array(z.string().uuid()).max(100).optional(),
  mark_all: z.boolean().optional().default(false),
  is_read: z.boolean().optional().default(true),
}).refine(
  payload => payload.mark_all || (payload.ids && payload.ids.length > 0),
  { message: 'Envía ids o mark_all=true para actualizar notificaciones.' },
)

const zCreateSchema = z.object({
  category: z.string().trim().min(2).max(40).optional().default('SYSTEM'),
  event: z.string().trim().min(2).max(60).optional().default('TOAST_SUCCESS'),
  title: z.string().trim().min(2).max(140),
  message: z.string().trim().max(280).optional().nullable(),
  href: z.string().trim().max(240).optional().nullable(),
  context: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? 20)
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
    : 20
  const onlyUnread = req.nextUrl.searchParams.get('only_unread') === 'true'

  let query = supabase
    .from('app_notifications')
    .select('id, category, event, title, message, href, context, is_read, created_at, read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (onlyUnread) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) {
    if (isNotificationsFeatureMissing(error)) return apiOk([])
    return apiError({ code: 'DATABASE_ERROR', message: error.message })
  }
  return apiOk(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zPatchSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { ids, mark_all, is_read } = parsed.data
  const readAt = is_read ? new Date().toISOString() : null

  let query = supabase
    .from('app_notifications')
    .update({
      is_read,
      read_at: readAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (!mark_all && ids && ids.length > 0) {
    query = query.in('id', ids)
  }

  const { error } = await query
  if (error) {
    if (isNotificationsFeatureMissing(error)) return apiOk([])
    return apiError({ code: 'DATABASE_ERROR', message: error.message })
  }

  const { data, error: fetchError } = await supabase
    .from('app_notifications')
    .select('id, category, event, title, message, href, context, is_read, created_at, read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (fetchError) {
    if (isNotificationsFeatureMissing(fetchError)) return apiOk([])
    return apiError({ code: 'DATABASE_ERROR', message: fetchError.message })
  }
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

  const parsed = zCreateSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  await createAppNotification(supabase, {
    userId,
    category: parsed.data.category as NotificationCategory,
    event: parsed.data.event,
    title: parsed.data.title,
    message: parsed.data.message ?? null,
    href: parsed.data.href ?? null,
    context: parsed.data.context,
  })

  return apiCreated({ ok: true })
}
