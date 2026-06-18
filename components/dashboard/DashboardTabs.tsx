'use client'

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

export const LEGACY_DASHBOARD_TAB = {
  id: 'legacy',
  label: 'Legacy',
  description: 'Migracion temporal',
} as const

export type DashboardTabId = (typeof DASHBOARD_TABS)[number]['id']
export type DashboardWorkspaceTabId = DashboardTabId | typeof LEGACY_DASHBOARD_TAB.id

export type DashboardTabDefinition = {
  id: DashboardWorkspaceTabId
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
