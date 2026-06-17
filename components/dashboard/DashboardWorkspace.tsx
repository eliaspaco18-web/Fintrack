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
import { AlertBanner } from './AlertBanner'
import { DashboardHeader } from './DashboardHeader'
import { MoneyFlowChart } from './MoneyFlowChart'
import { CashFlowProjectionWidget } from './CashFlowProjectionWidget'
import { SaldosDiaChart } from './SaldosDiaChart'
import { SaldosBancariosWidget } from './SaldosBancariosWidget'
import { EgresosCategoriasWidget } from './EgresosCategoriasWidget'
import { VencimientosWidget } from './VencimientosWidget'
import { FinancialHealthScore } from './FinancialHealthScore'
import { SavingsRateTrendChart } from './SavingsRateTrendChart'
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-[var(--ft-surface-muted)]" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-[var(--ft-surface-muted)]" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[154px] animate-pulse rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)]" />
        ))}
      </div>

      <section className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[7fr_5fr]">
        <div className="grid gap-3">
          <div className="h-[370px] animate-pulse rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)]" />
          <div className="h-[352px] animate-pulse rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)]" />
          <div className="h-[360px] animate-pulse rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)]" />
        </div>
        <div className="grid gap-3">
          <div className="h-[420px] animate-pulse rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)]" />
          <div className="h-[260px] animate-pulse rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)]" />
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-[360px] animate-pulse rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)]" />
        <div className="h-[260px] animate-pulse rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)]" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[278px] animate-pulse rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)]" />
        ))}
      </div>
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
      <div className="dashboard-uniform space-y-3 font-[var(--font-body)]">
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

        <div className="dashboard-enter">
          <AlertBanner />
        </div>

        <section className="dashboard-enter dashboard-enter-delay-1">
          <DashboardHeader />
        </section>

        <section className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[7fr_5fr]">
          <div className="grid min-w-0 gap-3">
            <div className="min-w-0 dashboard-enter dashboard-enter-delay-1">
              <MoneyFlowChart />
            </div>

            <div className="min-w-0 dashboard-enter dashboard-enter-delay-2">
              <SaldosDiaChart />
            </div>

            <div className="min-w-0 dashboard-enter dashboard-enter-delay-2">
              <CashFlowProjectionWidget />
            </div>
          </div>

          <div className="grid min-w-0 gap-3">
            <div className="min-w-0 dashboard-enter dashboard-enter-delay-2">
              <FinancialHealthScore />
            </div>

            <div className="min-w-0 dashboard-enter dashboard-enter-delay-3">
              <VencimientosWidget />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
          <div className="min-w-0 dashboard-enter dashboard-enter-delay-2">
            <EgresosCategoriasWidget />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-3">
            <SavingsRateTrendChart />
          </div>
        </section>

        <section className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
          <div className="min-w-0 dashboard-enter dashboard-enter-delay-2">
            <PresupuestosMesWidget />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-3">
            <CreditosUsoRapidoWidget />
          </div>

          <div className="min-w-0 dashboard-enter dashboard-enter-delay-3">
            <SaldosBancariosWidget />
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
      <div className="rounded-2xl border border-[color-mix(in_oklch,var(--ft-danger)_24%,transparent)] bg-[color-mix(in_oklch,var(--ft-danger)_10%,transparent)] px-4 py-3 text-[13px] text-[var(--ft-danger)]">
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
          mutate('/api/dashboard/alerts'),
        ])
      }}
    />
  )
}
