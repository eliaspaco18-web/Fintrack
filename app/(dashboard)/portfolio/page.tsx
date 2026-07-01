// =============================================================================
// app/(dashboard)/portfolio/page.tsx
// Portafolio — Módulo 2 del PRD v3
// Server component: renderiza el manager sin bloquear por precarga Supabase.
// =============================================================================

import type { Metadata } from 'next'
import { PortfolioManager } from '@/components/management/PortfolioManager'

export const metadata: Metadata = {
  title: 'Portafolio | FinTrack',
  description: 'Gestiona tus cuentas bancarias y portafolios financieros',
}

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <PortfolioManager />
    </div>
  )
}
