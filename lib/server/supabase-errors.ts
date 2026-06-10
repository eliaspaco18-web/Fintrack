// =============================================================================
// lib/server/supabase-errors.ts
// Helpers para detectar errores de compatibilidad de esquema en Supabase/PostgREST.
// =============================================================================

type SupabaseErrorLike = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

function normalizeErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const pgError = error as SupabaseErrorLike
  return [pgError.message, pgError.details, pgError.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  return String((error as SupabaseErrorLike).code ?? '').toUpperCase()
}

export function isBankEntitiesFeatureMissing(error: unknown): boolean {
  const code = getErrorCode(error)
  const text = normalizeErrorText(error)

  const likelyMissingObjectCode =
    code === 'PGRST205' || // Missing table in schema cache
    code === 'PGRST200' || // Missing relation in schema cache
    code === '42P01' || // Undefined table
    code === '42703' || // Undefined column
    code === '42501' // RLS / insufficient privilege

  const mentionsBankEntities =
    text.includes('bank_entities') ||
    text.includes('bank_entity_id')

  const missingSignals =
    text.includes('schema cache') ||
    text.includes('could not find the table') ||
    text.includes('could not find a relationship') ||
    text.includes('does not exist') ||
    text.includes('row-level security policy') ||
    text.includes('permission denied')

  return mentionsBankEntities && (likelyMissingObjectCode || missingSignals)
}

export function isNotificationsFeatureMissing(error: unknown): boolean {
  const code = getErrorCode(error)
  const text = normalizeErrorText(error)

  const likelyMissingObjectCode =
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42703' ||
    code === '42501'

  const mentionsNotifications = text.includes('app_notifications')
  const missingSignals =
    text.includes('schema cache') ||
    text.includes('could not find the table') ||
    text.includes('does not exist') ||
    text.includes('row-level security policy') ||
    text.includes('permission denied')

  return mentionsNotifications && (likelyMissingObjectCode || missingSignals)
}

export function migrationUnavailableMessage(featureLabel: string): {
  message: string
  detail: string
} {
  return {
    message: `${featureLabel} aún no está habilitado en la base de datos.`,
    detail: 'Aplica las migraciones pendientes y vuelve a intentarlo.',
  }
}
