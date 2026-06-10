// =============================================================================
// app/(dashboard)/dashboard/page.tsx
// Server Component del dashboard.
// Fase 11.4: integra DashboardWorkspace con SSR mínimo.
// =============================================================================

import type { Metadata }         from 'next'
import { resolveLiveUsdPenExchangeRate } from '@/lib/server/exchange-rate'
import { DashboardClient }       from '@/components/dashboard/DashboardClient'

export const metadata: Metadata = {
  title: 'Dashboard | FinTrack',
  description: 'Panel financiero integral con KPIs, flujo de dinero y vencimientos próximos.',
}

// ─── REVALIDACIÓN ────────────────────────────────────────────────────────────
// La página se revalida cada 60 segundos (tiempo del TTL del dashboard).
// También se revalida al crear/actualizar/eliminar transacciones via revalidateTag.

export const revalidate = 60

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // SSR mínimo: solo tipo de cambio (el resto se resuelve en cliente con fetch paralelo).
  const exchangeRateSnapshot = await resolveLiveUsdPenExchangeRate()

  return (
    <DashboardClient initialExchangeRate={exchangeRateSnapshot.rate} />
  )
}
