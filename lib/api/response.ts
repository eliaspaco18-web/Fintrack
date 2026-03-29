// =============================================================================
// lib/api/response.ts
// Mapeo canónico de Result<T> a respuestas HTTP.
// Un solo lugar para todos los contratos de respuesta de la API.
// =============================================================================

import { NextResponse }            from 'next/server'
import { ZodError }                from 'zod'
import { type Result, type AppError } from '@/modules/shared/result.types'

// ─── SHAPE ESTÁNDAR DE RESPUESTA ─────────────────────────────────────────────
// Todas las respuestas de la API siguen este contrato.

export interface ApiSuccess<T> {
  ok:   true
  data: T
}

export interface ApiError {
  ok:      false
  error: {
    code:    string
    message: string
    detail?: string
    fields?: Record<string, string[]>  // errores de validación por campo
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── HELPERS DE ÉXITO ────────────────────────────────────────────────────────

export function apiOk<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, { status })
}

export function apiCreated<T>(data: T): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, { status: 201 })
}

export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

// ─── MAPEO DE AppError A HTTP ─────────────────────────────────────────────────

const ERROR_STATUS_MAP: Record<string, number> = {
  NOT_FOUND:          404,
  UNAUTHORIZED:       401,
  VALIDATION_ERROR:   422,
  BUSINESS_RULE_ERROR: 422,
  DATABASE_ERROR:     500,
  ATOMICITY_FAILURE:  500,
}

export function apiError(error: AppError): NextResponse<ApiError> {
  const status = ERROR_STATUS_MAP[error.code] ?? 500
  return NextResponse.json(
    {
      ok: false,
      error: {
        code:    error.code,
        message: error.message,
        detail:  error.detail,
      },
    },
    { status }
  )
}

/**
 * Convierte un ZodError en una respuesta 422 con errores por campo.
 */
export function apiZodError(error: ZodError): NextResponse<ApiError> {
  const fields: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (!fields[path]) fields[path] = []
    fields[path].push(issue.message)
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code:    'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos',
        fields,
      },
    },
    { status: 422 }
  )
}

/**
 * Convierte errores de autenticación a 401.
 */
export function apiUnauthorized(message = 'No autorizado'): NextResponse<ApiError> {
  return NextResponse.json(
    { ok: false, error: { code: 'UNAUTHORIZED', message } },
    { status: 401 }
  )
}

/**
 * Wrapper final que convierte un Result<T> al response HTTP correcto.
 * Uso en Route Handlers:
 *   return fromResult(result, 201)
 */
export function fromResult<T>(
  result:  Result<T>,
  status?: number
): NextResponse<ApiResponse<T>> {
  if (result.ok) return apiOk(result.data, status ?? 200) as NextResponse<ApiResponse<T>>
  return apiError(result.error) as NextResponse<ApiResponse<T>>
}

// ─── GUARD DE AUTENTICACIÓN ───────────────────────────────────────────────────

/**
 * Helper para extraer el userId del usuario autenticado en Route Handlers.
 * Retorna null si no hay sesión — el handler decide cómo responder.
 */
export async function getSessionUserId(
  supabase: import('@supabase/supabase-js').SupabaseClient
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}
