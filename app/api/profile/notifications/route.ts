// =============================================================================
// app/api/profile/notifications/route.ts
// GET  → lee las preferencias de notificación del usuario
// PATCH → guarda las preferencias de notificación del usuario
// =============================================================================

import { NextRequest }    from 'next/server'
import { z }              from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized, apiZodError } from '@/lib/api/response'

const zNotifPrefs = z.object({
  overdueInstallments: z.boolean(),
  overdueReceivables:  z.boolean(),
  overduePayables:     z.boolean(),
  unusualActivity:     z.boolean(),
  budgetAlerts:        z.boolean(),
  weeklySummary:       z.boolean(),
  newTransaction:      z.boolean(),
})

export type NotifPrefs = z.infer<typeof zNotifPrefs>

const DEFAULT_PREFS: NotifPrefs = {
  overdueInstallments: true,
  overdueReceivables:  true,
  overduePayables:     true,
  unusualActivity:     true,
  budgetAlerts:        false,
  weeklySummary:       false,
  newTransaction:      false,
}

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiUnauthorized()

  const service = createServiceClient()
  // We cast as any because notification_prefs may not yet be in the generated types
  const { data, error } = await (service as any)
    .from('profiles')
    .select('notification_prefs')
    .eq('id', user.id)
    .single() as { data: { notification_prefs?: Partial<NotifPrefs> } | null; error: { message: string } | null }

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  // Merge with defaults in case of missing keys (schema evolution)
  const prefs: NotifPrefs = { ...DEFAULT_PREFS, ...(data?.notification_prefs ?? {}) }
  return apiOk(prefs)
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return apiUnauthorized()

  let body: unknown
  try { body = await req.json() } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zNotifPrefs.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const service = createServiceClient()
  // Cast to bypass generated type until migration runs
  const { error } = await (service as any)
    .from('profiles')
    .update({ notification_prefs: parsed.data, updated_at: new Date().toISOString() })
    .eq('id', user.id) as { error: { message: string } | null }

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(parsed.data)
}
