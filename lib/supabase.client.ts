// =============================================================================
// lib/supabase.client.ts
// Cliente de Supabase para Client Components (browser).
// Singleton — una sola instancia compartida en el cliente.
// =============================================================================

import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient }      from '@supabase/supabase-js'
import type { Database }       from '@/types/database.types'

let client: SupabaseClient<Database> | null = null

export function createClient() {
  if (client) return client

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as SupabaseClient<Database>

  return client
}
