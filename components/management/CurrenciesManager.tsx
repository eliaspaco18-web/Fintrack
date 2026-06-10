// =============================================================================
// components/management/CurrenciesManager.tsx
// PRD v3 — Módulo 10: Administración > Moneda
//
// Campos:
//   - País (lista desplegable de países, obligatorio)
//   - Moneda (catálogo de principales monedas, obligatorio)
//
// Acciones por registro: Editar, Eliminar (restricción), Desactivar/Activar
// =============================================================================

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/lib/toast/toast'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import { CountrySelect, COUNTRIES } from '@/components/ui/CountrySelect'
import { RecordModal, RecordModalFooter } from '@/components/ui/RecordModal'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import {
  ConfirmDialog,
  DataSearchField,
  StatusBadge,
} from '@/components/finance'
import {
  CatalogCell,
  CatalogEmptyState,
  CatalogIdentity,
  CatalogRow,
  CatalogTable,
} from '@/components/management/catalog'
import {
  createCurrencyAction,
  deleteCurrencyAction,
  listCurrenciesAction,
  updateCurrencyAction,
} from '@/app/actions/admin.actions'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type CurrencyItem = {
  id: string
  user_id: string | null
  code: string
  name: string
  symbol: string
  country: string | null
  is_default: boolean
  is_system: boolean
  is_active: boolean
}

type CurrencyForm = {
  code: string
  name: string
  symbol: string
  country: string
  is_default: boolean
  is_active: boolean
}

const EMPTY_FORM: CurrencyForm = {
  code: '',
  name: '',
  symbol: '',
  country: '',
  is_default: false,
  is_active: true,
}

type StatusFilter = 'all' | 'active' | 'inactive'

const COUNTRY_LABEL_MAP = new Map<string, string>(COUNTRIES.map(item => [item.code, `${item.flag} ${item.name}`]))

