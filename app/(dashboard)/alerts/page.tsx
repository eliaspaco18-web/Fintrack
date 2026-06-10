// =============================================================================
// app/(dashboard)/alerts/page.tsx
// PRD v3 — Módulo 9: Alertas
// Página SSR mínima. Toda la lógica de datos y UX vive en AlertsWorkspace (client).
// Patrón v3: sin ScreenHero ni CreateModuleButton externo.
// =============================================================================

import type { Metadata } from 'next'
import { AlertsWorkspace } from '@/components/alerts/AlertsWorkspace'

export const metadata: Metadata = {
  title: 'Risk inbox | FinTrack',
  description: 'Bandeja priorizada de riesgos, vencimientos y alertas operativas.',
}

export default function AlertsPage() {
  return <AlertsWorkspace />
}
