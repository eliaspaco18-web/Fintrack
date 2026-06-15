import type { Metadata } from 'next'
import { APP_CONTROL_CONFIG } from '@/lib/constants/app-control'
import { AppStateScreen } from '@/components/system/AppStateScreen'

export const metadata: Metadata = {
  title: 'Mantenimiento | FinTrack',
  description: 'Pantalla pública de mantenimiento del sistema.',
}

export default function MaintenancePage() {
  return (
    <AppStateScreen
      eyebrow="Mantenimiento"
      title={APP_CONTROL_CONFIG.maintenance.title}
      message={APP_CONTROL_CONFIG.maintenance.message}
      tone="maintenance"
      primaryHref="/"
      primaryLabel="Volver más tarde"
    />
  )
}
