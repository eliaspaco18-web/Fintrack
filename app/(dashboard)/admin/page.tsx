import type { Metadata } from 'next'
import { CategoriesManager } from '@/components/management/CategoriesManager'
import { ScreenHero } from '@/components/ui/ScreenHero'

export const metadata: Metadata = { title: 'Administración' }

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <ScreenHero
        label="Control"
        title="Administración"
        subtitle="Administra categorías de ingreso y egreso para tus transacciones."
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 3a2 2 0 0 1 2 2v1.1a6.96 6.96 0 0 1 1.9.78l.78-.78a2 2 0 1 1 2.83 2.83l-.78.78c.33.6.59 1.24.77 1.9H21a2 2 0 1 1 0 4h-1.1a7.2 7.2 0 0 1-.77 1.9l.78.78a2 2 0 0 1-2.83 2.83l-.78-.78a6.96 6.96 0 0 1-1.9.78V21a2 2 0 1 1-4 0v-1.1a6.96 6.96 0 0 1-1.9-.78l-.78.78a2 2 0 0 1-2.83-2.83l.78-.78a6.96 6.96 0 0 1-.78-1.9H3a2 2 0 1 1 0-4h1.1c.19-.66.45-1.3.78-1.9l-.78-.78a2 2 0 1 1 2.83-2.83l.78.78c.6-.33 1.24-.59 1.9-.78V5a2 2 0 0 1 2-2Z"/>
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
          </svg>
        }
      />

      <CategoriesManager />
    </div>
  )
}
