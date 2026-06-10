// =============================================================================
// app/(dashboard)/budgets/page.tsx
// PRD v3 — Módulo 6: Presupuestos
// Patrón v3: sin ScreenHero ni CreateModuleButton externo.
// BudgetsManager contiene su propio encabezado, botón crear y modal.
// =============================================================================

import type { Metadata } from 'next'
import { Suspense }      from 'react'
import { BudgetsManager } from '@/components/management/BudgetsManager'

export const metadata: Metadata = {
  title: 'Presupuestos | FinTrack',
  description: 'Controla tus límites de gasto por categoría y período.',
}

export default function BudgetsPage() {
  return (
    <Suspense>
      <BudgetsManager />
    </Suspense>
  )
}
