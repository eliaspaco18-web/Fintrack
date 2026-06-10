// =============================================================================
// app/(dashboard)/assets/page.tsx
// PRD v3 — Módulo 5: Activos
// Patrón v3: sin ScreenHero ni CreateModuleButton — usa AssetsWorkspace
// =============================================================================

import type { Metadata } from 'next'
import { Suspense }      from 'react'
import { AssetsWorkspace } from '@/components/assets/AssetsWorkspace'

export const metadata: Metadata = {
  title: 'Activos | FinTrack',
  description: 'Gestiona tus activos: bienes, equipos e inversiones patrimoniales.',
}

export default function AssetsPage() {
  return (
    <Suspense>
      <AssetsWorkspace />
    </Suspense>
  )
}
