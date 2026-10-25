'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RecordModal } from '@/components/ui/RecordModal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import type { CurrencyCode, BudgetPeriod } from '@/types/database.types'
import { createBudgetRecordActionScope } from '@/modules/budgets/budget-action-scope'
import { formatBudgetCurrency } from '@/lib/budgets/presentation'
import { convertBudgetAmount } from '@/lib/budgets/budget-metrics'
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
  spent_amount: number | null
  remaining_amount?: number | null
  progress_percent?: number | null
  over_limit?: boolean | null
  metrics_complete?: boolean
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
  suspendFocusTrap?: boolean
  onClose: () => void
  onExitComplete?: () => void
  onPeriodUpdated?: () => void | Promise<void>
  onContinueNextPeriod?: () => void
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
  if (period.metrics_complete === false || period.spent_amount === null || period.remaining_amount === null) {
    return {
      label: 'Datos incompletos',
      tone: 'empty',
      description: 'Falta una tasa histórica verificable para calcular el período',
    }
  }
  const spent = Number(period.spent_amount ?? 0)
  const progress = clampProgress(period.progress_percent)

  if (period.over_limit) {
    return {
      label: 'Excedido',
      tone: 'danger',
      description: 'El gasto supera el límite del período',
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
      description: 'El gasto se acerca al límite definido',
    }
  }

  return {
    label: 'En rango',
    tone: 'ok',
    description: 'El gasto se mantiene dentro del límite',
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

export function BudgetDetail({ open, budget, periods, suspendFocusTrap = false, onClose, onExitComplete, onPeriodUpdated, onContinueNextPeriod }: Props) {
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedBudgetId, setSelectedBudgetId] = useState(budget.id)
  const [periodItems, setPeriodItems] = useState<BudgetRef[]>(() => mergeBudgetPeriodItems(periods, budget))
  const [periodAmount, setPeriodAmount] = useState(() => Number(budget.amount ?? 0).toFixed(2))
  const [editingPeriod, setEditingPeriod] = useState<BudgetRef | null>(null)
  const [periodEditorOpen, setPeriodEditorOpen] = useState(false)
  const [amountSaving, setAmountSaving] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [periodYearFilter, setPeriodYearFilter] = useState(() => getPeriodYear(budget))
  const [periodSearch, setPeriodSearch] = useState('')
  const [discardAmountConfirmationOpen, setDiscardAmountConfirmationOpen] = useState(false)
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
  let totalSpent: number | null = 0
  filtered.forEach(tx => {
    const amt = Number(tx.amount ?? 0)
    const converted = convertBudgetAmount(amt, tx.currency, selectedBudget.currency, tx.exchange_rate)
    if (converted === null) totalSpent = null
    else if (totalSpent !== null) totalSpent += converted
  })

  const metricsComplete = selectedBudget.metrics_complete !== false
    && selectedBudget.spent_amount !== null
    && selectedBudget.remaining_amount !== null
    && selectedBudget.progress_percent !== null
  const progress = metricsComplete ? clampProgress(selectedBudget.progress_percent) : null
  const visibleSpent = metricsComplete ? Number(selectedBudget.spent_amount) : null
  const visibleRemaining = metricsComplete ? Number(selectedBudget.remaining_amount) : null
  const parsedPeriodAmount = parseAmountInput(periodAmount)
  const amountChanged =
    editingPeriod !== null && parsedPeriodAmount !== null && Math.abs(parsedPeriodAmount - Number(editingPeriod.amount ?? 0)) >= 0.01
  const hasAmountDraft = Boolean(editingPeriod && periodAmount !== Number(editingPeriod.amount ?? 0).toFixed(2))

  const openPeriodAmountEditor = useCallback((period: BudgetRef) => {
    setEditingPeriod(period)
    setPeriodAmount(Number(period.amount ?? 0).toFixed(2))
    setAmountError(null)
    setDiscardAmountConfirmationOpen(false)
    setPeriodEditorOpen(true)
  }, [])

  const closePeriodAmountEditor = useCallback(() => {
    setDiscardAmountConfirmationOpen(false)
    setPeriodEditorOpen(false)
  }, [])

  const requestClose = useCallback(() => {
    if (amountSaving || periodEditorOpen) return
    onClose()
  }, [amountSaving, onClose, periodEditorOpen])

  const requestNextPeriod = useCallback(() => {
    if (amountSaving || periodEditorOpen || !onContinueNextPeriod) return
    onContinueNextPeriod()
  }, [amountSaving, onContinueNextPeriod, periodEditorOpen])

  const requestPeriodSelection = useCallback((periodId: string) => {
    setSelectedBudgetId(periodId)
  }, [])

  const requestClosePeriodEditor = useCallback(() => {
    if (amountSaving) return
    if (hasAmountDraft) {
      setDiscardAmountConfirmationOpen(true)
      return
    }
    closePeriodAmountEditor()
  }, [amountSaving, closePeriodAmountEditor, hasAmountDraft])

  const discardAmountDraft = useCallback(() => {
    closePeriodAmountEditor()
  }, [closePeriodAmountEditor])

  async function savePeriodAmount() {
    if (!editingPeriod) return
    const nextAmount = parseAmountInput(periodAmount)
    if (nextAmount === null) {
      setAmountError('Ingresa un importe mayor a cero.')
      return
    }

    setAmountSaving(true)
    setAmountError(null)
    try {
      const endpoint = resolveBudgetPeriodAmountUrl(editingPeriod)
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingPeriod.budget_period_id
            ? { amount: nextAmount }
            : {
                amount: nextAmount,
                action_scope: createBudgetRecordActionScope({
                  ...editingPeriod,
                  id: editingPeriod.legacy_budget_id ?? editingPeriod.id,
                }),
              }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el importe del periodo'))
      }

      setPeriodItems(prev =>
        prev.map(period => {
          if (period.id !== editingPeriod.id) return period
          const metricsComplete = period.metrics_complete !== false && period.spent_amount !== null
          const spent = metricsComplete ? Number(period.spent_amount) : null
          const remaining = spent === null ? null : nextAmount - spent
          return {
            ...period,
            amount: nextAmount,
            remaining_amount: remaining,
            progress_percent: spent === null ? null : nextAmount > 0 ? Math.round((spent / nextAmount) * 10000) / 100 : 0,
            over_limit: spent === null ? null : spent > nextAmount,
            metrics_complete: metricsComplete,
          }
        }),
      )
      await onPeriodUpdated?.()
      closePeriodAmountEditor()
    } catch (caught) {
      setAmountError(caught instanceof Error ? caught.message : 'No se pudo actualizar el importe del periodo')
    } finally {
      setAmountSaving(false)
    }
  }

  return (
    <>
    <RecordModal
      open={open}
      onClose={requestClose}
      onExitComplete={onExitComplete}
      presentation="workbench"
      size="xl"
      focusTrapActive={!suspendFocusTrap && !periodEditorOpen}
      overlayClassName={styles.detailOverlay}
      widthClassName="w-[calc(100vw-40px)] max-w-[1320px]"
      footer={onContinueNextPeriod ? (
        <div className={styles.workbenchFooter}>
          <div className={styles.footerTotals}>
            <div>
              <p className={styles.detailFooterLabel}>Total gastado · {filtered.length} movimiento{filtered.length === 1 ? '' : 's'}</p>
              <p className={styles.detailFooterValue}>{totalSpent === null ? 'No disponible' : formatBudgetCurrency(Math.round(totalSpent * 100) / 100, selectedBudget.currency)}</p>
            </div>
            <div className={styles.detailFooterSecondary}>
              <p className={styles.detailFooterLabel}>Límite del período</p>
              <p className={styles.detailFooterValue}>{formatBudgetCurrency(Number(selectedBudget.amount ?? 0), selectedBudget.currency)}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={amountSaving}
            onClick={requestNextPeriod}
            testId="budget-detail-next-period"
            leadingIcon={<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
          >
            Crear siguiente período
          </Button>
        </div>
      ) : undefined}
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
                <div key={period.id} className={styles.periodOption} data-selected={selected}>
                  <button
                    type="button"
                    onClick={() => requestPeriodSelection(period.id)}
                    className={styles.periodSelectButton}
                    data-testid={`budget-select-period-${period.id}`}
                    aria-current={selected ? 'true' : undefined}
                    aria-label={`${formatRange(period.period_start, period.period_end)}, ${periodStatus.label}, ${formatBudgetCurrency(Number(period.amount ?? 0), period.currency)}`}
                  >
                    <span className={styles.periodOptionTop}>
                      <span className={styles.periodOptionRange}>{formatRangeCompact(period.period_start, period.period_end)}</span>
                      <span className={`${styles.periodOptionStatus} ${tone.badge}`}>
                        <span className={`${styles.periodOptionDot} ${tone.dot}`} aria-hidden="true" />
                        {periodStatus.label}
                      </span>
                    </span>
                    <span className={styles.periodOptionAmounts}>
                      <span className={styles.periodOptionAmount}>{formatBudgetCurrency(Number(period.amount ?? 0), period.currency)}</span>
                      <span className={styles.periodOptionProgressLabel}>{period.metrics_complete === false ? '—' : `${periodProgress.toFixed(0)}%`}</span>
                    </span>
                    <span className={styles.progressTrack} aria-hidden="true">
                      <span className={`${styles.progressFill} ${tone.bar}`} style={{ width: `${Math.min(100, periodProgress)}%` }} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.periodEditButton}
                    aria-label={`Editar importe del período ${formatRange(period.period_start, period.period_end)}`}
                    data-testid={`budget-edit-period-${period.id}`}
                    onClick={() => openPeriodAmountEditor(period)}
                    disabled={amountSaving}
                  >
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                    </svg>
                    <span>Editar</span>
                  </button>
                </div>
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

            </div>

            <div className={styles.summaryFinance}>
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
                  <p className={styles.detailMetricLabel}>{visibleRemaining === null ? 'Saldo' : visibleRemaining < 0 ? 'Exceso' : 'Disponible'}</p>
                  <strong className={`${styles.detailMetricValue} ${visibleRemaining !== null && visibleRemaining < 0 ? styles.detailMetricValueDanger : ''}`}>
                    {visibleRemaining === null ? 'No disponible' : formatBudgetCurrency(Math.abs(visibleRemaining), selectedBudget.currency)}
                  </strong>
                </div>
              </div>

              <div className={styles.execution}>
                <div className={styles.executionHeading}>
                  <span>Ejecución del límite</span>
                  <strong className={`${styles.executionPercent} ${selectedBudget.over_limit ? styles.toneDanger : ''}`}>{progress === null ? '—' : `${progress.toFixed(0)}%`}</strong>
                </div>
                <div className={styles.progressTrack} role="progressbar" aria-label="Ejecución del presupuesto" aria-valuemin={0} aria-valuemax={Math.max(100, progress ?? 100)} aria-valuenow={progress ?? undefined}>
                  <div className={`${styles.progressFill} ${selectedTone.bar}`} style={{ width: `${Math.min(100, progress ?? 0)}%` }} />
                </div>
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

        </section>
      </div>
    </RecordModal>
    <RecordModal
      open={periodEditorOpen}
      onClose={requestClosePeriodEditor}
      presentation="workbench"
      eyebrow="Presupuestos"
      title="Editar período"
      subtitle={editingPeriod ? formatRange(editingPeriod.period_start, editingPeriod.period_end) : undefined}
      widthClassName="w-[calc(100vw-32px)] max-w-[580px]"
      overlayClassName={styles.periodEditorOverlay}
      testId="budget-period-editor-workbench"
      footer={(
        <div className={styles.periodEditorActions}>
          <Button type="button" variant="secondary" size="lg" onClick={requestClosePeriodEditor} disabled={amountSaving}>
            Cancelar
          </Button>
          <Button type="submit" form="budget-period-edit-form" variant="primary" size="lg" disabled={!amountChanged || amountSaving} loading={amountSaving} testId="budget-period-save-button">
            Guardar cambios
          </Button>
        </div>
      )}
    >
      <form
        id="budget-period-edit-form"
        onSubmit={event => { event.preventDefault(); void savePeriodAmount() }}
        className={styles.periodEditorForm}
      >
        {editingPeriod ? (
          <>
            <div className={styles.periodEditorContext}>
              <span className={styles.sectionEyebrow}>Límite actual</span>
              <strong>{formatBudgetCurrency(Number(editingPeriod.amount ?? 0), editingPeriod.currency)}</strong>
            </div>
            <label htmlFor="budget-period-amount" className={styles.amountLabel}>Nuevo importe · {editingPeriod.currency}</label>
            <input
              id="budget-period-amount"
              value={periodAmount}
              onChange={event => setPeriodAmount(event.target.value)}
              inputMode="decimal"
              className={styles.amountInput}
              aria-invalid={amountError ? 'true' : 'false'}
              aria-describedby={amountError ? 'budget-period-amount-error' : undefined}
              autoFocus
            />
            {amountError && <p id="budget-period-amount-error" className={styles.inlineError} role="alert">{amountError}</p>}
          </>
        ) : null}
      </form>
      <ConfirmDialog
        open={discardAmountConfirmationOpen}
        title="Descartar cambio de importe"
        message="El nuevo límite del período aún no se ha guardado. ¿Quieres cerrar y descartarlo?"
        onCancel={() => setDiscardAmountConfirmationOpen(false)}
        onConfirm={discardAmountDraft}
        confirmLabel="Descartar cambio"
        testId="budget-period-discard-modal"
      />
    </RecordModal>
    </>
  )
}
