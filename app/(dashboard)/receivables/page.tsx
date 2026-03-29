// app/(dashboard)/receivables/page.tsx
import type { Metadata }    from 'next'
import { ReceivablesTable } from '@/components/tables/ReceivablesPayablesTable'
import { ScreenHero }       from '@/components/ui/ScreenHero'
export const metadata: Metadata = { title: 'Por cobrar' }
export default function ReceivablesPage() {
  return (
    <div className="space-y-6">
      <ScreenHero
        label="Pendientes"
        title="Cuentas por cobrar"
        subtitle="Dinero que terceros te deben"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 3v18"/>
            <path d="M17 8a4 4 0 0 0-4-2H11a3 3 0 0 0 0 6h2a3 3 0 0 1 0 6h-2a4 4 0 0 1-4-2"/>
          </svg>
        }
      />
      <ReceivablesTable/>
    </div>
  )
}
