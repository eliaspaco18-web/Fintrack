import type { Metadata } from 'next'
import { PortfolioManager } from '@/components/management/PortfolioManager'
import { ScreenHero } from '@/components/ui/ScreenHero'

export const metadata: Metadata = { title: 'Portafolio' }

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <ScreenHero
        label="Finanzas base"
        title="Portafolio"
        subtitle="Crea y administra tus cuentas y bancos para usar en transacciones."
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>
            <path d="M16 12h.01"/>
            <path d="M3 9h18"/>
          </svg>
        }
      />

      <PortfolioManager />
    </div>
  )
}
