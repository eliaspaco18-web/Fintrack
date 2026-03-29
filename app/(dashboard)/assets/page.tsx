// app/(dashboard)/assets/page.tsx
import type { Metadata }  from 'next'
import { AssetsTable }    from '@/components/tables/CreditsAssetsTable'
import { ScreenHero }     from '@/components/ui/ScreenHero'
export const metadata: Metadata = { title: 'Activos' }
export default function AssetsPage() {
  return (
    <div className="space-y-6">
      <ScreenHero
        label="Patrimonio"
        title="Activos"
        subtitle="Bienes, equipos e inversiones registrados"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m12 2 9 4.5v11L12 22 3 17.5v-11L12 2Z"/>
            <path d="M12 22V12"/>
            <path d="m21 6.5-9 5.5-9-5.5"/>
          </svg>
        }
      />
      <AssetsTable/>
    </div>
  )
}
