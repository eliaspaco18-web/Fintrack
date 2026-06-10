'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BudgetPeriod, CurrencyCode } from '@/types/database.types'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { useToast } from '@/lib/toast/toast'
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
type FormMode = 'create' | 'edit' | 'continuation'

type ContinuationPreview = {
  sourceBudgetId: string
  lastPeriodStart: string
  lastPeriodEnd: string
  nextPeriodStart: string
  nextPeriodEnd: string
}

const PERIOD_LABEL: Record<BudgetPeriod, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual',
}

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

function budgetProgressTone(overLimit: boolean, progress: number): 'primary' | 'warning' | 'danger' {
  if (overLimit || progress >= 100) return 'danger'
  if (progress >= 80) return 'warning'
  return 'primary'
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
  const [detailBudget, setDetailBudget] = useState<BudgetItem | null>(null)
  const handledQueryOpenRef = useRef(false)
  const isContinuationMode = formMode === 'continuation' && continuationPreview !== null

  const openFromHeroQuery = searchParams.get('new') === 'budget'

  const loadBudgets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/budgets?include_inactive=true', { cache: 'no-store' })
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
      const res = await fetch('/api/categories?include_system=true', { cache: 'no-store' })
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

  const activeCount = useMemo(
    () => budgets.filter(item => item.is_active).length,
    [budgets],
  )

  const inactiveCount = useMemo(
    () => budgets.filter(item => !item.is_active).length,
    [budgets],
  )

  const totalPen = useMemo(
    () => budgets
      .filter(item => item.is_active && item.currency === 'PEN')
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [budgets],
  )

  const totalUsd = useMemo(
    () => budgets
      .filter(item => item.is_active && item.currency === 'USD')
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [budgets],
  )

  const overLimitCount = useMemo(
    () => budgets.filter(item => item.is_active && item.over_limit).length,
    [budgets],
  )

  const filteredBudgets = useMemo(() => {
    const q = query.trim().toLowerCase()

    return budgets.filter(item => {
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
        PERIOD_LABEL[item.period_type].toLowerCase().includes(q)
      )
    })
  }, [budgets, categoryFilter, currencyFilter, periodFilter, query, statusFilter])

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
          ? { method: 'POST' }
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
                  count={budgets.length}
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
            viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} id="budgets-view-toggle" />}
            actions={(
              <StatusBadge tone="muted" dot={false}>
                {filteredBudgets.length} registro{filteredBudgets.length === 1 ? '' : 's'}
              </StatusBadge>
            )}
          />
        )}
      >
        {error ? <DataErrorBanner message={error} onRetry={loadBudgets} /> : null}

        {loading ? (
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
        ) : filteredBudgets.length === 0 ? (
          <EmptyState
            title={query.trim() || currencyFilter !== 'all' || periodFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'active'
              ? 'No encontramos presupuestos para esos filtros.'
              : 'Todavia no tienes presupuestos registrados.'}
            description={query.trim() || currencyFilter !== 'all' || periodFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'active'
              ? 'Ajusta moneda, periodo o categoria para recuperar controles presupuestales del periodo.'
              : 'Crea tu primer presupuesto y empieza a vigilar gasto, margen restante y excedentes desde un solo registro.'}
            action={query.trim() || currencyFilter !== 'all' || periodFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'active'
              ? {
                  label: 'Limpiar filtros',
                  onClick: () => {
                    setQuery('')
                    setCurrencyFilter('all')
                    setPeriodFilter('all')
                    setCategoryFilter('all')
                    setStatusFilter('active')
                  },
                }
              : {
                  label: 'Nuevo presupuesto',
                  onClick: openCreateModal,
                }}
          />
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {filteredBudgets.map(budget => {
              const progress = Math.max(0, Math.min(100, budget.progress_percent))
              const tone = budgetProgressTone(budget.over_limit, progress)

              return (
                <article
                  key={budget.id}
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
                        Presupuesto {formatCurrency(Number(budget.amount ?? 0), budget.currency)}
                      </p>
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
                        title="Ver transacciones del periodo"
                        icon="view"
                        label="Ver transacciones del periodo"
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
            {filteredBudgets.map(budget => {
              const progress = Math.max(0, Math.min(100, budget.progress_percent))
              const tone = budgetProgressTone(budget.over_limit, progress)

              return (
                <article
                  key={budget.id}
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
                          {budget.category?.name ?? 'General'} · {PERIOD_LABEL[budget.period_type]}
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
                        meta={formatRange(budget.period_start, budget.period_end)}
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
                      Nombre, categoría, monto, moneda, periodicidad y notas se mantienen para conservar la serie consistente.
                    </p>
                  </div>
                </FormSection>

                <FormSection
                  title="Nuevo periodo"
                  description="La continuidad usa el rango siguiente calculado por la serie actual. Bajo la lógica vigente, este flujo mantiene monto y fechas heredadas."
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
                    <FormField label="Monto heredado">
                      <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3 text-sm font-medium text-[var(--c-text)]">
                        {formatCurrency(roundToDecimals(parseNumericInput(form.amount, 0), 2), form.currency)}
                      </div>
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
