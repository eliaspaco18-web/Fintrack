// =============================================================================
// modules/shared/repository.base.ts
// Clase base para todos los repositorios.
// Centraliza el cliente Supabase y el patrón de manejo de errores.
// =============================================================================

import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database }       from '@/types/database.types'
import { type Result, Errors } from './result.types'

export type DbClient = SupabaseClient<Database>

export abstract class BaseRepository {
  protected readonly db: DbClient

  constructor(db: DbClient) {
    this.db = db
  }

  /**
   * Wrapper para queries de Supabase.
   * Convierte { data, error } de Supabase al patrón Result<T>.
   */
  protected async query<T>(
    operation: () => Promise<{ data: T | null; error: unknown }>
  ): Promise<Result<T>> {
    try {
      const { data, error } = await operation()

      if (error) {
        const e = error as { message?: string; code?: string; details?: string }
        return Errors.database(
          e.message ?? 'Error de base de datos',
          e.details
        )
      }

      if (data === null) return Errors.notFound('Registro')

      return { ok: true, data }
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'Error inesperado'
      return Errors.database(msg)
    }
  }

  /**
   * Versión para queries que pueden devolver null sin ser un error
   * (ej. buscar por ID que puede no existir).
   */
  protected async queryNullable<T>(
    operation: () => Promise<{ data: T | null; error: unknown }>
  ): Promise<Result<T | null>> {
    try {
      const { data, error } = await operation()

      if (error) {
        const e = error as { message?: string; details?: string }
        return Errors.database(e.message ?? 'Error de base de datos', e.details)
      }

      return { ok: true, data }
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'Error inesperado'
      return Errors.database(msg)
    }
  }

  /**
   * Versión para queries que devuelven listas (nunca null, solo []).
   */
  protected async queryList<T>(
    operation: () => Promise<{ data: T[] | null; error: unknown }>
  ): Promise<Result<T[]>> {
    try {
      const { data, error } = await operation()

      if (error) {
        const e = error as { message?: string; details?: string }
        return Errors.database(e.message ?? 'Error de base de datos', e.details)
      }

      return { ok: true, data: data ?? [] }
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'Error inesperado'
      return Errors.database(msg)
    }
  }
}
