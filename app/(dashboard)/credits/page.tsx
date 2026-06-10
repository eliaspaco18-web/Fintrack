// app/(dashboard)/credits/page.tsx
// PRD v3 — Módulo 4: Créditos
// Patrón v3: sin ScreenHero ni CreateModuleButton — todo en el Workspace

import type { Metadata } from 'next'
import { CreditsWorkspace } from '@/components/credits/CreditsWorkspace'

export const metadata: Metadata = {
  title: 'Créditos | FinTrack',
  description: 'Gestiona tus tarjetas de crédito y créditos bancarios con control de cuotas y ciclos.',
}

export default function CreditsPage() {
  return <CreditsWorkspace />
}
