'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { ProgressMetric } from '@/components/finance'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'
import { chartTheme } from './chartTheme'

type BudgetWidgetItem = {
  id: string
  name: string
  amount: number
  currency: 'PEN' | 'USD'
  spent_amount: number
  progress_percent: number
  over_limit: boolean
  period_start: string
  period_end: string
}

type BudgetPeriodWidgetItem = {
  id: string
  amount: number
  spent_amount: number
  progress_percent: number
  over_limit: boolean
  period_start: string
  period_end: string
  budget: {
    name: string
    currency: 'PEN' | 'USD'
  }
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toPeriodLabel(start: string, end: string) {
  const startLabel = new Date(`${start}T12:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
  })
  const endLabel = new Date(`${end}T12:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
  })
  return `${startLabel} → ${endLabel}`
}

function budgetTone(item: BudgetWidgetItem): 'primary' | 'warning' | 'danger' {
  if (item.over_limit || item.progress_percent >= 100) return 'danger'
  if (item.progress_percent >= 80) return 'warning'
  return 'primary'
}

function fromBudgetPeriod(item: BudgetPeriodWidgetItem): BudgetWidgetItem {
  return {
    id: item.id,
    name: item.budget.name,
    amount: item.amount,
    currency: item.budget.currency,
    spent_amount: item.spent_amount,
    progress_percent: item.progress_percent,
    over_limit: item.over_limit,
    period_start: item.period_start,
    period_end: item.period_end,
  }
}

export function PresupuestosMesWidget() {
  const localDate = formatLocalDate(new Date())
  const monthLabel = new Date(`${localDate}T12:00:00`).toLocaleDateString('es-PE', {
    month: 'long',
    year: 'numeric',
  })
  const periodMonth = localDate.slice(0, 7)
  const legacyQueryKey = `/api/budgets?is_active=true&transaction_date=${localDate}`
  const queryKey = `/api/budget-periods?period=${periodMonth}`
  const { data, isLoading } = useSWR(queryKey, async (url: string) => {
    try {
      const periodRows = await fetchDashboardData<BudgetPeriodWidgetItem[]>(url)
      return periodRows.map(fromBudgetPeriod)
    } catch {
      return fetchDashboardData<BudgetWidgetItem[]>(legacyQueryKey)
    }
  }, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const budgets = data ?? []
  const totalDefined = budgets.reduce((sum, budget) => sum + Number(budget.amount ?? 0), 0)
  const totalExecuted = budgets.reduce((sum, budget) => sum + Number(budget.spent_amount ?? 0), 0)
  const totalProgress = totalDefined > 0
    ? Math.max(0, Math.min(100, (totalExecuted / totalDefined) * 100))
    : 0
  const visibleBudgets = budgets.slice(0, 3)

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-40 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-16 rounded-[18px] bg-[var(--ft-surface-muted)]" />
          <div className="h-24 rounded-[18px] bg-[var(--ft-surface-muted)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Presupuestos del mes
          </p>
          <p className="mt-1 text-[11px] capitalize text-[var(--ft-text-muted)]">{monthLabel}</p>
        </div>

        <Link
          href="/budgets"
          className="group inline-flex items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-2 py-1.5 text-[11px] font-semibold text-[var(--ft-text)] transition-[border-color,background-color,transform] duration-200 ease-[var(--ease-out)] hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)] active:scale-[0.98]"
        >
          <span>Ir a Presupuestos</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface)] text-[var(--ft-primary)] transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
            ↗
          </span>
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">Monto definido</p>
          <p className="mt-2 text-[1.2rem] font-semibold tabular-nums tracking-[-0.03em] text-[var(--ft-text)]">
            {formatCurrency(totalDefined, 'PEN')}
          </p>
        </div>

        <div className="rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">Monto ejecutado</p>
          <p
            className="mt-2 text-[1.2rem] font-semibold tabular-nums tracking-[-0.03em]"
            style={{ color: totalProgress >= 100 ? chartTheme.negative : chartTheme.warning }}
          >
            {formatCurrency(totalExecuted, 'PEN')}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-4 py-4">
        <ProgressMetric
          value={totalProgress}
          label="Ejecución agregada"
          valueLabel={`${formatNumber(totalProgress, { maximumFractionDigits: 1 })}%`}
          tone={totalProgress >= 100 ? 'danger' : totalProgress >= 80 ? 'warning' : 'primary'}
          description={`${budgets.length} presupuesto${budgets.length === 1 ? '' : 's'} activo${budgets.length === 1 ? '' : 's'} durante ${monthLabel}.`}
        />
      </div>

      {visibleBudgets.length === 0 ? (
        <p className="mt-4 text-[12px] leading-6 text-[var(--ft-text-muted)]">
          No hay presupuestos activos para la fecha actual.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleBudgets.map((budget) => (
            <div key={budget.id} className="rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--ft-text)]">
                    {budget.name}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--ft-text-muted)]">
                    {toPeriodLabel(budget.period_start, budget.period_end)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-semibold tabular-nums text-[var(--ft-text)]">
                    {formatCurrency(budget.spent_amount, budget.currency)}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">
                    de {formatCurrency(budget.amount, budget.currency)}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <ProgressMetric
                  value={budget.progress_percent}
                  label="Uso del presupuesto"
                  valueLabel={`${formatNumber(budget.progress_percent, { maximumFractionDigits: 1 })}%`}
                  tone={budgetTone(budget)}
                  description={budget.over_limit ? 'Este presupuesto ya excedió su límite activo.' : 'Seguimiento del período activo en curso.'}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </PremiumCard>
  )
}
