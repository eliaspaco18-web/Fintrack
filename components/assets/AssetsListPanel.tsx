'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutate } from 'swr'
import { useToast } from '@/lib/toast/toast'
import { useAssets } from '@/lib/hooks/useModules'
import { formatCurrency, formatDateLabel } from '@/lib/contracts/ui.contracts'
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
  DataTable,
  EmptyState,
  FilterBar,
  RegisterModule,
  StatCard,
  StatGrid,
  StatusBadge,
} from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import type { Asset } from '@/types/database.types'

type ViewMode = 'list' | 'cards'
type StatusFilter = 'all' | 'ACTIVE' | 'INACTIVE'
type AssetTypeOption = { id: string; name: string; color: string | null; icon: string | null }
type AssetWithType = Asset & {
  asset_type_info?: { id: string; name: string; color: string | null; icon: string | null } | null
}
type AssetEditForm = {
  name: string
  current_value: string
  recipient: string
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

function cubeIcon() {
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
      <path d="m12 2 9 4.5v11L12 22 3 17.5v-11L12 2Z" />
      <path d="M12 22V12" />
      <path d="m21 6.5-9 5.5-9-5.5" />
    </svg>
  )
}

function withAlpha(color: string | null | undefined, alpha: string, fallback: string) {
  if (color && /^#[0-9a-f]{6}$/i.test(color)) return `${color}${alpha}`
  return fallback
}

export function AssetsListPanel({ onCreate }: { onCreate: () => void }) {
  const router = useRouter()
  const { toast } = useToast()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE')
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([])
  const [editingAsset, setEditingAsset] = useState<AssetWithType | null>(null)
  const [editForm, setEditForm] = useState<AssetEditForm>({
    name: '',
    current_value: '',
    recipient: '',
    notes: '',
  })
  const [pendingDelete, setPendingDelete] = useState<AssetWithType | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const {
    assets,
    isLoading,
    error: hookError,
    refetch,
  } = useAssets({ status: '' })

  useEffect(() => {
    fetch('/api/asset-types', { cache: 'no-store' })
      .then(response => response.json())
      .then(json => {
        if (json?.ok) setAssetTypes(json.data ?? [])
      })
      .catch(() => null)
  }, [])

  const typedAssets = assets as AssetWithType[]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return typedAssets.filter(asset => {
      if (typeFilter && asset.asset_type_id !== typeFilter) return false
      if (statusFilter !== 'all' && asset.status !== statusFilter) return false
      if (dateFrom && asset.purchase_date < dateFrom) return false
      if (dateTo && asset.purchase_date > dateTo) return false
      if (!q) return true

      return asset.name.toLowerCase().includes(q)
    })
  }, [dateFrom, dateTo, search, statusFilter, typeFilter, typedAssets])

  const activeCount = useMemo(
    () => typedAssets.filter(asset => asset.status === 'ACTIVE').length,
    [typedAssets],
  )

  const inactiveCount = useMemo(
    () => typedAssets.filter(asset => asset.status !== 'ACTIVE').length,
    [typedAssets],
  )

  const totalPen = useMemo(
    () => typedAssets
      .filter(asset => asset.status === 'ACTIVE' && asset.currency === 'PEN')
      .reduce((sum, asset) => sum + Number(asset.current_value ?? asset.purchase_value ?? 0), 0),
    [typedAssets],
  )

  const totalUsd = useMemo(
    () => typedAssets
      .filter(asset => asset.status === 'ACTIVE' && asset.currency === 'USD')
      .reduce((sum, asset) => sum + Number(asset.current_value ?? asset.purchase_value ?? 0), 0),
    [typedAssets],
  )

  const typeCount = useMemo(() => {
    const names = new Set<string>()
    for (const asset of typedAssets) {
      const typeName = asset.asset_type_info?.name
      if (typeName) names.add(typeName)
    }
    return names.size
  }, [typedAssets])

  const surfaceError = actionError ?? resolveErrorMessage(hookError)

  const openEditModal = useCallback((asset: AssetWithType) => {
    setActionError(null)
    setEditingAsset(asset)
    setEditForm({
      name: asset.name,
      current_value: Number(asset.current_value ?? asset.purchase_value ?? 0).toFixed(2),
      recipient: asset.recipient ?? '',
      notes: asset.notes ?? '',
    })
  }, [])

  const closeEditModal = useCallback(() => {
    if (actionLoadingId) return
    setEditingAsset(null)
    setEditForm({
      name: '',
      current_value: '',
      recipient: '',
      notes: '',
    })
  }, [actionLoadingId])

  const handleToggleStatus = useCallback(async (asset: AssetWithType, nextStatus: 'ACTIVE' | 'SOLD') => {
    if (actionLoadingId) return

    setActionLoadingId(asset.id)
    setActionError(null)

    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el estado'))
      }

      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/assets'))
      router.refresh()
      toast.success(
        nextStatus === 'ACTIVE' ? 'Activo activado' : 'Activo dado de baja',
        asset.name,
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

  const handleDelete = useCallback(async () => {
    if (!pendingDelete || actionLoadingId) return

    setActionLoadingId(pendingDelete.id)
    setActionError(null)

    try {
      const res = await fetch(`/api/assets/${pendingDelete.id}`, { method: 'DELETE' })

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el activo'))
      }

      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/assets'))
      router.refresh()
      toast.success('Activo eliminado', pendingDelete.name, { persist: false })
      setPendingDelete(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al eliminar'
      setActionError(message)
      toast.error('No se pudo eliminar', message)
    } finally {
      setActionLoadingId(null)
    }
  }, [actionLoadingId, pendingDelete, refetch, router, toast])

  const handleSaveEdit = useCallback(async () => {
    if (!editingAsset || actionLoadingId) return

    const trimmedName = editForm.name.trim()
    if (trimmedName.length < 2) {
      const message = 'El nombre debe tener al menos 2 caracteres.'
      setActionError(message)
      toast.error('No se pudo actualizar el activo', message)
      return
    }

    const currentValue = roundToDecimals(parseNumericInput(editForm.current_value, Number.NaN), 2)
    if (!Number.isFinite(currentValue) || currentValue <= 0) {
      const message = 'El valor actual debe ser mayor a 0.'
      setActionError(message)
      toast.error('No se pudo actualizar el activo', message)
      return
    }

    setActionLoadingId(editingAsset.id)
    setActionError(null)

    try {
      const res = await fetch(`/api/assets/${editingAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          current_value: currentValue,
          recipient: editForm.recipient.trim() || null,
          notes: editForm.notes.trim() || null,
        }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el activo'))
      }

      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/assets'))
      router.refresh()
      toast.success('Activo actualizado', trimmedName, { persist: false })
      closeEditModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el activo'
      setActionError(message)
      toast.error('No se pudo actualizar el activo', message)
    } finally {
      setActionLoadingId(null)
    }
  }, [actionLoadingId, closeEditModal, editForm, editingAsset, refetch, router, toast])

  return (
    <>
      <RegisterModule
        eyebrow="Inventario patrimonial"
        title="Activos"
        description="Bienes, equipos e inversiones bajo un registro mas preciso, con lectura inmediata de valor, tipo y vigencia."
        headerMode="content"
        actions={(
          <CreateModuleButton
            onClick={onCreate}
            label="Nuevo activo"
            testId="assets-hero-create-button"
          />
        )}
        stats={(
          <StatGrid>
            <StatCard
              label="Valor PEN"
              value={formatCurrency(totalPen, 'PEN')}
              detail={`${activeCount} activo${activeCount === 1 ? '' : 's'}`}
              caption="Valor consolidado de activos operativos en soles."
            />
            <StatCard
              label="Valor USD"
              value={formatCurrency(totalUsd, 'USD')}
              detail={totalUsd === 0 ? 'Sin exposicion' : 'Exposicion dolarizada'}
              caption="Activos vigentes valorizados en dolares."
            />
            <StatCard
              label="Tipos activos"
              value={String(typeCount)}
              detail={inactiveCount > 0 ? `${inactiveCount} inactivo${inactiveCount === 1 ? '' : 's'}` : 'Sin bajas'}
              caption="Diversidad de clases en el inventario actual."
            />
            <StatCard
              label="Inventario vigente"
              value={String(activeCount)}
              detail={`${typedAssets.length} total`}
              caption="Registros activos disponibles para seguimiento patrimonial."
            />
          </StatGrid>
        )}
        controls={(
          <ControlsBar
            presets={(
              <>
                <DataFilterPreset
                  label="Activos"
                  active={statusFilter === 'ACTIVE'}
                  count={activeCount}
                  onClick={() => setStatusFilter('ACTIVE')}
                />
                <DataFilterPreset
                  label="Inactivos"
                  active={statusFilter === 'INACTIVE'}
                  count={inactiveCount}
                  onClick={() => setStatusFilter('INACTIVE')}
                />
                <DataFilterPreset
                  label="Todos"
                  active={statusFilter === 'all'}
                  count={typedAssets.length}
                  onClick={() => setStatusFilter('all')}
                />
              </>
            )}
            search={(
              <DataSearchField
                value={search}
                onChange={setSearch}
                placeholder="Buscar activo por nombre"
              />
            )}
            filters={(
              <FilterBar>
                <AppSelect
                  value={typeFilter}
                  onChange={setTypeFilter}
                  compact
                  className="w-[210px]"
                  options={[
                    { value: '', label: 'Tipo' },
                    ...assetTypes.map(type => ({ value: type.id, label: type.name })),
                  ]}
                  searchPlaceholder="Buscar tipo..."
                />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={event => setDateFrom(event.target.value)}
                  className="field-base h-[34px] w-[150px] py-1.5 text-[12px]"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={event => setDateTo(event.target.value)}
                  className="field-base h-[34px] w-[150px] py-1.5 text-[12px]"
                />
              </FilterBar>
            )}
            viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} id="assets-view-toggle" />}
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
                    <div className="h-5 w-52 rounded-full bg-[var(--c-surface-2)]" />
                  </div>
                  <div className="h-10 w-32 rounded-full bg-[var(--c-surface-2)]" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search || typeFilter || dateFrom || dateTo || statusFilter !== 'ACTIVE'
              ? 'No encontramos activos para esos filtros.'
              : 'Todavia no tienes activos registrados.'}
            description={search || typeFilter || dateFrom || dateTo || statusFilter !== 'ACTIVE'
              ? 'Ajusta rango, tipo o estado para recuperar bienes e inversiones del inventario.'
              : 'Crea tu primer activo para empezar a ordenar inventario patrimonial, valor actual y seguimiento.'}
            action={search || typeFilter || dateFrom || dateTo || statusFilter !== 'ACTIVE'
              ? {
                  label: 'Limpiar filtros',
                  onClick: () => {
                    setSearch('')
                    setTypeFilter('')
                    setDateFrom('')
                    setDateTo('')
                    setStatusFilter('ACTIVE')
                  },
                }
              : {
                  label: 'Nuevo activo',
                  onClick: onCreate,
                }}
          />
        ) : viewMode === 'list' ? (
          <DataTable className="overflow-hidden">
            <div className="hidden border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(180px,0.9fr)_auto] md:items-center md:gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Activo</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Tipo y estado</p>
              <p className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Valor</p>
              <p className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">Acciones</p>
            </div>

            <div className="divide-y divide-[var(--c-border)]">
              {filtered.map(asset => {
                const isActive = asset.status === 'ACTIVE'
                const typeColor = asset.asset_type_info?.color ?? 'var(--c-primary)'
                const typeName = asset.asset_type_info?.name ?? 'Sin tipo'
                const currentValue = asset.current_value ?? asset.purchase_value

                return (
                  <article
                    key={asset.id}
                    data-testid={`asset-row-${asset.id}`}
                    className="px-4 py-4 transition-[background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--c-surface-2)]"
                  >
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(180px,0.9fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border"
                            style={{
                              borderColor: withAlpha(asset.asset_type_info?.color, '24', 'rgba(13,107,94,0.18)'),
                              backgroundColor: withAlpha(asset.asset_type_info?.color, '12', 'rgba(13,107,94,0.08)'),
                              color: asset.asset_type_info?.color ?? 'var(--c-primary)',
                            }}
                          >
                            {cubeIcon()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                              {asset.name}
                            </p>
                            <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
                              Compra {formatDateLabel(asset.purchase_date)}
                              {asset.recipient ? ` · ${asset.recipient}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={isActive ? 'success' : 'muted'}>
                            {isActive ? 'Activo' : 'Inactivo'}
                          </StatusBadge>
                          <StatusBadge tone="primary" dot={false} className="max-w-full">
                            {typeName}
                          </StatusBadge>
                        </div>
                        <p className="mt-2 text-[12px] text-[var(--c-text-muted)]">
                          Compra {formatCurrency(asset.purchase_value, asset.currency as 'PEN' | 'USD')}
                        </p>
                      </div>

                      <AmountCell
                        label="Valor actual"
                        value={formatCurrency(currentValue, asset.currency as 'PEN' | 'USD')}
                        meta={asset.currency}
                        align="right"
                        className="md:justify-self-end"
                      />

                      <div className="flex shrink-0 items-center gap-1.5 md:justify-self-end">
                        <ActionIconButton
                          icon="edit"
                          label="Editar"
                          disabled={Boolean(actionLoadingId)}
                          testId={`asset-edit-${asset.id}`}
                          onClick={() => openEditModal(asset)}
                        />
                        <ActionIconButton
                          icon={isActive ? 'deactivate' : 'reactivate'}
                          label={isActive ? 'Desactivar' : 'Activar'}
                          variant={isActive ? 'danger' : 'success'}
                          disabled={Boolean(actionLoadingId)}
                          testId={isActive ? `asset-deactivate-${asset.id}` : `asset-reactivate-${asset.id}`}
                          onClick={() => void handleToggleStatus(asset, isActive ? 'SOLD' : 'ACTIVE')}
                        />
                        <ActionIconButton
                          icon="delete"
                          label="Eliminar"
                          variant="danger"
                          disabled={Boolean(actionLoadingId)}
                          testId={`asset-delete-${asset.id}`}
                          onClick={() => {
                            setActionError(null)
                            setPendingDelete(asset)
                          }}
                        />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </DataTable>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(asset => {
              const isActive = asset.status === 'ACTIVE'
              const typeName = asset.asset_type_info?.name ?? 'Sin tipo'
              const typeColor = asset.asset_type_info?.color ?? 'var(--c-primary)'
              const currentValue = asset.current_value ?? asset.purchase_value

              return (
                <article
                  key={asset.id}
                  data-testid={`asset-card-${asset.id}`}
                  className="rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1"
                >
                  <div className="rounded-[12px] bg-[var(--c-surface)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border"
                          style={{
                            borderColor: withAlpha(asset.asset_type_info?.color, '24', 'rgba(13,107,94,0.18)'),
                            backgroundColor: withAlpha(asset.asset_type_info?.color, '12', 'rgba(13,107,94,0.08)'),
                            color: typeColor,
                          }}
                        >
                          {cubeIcon()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                            {asset.name}
                          </p>
                          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">{typeName}</p>
                        </div>
                      </div>
                      <StatusBadge tone={isActive ? 'success' : 'muted'}>
                        {isActive ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </div>

                    <div className="mt-5">
                      <AmountCell
                        label="Valor actual"
                        value={formatCurrency(currentValue, asset.currency as 'PEN' | 'USD')}
                        meta={`Compra ${formatCurrency(asset.purchase_value, asset.currency as 'PEN' | 'USD')}`}
                        align="left"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <StatusBadge tone="primary" dot={false}>
                        {typeName}
                      </StatusBadge>
                      <StatusBadge tone="muted" dot={false}>
                        {formatDateLabel(asset.purchase_date)}
                      </StatusBadge>
                    </div>

                    <div className="mt-4 border-t border-[var(--c-border)] pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-[12px] text-[var(--c-text-muted)]">
                          {asset.recipient ?? 'Sin destinatario'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <ActionIconButton
                            icon="edit"
                            label="Editar"
                            disabled={Boolean(actionLoadingId)}
                            testId={`asset-edit-card-${asset.id}`}
                            onClick={() => openEditModal(asset)}
                          />
                          <ActionIconButton
                            icon={isActive ? 'deactivate' : 'reactivate'}
                            label={isActive ? 'Desactivar' : 'Activar'}
                            variant={isActive ? 'danger' : 'success'}
                            disabled={Boolean(actionLoadingId)}
                            testId={isActive ? `asset-deactivate-card-${asset.id}` : `asset-reactivate-card-${asset.id}`}
                            onClick={() => void handleToggleStatus(asset, isActive ? 'SOLD' : 'ACTIVE')}
                          />
                          <ActionIconButton
                            icon="delete"
                            label="Eliminar"
                            variant="danger"
                            disabled={Boolean(actionLoadingId)}
                            testId={`asset-delete-card-${asset.id}`}
                            onClick={() => {
                              setActionError(null)
                              setPendingDelete(asset)
                            }}
                          />
                        </div>
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
        open={Boolean(editingAsset)}
        onClose={closeEditModal}
        eyebrow="Activos"
        title="Editar activo"
        subtitle="Ajusta la referencia operativa y el valor actual sin reabrir el registro completo."
        widthClassName="w-[calc(100vw-32px)] max-w-[720px]"
        testId="assets-edit-modal"
      >
        <div className="space-y-[var(--ft-form-section-gap)]">
          <FormSection
            title="Datos editables"
            description="Mantén actualizado el nombre, el valor vigente y la lectura rápida del activo."
            columns="2"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Nombre" className="md:col-span-2">
              <input
                value={editForm.name}
                onChange={event => setEditForm(prev => ({ ...prev, name: event.target.value }))}
                className="field-base ft-form-input w-full"
                disabled={Boolean(actionLoadingId)}
                maxLength={150}
              />
            </FormField>

            <FormField label="Valor actual">
              <NumericInput
                value={editForm.current_value}
                onValueChange={value => setEditForm(prev => ({ ...prev, current_value: value }))}
                step="0.01"
                decimals={2}
                min={0}
                className="field-base ft-form-input w-full"
                disabled={Boolean(actionLoadingId)}
              />
            </FormField>

            <FormField label="Fecha de compra" optional>
              <div className="field-base ft-form-input flex w-full items-center text-[var(--ft-form-muted)]">
                {editingAsset ? formatDateLabel(editingAsset.purchase_date) : '—'}
              </div>
            </FormField>

            <FormField label="Destinatario" optional className="md:col-span-2">
              <input
                value={editForm.recipient}
                onChange={event => setEditForm(prev => ({ ...prev, recipient: event.target.value }))}
                className="field-base ft-form-input w-full"
                placeholder="Ej: Area de operaciones"
                disabled={Boolean(actionLoadingId)}
                maxLength={160}
              />
            </FormField>

            <FormField label="Notas" optional className="md:col-span-2">
              <textarea
                value={editForm.notes}
                onChange={event => setEditForm(prev => ({ ...prev, notes: event.target.value }))}
                className="field-base ft-form-input min-h-[112px] w-full resize-y"
                placeholder="Notas internas del activo"
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
                loading={Boolean(editingAsset && actionLoadingId === editingAsset.id)}
                variant="primary"
                size="lg"
                testId="assets-edit-save-button"
              >
                Guardar cambios
              </Button>
            )}
          />
        </RecordModalFooter>
      </RecordModal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar activo"
        message={(
          <>
            Se eliminara <span className="font-semibold text-[var(--c-text)]">{pendingDelete?.name}</span> y su
            transaccion de egreso asociada. Esta accion no se puede deshacer.
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
        testId="assets-delete-modal"
        cancelTestId="assets-delete-cancel-button"
        confirmTestId="assets-delete-confirm-button"
      />
    </>
  )
}
