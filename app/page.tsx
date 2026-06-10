// =============================================================================
// app/page.tsx — Landing page principal de FinTrack
// Punto de entrada público para usuarios no autenticados.
// =============================================================================

import type { Metadata } from 'next'
import { LandingPage } from './LandingPage'
import './landing.css'

export const metadata: Metadata = {
  title: 'FinTrack · Plataforma financiera profesional',
  description:
    'Gestiona ingresos, gastos, créditos, portafolios y reportes con una plataforma diseñada para profesionales que exigen precisión y claridad financiera.',
  openGraph: {
    title: 'FinTrack · Plataforma financiera profesional',
    description:
      'Control total de tus finanzas en un solo lugar. Gestiona ingresos, egresos, créditos, activos y alertas.',
    type: 'website',
  },
}

export default function HomePage() {
  return <LandingPage />
}
