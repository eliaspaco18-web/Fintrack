'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutate } from 'swr'
import {
  getCreditDisplayDescription,
  getCreditDisplayLabel,
  getCreditDisplayTone,
  type CreditDisplayType,
  type CreditListItem,
} from '@/lib/credits/display-type'
import { useToast } from '@/lib/toast/toast'
import { useCredits } from '@/lib/hooks/useModules'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { NumericInput } from '@/components/ui/NumericInput'
import { RecordModal, RecordModalFooter } from '@/components/ui/RecordModal'
import { ViewToggle } from '@/components/ui/ViewToggle'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
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
import type { Credit } from '@/types/database.types'

type ViewMode = 'list' | 'cards'
type StatusFilter = 'all' | 'ACTIVE' | 'CLOSED'
type CreditTypeFilter = '' | 'CREDIT_CARD' | 'LINE_OF_CREDIT'
type BankEntityOption = { id: string; name: string; short_name: string | null }
type GroupedCredits = { displayType: CreditDisplayType; items: CreditListItem[] }
type CreditEditForm = {
  name: string
  credit_limit: string
  used_amount: string
  notes: string
}

function resolveErrorMessage(error: unknown): string | null {
  if (!error) return null
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const candidate = error as { message?: string; detail?: string; root?: string }
    return candidate.message ?? candidate.detail ?? candidate.root ?? 'Ocurrio un error inesperado.'
  }
  return 'Ocurrio un error inesperado.'
}

function utilizationTone(pct: number): 'success' | 'warning' | 'danger' | 'primary' {
  if (pct >= 90) return 'danger'
  if (pct >= 70) return 'warning'
  if (pct >= 50) return 'primary'
  return 'success'
}

function creditIcon(type: Credit['credit_type']) {
  if (type === 'CREDIT_CARD') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
        <path d="M2.5 10h19" />
      </svg>
    )
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 4l9 6.5v8A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-8Z" />
      <path d="M9 20v-5h6v5" />
    </svg>
  )
}

const DISPLAY_ORDER: CreditDisplayType[] = ['CARD', 'LOAN', 'LINE']

function creditIconSurfaceClassName(displayType: CreditDisplayType) {
  return {
    CARD: 'border-[rgba(66,111,159,0.18)] bg-[var(--c-info-soft)] text-[var(--c-info)]',
    LOAN: 'border-[rgba(169,120,47,0.18)] bg-[var(--c-warning-soft)] text-[var(--c-warning)]',
    LINE: 'border-[rgba(14,79,70,0.16)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]',
  }[displayType]
}

