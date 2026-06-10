// =============================================================================
// app/(dashboard)/payables/page.tsx
// PRD v3 — Módulo 8: Cuentas por Pagar
// Patrón v3: sin ScreenHero ni CreateModuleButton externo.
// PayablesWorkspace contiene su propio encabezado, botones y modales.
// =============================================================================

import type { Metadata } from 'next'
import { Suspense }      from 'react'
import { resolveLiveUsdPenExchangeRate } from '@/lib/server/exchange-rate'
import { PayablesWorkspace } from '@/components/payables/PayablesWorkspace'

export const metadata: Metadata = {
  title: 'Por pagar | FinTrack',
  description: 'Gestiona el dinero que debes a terceros. Controla acreedores y el progreso de pago.',
}

export default async function PayablesPage() {
  // Tipo de cambio para equivalencias
  const exchangeSnapshot = await resolveLiveUsdPenExchangeRate()

  return (
    <Suspense fallback={<PayablesSkeleton />}>
      <PayablesWorkspace exchangeRate={Number(exchangeSnapshot.rate)} />
    </Suspense>
  )
}

function PayablesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 rounded-xl bg-[color-mix(in_srgb,var(--c-border)_40%,transparent)]" />
      <div className="h-64 rounded-2xl bg-[color-mix(in_srgb,var(--c-border)_30%,transparent)]" />
    </div>
  )
}
