// =============================================================================
// app/(dashboard)/assets/page.tsx
// PRD v3 — Módulo 5: Activos
// Patrón v3: sin ScreenHero ni CreateModuleButton — usa AssetsWorkspace
// =============================================================================

import type { Metadata } from 'next'
import { Suspense }      from 'react'
import { AssetsWorkspace } from '@/components/assets/AssetsWorkspace'
import { ASSETS_DEMO_FIXTURES, ASSETS_DEMO_TYPES, isAssetsDemoAllowed } from '@/modules/assets/demo-assets'

export const metadata: Metadata = {
  title: 'Activos | FinTrack',
  description: 'Gestiona tus activos: bienes, equipos e inversiones patrimoniales.',
}

export default function AssetsPage() {
  const demoAllowed = isAssetsDemoAllowed({
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    localOptIn: process.env.FINTRACK_ASSETS_DEMO,
  })

  return (
    <Suspense>
      <AssetsWorkspace
        demoAllowed={demoAllowed}
        demoAssets={demoAllowed ? ASSETS_DEMO_FIXTURES : undefined}
        demoTypes={demoAllowed ? ASSETS_DEMO_TYPES : undefined}
      />
    </Suspense>
  )
}
