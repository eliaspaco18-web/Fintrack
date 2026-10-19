'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BudgetPeriod, CurrencyCode } from '@/types/database.types'
import styles from '@/components/management/BudgetsManager.module.css'
import movementFormStyles from '@/components/forms/TransactionForm/IncomeTransactionForm.module.css'
import movementPageStyles from '@/components/tables/TransactionsRound07.module.css'
import { IncomeDatePicker } from '@/components/forms/TransactionForm/IncomeDatePicker'
import { useToast } from '@/lib/toast/toast'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { RecordModal, RecordModalFooter } from '@/components/ui/RecordModal'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { AppSelect } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { ViewToggle } from '@/components/ui/ViewToggle'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import {
  AmountCell,
  ConfirmDialog,
  DataErrorBanner,
  DataFilterPreset,
  DataSearchField,
  EmptyState,
  PageLayout,
  ProgressMetric,
  StatusBadge,
} from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { BudgetDetail } from '@/components/management/BudgetDetail'
import {
  BUDGET_SCOPE_REQUIRED_ERROR,
  createBudgetRecordActionScope,
} from '@/modules/budgets/budget-action-scope'
import { budgetRowsForSelectedMonth, countBudgetStatuses, displayBudgetProgress, formatBudgetCurrency, summarizeBudgetCurrencies } from '@/lib/budgets/presentation'
import { resolveBudgetPeriodEditTarget, resolveBudgetPeriodIdentity } from '@/lib/budgets/period-record'

type BudgetCategoryRef = {
  id: string
  name: string
  scope: 'INCOME' | 'EXPENSE'
  icon: string
  color: string
}

type BudgetItem = {
  id: string
  budget_period_id?: string
  legacy_budget_id?: string
  series_id: string
  name: string
  description: string | null
  category_id: string | null
  category?: BudgetCategoryRef | null
  amount: number
  currency: CurrencyCode
  period_type: BudgetPeriod
  start_date: string
  end_date: string | null
  period_start: string
  period_end: string
  spent_amount: number
  remaining_amount: number
  progress_percent: number
  over_limit: boolean
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

type BudgetSeriesItem = BudgetItem & {
  periods: BudgetItem[]
  period_count: number
  active_period_count: number
  latest_period_end: string
}

type CategoryOption = {
  id: string
  name: string
  scope: 'INCOME' | 'EXPENSE'
  is_system: boolean
}

type BudgetForm = {
  name: string
  description: string
  category_id: string
  amount: string
  currency: CurrencyCode
  period_type: BudgetPeriod
  start_date: string
  end_date: string
  is_active: boolean
  notes: string
}

type StatusFilter = 'all' | 'active' | 'inactive'
type CurrencyFilter = 'all' | CurrencyCode
type PeriodFilter = 'all' | BudgetPeriod
type ViewMode = 'list' | 'cards'
type WorkspaceView = 'current' | 'exceeded' | 'series'
type FormMode = 'create' | 'edit' | 'continuation'
type BudgetOptionalKey = 'description' | 'notes'

type ContinuationPreview = {
  sourceBudgetId: string
  lastPeriodStart: string
  lastPeriodEnd: string
  nextPeriodStart: string
  nextPeriodEnd: string
}

type BudgetPeriodViewItem = {
  id: string
  budget_id: string
  legacy_budget_id: string | null
  period_start: string
  period_end: string
  amount: number
  status: string
  spent_amount: number
  remaining_amount: number
  progress_percent: number
  over_limit: boolean
  budget: {
    id: string
    name: string
    description?: string | null
    category_id: string | null
    currency: CurrencyCode
    period_type: BudgetPeriod
    is_active: boolean
    category?: BudgetCategoryRef | null
  }
}

const PERIOD_LABEL: Record<BudgetPeriod, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual',
}

const MONTH_OPTIONS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

// Calcula la fecha de fin automática según periodicidad (PRD: "automática según periodicidad")
function calcEndDate(startDate: string, period: BudgetPeriod): string {
  if (!startDate) return ''
  const d = new Date(`${startDate}T12:00:00Z`)
  if (period === 'WEEKLY')    d.setUTCDate(d.getUTCDate() + 6)
  else if (period === 'MONTHLY') {
    d.setUTCMonth(d.getUTCMonth() + 1)
    d.setUTCDate(d.getUTCDate() - 1)
  } else if (period === 'QUARTERLY') {
    d.setUTCMonth(d.getUTCMonth() + 3)
    d.setUTCDate(d.getUTCDate() - 1)
  } else {
    d.setUTCFullYear(d.getUTCFullYear() + 1)
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return d.toISOString().slice(0, 10)
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function updateMonthKeyPart(periodKey: string, patch: { month?: string; year?: string }): string {
  const [currentYear, currentMonth] = periodKey.split('-')
  const nextYear = patch.year ?? currentYear ?? isoToday().slice(0, 4)
  const nextMonth = patch.month ?? currentMonth ?? isoToday().slice(5, 7)
  return `${nextYear}-${nextMonth}`
}

const EMPTY_FORM: BudgetForm = {
  name: '',
  description: '',
  category_id: '',
  amount: '0.00',
  currency: 'PEN',
  period_type: 'MONTHLY',
  start_date: isoToday(),
  end_date: '',
  is_active: true,
  notes: '',
}

function formatRange(start: string, end: string): string {
  const startLabel = new Date(`${start}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
  const endLabel = new Date(`${end}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
  return `${startLabel} → ${endLabel}`
}

function periodEndRef(budget: BudgetItem): string {
  return budget.end_date || budget.period_end || budget.start_date
}

function sortPeriods(periods: BudgetItem[]): BudgetItem[] {
  return [...periods].sort((left, right) => {
    const startCompare = left.start_date.localeCompare(right.start_date)
    if (startCompare !== 0) return startCompare
    return periodEndRef(left).localeCompare(periodEndRef(right))
  })
}

function isDateInsidePeriod(budget: BudgetItem, isoDate: string): boolean {
  const start = budget.period_start || budget.start_date
  const end = budget.period_end || budget.end_date || budget.start_date
  return start <= isoDate && isoDate <= end
}

function pickSeriesRepresentative(periods: BudgetItem[], today = isoToday()): BudgetItem {
  if (periods.length === 0) {
    throw new Error('No se puede construir una serie de presupuesto sin periodos.')
  }

  const sorted = sortPeriods(periods)
  return (
    sorted.find(period => isDateInsidePeriod(period, today) && period.is_active) ??
    sorted.find(period => isDateInsidePeriod(period, today)) ??
    [...sorted].reverse().find(period => period.is_active) ??
    sorted.at(-1) ??
    periods[0]!
  )
}

function buildBudgetSeries(budgets: BudgetItem[]): BudgetSeriesItem[] {
  const groups = new Map<string, BudgetItem[]>()

  for (const budget of budgets) {
    const key = budget.series_id || budget.id
    const current = groups.get(key) ?? []
    current.push(budget)
    groups.set(key, current)
  }

  return [...groups.values()]
    .map(group => {
      const periods = sortPeriods(group)
      const representative = pickSeriesRepresentative(periods)
      const activePeriodCount = periods.filter(period => period.is_active).length
      const latestPeriodEnd = periodEndRef(periods.at(-1) ?? representative)

      return {
        ...representative,
        periods,
        period_count: periods.length,
        active_period_count: activePeriodCount,
        latest_period_end: latestPeriodEnd,
      }
    })
    .sort((left, right) => {
      const activeCompare = Number(right.is_active) - Number(left.is_active)
      if (activeCompare !== 0) return activeCompare
      return right.latest_period_end.localeCompare(left.latest_period_end)
    })
}

function budgetProgressTone(overLimit: boolean, progress: number): 'primary' | 'warning' | 'danger' {
  if (overLimit || progress >= 100) return 'danger'
  if (progress >= 80) return 'warning'
  return 'primary'
}

function periodStatusTone(status: string, overLimit: boolean): 'primary' | 'success' | 'warning' | 'danger' | 'muted' {
  if (overLimit) return 'danger'
  if (status === 'CLOSED') return 'muted'
  if (status === 'SKIPPED') return 'warning'
  return 'success'
}

function periodStatusLabel(status: string): string {
  if (status === 'PLANNED') return 'Planificado'
  if (status === 'CLOSED') return 'Cerrado'
  if (status === 'SKIPPED') return 'Saltado'
  return 'Activo'
}

function formatFullDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function BudgetInfoHint({ label, children }: { label: string; children: string }) {
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const lastInputRef = useRef<'mouse' | 'touch' | 'keyboard'>('mouse')
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => setMounted(true), [])

  const showTooltip = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
    setClosing(false)
    setOpen(true)
  }, [])

  const closeTooltip = useCallback((immediate = false) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
    if (immediate) {
      setOpen(false)
      setClosing(false)
      return
    }
    setClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      setClosing(false)
      closeTimerRef.current = null
    }, 120)
  }, [])

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const margin = 12
    const gap = 8
    const triggerRect = trigger.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    const left = Math.min(
      Math.max(margin, window.innerWidth - tooltipRect.width - margin),
      Math.max(margin, triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2),
    )
    const spaceAbove = triggerRect.top - margin
    const spaceBelow = window.innerHeight - triggerRect.bottom - margin
    const fitsAbove = spaceAbove >= tooltipRect.height + gap
    const fitsBelow = spaceBelow >= tooltipRect.height + gap
    const top = fitsAbove || (!fitsBelow && spaceAbove > spaceBelow)
      ? Math.max(margin, triggerRect.top - tooltipRect.height - gap)
      : Math.min(window.innerHeight - tooltipRect.height - margin, triggerRect.bottom + gap)

    setPosition(previous => previous?.left === left && previous.top === top ? previous : { left, top })
  }, [])

  useLayoutEffect(() => {
    if (!open || !mounted) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [mounted, open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      const restoreFocus = document.activeElement === triggerRef.current
      closeTooltip(true)
      if (restoreFocus) triggerRef.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) closeTooltip()
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [closeTooltip, open])

  const triggerIsV3 = Boolean(triggerRef.current?.closest('[data-ft-v3], [data-ft-v3-shell]'))

  return (
    <span className={movementFormStyles.infoHint}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open && !closing}
        className={movementFormStyles.infoHintTrigger}
        onPointerDown={event => { lastInputRef.current = event.pointerType === 'touch' ? 'touch' : 'mouse' }}
        onPointerEnter={event => {
          if (event.pointerType !== 'mouse') return
          lastInputRef.current = 'mouse'
          showTooltip()
        }}
        onPointerLeave={event => {
          if (event.pointerType === 'mouse' && lastInputRef.current === 'mouse') closeTooltip()
        }}
        onFocus={event => {
          if (lastInputRef.current === 'touch') return
          lastInputRef.current = event.currentTarget.matches(':focus-visible') ? 'keyboard' : 'mouse'
          showTooltip()
        }}
        onBlur={() => { if (lastInputRef.current === 'keyboard') closeTooltip() }}
        onKeyDown={event => {
          if (event.key !== 'Escape') lastInputRef.current = 'keyboard'
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            closeTooltip(true)
          }
        }}
        onClick={event => {
          if (event.detail > 0 && lastInputRef.current === 'touch') {
            if (open && !closing) closeTooltip()
            else showTooltip()
          }
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 7.1v3.7M8 5.2h.01" />
        </svg>
      </button>
      {open && mounted ? createPortal(
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={movementFormStyles.infoTooltip}
          data-ft-v3={triggerIsV3 ? '' : undefined}
          data-state={closing ? 'closing' : 'open'}
          style={{
            left: position?.left ?? 12,
            top: position?.top ?? 12,
            visibility: position ? 'visible' : 'hidden',
          }}
        >
          {children}
        </span>,
        document.body,
      ) : null}
    </span>
  )
}

