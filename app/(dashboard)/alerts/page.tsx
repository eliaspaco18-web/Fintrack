import type { Metadata } from 'next'
import { ScreenHero } from '@/components/ui/ScreenHero'
import { AlertsCenter } from '@/components/alerts/AlertsCenter'

export const metadata: Metadata = { title: 'Alertas' }

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <ScreenHero
        label="Monitoreo"
        title="Alertas"
        subtitle="Riesgos, vencimientos y recomendaciones según tu actividad financiera."
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        }
      />
      <AlertsCenter/>
    </div>
  )
}
