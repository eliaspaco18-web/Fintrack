'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SWRConfig, useSWRConfig } from 'swr'
import type {
  DashboardSummary,
  DashboardSidebar,
  ModulesSummary,
  MoneyFlowMode,
  MoneyFlowPoint,
} from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { DashboardHeader } from './DashboardHeader'
import { MoneyFlowChart } from './MoneyFlowChart'
import { SaldosDiaChart } from './SaldosDiaChart'
import { MetricCards } from './MetricCards'
import { ModulesMiniCards } from './ModulesMiniCards'
import { SaldosBancariosWidget } from './SaldosBancariosWidget'
import { FlujoPendienteWidget } from './FlujoPendienteWidget'
import { EgresosCategoriasWidget } from './EgresosCategoriasWidget'
import { VencimientosWidget } from './VencimientosWidget'
import { FinancialHealthScore } from './FinancialHealthScore'
import { TopCategoriesWidget } from './TopCategoriesWidget'
import { SavingsRateTrendChart } from './SavingsRateTrendChart'
import { DailyBalanceDeltaChart } from './DailyBalanceDeltaChart'
import { PresupuestosMesWidget } from './PresupuestosMesWidget'
import { CreditosUsoRapidoWidget } from './CreditosUsoRapidoWidget'

type MoneyFlowResponse = {
  mode: MoneyFlowMode
  months: number
  series: MoneyFlowPoint[]
}

interface DashboardWorkspaceData {
  summary: DashboardSummary
  moneyFlow: MoneyFlowResponse
  modules: ModulesSummary
  sidebar: DashboardSidebar
}

const DASHBOARD_KEYS = {
  summary: '/api/dashboard/summary',
  moneyFlow: '/api/dashboard/money-flow?months=6&mode=acumulado',
  modules: '/api/dashboard/modules-summary',
  sidebar: '/api/dashboard/sidebar',
} as const

async function fetchWorkspaceData(): Promise<DashboardWorkspaceData> {
  const [summary, moneyFlow, modules, sidebar] = await Promise.all([
    fetchDashboardData<DashboardSummary>(DASHBOARD_KEYS.summary),
    fetchDashboardData<MoneyFlowResponse>(DASHBOARD_KEYS.moneyFlow),
    fetchDashboardData<ModulesSummary>(DASHBOARD_KEYS.modules),
    fetchDashboardData<DashboardSidebar>(DASHBOARD_KEYS.sidebar),
  ])

  return { summary, moneyFlow, modules, sidebar }
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--c-primary-soft)]" />

      <section className="dashboard-grid grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="h-[236px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-8" />

        <div className="grid gap-4 lg:col-span-4">
          <div className="h-[196px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)]" />
          <div className="h-[264px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)]" />
        </div>

        <div className="h-[372px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-7" />
        <div className="h-[220px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-5" />

        <div className="h-[352px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-7" />
        <div className="h-[352px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-5" />

        <div className="h-[278px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-4" />
        <div className="h-[278px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-4" />
        <div className="h-[278px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-4" />

        <div className="h-[236px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-7" />
        <div className="h-[236px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-5" />

        <div className="h-[268px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-7" />
        <div className="h-[268px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-5" />

        <div className="h-[212px] animate-pulse rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] lg:col-span-12" />
      </section>
    </div>
  )
}

function DashboardWorkspaceContent({
  seed,
  onRefresh,
  refreshing,
}: {
  seed: DashboardWorkspaceData
  onRefresh: () => Promise<void>
  refreshing: boolean
}) {
  const fallback = useMemo(
    () => ({
      [DASHBOARD_KEYS.summary]: seed.summary,
      [DASHBOARD_KEYS.moneyFlow]: seed.moneyFlow,
      [DASHBOARD_KEYS.modules]: seed.modules,
      [DASHBOARD_KEYS.sidebar]: seed.sidebar,
    }),
    [seed]
  )

  return (
    <SWRConfig value={{ fallback }}>
      <div className="dashboard-uniform space-y-4 font-[var(--font-body)]">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h1 className="text-[1.1rem] font-semibold tracking-[-0.018em] text-[var(--ft-text)] md:text-[1.22rem]">
            Vista general
          </h1>
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={refreshing}
            className="rounded-lg border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ft-primary)] transition-[background-color,color,transform] duration-200 ease-[var(--ease-out)] hover:bg-[var(--ft-primary)] hover:text-[var(--ft-text-on-primary)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        <section className="dashboard-grid grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="min-w-0 dashboard-enter lg:col-span-8">
            <DashboardHeader />
          </div>

          <div className="grid min-w-0 gap-4 dashboard-enter dashboard-enter-delay-1 lg:col-span-4">
            <FlujoPendienteWidget />
            <VencimientosWidget />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-1 lg:col-span-7">
            <MoneyFlowChart />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-2 lg:col-span-5">
            <FinancialHealthScore />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-2 lg:col-span-7">
            <SaldosDiaChart />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-3 lg:col-span-5">
            <EgresosCategoriasWidget />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-1 lg:col-span-4">
            <SavingsRateTrendChart />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-2 lg:col-span-4">
            <DailyBalanceDeltaChart />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-3 lg:col-span-4">
            <TopCategoriesWidget />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-2 lg:col-span-7">
            <MetricCards />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-3 lg:col-span-5">
            <SaldosBancariosWidget />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-2 lg:col-span-7">
            <PresupuestosMesWidget />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-3 lg:col-span-5">
            <CreditosUsoRapidoWidget />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-3 lg:col-span-12">
            <ModulesMiniCards />
          </div>
        </section>
      </div>
    </SWRConfig>
  )
}

export function DashboardWorkspace() {
  const { mutate } = useSWRConfig()
  const [seed, setSeed] = useState<DashboardWorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true)
    if (mode === 'refresh') setRefreshing(true)

    try {
      const data = await fetchWorkspaceData()
      setSeed(data)
      setError(null)

      await Promise.all([
        mutate(DASHBOARD_KEYS.summary, data.summary, false),
        mutate(DASHBOARD_KEYS.moneyFlow, data.moneyFlow, false),
        mutate(DASHBOARD_KEYS.modules, data.modules, false),
        mutate(DASHBOARD_KEYS.sidebar, data.sidebar, false),
      ])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo cargar el dashboard'
      setError(message)
    } finally {
      if (mode === 'initial') setLoading(false)
      if (mode === 'refresh') setRefreshing(false)
    }
  }, [mutate])

  useEffect(() => {
    void loadData('initial')
  }, [loadData])

  if (loading && !seed) return <WorkspaceSkeleton />

  if (!seed) {
    return (
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--c-danger)_24%,transparent)] bg-[color-mix(in_srgb,var(--c-danger)_10%,transparent)] px-4 py-3 text-[13px] text-[var(--c-danger)]">
        Error al cargar dashboard: {error ?? 'Error desconocido'}
      </div>
    )
  }

  return (
    <DashboardWorkspaceContent
      seed={seed}
      refreshing={refreshing}
      onRefresh={async () => {
        await loadData('refresh')
        await Promise.all([
          mutate('/api/dashboard/saldos-dia?period=5D'),
          mutate('/api/dashboard/saldos-dia?period=1M'),
          mutate('/api/dashboard/saldos-dia?period=3M'),
          mutate('/api/dashboard/saldos-dia?period=6M'),
          mutate('/api/dashboard/saldos-dia?period=1A'),
        ])
      }}
    />
  )
}