export function BudgetsManager() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<BudgetForm>(EMPTY_FORM)
  const [dateInputError, setDateInputError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState<Record<BudgetOptionalKey, boolean>>({
    description: false,
    notes: false,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null)
  const [continuationPreview, setContinuationPreview] = useState<ContinuationPreview | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [pendingDeleteBudget, setPendingDeleteBudget] = useState<BudgetItem | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('current')
  const [periodMonth, setPeriodMonth] = useState(() => isoToday().slice(0, 7))
  const [periodRows, setPeriodRows] = useState<BudgetPeriodViewItem[]>([])
  const [periodRowsLoading, setPeriodRowsLoading] = useState(false)
  const [showPeriodSkeleton, setShowPeriodSkeleton] = useState(false)
  const [periodRowsError, setPeriodRowsError] = useState<string | null>(null)
  const [loadedPeriodMonth, setLoadedPeriodMonth] = useState<string | null>(null)
  const [detailBudget, setDetailBudget] = useState<BudgetSeriesItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const periodFetchSequence = useRef(0)
  const resetAfterModalExitRef = useRef(false)
  const initialFormSnapshotRef = useRef(JSON.stringify(EMPTY_FORM))
  const handledQueryOpenRef = useRef(false)
  const hasLoadedBudgetsRef = useRef(false)
  const isContinuationMode = formMode === 'continuation' && continuationPreview !== null

  const openFromHeroQuery = searchParams.get('new') === 'budget'

  const loadBudgets = useCallback(async () => {
    if (!hasLoadedBudgetsRef.current) setLoading(true)
    setError(null)
    try {
      const res = await fetchWithTimeout('/api/budgets?include_inactive=true', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los presupuestos'))
      }
      setBudgets((json.data as BudgetItem[]) ?? [])
      hasLoadedBudgetsRef.current = true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los presupuestos')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/categories?include_system=true', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las categorías'))
      }
      const allCategories = ((json.data as CategoryOption[]) ?? [])
        .filter(category => category.scope === 'EXPENSE')
      setCategories(allCategories)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudieron cargar las categorías'
      setError(prev => prev ?? message)
    }
  }, [])

  useEffect(() => {
    void Promise.all([loadBudgets(), loadCategories()])
  }, [loadBudgets, loadCategories])

  const loadPeriodRows = useCallback(async () => {
    const sequence = ++periodFetchSequence.current
    setPeriodRowsLoading(true)
    setPeriodRowsError(null)
    try {
      const res = await fetchWithTimeout(`/api/budget-periods?period=${periodMonth}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los periodos'))
      }
      if (sequence !== periodFetchSequence.current) return
      setPeriodRows((json.data as BudgetPeriodViewItem[]) ?? [])
      setLoadedPeriodMonth(periodMonth)
    } catch (caught) {
      if (sequence !== periodFetchSequence.current) return
      setPeriodRowsError(caught instanceof Error ? caught.message : 'No se pudieron cargar los periodos')
    } finally {
      if (sequence === periodFetchSequence.current) setPeriodRowsLoading(false)
    }
  }, [periodMonth])

  useEffect(() => {
    void loadPeriodRows()
    return () => {
      periodFetchSequence.current += 1
    }
  }, [loadPeriodRows])

  useEffect(() => {
    if (!periodRowsLoading || loadedPeriodMonth === periodMonth) {
      setShowPeriodSkeleton(false)
      return
    }
    const timer = window.setTimeout(() => setShowPeriodSkeleton(true), 120)
    return () => window.clearTimeout(timer)
  }, [loadedPeriodMonth, periodMonth, periodRowsLoading])

  const resetForm = useCallback(() => {
    const nextForm = {
      ...EMPTY_FORM,
      start_date: isoToday(),
      end_date: calcEndDate(isoToday(), 'MONTHLY'),
    }
    initialFormSnapshotRef.current = JSON.stringify(nextForm)
    setForm(nextForm)
    setDateInputError(null)
    setError(null)
    setFormMode('create')
    setEditingId(null)
    setEditingBudget(null)
    setContinuationPreview(null)
  }, [])

  // Recalcular fecha fin automáticamente cuando cambia periodicidad o fecha inicio
  const handlePeriodOrDateChange = useCallback(
    (patch: Partial<BudgetForm>) => {
      if (patch.start_date !== undefined) setDateInputError(null)
      setForm(prev => {
        const next = { ...prev, ...patch }
        // Solo auto-calcular si el usuario no está editando un presupuesto existente
        if (!patch.end_date) {
          next.end_date = calcEndDate(next.start_date, next.period_type)
        }
        return next
      })
    },
    []
  )

  const clearCreateQueryParam = useCallback(() => {
    if (searchParams.get('new') !== 'budget') return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('new')
    const nextUrl = params.toString().length > 0 ? `${pathname}?${params}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  const performCloseModal = useCallback(() => {
    setDiscardConfirmationOpen(false)
    resetAfterModalExitRef.current = true
    setModalOpen(false)
    clearCreateQueryParam()
  }, [clearCreateQueryParam])

  const closeModal = useCallback(() => {
    if (saving) return
    if (JSON.stringify(form) !== initialFormSnapshotRef.current) {
      setDiscardConfirmationOpen(true)
      return
    }
    performCloseModal()
  }, [form, performCloseModal, saving])

  const handleModalExitComplete = useCallback(() => {
    if (!resetAfterModalExitRef.current) return
    resetAfterModalExitRef.current = false
    resetForm()
  }, [resetForm])

  const openCreateModal = useCallback(() => {
    resetAfterModalExitRef.current = false
    setDiscardConfirmationOpen(false)
    setDateInputError(null)
    setError(null)
    setAdditionalOptionsOpen({ description: false, notes: false })
    resetForm()
    setModalOpen(true)
  }, [resetForm])

  useEffect(() => {
    if (openFromHeroQuery) {
      if (handledQueryOpenRef.current) return
      handledQueryOpenRef.current = true
      openCreateModal()
      return
    }

    handledQueryOpenRef.current = false
  }, [openCreateModal, openFromHeroQuery])

  const startEdit = useCallback((budget: BudgetItem) => {
    resetAfterModalExitRef.current = false
    setDiscardConfirmationOpen(false)
    setDateInputError(null)
    setError(null)
    setFormMode('edit')
    setAdditionalOptionsOpen({ description: false, notes: false })
    setEditingId(budget.id)
    setEditingBudget(budget)
    setContinuationPreview(null)
    const nextForm = {
      name: budget.name,
      description: budget.description ?? '',
      category_id: budget.category_id ?? '',
      amount: Number(budget.amount ?? 0).toFixed(2),
      currency: budget.currency,
      period_type: budget.period_type,
      start_date: budget.start_date,
      end_date: budget.end_date ?? '',
      is_active: budget.is_active,
      notes: budget.notes ?? '',
    }
    initialFormSnapshotRef.current = JSON.stringify(nextForm)
    setForm(nextForm)
    setModalOpen(true)
  }, [])

  // A.2 — Nuevo período con continuidad automática
  const openNewPeriod = useCallback((budget: BudgetItem) => {
    resetAfterModalExitRef.current = false
    setDiscardConfirmationOpen(false)
    setDateInputError(null)
    setError(null)
    setAdditionalOptionsOpen({ description: false, notes: false })
    const seriesBudgets = budgets.filter(item => item.series_id === budget.series_id)
    const latestBudget = [...seriesBudgets]
      .sort((left, right) => {
        const leftRef = left.end_date || left.period_end || left.start_date
        const rightRef = right.end_date || right.period_end || right.start_date
        return leftRef.localeCompare(rightRef)
      })
      .at(-1) ?? budget

    const nextStart = (() => {
      const refEnd = latestBudget.end_date || latestBudget.period_end || isoToday()
      const d = new Date(`${refEnd}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() + 1)
      return d.toISOString().slice(0, 10)
    })()
    const nextEnd = calcEndDate(nextStart, budget.period_type)
    setFormMode('continuation')
    setEditingId(null)
    setContinuationPreview({
      sourceBudgetId: latestBudget.id,
      lastPeriodStart: latestBudget.start_date,
      lastPeriodEnd: latestBudget.end_date || latestBudget.period_end || calcEndDate(latestBudget.start_date, latestBudget.period_type),
      nextPeriodStart: nextStart,
      nextPeriodEnd: nextEnd,
    })
    const nextForm = {
      name: budget.name,
      description: budget.description ?? '',
      category_id: budget.category_id ?? '',
      amount: Number(budget.amount ?? 0).toFixed(2),
      currency: budget.currency,
      period_type: budget.period_type,
      start_date: nextStart,
      end_date: nextEnd,
      is_active: true,
      notes: budget.notes ?? '',
    }
    initialFormSnapshotRef.current = JSON.stringify(nextForm)
    setForm(nextForm)
    setModalOpen(true)
  }, [budgets])

  const budgetSeries = useMemo(() => buildBudgetSeries(budgets), [budgets])

  const openSeriesDetail = useCallback((budget: BudgetSeriesItem) => {
    setDetailBudget(budget)
    setDetailOpen(true)
  }, [])

  const openPeriodDetail = useCallback((row: BudgetPeriodViewItem) => {
    const recordIdentity = resolveBudgetPeriodIdentity(row)
    const series = budgetSeries.find(item => item.series_id === row.budget_id)
    const base: BudgetSeriesItem = series ?? {
      id: row.legacy_budget_id ?? row.id,
      series_id: row.budget_id,
      name: row.budget.name,
      description: null,
      category_id: row.budget.category_id,
      category: row.budget.category ?? null,
      amount: Number(row.amount ?? 0),
      currency: row.budget.currency,
      period_type: row.budget.period_type,
      start_date: row.period_start,
      end_date: row.period_end,
      period_start: row.period_start,
      period_end: row.period_end,
      spent_amount: Number(row.spent_amount ?? 0),
      remaining_amount: Number(row.remaining_amount ?? 0),
      progress_percent: Number(row.progress_percent ?? 0),
      over_limit: row.over_limit,
      is_active: row.budget.is_active,
      notes: null,
      created_at: '',
      updated_at: '',
      periods: [],
      period_count: 1,
      active_period_count: row.budget.is_active ? 1 : 0,
      latest_period_end: row.period_end,
    }
    const exactPeriod: BudgetItem = {
      ...base,
      ...recordIdentity,
      amount: Number(row.amount ?? 0),
      period_start: row.period_start,
      period_end: row.period_end,
      start_date: row.period_start,
      end_date: row.period_end,
      spent_amount: Number(row.spent_amount ?? 0),
      remaining_amount: Number(row.remaining_amount ?? 0),
      progress_percent: Number(row.progress_percent ?? 0),
      over_limit: row.over_limit,
      is_active: row.budget.is_active,
    }
    const otherPeriods = base.periods.filter(period =>
      period.period_start !== row.period_start || period.period_end !== row.period_end,
    )
    setDetailBudget({
      ...base,
      ...exactPeriod,
      periods: sortPeriods([...otherPeriods, exactPeriod]),
      period_count: Math.max(base.period_count, otherPeriods.length + 1),
    })
    setDetailOpen(true)
  }, [budgetSeries])

  const overLimitCount = useMemo(
    () => budgetSeries.filter(item => item.is_active && item.over_limit).length,
    [budgetSeries],
  )

  const periodRowsReady = loadedPeriodMonth === periodMonth
  const currentPeriodRows = useMemo(
    () => budgetRowsForSelectedMonth(periodRows, loadedPeriodMonth, periodMonth),
    [loadedPeriodMonth, periodMonth, periodRows],
  )

  const statusCounts = useMemo(() => {
    if (workspaceView === 'series') return countBudgetStatuses(budgetSeries)
    if (!periodRowsReady) return null
    return countBudgetStatuses(currentPeriodRows.map(row => row.budget))
  }, [budgetSeries, currentPeriodRows, periodRowsReady, workspaceView])

  const periodSummary = useMemo(
    () => summarizeBudgetCurrencies(currentPeriodRows),
    [currentPeriodRows],
  )

  const budgetCurrencyOptions = useMemo(() => {
    const currencies = new Set([
      ...budgets.map(budget => String(budget.currency)),
      ...periodRows.map(row => String(row.budget.currency)),
    ])
    return [
      { value: 'all', label: 'Moneda' },
      ...Array.from(currencies).sort().map(currency => ({ value: currency, label: currency })),
    ]
  }, [budgets, periodRows])

  const filteredPeriodRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return currentPeriodRows.filter(row => {
      if (workspaceView === 'exceeded' && !row.over_limit) return false
      if (currencyFilter !== 'all' && row.budget.currency !== currencyFilter) return false
      if (periodFilter !== 'all' && row.budget.period_type !== periodFilter) return false
      if (statusFilter === 'active' && !row.budget.is_active) return false
      if (statusFilter === 'inactive' && row.budget.is_active) return false
      if (categoryFilter === 'none' && row.budget.category_id) return false
      if (categoryFilter !== 'all' && categoryFilter !== 'none' && row.budget.category_id !== categoryFilter) return false
      if (!normalizedQuery) return true
      return row.budget.name.toLowerCase().includes(normalizedQuery)
        || (row.budget.description ?? '').toLowerCase().includes(normalizedQuery)
        || (row.budget.category?.name ?? '').toLowerCase().includes(normalizedQuery)
        || formatFullDate(row.period_start).toLowerCase().includes(normalizedQuery)
        || formatFullDate(row.period_end).toLowerCase().includes(normalizedQuery)
        || PERIOD_LABEL[row.budget.period_type].toLowerCase().includes(normalizedQuery)
    })
  }, [categoryFilter, currencyFilter, currentPeriodRows, periodFilter, query, statusFilter, workspaceView])

  const exceededPeriodRows = useMemo(
    () => currentPeriodRows.filter(row => row.over_limit),
    [currentPeriodRows],
  )

  const periodMonthLabel = useMemo(() => {
    const year = Number(periodMonth.slice(0, 4))
    const month = Number(periodMonth.slice(5, 7))
    return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('es-PE', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    })
  }, [periodMonth])

  const periodYearOptions = useMemo(() => {
    const years = new Set<string>()
    const currentYear = Number(isoToday().slice(0, 4))
    const selectedYear = Number(periodMonth.slice(0, 4))

    for (let year = currentYear - 2; year <= currentYear + 2; year += 1) {
      years.add(String(year))
    }
    if (Number.isFinite(selectedYear)) years.add(String(selectedYear))

    for (const budget of budgets) {
      const starts = [budget.start_date, budget.period_start]
      const ends = [budget.end_date, budget.period_end]
      for (const dateValue of [...starts, ...ends]) {
        if (dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          years.add(dateValue.slice(0, 4))
        }
      }
    }

    return Array.from(years)
      .sort((left, right) => Number(right) - Number(left))
      .map(year => ({ value: year, label: year }))
  }, [budgets, periodMonth])

  const filteredBudgetSeries = useMemo(() => {
    const q = query.trim().toLowerCase()

    return budgetSeries.filter(item => {
      if (currencyFilter !== 'all' && item.currency !== currencyFilter) return false
      if (periodFilter !== 'all' && item.period_type !== periodFilter) return false
      if (statusFilter === 'active' && !item.is_active) return false
      if (statusFilter === 'inactive' && item.is_active) return false
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'none' && item.category_id) return false
        if (categoryFilter !== 'none' && item.category_id !== categoryFilter) return false
      }
      if (!q) return true

      return (
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.category?.name ?? '').toLowerCase().includes(q) ||
        (item.notes ?? '').toLowerCase().includes(q) ||
        PERIOD_LABEL[item.period_type].toLowerCase().includes(q) ||
        item.periods.some(period => formatRange(period.period_start, period.period_end).toLowerCase().includes(q))
      )
    })
  }, [budgetSeries, categoryFilter, currencyFilter, periodFilter, query, statusFilter])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      const msg = 'El nombre debe tener al menos 2 caracteres.'
      setError(msg)
      toast.error('No se pudo guardar el presupuesto', msg)
      return
    }

    if (!form.start_date || dateInputError) {
      const msg = dateInputError ?? 'Selecciona una fecha de inicio válida.'
      setDateInputError(msg)
      setError(msg)
      toast.error('Revisa la fecha del periodo', msg)
      return
    }

    const parsedAmount = roundToDecimals(parseNumericInput(form.amount, Number.NaN), 2)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      const msg = 'El monto debe ser mayor a 0.'
      setError(msg)
      toast.error('No se pudo guardar el presupuesto', msg)
      return
    }

    if (form.end_date && form.end_date < form.start_date) {
      const msg = 'La fecha fin no puede ser menor que la fecha inicio.'
      setError(msg)
      toast.error('No se pudo guardar el presupuesto', msg)
      return
    }

    if (editingId && (!editingBudget || editingBudget.id !== editingId)) {
      const message = `${BUDGET_SCOPE_REQUIRED_ERROR.message} ${BUDGET_SCOPE_REQUIRED_ERROR.detail}`
      setError(message)
      toast.error('No se pudo guardar el periodo', message)
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      name: trimmedName,
      description: form.description.trim() || null,
      category_id: form.category_id || null,
      amount: parsedAmount,
      currency: form.currency,
      period_type: form.period_type,
      start_date: form.start_date,
      end_date: form.end_date || null,
      is_active: form.is_active,
      notes: form.notes.trim() || null,
    }

    try {
      const isContinuation = formMode === 'continuation' && continuationPreview !== null
      const endpoint = isContinuation
        ? `/api/budgets/${continuationPreview.sourceBudgetId}/periods`
        : editingId
          ? `/api/budgets/${editingId}`
          : '/api/budgets'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(
        endpoint,
        isContinuation
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: parsedAmount,
                notes: form.notes.trim() || null,
              }),
            }
          : {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(editingBudget
                ? {
                    ...payload,
                    action_scope: createBudgetRecordActionScope(editingBudget),
                  }
                : payload),
            },
      )
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar el presupuesto'))
      }

      await Promise.all([loadBudgets(), loadPeriodRows()])
      performCloseModal()
      toast.success(
        editingId
          ? 'Periodo actualizado'
          : formMode === 'continuation'
            ? 'Período creado'
            : 'Presupuesto creado',
        editingId && editingBudget
          ? `${trimmedName} se actualizo solo para ${formatRange(editingBudget.period_start, editingBudget.period_end)}.`
          : formMode === 'continuation'
          ? `${trimmedName} continuó correctamente con un nuevo período.`
          : `${trimmedName} se guardó correctamente.`,
        { persist: false },
      )
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo guardar el presupuesto'
      setError(message)
      toast.error('No se pudo guardar el presupuesto', message)
    } finally {
      setSaving(false)
    }
  }, [continuationPreview, dateInputError, editingBudget, editingId, form, formMode, loadBudgets, loadPeriodRows, performCloseModal, toast])

  const toggleActive = useCallback(async (budget: BudgetItem, nextValue: boolean) => {
    setRowActionId(budget.id)
    setError(null)
    try {
      const res = await fetch(`/api/budgets/${budget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: nextValue,
          action_scope: createBudgetRecordActionScope(budget),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el estado del presupuesto'))
      }

      await Promise.all([loadBudgets(), loadPeriodRows()])
      toast.success(
        nextValue ? 'Periodo reactivado' : 'Periodo desactivado',
        `${formatRange(budget.period_start, budget.period_end)}. Los demas periodos de la serie no cambiaron.`,
        { persist: false },
      )
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo actualizar el estado del presupuesto'
      setError(message)
      toast.error('No se pudo actualizar el estado', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadBudgets, loadPeriodRows, toast])

  const confirmDelete = useCallback((budget: BudgetItem) => {
    if (saving || loading || rowActionId !== null) return
    setPendingDeleteBudget(budget)
  }, [loading, rowActionId, saving])

  const closeDeleteModal = useCallback(() => {
    if (rowActionId !== null) return
    setPendingDeleteBudget(null)
  }, [rowActionId])

  const removeBudget = useCallback(async () => {
    if (!pendingDeleteBudget) return

    setRowActionId(pendingDeleteBudget.id)
    setError(null)
    try {
      const res = await fetch(`/api/budgets/${pendingDeleteBudget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_scope: createBudgetRecordActionScope(pendingDeleteBudget),
        }),
      })
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el presupuesto'))
      }

      await Promise.all([loadBudgets(), loadPeriodRows()])
      setPendingDeleteBudget(null)
      toast.success(
        'Periodo eliminado',
        'Los demas periodos de la serie se conservaron.',
        { persist: false },
      )
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo eliminar el presupuesto'
      setError(message)
      toast.error('No se pudo eliminar el presupuesto', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadBudgets, loadPeriodRows, pendingDeleteBudget, toast])

  return (
    <>
      <PageLayout
        className="max-w-none !gap-0"
        header={(
          <div className={`${movementPageStyles.pageOverview} ${styles.budgetOverview}`} data-testid="budgets-page-overview">
            <header aria-labelledby="budgets-heading" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 id="budgets-heading" className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">Presupuestos</h1>
                <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">Límites que puedes revisar antes de tu próximo gasto.</p>
              </div>
              <CreateModuleButton
                onClick={openCreateModal}
                label="Crear presupuesto"
                className={`${movementPageStyles.v3ModulePrimaryAction} w-full sm:w-auto`}
                testId="budgets-create-button"
              />
            </header>

            <section aria-label={`Resumen de presupuestos: ${periodMonthLabel}`} className={`${movementPageStyles.summary} ${styles.budgetSummary}`}>
              {!periodRowsReady && !periodRowsError ? (showPeriodSkeleton ? [0, 1, 2].map(item => (
                <div key={item} aria-hidden="true" className={styles.summarySkeletonItem}>
                  <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
                  <div className="h-7 w-36 animate-pulse rounded-full bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
                  <div className="h-3 w-28 animate-pulse rounded-full bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
                </div>
              )) : <span className={styles.summaryReserve} aria-hidden="true" />) : periodRowsReady && periodSummary.length > 0 ? periodSummary.map(summary => (
                <div key={String(summary.currency)} className={styles.summaryCurrency} aria-label={`Resumen ${summary.currency}`}>
                  <div className={movementPageStyles.summaryItem}>
                    <p>Asignado · {summary.currency}</p>
                    <div className={`${movementPageStyles.summaryValue} ${styles.summaryValue} tabular-nums`}>{formatBudgetCurrency(summary.assigned, summary.currency)}</div>
                  </div>
                  <div className={movementPageStyles.summaryItem}>
                    <p>Gasto vinculado · {summary.currency}</p>
                    <div className={`${movementPageStyles.summaryValue} ${styles.summaryValue} tabular-nums`}>{formatBudgetCurrency(summary.spent, summary.currency)}</div>
                  </div>
                  <div className={movementPageStyles.summaryItem}>
                    <p>Disponible · {summary.currency}</p>
                    <div className={`${movementPageStyles.summaryValue} ${styles.summaryValue} tabular-nums ${summary.available < 0 ? 'text-[var(--ft-danger)]' : ''}`}>
                      {formatBudgetCurrency(summary.available, summary.currency)}
                    </div>
                    {summary.available < 0 ? <small className={movementPageStyles.summaryNote}>Excedido por {formatBudgetCurrency(Math.abs(summary.available), summary.currency)}</small> : null}
                  </div>
                </div>
              )) : (
                <p className={styles.summaryUnavailable}>
                  {periodRowsError ? 'Resumen no disponible para este período.' : `Sin presupuestos en ${periodMonthLabel}.`}
                </p>
              )}
            </section>
          </div>
        )}
        controls={(
          <div className={styles.budgetControls}>
            <div className={styles.budgetPeriodNavigation}>
              <nav aria-label="Vistas de presupuestos" className={styles.budgetTabs}>
                {([
                  ['current', 'Este período', periodRowsReady ? periodRows.length : null],
                  ['exceeded', 'Excedidos', periodRowsReady ? exceededPeriodRows.length : null],
                  ['series', 'Otros períodos', budgetSeries.length],
                ] as const).map(([view, label, count]) => (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={workspaceView === view}
                    onClick={() => setWorkspaceView(view)}
                    className={styles.budgetTab}
                    data-active={workspaceView === view}
                  >
                    {label}
                    {count !== null ? <span className={styles.budgetTabCount}>{count}</span> : null}
                  </button>
                ))}
              </nav>

              <div className={styles.periodControls}>
                <span className={styles.periodControlsLabel}>Período</span>
                <AppSelect
                  value={periodMonth.slice(5, 7)}
                  onChange={value => setPeriodMonth(current => updateMonthKeyPart(current, { month: value }))}
                  className="filters-control w-[140px]"
                  compact searchable={false}
                  options={MONTH_OPTIONS}
                  ariaLabel="Seleccionar mes"
                />
                <AppSelect
                  value={periodMonth.slice(0, 4)}
                  onChange={value => setPeriodMonth(current => updateMonthKeyPart(current, { year: value }))}
                  className="filters-control w-[104px]"
                  compact searchable={false}
                  options={periodYearOptions}
                  ariaLabel="Seleccionar año"
                />
                <Button type="button" size="sm" variant="secondary" onClick={() => void loadPeriodRows()} disabled={periodRowsLoading} loading={periodRowsLoading}>
                  Actualizar
                </Button>
              </div>
            </div>

            <div className={styles.budgetFilterToolbar}>
              <div className={styles.statusFilters} role="group" aria-label="Filtrar por estado">
                <DataFilterPreset label="Activos" active={statusFilter === 'active'} count={statusCounts?.active} onClick={() => setStatusFilter('active')} />
                <DataFilterPreset label="Inactivos" active={statusFilter === 'inactive'} count={statusCounts?.inactive} onClick={() => setStatusFilter('inactive')} />
                <DataFilterPreset label="Todos" active={statusFilter === 'all'} count={statusCounts?.total} onClick={() => setStatusFilter('all')} />
              </div>
              <DataSearchField
                value={query}
                onChange={setQuery}
                placeholder="Buscar presupuesto, descripción, categoría o período"
                aria-label="Buscar presupuestos"
                className={styles.budgetSearch}
              />
              <AppSelect value={currencyFilter} onChange={value => setCurrencyFilter(value as CurrencyFilter)} className="filters-control w-[112px]" compact searchable={false} options={budgetCurrencyOptions} ariaLabel="Filtrar por moneda" />
              <AppSelect
                value={periodFilter}
                onChange={value => setPeriodFilter(value as PeriodFilter)}
                className="filters-control w-[150px]"
                compact searchable={false}
                options={[
                  { value: 'all', label: 'Periodicidad' },
                  { value: 'WEEKLY', label: 'Semanal' },
                  { value: 'MONTHLY', label: 'Mensual' },
                  { value: 'QUARTERLY', label: 'Trimestral' },
                  { value: 'YEARLY', label: 'Anual' },
                ]}
                ariaLabel="Filtrar por periodicidad"
              />
              <AppSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                className="filters-control w-[220px]"
                searchPlaceholder="Buscar categoría..."
                options={[
                  { value: 'all', label: 'Categoría' },
                  { value: 'none', label: 'General (sin categoría)' },
                  ...categories.map(category => ({ value: category.id, label: category.name })),
                ]}
                ariaLabel="Filtrar por categoría"
              />
              {workspaceView === 'series' ? <ViewToggle value={viewMode} onChange={setViewMode} id="budgets-view-toggle" /> : null}
              <StatusBadge tone="muted" dot={false}>
                {workspaceView === 'series'
                  ? `${filteredBudgetSeries.length} serie${filteredBudgetSeries.length === 1 ? '' : 's'}`
                  : `${filteredPeriodRows.length} presupuesto${filteredPeriodRows.length === 1 ? '' : 's'}`}
              </StatusBadge>
            </div>
          </div>
        )}
      >
        {error ? <DataErrorBanner message={error} onRetry={loadBudgets} /> : null}

        {workspaceView !== 'series' ? (
          <div className="space-y-3">
            {periodRowsError ? (
              <DataErrorBanner message={periodRowsError} onRetry={loadPeriodRows} />
            ) : null}

            {periodRowsReady && exceededPeriodRows.length > 0 ? (
              <aside className="flex flex-col gap-2 rounded-[12px] border border-[var(--ft-danger-border,var(--ft-border))] bg-[var(--ft-danger-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--ft-danger)]">
                    {exceededPeriodRows.length} período{exceededPeriodRows.length === 1 ? '' : 's'} por encima del límite
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--ft-text-muted)]">Excedentes reales de {periodMonthLabel}, sin combinar monedas.</p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {summarizeBudgetCurrencies(exceededPeriodRows.map(row => ({
                    amount: 0,
                    spent_amount: 0,
                    remaining_amount: Math.min(0, row.remaining_amount),
                    budget: { currency: row.budget.currency },
                  }))).map(item => (
                    <span key={String(item.currency)} className="text-[12px] font-semibold tabular-nums text-[var(--ft-danger)]">
                      {item.currency}: {formatBudgetCurrency(Math.abs(item.available), item.currency)}
                    </span>
                  ))}
                </div>
              </aside>
            ) : null}

            {showPeriodSkeleton && loadedPeriodMonth !== periodMonth ? (
              <div className={`${styles.periodTable} overflow-hidden rounded-[14px] border border-[var(--ft-border)] bg-[var(--ft-surface)]`}>
                <div className="h-10 animate-pulse bg-[var(--ft-surface-muted)] motion-reduce:animate-none" />
                {Array.from({ length: Math.max(3, periodRows.length) }, (_, item) => (
                  <div key={item} className="h-[76px] border-t border-[var(--ft-border)] bg-[var(--ft-surface)]" />
                ))}
              </div>
            ) : periodRowsError && !periodRowsReady ? null : !periodRowsReady ? (
              <div
                aria-hidden="true"
                className={`${styles.periodTable} overflow-hidden rounded-[14px] border border-[var(--ft-border)] bg-[var(--ft-surface)]`}
              >
                <div className={styles.periodHeader}>
                  <span>Presupuesto</span><span>Gastado</span><span>Límite</span><span>Ejecución</span><span>Disponible</span><span className="text-right">Acciones</span>
                </div>
                {Array.from({ length: Math.max(3, periodRows.length) }, (_, item) => (
                  <div key={item} className={styles.periodReserveRow} />
                ))}
              </div>
            ) : periodRowsReady && currentPeriodRows.length === 0 ? (
              <EmptyState
                title={`No hay presupuestos en ${periodMonthLabel}.`}
                description="Puedes consultar otros períodos o crear un presupuesto para empezar a asignar límites."
                action={{
                  label: 'Ver otros períodos',
                  onClick: () => setWorkspaceView('series'),
                }}
              />
            ) : periodRowsReady && filteredPeriodRows.length === 0 ? (
              <EmptyState
                title={workspaceView === 'exceeded' ? 'Sin excedentes en este período.' : 'No encontramos presupuestos para esos filtros.'}
                description={workspaceView === 'exceeded' ? `No hay límites que superen el monto asignado en ${periodMonthLabel}.` : 'Prueba con otra moneda, categoría, estado o búsqueda.'}
                action={workspaceView === 'exceeded' ? undefined : {
                  label: 'Limpiar filtros',
                  onClick: () => { setQuery(''); setCurrencyFilter('all'); setPeriodFilter('all'); setCategoryFilter('all'); setStatusFilter('all') },
                }}
              />
            ) : (
              <div className={`${styles.periodTable} overflow-hidden rounded-[14px] border border-[var(--ft-border)] bg-[var(--ft-surface)]`}>
                <div className={styles.periodHeader}>
                  <span>Presupuesto</span><span>Gastado</span><span>Límite</span><span>Ejecución</span><span>Disponible</span><span className="text-right">Acciones</span>
                </div>
                {filteredPeriodRows.map(row => {
                  const progress = Math.max(0, Number(row.progress_percent ?? 0))
                  const visualProgress = Math.min(100, progress)
                  const fillClass = row.over_limit ? styles.progressFillDanger : progress >= 80 ? styles.progressFillWarning : styles.progressFill
                  const remaining = Number(row.remaining_amount ?? 0)
                  return (
                    <article key={row.id} className={styles.periodRow} data-testid={`budget-period-row-${row.id}`}>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[var(--ft-text-strong)]">{row.budget.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--ft-text-muted)]">{row.budget.category?.name ?? 'General'} · {PERIOD_LABEL[row.budget.period_type]}</p>
                        <p className="mt-1 text-[11px] tabular-nums text-[var(--ft-text-subtle)]">{formatFullDate(row.period_start)} – {formatFullDate(row.period_end)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-[var(--ft-text-subtle)] md:hidden">Gastado</p>
                        <p className={`${styles.summaryValue} text-[13px] font-semibold tabular-nums text-[var(--ft-text-strong)]`}>{formatBudgetCurrency(Number(row.spent_amount ?? 0), row.budget.currency)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-[var(--ft-text-subtle)] md:hidden">Límite</p>
                        <p className={`${styles.summaryValue} text-[13px] font-semibold tabular-nums text-[var(--ft-text-strong)]`}>{formatBudgetCurrency(Number(row.amount ?? 0), row.budget.currency)}</p>
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-[var(--ft-text-subtle)] md:hidden">Ejecución</span>
                          <span className="text-[12px] font-semibold tabular-nums text-[var(--ft-text-strong)]">{displayBudgetProgress(progress)}</span>
                        </div>
                        <div className={styles.progressTrack} role="progressbar" aria-label={`Ejecución de ${row.budget.name}`} aria-valuemin={0} aria-valuemax={Math.max(100, progress)} aria-valuenow={progress}>
                          <div className={`${styles.progressFill} ${fillClass}`} style={{ width: `${visualProgress}%` }} />
                        </div>
                        <p className="mt-1 text-[10px] text-[var(--ft-text-muted)]">{row.over_limit ? `Excedido por ${formatBudgetCurrency(Math.abs(remaining), row.budget.currency)}` : 'Del límite asignado'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-[var(--ft-text-subtle)] md:hidden">Disponible</p>
                        <p className={`${styles.summaryValue} text-[13px] font-semibold tabular-nums ${remaining < 0 ? 'text-[var(--ft-danger)]' : 'text-[var(--ft-text-strong)]'}`}>{formatBudgetCurrency(remaining, row.budget.currency)}</p>
                        <StatusBadge tone={periodStatusTone(row.status, row.over_limit)} dot={row.status !== 'CLOSED'}>{row.over_limit ? 'Excedido' : periodStatusLabel(row.status)}</StatusBadge>
                      </div>
                      <div className={`${styles.periodActions} flex items-center gap-1.5 md:justify-end`}>
                        <ActionIconButton onClick={() => openPeriodDetail(row)} icon="view" label="Ver este período y sus movimientos" testId={`budget-period-detail-${row.id}`} />
                        <ActionIconButton
                          onClick={() => {
                            const target = resolveBudgetPeriodEditTarget(row)
                            if (target.kind === 'explicit-period') {
                              openPeriodDetail(row)
                              return
                            }
                            const legacy = budgets.find(item => item.id === target.budgetId)
                            if (legacy) startEdit(legacy)
                            else openPeriodDetail(row)
                          }}
                          disabled={saving || rowActionId !== null}
                          icon="edit"
                          label={row.id === row.legacy_budget_id ? 'Editar presupuesto heredado' : 'Editar el importe de este período'}
                        />
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map(item => (
              <div key={item} className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4">
                <div className="flex animate-pulse items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded-full bg-[var(--c-surface-2)]" />
                    <div className="h-5 w-56 rounded-full bg-[var(--c-surface-2)]" />
                  </div>
                  <div className="h-10 w-32 rounded-full bg-[var(--c-surface-2)]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBudgetSeries.length === 0 ? (
          <EmptyState
            title={query.trim() || currencyFilter !== 'all' || periodFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'No encontramos presupuestos para esos filtros.'
              : 'Todavia no tienes presupuestos registrados.'}
            description={query.trim() || currencyFilter !== 'all' || periodFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'Ajusta moneda, periodo o categoria para recuperar controles presupuestales del periodo.'
              : 'Crea tu primer presupuesto y empieza a vigilar gasto, margen restante y excedentes desde un solo registro.'}
            action={query.trim() || currencyFilter !== 'all' || periodFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all'
              ? {
                  label: 'Limpiar filtros',
                  onClick: () => {
                    setQuery('')
                    setCurrencyFilter('all')
                    setPeriodFilter('all')
                    setCategoryFilter('all')
                    setStatusFilter('all')
                  },
                }
              : {
                  label: 'Nuevo presupuesto',
                  onClick: openCreateModal,
                }}
          />
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {filteredBudgetSeries.map(budget => {
              const actualProgress = Math.max(0, Number(budget.progress_percent ?? 0))
              const progress = Math.min(100, actualProgress)
              const tone = budgetProgressTone(budget.over_limit, actualProgress)

              return (
                <article
                  key={budget.series_id}
                  data-testid={`budget-row-${budget.id}`}
                  className={`rounded-[14px] border px-4 py-4 ${
                    budget.is_active
                      ? 'border-[var(--c-border)] bg-[var(--c-surface)]'
                      : 'border-[var(--c-border)] bg-[var(--c-surface)] opacity-70'
                  }`}
                >
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(220px,1fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                        {budget.name}
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
                        {budget.category?.name ?? 'General (todos los egresos)'} · {PERIOD_LABEL[budget.period_type]} · {formatRange(budget.period_start, budget.period_end)}
                        {budget.period_count > 1 ? ` · ${budget.period_count} periodos` : ' · 1 periodo'}
                      </p>
                      {budget.description ? (
                        <p className="mt-2 max-w-[58ch] text-[12px] leading-5 text-[var(--c-text-faint)]">
                          {budget.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={budget.is_active ? 'success' : 'muted'}>
                          {budget.is_active ? 'Activo' : 'Inactivo'}
                        </StatusBadge>
                        <StatusBadge tone={budget.over_limit ? 'danger' : 'primary'} dot={false}>
                          {budget.over_limit ? 'Excedido' : 'En rango'}
                        </StatusBadge>
                      </div>
                      <p className="mt-2 text-[12px] text-[var(--c-text-muted)]">
                        Periodo visible {formatBudgetCurrency(Number(budget.amount ?? 0), budget.currency)}
                      </p>
                      {budget.period_count > 1 ? (
                        <p className="mt-1 text-[11px] text-[var(--c-text-faint)]">
                          Ultimo periodo: {formatRange(budget.periods.at(-1)?.period_start ?? budget.period_start, budget.latest_period_end)}
                        </p>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <ProgressMetric
                        value={progress}
                        label="Ejecucion"
                        valueLabel={displayBudgetProgress(actualProgress)}
                        tone={tone}
                        description={budget.over_limit
                          ? `Excedido por ${formatBudgetCurrency(Math.abs(Number(budget.remaining_amount ?? 0)), budget.currency)}`
                          : `Disponible ${formatBudgetCurrency(Math.max(0, Number(budget.remaining_amount ?? 0)), budget.currency)}`}
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 md:justify-self-end">
                      <ActionIconButton
                        onClick={() => openSeriesDetail(budget)}
                        disabled={saving || loading || rowActionId !== null}
                        title="Ver periodos y transacciones"
                        icon="view"
                        label="Ver periodos y transacciones"
                        testId={`budget-detail-${budget.id}`}
                      />
                      {budget.is_active ? (
                        <ActionIconButton
                          onClick={() => openNewPeriod(budget)}
                          disabled={saving || loading || rowActionId !== null}
                          icon="use"
                          label="Nuevo periodo"
                          testId={`budget-new-period-${budget.id}`}
                        />
                      ) : null}
                      <ActionIconButton
                        onClick={() => startEdit(budget)}
                        disabled={saving || loading || rowActionId !== null}
                        icon="edit"
                        label="Editar solo este periodo"
                        testId={`budget-edit-${budget.id}`}
                      />
                      {budget.is_active ? (
                        <ActionIconButton
                          onClick={() => void toggleActive(budget, false)}
                          disabled={saving || loading || rowActionId !== null}
                          icon="deactivate"
                          label="Desactivar solo este periodo"
                          variant="danger"
                          testId={`budget-deactivate-${budget.id}`}
                        />
                      ) : (
                        <ActionIconButton
                          onClick={() => void toggleActive(budget, true)}
                          disabled={saving || loading || rowActionId !== null}
                          icon="reactivate"
                          label="Reactivar solo este periodo"
                          variant="success"
                          testId={`budget-reactivate-${budget.id}`}
                        />
                      )}
                      <ActionIconButton
                        onClick={() => confirmDelete(budget)}
                        disabled={saving || loading || rowActionId !== null}
                        icon="delete"
                        label="Eliminar solo este periodo"
                        variant="danger"
                        testId={`budget-delete-${budget.id}`}
                      />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredBudgetSeries.map(budget => {
              const actualProgress = Math.max(0, Number(budget.progress_percent ?? 0))
              const progress = Math.min(100, actualProgress)
              const tone = budgetProgressTone(budget.over_limit, actualProgress)

              return (
                <article
                  key={budget.series_id}
                  data-testid={`budget-card-${budget.id}`}
                  className={`rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1 ${
                    !budget.is_active ? 'opacity-70' : ''
                  }`}
                >
                  <div className="rounded-[12px] bg-[var(--c-surface)] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">{budget.name}</p>
                        <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
                          {budget.category?.name ?? 'General'} · {PERIOD_LABEL[budget.period_type]} · {budget.period_count} periodo{budget.period_count === 1 ? '' : 's'}
                        </p>
                        {budget.description ? (
                          <p className="mt-2 text-[12px] leading-5 text-[var(--c-text-faint)] line-clamp-2">
                            {budget.description}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge tone={budget.is_active ? 'success' : 'muted'}>
                        {budget.is_active ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </div>

                    <div className="mt-5">
                      <ProgressMetric
                        value={progress}
                        label="Ejecucion"
                        valueLabel={displayBudgetProgress(actualProgress)}
                        tone={tone}
                        description={`Gastado ${formatBudgetCurrency(Number(budget.spent_amount ?? 0), budget.currency)}`}
                      />
                    </div>

                    <div className="mt-4 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
                      <AmountCell
                        label={budget.over_limit ? 'Excedido por' : 'Disponible'}
                        value={formatBudgetCurrency(Math.abs(Number(budget.remaining_amount ?? 0)), budget.currency)}
                        meta={`Periodo visible: ${formatRange(budget.period_start, budget.period_end)}`}
                        align="left"
                        tone={tone}
                      />
                    </div>

                    <div className="mt-4 border-t border-[var(--c-border)] pt-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionIconButton
                          onClick={() => openSeriesDetail(budget)}
                          disabled={saving || loading || rowActionId !== null}
                          icon="view"
                          label="Ver transacciones del periodo"
                        />
                        {budget.is_active ? (
                          <ActionIconButton
                            onClick={() => openNewPeriod(budget)}
                            disabled={saving || loading || rowActionId !== null}
                            icon="use"
                            label="Nuevo periodo"
                          />
                        ) : null}
                        <ActionIconButton
                          onClick={() => startEdit(budget)}
                          disabled={saving || loading || rowActionId !== null}
                          icon="edit"
                          label="Editar solo este periodo"
                        />
                        {budget.is_active ? (
                          <ActionIconButton
                            onClick={() => void toggleActive(budget, false)}
                            disabled={saving || loading || rowActionId !== null}
                            icon="deactivate"
                            label="Desactivar solo este periodo"
                            variant="danger"
                          />
                        ) : (
                          <ActionIconButton
                            onClick={() => void toggleActive(budget, true)}
                            disabled={saving || loading || rowActionId !== null}
                            icon="reactivate"
                            label="Activar solo este periodo"
                            variant="success"
                          />
                        )}
                        <ActionIconButton
                          onClick={() => confirmDelete(budget)}
                          disabled={saving || loading || rowActionId !== null}
                          icon="delete"
                          label="Eliminar solo este periodo"
                          variant="danger"
                        />
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </PageLayout>

      <RecordModal
        open={modalOpen}
        onClose={closeModal}
        onExitComplete={handleModalExitComplete}
        presentation="workbench"
        eyebrow="Presupuestos"
        title={
          editingId
            ? 'Editar este periodo'
            : formMode === 'continuation'
              ? 'Nuevo período continuo'
              : 'Nuevo presupuesto'
        }
        subtitle={
          editingBudget
            ? `Solo cambia el período ${formatRange(editingBudget.period_start, editingBudget.period_end)}.`
            : formMode === 'continuation'
              ? `Siguiente período de ${form.name}.`
              : 'Define el límite y su vigencia.'
        }
        widthClassName={isContinuationMode ? 'w-[calc(100vw-32px)] max-w-[880px]' : 'w-[calc(100vw-32px)] max-w-[720px]'}
      >
        <form
          id="budget-form"
          onSubmit={handleSubmit}
          data-testid="budget-form"
          className="space-y-[var(--ft-form-section-gap)]"
        >
          {isContinuationMode && continuationPreview ? (
            <div className={styles.budgetFormSections}>
              <FormSection title="Continuidad de la serie" columns="1" className={styles.budgetFormSection}>
                <div className={styles.continuationContext}>
                  <div className="min-w-0">
                    <span className={styles.contextEyebrow}>Serie activa</span>
                    <p className={styles.contextTitle}>{form.name}</p>
                    <p className={styles.contextMeta}>
                      {form.category_id ? categories.find(category => category.id === form.category_id)?.name ?? 'Categoría guardada' : 'General'}
                      {' · '}{PERIOD_LABEL[form.period_type]} · {form.currency}
                    </p>
                  </div>
                  <div className={styles.contextRange}>
                    <span className={styles.contextEyebrow}>Período anterior</span>
                    <span>{formatRange(continuationPreview.lastPeriodStart, continuationPreview.lastPeriodEnd)}</span>
                  </div>
                  <BudgetInfoHint label="Ayuda sobre la continuidad">
                    Se conserva la configuración de la serie. Solo puedes ajustar el importe del nuevo período.
                  </BudgetInfoHint>
                </div>
              </FormSection>

              <FormSection title="Siguiente período" columns="1" className={styles.budgetFormSection}>
                <div className={styles.continuationNextPeriod}>
                  <div>
                    <span className={styles.contextEyebrow}>Vigencia calculada</span>
                    <p className={styles.nextPeriodRange}>{formatRange(continuationPreview.nextPeriodStart, continuationPreview.nextPeriodEnd)}</p>
                  </div>
                  <FormField label="Importe del nuevo período" className="min-w-0">
                    <NumericInput
                      step="0.01"
                      decimals={2}
                      min={0}
                      value={form.amount}
                      onValueChange={value => setForm(prev => ({ ...prev, amount: value }))}
                      required
                      data-testid="budget-continuation-amount-input"
                      className="field-base ft-form-amount-input w-full px-3.5 py-3 text-base font-semibold"
                      placeholder="0.00"
                    />
                  </FormField>
                </div>
                {form.notes.trim() ? (
                  <p className={styles.inheritedNotes}><span>Notas heredadas:</span> {form.notes}</p>
                ) : null}
              </FormSection>
            </div>
          ) : (
            <div className={styles.budgetFormSections}>
              <FormSection title="Datos del presupuesto" columns="1" className={styles.budgetFormSection}>
                <div className={styles.fieldWithHint}>
                  <FormField label="Nombre">
                    <input
                      value={form.name}
                      onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                      required
                      data-testid="budget-name-input"
                      className="field-base ft-form-input w-full"
                      placeholder="Ej. Alimentación"
                    />
                  </FormField>
                  <span className={styles.fieldHint}><BudgetInfoHint label="Ayuda sobre el nombre">Un nombre breve te ayudará a encontrar este presupuesto en su período.</BudgetInfoHint></span>
                </div>

                <div className={styles.identityFields}>
                  <div className={styles.fieldWithHint}>
                    <FormField label="Categoría" optional optionalLabel="General si no eliges una">
                      <AppSelect
                        value={form.category_id}
                        onChange={value => setForm(prev => ({ ...prev, category_id: value }))}
                        searchPlaceholder="Buscar categoría..."
                        options={[
                          { value: '', label: 'General (todos los egresos)' },
                          ...categories.map(category => ({ value: category.id, label: category.name })),
                        ]}
                      />
                    </FormField>
                    <span className={styles.fieldHint}><BudgetInfoHint label="Ayuda sobre la categoría">Sin categoría, el presupuesto queda asociado a todos los egresos del período.</BudgetInfoHint></span>
                  </div>
                  <div className={styles.fieldWithHint}>
                    <FormField label="Periodicidad">
                      <AppSelect
                        value={form.period_type}
                        onChange={value => handlePeriodOrDateChange({ period_type: value as BudgetPeriod })}
                        searchable={false}
                        options={[
                          { value: 'WEEKLY', label: 'Semanal' },
                          { value: 'MONTHLY', label: 'Mensual' },
                          { value: 'QUARTERLY', label: 'Trimestral' },
                          { value: 'YEARLY', label: 'Anual' },
                        ]}
                      />
                    </FormField>
                    <span className={styles.fieldHint}><BudgetInfoHint label="Ayuda sobre la periodicidad">La periodicidad determina la duración del período; las fechas se calculan desde la fecha de inicio.</BudgetInfoHint></span>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Límite y vigencia" columns="1" className={styles.budgetFormSection}>
                <div className={styles.amountFields}>
                  <FormField label="Monto">
                    <NumericInput
                      step="0.01"
                      decimals={2}
                      min={0}
                      value={form.amount}
                      onValueChange={value => setForm(prev => ({ ...prev, amount: value }))}
                      required
                      data-testid="budget-amount-input"
                      className="field-base ft-form-amount-input w-full px-3.5 py-3 text-base font-semibold"
                      placeholder="0.00"
                    />
                  </FormField>
                  <FormField label="Moneda">
                    <AppSelect
                      value={form.currency}
                      onChange={value => setForm(prev => ({ ...prev, currency: value as CurrencyCode }))}
                      compact
                      searchable={false}
                      options={[{ value: 'PEN', label: 'PEN' }, { value: 'USD', label: 'USD' }]}
                    />
                  </FormField>
                </div>

                <div className={styles.dateFields}>
                  <FormField label="Fecha de inicio">
                    <IncomeDatePicker
                      value={form.start_date}
                      onChange={value => handlePeriodOrDateChange({ start_date: value })}
                      onInvalidInput={setDateInputError}
                      error={dateInputError ?? undefined}
                      inputLabel="Fecha de inicio del presupuesto, día, mes y año"
                      inputTestId="budget-start-date-input"
                    />
                  </FormField>
                  <div className={styles.fieldWithHint}>
                    <FormField label="Fecha de fin calculada">
                      <div className={styles.calculatedDate}>
                        <span>{form.end_date ? formatFullDate(form.end_date) : 'Se calculará al completar el inicio'}</span>
                      </div>
                    </FormField>
                    <span className={styles.fieldHint}><BudgetInfoHint label="Ayuda sobre la fecha de fin">Se calcula automáticamente según la periodicidad y la fecha de inicio.</BudgetInfoHint></span>
                  </div>
                </div>

                <div className={styles.activeToggle}>
                  <input
                    id="budget-active"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={event => setForm(prev => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <label htmlFor="budget-active">Presupuesto activo</label>
                  <BudgetInfoHint label="Ayuda sobre el estado activo">Los períodos activos aparecen en el seguimiento de presupuestos.</BudgetInfoHint>
                </div>
              </FormSection>

              <section className={movementFormStyles.incomeOptionalSection} aria-label="Información adicional" data-testid="budget-additional-information">
                <div className={movementFormStyles.incomeOptionsHeader}>
                  <div>
                    <h3 className={movementFormStyles.incomeSectionHeading}>Información adicional</h3>
                    <p className={movementFormStyles.incomeOptionsDescription}>Opcional · agrega detalles cuando los necesites</p>
                  </div>
                </div>

                <div className={movementFormStyles.incomeOptionControls} role="group" aria-label="Opciones adicionales del presupuesto">
                  {([
                    ['description', 'Descripción', form.description],
                    ['notes', 'Notas', form.notes],
                  ] as const).map(([key, label, value]) => {
                    const isOpen = additionalOptionsOpen[key]
                    const panelId = `budget-additional-${key}`
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        data-active={isOpen ? 'true' : 'false'}
                        data-has-value={value.trim() ? 'true' : 'false'}
                        className={movementFormStyles.incomeOptionButton}
                        onClick={() => setAdditionalOptionsOpen(current => ({ ...current, [key]: !current[key] }))}
                      >
                        <span aria-hidden="true" className={movementFormStyles.incomeOptionMark}>{isOpen ? '−' : '+'}</span>
                        <span>{label}</span>
                        {value.trim() ? <span className={styles.optionalValueMark}>Guardado</span> : null}
                      </button>
                    )
                  })}
                </div>

                <div className={movementFormStyles.incomeOptionPanels}>
                  <div id="budget-additional-description" data-income-option="description" hidden={!additionalOptionsOpen.description} className={movementFormStyles.incomeOptionPanel}>
                    <FormField label="Descripción" optional>
                      <input
                        value={form.description}
                        onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                        className="field-base ft-form-input w-full"
                        placeholder="¿Qué incluye este límite?"
                        maxLength={300}
                      />
                    </FormField>
                  </div>
                  <div id="budget-additional-notes" data-income-option="notes" hidden={!additionalOptionsOpen.notes} className={movementFormStyles.incomeOptionPanel}>
                    <FormField label="Notas" optional>
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                        className="field-base ft-form-textarea w-full resize-none"
                        placeholder="Una nota para consultar después"
                      />
                    </FormField>
                  </div>
                </div>
              </section>
            </div>
          )}

          {error ? (
            <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
              <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
            </div>
          ) : null}
        </form>

        <RecordModalFooter>
          <FormActions
            secondaryAction={(
              <Button
                type="button"
                onClick={closeModal}
                disabled={saving}
                variant="secondary"
                size="lg"
              >
                Cancelar
              </Button>
            )}
            primaryAction={(
              <Button
                type="submit"
                form="budget-form"
                disabled={saving}
                loading={saving}
                testId="budget-submit-button"
                variant="primary"
                size="lg"
              >
                {editingId ? 'Guardar solo este periodo' : isContinuationMode ? 'Crear siguiente período' : 'Crear presupuesto'}
              </Button>
            )}
          />
        </RecordModalFooter>
      </RecordModal>

      {/* A.3 — Panel de detalle de transacciones por presupuesto */}
      {detailBudget && (
        <BudgetDetail
          open={detailOpen}
          budget={detailBudget}
          periods={detailBudget.periods}
          onPeriodUpdated={async () => { await Promise.all([loadBudgets(), loadPeriodRows()]) }}
          onClose={() => setDetailOpen(false)}
          onExitComplete={() => setDetailBudget(null)}
        />
      )}

      <ConfirmDialog
        open={discardConfirmationOpen}
        title="Descartar cambios sin guardar"
        message="Los cambios de este presupuesto todavía no se han guardado. ¿Quieres cerrar y descartarlos?"
        onCancel={() => setDiscardConfirmationOpen(false)}
        onConfirm={performCloseModal}
        confirmLabel="Descartar cambios"
        testId="budgets-discard-modal"
        cancelTestId="budgets-discard-cancel-button"
        confirmTestId="budgets-discard-confirm-button"
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteBudget)}
        title="Eliminar solo este periodo"
        message={(
          <>
            Esta accion eliminara unicamente el periodo{' '}
            <span className="font-semibold text-[var(--c-text)]">
              {pendingDeleteBudget
                ? formatRange(pendingDeleteBudget.period_start, pendingDeleteBudget.period_end)
                : ''}
            </span>{' '}
            de <span className="font-semibold text-[var(--c-text)]">{pendingDeleteBudget?.name}</span>.
            Los demas periodos de la serie y sus categorias no se modificaran.
          </>
        )}
        onCancel={closeDeleteModal}
        onConfirm={() => void removeBudget()}
        loading={pendingDeleteBudget ? rowActionId === pendingDeleteBudget.id : false}
        danger
        confirmLabel="Eliminar este periodo"
        testId="budgets-delete-modal"
        cancelTestId="budgets-delete-cancel-button"
        confirmTestId="budgets-delete-confirm-button"
      />
    </>
  )
}
