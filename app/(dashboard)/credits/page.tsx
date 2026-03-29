// app/(dashboard)/credits/page.tsx
import type { Metadata }   from 'next'
import { CreditsTable }    from '@/components/tables/CreditsAssetsTable'
import { ScreenHero }      from '@/components/ui/ScreenHero'
import { CreditsManager } from '@/components/management/CreditsManager'
export const metadata: Metadata = { title: 'Créditos' }
export default function CreditsPage() {
  return (
    <div className="space-y-6">
      <ScreenHero
        label="Deuda"
        title="Créditos"
        subtitle="Tarjetas de crédito y créditos bancarios con control de cuotas"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <path d="M2 10h20"/>
          </svg>
        }
      />
      <CreditsManager />
      <CreditsTable/>
    </div>
  )
}
