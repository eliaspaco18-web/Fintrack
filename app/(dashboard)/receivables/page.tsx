// =============================================================================
// app/(dashboard)/receivables/page.tsx
// PRD v3 — Módulo 7: Cuentas por Cobrar
// Patrón v3: sin ScreenHero ni CreateModuleButton externo.
// ReceivablesManager contiene su propio encabezado, botones y modales.
// =============================================================================

import type { Metadata } from 'next'
import { Suspense }      from 'react'
import { resolveLiveUsdPenExchangeRate } from '@/lib/server/exchange-rate'
import { ReceivablesManager } from '@/components/receivables/ReceivablesManager'

export const metadata: Metadata = {
  title: 'Por cobrar | FinTrack',
  description: 'Gestiona el dinero que terceros te deben. Controla deudores y el progreso de cobro.',
}

export default async function ReceivablesPage() {
  // Tipo de cambio para equivalencias
  const exchangeSnapshot = await resolveLiveUsdPenExchangeRate()

  return (
    <Suspense fallback={<ReceivablesSkeleton />}>
      <ReceivablesManager exchangeRate={Number(exchangeSnapshot.rate)} />
    </Suspense>
  )
}

function ReceivablesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 rounded-xl bg-[color-mix(in_srgb,var(--c-border)_40%,transparent)]" />
      <div className="h-64 rounded-2xl bg-[color-mix(in_srgb,var(--c-border)_30%,transparent)]" />
    </div>
  )
}
