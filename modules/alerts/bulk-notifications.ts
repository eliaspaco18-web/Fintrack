import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export type AlertDeleteScope = 'all' | 'read'

export type VerifiedBulkMutation =
  | { ok: true; affectedCount: number; remainingCount: 0 }
  | {
      ok: false
      reason: 'mutation_failed' | 'verification_failed' | 'rows_remain'
      affectedCount: number | null
      remainingCount: number | null
      error?: string
    }

export async function markAllUnreadAlertsRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  readAt = new Date().toISOString(),
): Promise<VerifiedBulkMutation> {
  const mutation = await supabase
    .from('app_notifications')
    .update({ is_read: true, read_at: readAt }, { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (mutation.error) {
    return { ok: false, reason: 'mutation_failed', affectedCount: null, remainingCount: null, error: mutation.error.message }
  }
  if (mutation.count === null) {
    return { ok: false, reason: 'verification_failed', affectedCount: null, remainingCount: null }
  }

  const verification = await supabase
    .from('app_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (verification.error || verification.count === null) {
    return {
      ok: false,
      reason: 'verification_failed',
      affectedCount: mutation.count,
      remainingCount: null,
      error: verification.error?.message,
    }
  }

  if (verification.count > 0) {
    return { ok: false, reason: 'rows_remain', affectedCount: mutation.count, remainingCount: verification.count }
  }

  return { ok: true, affectedCount: mutation.count, remainingCount: 0 }
}

export async function deleteUserAlerts(
  supabase: SupabaseClient<Database>,
  userId: string,
  scope: AlertDeleteScope,
): Promise<VerifiedBulkMutation> {
  let mutationQuery = supabase
    .from('app_notifications')
    .delete({ count: 'exact' })
    .eq('user_id', userId)

  if (scope === 'read') mutationQuery = mutationQuery.eq('is_read', true)

  const mutation = await mutationQuery
  if (mutation.error) {
    return { ok: false, reason: 'mutation_failed', affectedCount: null, remainingCount: null, error: mutation.error.message }
  }
  if (mutation.count === null) {
    return { ok: false, reason: 'verification_failed', affectedCount: null, remainingCount: null }
  }

  let verificationQuery = supabase
    .from('app_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (scope === 'read') verificationQuery = verificationQuery.eq('is_read', true)

  const verification = await verificationQuery
  if (verification.error || verification.count === null) {
    return {
      ok: false,
      reason: 'verification_failed',
      affectedCount: mutation.count,
      remainingCount: null,
      error: verification.error?.message,
    }
  }

  if (verification.count > 0) {
    return { ok: false, reason: 'rows_remain', affectedCount: mutation.count, remainingCount: verification.count }
  }

  return { ok: true, affectedCount: mutation.count, remainingCount: 0 }
}

interface AlertBulkRouteDependencies {
  createClient: () => Promise<SupabaseClient<Database>>
  getSessionUserId: (supabase: SupabaseClient<Database>) => Promise<string | null>
}

function failureResponse(
  operation: 'mark_read' | 'delete',
  scope: AlertDeleteScope,
  result: Extract<VerifiedBulkMutation, { ok: false }>,
) {
  const partial = result.reason === 'rows_remain'
  const message = operation === 'mark_read'
    ? partial
      ? `No se pudieron marcar todos los avisos como leídos; quedan ${result.remainingCount} sin leer.`
      : 'No se pudo confirmar que todos los avisos quedaron leídos. Actualiza la bandeja antes de reintentar.'
    : partial
      ? scope === 'all'
        ? `No se pudo vaciar toda la bandeja; quedan ${result.remainingCount} avisos.`
        : `No se pudieron eliminar todos los avisos leídos; quedan ${result.remainingCount}.`
      : 'No se pudo confirmar la eliminación. Actualiza la bandeja antes de reintentar.'

  const data = operation === 'mark_read'
    ? { updatedCount: result.affectedCount, remainingUnreadCount: result.remainingCount }
    : {
        deletedCount: result.affectedCount,
        scope,
        ...(scope === 'all'
          ? { remainingCount: result.remainingCount }
          : { remainingReadCount: result.remainingCount }),
      }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: partial ? 'PARTIAL_OPERATION' : 'BULK_OPERATION_UNVERIFIED',
        message,
      },
      data,
    },
    { status: partial ? 409 : 500 },
  )
}

export function createAlertBulkRouteHandlers({ createClient, getSessionUserId }: AlertBulkRouteDependencies) {
  async function PATCH() {
    const supabase = await createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
    }

    const result = await markAllUnreadAlertsRead(supabase, userId)
    if (!result.ok) return failureResponse('mark_read', 'all', result)

    return NextResponse.json({
      ok: true,
      data: { updatedCount: result.affectedCount, remainingUnreadCount: 0 },
    })
  }

  async function DELETE(request: Request) {
    const rawScope = new URL(request.url).searchParams.get('scope')
    if (rawScope !== null && rawScope !== 'all' && rawScope !== 'read') {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'El alcance de eliminación no es válido.' } },
        { status: 422 },
      )
    }

    const scope: AlertDeleteScope = rawScope === 'all' ? 'all' : 'read'
    const supabase = await createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
    }

    const result = await deleteUserAlerts(supabase, userId, scope)
    if (!result.ok) return failureResponse('delete', scope, result)

    return NextResponse.json({
      ok: true,
      data: scope === 'all'
        ? { deletedCount: result.affectedCount, scope, remainingCount: 0 }
        : { deletedCount: result.affectedCount, scope, remainingReadCount: 0 },
    })
  }

  return { PATCH, DELETE }
}
