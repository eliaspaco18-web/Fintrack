'use client'

import type { KeyboardEvent } from 'react'

export const DASHBOARD_TABS = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Lectura ejecutiva',
  },
  {
    id: 'transactions',
    label: 'Transacciones',
    description: 'Flujo y categorias',
  },
  {
    id: 'budgets',
    label: 'Presupuestos',
    description: 'Limites del periodo',
  },
  {
    id: 'credits',
    label: 'Creditos',
    description: 'Uso y margen',
  },
  {
    id: 'cash-due',
    label: 'Cobros y pagos',
    description: 'Vencimientos y caja',
  },
  {
    id: 'wealth',
    label: 'Ahorro y patrimonio',
    description: 'Liquidez y composicion',
  },
] as const

export type DashboardTabId = (typeof DASHBOARD_TABS)[number]['id']
export type DashboardWorkspaceTabId = DashboardTabId

export type DashboardTabDefinition = {
  id: DashboardTabId
  label: string
  description: string
}

interface DashboardTabsProps {
  activeTab: DashboardWorkspaceTabId
  onTabChange: (tabId: DashboardWorkspaceTabId) => void
  tabs?: readonly DashboardTabDefinition[]
  className?: string
  ariaLabel?: string
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function getDashboardTabId(tabId: DashboardWorkspaceTabId) {
  return `dashboard-tab-${tabId}`
}

export function getDashboardPanelId(tabId: DashboardWorkspaceTabId) {
  return `dashboard-panel-${tabId}`
}

export function DashboardTabs({
  activeTab,
  onTabChange,
  tabs = DASHBOARD_TABS,
  className,
  ariaLabel = 'Secciones del dashboard',
}: DashboardTabsProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isHorizontalNavigation =
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp' ||
      event.key === 'Home' ||
      event.key === 'End'

    if (!isHorizontalNavigation) return

    event.preventDefault()
    if (tabs.length === 0) return

    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab)
    const safeIndex = currentIndex >= 0 ? currentIndex : 0
    let nextIndex = safeIndex

    if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (safeIndex + 1) % tabs.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (safeIndex - 1 + tabs.length) % tabs.length
    }

    const nextTab = tabs[nextIndex]
    if (!nextTab) return

    onTabChange(nextTab.id)
    window.requestAnimationFrame(() => {
      document.getElementById(getDashboardTabId(nextTab.id))?.focus()
    })
  }

  return (
    <div
      className={cx(
        'overflow-x-auto rounded-[21px] border border-[var(--ft-border)] bg-[color-mix(in_oklch,var(--ft-surface-muted)_68%,transparent)] p-1 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--ft-surface)_78%,transparent)]',
        className
      )}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className="grid min-w-max grid-flow-col auto-cols-max gap-1 lg:min-w-0 lg:grid-cols-6"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              id={getDashboardTabId(tab.id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={getDashboardPanelId(tab.id)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              className={cx(
                'group rounded-[18px] border px-3 py-2 text-left transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ft-primary-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ft-surface)] active:scale-[0.98]',
                isActive
                  ? 'border-[var(--ft-primary-border)] bg-[var(--ft-surface)] text-[var(--ft-primary)] shadow-[0_10px_24px_color-mix(in_oklch,var(--ft-primary)_9%,transparent)]'
                  : 'border-transparent text-[var(--ft-text-muted)] hover:border-[var(--ft-border)] hover:bg-[var(--ft-surface)] hover:text-[var(--ft-text)]'
              )}
            >
              <span className="block whitespace-nowrap text-[12px] font-semibold leading-none">
                {tab.label}
              </span>
              <span
                className={cx(
                  'mt-1 hidden whitespace-nowrap text-[10px] leading-none md:block',
                  isActive
                    ? 'text-[color:color-mix(in_oklch,var(--ft-primary)_72%,var(--ft-text-muted))]'
                    : 'text-[var(--ft-text-subtle)]'
                )}
              >
                {tab.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
