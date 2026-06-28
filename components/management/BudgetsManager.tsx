'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BudgetPeriod, CurrencyCode } from '@/types/database.types'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { useToast } from '@/lib/toast/toast'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { RecordModal, RecordModalFooter } from '@/components/ui/RecordModal'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { AppSelect } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { ViewToggle } from '@/components/ui/ViewToggle'
import { FormActions, FormField, FormSection, OptionalSection } from '@/components/forms/primitives'
import {
  AmountCell,
  ConfirmDialog,
  ControlsBar,
  DataErrorBanner,
  DataFilterPreset,
  DataSearchField,
  EmptyState,
  FilterBar,
  ProgressMetric,
  RegisterModule,
  StatCard,
  StatGrid,
  StatusBadge,
} from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { BudgetDetail } from '@/components/management/BudgetDetail'

type BudgetCategoryRef = {
  id: string
  name: string
  scope: 'INCOME' | 'EXPENSE'
  icon: string
  color: string
}

type BudgetItem = {
  id: string
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
type WorkspaceView = 'series' | 'periods'
type FormMode = 'create' | 'edit' | 'continuation'

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
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [continuationPreview, setContinuationPreview] = useState<ContinuationPreview | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [pendingDeleteBudget, setPendingDeleteBudget] = useState<BudgetItem | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('series')
  const [periodMonth, setPeriodMonth] = useState(() => isoToday().slice(0, 7))
  const [periodRows, setPeriodRows] = useState<BudgetPeriodViewItem[]>([])
  const [periodRowsLoading, setPeriodRowsLoading] = useState(false)
  const [periodRowsError, setPeriodRowsError] = useState<string | null>(null)
  const [detailBudget, setDetailBudget] = useState<BudgetSeriesItem | null>(null)
  const handledQueryOpenRef = useRef(false)
  const isContinuationMode = formMode === 'continuation' && continuationPreview !== null

  const openFromHeroQuery = searchParams.get('new') === 'budget'

  const loadBudgets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithTimeout('/api/budgets?include_inactive=true', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los presupuestos'))
      }
      setBudgets((json.data as BudgetItem[]) ?? [])
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
    setPeriodRowsLoading(true)
    setPeriodRowsError(null)
    try {
      const res = await fetchWithTimeout(`/api/budget-periods?period=${periodMonth}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los periodos'))
      }
      setPeriodRows((json.data as BudgetPeriodViewItem[]) ?? [])
    } catch (caught) {
      setPeriodRows([])
      setPeriodRowsError(caught instanceof Error ? caught.message : 'No se pudieron cargar los periodos')
    } finally {
      setPeriodRowsLoading(false)
    }
  }, [periodMonth])

  useEffect(() => {
    if (workspaceView !== 'periods') return
    void loadPeriodRows()
  }, [loadPeriodRows, workspaceView])

  const resetForm = useCallback(() => {
    setForm({
      ...EMPTY_FORM,
      start_date: isoToday(),
      end_date: calcEndDate(isoToday(), 'MONTHLY'),
    })
    setFormMode('create')
    setEditingId(null)
    setContinuationPreview(null)
  }, [])

  // Recalcular fecha fin automáticamente cuando cambia periodicidad o fecha inicio
  const handlePeriodOrDateChange = useCallback(
    (patch: Partial<BudgetForm>) => {
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

  const closeModal = useCallback(() => {
    if (saving) return
    setModalOpen(false)
    resetForm()
    clearCreateQueryParam()
  }, [clearCreateQueryParam, resetForm, saving])

  const openCreateModal = useCallback(() => {
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
    setFormMode('edit')
    setEditingId(budget.id)
    setContinuationPreview(null)
    setForm({
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
    })
    setModalOpen(true)
  }, [])

  // A.2 — Nuevo período con continuidad automática
  const openNewPeriod = useCallback((budget: BudgetItem) => {
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
    setForm({
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
    })
    setModalOpen(true)
  }, [budgets])

  const budgetSeries = useMemo(() => buildBudgetSeries(budgets), [budgets])

  const activeCount = useMemo(
    () => budgetSeries.filter(item => item.is_active).length,
    [budgetSeries],
  )

  const inactiveCount = useMemo(
    () => budgetSeries.filter(item => !item.is_active).length,
    [budgetSeries],
  )

  const totalPen = useMemo(
    () => budgetSeries
      .filter(item => item.is_active && item.currency === 'PEN')
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [budgetSeries],
  )

  const totalUsd = useMemo(
    () => budgetSeries
      .filter(item => item.is_active && item.currency === 'USD')
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [budgetSeries],
  )

  const overLimitCount = useMemo(
    () => budgetSeries.filter(item => item.is_active && item.over_limit).length,
    [budgetSeries],
  )

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

  const optionalSummary = useMemo(() => {
    const summary: string[] = []
    if (form.description.trim()) summary.push('Descripcion')
    if (form.notes.trim()) summary.push('Notas')
    if (!form.is_active) summary.push('Inactivo')
    return summary
  }, [form.description, form.is_active, form.notes])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      const msg = 'El nombre debe tener al menos 2 caracteres.'
      setError(msg)
      toast.error('No se pudo guardar el presupuesto', msg)
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
              body: JSON.stringify(payload),
            },
      )
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar el presupuesto'))
      }

      await loadBudgets()
      setModalOpen(false)
      resetForm()
      clearCreateQueryParam()
      toast.success(
        editingId
          ? 'Presupuesto actualizado'
          : formMode === 'continuation'
            ? 'Período creado'
            : 'Presupuesto creado',
        formMode === 'continuation'
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
  }, [clearCreateQueryParam, continuationPreview, editingId, form, formMode, loadBudgets, resetForm, toast])

  const toggleActive = useCallback(async (budget: BudgetItem, nextValue: boolean) => {
    setRowActionId(budget.id)
    setError(null)
    try {
      const res = await fetch(`/api/budgets/${budget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextValue }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el estado del presupuesto'))
      }

      await loadBudgets()
      toast.success(
        nextValue ? 'Presupuesto reactivado' : 'Presupuesto desactivado',
        undefined,
        { persist: false },
      )
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo actualizar el estado del presupuesto'
      setError(message)
      toast.error('No se pudo actualizar el estado', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadBudgets, toast])

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
      const res = await fetch(`/api/budgets/${pendingDeleteBudget.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el presupuesto'))
      }

      await loadBudgets()
      setPendingDeleteBudget(null)
      toast.success('Presupuesto eliminado', undefined, { persist: false })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo eliminar el presupuesto'
      setError(message)
      toast.error('No se pudo eliminar el presupuesto', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadBudgets, pendingDeleteBudget, toast])

  return (
    <>
      <RegisterModule
        eyebrow="Control presupuestal"
        title="Presupuestos"
        description="Limites por categoria y periodo con lectura clara de ejecucion, margen restante y continuidad operativa."
        headerMode="content"
        actions={(
          <CreateModuleButton
            onClick={openCreateModal}
            label="Nuevo presupuesto"
            testId="budgets-create-button"
          />
        )}
        stats={(
          <StatGrid>
            <StatCard
              label="Presupuestos activos"
              value={String(activeCount)}
              detail={inactiveCount > 0 ? `${inactiveCount} inactivo${inactiveCount === 1 ? '' : 's'}` : 'Sin bajas'}
              caption="Controles vigentes sobre gasto del periodo actual."
            />
            <StatCard
              label="Monto PEN"
              value={formatCurrency(totalPen, 'PEN')}
              detail="Base operativa"
              caption="Limites activos definidos en soles peruanos."
            />
            <StatCard
              label="Monto USD"
              value={formatCurrency(totalUsd, 'USD')}
              detail={totalUsd === 0 ? 'Sin exposicion' : 'Exposicion dolarizada'}
              caption="Limites activos registrados en dolares."
            />
            <StatCard
              label="Presupuestos excedidos"
              value={String(overLimitCount)}
              detail={overLimitCount > 0 ? 'Atencion requerida' : 'Sin desbordes'}
              caption="Casos donde el gasto ya sobrepaso el limite del periodo."
            />
          </StatGrid>
        )}
        controls={(
          <ControlsBar
            presets={(
              <>
                <DataFilterPreset
                  label="Activos"
                  active={statusFilter === 'active'}
                  count={activeCount}
                  onClick={() => setStatusFilter('active')}
                />
                <DataFilterPreset
                  label="Inactivos"
                  active={statusFilter === 'inactive'}
                  count={inactiveCount}
                  onClick={() => setStatusFilter('inactive')}
                />
                <DataFilterPreset
                  label="Todos"
                  active={statusFilter === 'all'}
                  count={budgetSeries.length}
                  onClick={() => setStatusFilter('all')}
                />
              </>
            )}
            search={(
              <DataSearchField
                value={query}
                onChange={setQuery}
                placeholder="Buscar presupuesto, descripcion, categoria o periodo"
              />
            )}
            filters={(
              <FilterBar>
                <AppSelect
                  value={currencyFilter}
                  onChange={value => setCurrencyFilter(value as CurrencyFilter)}
                  className="filters-control sm:w-[112px]"
                  compact
                  searchable={false}
                  options={[
                    { value: 'all', label: 'Moneda' },
                    { value: 'PEN', label: 'PEN' },
                    { value: 'USD', label: 'USD' },
                  ]}
                />
                <AppSelect
                  value={periodFilter}
                  onChange={value => setPeriodFilter(value as PeriodFilter)}
                  className="filters-control sm:w-[150px]"
                  compact
                  searchable={false}
                  options={[
                    { value: 'all', label: 'Periodo' },
                    { value: 'WEEKLY', label: 'Semanal' },
                    { value: 'MONTHLY', label: 'Mensual' },
                    { value: 'QUARTERLY', label: 'Trimestral' },
                    { value: 'YEARLY', label: 'Anual' },
                  ]}
                />
                <AppSelect
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  className="filters-control sm:w-[220px]"
                  compact
                  searchPlaceholder="Buscar categoria..."
                  options={[
                    { value: 'all', label: 'Categoria' },
                    { value: 'none', label: 'General (sin categoria)' },
                    ...categories.map(category => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                />
              </FilterBar>
            )}
            viewToggle={workspaceView === 'series'
              ? <ViewToggle value={viewMode} onChange={setViewMode} id="budgets-view-toggle" />
              : null}
            actions={(
              <StatusBadge tone="muted" dot={false}>
                {filteredBudgetSeries.length} serie{filteredBudgetSeries.length === 1 ? '' : 's'}
              </StatusBadge>
            )}
          />
        )}
      >
        {error ? <DataErrorBanner message={error} onRetry={loadBudgets} /> : null}

        <div className="flex flex-col gap-3 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-fit items-center gap-1 rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1">
            <Button
              type="button"
              size="sm"
              variant={workspaceView === 'series' ? 'success' : 'ghost'}
              onClick={() => setWorkspaceView('series')}
            >
              Presupuestos
            </Button>
            <Button
              type="button"
              size="sm"
              variant={workspaceView === 'periods' ? 'success' : 'ghost'}
              onClick={() => setWorkspaceView('periods')}
            >
              Por periodo
            </Button>
          </div>

          {workspaceView === 'periods' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-[var(--ft-text-muted)]">
                Periodo
              </span>
              <AppSelect
                value={periodMonth.slice(5, 7)}
                onChange={value => setPeriodMonth(current => updateMonthKeyPart(current, { month: value }))}
                className="filters-control w-[140px]"
                compact
                searchable={false}
                options={MONTH_OPTIONS}
              />
              <AppSelect
                value={periodMonth.slice(0, 4)}
                onChange={value => setPeriodMonth(current => updateMonthKeyPart(current, { year: value }))}
                className="filters-control w-[104px]"
                compact
                searchable={false}
                options={periodYearOptions}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void loadPeriodRows()}
                disabled={periodRowsLoading}
                loading={periodRowsLoading}
              >
                Actualizar
              </Button>
            </div>
          ) : null}
        </div>

        {workspaceView === 'periods' ? (
          <div className="space-y-3">
            {periodRowsError ? (
              <DataErrorBanner message={periodRowsError} onRetry={loadPeriodRows} />
            ) : null}

            {periodRowsLoading ? (
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
            ) : periodRows.length === 0 ? (
              <EmptyState
                title="No hay periodos para el mes seleccionado."
                description="Crea periodos desde cada presupuesto o cambia el mes de consulta."
                action={{
                  label: 'Volver a presupuestos',
                  onClick: () => setWorkspaceView('series'),
                }}
              />
            ) : (
              <div className="overflow-hidden rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)]">
                <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(120px,0.7fr)_minmax(120px,0.7fr)_minmax(180px,1fr)_120px] gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 text-[10px] uppercase tracking-[0.1em] text-[var(--c-text-faint)]">
                  <span>Presupuesto</span>
                  <span>Importe</span>
                  <span>Gastado</span>
                  <span>Ejecucion</span>
                  <span>Estado</span>
                </div>
                <div className="divide-y divide-[var(--c-border)]">
                  {periodRows.map(row => {
                    const progress = Math.max(0, Math.min(100, row.progress_percent))
                    const tone = budgetProgressTone(row.over_limit, progress)

                    return (
                      <article
                        key={row.id}
                        className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(120px,0.7fr)_minmax(120px,0.7fr)_minmax(180px,1fr)_120px] md:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[var(--c-text)]">
                            {row.budget.name}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">
                            {row.budget.category?.name ?? 'General'} · {formatRange(row.period_start, row.period_end)}
                          </p>
                        </div>
                        <p className="text-[13px] font-semibold tabular-nums text-[var(--c-text)]">
                          {formatCurrency(Number(row.amount ?? 0), row.budget.currency)}
                        </p>
                        <p className="text-[13px] font-semibold tabular-nums text-[var(--c-text-muted)]">
                          {formatCurrency(Number(row.spent_amount ?? 0), row.budget.currency)}
                        </p>
                        <ProgressMetric
                          value={progress}
                          label="Ejecucion"
                          valueLabel={`${progress.toFixed(0)}%`}
                          tone={tone}
                          description={row.over_limit
                            ? `Excedido por ${formatCurrency(Math.abs(Number(row.remaining_amount ?? 0)), row.budget.currency)}`
                            : `Disponible ${formatCurrency(Math.max(0, Number(row.remaining_amount ?? 0)), row.budget.currency)}`}
                        />
                        <StatusBadge tone={periodStatusTone(row.status, row.over_limit)} dot={row.status !== 'CLOSED'}>
                          {row.over_limit ? 'Excedido' : periodStatusLabel(row.status)}
                        </StatusBadge>
                      </article>
                    )
                  })}
                </div>
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
              const progress = Math.max(0, Math.min(100, budget.progress_percent))
              const tone = budgetProgressTone(budget.over_limit, progress)

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
                        Periodo visible {formatCurrency(Number(budget.amount ?? 0), budget.currency)}
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
                        valueLabel={`${progress.toFixed(0)}%`}
                        tone={tone}
                        description={budget.over_limit
                          ? `Excedido por ${formatCurrency(Math.abs(Number(budget.remaining_amount ?? 0)), budget.currency)}`
                          : `Disponible ${formatCurrency(Math.max(0, Number(budget.remaining_amount ?? 0)), budget.currency)}`}
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 md:justify-self-end">
                      <ActionIconButton
                        onClick={() => setDetailBudget(budget)}
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
                        label="Editar presupuesto"
                        testId={`budget-edit-${budget.id}`}
                      />
                      {budget.is_active ? (
                        <ActionIconButton
                          onClick={() => void toggleActive(budget, false)}
                          disabled={saving || loading || rowActionId !== null}
                          icon="deactivate"
                          label="Desactivar presupuesto"
                          variant="danger"
                          testId={`budget-deactivate-${budget.id}`}
                        />
                      ) : (
                        <ActionIconButton
                          onClick={() => void toggleActive(budget, true)}
                          disabled={saving || loading || rowActionId !== null}
                          icon="reactivate"
                          label="Reactivar presupuesto"
                          variant="success"
                          testId={`budget-reactivate-${budget.id}`}
                        />
                      )}
                      <ActionIconButton
                        onClick={() => confirmDelete(budget)}
                        disabled={saving || loading || rowActionId !== null}
                        icon="delete"
                        label="Eliminar presupuesto"
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
              const progress = Math.max(0, Math.min(100, budget.progress_percent))
              const tone = budgetProgressTone(budget.over_limit, progress)

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
                        valueLabel={`${progress.toFixed(1)}%`}
                        tone={tone}
                        description={`Gastado ${formatCurrency(Number(budget.spent_amount ?? 0), budget.currency)}`}
                      />
                    </div>

                    <div className="mt-4 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
                      <AmountCell
                        label={budget.over_limit ? 'Excedido por' : 'Disponible'}
                        value={formatCurrency(Math.abs(Number(budget.remaining_amount ?? 0)), budget.currency)}
                        meta={`Periodo visible: ${formatRange(budget.period_start, budget.period_end)}`}
                        align="left"
                        tone={tone}
                      />
                    </div>

                    <div className="mt-4 border-t border-[var(--c-border)] pt-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionIconButton
                          onClick={() => setDetailBudget(budget)}
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
                          label="Editar presupuesto"
                        />
                        {budget.is_active ? (
                          <ActionIconButton
                            onClick={() => void toggleActive(budget, false)}
                            disabled={saving || loading || rowActionId !== null}
                            icon="deactivate"
                            label="Desactivar presupuesto"
                            variant="danger"
                          />
                        ) : (
                          <ActionIconButton
                            onClick={() => void toggleActive(budget, true)}
                            disabled={saving || loading || rowActionId !== null}
                            icon="reactivate"
                            label="Activar presupuesto"
                            variant="success"
                          />
                        )}
                        <ActionIconButton
                          onClick={() => confirmDelete(budget)}
                          disabled={saving || loading || rowActionId !== null}
                          icon="delete"
                          label="Eliminar presupuesto"
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
      </RegisterModule>

      <RecordModal
        open={modalOpen}
        onClose={closeModal}
        eyebrow="Presupuestos"
        title={
          editingId
            ? 'Editar presupuesto'
            : formMode === 'continuation'
              ? 'Nuevo período continuo'
              : 'Nuevo presupuesto'
        }
        subtitle={
          formMode === 'continuation'
            ? 'Previsualiza el siguiente rango y conserva la configuración operativa de la serie.'
            : 'Define límites por categoría y controla tu gasto del período actual.'
        }
        widthClassName={isContinuationMode ? 'w-[calc(100vw-32px)] max-w-[920px]' : 'w-[calc(100vw-32px)] max-w-[1040px]'}
      >
        <form
          id="budget-form"
          onSubmit={handleSubmit}
          data-testid="budget-form"
          className="space-y-[var(--ft-form-section-gap)]"
        >
          {isContinuationMode && continuationPreview ? (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.98fr)]">
                <FormSection
                  title="Periodo anterior"
                  description="Resumen readonly del último presupuesto activo dentro de la serie."
                  columns="1"
                  className="rounded-[var(--ft-form-radius)] border border-[color:color-mix(in_srgb,var(--c-border)_72%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--c-surface)_90%,transparent),color-mix(in_srgb,var(--c-surface-2)_96%,transparent))] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Serie activa</p>
                      <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                        {form.name}
                      </p>
                      <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                        {PERIOD_LABEL[form.period_type]} · {form.currency}
                      </p>
                    </div>
                    <StatusBadge tone="primary" dot={false}>
                      Activo
                    </StatusBadge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Monto vigente</p>
                      <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                        {formatCurrency(roundToDecimals(parseNumericInput(form.amount, 0), 2), form.currency)}
                      </p>
                    </div>
                    <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Rango consolidado</p>
                      <p className="mt-1 text-[13px] font-medium text-[var(--c-text)]">
                        {formatRange(continuationPreview.lastPeriodStart, continuationPreview.lastPeriodEnd)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-3.5 py-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Contexto heredado</p>
                    <p className="mt-1 text-[12px] leading-[1.5] text-[var(--c-text-muted)]">
                      Nombre, categoría, moneda, periodicidad y notas se mantienen para conservar la serie consistente.
                    </p>
                  </div>
                </FormSection>

                <FormSection
                  title="Nuevo periodo"
                  description="La continuidad usa el rango siguiente calculado por la serie actual. Puedes ajustar el importe sin romper la serie."
                  columns="1"
                  className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
                >
                  <FormField label="Periodo siguiente calculado">
                    <div className="rounded-[var(--ft-form-radius)] border border-[color:color-mix(in_srgb,var(--c-border)_60%,transparent)] bg-[color:color-mix(in_srgb,var(--c-surface-2)_90%,transparent)] px-3.5 py-3">
                      <p className="text-[13px] font-semibold text-[var(--c-text)]">
                        {formatRange(continuationPreview.nextPeriodStart, continuationPreview.nextPeriodEnd)}
                      </p>
                    </div>
                  </FormField>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Importe del nuevo periodo">
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

                    <FormField label="Fecha de inicio">
                      <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3 text-sm font-medium text-[var(--c-text)]">
                        {continuationPreview.nextPeriodStart}
                      </div>
                    </FormField>
                  </div>
                </FormSection>
              </div>

              <FormSection
                title="Opciones"
                description="Las notas siguen la configuración heredada de la serie en este flujo continuo."
                columns="1"
                className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
              >
                <FormField label="Notas" optional>
                  <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                    Las notas y ajustes finos del nuevo período siguen la configuración heredada de la serie.
                  </div>
                </FormField>
              </FormSection>
            </>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.98fr)_minmax(400px,1.02fr)]">
                <FormSection
                  title="Presupuesto"
                  description="Agrupa la identidad operativa, la categoría y el estado del límite que vas a seguir."
                  columns="1"
                  className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
                >
                  <FormField label="Nombre">
                    <input
                      value={form.name}
                      onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                      required
                      data-testid="budget-name-input"
                      className="field-base ft-form-input w-full"
                      placeholder="Ej: Marketing mensual"
                    />
                  </FormField>

                  <FormField label="Categoria" optional optionalLabel="General si no eliges una">
                    <AppSelect
                      value={form.category_id}
                      onChange={value => setForm(prev => ({ ...prev, category_id: value }))}
                      searchPlaceholder="Buscar categoría..."
                      options={[
                        { value: '', label: 'General (todos los egresos)' },
                        ...categories.map(category => ({
                          value: category.id,
                          label: category.name,
                        })),
                      ]}
                    />
                  </FormField>

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

                  <label className="flex items-start gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={event => setForm(prev => ({ ...prev, is_active: event.target.checked }))}
                      className="mt-1"
                    />
                    <span className="block">
                      <span className="block text-sm font-medium text-[var(--c-text)]">Presupuesto activo</span>
                      <span className="block text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                        Mantiene este límite visible en el seguimiento operativo del período actual.
                      </span>
                    </span>
                  </label>
                </FormSection>

                <FormSection
                  title="Monto y fechas"
                  description="El importe y la vigencia viven juntos para que el rango del presupuesto se lea de una sola vez."
                  columns="1"
                  className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
                >
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
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
                        options={[
                          { value: 'PEN', label: 'PEN' },
                          { value: 'USD', label: 'USD' },
                        ]}
                      />
                    </FormField>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Fecha de inicio">
                      <input
                        type="date"
                        value={form.start_date}
                        onChange={event => handlePeriodOrDateChange({ start_date: event.target.value })}
                        className="field-base ft-form-input w-full"
                        required
                      />
                    </FormField>

                    <FormField
                      label="Fecha de fin calculada"
                      description="Se actualiza automáticamente cuando cambias la fecha de inicio o la periodicidad."
                    >
                      <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                        <p className="text-sm font-medium text-[var(--c-text)]">
                          {form.end_date || 'Se calculara al guardar'}
                        </p>
                      </div>
                    </FormField>
                  </div>

                  <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-3.5 py-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Preview del periodo</p>
                    <p className="mt-1 text-[13px] font-medium text-[var(--c-text)]">
                      {form.start_date && form.end_date ? formatRange(form.start_date, form.end_date) : 'El rango aparecera al completar la vigencia'}
                    </p>
                  </div>
                </FormSection>
              </div>

              <OptionalSection
                title="Opciones"
                summary={optionalSummary}
                className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4"
              >
                <FormSection columns="2">
                  <FormField label="Descripcion" optional>
                    <input
                      value={form.description}
                      onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                      className="field-base ft-form-input w-full"
                      placeholder="Ej: Presupuesto para pauta y herramientas"
                      maxLength={300}
                    />
                  </FormField>

                  <FormField label="Notas" optional>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                      className="field-base ft-form-textarea w-full resize-none"
                      placeholder="Observaciones internas para el seguimiento del presupuesto"
                    />
                  </FormField>
                </FormSection>
              </OptionalSection>
            </>
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
                {editingId ? 'Guardar cambios' : isContinuationMode ? 'Crear siguiente período' : 'Crear presupuesto'}
              </Button>
            )}
          />
        </RecordModalFooter>
      </RecordModal>

      {/* A.3 — Panel de detalle de transacciones por presupuesto */}
      {detailBudget && (
        <BudgetDetail
          budget={detailBudget}
          periods={detailBudget.periods}
          onPeriodUpdated={loadBudgets}
          onClose={() => setDetailBudget(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteBudget)}
        title="Eliminar presupuesto"
        message={(
          <>
            Esta accion removera <span className="font-semibold text-[var(--c-text)]">{pendingDeleteBudget?.name}</span> del
            modulo de presupuestos.
          </>
        )}
        onCancel={closeDeleteModal}
        onConfirm={() => void removeBudget()}
        loading={pendingDeleteBudget ? rowActionId === pendingDeleteBudget.id : false}
        danger
        confirmLabel="Eliminar"
        testId="budgets-delete-modal"
        cancelTestId="budgets-delete-cancel-button"
        confirmTestId="budgets-delete-confirm-button"
      />
    </>
  )
}
