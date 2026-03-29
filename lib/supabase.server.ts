// =============================================================================
// lib/supabase.server.ts
// Cliente de Supabase para uso en Server Components, Server Actions y
// API Routes de Next.js 14. Usa cookies para mantener la sesión del usuario.
//
// NUNCA importar en Client Components — usar lib/supabase.client.ts para eso.
// =============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { SupabaseClient }                          from '@supabase/supabase-js'
import { cookies }                                 from 'next/headers'
import type { Database }                           from '@/types/database.types'

/**
 * Cliente Supabase autenticado para Server Components y API Routes.
 * Usa la sesión del usuario actual via cookies.
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // En Server Components el set falla silenciosamente — es esperado
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Ídem
          }
        },
      },
    }
  ) as unknown as SupabaseClient<Database>
}

/**
 * Cliente con service_role para operaciones administrativas (crons, webhooks).
 * NUNCA exponer al cliente — solo usar en server-side con variables de entorno
 * privadas (sin prefijo NEXT_PUBLIC_).
 */
export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get: () => undefined,
        set: () => {},
        remove: () => {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  ) as unknown as SupabaseClient<Database>
}

/**
 * Helper para obtener el usuario autenticado en Server Components.
 * Lanza un error si el usuario no está autenticado.
 */
export async function getAuthenticatedUser() {
  const supabase = createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('UNAUTHENTICATED')
  }

  return user
}

/**
 * Helper para obtener la instancia del TransactionService con el
 * cliente del usuario autenticado. Uso en Server Actions y API Routes.
 *
 * Ejemplo de uso en una Server Action:
 *   const service = await getTransactionService()
 *   const result  = await service.createTransaction(userId, input)
 */
export async function getTransactionService() {
  const { TransactionService } = await import(
    '@/modules/transactions/transaction.service'
  )
  const db = createClient()
  return new TransactionService(db)
}