export function CreditsListPanel({ onCreate }: { onCreate: () => void }) {
  const router = useRouter()
  const { toast } = useToast()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<CreditTypeFilter>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE')
  const [bankFilter, setBankFilter] = useState('')
  const [bankEntities, setBankEntities] = useState<BankEntityOption[]>([])
  const [editingCredit, setEditingCredit] = useState<CreditListItem | null>(null)
  const [editForm, setEditForm] = useState<CreditEditForm>({
    name: '',
    credit_limit: '',
    used_amount: '',
    notes: '',
  })
  const [pendingDelete, setPendingDelete] = useState<CreditListItem | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const {
    credits,
    isLoading,
    error: hookError,
    refetch,
  } = useCredits({})

  useEffect(() => {
    fetch('/api/bank-entities', { cache: 'no-store' })
      .then(response => response.json())
      .then(json => {
        if (json?.ok) setBankEntities(json.data ?? [])
      })
      .catch(() => null)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return credits.filter(credit => {
      if (typeFilter && credit.credit_type !== typeFilter) return false
      if (statusFilter !== 'all' && credit.status !== statusFilter) return false
      if (bankFilter && credit.bank_entity_id !== bankFilter) return false
      if (!q) return true

      return credit.name.toLowerCase().includes(q)
    })
  }, [bankFilter, credits, search, statusFilter, typeFilter])

  const groupedFiltered = useMemo<GroupedCredits[]>(
    () =>
      DISPLAY_ORDER
        .map(displayType => ({
          displayType,
          items: filtered.filter(credit => credit.display_type === displayType),
        }))
        .filter(group => group.items.length > 0),
    [filtered],
  )

  const activeCount = useMemo(
    () => credits.filter(credit => credit.status === 'ACTIVE').length,
    [credits],
  )

  const closedCount = useMemo(
    () => credits.filter(credit => credit.status === 'CLOSED').length,
    [credits],
  )

  const activeExposurePen = useMemo(
    () => credits
      .filter(credit => credit.status === 'ACTIVE' && credit.currency === 'PEN')
      .reduce((sum, credit) => sum + Number(credit.credit_limit ?? 0), 0),
    [credits],
  )

  const activeExposureUsd = useMemo(
    () => credits
      .filter(credit => credit.status === 'ACTIVE' && credit.currency === 'USD')
      .reduce((sum, credit) => sum + Number(credit.credit_limit ?? 0), 0),
    [credits],
  )

  const activeUsed = useMemo(
    () => credits
      .filter(credit => credit.status === 'ACTIVE')
      .reduce((sum, credit) => sum + Number(credit.used_amount ?? 0), 0),
    [credits],
  )

  const activeExposure = useMemo(
    () => credits
      .filter(credit => credit.status === 'ACTIVE')
      .reduce((sum, credit) => sum + Number(credit.credit_limit ?? 0), 0),
    [credits],
  )

  const weightedUtilization = activeExposure > 0 ? (activeUsed / activeExposure) * 100 : 0
  const surfaceError = actionError ?? resolveErrorMessage(hookError)
  const editIsCard = editingCredit?.credit_type === 'CREDIT_CARD'

  const openEditModal = useCallback((credit: CreditListItem) => {
    setActionError(null)
    setEditingCredit(credit)
    setEditForm({
      name: credit.name,
      credit_limit: Number(credit.credit_limit ?? 0).toFixed(2),
      used_amount: Number(credit.used_amount ?? 0).toFixed(2),
      notes: credit.notes ?? '',
    })
  }, [])

  const closeEditModal = useCallback(() => {
    if (actionLoadingId) return
    setEditingCredit(null)
    setEditForm({
      name: '',
      credit_limit: '',
      used_amount: '',
      notes: '',
    })
  }, [actionLoadingId])

  const handleToggleStatus = useCallback(async (credit: Credit, nextStatus: 'ACTIVE' | 'CLOSED') => {
    if (actionLoadingId) return

    setActionLoadingId(credit.id)
    setActionError(null)

    try {
      const res = await fetch(`/api/credits/${credit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el estado'))
      }

      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/credits'))
      router.refresh()
      toast.success(
        nextStatus === 'ACTIVE' ? 'Credito activado' : 'Credito desactivado',
        credit.name,
        { persist: false },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar'
      setActionError(message)
      toast.error('Error', message)
    } finally {
      setActionLoadingId(null)
    }
  }, [actionLoadingId, refetch, router, toast])

  const handleSaveEdit = useCallback(async () => {
    if (!editingCredit || actionLoadingId) return

    const trimmedName = editForm.name.trim()
    if (trimmedName.length < 2) {
      const message = 'El nombre debe tener al menos 2 caracteres.'
      setActionError(message)
      toast.error('No se pudo actualizar el credito', message)
      return
    }

    const payload: Record<string, unknown> = {
      name: trimmedName,
      notes: editForm.notes.trim() || null,
    }

    if (editingCredit.credit_type === 'CREDIT_CARD') {
      const limit = roundToDecimals(parseNumericInput(editForm.credit_limit, Number.NaN), 2)
      const used = roundToDecimals(parseNumericInput(editForm.used_amount, Number.NaN), 2)

      if (!Number.isFinite(limit) || limit <= 0) {
        const message = 'El límite de crédito debe ser mayor a 0.'
        setActionError(message)
        toast.error('No se pudo actualizar el credito', message)
        return
      }

      if (!Number.isFinite(used) || used < 0 || used > limit) {
        const message = 'El consumo actual debe ser válido y no superar el límite.'
        setActionError(message)
        toast.error('No se pudo actualizar el credito', message)
        return
      }

      payload.credit_limit = limit
      payload.used_amount = used
    }

    setActionLoadingId(editingCredit.id)
    setActionError(null)

    try {
      const res = await fetch(`/api/credits/${editingCredit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el credito'))
      }

      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/credits'))
      router.refresh()
      toast.success('Credito actualizado', trimmedName, { persist: false })
      closeEditModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el credito'
      setActionError(message)
      toast.error('No se pudo actualizar el credito', message)
    } finally {
      setActionLoadingId(null)
    }
  }, [actionLoadingId, closeEditModal, editForm, editingCredit, refetch, router, toast])

  const handleDelete = useCallback(async () => {
    if (!pendingDelete || actionLoadingId) return

    setActionLoadingId(pendingDelete.id)
    setActionError(null)

    try {
      const res = await fetch(`/api/credits/${pendingDelete.id}`, { method: 'DELETE' })

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el credito'))
      }

      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/credits'))
      router.refresh()
      toast.success('Credito eliminado', pendingDelete.name, { persist: false })
      setPendingDelete(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al eliminar'
      setActionError(message)
      toast.error('No se pudo eliminar', message)
    } finally {
      setActionLoadingId(null)
    }
  }, [actionLoadingId, pendingDelete, refetch, router, toast])

  const renderListSection = useCallback((group: GroupedCredits) => (
    <section
      key={group.displayType}
      className="overflow-hidden rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
              {getCreditDisplayLabel(group.displayType)}
            </p>
            <StatusBadge tone={getCreditDisplayTone(group.displayType)} dot={false}>
              {group.items.length} registro{group.items.length === 1 ? '' : 's'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">
            {getCreditDisplayDescription(group.displayType)}
          </p>
        </div>
      </div>

      <div className="hidden border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 md:grid md:grid-cols-[minmax(0,1.45fr)_minmax(0,1.2fr)_minmax(220px,1fr)_auto] md:items-center md:gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Linea</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Tipo y estado</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Utilizacion</p>
        <p className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Acciones</p>
      </div>

      <div className="divide-y divide-[var(--c-border)]">
        {group.items.map(credit => {
          const utilization = credit.credit_limit > 0
            ? Math.min((credit.used_amount / credit.credit_limit) * 100, 100)
            : 0
          const tone = utilizationTone(utilization)
          const isActive = credit.status === 'ACTIVE'
          const available = credit.available_amount ?? (credit.credit_limit - credit.used_amount)

          return (
            <article
              key={credit.id}
              className="px-4 py-4 transition-[background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--c-surface-2)]"
            >
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1.2fr)_minmax(220px,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border ${creditIconSurfaceClassName(credit.display_type)}`}>
                      {creditIcon(credit.credit_type)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                        {credit.name}
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
                        Disponible {formatCurrency(available, credit.currency as 'PEN' | 'USD')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={isActive ? 'success' : 'muted'}>
                      {isActive ? 'Activa' : 'Cerrada'}
                    </StatusBadge>
                    <StatusBadge tone={getCreditDisplayTone(credit.display_type)} dot={false}>
                      {getCreditDisplayLabel(credit.display_type)}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-[12px] text-[var(--c-text-muted)]">
                    Limite {formatCurrency(credit.credit_limit, credit.currency as 'PEN' | 'USD')}
                  </p>
                </div>

                <div className="min-w-0">
                  <ProgressMetric
                    value={utilization}
                    label="Uso de cupo"
                    valueLabel={`${utilization.toFixed(0)}%`}
                    tone={tone}
                    description={`${formatCurrency(credit.used_amount, credit.currency as 'PEN' | 'USD')} usados`}
                  />
                </div>

                <div className="flex shrink-0 items-center gap-1.5 md:justify-self-end">
                  <ActionIconButton
                    icon="edit"
                    label="Editar"
                    disabled={Boolean(actionLoadingId)}
                    testId={`credit-edit-${credit.id}`}
                    onClick={() => openEditModal(credit)}
                  />
                  <ActionIconButton
                    icon={isActive ? 'deactivate' : 'reactivate'}
                    label={isActive ? 'Desactivar' : 'Activar'}
                    variant={isActive ? 'danger' : 'success'}
                    disabled={Boolean(actionLoadingId)}
                    testId={isActive ? `credit-deactivate-${credit.id}` : `credit-reactivate-${credit.id}`}
                    onClick={() => void handleToggleStatus(credit, isActive ? 'CLOSED' : 'ACTIVE')}
                  />
                  <ActionIconButton
                    icon="delete"
                    label="Eliminar"
                    variant="danger"
                    disabled={Boolean(actionLoadingId)}
                    testId={`credit-delete-${credit.id}`}
                    onClick={() => {
                      setActionError(null)
                      setPendingDelete(credit)
                    }}
                  />
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  ), [actionLoadingId, handleToggleStatus, openEditModal])

  const renderCardSection = useCallback((group: GroupedCredits) => (
    <section key={group.displayType} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
              {getCreditDisplayLabel(group.displayType)}
            </p>
            <StatusBadge tone={getCreditDisplayTone(group.displayType)} dot={false}>
              {group.items.length} registro{group.items.length === 1 ? '' : 's'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">
            {getCreditDisplayDescription(group.displayType)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.items.map(credit => {
          const utilization = credit.credit_limit > 0
            ? Math.min((credit.used_amount / credit.credit_limit) * 100, 100)
            : 0
          const tone = utilizationTone(utilization)
          const isActive = credit.status === 'ACTIVE'
          const available = credit.available_amount ?? (credit.credit_limit - credit.used_amount)

          return (
            <article
              key={credit.id}
              className="rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1"
            >
              <div className="rounded-[12px] bg-[var(--c-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border ${creditIconSurfaceClassName(credit.display_type)}`}>
                      {creditIcon(credit.credit_type)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                        {credit.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusBadge tone={getCreditDisplayTone(credit.display_type)} dot={false}>
                          {getCreditDisplayLabel(credit.display_type)}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>
                  <StatusBadge tone={isActive ? 'success' : 'muted'}>
                    {isActive ? 'Activa' : 'Cerrada'}
                  </StatusBadge>
                </div>

                <div className="mt-5">
                  <AmountCell
                    label="Disponible"
                    value={formatCurrency(available, credit.currency as 'PEN' | 'USD')}
                    meta={`Limite ${formatCurrency(credit.credit_limit, credit.currency as 'PEN' | 'USD')}`}
                    align="left"
                  />
                </div>

                <div className="mt-4">
                  <ProgressMetric
                    value={utilization}
                    label="Utilizacion"
                    valueLabel={`${utilization.toFixed(1)}%`}
                    tone={tone}
                    description={`${formatCurrency(credit.used_amount, credit.currency as 'PEN' | 'USD')} consumidos`}
                  />
                </div>

                <div className="mt-4 border-t border-[var(--c-border)] pt-4">
                  <div className="flex items-center justify-end gap-1.5">
                    <ActionIconButton
                      icon="edit"
                      label="Editar"
                      disabled={Boolean(actionLoadingId)}
                      testId={`credit-edit-card-${credit.id}`}
                      onClick={() => openEditModal(credit)}
                    />
                    <ActionIconButton
                      icon={isActive ? 'deactivate' : 'reactivate'}
                      label={isActive ? 'Desactivar' : 'Activar'}
                      variant={isActive ? 'danger' : 'success'}
                      disabled={Boolean(actionLoadingId)}
                      testId={isActive ? `credit-deactivate-card-${credit.id}` : `credit-reactivate-card-${credit.id}`}
                      onClick={() => void handleToggleStatus(credit, isActive ? 'CLOSED' : 'ACTIVE')}
                    />
                    <ActionIconButton
                      icon="delete"
                      label="Eliminar"
                      variant="danger"
                      disabled={Boolean(actionLoadingId)}
                      testId={`credit-delete-card-${credit.id}`}
                      onClick={() => {
                        setActionError(null)
                        setPendingDelete(credit)
                      }}
                    />
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  ), [actionLoadingId, handleToggleStatus, openEditModal])

  return (
    <>
      <RegisterModule
        eyebrow="Registro de lineas"
        title="Creditos"
        description="Tarjetas, prestamos y lineas disponibles con lectura inmediata de uso, saldo consumido y capacidad restante."
        headerMode="content"
        actions={(
          <CreateModuleButton
            onClick={onCreate}
            label="Nuevo credito"
            testId="credits-hero-create-button"
          />
        )}
        stats={(
          <StatGrid>
            <StatCard
              label="Lineas activas"
              value={String(activeCount)}
              detail={closedCount > 0 ? `${closedCount} cerrada${closedCount === 1 ? '' : 's'}` : 'Sin cierres'}
              caption="Portafolio vigente de financiamiento operativo."
            />
            <StatCard
              label="Cupo PEN"
              value={formatCurrency(activeExposurePen, 'PEN')}
              detail={activeExposurePen === 0 ? 'Sin lineas' : 'Exposicion local'}
              caption="Capacidad activa disponible en soles peruanos."
            />
            <StatCard
              label="Cupo USD"
              value={formatCurrency(activeExposureUsd, 'USD')}
              detail={activeExposureUsd === 0 ? 'Sin lineas' : 'Exposicion dolarizada'}
              caption="Capacidad activa disponible en dolares."
            />
            <StatCard
              label="Utilizacion agregada"
              value={`${weightedUtilization.toFixed(1)}%`}
              detail={activeUsed > 0 ? 'Uso consolidado' : 'Sin consumo'}
              caption="Peso de uso sobre el cupo total habilitado."
            />
          </StatGrid>
        )}
        controls={(
          <ControlsBar
            presets={(
              <>
                <DataFilterPreset
                  label="Activas"
                  active={statusFilter === 'ACTIVE'}
                  count={activeCount}
                  onClick={() => setStatusFilter('ACTIVE')}
                />
                <DataFilterPreset
                  label="Cerradas"
                  active={statusFilter === 'CLOSED'}
                  count={closedCount}
                  onClick={() => setStatusFilter('CLOSED')}
                />
                <DataFilterPreset
                  label="Todas"
                  active={statusFilter === 'all'}
                  count={credits.length}
                  onClick={() => setStatusFilter('all')}
                />
              </>
            )}
            search={(
              <DataSearchField
                value={search}
                onChange={setSearch}
                placeholder="Buscar credito por nombre"
              />
            )}
            filters={(
              <FilterBar>
                <AppSelect
                  value={typeFilter}
                  onChange={value => setTypeFilter(value as CreditTypeFilter)}
                  compact
                  searchable={false}
                  className="w-[190px]"
                  options={[
                    { value: '', label: 'Tipo' },
                    { value: 'CREDIT_CARD', label: 'Tarjeta de credito' },
                    { value: 'LINE_OF_CREDIT', label: 'Credito bancario' },
                  ]}
                />
                <AppSelect
                  value={bankFilter}
                  onChange={setBankFilter}
                  compact
                  className="w-[220px]"
                  options={[
                    { value: '', label: 'Entidad' },
                    ...bankEntities.map(bank => ({
                      value: bank.id,
                      label: bank.short_name ?? bank.name,
                    })),
                  ]}
                  searchPlaceholder="Buscar entidad..."
                />
              </FilterBar>
            )}
            viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} id="credits-view-toggle" />}
            actions={(
              <StatusBadge tone="muted" dot={false}>
                {filtered.length} registro{filtered.length === 1 ? '' : 's'}
              </StatusBadge>
            )}
          />
        )}
      >
        {surfaceError ? <DataErrorBanner message={surfaceError} onRetry={refetch} /> : null}

        {isLoading ? (
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
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search || typeFilter || bankFilter || statusFilter !== 'ACTIVE'
              ? 'No encontramos lineas para esos filtros.'
              : 'Todavia no tienes creditos registrados.'}
            description={search || typeFilter || bankFilter || statusFilter !== 'ACTIVE'
              ? 'Ajusta los criterios para recuperar tarjetas, prestamos o entidades concretas.'
              : 'Crea tu primera linea para controlar cupo, uso y financiamiento desde el mismo registro.'}
            action={search || typeFilter || bankFilter || statusFilter !== 'ACTIVE'
              ? {
                  label: 'Limpiar filtros',
                  onClick: () => {
                    setSearch('')
                    setTypeFilter('')
                    setBankFilter('')
                    setStatusFilter('ACTIVE')
                  },
                }
              : {
                  label: 'Nuevo credito',
                  onClick: onCreate,
                }}
            compact={false}
          />
        ) : viewMode === 'list' ? (
          <div className="space-y-4">
            {groupedFiltered.map(renderListSection)}
          </div>
        ) : (
          <div className="space-y-5">
            {groupedFiltered.map(renderCardSection)}
          </div>
        )}
      </RegisterModule>

      <RecordModal
        open={Boolean(editingCredit)}
        onClose={closeEditModal}
        eyebrow="Creditos"
        title={editingCredit?.credit_type === 'CREDIT_CARD' ? 'Editar tarjeta de credito' : 'Editar credito'}
        subtitle={editingCredit?.credit_type === 'CREDIT_CARD'
          ? 'Ajusta los datos base de la línea y corrige el consumo inicial si cambió.'
          : 'Actualiza la referencia visible del crédito sin tocar su cronograma existente.'}
        widthClassName="w-[calc(100vw-32px)] max-w-[720px]"
        testId="credits-edit-modal"
      >
        <div className="space-y-[var(--ft-form-section-gap)]">
          <FormSection
            title="Datos base"
            description="Mantén la referencia operativa del crédito alineada con el registro real."
            columns="2"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Nombre" className="md:col-span-2">
              <input
                value={editForm.name}
                onChange={event => setEditForm(prev => ({ ...prev, name: event.target.value }))}
                className="field-base ft-form-input w-full"
                placeholder="Ej: Visa Signature BCP"
                disabled={Boolean(actionLoadingId)}
                maxLength={100}
              />
            </FormField>

            {editIsCard ? (
              <>
                <FormField label="Limite de credito">
                  <NumericInput
                    value={editForm.credit_limit}
                    onValueChange={value => setEditForm(prev => ({ ...prev, credit_limit: value }))}
                    step="0.01"
                    decimals={2}
                    min={0}
                    className="field-base ft-form-input w-full"
                    disabled={Boolean(actionLoadingId)}
                  />
                </FormField>

                <FormField label="Monto usado actual">
                  <NumericInput
                    value={editForm.used_amount}
                    onValueChange={value => setEditForm(prev => ({ ...prev, used_amount: value }))}
                    step="0.01"
                    decimals={2}
                    min={0}
                    className="field-base ft-form-input w-full"
                    disabled={Boolean(actionLoadingId)}
                  />
                </FormField>
              </>
            ) : null}

            <FormField label="Notas" optional className="md:col-span-2">
              <textarea
                value={editForm.notes}
                onChange={event => setEditForm(prev => ({ ...prev, notes: event.target.value }))}
                className="field-base ft-form-input min-h-[112px] w-full resize-y"
                placeholder="Observaciones operativas del credito"
                disabled={Boolean(actionLoadingId)}
                maxLength={500}
              />
            </FormField>
          </FormSection>

          {actionError ? (
            <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
              <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{actionError}</p>
            </div>
          ) : null}
        </div>

        <RecordModalFooter>
          <FormActions
            secondaryAction={(
              <Button
                type="button"
                onClick={closeEditModal}
                disabled={Boolean(actionLoadingId)}
                variant="secondary"
                size="lg"
              >
                Cancelar
              </Button>
            )}
            primaryAction={(
              <Button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={Boolean(actionLoadingId)}
                loading={Boolean(editingCredit && actionLoadingId === editingCredit.id)}
                variant="primary"
                size="lg"
                testId="credits-edit-save-button"
              >
                Guardar cambios
              </Button>
            )}
          />
        </RecordModalFooter>
      </RecordModal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar credito"
        message={(
          <>
            Se eliminara <span className="font-semibold text-[var(--c-text)]">{pendingDelete?.name}</span>.
            Si tiene transacciones asociadas, la operacion sera bloqueada.
          </>
        )}
        onCancel={() => {
          if (actionLoadingId) return
          setPendingDelete(null)
        }}
        onConfirm={() => void handleDelete()}
        loading={pendingDelete ? actionLoadingId === pendingDelete.id : false}
        danger
        confirmLabel="Eliminar"
        testId="credits-delete-modal"
        cancelTestId="credits-delete-cancel-button"
        confirmTestId="credits-delete-confirm-button"
      />
    </>
  )
}
