// =============================================================================
// components/management/AdminWorkspace.tsx
// Workspace con 4 tabs: Entidad Bancaria, Moneda, Categoría, Tipo de Activo
// PRD v3 — Módulo 10: Administración
// =============================================================================

'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BankEntitiesManager } from '@/components/management/BankEntitiesManager'
import { CurrenciesManager } from '@/components/management/CurrenciesManager'
import { CategoriesManager } from '@/components/management/CategoriesManager'
import { AssetTypesManager } from '@/components/management/AssetTypesManager'
import { CatalogAdminLayout } from '@/components/management/catalog'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type AdminTab = 'banks' | 'currencies' | 'categories' | 'asset-types'

interface TabConfig {
  key: AdminTab
  label: string
  icon: React.ReactNode
  description: string
}

const TABS: TabConfig[] = [
  {
    key: 'banks',
    label: 'Entidades Bancarias',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18"/>
        <path d="M3 10h18"/>
        <path d="M5 6l7-3 7 3"/>
        <path d="M4 10v11"/>
        <path d="M20 10v11"/>
        <path d="M8 14v3"/>
        <path d="M12 14v3"/>
        <path d="M16 14v3"/>
      </svg>
    ),
    description: 'Bancos e instituciones financieras',
  },
  {
    key: 'currencies',
    label: 'Monedas',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8"/>
        <line x1="12" y1="6" x2="12" y2="18"/>
        <path d="M15 9.5c-.5-1-1.5-1.5-3-1.5s-2.5.5-2.5 1.5 1 1.5 2.5 2 2.5 1 2.5 2-1 1.5-2.5 1.5-2.5-.5-3-1.5"/>
      </svg>
    ),
    description: 'Monedas disponibles para portafolios',
  },
  {
    key: 'categories',
    label: 'Categorías',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
    description: 'Categorías de ingreso y egreso',
  },
  {
    key: 'asset-types',
    label: 'Tipos de Activo',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3 8.5 4.8v8.4L12 21l-8.5-4.8V7.8L12 3Z"/>
        <path d="M12 21v-9.6"/>
        <path d="m3.7 8 8.3 4.7 8.3-4.7"/>
      </svg>
    ),
    description: 'Clasificación de bienes y activos',
  },
]

function isValidTab(value: string | null): value is AdminTab {
  return value === 'banks' || value === 'currencies' || value === 'categories' || value === 'asset-types'
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function AdminWorkspace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<AdminTab>('banks')

  // Sync tab from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (isValidTab(tabParam)) {
      setTab(tabParam)
      return
    }
    setTab('banks')
  }, [searchParams])

  const setTabWithQuery = useCallback((nextTab: AdminTab) => {
    setTab(nextTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    // Clean up extra params when switching tabs
    params.delete('new')
    const nextUrl = `${pathname}?${params.toString()}`
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  return (
    <CatalogAdminLayout
      title="Administración"
      description="Bancos, monedas, categorías y tipos de activo resueltos como catálogos operativos consistentes."
      headerMode="content"
      nav={TABS}
      activeKey={tab}
      onSelect={setTabWithQuery}
    >
        {tab === 'banks'        && <BankEntitiesManager />}
        {tab === 'currencies'   && <CurrenciesManager />}
        {tab === 'categories'   && <CategoriesManager />}
        {tab === 'asset-types'  && <AssetTypesManager />}
    </CatalogAdminLayout>
  )
}
