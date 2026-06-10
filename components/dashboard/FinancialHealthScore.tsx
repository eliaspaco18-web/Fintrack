'use client'

import useSWR from 'swr'
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type {
  DashboardSidebar,
  DashboardSummary,
  ModulesSummary,
} from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const summaryFetcher = (url: string) => fetchDashboardData<DashboardSummary>(url)
const modulesFetcher = (url: string) => fetchDashboardData<ModulesSummary>(url)
const sidebarFetcher = (url: string) => fetchDashboardData<DashboardSidebar>(url)

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function daysUntil(dueDate: string) {
  const today = new Date()
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const due = new Date(`${dueDate}T00:00:00Z`)
  return Math.floor((due.getTime() - base.getTime()) / 86_400_000)
}

function scoreTone(score: number) {
  if (score >= 75) {
    return {
      color: 'var(--c-primary)',
      label: 'Salud sólida',
      ring: 'bg-[var(--c-primary-soft)] text-[var(--c-primary)] border-[var(--c-primary-border)]',
    }
  }

  if (score >= 55) {
    return {
      color: 'var(--c-warning)',
      label: 'Atención moderada',
      ring: 'border-[color-mix(in_srgb,var(--c-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--c-warning)_10%,transparent)] text-[var(--c-warning)]',
    }
  }

  return {
    color: 'var(--c-danger)',
    label: 'Presión financiera',
    ring: 'border-[color-mix(in_srgb,var(--c-danger)_24%,transparent)] bg-[color-mix(in_srgb,var(--c-danger)_10%,transparent)] text-[var(--c-danger)]',
  }
}

function HealthFactor({
  label,
  helper,
  value,
  max,
  color,
}: {
  label: string
  helper: string
  value: number
  max: number
  color: string
}) {
  const pct = max === 0 ? 0 : clamp((value / max) * 100, 0, 100)

  return (
    <div className="rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[var(--c-text)]">{label}</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--c-text-muted)]">{helper}</p>
        </div>
        <span
          className="shrink-0 text-[11px] font-semibold tabular-nums"
          style={{ color }}
        >
          {formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/{max}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--c-surface)]">
        <div
          className="h-full rounded-full transition-[width,opacity] duration-700 ease-[var(--ease-out)]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function FinancialHealthScore() {
  const { data: summary } = useSWR('/api/dashboard/summary', summaryFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })
  const { data: modules } = useSWR('/api/dashboard/modules-summary', modulesFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })
  const { data: sidebar, isLoading } = useSWR('/api/dashboard/sidebar', sidebarFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  if (isLoading && !summary && !modules && !sidebar) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-40 rounded bg-[var(--c-surface-2)]" />
          <div className="grid gap-4 lg:grid-cols-[132px_minmax(0,1fr)]">
            <div className="h-[132px] rounded-full bg-[var(--c-surface-2)]" />
            <div className="space-y-3">
              <div className="h-[68px] rounded-[18px] bg-[var(--c-surface-2)]" />
              <div className="h-[68px] rounded-[18px] bg-[var(--c-surface-2)]" />
            </div>
          </div>
        </div>
      </PremiumCard>
    )
  }

  const ingresosMes = summary?.ingresos_mes ?? 0
  const egresosMes = summary?.egresos_mes ?? 0
  const creditUsage = modules?.creditos_uso_pct ?? 0
  const pendingNet = sidebar?.flujo_pendiente.neto ?? 0
  const criticalDueCount = (sidebar?.vencimientos_proximos ?? []).filter((item) => daysUntil(item.due_date) <= 0).length

  const savingsRate = ingresosMes > 0 ? ((ingresosMes - egresosMes) / ingresosMes) * 100 : 0
  const savingsScore = clamp(savingsRate * 1.4, 0, 35)
  const creditScore = clamp(25 - Math.max(0, creditUsage - 30) * 0.45, 0, 25)
  const alertScore = clamp(20 - (summary?.alertas_pendientes ?? 0) * 3, 0, 20)
  const pendingScore = pendingNet >= 0 ? 20 : 10
  const healthScore = Math.round(savingsScore + creditScore + alertScore + pendingScore)
  const tone = scoreTone(healthScore)
  const scoreData = [{ name: 'score', value: healthScore }]

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-text-faint)]">
            Salud financiera
          </p>
          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
            Lectura editorial sobre ahorro, crédito, alertas y flujo pendiente.
          </p>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone.ring}`}>
          {tone.label}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[132px_minmax(0,1fr)] lg:items-center">
        <div className="relative h-[132px]">
          <ResponsiveContainer>
            <RadialBarChart
              data={scoreData}
              innerRadius="72%"
              outerRadius="94%"
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                dataKey="value"
                cornerRadius={12}
                fill={tone.color}
                background={{ fill: 'var(--c-surface-2)' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-[2rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--c-text)]">
                {healthScore}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
                sobre 100
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <HealthFactor
            label="Ahorro"
            helper={`${formatNumber(savingsRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% del ingreso mensual`}
            value={savingsScore}
            max={35}
            color="var(--c-primary)"
          />
          <HealthFactor
            label="Crédito"
            helper={`${formatNumber(creditUsage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% de uso total`}
            value={creditScore}
            max={25}
            color="var(--c-accent-landing)"
          />
          <HealthFactor
            label="Alertas"
            helper={`${summary?.alertas_pendientes ?? 0} alertas y ${criticalDueCount} críticas hoy`}
            value={alertScore}
            max={20}
            color="var(--c-warning)"
          />
          <HealthFactor
            label="Pendiente"
            helper={`${pendingNet >= 0 ? 'Flujo a favor' : 'Flujo en contra'} por S/ ${formatNumber(Math.abs(pendingNet), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            value={pendingScore}
            max={20}
            color={pendingNet >= 0 ? 'var(--c-primary)' : 'var(--c-danger)'}
          />
        </div>
      </div>
    </PremiumCard>
  )
}
