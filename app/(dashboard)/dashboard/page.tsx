// =============================================================================
// app/(dashboard)/dashboard/page.tsx
// Server Component del dashboard.
// Carga los datos iniciales del servidor y los pasa al DashboardClient.
// El cliente los usa como fallbackData en useDashboard() — cero flash.
// =============================================================================

import { redirect }              from 'next/navigation'
import type { Metadata }         from 'next'
import { createClient }          from '@/lib/supabase.server'
import { DashboardService }      from '@/modules/dashboard/dashboard.service'
import { DashboardClient }       from '@/components/dashboard/DashboardClient'

export const metadata: Metadata = {
  title: 'Dashboard',
}

// ─── REVALIDACIÓN ────────────────────────────────────────────────────────────
// La página se revalida cada 60 segundos (tiempo del TTL del dashboard).
// También se revalida al crear/actualizar/eliminar transacciones via revalidateTag.

export const revalidate = 60

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = new DashboardService(supabase)
  const result  = await service.getSummary(user.id)

  // Si falla la carga inicial, pasamos null y el cliente muestra el error
  const initialData = result.ok ? result.data : null

  return (
    <DashboardClient initialData={initialData}/>
  )
}
