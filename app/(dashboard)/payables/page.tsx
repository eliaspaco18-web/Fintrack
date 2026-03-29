// app/(dashboard)/payables/page.tsx
import type { Metadata }  from 'next'
import { PayablesTable }  from '@/components/tables/ReceivablesPayablesTable'
import { ScreenHero }     from '@/components/ui/ScreenHero'
export const metadata: Metadata = { title: 'Por pagar' }
export default function PayablesPage() {
  return (
    <div className="space-y-6">
      <ScreenHero
        label="Pendientes"
        title="Cuentas por pagar"
        subtitle="Dinero que debes a terceros"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 3v18"/>
            <path d="M7 8a4 4 0 0 1 4-2h2a3 3 0 0 1 0 6h-2a3 3 0 0 0 0 6h2a4 4 0 0 0 4-2"/>
          </svg>
        }
      />
      <PayablesTable/>
    </div>
  )
}
