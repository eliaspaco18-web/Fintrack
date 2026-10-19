'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RecordModal } from '@/components/ui/RecordModal'
import { ConfirmDialog } from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import type { CurrencyCode, BudgetPeriod } from '@/types/database.types'
import { createBudgetRecordActionScope } from '@/modules/budgets/budget-action-scope'
import { formatBudgetCurrency } from '@/lib/budgets/presentation'
import { AppSelect } from '@/components/ui/AppSelect'
import {
  mergeBudgetPeriodItems,
  resolveBudgetPeriodAmountUrl,
  resolveBudgetPeriodTransactionsUrl,
} from '@/lib/budgets/period-record'

// ── Types ──────────────────────────────────────────────────────────────────

type BudgetRef = {
  id: string
  budget_period_id?: string
  legacy_budget_id?: string
  series_id: string
  name: string
  description: string | null
  category_id: string | null
  currency: CurrencyCode
  period_type: BudgetPeriod
  start_date: string
  end_date: string | null
  period_start: string
  period_end: string
  amount: number
  spent_amount: number
  remaining_amount?: number
  progress_percent?: number
  over_limit?: boolean
  is_active?: boolean
  category?: { name: string } | null
}

type TxRow = {
  id: string
  date: string
  portfolio: string | null
  recipient: string | null
  description: string | null
  amount: number
  currency: CurrencyCode
  exchange_rate: number | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  return `${fmt(start)} → ${fmt(end)}`
}

function formatRangeCompact(start: string, end: string): string {
  const startDate = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)
  const month = startDate.toLocaleDateString('es-PE', { month: 'short' })
  const year = startDate.toLocaleDateString('es-PE', { year: 'numeric' })
  const startDay = startDate.toLocaleDateString('es-PE', { day: '2-digit' })
  const endDay = endDate.toLocaleDateString('es-PE', { day: '2-digit' })
  return `${month} ${year} · ${startDay}-${endDay}`
}

function formatDate(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  budget: BudgetRef
  periods?: BudgetRef[]
  onClose: () => void
  onExitComplete?: () => void
  onPeriodUpdated?: () => void | Promise<void>
}

function clampProgress(value: number | null | undefined): number {
  return Math.max(0, Math.min(100, Number(value ?? 0)))
}

function getYearFromDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-PE', {
    year: 'numeric',
  })
}

function getPeriodYear(period: BudgetRef): string {
  return getYearFromDate(period.period_start)
}

function getPeriodStatus(period: BudgetRef): {
  label: string
  tone: 'ok' | 'warning' | 'danger' | 'empty'
  description: string
} {
  const spent = Number(period.spent_amount ?? 0)
  const progress = clampProgress(period.progress_percent)

  if (period.over_limit) {
    return {
      label: 'Excedido',
      tone: 'danger',
      description: `Exceso ${formatBudgetCurrency(Math.abs(Number(period.remaining_amount ?? 0)), period.currency)}`,
    }
  }

  if (spent <= 0) {
    return {
      label: 'Sin movimientos',
      tone: 'empty',
      description: 'Sin gasto registrado',
    }
  }

  if (progress >= 80) {
    return {
      label: 'En riesgo',
      tone: 'warning',
      description: 'Cerca del limite',
    }
  }

  return {
    label: 'En rango',
    tone: 'ok',
    description: `Disponible ${formatBudgetCurrency(Math.max(0, Number(period.remaining_amount ?? 0)), period.currency)}`,
  }
}

function getToneClasses(tone: 'ok' | 'warning' | 'danger' | 'empty') {
  switch (tone) {
    case 'danger':
      return {
        badge: 'border-red-400/30 bg-red-500/10 text-red-500',
        bar: 'bg-red-500',
        dot: 'bg-red-500',
      }
    case 'warning':
      return {
        badge: 'border-amber-400/35 bg-amber-500/10 text-amber-600',
        bar: 'bg-amber-500',
        dot: 'bg-amber-500',
      }
    case 'empty':
      return {
        badge: 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text-muted)]',
        bar: 'bg-[var(--c-text-faint)]',
        dot: 'bg-[var(--c-text-faint)]',
      }
    default:
      return {
        badge: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-600',
        bar: 'bg-[var(--c-accent)]',
        dot: 'bg-[var(--c-accent)]',
      }
  }
}

function parseAmountInput(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100) / 100
}

