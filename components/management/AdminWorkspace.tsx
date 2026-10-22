'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BankEntitiesManager } from '@/components/management/BankEntitiesManager'
import { CurrenciesManager } from '@/components/management/CurrenciesManager'
import { CategoriesManager } from '@/components/management/CategoriesManager'
import { AssetTypesManager } from '@/components/management/AssetTypesManager'
import { CatalogAdminLayout, type CatalogNavItem } from '@/components/management/catalog'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import movementStyles from '@/components/tables/TransactionsRound07.module.css'

type AdminTab = 'categories' | 'banks' | 'currencies' | 'asset-types'

const TABS: CatalogNavItem<AdminTab>[] = [
  { key: 'categories', label: 'Categorías' },
  { key: 'banks', label: 'Entidades' },
  { key: 'currencies', label: 'Monedas' },
  { key: 'asset-types', label: 'Tipos de activo' },
]

const CREATE_ACTIONS: Record<AdminTab, { query: string; label: string; testId: string }> = {
  categories: { query: 'category', label: 'Crear categoría', testId: 'categories-create-button' },
  banks: { query: 'bank', label: 'Nueva entidad', testId: 'bank-entities-create-button' },
  currencies: { query: 'currency', label: 'Nueva moneda', testId: 'currencies-create-button' },
  'asset-types': { query: 'asset-type', label: 'Nuevo tipo', testId: 'asset-types-create-button' },
}

function isValidTab(value: string | null): value is AdminTab {
  return value === 'banks' || value === 'currencies' || value === 'categories' || value === 'asset-types'
}

export function AdminWorkspace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<AdminTab>('categories')

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    setTab(isValidTab(tabParam) ? tabParam : 'categories')
  }, [searchParams])

  const setTabWithQuery = useCallback((nextTab: AdminTab) => {
    setTab(nextTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    params.delete('new')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  const openCreateForTab = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    params.set('new', CREATE_ACTIONS[tab].query)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams, tab])

  return (
    <CatalogAdminLayout
      title="Catálogos"
      description="Referencias para organizar tus registros financieros."
      action={<CreateModuleButton onClick={openCreateForTab} label={CREATE_ACTIONS[tab].label} testId={CREATE_ACTIONS[tab].testId} className={`${movementStyles.v3ModulePrimaryAction} w-full sm:w-auto`} />}
      nav={TABS}
      activeKey={tab}
      onSelect={setTabWithQuery}
    >
      {tab === 'banks' ? <BankEntitiesManager /> : null}
      {tab === 'currencies' ? <CurrenciesManager /> : null}
      {tab === 'categories' ? <CategoriesManager /> : null}
      {tab === 'asset-types' ? <AssetTypesManager /> : null}
    </CatalogAdminLayout>
  )
}