function resolveCountryLabel(country: string | null): string {
  if (!country) return '—'
  return COUNTRY_LABEL_MAP.get(country) ?? country
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function CurrenciesManager() {
  const { toast } = useToast()
  const [items, setItems] = useState<CurrencyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CurrencyForm>(EMPTY_FORM)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CurrencyItem | null>(null)

  // ─── DATA ─────────────────────────────────────────────────────────────────

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listCurrenciesAction()
    if (!result.ok) {
      setError(result.error.message)
      setLoading(false)
      return
    }
    setItems(result.data as CurrencyItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  // ─── COMPUTED ─────────────────────────────────────────────────────────────

  const activeCount = useMemo(() => items.filter(i => i.is_active).length, [items])
  const customCount = useMemo(() => items.filter(i => !i.is_system).length, [items])
  const defaultCount = useMemo(() => items.filter(i => i.is_default).length, [items])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (statusFilter === 'active' && !item.is_active) return false
      if (statusFilter === 'inactive' && item.is_active) return false
      if (!q) return true
      return (
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.symbol.toLowerCase().includes(q)
      )
    })
  }, [items, query, statusFilter])

  // ─── MODAL ────────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }, [])

  const openCreateModal = useCallback(() => {
    resetForm()
    setModalOpen(true)
  }, [resetForm])

  const closeModal = useCallback(() => {
    if (saving) return
    setModalOpen(false)
    resetForm()
  }, [resetForm, saving])

  const startEdit = useCallback((item: CurrencyItem) => {
    if (item.is_system) return
    setEditingId(item.id)
    setForm({
      code: item.code,
      name: item.name,
      symbol: item.symbol,
      country: item.country ?? 'PE',
      is_default: item.is_default,
      is_active: item.is_active,
    })
    setModalOpen(true)
  }, [])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      symbol: form.symbol.trim() || '$',
      country: form.country.trim() || null,
      is_default: form.is_default,
      is_active: form.is_active,
    }

    if (payload.code.length < 2 || payload.name.length < 2) {
      const msg = 'Código y nombre deben tener al menos 2 caracteres.'
      setError(msg)
      toast.error('No se pudo guardar la moneda', msg)
      return
    }

    setSaving(true)
    setError(null)

    const result = editingId
      ? await updateCurrencyAction(editingId, payload)
      : await createCurrencyAction(payload)

    if (!result.ok) {
      setSaving(false)
      setError(result.error.message)
      toast.error('No se pudo guardar la moneda', result.error.message)
      return
    }

    await loadItems()
    closeModal()
    setSaving(false)
    toast.success(
      editingId ? 'Moneda actualizada' : 'Moneda creada',
      `${payload.code} — ${payload.name}`,
      { persist: false },
    )
  }, [closeModal, editingId, form, loadItems, toast])

  // ─── ROW ACTIONS ──────────────────────────────────────────────────────────

  const toggleStatus = useCallback(async (item: CurrencyItem) => {
    if (item.is_system || saving || loading || rowActionId) return
    setRowActionId(item.id)
    setError(null)

    const result = await updateCurrencyAction(item.id, { is_active: !item.is_active })
    if (!result.ok) {
      setRowActionId(null)
      setError(result.error.message)
      toast.error('Error', result.error.message)
      return
    }

    await loadItems()
    setRowActionId(null)
    toast.success(item.is_active ? 'Moneda desactivada' : 'Moneda reactivada', undefined, { persist: false })
  }, [loadItems, loading, rowActionId, saving, toast])

  const removeItem = useCallback(async (item: CurrencyItem) => {
    if (item.is_system || saving || loading || rowActionId) return
    setRowActionId(item.id)
    setError(null)

    const result = await deleteCurrencyAction(item.id)
    if (!result.ok) {
      setRowActionId(null)
      setError(result.error.message)
      toast.error('No se pudo eliminar', result.error.message)
      return
    }

    await loadItems()
    setRowActionId(null)
    setPendingDelete(null)
    toast.success('Moneda eliminada', undefined, { persist: false })
  }, [loadItems, loading, rowActionId, saving, toast])

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <CatalogTable
        title="Catálogo de monedas"
        description="Disponibilidad monetaria para portafolios, transacciones y reportes base."
        count={filteredItems.length}
        summary={(
          <>
            <StatusBadge tone="success">{activeCount} activas</StatusBadge>
            <StatusBadge tone="info">{customCount} personalizadas</StatusBadge>
            <StatusBadge tone="primary">{defaultCount} predeterminadas</StatusBadge>
          </>
        )}
        primaryAction={(
          <CreateModuleButton onClick={openCreateModal} label="Nueva moneda" />
        )}
        search={(
          <DataSearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar moneda, código o símbolo"
            className="filters-search"
          />
        )}
        filters={(
          <AppSelect
            value={statusFilter}
            onChange={value => setStatusFilter(value as StatusFilter)}
            className="filters-control sm:w-[164px]"
            compact
            searchable={false}
            options={[
              { value: 'all', label: 'Todos los estados' },
              { value: 'active', label: 'Activas' },
              { value: 'inactive', label: 'Inactivas' },
            ]}
          />
        )}
        error={error}
        onRetry={() => {
          void loadItems()
        }}
        loading={loading}
        empty={filteredItems.length === 0}
        loadingState={(
          <div className="divide-y divide-[var(--c-border)]">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.7fr)_200px_180px_auto] md:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-[var(--c-surface-2)]" />
                    <div className="h-3 w-24 animate-pulse rounded bg-[var(--c-surface-2)]" />
                  </div>
                </div>
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--c-surface-2)]" />
                <div className="h-7 w-32 animate-pulse rounded-md bg-[var(--c-surface-2)]" />
                <div className="flex gap-2 md:justify-end">
                  <div className="h-8 w-8 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                  <div className="h-8 w-8 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                </div>
              </div>
            ))}
          </div>
        )}
        emptyState={(
          <CatalogEmptyState
            title="No hay monedas con este corte."
            description={query.trim().length > 0
              ? 'Prueba otra búsqueda o cambia el estado para revisar el catálogo completo.'
              : 'Crea la primera moneda personalizada para ampliar el catálogo disponible.'}
            action={(
              <Button type="button" onClick={openCreateModal} variant="secondary" size="md">
                Nueva moneda
              </Button>
            )}
          />
        )}
        columns={[
          { label: 'Moneda' },
          { label: 'País' },
          { label: 'Estado' },
          { label: 'Acciones', align: 'right' },
        ]}
        gridClassName="md:grid-cols-[minmax(0,1.7fr)_200px_180px_auto] md:items-center"
      >
        {filteredItems.map(item => (
          <CatalogRow
            key={item.id}
            gridClassName="md:grid-cols-[minmax(0,1.7fr)_200px_180px_auto] md:items-center"
            accentColor={item.is_default ? 'var(--c-primary)' : undefined}
            muted={!item.is_active}
          >
            <CatalogCell label="Moneda">
              <CatalogIdentity
                icon={(
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] font-mono text-sm font-semibold text-[var(--c-primary)]">
                    {item.symbol}
                  </span>
                )}
                title={`${item.code} — ${item.name}`}
                meta={(
                  <>
                    {item.is_system ? <StatusBadge tone="muted">Sistema</StatusBadge> : null}
                    {item.is_default ? <StatusBadge tone="primary">Predeterminada</StatusBadge> : null}
                  </>
                )}
              />
            </CatalogCell>

            <CatalogCell label="País">
              <p className="text-[12px] text-[var(--c-text-muted)]">
                {resolveCountryLabel(item.country)}
              </p>
            </CatalogCell>

            <CatalogCell label="Estado">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={item.is_active ? 'success' : 'danger'}>
                  {item.is_active ? 'Activa' : 'Inactiva'}
                </StatusBadge>
                {!item.is_system ? (
                  <StatusBadge tone="info">Editable</StatusBadge>
                ) : null}
              </div>
            </CatalogCell>

            <CatalogCell label="Acciones" align="right">
              {!item.is_system ? (
                <div className="flex items-center gap-1.5 md:justify-end">
                  <ActionIconButton
                    onClick={() => startEdit(item)}
                    disabled={Boolean(rowActionId)}
                    icon="edit"
                    label="Editar moneda"
                  />
                  <ActionIconButton
                    onClick={() => void toggleStatus(item)}
                    disabled={Boolean(rowActionId)}
                    icon={item.is_active ? 'deactivate' : 'reactivate'}
                    label={item.is_active ? 'Desactivar' : 'Activar'}
                    variant={item.is_active ? 'danger' : 'success'}
                  />
                  <ActionIconButton
                    onClick={() => setPendingDelete(item)}
                    disabled={Boolean(rowActionId)}
                    icon="delete"
                    label="Eliminar moneda"
                    variant="danger"
                  />
                </div>
              ) : (
                <div className="md:text-right">
                  <StatusBadge tone="muted">Bloqueada</StatusBadge>
                </div>
              )}
            </CatalogCell>
          </CatalogRow>
        ))}
      </CatalogTable>

      {/* Create/Edit Modal */}
      <RecordModal
        open={modalOpen}
        onClose={closeModal}
        eyebrow="Administración"
        title={editingId ? 'Editar moneda' : 'Nueva moneda'}
        subtitle="Las monedas están disponibles para portafolios y transacciones."
        size="sm"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? (
            <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
              <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
            </div>
          ) : null}

          <FormSection
            title="Datos base"
            description="Define el código y la etiqueta visible que usarán los portafolios, reportes y equivalencias."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Código" description="Usa el código corto que reconocerás en filtros y reportes.">
              <input
                value={form.code}
                onChange={event => setForm(prev => ({ ...prev, code: event.target.value.toUpperCase() }))}
                maxLength={10}
                required
                className="field-base ft-form-input w-full"
                placeholder="Ej: PEN"
              />
            </FormField>

            <FormField label="Nombre">
              <input
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                required
                className="field-base ft-form-input w-full"
                placeholder="Ej: Sol peruano"
              />
            </FormField>

            <FormField label="Símbolo" optional>
              <input
                value={form.symbol}
                onChange={event => setForm(prev => ({ ...prev, symbol: event.target.value }))}
                maxLength={10}
                className="field-base ft-form-input w-full"
                placeholder="Ej: S/"
              />
            </FormField>

            <FormField label="País" optional>
              <CountrySelect
                value={form.country}
                onChange={country => setForm(prev => ({ ...prev, country }))}
                className="field-base ft-form-input w-full"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Predeterminada"
            description="La moneda predeterminada se usará para reportes y equivalencias."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <label className="flex items-start gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={event => setForm(prev => ({ ...prev, is_default: event.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-[var(--c-border)] text-[var(--c-primary)] focus:ring-[var(--c-primary-soft)]"
              />
              <span className="space-y-1">
                <span className="block text-[13px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
                  Marcar como moneda predeterminada
                </span>
                <span className="block text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  Si la activas, FinTrack la priorizará como referencia base para nuevos análisis.
                </span>
              </span>
            </label>
          </FormSection>

          <RecordModalFooter>
            <FormActions
              secondaryAction={(
                <Button type="button" variant="secondary" size="lg" onClick={closeModal} disabled={saving}>
                  Cancelar
                </Button>
              )}
              primaryAction={(
                <Button type="submit" variant="primary" size="lg" loading={saving}>
                  {editingId ? 'Guardar cambios' : 'Crear moneda'}
                </Button>
              )}
            />
          </RecordModalFooter>
        </form>
      </RecordModal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar moneda"
        message={pendingDelete ? (
          <>
            Se eliminará <span className="font-semibold text-[var(--c-text)]">{pendingDelete.code} — {pendingDelete.name}</span>.
            {' '}Si tiene registros relacionados, la operación será bloqueada.
          </>
        ) : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void removeItem(pendingDelete)
        }}
        loading={Boolean(rowActionId && pendingDelete && rowActionId === pendingDelete.id)}
        danger
        confirmLabel="Eliminar"
      />
    </div>
  )
}