export function BudgetDetail({ open, budget, periods, onClose, onExitComplete, onPeriodUpdated }: Props) {
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedBudgetId, setSelectedBudgetId] = useState(budget.id)
  const [periodItems, setPeriodItems] = useState<BudgetRef[]>(() => mergeBudgetPeriodItems(periods, budget))
  const [periodAmount, setPeriodAmount] = useState(() => Number(budget.amount ?? 0).toFixed(2))
  const [amountSaving, setAmountSaving] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [periodYearFilter, setPeriodYearFilter] = useState(() => getPeriodYear(budget))
  const [periodSearch, setPeriodSearch] = useState('')
  const [discardAmountConfirmationOpen, setDiscardAmountConfirmationOpen] = useState(false)
  const [pendingPeriodSelectionId, setPendingPeriodSelectionId] = useState<string | null>(null)
  const requestSequenceRef = useRef(0)

  const seriesPeriods = useMemo(
    () => periodItems.slice().sort((a, b) => a.period_start.localeCompare(b.period_start)),
    [periodItems],
  )

  const periodYears = useMemo(
    () => Array.from(new Set(seriesPeriods.map(period => getPeriodYear(period)))),
    [seriesPeriods],
  )
  const periodYearOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos' },
      ...periodYears.map(year => ({ value: year, label: year })),
    ],
    [periodYears],
  )
  const baseBudgetYear = useMemo(() => getYearFromDate(budget.period_start), [budget.period_start])

  const visiblePeriods = useMemo(() => {
    const search = periodSearch.trim().toLowerCase()
    return seriesPeriods.filter(period => {
      if (periodYearFilter !== 'all' && getPeriodYear(period) !== periodYearFilter) return false
      if (!search) return true
      const status = getPeriodStatus(period)
      return (
        formatRange(period.period_start, period.period_end).toLowerCase().includes(search) ||
        formatRangeCompact(period.period_start, period.period_end).toLowerCase().includes(search) ||
        status.label.toLowerCase().includes(search)
      )
    })
  }, [periodSearch, periodYearFilter, seriesPeriods])

  const selectedBudget = useMemo(
    () => seriesPeriods.find(period => period.id === selectedBudgetId) ?? seriesPeriods[0] ?? budget,
    [budget, selectedBudgetId, seriesPeriods],
  )

  const selectedStatus = getPeriodStatus(selectedBudget)
  const selectedTone = getToneClasses(selectedStatus.tone)

  useEffect(() => {
    setSelectedBudgetId(budget.id)
    setQuery('')
    setPeriodSearch('')
    setPeriodYearFilter(baseBudgetYear)
  }, [baseBudgetYear, budget.id])

  useEffect(() => {
    const nextPeriods = mergeBudgetPeriodItems(periods, budget)
    setPeriodItems(nextPeriods)
    setSelectedBudgetId(prev => (nextPeriods.some(period => period.id === prev) ? prev : budget.id))
  }, [budget, periods])

  useEffect(() => {
    setPeriodAmount(Number(selectedBudget.amount ?? 0).toFixed(2))
    setAmountError(null)
  }, [selectedBudget.id, selectedBudget.amount])

  const load = useCallback(async () => {
    const sequence = ++requestSequenceRef.current
    setLoading(true)
    setError(null)
    try {
      const endpoint = resolveBudgetPeriodTransactionsUrl(selectedBudget)
      const res = await fetch(endpoint, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las transacciones'))
      }
      if (sequence !== requestSequenceRef.current) return
      setTransactions((json.data as TxRow[]) ?? [])
    } catch (caught) {
      if (sequence === requestSequenceRef.current) {
        setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las transacciones')
      }
    } finally {
      if (sequence === requestSequenceRef.current) setLoading(false)
    }
  }, [selectedBudget])

  useEffect(() => {
    void load()
  }, [load])

  const q = query.trim().toLowerCase()
  const filtered = transactions.filter(tx => {
    if (!q) return true
    return (
      (tx.description ?? '').toLowerCase().includes(q) ||
      (tx.portfolio ?? '').toLowerCase().includes(q) ||
      (tx.recipient ?? '').toLowerCase().includes(q)
    )
  })

  // Total gastado en la moneda del presupuesto
  const safeRate = (r: number | null) => (r && r > 0 ? r : 3.7)
  const totalSpent = filtered.reduce((sum, tx) => {
    const amt = Number(tx.amount ?? 0)
    if (tx.currency === selectedBudget.currency) return sum + amt
    if (tx.currency === 'USD' && selectedBudget.currency === 'PEN') return sum + amt * safeRate(tx.exchange_rate)
    if (tx.currency === 'PEN' && selectedBudget.currency === 'USD') return sum + amt / safeRate(tx.exchange_rate)
    return sum + amt
  }, 0)

  const progress = clampProgress(selectedBudget.progress_percent)
  const visibleSpent = Number(selectedBudget.spent_amount ?? 0)
  const visibleRemaining = Number(selectedBudget.remaining_amount ?? Number(selectedBudget.amount ?? 0) - visibleSpent)
  const parsedPeriodAmount = parseAmountInput(periodAmount)
  const amountChanged =
    parsedPeriodAmount !== null && Math.abs(parsedPeriodAmount - Number(selectedBudget.amount ?? 0)) >= 0.01
  const hasAmountDraft = periodAmount !== Number(selectedBudget.amount ?? 0).toFixed(2)

  const requestClose = useCallback(() => {
    if (amountSaving) return
    if (hasAmountDraft) {
      setDiscardAmountConfirmationOpen(true)
      return
    }
    onClose()
  }, [amountSaving, hasAmountDraft, onClose])

  const requestPeriodSelection = useCallback((periodId: string) => {
    if (hasAmountDraft) {
      setPendingPeriodSelectionId(periodId)
      setDiscardAmountConfirmationOpen(true)
      return
    }
    setSelectedBudgetId(periodId)
  }, [hasAmountDraft])

  const discardAmountDraft = useCallback(() => {
    setDiscardAmountConfirmationOpen(false)
    if (pendingPeriodSelectionId) {
      setSelectedBudgetId(pendingPeriodSelectionId)
      setPendingPeriodSelectionId(null)
      return
    }
    onClose()
  }, [onClose, pendingPeriodSelectionId])

  async function savePeriodAmount() {
    const nextAmount = parseAmountInput(periodAmount)
    if (nextAmount === null) {
      setAmountError('Ingresa un importe mayor a cero.')
      return
    }

    setAmountSaving(true)
    setAmountError(null)
    try {
      const endpoint = resolveBudgetPeriodAmountUrl(selectedBudget)
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedBudget.budget_period_id
            ? { amount: nextAmount }
            : {
                amount: nextAmount,
                action_scope: createBudgetRecordActionScope({
                  ...selectedBudget,
                  id: selectedBudget.legacy_budget_id ?? selectedBudget.id,
                }),
              }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el importe del periodo'))
      }

      setPeriodItems(prev =>
        prev.map(period => {
          if (period.id !== selectedBudget.id) return period
          const spent = Number(period.spent_amount ?? 0)
          const remaining = nextAmount - spent
          return {
            ...period,
            amount: nextAmount,
            remaining_amount: remaining,
            progress_percent: nextAmount > 0 ? Math.round((spent / nextAmount) * 10000) / 100 : 0,
            over_limit: spent > nextAmount,
          }
        }),
      )
      await onPeriodUpdated?.()
    } catch (caught) {
      setAmountError(caught instanceof Error ? caught.message : 'No se pudo actualizar el importe del periodo')
    } finally {
      setAmountSaving(false)
    }
  }

  return (
    <RecordModal
      open={open}
      onClose={requestClose}
      onExitComplete={onExitComplete}
      presentation="workbench"
      size="xl"
      widthClassName="w-[calc(100vw-32px)] max-w-[1120px]"
      eyebrow="Detalle de presupuesto"
      title={budget.name}
      subtitle={`${formatRange(selectedBudget.period_start, selectedBudget.period_end)}${budget.category ? ` · ${budget.category.name}` : ''}`}
      headerBadge={<span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${selectedTone.badge}`}>{selectedStatus.label}</span>}
      bodyClassName="!p-0"
      testId="budget-detail-workbench"
    >
          <div className="grid min-h-[min(68dvh,680px)] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-b border-[var(--c-border)] bg-[var(--c-surface-2)] lg:border-b-0 lg:border-r">
              <div className="border-b border-[var(--c-border)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase text-[var(--c-text-muted)]">
                    Periodos de la serie
                  </p>
                  <span className="rounded-md bg-[var(--c-surface)] px-2 py-1 text-[11px] text-[var(--c-text-muted)]">
                    {visiblePeriods.length}/{seriesPeriods.length}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <AppSelect
                    value={periodYearFilter}
                    onChange={setPeriodYearFilter}
                    className="w-full"
                    compact
                    searchable={false}
                    options={periodYearOptions}
                    aria-label="Filtrar periodos por año"
                  />
                  <input
                    value={periodSearch}
                    onChange={event => setPeriodSearch(event.target.value)}
                    placeholder="Buscar periodo o estado..."
                    className="field-base h-9 w-full px-3 text-[12px]"
                  />
                </div>
              </div>

              <div className="min-h-[220px] flex-1 overflow-y-auto px-3 py-3">
                {visiblePeriods.length === 0 ? (
                  <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-4 text-center">
                    <p className="text-[12px] leading-5 text-[var(--c-text-muted)]">
                      No hay periodos para el filtro seleccionado.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {visiblePeriods.map(period => {
                      const selected = period.id === selectedBudget.id
                      const periodProgress = clampProgress(period.progress_percent)
                      const periodStatus = getPeriodStatus(period)
                      const tone = getToneClasses(periodStatus.tone)

                      return (
                        <button
                          key={period.id}
                          type="button"
                          onClick={() => requestPeriodSelection(period.id)}
                          className={`min-h-[86px] rounded-xl border px-2.5 py-2 text-left transition-all duration-200 active:scale-[0.99] ${
                            selected
                              ? 'border-[var(--c-accent)] bg-[var(--c-surface)] shadow-sm text-[var(--c-text)]'
                              : 'border-transparent bg-[var(--c-surface)]/75 text-[var(--c-text-muted)] hover:border-[var(--c-border-hover)] hover:bg-[var(--c-surface)] hover:text-[var(--c-text)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] font-semibold text-[var(--c-text)]">
                              {formatRangeCompact(period.period_start, period.period_end)}
                            </span>
                            <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                          </div>
                          <div className="mt-1 flex items-baseline justify-between gap-2">
                            <span className="truncate text-[10px] tabular-nums text-[var(--c-text-faint)]">
                              {formatBudgetCurrency(Number(period.amount ?? 0), period.currency)}
                            </span>
                            <span className="text-[10px] font-semibold tabular-nums text-[var(--c-text-muted)]">
                              {periodProgress.toFixed(0)}%
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--c-border)]">
                            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, periodProgress)}%` }} />
                          </div>
                          <span className={`mt-2 inline-flex max-w-full rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${tone.badge}`}>
                            <span className="truncate">{periodStatus.label}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col">
              <div className="border-b border-[var(--c-border)] px-5 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase text-[var(--c-text-muted)]">Periodo seleccionado</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--c-text)]">
                      {formatRange(selectedBudget.period_start, selectedBudget.period_end)}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--c-text-faint)]">{selectedStatus.description}</p>
                  </div>

                  <form
                    onSubmit={event => {
                      event.preventDefault()
                      void savePeriodAmount()
                    }}
                    className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-3 xl:w-[360px]"
                  >
                    <label htmlFor="budget-period-amount" className="text-[10px] font-semibold uppercase text-[var(--c-text-muted)]">
                      Importe del periodo
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        id="budget-period-amount"
                        value={periodAmount}
                        onChange={event => setPeriodAmount(event.target.value)}
                        inputMode="decimal"
                        className="field-base min-w-0 flex-1 px-3 py-2 text-sm font-semibold tabular-nums"
                        aria-invalid={amountError ? 'true' : 'false'}
                      />
                      <button
                        type="submit"
                        disabled={!amountChanged || amountSaving}
                        className="rounded-lg bg-[var(--c-accent)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {amountSaving ? 'Guardando' : 'Guardar'}
                      </button>
                    </div>
                    {amountError && <p className="mt-2 text-[11px] text-red-500">{amountError}</p>}
                  </form>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase text-[var(--c-text-muted)]">Presupuesto</p>
                    <p className="mt-1 text-base font-bold tabular-nums text-[var(--c-text)]">
                      {formatBudgetCurrency(Number(selectedBudget.amount ?? 0), selectedBudget.currency)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase text-[var(--c-text-muted)]">Ejecutado</p>
                    <p className="mt-1 text-base font-bold tabular-nums text-[var(--c-text)]">
                      {formatBudgetCurrency(visibleSpent, selectedBudget.currency)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase text-[var(--c-text-muted)]">
                      {visibleRemaining < 0 ? 'Exceso' : 'Disponible'}
                    </p>
                    <p className={`mt-1 text-base font-bold tabular-nums ${visibleRemaining < 0 ? 'text-red-500' : 'text-[var(--c-text)]'}`}>
                      {formatBudgetCurrency(Math.abs(visibleRemaining), selectedBudget.currency)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-semibold text-[var(--c-text-muted)]">Ejecucion</span>
                    <span className={`font-bold tabular-nums ${selectedBudget.over_limit ? 'text-red-500' : 'text-[var(--c-text)]'}`}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--c-border)]">
                    <div className={`h-full rounded-full ${selectedTone.bar}`} style={{ width: `${Math.min(100, progress)}%` }} />
                  </div>
                </div>
              </div>

              <div className="border-b border-[var(--c-border)] px-5 py-3">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por descripcion, portafolio o destinatario..."
                  className="field-base w-full"
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {loading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map(item => (
                      <div key={item} className="h-14 animate-pulse rounded-xl bg-[var(--c-surface-2)]" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-center">
                    <p className="text-[12px] text-red-500">{error}</p>
                    <button
                      type="button"
                      onClick={() => void load()}
                      className="rounded-md border border-red-400/35 px-3 py-1.5 text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-500/10"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface-2)] px-6 text-center">
                    <p className="text-sm font-semibold text-[var(--c-text)]">
                      {q ? 'Sin coincidencias' : 'Sin transacciones en este periodo'}
                    </p>
                    <p className="mt-1 max-w-sm text-[12px] leading-5 text-[var(--c-text-muted)]">
                      {q
                        ? 'Prueba con otro termino de busqueda.'
                        : 'El periodo mantiene su tamano y sus indicadores aunque todavia no tenga movimientos asociados.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_120px] gap-3 px-3 text-[10px] font-semibold uppercase text-[var(--c-text-faint)] md:grid">
                      <span>Fecha</span>
                      <span>Portafolio</span>
                      <span>Destinatario</span>
                      <span>Descripcion</span>
                      <span className="text-right">Importe</span>
                    </div>

                    {filtered.map(tx => (
                      <div
                        key={tx.id}
                        className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_120px] md:items-center"
                      >
                        <div>
                          <p className="text-[10px] uppercase text-[var(--c-text-faint)] md:hidden">Fecha</p>
                          <p className="text-[12px] text-[var(--c-text-muted)]">{formatDate(tx.date)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase text-[var(--c-text-faint)] md:hidden">Portafolio</p>
                          <p className="truncate text-[13px] text-[var(--c-text)]">{tx.portfolio ?? '-'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase text-[var(--c-text-faint)] md:hidden">Destinatario</p>
                          <p className="truncate text-[13px] text-[var(--c-text)]">{tx.recipient ?? '-'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase text-[var(--c-text-faint)] md:hidden">Descripcion</p>
                          <p className="text-[13px] leading-5 text-[var(--c-text)]">{tx.description ?? '-'}</p>
                        </div>
                        <div className="md:text-right">
                          <p className="text-[10px] uppercase text-[var(--c-text-faint)] md:hidden">Importe</p>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-red-500">
                            -{formatBudgetCurrency(Number(tx.amount ?? 0), tx.currency)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <footer className="flex items-center justify-between gap-4 border-t border-[var(--c-border)] px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-[var(--c-text-muted)]">
                    Total gastado ({filtered.length} transaccion{filtered.length !== 1 ? 'es' : ''})
                  </p>
                  <p className="text-lg font-bold tabular-nums text-[var(--c-text)]">
                    {formatBudgetCurrency(Math.round(totalSpent * 100) / 100, selectedBudget.currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase text-[var(--c-text-muted)]">Presupuesto</p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--c-text-muted)]">
                    {formatBudgetCurrency(Number(selectedBudget.amount ?? 0), selectedBudget.currency)}
                  </p>
                </div>
              </footer>
            </section>
          </div>
      <ConfirmDialog
        open={discardAmountConfirmationOpen}
        title="Descartar cambio de importe"
        message="El nuevo límite del período aún no se ha guardado. ¿Quieres cerrar y descartarlo?"
        onCancel={() => { setDiscardAmountConfirmationOpen(false); setPendingPeriodSelectionId(null) }}
        onConfirm={discardAmountDraft}
        confirmLabel="Descartar cambio"
        testId="budget-detail-discard-modal"
      />
    </RecordModal>
  )
}
