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
import { RecordModal } from '@/components/ui/RecordModal'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import { ConfirmDialog, DataErrorBanner, DataSearchField, EmptyState, PageLayout } from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import movementStyles from '@/components/tables/TransactionsRound07.module.css'
import { AssetRecordContent } from '@/components/assets/AssetRecordContent'
import {
  getAssetStatusPresentation,
  getAssetPurchaseValue,
  getAssetTypePresentation,
  getRecordedAssetValue,
  matchesAssetStatusFilter,
  summarizeActiveAssetValues,
  type AssetStatusFilter,
  type AssetWithTypeInfo,
} from '@/modules/assets/asset-presentation'
import styles from './AssetsListPanel.module.css'

type AssetTypeOption = { id: string; name: string }
type EditForm = { name: string; current_value: string; recipient: string; notes: string }
type CurrencySummary = { currency: string; amount: number; count: number; invalidCount: number }

function currencyLabel(currency: string) {
  if (currency === 'PEN' || currency === 'USD') return currency
  return currency === 'UNVERIFIED' ? 'Moneda no verificable' : currency
}

function amountLabel(amount: number, currency: string) {
  if (currency === 'PEN' || currency === 'USD') return formatCurrency(amount, currency)
  return `${currencyLabel(currency)} ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`
}

function getErrorMessage(error: unknown) {
  if (!error) return null
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Ocurrió un error inesperado.'
}

function statusTab(status: AssetStatusFilter, label: string, selected: AssetStatusFilter, onSelect: (value: AssetStatusFilter) => void) {
  return (
    <button
      type="button"
      aria-pressed={selected === status}
      className={styles.tab}
      data-active={selected === status}
      onClick={() => onSelect(status)}
    >
      {label}
    </button>
  )
}

