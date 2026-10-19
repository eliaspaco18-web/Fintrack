'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RecordModal } from '@/components/ui/RecordModal'
import { ConfirmDialog } from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import type { CurrencyCode, BudgetPeriod } from '@/types/database.types'
import { createBudgetRecordActionScope } from '@/modules/budgets/budget-action-scope'
import { formatBudgetCurrency } from '@/lib/budgets/presentation'
import { AppSelect } from '@/components/ui/AppSelect'
import styles from '@/components/management/BudgetDetail.module.css'
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
      return { badge: styles.badgeDanger, bar: styles.fillDanger, dot: styles.toneDanger }
    case 'warning':
      return { badge: styles.badgeWarning, bar: styles.fillWarning, dot: styles.toneWarning }
    case 'empty':
      return { badge: '', bar: styles.fillEmpty, dot: styles.toneEmpty }
    default:
      return { badge: styles.badgeOk, bar: styles.fillOk, dot: styles.toneOk }
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
      widthClassName="w-[calc(100vw-40px)] max-w-[1320px]"
      eyebrow="Detalle de presupuesto"
      title={budget.name}
      subtitle={`${formatRange(selectedBudget.period_start, selectedBudget.period_end)}${budget.category ? ` · ${budget.category.name}` : ''}`}
      headerBadge={<span className={`${styles.statusBadge} ${selectedTone.badge}`}><span className={styles.statusDot} aria-hidden="true" />{selectedStatus.label}</span>}
      bodyClassName="!p-0"
      testId="budget-detail-workbench"
    >
      <div className={styles.detailLayout} data-testid="budget-detail-layout">
        <aside className={styles.periodRail} aria-label="Períodos de la serie">
          <div className={styles.periodRailHeader}>
            <div className={styles.periodRailTitleRow}>
              <p className={styles.sectionEyebrow}>Períodos de la serie</p>
              <span className={styles.periodCount}>{visiblePeriods.length}/{seriesPeriods.length}</span>
            </div>
            <div className={styles.periodFilters}>
              <AppSelect
                value={periodYearFilter}
                onChange={setPeriodYearFilter}
                className={styles.periodYearSelect}
                compact
                searchable={false}
                options={periodYearOptions}
                aria-label="Filtrar períodos por año"
              />
              <input
                value={periodSearch}
                onChange={event => setPeriodSearch(event.target.value)}
                placeholder="Buscar período o estado"
                aria-label="Buscar período de presupuesto"
                className={styles.periodSearch}
              />
            </div>
          </div>

          <div className={styles.periodList}>
            {visiblePeriods.length === 0 ? (
              <div className={styles.periodEmpty}>No hay períodos para el filtro seleccionado.</div>
            ) : visiblePeriods.map(period => {
              const selected = period.id === selectedBudget.id
              const periodProgress = clampProgress(period.progress_percent)
              const periodStatus = getPeriodStatus(period)
              const tone = getToneClasses(periodStatus.tone)

              return (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => requestPeriodSelection(period.id)}
                  className={styles.periodOption}
                  data-selected={selected}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`${formatRange(period.period_start, period.period_end)}, ${periodStatus.label}, ${formatBudgetCurrency(Number(period.amount ?? 0), period.currency)}`}
                >
                  <span className={styles.periodOptionTop}>
                    <span className={styles.periodOptionRange}>{formatRange(period.period_start, period.period_end)}</span>
                    <span className={`${styles.periodOptionDot} ${tone.dot}`} aria-hidden="true" />
                  </span>
                  <span className={styles.periodOptionAmounts}>
                    <span className={styles.periodOptionAmount}>{formatBudgetCurrency(Number(period.amount ?? 0), period.currency)} · {periodStatus.label}</span>
                    <span className={styles.periodOptionProgressLabel}>{periodProgress.toFixed(0)}%</span>
                  </span>
                  <span className={styles.progressTrack} aria-hidden="true">
                    <span className={`${styles.progressFill} ${tone.bar}`} style={{ width: `${Math.min(100, periodProgress)}%` }} />
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className={styles.detailMain} aria-label="Detalle del período seleccionado">
          <div className={styles.detailOverview}>
            <div className={styles.periodHeadingRow}>
              <div className={styles.selectedPeriodCopy}>
                <p className={styles.sectionEyebrow}>Período seleccionado</p>
                <h3 className={styles.selectedPeriodDate}>{formatRange(selectedBudget.period_start, selectedBudget.period_end)}</h3>
                <p className={styles.selectedStatusDescription}>{selectedStatus.description}</p>
              </div>

              <form
                onSubmit={event => {
                  event.preventDefault()
                  void savePeriodAmount()
                }}
                className={styles.amountForm}
              >
                <label htmlFor="budget-period-amount" className={styles.amountLabel}>Importe del período</label>
                <div className={styles.amountControl}>
                  <input
                    id="budget-period-amount"
                    value={periodAmount}
                    onChange={event => setPeriodAmount(event.target.value)}
                    inputMode="decimal"
                    className={styles.amountInput}
                    aria-invalid={amountError ? 'true' : 'false'}
                  />
                  <button type="submit" disabled={!amountChanged || amountSaving} className={styles.saveAmountButton}>
                    {amountSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
                {amountError && <p className={styles.inlineError} role="alert">{amountError}</p>}
              </form>
            </div>

            <div className={styles.detailMetrics} aria-label="Resumen del período">
              <div className={styles.detailMetric}>
                <p className={styles.detailMetricLabel}>Presupuesto</p>
                <strong className={styles.detailMetricValue}>{formatBudgetCurrency(Number(selectedBudget.amount ?? 0), selectedBudget.currency)}</strong>
              </div>
              <div className={styles.detailMetric}>
                <p className={styles.detailMetricLabel}>Ejecutado</p>
                <strong className={styles.detailMetricValue}>{formatBudgetCurrency(visibleSpent, selectedBudget.currency)}</strong>
              </div>
              <div className={styles.detailMetric}>
                <p className={styles.detailMetricLabel}>{visibleRemaining < 0 ? 'Exceso' : 'Disponible'}</p>
                <strong className={`${styles.detailMetricValue} ${visibleRemaining < 0 ? styles.detailMetricValueDanger : ''}`}>
                  {formatBudgetCurrency(Math.abs(visibleRemaining), selectedBudget.currency)}
                </strong>
              </div>
            </div>

            <div className={styles.execution}>
              <div className={styles.executionHeading}>
                <span>Ejecución del límite</span>
                <strong className={`${styles.executionPercent} ${selectedBudget.over_limit ? styles.toneDanger : ''}`}>{progress.toFixed(0)}%</strong>
              </div>
              <div className={styles.progressTrack} role="progressbar" aria-label="Ejecución del presupuesto" aria-valuemin={0} aria-valuemax={Math.max(100, progress)} aria-valuenow={progress}>
                <div className={`${styles.progressFill} ${selectedTone.bar}`} style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
            </div>
          </div>

          <div className={styles.transactionToolbar}>
            <div>
              <h4 className={styles.transactionTitle}>Movimientos vinculados</h4>
              {!loading && !error ? <span className={styles.transactionCount}>{filtered.length} movimiento{filtered.length === 1 ? '' : 's'} · {formatRange(selectedBudget.period_start, selectedBudget.period_end)}</span> : null}
            </div>
            <div className={styles.transactionToolbarSearch}>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar descripción, cuenta o destinatario"
                aria-label="Buscar movimientos vinculados"
                className={styles.transactionSearch}
              />
            </div>
          </div>

          <div className={styles.transactionList}>
            {loading ? (
              <div className="space-y-2" aria-label="Cargando movimientos" role="status">
                {[0, 1, 2].map(item => <div key={item} className="h-14 animate-pulse rounded-lg bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />)}
              </div>
            ) : error ? (
              <div className={styles.detailError} role="alert">
                <p className={styles.inlineError}>{error}</p>
                <button type="button" onClick={() => void load()} className={styles.retryButton}>Reintentar</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.detailEmpty}>
                <p className={styles.detailEmptyTitle}>{q ? 'Sin coincidencias' : 'Sin movimientos en este período'}</p>
                <p className={styles.detailEmptyCopy}>{q ? 'Prueba con otra búsqueda.' : 'El resumen del período se conserva aunque todavía no tenga movimientos vinculados.'}</p>
              </div>
            ) : (
              <div className={styles.transactionTable}>
                <div className={styles.transactionHeader} aria-hidden="true">
                  <span>Fecha</span><span>Cuenta</span><span>Destinatario</span><span>Descripción</span><span className="text-right">Importe</span>
                </div>
                {filtered.map(tx => (
                  <div key={tx.id} className={styles.transactionRow}>
                    <div className={`${styles.transactionCell} ${styles.transactionCellMuted}`}>
                      <span className={styles.mobileCellLabel}>Fecha</span>{formatDate(tx.date)}
                    </div>
                    <div className={styles.transactionCell}>
                      <span className={styles.mobileCellLabel}>Cuenta</span>{tx.portfolio ?? '—'}
                    </div>
                    <div className={styles.transactionCell}>
                      <span className={styles.mobileCellLabel}>Destinatario</span>{tx.recipient ?? '—'}
                    </div>
                    <div className={`${styles.transactionCell} ${styles.transactionDescription}`}>
                      <span className={styles.mobileCellLabel}>Descripción</span>{tx.description ?? '—'}
                    </div>
                    <div className={`${styles.transactionCell} ${styles.transactionAmount} ${styles.toneDanger}`}>
                      <span className={styles.mobileCellLabel}>Importe</span>−{formatBudgetCurrency(Number(tx.amount ?? 0), tx.currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <footer className={styles.detailFooter}>
            <div>
              <p className={styles.detailFooterLabel}>Total gastado · {filtered.length} movimiento{filtered.length === 1 ? '' : 's'}</p>
              <p className={styles.detailFooterValue}>{formatBudgetCurrency(Math.round(totalSpent * 100) / 100, selectedBudget.currency)}</p>
            </div>
            <div className={styles.detailFooterSecondary}>
              <p className={styles.detailFooterLabel}>Límite del período</p>
              <p className={styles.detailFooterValue}>{formatBudgetCurrency(Number(selectedBudget.amount ?? 0), selectedBudget.currency)}</p>
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
