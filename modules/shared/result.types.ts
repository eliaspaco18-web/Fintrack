// =============================================================================
// modules/shared/result.types.ts
// Patrón Result<T, E> — evita excepciones no controladas en la capa de servicio.
// Inspirado en el modelo de Supabase { data, error } pero con tipado estricto.
// =============================================================================

export type AppError = {
  code:    string
  message: string
  detail?: string
}

export type Result<T> =
  | { ok: true;  data: T;    error?: never }
  | { ok: false; data?: never; error: AppError }

export const ok  = <T>(data: T): Result<T>         => ({ ok: true,  data })
export const err = (error: AppError): Result<never> => ({ ok: false, error })

// Errores estándar reutilizables
export const Errors = {
  notFound:         (entity: string)          => err({ code: 'NOT_FOUND',            message: `${entity} no encontrado` }),
  unauthorized:     ()                        => err({ code: 'UNAUTHORIZED',          message: 'No autorizado' }),
  validation:       (msg: string, d?: string) => err({ code: 'VALIDATION_ERROR',      message: msg, detail: d }),
  businessRule:     (msg: string, d?: string) => err({ code: 'BUSINESS_RULE_ERROR',   message: msg, detail: d }),
  database:         (msg: string, d?: string) => err({ code: 'DATABASE_ERROR',        message: msg, detail: d }),
  atomicityFailure: (msg: string)             => err({ code: 'ATOMICITY_FAILURE',     message: msg }),
} as const
