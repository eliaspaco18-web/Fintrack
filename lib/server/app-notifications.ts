// =============================================================================
// lib/server/app-notifications.ts
// Helpers server-side para registrar actividad interna en app_notifications.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'
import { isNotificationsFeatureMissing } from '@/lib/server/supabase-errors'

export type NotificationCategory =
  | 'SYSTEM'
  | 'PORTFOLIO'
  | 'TRANSACTION'
  | 'BANK'
  | 'CATEGORY'
  | 'BUDGET'
  | 'ALERT'

interface CreateNotificationInput {
  userId: string
  category: NotificationCategory
  event: string
  title: string
  message?: string | null
  href?: string | null
  context?: Record<string, unknown>
}

export async function createAppNotification(
  supabase: SupabaseClient<Database>,
  input: CreateNotificationInput,
): Promise<void> {
  const payload = {
    user_id: input.userId,
    category: input.category,
    event: input.event,
    title: input.title,
    message: input.message ?? null,
    href: input.href ?? null,
    context: (input.context ?? {}) as Json,
    is_read: false,
  }

  const { error } = await supabase
    .from('app_notifications')
    .insert(payload)

  // No interrumpimos el flujo principal por fallas de notificaciones.
  if (error) {
    if (isNotificationsFeatureMissing(error)) return
    console.error('[app_notifications] insert error:', error.message)
  }
}