export function AssetsListPanel({ onCreate }: { onCreate: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<AssetStatusFilter>('ACTIVE')
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([])
  const [assetTypesError, setAssetTypesError] = useState<string | null>(null)
  const [editingAsset, setEditingAsset] = useState<AssetWithTypeInfo | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ name: '', current_value: '', recipient: '', notes: '' })
  const [editDiscardOpen, setEditDiscardOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AssetWithTypeInfo | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<AssetWithTypeInfo | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { assets, isLoading, error: hookError, refetch } = useAssets({ status: '' })
  const rows = assets as AssetWithTypeInfo[]

  const loadTypes = useCallback(async () => {
    setAssetTypesError(null)
    try {
      const response = await fetch('/api/asset-types', { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los tipos de activo.'))
      setAssetTypes((json.data as AssetTypeOption[]) ?? [])
    } catch (error) {
      setAssetTypesError(getErrorMessage(error))
    }
  }, [])

  useEffect(() => { void loadTypes() }, [loadTypes])

  const statusCounts = useMemo(() => ({
    active: rows.filter(asset => asset.status === 'ACTIVE').length,
    sold: rows.filter(asset => asset.status === 'SOLD').length,
    depreciated: rows.filter(asset => asset.status === 'DEPRECIATED').length,
    unknown: rows.filter(asset => !getAssetStatusPresentation(asset.status).isVerified).length,
    all: rows.length,
  }), [rows])
  const summaries = useMemo(() => summarizeActiveAssetValues(rows), [rows])
  const knownCurrencySummaries = summaries.filter(summary => summary.currency !== 'UNVERIFIED')
  const displayedSummaries: CurrencySummary[] = [
    ...['PEN', 'USD'].map(currency => knownCurrencySummaries.find(summary => summary.currency === currency)
      ?? { currency, amount: 0, count: 0, invalidCount: 0 }),
    ...knownCurrencySummaries.filter(summary => summary.currency !== 'PEN' && summary.currency !== 'USD'),
  ]

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-PE')
    return rows.filter(asset => {
      if (!matchesAssetStatusFilter(asset.status, statusFilter)) return false
      if (typeFilter && asset.asset_type_id !== typeFilter) return false
      if (currencyFilter && asset.currency !== currencyFilter) return false
      return !query || [asset.name, asset.recipient, asset.location, asset.serial_number]
        .some(value => value?.toLocaleLowerCase('es-PE').includes(query))
    })
  }, [currencyFilter, rows, search, statusFilter, typeFilter])

  const surfaceError = actionError ?? (hookError ? getErrorMessage(hookError) : null)
  const hasFilters = Boolean(search || typeFilter || currencyFilter || statusFilter !== 'ACTIVE')

  const openEdit = useCallback((asset: AssetWithTypeInfo) => {
    setActionError(null)
    setEditingAsset(asset)
    setEditForm({
      name: asset.name,
      current_value: getRecordedAssetValue(asset)?.toFixed(2) ?? '',
      recipient: asset.recipient ?? '',
      notes: asset.notes ?? '',
    })
  }, [])

  const initialEditForm = useMemo(() => editingAsset ? ({
    name: editingAsset.name,
    current_value: getRecordedAssetValue(editingAsset)?.toFixed(2) ?? '',
    recipient: editingAsset.recipient ?? '',
    notes: editingAsset.notes ?? '',
  }) : null, [editingAsset])
  const editIsDirty = Boolean(initialEditForm && JSON.stringify(initialEditForm) !== JSON.stringify(editForm))

  const closeEdit = useCallback(() => {
    if (actionLoadingId) return
    if (editIsDirty) {
      setEditDiscardOpen(true)
      return
    }
    setEditingAsset(null)
  }, [actionLoadingId, editIsDirty])

  const handleStatus = useCallback(async (asset: AssetWithTypeInfo, nextStatus: 'ACTIVE' | 'SOLD') => {
    if (actionLoadingId) return
    setActionLoadingId(asset.id)
    setActionError(null)
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el estado.'))
      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/assets'))
      router.refresh()
      toast.success(nextStatus === 'ACTIVE' ? 'Activo reactivado' : 'Activo marcado como vendido', asset.name, { persist: false })
    } catch (error) {
      const message = getErrorMessage(error) ?? 'No se pudo actualizar el activo.'
      setActionError(message)
      toast.error('No se pudo actualizar el activo', message)
    } finally {
      setActionLoadingId(null)
    }
  }, [actionLoadingId, refetch, router, toast])

  const handleDelete = useCallback(async () => {
    if (!pendingDelete || actionLoadingId) return
    setActionLoadingId(pendingDelete.id)
    setActionError(null)
    try {
      const response = await fetch(`/api/assets/${pendingDelete.id}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 204) {
        const json = await response.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el activo.'))
      }
      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/assets'))
      router.refresh()
      toast.success('Activo eliminado', pendingDelete.name, { persist: false })
      setPendingDelete(null)
    } catch (error) {
      const message = getErrorMessage(error) ?? 'No se pudo eliminar el activo.'
      setActionError(message)
      toast.error('No se pudo eliminar', message)
    } finally {
      setActionLoadingId(null)
    }
  }, [actionLoadingId, pendingDelete, refetch, router, toast])

  const saveEdit = useCallback(async () => {
    if (!editingAsset || actionLoadingId) return
    const name = editForm.name.trim()
    const currentValue = roundToDecimals(parseNumericInput(editForm.current_value, Number.NaN), 2)
    if (name.length < 2) { setActionError('El nombre debe tener al menos 2 caracteres.'); return }
    if (!Number.isFinite(currentValue) || currentValue <= 0) { setActionError('El valor actual debe ser mayor a 0.'); return }
    setActionLoadingId(editingAsset.id)
    setActionError(null)
    try {
      const response = await fetch(`/api/assets/${editingAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, current_value: currentValue, recipient: editForm.recipient.trim() || null, notes: editForm.notes.trim() || null }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el activo.'))
      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/assets'))
      router.refresh()
      setEditingAsset(null)
      toast.success('Activo actualizado', name, { persist: false })
    } catch (error) {
      const message = getErrorMessage(error) ?? 'No se pudo actualizar el activo.'
      setActionError(message)
      toast.error('No se pudo actualizar el activo', message)
    } finally {
      setActionLoadingId(null)
    }
  }, [actionLoadingId, editForm, editingAsset, refetch, router, toast])

  return (
    <PageLayout className={`max-w-none !gap-0 ${movementStyles.v3ModuleContent} ${styles.page}`}>
      <div className={movementStyles.pageOverview} data-testid="assets-page-overview">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 data-ft-route-heading="" tabIndex={-1} className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">Activos</h1>
            <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">Bienes registrados, organizados por tipo y estado.</p>
          </div>
          <CreateModuleButton onClick={onCreate} label="Registrar activo" className={`${movementStyles.v3ModulePrimaryAction} ${styles.createButton}`} testId="assets-create-button" />
        </header>
        <section className={movementStyles.summary} aria-label="Resumen de activos registrados" data-testid="assets-summary">
          {displayedSummaries.map(summary => (
            <div key={summary.currency} className={movementStyles.summaryItem}>
              <p>Valor registrado · {currencyLabel(summary.currency)}</p>
              <div className={`${movementStyles.summaryValue} tabular-nums`}>
                {isLoading || (hookError && rows.length === 0) ? '—' : summary.invalidCount && !summary.count ? 'No verificable' : amountLabel(summary.amount, summary.currency)}
              </div>
              <span className={movementStyles.summaryDetail}>
                {isLoading ? 'Cargando resumen' : hookError && rows.length === 0 ? 'Resumen no disponible' : `${summary.count} activo${summary.count === 1 ? '' : 's'} vigente${summary.count === 1 ? '' : 's'}${summary.invalidCount ? ` · ${summary.invalidCount} sin valor verificable` : ''}`}
              </span>
            </div>
          ))}
          <div className={`${movementStyles.summaryItem} ${movementStyles.summaryQualitative}`}>
            <p>Activos vigentes</p>
            <div className={`${movementStyles.summaryValue} tabular-nums`}>{isLoading || (hookError && rows.length === 0) ? '—' : String(statusCounts.active)}</div>
            <span className={movementStyles.summaryDetail}>{isLoading ? 'Cargando resumen' : hookError && rows.length === 0 ? 'Resumen no disponible' : `${statusCounts.sold} vendidos · ${statusCounts.depreciated} depreciados${statusCounts.unknown ? ` · ${statusCounts.unknown} sin verificar` : ''}`}</span>
          </div>
        </section>
        {summaries.some(summary => summary.currency === 'UNVERIFIED' || summary.invalidCount > 0) ? (
          <p className={styles.summaryNote} role="note" data-testid="assets-unverified-values-note">Algunos activos vigentes tienen una moneda o un valor que no se puede verificar; se mantienen fuera de los importes monetarios correspondientes.</p>
        ) : null}
      </div>

      <nav aria-label="Filtrar activos por estado" className={movementStyles.tabs} data-testid="assets-status-tabs">
        {statusTab('ACTIVE', 'Activos', statusFilter, setStatusFilter)}
        {statusTab('SOLD', 'Vendidos', statusFilter, setStatusFilter)}
        {statusTab('DEPRECIATED', 'Depreciados', statusFilter, setStatusFilter)}
        {statusCounts.unknown > 0 ? statusTab('UNKNOWN', 'Sin verificar', statusFilter, setStatusFilter) : null}
        {statusTab('all', 'Todos', statusFilter, setStatusFilter)}
      </nav>

      <div className={`${movementStyles.controls} ${movementStyles.portfolioFilterBar} ${styles.toolbar}`} data-testid="assets-filter-toolbar">
        <div className={movementStyles.controlsMain}>
          <div className={styles.search}>
            <DataSearchField value={search} onChange={setSearch} placeholder="Buscar activo por nombre" aria-label="Buscar activos" data-testid="assets-search" />
          </div>
          <AppSelect
            value={typeFilter}
            onChange={setTypeFilter}
            compact
            matchTriggerWidth
            searchable
            searchPlaceholder="Buscar tipo..."
            className={`filters-control ${styles.typeSelect}`}
            ariaLabel="Filtrar por tipo de activo"
            testId="assets-type-filter"
            options={[{ value: '', label: 'Todos los tipos' }, ...assetTypes.map(type => ({ value: type.id, label: type.name }))]}
          />
          <AppSelect
            value={currencyFilter}
            onChange={setCurrencyFilter}
            compact
            matchTriggerWidth
            searchable={false}
            className={`filters-control ${styles.currencySelect}`}
            ariaLabel="Filtrar por moneda"
            testId="assets-currency-filter"
            options={[{ value: '', label: 'Todas las monedas' }, ...[...new Set(rows.map(asset => asset.currency).filter(Boolean))].sort().map(currency => ({ value: currency, label: currencyLabel(currency) }))]}
          />
        </div>
      </div>

      {assetTypesError ? <DataErrorBanner message={assetTypesError} onRetry={() => void loadTypes()} /> : null}
      {surfaceError ? <DataErrorBanner message={surfaceError} onRetry={() => { void refetch() }} /> : null}

      <section className={styles.register} aria-labelledby="assets-register-title" data-testid="assets-register">
        <div className={styles.registerHeader}>
          <div className="min-w-0">
            <h2 id="assets-register-title">Registro de activos</h2>
            <p>Valores registrados por el usuario; no son estimaciones de mercado.</p>
          </div>
          <span className={styles.registerCount}>{filtered.length} registro{filtered.length === 1 ? '' : 's'}</span>
        </div>

        {isLoading ? (
          <div className={styles.loadingRows} aria-label="Cargando activos">{[0, 1, 2].map(index => <div className={styles.loadingRow} key={index} aria-hidden="true"><span /><span /><span /></div>)}</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}><EmptyState title={hasFilters ? 'No encontramos activos para esos filtros.' : 'Todavía no tienes activos registrados.'} description={hasFilters ? 'Ajusta la búsqueda o los filtros para ver otros registros.' : 'Registra un activo para mantener su compra y valor actual en un solo lugar.'} action={hasFilters ? { label: 'Limpiar filtros', onClick: () => { setSearch(''); setTypeFilter(''); setCurrencyFilter(''); setStatusFilter('ACTIVE') } } : { label: 'Registrar activo', onClick: onCreate }} /></div>
        ) : (
          <div className={styles.table} data-testid="assets-table">
            <div className={`${styles.tableRow} ${styles.tableHead}`} aria-hidden="true">
              <span>Activo</span><span>Tipo / estado</span><span>Fecha y valor de compra</span><span>Valor actual registrado</span><span className="text-right">Acciones</span>
            </div>
            {filtered.map(asset => {
              const status = getAssetStatusPresentation(asset.status)
              const type = getAssetTypePresentation(asset)
              const current = getRecordedAssetValue(asset)
              const purchase = getAssetPurchaseValue(asset)
              const active = status.status === 'ACTIVE'
              return (
                <article key={asset.id} className={`${styles.tableRow} ${styles.assetRow}`} data-testid={`asset-row-${asset.id}`}>
                  <div className={styles.assetIdentity}>
                    <span className={styles.assetIcon} aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 9 4.5v11L12 22 3 17.5v-11L12 2Z"/><path d="M12 22V12m9-5.5-9 5.5-9-5.5"/></svg></span>
                    <div className="min-w-0">
                      <button type="button" onClick={() => setSelectedAsset(asset)} className={styles.assetName} data-testid={`asset-view-${asset.id}`}>{asset.name}</button>
                      <p>{asset.recipient || type.label}</p>
                    </div>
                  </div>
                  <div className={styles.statusCell}>
                    <span className={`${styles.badge} ${status.isVerified ? styles.verified : styles.warning}`}>{status.label}</span>
                    <span className={styles.typeLabel}>{type.label}{type.source === 'CUSTOM' ? ' · Personalizado' : ''}</span>
                  </div>
                  <div className={styles.purchaseCell}>
                    <strong>{purchase === null ? 'No verificable' : amountLabel(purchase, asset.currency)}</strong>
                    <span>{formatDateLabel(asset.purchase_date)}</span>
                  </div>
                  <div className={styles.currentCell}>
                    <strong>{current === null ? 'No verificable' : amountLabel(current, asset.currency)}</strong>
                    <span>{asset.currency || 'Moneda no verificable'}</span>
                  </div>
                  <div className={styles.actions}>
                    <ActionIconButton icon="view" label="Ver activo" testId={`asset-view-action-${asset.id}`} onClick={() => setSelectedAsset(asset)} />
                    <ActionIconButton icon="edit" label="Editar" disabled={Boolean(actionLoadingId)} testId={`asset-edit-${asset.id}`} onClick={() => openEdit(asset)} />
                    <ActionIconButton icon={active ? 'deactivate' : 'reactivate'} label={active ? 'Marcar como vendido' : 'Reactivar'} variant={active ? 'danger' : 'success'} disabled={Boolean(actionLoadingId) || !status.isVerified || status.status === 'DEPRECIATED'} testId={active ? `asset-deactivate-${asset.id}` : `asset-reactivate-${asset.id}`} onClick={() => void handleStatus(asset, active ? 'SOLD' : 'ACTIVE')} />
                    <ActionIconButton icon="delete" label="Eliminar" variant="danger" disabled={Boolean(actionLoadingId)} testId={`asset-delete-${asset.id}`} onClick={() => { setActionError(null); setPendingDelete(asset) }} />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <RecordModal open={Boolean(selectedAsset)} onClose={() => setSelectedAsset(null)} presentation="workbench" size="xl" overlayClassName={styles.detailOverlay} bodyClassName={styles.detailBody} eyebrow="Detalle del activo" title={selectedAsset?.name ?? 'Activo'} subtitle="Registro original, estado y valores guardados." headerBadge={selectedAsset ? <span className={styles.headerBadge}>{getAssetStatusPresentation(selectedAsset.status).label}</span> : undefined} testId="assets-detail-modal">
        {selectedAsset ? <AssetRecordContent asset={selectedAsset} transaction={selectedAsset.transaction_id ? { id: selectedAsset.transaction_id, description: null } : null} /> : null}
      </RecordModal>

      <RecordModal open={Boolean(editingAsset)} onClose={closeEdit} presentation="workbench" size="lg" overlayClassName={styles.editOverlay} eyebrow="Activos" title="Editar activo" subtitle="Actualiza los campos permitidos sin crear otro movimiento de compra." testId="assets-edit-modal" focusTrapActive={!editDiscardOpen} preserveFocusOnResume footer={(
        <FormActions
          secondaryAction={<Button type="button" variant="secondary" onClick={closeEdit} disabled={Boolean(actionLoadingId)}>Cancelar</Button>}
          primaryAction={<Button type="button" variant="primary" onClick={() => void saveEdit()} loading={Boolean(editingAsset && actionLoadingId === editingAsset.id)} disabled={Boolean(actionLoadingId)} testId="assets-edit-save-button">Guardar cambios</Button>}
        />
      )}>
        {editingAsset ? (
          <div className="space-y-4">
            <FormSection title="Identificación y valor registrado" className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] p-4 sm:p-5">
              <FormField label="Nombre"><input value={editForm.name} onChange={event => setEditForm(prev => ({ ...prev, name: event.target.value }))} className="field-base ft-form-input w-full" maxLength={150} /></FormField>
              <FormField label={`Valor actual · ${editingAsset.currency}`}><NumericInput value={editForm.current_value} onValueChange={value => setEditForm(prev => ({ ...prev, current_value: value }))} step="0.01" decimals={2} min={0} className="field-base ft-form-input w-full" disabled={Boolean(actionLoadingId)} /></FormField>
              <FormField label="Fecha de compra" description="La fecha original no se puede modificar desde esta pantalla."><div className="field-base ft-form-input flex w-full items-center text-[var(--ft-text-muted)]">{formatDateLabel(editingAsset.purchase_date)}</div></FormField>
              <FormField label="Proveedor o destinatario" optional><input value={editForm.recipient} onChange={event => setEditForm(prev => ({ ...prev, recipient: event.target.value }))} className="field-base ft-form-input w-full" maxLength={160} /></FormField>
              <FormField label="Notas" optional><textarea value={editForm.notes} onChange={event => setEditForm(prev => ({ ...prev, notes: event.target.value }))} className="field-base ft-form-input min-h-[96px] w-full resize-y" maxLength={500} /></FormField>
            </FormSection>
            {actionError ? <p role="alert" className="text-[12px] font-medium text-[var(--ft-danger)]">{actionError}</p> : null}
          </div>
        ) : null}
      </RecordModal>

      <ConfirmDialog open={editDiscardOpen} title="Descartar cambios" message="Hay cambios sin guardar. ¿Quieres cerrar sin aplicarlos?" onCancel={() => setEditDiscardOpen(false)} onConfirm={() => { setEditDiscardOpen(false); setEditingAsset(null) }} confirmLabel="Descartar cambios" cancelLabel="Seguir editando" testId="assets-edit-discard-modal" />
      <ConfirmDialog open={Boolean(pendingDelete)} title="Eliminar activo" message={<>Se eliminará <strong>{pendingDelete?.name}</strong> y la transacción de egreso vinculada. Esta acción no se puede deshacer.</>} onCancel={() => { if (!actionLoadingId) setPendingDelete(null) }} onConfirm={() => void handleDelete()} loading={pendingDelete ? actionLoadingId === pendingDelete.id : false} danger confirmLabel="Eliminar" testId="assets-delete-modal" cancelTestId="assets-delete-cancel-button" confirmTestId="assets-delete-confirm-button" />
    </PageLayout>
  )
}
