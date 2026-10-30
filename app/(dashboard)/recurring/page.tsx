// =============================================================================
// app/(dashboard)/recurring/page.tsx
// PRD v3 — Módulo 11: Transacciones Recurrentes
// Página SSR mínima. Toda la lógica de datos y UX vive en RecurringWorkspace (client).
// Patrón v3: sin ScreenHero ni CreateModuleButton externo.
// =============================================================================

import type { Metadata } from 'next'
import { RecurringWorkspace } from '@/components/recurring/RecurringWorkspace'

export const metadata: Metadata = {
  title: 'Plantillas | FinTrack',
  description: 'Reutiliza un movimiento y revisa los datos antes de registrarlo.',
}

export default function RecurringPage() {
  return <RecurringWorkspace />
}
