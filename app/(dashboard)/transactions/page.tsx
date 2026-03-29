// =============================================================================
// PÁGINAS DE SECCIÓN — cada bloque va en su propio archivo
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// app/(dashboard)/transactions/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
import type { Metadata }       from 'next'
import Link                    from 'next/link'
import { TransactionTable }    from '@/components/tables/TransactionTable'
import { ScreenHero }          from '@/components/ui/ScreenHero'

export const metadata: Metadata = { title: 'Transacciones' }

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <ScreenHero
        label="Movimientos"
        title="Transacciones"
        subtitle="Ingresos, egresos y transferencias"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 16V4m0 0-4 4m4-4 4 4"/>
            <path d="M17 8v12m0 0-4-4m4 4 4-4"/>
          </svg>
        }
        actions={
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nueva transacción
          </Link>
        }
      />
      <TransactionTable/>
    </div>
  )
}
