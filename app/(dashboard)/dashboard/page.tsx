// =============================================================================
// app/(dashboard)/dashboard/page.tsx
// Server Component del dashboard.
// Fase 11.4: integra DashboardWorkspace con SSR mínimo.
// =============================================================================

import type { Metadata }         from 'next'
import { DashboardClient }       from '@/components/dashboard/DashboardClient'
import { DashboardRound07 } from '@/components/dashboard/DashboardRound07'
import { isV3ShellEnabled } from '@/lib/flags/v3-shell'

export const metadata: Metadata = {
  title: 'Dashboard | FinTrack',
  description: 'Panel financiero integral con KPIs, flujo de dinero y vencimientos próximos.',
}

// ─── REVALIDACIÓN ────────────────────────────────────────────────────────────
// La página se revalida cada 60 segundos (tiempo del TTL del dashboard).
// También se revalida al crear/actualizar/eliminar transacciones via revalidateTag.

export const revalidate = 60

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    isV3ShellEnabled()
      ? <DashboardRound07 />
      : <DashboardClient />
  )
}
